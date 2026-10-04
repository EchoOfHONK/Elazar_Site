#!/usr/bin/env python3
"""Isolated installer regression checks; never call real Docker, Git or apt.

The Bash installer runs with platform/package checks bypassed. Every external
installation command is replaced by a strict, logged command stub. The actual
NPM API module uses injectable request fixtures, with real network calls blocked.
"""

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import importlib.util
sys.dont_write_bytecode = True

REPO = Path(__file__).resolve().parent.parent
NODE = os.environ.get("ELAZAR_TEST_NODE") or shutil.which("node")


STUB = r'''#!/usr/bin/python3
import json, os, pathlib, shutil, sys
name = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
root = pathlib.Path(os.environ["ELAZAR_QA_ROOT"])
state_file = root / "state.json"
state = json.loads(state_file.read_text())
with (root / "calls.jsonl").open("a") as stream:
    stream.write(json.dumps({"command": name, "args": args, "cwd": os.getcwd()}) + "\n")
def save(): state_file.write_text(json.dumps(state))
def output(value):
    if value is not None: print(value if isinstance(value, str) else json.dumps(value))
def fail(reason):
    print("UNEXPECTED STUB CALL: " + name + " " + repr(args) + ": " + reason, file=sys.stderr)
    sys.exit(97)
if name == "git":
    if args and args[0] == "-C": args = args[2:]
    if not args: fail("missing git command")
    op = args[0]
    if op == "clone":
        dest = pathlib.Path(args[-1])
        shutil.copytree(root / "fixture", dest)
        (dest / ".git").mkdir(exist_ok=True)
    elif op == "status": output(" M public/index.html" if state.get("git_dirty") else "")
    elif op == "remote": output(state.get("repo_url", "https://github.com/EchoOfHONK/Elazar_Site.git"))
    elif op in ["pull", "fetch", "checkout"]: pass
    elif op == "branch": output("main")
    elif op == "rev-parse":
        output("main" if "--abbrev-ref" in args else "true")
    else: fail("git subcommand is not modeled")
elif name == "docker":
    if not args: fail("missing docker command")
    op = args[0]
    if op in ["version", "info"]: output("24.0.0")
    elif op == "ps":
        rows = state.get("containers", [])
        fmt = args[args.index("--format") + 1] if "--format" in args else ""
        for row in rows:
            if "json" in fmt: output(row)
            elif ".ID" in fmt and ".Names" not in fmt: output(row.get("ID", "npm-test"))
            elif ".Names" in fmt and ".Image" in fmt: output(row.get("Names", "npm-test") + " " + row.get("Image", "jc21/nginx-proxy-manager:2.16.0"))
            elif ".Names" in fmt: output(row.get("Names", "npm-test"))
            else: output(row.get("ID", "npm-test"))
    elif op == "inspect":
        ident = args[-1]
        item = state.get("inspect", {}).get(ident)
        if ident == "elazar-site" and item is None: item = {"State": {"Running": True, "Health": {"Status": state.get("health", "healthy")}}}
        if item is None: sys.exit(1)
        flag = "--format" if "--format" in args else "-f"
        fmt = args[args.index(flag) + 1] if flag in args else ""
        if not fmt: output([item])
        elif "NetworkSettings.Networks" in fmt and "println" in fmt:
            for net in item.get("NetworkSettings", {}).get("Networks", {}): output(net)
        elif "NetworkSettings.Networks" in fmt: output(item.get("NetworkSettings", {}).get("Networks", {}))
        elif "State.Running" in fmt: output("true" if item.get("State", {}).get("Running", True) else "false")
        elif "State.Health.Status" in fmt: output(item.get("State", {}).get("Health", {}).get("Status", "healthy"))
        elif "State.Status" in fmt: output(item.get("State", {}).get("Status", "running"))
        elif "Config.Image" in fmt: output(item.get("Config", {}).get("Image", "jc21/nginx-proxy-manager:2.16.0"))
        elif "Config.Labels" in fmt: output(item.get("Config", {}).get("Labels", {}).get("com.docker.compose.project", ""))
        else: fail("inspect template is not modeled")
    elif op == "network":
        sub = args[1]
        if sub == "connect": fail("persistent network attachment required; network connect forbidden")
        if sub == "inspect":
            net = args[-1]
            item = state.get("networks", {}).get(net)
            if item is None: sys.exit(1)
            flag = "--format" if "--format" in args else "-f"
            fmt = args[args.index(flag) + 1] if flag in args else ""
            output((item.get("Driver", "bridge") + (" true" if item.get("Internal", False) else " false")) if ".Internal" in fmt else item.get("Driver", "bridge") if fmt else [item])
        elif sub == "create":
            net = args[-1]
            state.setdefault("networks", {})[net] = {"Name": net, "Driver": "bridge"}
            save(); output(net)
        else: fail("network mutation is not modeled")
    elif op == "compose":
        # Capture all arguments including files/project names. No real containers.
        verbs = [v for v in args if v in ["version", "config", "up", "build", "ps", "logs", "exec", "port"]]
        if not verbs: fail("compose verb is not modeled")
        verb = verbs[0]
        if verb == "version": output("Docker Compose version v2.39.0")
        elif verb == "ps": output("npm-test" if args[-1] == "npm" else "elazar-site")
        elif verb in ["config", "up", "build", "logs"]: pass
        elif verb == "exec": output("200")
        elif verb == "port": output("127.0.0.1:81")
        else: fail("compose action is not modeled")
    else: fail("docker subcommand is not modeled")
elif name == "openssl":
    if args[:2] == ["rand", "-hex"]: output("7e" * int(args[2]))
    else: fail("only credential generation is permitted")
elif name in ["apt", "apt-get", "sudo", "systemctl", "dpkg", "curl", "wget", "nginx"]:
    fail("host installation or network access is forbidden in this harness")
elif name == "ss": output(state.get("busy_ports", ""))
elif name == "sleep": pass
else: fail("unknown tool")
'''


