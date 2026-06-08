#!/usr/bin/env bash
set -Eeuo pipefail

host="127.0.0.1"
port="8080"
python_command="${PYTHON:-python3}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd -- "$script_dir/.." && pwd)"
serve_dir="$repo_root"

usage() {
  cat <<'EOF'
Usage: scripts/serve-kiosk.sh [options]

Serve RetailOps Kiosk over HTTP for local development or a small local station.

Options:
  --host <host>             Bind host. Default: 127.0.0.1.
  --port <port>             Bind port. Default: 8080.
  --dir <path>              Directory to serve. Default: repository root.
  --python-command <cmd>    Python command. Default: $PYTHON or python3.
  -h, --help                Show this help.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --host) host="${2:?Missing value for --host}"; shift 2 ;;
    --port) port="${2:?Missing value for --port}"; shift 2 ;;
    --dir) serve_dir="${2:?Missing value for --dir}"; shift 2 ;;
    --python-command) python_command="${2:?Missing value for --python-command}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

if ! command -v "$python_command" >/dev/null 2>&1; then
  echo "Python command not found: $python_command" >&2
  exit 1
fi

echo "Serving RetailOps Kiosk from: $serve_dir"
echo "Open: http://$host:$port/"
exec "$python_command" -m http.server "$port" --bind "$host" --directory "$serve_dir"
