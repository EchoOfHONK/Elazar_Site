/* NPM API runs inside its container. Credentials arrive through stdin only. */
const http = require('node:http');

const ADVANCED = 'client_max_body_size 330m;\nclient_body_timeout 300s;\nproxy_send_timeout 300s;\nproxy_read_timeout 300s;';
function request(method, path, data, token, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const body = data === undefined ? '' : JSON.stringify(data);
    const req = http.request({
      hostname: '127.0.0.1', port: process.env.NPM_ADMIN_PORT || 81,
      path: '/api' + path, method,
      headers: { 'Content-Type': 'application/json', ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }
    }, res => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { raw += chunk; });
      res.on('end', () => {
        let value;
        try { value = raw ? JSON.parse(raw) : {}; } catch { return reject(new Error('NPM вернул ответ без JSON (HTTP ' + res.statusCode + ').')); }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          const error = new Error('NPM HTTP ' + res.statusCode + ': ' + (value.error?.message || value.message || 'ошибка API'));
          error.status = res.statusCode;
          return reject(error);
        }
        resolve(value);
      });
    });
    req.setTimeout(timeout, () => req.destroy(new Error('Истекло время ожидания NPM. Перед повтором проверьте сертификаты в его панели.')));
    req.on('error', reject);
    req.end(body);
  });
}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function covers(cert, domains) {
  const expires = typeof cert.expires_on === 'number' ? cert.expires_on * 1000 : Date.parse(cert.expires_on);
  return expires > Date.now() + 86400000 && domains.every(domain => (cert.domain_names || []).some(name => name === domain || (name.startsWith('*.') && domain.split('.').length === name.split('.').length && domain.endsWith(name.slice(1)))));
}
async function configure(settings, api = request, wait = pause) {
  let info;
  for (let attempt = 0; attempt < 60; attempt++) {
    try { info = await api('GET', '/'); if (info.status === 'OK') break; } catch { /* allow NPM database startup */ }
    await wait(2000);
  }
  if (!info || info.status !== 'OK') throw new Error('NPM ещё не отвечает. Повторите запуск после его старта.');
  if (info.setup === false) {
    if (!settings.bootstrap) throw new Error('Сначала завершите первоначальную настройку существующего NPM в его панели.');
    await api('POST', '/users', { name: 'Administrator', nickname: 'Admin', email: settings.email, roles: ['admin'], auth: { type: 'password', secret: settings.password } });
  }
  let auth = await api('POST', '/tokens', { identity: settings.email, secret: settings.password });
  if (auth.requires_2fa) {
    if (!settings.code) return { needs_2fa: true };
    auth = await api('POST', '/tokens/2fa', { challenge_token: auth.challenge_token, code: settings.code });
  }
  if (!auth.token) throw new Error('NPM не выдал токен авторизации.');
  if (!settings.domain) return { ready: true };
  const token = auth.token;
  const hosts = await api('GET', '/nginx/proxy-hosts', undefined, token);
  const matches = hosts.filter(host => host.domain_names?.includes(settings.domain));
  if (matches.length > 1) throw new Error('В NPM несколько Proxy Hosts для этого домена. Исправьте их в панели.');
  let host = matches[0];
  if (host && (host.forward_host !== 'elazar-site' || Number(host.forward_port) !== 3000 || host.forward_scheme !== 'http')) {
    throw new Error('Домен уже используется другим Proxy Host. Его настройки сохранены; выберите свободный домен.');
  }
  if (!host) {
    host = await api('POST', '/nginx/proxy-hosts', {
      domain_names: [settings.domain], forward_scheme: 'http', forward_host: 'elazar-site', forward_port: 3000,
      certificate_id: 0, ssl_forced: false, access_list_id: 0, caching_enabled: false,
      block_exploits: false, allow_websocket_upgrade: false, http2_support: false,
      hsts_enabled: false, hsts_subdomains: false, advanced_config: ADVANCED, meta: {}, locations: []
    }, token);
  }
  if (!host.id) throw new Error('NPM не вернул ID Proxy Host.');
  const certificates = await api('GET', '/nginx/certificates', undefined, token);
  let cert = certificates.find(item => item.id === host.certificate_id && covers(item, host.domain_names));
  cert ||= certificates.find(item => covers(item, host.domain_names));
  if (!cert) {
    if (host.domain_names.length !== 1) throw new Error('У существующего хоста несколько доменов. Выпустите сертификат для них в панели NPM.');
    // One request only. Re-running lists certificates before issuing another.
    const modern = Number(info.version?.major) > 2 || (Number(info.version?.major) === 2 && Number(info.version?.minor) >= 13);
    const meta = modern ? { dns_challenge: false } : { dns_challenge: false, letsencrypt_email: settings.email, letsencrypt_agree: true };
    try {
      cert = await api('POST', '/nginx/certificates', { provider: 'letsencrypt', domain_names: host.domain_names, meta }, token, 600000);
    } catch (error) {
      return { http_ready: !host.ssl_forced, domain: settings.domain, ssl_error: error.message.split(settings.password).join('[скрыто]') };
    }
  }
  if (!cert.id) throw new Error('NPM не вернул ID сертификата.');
  const changes = { certificate_id: cert.id, ssl_forced: true, http2_support: true, enabled: true };
  if (!host.advanced_config) changes.advanced_config = ADVANCED;
  await api('PUT', '/nginx/proxy-hosts/' + host.id, changes, token);
  return { https_ready: true, domain: settings.domain };
}
module.exports = { configure, covers, ADVANCED };
if (process.env.ELAZAR_NPM_LIBRARY !== '1') {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', chunk => { raw += chunk; });
  process.stdin.on('end', async () => {
    let settings;
    try { settings = JSON.parse(raw); console.log(JSON.stringify(await configure(settings))); }
    catch (error) {
      let message = error.message;
      if (settings?.password) message = message.split(settings.password).join('[скрыто]');
      console.log(JSON.stringify({ error: message, status: error.status }));
      process.exitCode = 1;
    }
  });
}