class Sandbox:
    """Owns all simulated target-server files and command logs."""

    def __init__(self, state=None):
        self.temp = tempfile.TemporaryDirectory(prefix="elazar-install-qa-")
        self.root = Path(self.temp.name)
        self.bin = self.root / "bin"
        self.bin.mkdir()
        self.fixture = self.root / "fixture"
        self.fixture.mkdir()
        self.install_dir = self.root / "site"
        self.write_state(state or {})
        (self.root / "calls.jsonl").touch()
        for name in ("git", "docker", "openssl", "apt", "apt-get", "sudo", "systemctl", "dpkg", "curl", "wget", "nginx", "sleep", "ss"):
            stub = self.bin / name
            stub.write_text(STUB)
            stub.chmod(0o755)
        self.env = os.environ.copy()
        self.env.update({"ELAZAR_QA_ROOT": str(self.root), "PATH": str(self.bin) + ":/usr/bin:/bin:/usr/sbin:/sbin"})
        for key in ["ADMIN_LOGIN", "ADMIN_TOKEN", "DOCKER_HOST", "COMPOSE_FILE", "COMPOSE_PROJECT_NAME"]:
            self.env.pop(key, None)

    def write_state(self, state):
        (self.root / "state.json").write_text(json.dumps(state))

    def calls(self, command=None):
        calls = [json.loads(line) for line in (self.root / "calls.jsonl").read_text().splitlines()]
        return [row for row in calls if command is None or row["command"] == command]

    def clear_calls(self):
        (self.root / "calls.jsonl").write_text("")

    def shell(self, source, stdin=""):
        return subprocess.run(["/bin/bash", "-c", source], cwd=self.root, env=self.env, input=stdin, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=20)

    def close(self):
        self.temp.cleanup()


