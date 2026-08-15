#!/usr/bin/env bash
# Serve the Anton downloads site on port 3000 (per project convention).
# Usage: ./serve.sh
set -euo pipefail
cd "$(dirname "$0")"
PORT="${PORT:-3000}"
echo "Anton site → http://localhost:${PORT}"
# Bind dual-stack (::) so the site is reachable over BOTH the Tailscale IPv4
# (100.x) and IPv6 (fd7a:…) addresses. python's default 0.0.0.0 is IPv4-only,
# which makes MagicDNS names fail for IPv6-preferring peers. Linux bindv6only=0
# means "::" accepts IPv4-mapped connections too.
if command -v python3 >/dev/null 2>&1; then
  exec python3 -m http.server "$PORT" --bind ::
elif command -v npx >/dev/null 2>&1; then
  exec npx --yes serve -l "tcp://[::]:$PORT" .
else
  echo "Need python3 or npx to serve." >&2
  exit 1
fi
