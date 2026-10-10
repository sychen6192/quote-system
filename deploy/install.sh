#!/bin/sh
# Quote System installer and upgrader (POSIX sh).
#
# Recommended: download, read, then run.
#   curl -fsSLO https://github.com/sychen6192/quote-system/releases/latest/download/install.sh
#   less install.sh
#   sh install.sh
#
# Re-running it upgrades to the newest release and never touches your data or .env
# secrets. Options (environment variables):
#   QUOTE_DIR=/opt/quote-system   install directory (default: ~/quote-system)
#   QUOTE_VERSION=1.2.3           install or switch to a specific release
#   APP_PASSWORD=...              sign-in password for a new install (default: random;
#                                 APP_PASSWORD= with an empty value turns sign-in off)
#   APP_PORT=8080                 host port for a new install (default: 3000)
#   QUOTE_BASE_URL=...            download the bundle from elsewhere (mirror, file://)
#   QUOTE_SKIP_PULL=1             use images already present locally (offline, testing)
set -eu

REPO="sychen6192/quote-system"
BUNDLE="quote-system-deploy.tar.gz"

main() {
  requested_version="${QUOTE_VERSION:-}"
  version="${requested_version:-latest}"
  version="${version#v}"
  dir="${QUOTE_DIR:-$HOME/quote-system}"
  if [ "$version" = latest ]; then
    base="https://github.com/$REPO/releases/latest/download"
  else
    base="https://github.com/$REPO/releases/download/v$version"
  fi
  base="${QUOTE_BASE_URL:-$base}"

  check_requirements

  mkdir -p "$dir"
  cd "$dir"
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  trap 'exit 130' INT TERM

  say "Downloading the Quote System bundle ($version)"
  fetch "$base/$BUNDLE" "$tmp/$BUNDLE"
  fetch "$base/SHA256SUMS" "$tmp/SHA256SUMS"
  expected=$(awk -v f="$BUNDLE" '$2 == f || $2 == "*" f { print $1 }' "$tmp/SHA256SUMS")
  actual=$(sha256 "$tmp/$BUNDLE")
  [ -n "$expected" ] || die "SHA256SUMS has no entry for $BUNDLE; aborting."
  [ "$expected" = "$actual" ] || die "Checksum mismatch for $BUNDLE; the download is corrupt or was tampered with. Aborting."

  mkdir -p "$tmp/bundle"
  tar -xzf "$tmp/$BUNDLE" -C "$tmp/bundle"
  for f in docker-compose.yml Caddyfile .env.example; do
    [ -f "$tmp/bundle/$f" ] || die "The bundle is missing $f; aborting."
  done
  for f in docker-compose.yml Caddyfile; do
    if [ -f "$f" ] && ! cmp -s "$f" "$tmp/bundle/$f"; then
      cp -p "$f" "$f.bak"
      say "Saved your previous $f as $f.bak (put local changes in docker-compose.override.yml)"
    fi
    cp "$tmp/bundle/$f" "$f"
  done
  cp "$tmp/bundle/.env.example" .env.example
  mkdir -p branding backups

  bundle_version=$(env_value QUOTE_VERSION .env.example)
  password_note=
  fresh_install=
  if [ ! -f .env ]; then
    # The database volume keeps the password it was created with; a fresh .env
    # would lock the app out of it.
    if docker volume inspect quote-system_postgres_data >/dev/null 2>&1; then
      die "Found an existing Quote System database (volume quote-system_postgres_data) but no .env in $dir. Put your previous .env back there (coming from version 0.x: see \"Upgrading from 0.x\" in CHANGELOG.md), or delete the old data with: docker volume rm quote-system_postgres_data"
    fi
    create_env "${requested_version:+$version}"
  else
    say "Keeping your existing $dir/.env"
    # Re-running the installer upgrades: follow the bundle's release unless a
    # version was asked for explicitly.
    target="${requested_version:+$version}"
    target="${target:-$bundle_version}"
    current=$(env_value QUOTE_VERSION .env)
    if [ -n "$target" ] && [ "$target" != "$current" ]; then
      set_env QUOTE_VERSION "$target" .env
      say "QUOTE_VERSION: ${current:-unset} -> $target"
    fi
  fi

  # Compose prefers the shell's variables to .env: drop the installer's own
  # inputs so this run uses exactly what .env says (QUOTE_VERSION=v1.2.3 would
  # otherwise ask for a "v1.2.3" image tag, APP_PORT would differ from .env).
  unset QUOTE_VERSION APP_PORT APP_PASSWORD

  if [ "${QUOTE_SKIP_PULL:-}" = 1 ]; then
    say "Skipping image download (QUOTE_SKIP_PULL=1)"
  else
    say "Downloading images (this can take a few minutes the first time)"
    docker compose pull --quiet || die "Could not download the images. Check your internet connection and QUOTE_VERSION."
  fi
  say "Starting Quote System"
  wait_flags="--wait"
  if docker compose up --help 2>/dev/null | grep -q -- "--wait-timeout"; then
    wait_flags="--wait --wait-timeout 240"
  fi
  # shellcheck disable=SC2086 # $wait_flags is a list of flags
  docker compose up -d --remove-orphans $wait_flags \
    || die "Quote System did not become healthy. See: cd $dir && docker compose logs app db"

  print_summary
}