HELPER_STUB = r'''import json, os, pathlib, sys
root = pathlib.Path(os.environ["ELAZAR_QA_ROOT"])
args = sys.argv[1:]
with (root / "calls.jsonl").open("a") as stream:
    stream.write(json.dumps({"command": "npm-helper", "args": args, "cwd": os.getcwd()}) + "\n")
action = args[0]
if action == "domain": print(args[1].lower())
elif action == "init":
    target = pathlib.Path(args[1]); target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("NPM_ADMIN_EMAIL=admin@example.com\nNPM_ADMIN_PASSWORD=qa-only-new-password\n")
    target.chmod(0o600)
elif action == "bootstrap":
    if json.loads((root / "state.json").read_text()).get("bootstrap_fail"):
        raise SystemExit("Simulated failed first NPM bootstrap")
elif action in ["configure", "show"]: pass
else: raise SystemExit("Unexpected helper action")
'''


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.sandbox = Sandbox()
        self.addCleanup(self.sandbox.close)
        (self.sandbox.fixture / "deploy").mkdir()
        (self.sandbox.fixture / "npm").mkdir()
        (self.sandbox.fixture / "deploy" / "npm-setup.py").write_text(HELPER_STUB)
        for name in ["Dockerfile", "compose.yaml", "install.sh"]:
            source = REPO / name
            if source.exists(): shutil.copy2(source, self.sandbox.fixture / name)
        if (REPO / "npm" / "compose.yaml").exists():
            shutil.copy2(REPO / "npm" / "compose.yaml", self.sandbox.fixture / "npm" / "compose.yaml")

    def run_install(self, extra=(), domain="example.com", allow_blank=False):
        import shlex
        argv = ["--dir", str(self.sandbox.install_dir), *extra]
        if domain is not None: argv += ["--domain", domain]
        source = "\n".join([
            "ELAZAR_INSTALLER_LIBRARY=1 source " + shlex.quote(str(REPO / "install.sh")),
            # Only platform/package checks are bypassed. Docker detection and every
            # installer mutation still execute against strict, logged stubs.
            "check_system() { :; }",
            "install_dependencies() { :; }",
            "ask() { :; }" if allow_blank else "ask() { die 'Unexpected interactive prompt in noninteractive fixture'; }",
            "main " + " ".join(map(shlex.quote, argv)),
        ])
        return self.sandbox.shell(source)

    def assert_success(self, result):
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertNotIn("UNEXPECTED STUB CALL", result.stderr)

    def assert_no_network_connect(self):
        self.assertFalse(any(c["args"][:2] == ["network", "connect"] for c in self.sandbox.calls("docker")))

    def use_existing_npm(self, networks=None):
        networks = networks or {"bridge": {}, "npm_default": {}}
        self.sandbox.write_state({
            "containers": [{"Names": "current-npm", "Image": "jc21/nginx-proxy-manager:2.16.0", "ID": "npm-id"}],
            "inspect": {"current-npm": {"State": {"Running": True}, "NetworkSettings": {"Networks": networks}}},
            "networks": {name: {"Name": name, "Driver": "bridge", "Internal": False} for name in networks},
        })

    def test_fresh_install_creates_credentials_and_new_npm(self):
        result = self.run_install()
        self.assert_success(result)
        env = self.sandbox.install_dir / ".env"
        values = dict(line.split("=", 1) for line in env.read_text().splitlines())
        self.assertEqual(values["ADMIN_LOGIN"], "elazar-admin")
        self.assertEqual(len(values["ADMIN_TOKEN"]), 64)
        self.assertEqual(env.stat().st_mode & 0o777, 0o600)
        self.assertEqual((self.sandbox.install_dir / ".deploy.env").read_text(), "ELAZAR_PROXY_NETWORK=proxy\nELAZAR_PREVIEW_PORT=3000\nELAZAR_DOMAIN=example.com\n")
        self.assertTrue((self.sandbox.install_dir / "npm" / ".env").exists())
        self.assertEqual(len(self.sandbox.calls("git")), 1)
        self.assertEqual(self.sandbox.calls("git")[0]["args"][:3], ["clone", "--branch", "main"])
        self.assertTrue(any(c["args"][:2] == ["network", "create"] for c in self.sandbox.calls("docker")))
        self.assertTrue(any("build" in c["args"] and "--pull" in c["args"] for c in self.sandbox.calls("docker")))
        all_calls = self.sandbox.calls()
        bootstrap = next(i for i, c in enumerate(all_calls) if c["command"] == "npm-helper" and c["args"][0] == "bootstrap")
        build = next(i for i, c in enumerate(all_calls) if c["command"] == "docker" and "build" in c["args"])
        self.assertLess(bootstrap, build)
        self.assert_no_network_connect()

    def test_rerun_preserves_credentials_exactly(self):
        self.use_existing_npm()
        self.assert_success(self.run_install())
        env = self.sandbox.install_dir / ".env"
        original = b'# An existing deployment with comments\nPORT=3000\nADMIN_LOGIN="saved-login"\nADMIN_TOKEN="saved-qa-secret"\n'
        env.write_bytes(original)
        self.sandbox.clear_calls()
        self.assert_success(self.run_install())
        self.assertEqual(env.read_bytes(), original)
        self.assertEqual(env.stat().st_mode & 0o777, 0o600)
        self.assertFalse(self.sandbox.calls("openssl"), "Rerun must not generate or rotate a password")
        self.assertTrue(any("pull" in c["args"] and "--ff-only" in c["args"] for c in self.sandbox.calls("git")))

    def test_existing_npm_reuses_user_bridge_without_transient_connect(self):
        self.use_existing_npm()
        self.assert_success(self.run_install(["--preview-port", "4400"]))
        settings = (self.sandbox.install_dir / ".deploy.env").read_text()
        self.assertEqual(settings, "ELAZAR_PROXY_NETWORK=npm_default\nELAZAR_PREVIEW_PORT=4400\nELAZAR_DOMAIN=example.com\n")
        self.assertFalse((self.sandbox.install_dir / "npm" / ".env").exists(), "Existing NPM must not be reinitialized")
        self.assertFalse(any(c["args"][:2] == ["network", "create"] for c in self.sandbox.calls("docker")))
        self.assertFalse(any("--project-directory" in c["args"] and str(self.sandbox.install_dir / "npm") in c["args"] for c in self.sandbox.calls("docker")))
        self.assertEqual(self.sandbox.calls("npm-helper")[1]["args"][:3], ["configure", "current-npm", "example.com"])
        self.assert_no_network_connect()

    def test_rerun_without_flags_remembers_custom_domain_and_preview_port(self):
        self.use_existing_npm()
        self.assert_success(self.run_install(["--preview-port", "4400"], domain="archive.example.org"))
        self.sandbox.clear_calls()
        self.assert_success(self.run_install(domain=None))
        self.assertEqual((self.sandbox.install_dir / ".deploy.env").read_text(), "ELAZAR_PROXY_NETWORK=npm_default\nELAZAR_PREVIEW_PORT=4400\nELAZAR_DOMAIN=archive.example.org\n")
        configure = next(c for c in self.sandbox.calls("npm-helper") if c["args"][0] == "configure")
        self.assertEqual(configure["args"][2], "archive.example.org")

    def test_failed_new_npm_bootstrap_recovers_on_rerun_without_domain(self):
        self.sandbox.write_state({"bootstrap_fail": True})
        failed = self.run_install(domain="", allow_blank=True)
        self.assertNotEqual(failed.returncode, 0)
        npm_env = self.sandbox.install_dir / "npm" / ".env"
        original = npm_env.read_bytes()
        self.sandbox.write_state({
            "containers": [{"Names": "npm-test", "Image": "jc21/nginx-proxy-manager:2.16.0"}],
            "inspect": {"npm-test": {"State": {"Running": True}, "Config": {"Labels": {"com.docker.compose.project": "elazar-npm"}}, "NetworkSettings": {"Networks": {"proxy": {}}}}},
            "networks": {"proxy": {"Name": "proxy", "Driver": "bridge", "Internal": False}},
        })
        self.sandbox.clear_calls()
        self.assert_success(self.run_install(domain="", allow_blank=True))
        self.assertEqual(npm_env.read_bytes(), original)
        actions = [c["args"][0] for c in self.sandbox.calls("npm-helper")]
        self.assertEqual(actions, ["bootstrap", "show"])
        self.assertFalse(any(c["args"][:2] == ["network", "create"] for c in self.sandbox.calls("docker")))
        self.assert_no_network_connect()

    def test_dirty_checkout_aborts_before_mutating_credentials_or_build(self):
        self.use_existing_npm()
        self.assert_success(self.run_install())
        env = self.sandbox.install_dir / ".env"
        original = env.read_bytes()
        state = json.loads((self.sandbox.root / "state.json").read_text())
        state["git_dirty"] = True
        self.sandbox.write_state(state)
        self.sandbox.clear_calls()
        result = self.run_install()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("есть изменения", result.stderr)
        self.assertEqual(env.read_bytes(), original)
        self.assertFalse(any("pull" in c["args"] for c in self.sandbox.calls("git")))
        self.assertFalse(any("build" in c["args"] or "up" in c["args"] for c in self.sandbox.calls("docker")))
        self.assertFalse(self.sandbox.calls("npm-helper"))

    def test_unattached_explicit_network_is_rejected(self):
        self.use_existing_npm()
        result = self.run_install(["--network", "other-network"])
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("сеть не подключена", result.stderr)
        self.assertFalse(any("build" in c["args"] or "up" in c["args"] for c in self.sandbox.calls("docker")))
        self.assert_no_network_connect()


