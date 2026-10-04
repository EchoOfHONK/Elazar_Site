#!/usr/bin/env python3
"""Prompts happen on the host; API calls happen inside NPM, with secrets via stdin."""
import getpass
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys


def prompt(label, secret=False):
    try:
        with open('/dev/tty', 'r+') as tty:
            if secret:
                return getpass.getpass(label, stream=tty)
            tty.write(label)
            tty.flush()
            answer = tty.readline()
            if not answer:
                raise ValueError('Ввод прерван.')
            return answer.strip()
    except OSError as exc:
        raise ValueError('Нужен SSH-терминал для ввода настроек.') from exc


def env_values(path):
    if not path.exists():
        return {}
    result = {}
    for line in path.read_text().splitlines():
        match = re.match(r'^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$', line)
        if match:
            value = match[2]
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            result[match[1]] = value
    return result


def domain_name(value):
    value = value.lower().rstrip('.').encode('idna').decode('ascii')
    labels = value.split('.')
    if len(value) > 253 or len(labels) < 2 or any(not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', item) for item in labels) or not re.search(r'[a-z]', labels[-1]):
        raise ValueError('Введите домен без http://, порта, пути и звёздочки.')
    return value


def api_run(container, settings):
    program = Path(__file__).with_name('npm-api.cjs').read_text()
    run = subprocess.run(['docker', 'exec', '-i', container, 'node', '-e', program], input=json.dumps(settings), text=True, capture_output=True, timeout=760)
    try:
        reply = json.loads(run.stdout)
    except ValueError as exc:
        raise ValueError('Не удалось выполнить API NPM внутри контейнера. Нужен обычный образ jc21/nginx-proxy-manager с Node.js.') from exc
    if reply.get('error'):
        if reply.get('status') in (401, 403):
            raise ValueError('NPM не принял данные входа или права администратора.')
        raise ValueError(reply['error'])
    if run.returncode:
        raise ValueError('API NPM завершился с ошибкой.')
    return reply


def authenticate(container, path, domain=''):
    saved = env_values(path)
    email = saved.get('NPM_ADMIN_EMAIL', '')
    password = saved.get('NPM_ADMIN_PASSWORD', '')
    bootstrap = bool(email and password)
    if not bootstrap:
        email = prompt('Email администратора NPM: ')
        password = prompt('Пароль администратора NPM (ввод скрыт): ', secret=True)
    if not email or not password:
        raise ValueError('Нужны email и пароль администратора NPM.')
    settings = dict(email=email, password=password, bootstrap=bootstrap, domain=domain)
    reply = api_run(container, settings)
    if reply.get('needs_2fa'):
        settings['code'] = prompt('Код двухфакторной авторизации NPM: ')
        reply = api_run(container, settings)
    return reply


def main():
    command = sys.argv[1]
    if command == 'domain':
        print(domain_name(sys.argv[2]))
    elif command == 'init':
        path = Path(sys.argv[2])
        if path.exists():
            return
        email = prompt('Email для нового администратора NPM и Let’s Encrypt: ')
        if not re.fullmatch(r'[^\s=@]+@[^\s=@]+\.[^\s=@]+', email):
            raise ValueError('Нужен действующий email.')
        path.parent.mkdir(parents=True, exist_ok=True)
        # Separate password from the site, not passed through Docker environment.
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w') as file:
            file.write(f'NPM_ADMIN_EMAIL={email}\nNPM_ADMIN_PASSWORD={secrets.token_hex(32)}\n')
    elif command == 'bootstrap':
        authenticate(sys.argv[2], Path(sys.argv[3]))
        print('Администратор нового NPM создан через API.')
    elif command == 'configure':
        domain = domain_name(sys.argv[3])
        print(f'Настраиваю {domain} в NPM. Для HTTPS DNS должен указывать на сервер, порты 80/443 — быть доступными.')
        print('Выпуск сертификата принимает условия Let’s Encrypt: https://letsencrypt.org/repository/')
        reply = authenticate(sys.argv[2], Path(sys.argv[4]), domain)
        if reply.get('https_ready'):
            print(f'HTTPS готов: https://{domain}\nАдминка сайта: https://{domain}/admin.html')
        elif reply.get('ssl_error'):
            address = f'http://{domain}' if reply.get('http_ready') else 'Существующие настройки HTTPS сохранены.'
            print(f'{address}\nСертификат не выпущен: {reply["ssl_error"]}\nИсправьте DNS/доступ к порту 80 и повторите установщик.')
            return 2
        else:
            raise ValueError('Настройка домена не завершена.')
    elif command == 'show':
        site = env_values(Path(sys.argv[2]))
        print(f'\nАдминка сайта — логин: {site.get("ADMIN_LOGIN", "")}\nПароль: {site.get("ADMIN_TOKEN", "")}\nСохранено в: {sys.argv[2]}')
        npm = env_values(Path(sys.argv[3]))
        if npm:
            print(f'\nНовый NPM — email: {npm.get("NPM_ADMIN_EMAIL", "")}\nПароль: {npm.get("NPM_ADMIN_PASSWORD", "")}\nПанель: http://127.0.0.1:81 (через SSH-туннель)\nСохранено в: {sys.argv[3]}')
    else:
        raise ValueError('Неизвестная команда помощника.')
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except (ValueError, OSError, subprocess.TimeoutExpired, EOFError) as error:
        print(f'Ошибка: {error}', file=sys.stderr)
        sys.exit(1)
