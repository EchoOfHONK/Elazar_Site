#!/usr/bin/env bash
# Debian 12/13 installer. Interactive input uses /dev/tty, also with curl | bash.
set -Eeuo pipefail

ELAZAR_REPO=https://github.com/EchoOfHONK/Elazar_Site.git
INSTALL_DIR=/opt/elazar
DOMAIN=""
DOMAIN_READY=0
NPM_CONTAINER=""
PROXY_NETWORK=""
PREVIEW_PORT=3000
PREVIEW_PORT_EXPLICIT=0

log() { printf '\n→ %s\n' "$*"; }
die() { printf '\nОшибка: %s\n' "$*" >&2; exit 1; }
ask() {
  local answer
  if [[ ! -r /dev/tty ]]; then die 'Нужен SSH-терминал для ввода настроек.'; fi
  read -r -p "$1" answer </dev/tty || die 'Ввод прерван.'
  printf '%s' "$answer"
}
usage() {
  cat <<'EOF'
Запуск: sudo bash install.sh [--domain example.com] [--dir /opt/elazar]
        [--npm-container NAME] [--network NAME] [--preview-port 3000]
Скрипт устанавливает сайт и Docker, находит или создаёт NPM.
Для настройки домена нужны DNS A-запись сервера и доступные порты 80/443.
Пустой домен позволяет запустить сайт без настройки DNS/HTTPS.
Повторный запуск обновляет сайт, сохраняя .env и тома с контентом.
EOF
}
parse_args() {
  while (($#)); do
    case "$1" in
      --domain|--dir|--npm-container|--network|--preview-port)
        (($# >= 2)) || die "Нет значения для $1"
        case "$1" in
          --domain) DOMAIN=$2 ;;
          --dir) INSTALL_DIR=$2 ;;
          --npm-container) NPM_CONTAINER=$2 ;;
          --network) PROXY_NETWORK=$2 ;;
          --preview-port) PREVIEW_PORT=$2; PREVIEW_PORT_EXPLICIT=1 ;;
        esac
        shift 2 ;;
      -h|--help) usage; exit 0 ;;
      *) die "Неизвестный параметр: $1" ;;
    esac
  done
  [[ "$INSTALL_DIR" == /* && "$INSTALL_DIR" != / ]] || die 'Каталог должен быть абсолютным, например /opt/elazar.'
  if [[ ! "$PREVIEW_PORT" =~ ^[0-9]+$ ]] || ((PREVIEW_PORT < 1024 || PREVIEW_PORT > 65535)); then
    die 'Порт должен быть от 1024 до 65535.'
  fi
  if [[ -n "$NPM_CONTAINER" && ! "$NPM_CONTAINER" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]]; then die 'Некорректное имя контейнера.'; fi
  if [[ -n "$PROXY_NETWORK" && ! "$PROXY_NETWORK" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]*$ ]]; then die 'Некорректное имя Docker-сети.'; fi
}
check_system() {
  ((EUID == 0)) || die 'Запустите скрипт через sudo bash или от root.'
  [[ -f /etc/os-release ]] || die 'Нужен Debian 12 или 13.'
  # shellcheck disable=SC1091
  source /etc/os-release
  [[ "$ID" == debian && ("$VERSION_ID" == 12 || "$VERSION_ID" == 13) ]] || die 'Поддерживается Debian 12/13.'
  case "$(dpkg --print-architecture)" in
    amd64|arm64) ;;
    *) die 'Для этого комплекта Docker + NPM нужен amd64 или arm64.' ;;
  esac
  exec 9>/run/lock/elazar-install.lock
  flock -n 9 || die 'Другой установщик Элазара уже работает.'
}
install_dependencies() {
  log 'Проверяю необходимые пакеты'
  local missing=0 tool
  for tool in curl git openssl python3 ss; do
    command -v "$tool" >/dev/null 2>&1 || missing=1
  done
  if ((missing)) || [[ ! -s /etc/ssl/certs/ca-certificates.crt ]]; then
    apt-get update
    apt-get install -y --no-install-recommends ca-certificates curl git openssl python3 iproute2
  fi
}
docker_repository() {
  if grep -R -q 'download.docker.com/linux/debian' /etc/apt/sources.list /etc/apt/sources.list.d 2>/dev/null; then
    apt-get update
    return
  fi
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL --retry 3 https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  cat >/etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/debian
Suites: $VERSION_CODENAME
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
  apt-get update
}
install_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    local package conflicts=""
    for package in docker.io docker-compose docker-doc docker-buildx podman-docker containerd runc; do
      if dpkg-query -W -f='${Status}' "$package" 2>/dev/null | is_installed; then
        conflicts+=" $package"
      fi
    done
    [[ -z "$conflicts" ]] || die "Сначала разберите конфликтующие пакеты:$conflicts. Инструкция: https://docs.docker.com/engine/install/debian/"
    log 'Устанавливаю Docker из официального APT-репозитория'
    docker_repository
    apt-get install -y --no-install-recommends docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable --now docker
  elif ! docker info >/dev/null 2>&1; then
    systemctl start docker
  fi
  docker info >/dev/null 2>&1 || die 'Docker не отвечает. Проверьте systemctl status docker.'
  if ! docker compose version >/dev/null 2>&1; then
    log 'Устанавливаю плагин Docker Compose'
    docker_repository
    apt-get install -y --no-install-recommends docker-compose-plugin
  fi
  docker compose version >/dev/null || die 'Не удалось установить Docker Compose.'
}
is_installed() { [[ "$(cat)" == 'install ok installed' ]]; }
download_site() {
  log "Скачиваю сайт в $INSTALL_DIR"
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    local remote
    remote=$(git -C "$INSTALL_DIR" remote get-url origin)
    [[ "$remote" == "$ELAZAR_REPO" || "$remote" == https://github.com/EchoOfHONK/Elazar_Site ]] || die 'В каталоге другой Git-репозиторий.'
    [[ -z "$(git -C "$INSTALL_DIR" status --porcelain)" ]] || die "В $INSTALL_DIR есть изменения. Сохраните их перед обновлением; установщик ничего не стирает."
    [[ "$(git -C "$INSTALL_DIR" branch --show-current)" == main ]] || die 'Для автоматического обновления нужна ветка main.'
    git -C "$INSTALL_DIR" pull --ff-only origin main
  else
    if [[ -e "$INSTALL_DIR" && -n "$(ls -A "$INSTALL_DIR")" ]]; then
      die "Каталог $INSTALL_DIR уже занят. Укажите другой через --dir."
    fi
    mkdir -p "$(dirname "$INSTALL_DIR")"
    git clone --branch main "$ELAZAR_REPO" "$INSTALL_DIR"
  fi
  [[ -f "$INSTALL_DIR/Dockerfile" && -f "$INSTALL_DIR/deploy/npm-setup.py" ]] || die 'В скачанной версии нет файлов установки.'
}
ensure_credentials() {
  if [[ ! -f "$INSTALL_DIR/.env" ]]; then
    log 'Создаю отдельный пароль админки сайта'
    (umask 077; printf 'PORT=3000\nADMIN_LOGIN=elazar-admin\nADMIN_TOKEN=%s\n' "$(openssl rand -hex 32)" >"$INSTALL_DIR/.env")
  fi
  chmod 600 "$INSTALL_DIR/.env"
  python3 - "$INSTALL_DIR/.env" <<'PY'
import pathlib, re, sys
values = dict(re.findall(r'^\s*(\w+)\s*=\s*(.*?)\s*$', pathlib.Path(sys.argv[1]).read_text(), re.M))
for key in ('ADMIN_LOGIN', 'ADMIN_TOKEN'):
    value = values.get(key, '').strip('"\'')
    if not value or value.startswith('change-me'):
        sys.exit(f'Задайте {key} в .env; демонстрационные данные не используются.')
PY
}
read_deployment_settings() {
  local saved_domain saved_port
  if [[ -f "$INSTALL_DIR/.deploy.env" ]]; then
    saved_domain=$(sed -n 's/^ELAZAR_DOMAIN=//p' "$INSTALL_DIR/.deploy.env")
    saved_port=$(sed -n 's/^ELAZAR_PREVIEW_PORT=//p' "$INSTALL_DIR/.deploy.env")
    if [[ -z "$DOMAIN" && -n "$saved_domain" ]]; then DOMAIN=$saved_domain; fi
    if ((PREVIEW_PORT_EXPLICIT == 0)) && [[ "$saved_port" =~ ^[0-9]+$ ]] && ((saved_port >= 1024 && saved_port <= 65535)); then PREVIEW_PORT=$saved_port; fi
  fi
}
choose_npm() {
  local candidates=() cid image
  if [[ -z "$NPM_CONTAINER" ]]; then
    while read -r cid image; do
      case "$image" in
        *nginx-proxy-manager*) candidates+=("$cid") ;;
      esac
    done < <(docker ps -a --format '{{.Names}} {{.Image}}')
    if ((${#candidates[@]} == 1)); then NPM_CONTAINER=${candidates[0]}; fi
    if ((${#candidates[@]} > 1)); then
      printf 'Найдено несколько NPM: %s\n' "${candidates[*]}"
      NPM_CONTAINER=$(ask 'Введите имя нужного контейнера NPM: ')
      [[ -n "$NPM_CONTAINER" ]] || die 'Нужно выбрать один NPM.'
    fi
  fi
  if [[ -n "$NPM_CONTAINER" ]]; then
    docker inspect "$NPM_CONTAINER" >/dev/null || die "Контейнер $NPM_CONTAINER не найден."
    [[ "$(docker inspect -f '{{.State.Running}}' "$NPM_CONTAINER")" == true ]] || docker start "$NPM_CONTAINER" >/dev/null
    log "Использую существующий NPM: $NPM_CONTAINER"
    if [[ -z "$PROXY_NETWORK" ]]; then
      while read -r candidate; do
        [[ "$candidate" != bridge && "$candidate" != host && "$candidate" != none ]] || continue
        if [[ "$(docker network inspect -f '{{.Driver}} {{.Internal}}' "$candidate")" == 'bridge false' ]]; then
          PROXY_NETWORK=$candidate
          break
        fi
      done < <(docker inspect -f '{{range $name, $config := .NetworkSettings.Networks}}{{println $name}}{{end}}' "$NPM_CONTAINER")
    fi
    [[ -n "$PROXY_NETWORK" ]] || die 'У NPM нет обычной Docker-сети. Добавьте постоянную bridge-сеть в Compose NPM и повторите запуск с --network ИМЯ.'
    docker inspect "$NPM_CONTAINER" | python3 -c 'import json,sys; sys.exit(0 if sys.argv[1] in json.load(sys.stdin)[0]["NetworkSettings"]["Networks"] else 1)' "$PROXY_NETWORK" || die 'Выбранная сеть не подключена к NPM.'
    [[ "$(docker network inspect -f '{{.Driver}} {{.Internal}}' "$PROXY_NETWORK")" == 'bridge false' ]] || die 'Нужна обычная bridge-сеть с доступом в интернет.'
    if [[ -z "$DOMAIN" && -f "$INSTALL_DIR/npm/.env" && "$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$NPM_CONTAINER")" == elazar-npm ]]; then
      python3 "$INSTALL_DIR/deploy/npm-setup.py" bootstrap "$NPM_CONTAINER" "$INSTALL_DIR/npm/.env"
    fi
  else
    log 'NPM не найден — создаю новый'
    [[ -z "$(ss -H -ltn '( sport = :80 or sport = :443 or sport = :81 )')" ]] || die 'Порты 80, 443 или 81 заняты. Если NPM уже есть, укажите --npm-container ИМЯ.'
    PROXY_NETWORK=${PROXY_NETWORK:-proxy}
    if ! docker network inspect "$PROXY_NETWORK" >/dev/null 2>&1; then docker network create "$PROXY_NETWORK" >/dev/null; fi
    [[ "$(docker network inspect -f '{{.Driver}} {{.Internal}}' "$PROXY_NETWORK")" == 'bridge false' ]] || die 'Нужна обычная bridge-сеть с доступом в интернет.'
    if [[ ! -f "$INSTALL_DIR/npm/.env" ]]; then
      python3 "$INSTALL_DIR/deploy/npm-setup.py" init "$INSTALL_DIR/npm/.env"
    fi
    compose_npm up -d
    NPM_CONTAINER=$(compose_npm ps -q npm)
    python3 "$INSTALL_DIR/deploy/npm-setup.py" bootstrap "$NPM_CONTAINER" "$INSTALL_DIR/npm/.env"
  fi
  [[ "$PROXY_NETWORK" =~ ^[a-zA-Z0-9_.-]+$ ]] || die 'Имя Docker-сети содержит неподдерживаемые символы.'
}
compose_site() { docker compose --project-directory "$INSTALL_DIR" --env-file "$INSTALL_DIR/.deploy.env" -f "$INSTALL_DIR/compose.yaml" "$@"; }
compose_npm() { ELAZAR_PROXY_NETWORK="$PROXY_NETWORK" docker compose --project-directory "$INSTALL_DIR/npm" -f "$INSTALL_DIR/npm/compose.yaml" "$@"; }
write_deployment_settings() {
  (umask 077; printf 'ELAZAR_PROXY_NETWORK=%s\nELAZAR_PREVIEW_PORT=%s\nELAZAR_DOMAIN=%s\n' "$PROXY_NETWORK" "$PREVIEW_PORT" "$DOMAIN" >"$INSTALL_DIR/.deploy.env")
}
wait_for_site() {
  local cid state attempt
  cid=$(compose_site ps -q elazar-site)
  for ((attempt=0; attempt<90; attempt++)); do
    state=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$cid")
    if [[ "$state" == healthy ]]; then return; fi
    if [[ "$state" == unhealthy || "$state" == exited || "$state" == dead ]]; then break; fi
    sleep 2
  done
  compose_site logs --tail=50 elazar-site
  die 'Контейнер сайта не прошёл проверку. Исправьте ошибку и повторите запуск.'
}
print_result() {
  log 'Сайт запущен'
  printf 'Каталог: %s\n' "$INSTALL_DIR"
  if ((DOMAIN_READY)); then
    printf 'Сайт: https://%s\nАдминка: https://%s/admin.html\n' "$DOMAIN" "$DOMAIN"
  fi
  printf 'Локальная проверка: http://127.0.0.1:%s\n' "$PREVIEW_PORT"
  printf 'Для просмотра с компьютера: ssh -N -L 3300:127.0.0.1:%s USER@SERVER_IP\nЗатем откройте http://127.0.0.1:3300\n' "$PREVIEW_PORT"
  python3 "$INSTALL_DIR/deploy/npm-setup.py" show "$INSTALL_DIR/.env" "$INSTALL_DIR/npm/.env"
  printf '\nОбновление: sudo bash %q/install.sh\nКонтент и пароли сохраняются.\n' "$INSTALL_DIR"
}
main() {
  parse_args "$@"
  check_system
  trap 'printf "\nУстановка остановлена на строке %s. Исправьте причину и повторите запуск.\n" "$LINENO" >&2' ERR
  install_dependencies
  install_docker
  download_site
  ensure_credentials
  read_deployment_settings
  if [[ -z "$DOMAIN" ]]; then DOMAIN=$(ask 'Домен сайта (например sketchbookelazar.ru; Enter — настроить позже): '); fi
  if [[ -n "$DOMAIN" ]]; then
    DOMAIN=$(python3 "$INSTALL_DIR/deploy/npm-setup.py" domain "$DOMAIN")
  fi
  choose_npm
  write_deployment_settings
  log 'Собираю и запускаю контейнер сайта'
  compose_site config --quiet
  compose_site build --pull
  compose_site up -d
  wait_for_site
  if [[ -n "$DOMAIN" ]]; then
    if python3 "$INSTALL_DIR/deploy/npm-setup.py" configure "$NPM_CONTAINER" "$DOMAIN" "$INSTALL_DIR/npm/.env"; then
      DOMAIN_READY=1
    else
      printf '\nСайт работает. Настройка домена/HTTPS не завершена; после исправления повторите установщик.\n' >&2
    fi
  else
    printf '\nВ NPM для домена укажите: http → elazar-site → 3000.\n'
  fi
  print_result
}
if [[ ${ELAZAR_INSTALLER_LIBRARY:-0} != 1 ]]; then main "$@"; fi