check_requirements() {
  command -v docker >/dev/null 2>&1 \
    || die "Docker is required: https://docs.docker.com/engine/install/ (Docker Desktop on Windows/macOS)."
  docker compose version >/dev/null 2>&1 \
    || die "Docker Compose v2 is required (the 'docker compose' command): https://docs.docker.com/compose/install/"
  compose_version=$(docker compose version --short 2>/dev/null | sed 's/^v//')
  if ! version_at_least "$compose_version" 2 17; then
    die "Docker Compose ${compose_version:-?} is too old; version 2.17 or newer is required."
  fi
  docker info >/dev/null 2>&1 \
    || die "Cannot talk to Docker. Is it running, and may this user use it (sudo, or the docker group)?"
  command -v curl >/dev/null 2>&1 || command -v wget >/dev/null 2>&1 \
    || die "curl or wget is required."
  command -v tar >/dev/null 2>&1 || die "tar is required."
}

create_env() {
  pinned_version=$1
  if [ -n "${APP_PASSWORD+set}" ]; then
    app_password=$APP_PASSWORD
    case $app_password in
      *[!A-Za-z0-9._~!@%^*+=:,-]*)
        die "APP_PASSWORD may only contain letters, digits and . _ ~ ! @ % ^ * + = : , -" ;;
    esac
  else
    app_password=$(friendly_password)
  fi
  port="${APP_PORT:-3000}"
  case $port in ''|*[!0-9]*) die "APP_PORT must be a number." ;; esac

  old_umask=$(umask)
  umask 077
  cp .env.example .env
  umask "$old_umask"
  set_env POSTGRES_PASSWORD "$(random_string 32)" .env
  set_env AUTH_SECRET "$(random_string 48)" .env
  set_env APP_PASSWORD "$app_password" .env
  set_env APP_PORT "$port" .env
  [ -z "$pinned_version" ] || set_env QUOTE_VERSION "$pinned_version" .env
  say "Created $dir/.env (readable only by you) with random secrets"
  fresh_install=1
  if [ -n "$app_password" ]; then
    password_note=$app_password
  fi
}