API_PRELUDE = r'''
const assert = require('node:assert/strict');
require('node:http').request = () => { throw new Error('Real network is forbidden in these fixtures'); };
const { configure, covers, ADVANCED } = require(process.env.ELAZAR_API_MODULE);
const settings = {email:'qa@example.com', password:'fake-qa-password', domain:'example.com'};
const futureCert = {id:21, domain_names:['example.com'], expires_on:'2036-10-04 12:00:00'};
const host = {id:7, domain_names:['example.com'], forward_scheme:'http', forward_host:'elazar-site', forward_port:3000, certificate_id:21, advanced_config:ADVANCED};
function fixture(options={}) {
  const state = {setup: options.setup ?? true, hosts: options.hosts ?? [structuredClone(host)], certs: options.certs ?? [structuredClone(futureCert)], calls: []};
  async function api(method, path, data, token, timeout) {
    state.calls.push({method,path,data,token,timeout});
    if(method==='GET' && path==='/') return {status:'OK', setup:state.setup, version:{major:2,minor:options.minor ?? 16,revision:0}};
    if(method==='POST' && path==='/users') {state.setup=true; return {id:1};}
    if(method==='POST' && path==='/tokens') return options.twofa ? {requires_2fa:true,challenge_token:'challenge-fixture'} : {token:'token-fixture'};
    if(method==='POST' && path==='/tokens/2fa') return {token:'token-fixture'};
    if(method==='GET' && path==='/nginx/proxy-hosts') return state.hosts;
    if(method==='POST' && path==='/nginx/proxy-hosts') {const item={id:7,...data};state.hosts.push(item);return item;}
    if(method==='GET' && path==='/nginx/certificates') return state.certs;
    if(method==='POST' && path==='/nginx/certificates') {
      if(options.certFails) throw new Error('DNS does not point to this server');
      const item={id:21,...data,expires_on:'2036-10-04 12:00:00'};state.certs.push(item);return item;
    }
    if(method==='PUT' && path==='/nginx/proxy-hosts/7') {Object.assign(state.hosts[0],data);return state.hosts[0];}
    throw new Error('Unexpected fixture request: '+method+' '+path);
  }
  return {state,api};
}
const noWait = async()=>{};
'''