print_summary() {
  port=$(env_value APP_PORT .env)
  port=${port:-3000}
  bind=$(env_value APP_BIND .env)
  if [ "$bind" = 127.0.0.1 ]; then
    host=localhost
  else
    host=$(hostname -I 2>/dev/null | awk '{ print $1 }' || true)
    host=${host:-localhost}
  fi
  version=$(env_value QUOTE_VERSION .env)
  # Running services, not COMPOSE_PROFILES: `--profile https up -d` also counts.
  running=",$(docker compose ps --services --status running 2>/dev/null | tr '\n' ','),"

  printf '\n'
  say "Quote System ${version:-latest} is running: http://$host:$port"
  case $running in
    *,caddy,*)
      https_port=$(env_value HTTPS_PORT .env)
      case ${https_port:-443} in 443) https_port= ;; *) https_port=":$https_port" ;; esac
      site=$(env_value SITE_ADDRESS .env)
      say "HTTPS: https://${site:-localhost}$https_port" ;;
  esac
  if [ -n "$password_note" ]; then
    printf '\n  Sign-in password: \033[1m%s\033[0m\n' "$password_note"
    printf '  Shown only now. It is also stored in %s/.env (APP_PASSWORD).\n' "$dir"
  elif [ -z "$(env_value APP_PASSWORD .env)" ]; then
    warn "Sign-in is off (APP_PASSWORD is empty): anyone who can reach port $port can use the app."
  fi

  # Only the steps that are still open, so an upgrade does not repeat them.
  steps=
  n=0
  if [ -n "$fresh_install" ]; then
    n=$((n + 1))
    steps="$steps  $n. Open the address above and fill in your company details on the Settings page.
"
  fi
  case $running in
    *,caddy,*) ;;
    *)
      n=$((n + 1))
      steps="$steps  $n. To install the app on phones and computers, serve it over HTTPS: set
     SITE_ADDRESS (and APP_BIND=127.0.0.1) in .env, then: docker compose --profile https up -d
     Guide: https://github.com/$REPO/blob/main/docs/deploy/https.md
" ;;
  esac
  case $running in
    *,backup,*) ;;
    *)
      n=$((n + 1))
      steps="$steps  $n. Turn on daily backups: docker compose --profile backup up -d
     Guide: https://github.com/$REPO/blob/main/docs/deploy/backup.md
" ;;
  esac
  if [ -n "$steps" ]; then
    printf '\n  Next steps, in %s:\n%s' "$dir" "$steps"
  fi
  printf '\n  Upgrade later by running this installer again, or:\n    cd %s && docker compose pull && docker compose up -d\n' "$dir"
}

# KEY=value lines only; prints the value of the last match.
env_value() {
  awk -v key="$1" 'index($0, key "=") == 1 { value = substr($0, length(key) + 2) } END { print value }' "$2"
}

# Replaces (or appends) KEY=value without passing the value through sed or a
# shell pattern, so any character is safe.
set_env() {
  (
    umask 077
    KEY="$1" VALUE="$2" awk '
      BEGIN { key = ENVIRON["KEY"]; value = ENVIRON["VALUE"] }
      index($0, key "=") == 1 { print key "=" value; done = 1; next }
      { print }
      END { if (!done) print key "=" value }
    ' "$3" > "$3.tmp"
  )
  cat "$3.tmp" > "$3"
  rm -f "$3.tmp"
}

fetch() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --retry 3 -o "$2" "$1" || die "Download failed: $1"
  else
    wget -q -O "$2" "$1" || die "Download failed: $1"
  fi
}

sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{ print $1 }'
  elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{ print $1 }'
  else
    openssl dgst -sha256 "$1" | awk '{ print $NF }'
  fi
}

# Letters and digits only: the database password is embedded in a URL.
random_string() {
  LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$1"
}

# 4 groups of 4 from 31 unambiguous characters (about 79 bits), easy to type on a phone.
friendly_password() {
  raw=$(LC_ALL=C tr -dc 'abcdefghjkmnpqrstuvwxyz23456789' < /dev/urandom | head -c 16)
  printf '%s-%s-%s-%s' "$(echo "$raw" | cut -c1-4)" "$(echo "$raw" | cut -c5-8)" \
    "$(echo "$raw" | cut -c9-12)" "$(echo "$raw" | cut -c13-16)"
}

# version_at_least 2.20.1 2 17 -> true when the version is 2.17 or newer.
version_at_least() {
  major=$(echo "$1" | cut -d. -f1)
  minor=$(echo "$1" | cut -d. -f2)
  case $major$minor in ''|*[!0-9]*) return 1 ;; esac
  [ "$major" -gt "$2" ] || { [ "$major" -eq "$2" ] && [ "$minor" -ge "$3" ]; }
}

say() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWarning:\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31mError:\033[0m %s\n' "$*" >&2; exit 1; }

# Everything runs from here, so a partially downloaded script does nothing.
main "$@"