@unittest.skipUnless(NODE, "Node.js required for API fixtures; set ELAZAR_TEST_NODE or add node to PATH")
class NpmApiTests(unittest.TestCase):
    def run_js(self, body):
        env = os.environ.copy()
        env.update({"ELAZAR_NPM_LIBRARY": "1", "ELAZAR_API_MODULE": str(REPO / "deploy" / "npm-api.cjs")})
        program = API_PRELUDE + "\n(async()=>{\n" + body + "\nconsole.log('fixture passed');\n})().catch(e=>{console.error(e);process.exitCode=1});"
        result = subprocess.run([str(NODE), "-e", program], env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=10)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("fixture passed", result.stdout)

    def test_conflicting_domain_is_preserved_without_proxy_or_certificate_mutation(self):
        self.run_js(r'''
const {state,api}=fixture({hosts:[{...host,forward_host:'another-service'}]});
await assert.rejects(configure(settings,api,noWait), /Домен уже используется/);
assert.equal(state.hosts[0].forward_host,'another-service');
assert.equal(state.calls.filter(c=>['POST','PUT','DELETE'].includes(c.method) && c.path.startsWith('/nginx/')).length,0);
''')

    def test_duplicate_domain_hosts_are_rejected_without_mutation(self):
        self.run_js(r'''
const {state,api}=fixture({hosts:[{...host},{...host,id:9}]});
await assert.rejects(configure(settings,api,noWait), /несколько Proxy Hosts/);
assert.equal(state.calls.filter(c=>['POST','PUT','DELETE'].includes(c.method) && c.path.startsWith('/nginx/')).length,0);
''')

    def test_rerun_reuses_existing_certificate_and_preserves_host_settings(self):
        self.run_js(r'''
const custom={...host,advanced_config:'custom existing config',access_list_id:42,caching_enabled:true,locations:[{path:'/extra'}]};
const {state,api}=fixture({hosts:[custom]});
assert.equal((await configure(settings,api,noWait)).https_ready,true);
assert.equal(state.calls.filter(c=>c.method==='POST' && c.path.startsWith('/nginx/')).length,0);
const update=state.calls.find(c=>c.method==='PUT');
assert.deepEqual(update.data,{certificate_id:21,ssl_forced:true,http2_support:true,enabled:true});
assert.equal(custom.advanced_config,'custom existing config');
assert.equal(custom.access_list_id,42);
assert.deepEqual(custom.locations,[{path:'/extra'}]);
''')

    def test_failed_certificate_retains_http_and_attempts_issue_only_once(self):
        self.run_js(r'''
const {state,api}=fixture({hosts:[],certs:[],certFails:true});
const reply=await configure(settings,api,noWait);
assert.equal(reply.http_ready,true);
assert.equal(reply.ssl_error,'DNS does not point to this server');
assert.equal(state.calls.filter(c=>c.method==='POST' && c.path==='/nginx/certificates').length,1);
assert.equal(state.calls.filter(c=>c.method==='PUT').length,0);
assert.equal(state.hosts[0].ssl_forced,false);
assert.equal(state.hosts[0].certificate_id,0);
''')

    def test_new_bootstrap_and_v216_certificate_payload_are_idempotent(self):
        self.run_js(r'''
const {state,api}=fixture({setup:false,hosts:[],certs:[]});
assert.equal((await configure({...settings,bootstrap:true},api,noWait)).https_ready,true);
assert.equal(state.calls.filter(c=>c.method==='POST' && c.path==='/users').length,1);
assert.equal(state.calls.find(c=>c.path==='/users').data.auth.secret,settings.password);
assert.deepEqual(state.calls.find(c=>c.method==='POST' && c.path==='/nginx/certificates').data.meta,{dns_challenge:false});
state.calls.length=0;
assert.equal((await configure({...settings,bootstrap:true},api,noWait)).https_ready,true);
assert.equal(state.calls.filter(c=>c.method==='POST' && c.path!=='/tokens').length,0);
''')

    def test_v213_and_v214_certificate_payloads_use_current_schema(self):
        self.run_js(r'''
for (const minor of [13,14]) {
  const {state,api}=fixture({minor,hosts:[],certs:[]});
  assert.equal((await configure(settings,api,noWait)).https_ready,true);
  assert.deepEqual(state.calls.find(c=>c.method==='POST' && c.path==='/nginx/certificates').data.meta,{dns_challenge:false});
}
''')

    def test_v212_certificate_payload_uses_legacy_email_and_agreement(self):
        self.run_js(r'''
const {state,api}=fixture({minor:12,hosts:[],certs:[]});
assert.equal((await configure(settings,api,noWait)).https_ready,true);
assert.deepEqual(state.calls.find(c=>c.method==='POST' && c.path==='/nginx/certificates').data.meta,{dns_challenge:false,letsencrypt_email:settings.email,letsencrypt_agree:true});
''')

    def test_existing_uninitialized_npm_requires_panel_setup(self):
        self.run_js(r'''
const {state,api}=fixture({setup:false});
await assert.rejects(configure(settings,api,noWait), /первоначальную настройку существующего NPM/);
assert.equal(state.calls.filter(c=>c.method!=='GET').length,0);
''')

    def test_two_factor_challenge_only_configures_after_code(self):
        self.run_js(r'''
const {state,api}=fixture({twofa:true});
assert.deepEqual(await configure(settings,api,noWait),{needs_2fa:true});
assert.equal(state.calls.filter(c=>c.path.startsWith('/nginx/')).length,0);
state.calls.length=0;
assert.equal((await configure({...settings,code:'123456'},api,noWait)).https_ready,true);
assert.deepEqual(state.calls.find(c=>c.path==='/tokens/2fa').data,{challenge_token:'challenge-fixture',code:'123456'});
''')

    def test_certificate_coverage_rejects_expired_and_nested_wildcards(self):
        self.run_js(r'''
assert.equal(covers({...futureCert,domain_names:['*.example.com']},['wiki.example.com']),true);
assert.equal(covers({...futureCert,domain_names:['*.example.com']},['a.wiki.example.com']),false);
assert.equal(covers({...futureCert,domain_names:['*.example.com']},['example.com']),false);
assert.equal(covers({...futureCert,expires_on:'2020-01-01 00:00:00'},['example.com']),false);
''')


class NpmHelperTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location("npm_setup", REPO / "deploy" / "npm-setup.py")
        cls.helper = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.helper)

    def test_domain_validation_and_idna(self):
        self.assertEqual(self.helper.domain_name("EXAMPLE.COM."), "example.com")
        self.assertEqual(self.helper.domain_name("пример.рф"), "xn--e1afmkfd.xn--p1ai")
        for invalid in ["http://example.com", "example.com/path", "example.com:443", "*.example.com", "localhost", "-bad.example.com", "a..example.com", "example.123"]:
            with self.subTest(value=invalid), self.assertRaises(ValueError):
                self.helper.domain_name(invalid)

    def test_saved_credentials_parse_without_trimming_quoted_password(self):
        with tempfile.TemporaryDirectory(prefix="elazar-env-qa-") as directory:
            path = Path(directory) / ".env"
            path.write_text('# comment\nADMIN_LOGIN="preserved-user"\nADMIN_TOKEN=\' password with spaces \'\n')
            self.assertEqual(self.helper.env_values(path), {"ADMIN_LOGIN": "preserved-user", "ADMIN_TOKEN": " password with spaces "})


if __name__ == "__main__":
    unittest.main(verbosity=2)
if __name__ == "__main__":
    unittest.main(verbosity=2)
