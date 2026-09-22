#!/bin/bash
# Anton — Linux CLI installer.
#
#   curl -fsSL https://saadhu-xyz.github.io/install-linux.sh | bash
#
# Flags are passed straight through to the installer inside the tarball:
#
#   curl -fsSL https://saadhu-xyz.github.io/install-linux.sh | bash -s -- --no-startup
#
# ---------------------------------------------------------------------------
# What it does NOT do
#
# It does not install anything itself. It reads the published manifest, fetches
# the tarball for this machine, checks it against the SHA256 the manifest
# names, unpacks it, and runs the `install-anton.sh` that ships inside.
#
# That delegation is the whole design, and it is the same one the macOS
# installer uses. The install steps — laying down the binaries, the Claude Code
# plugin, the systemd user units, enabling lingering, starting the services,
# printing the pairing QR — live in exactly one place, inside the release,
# versioned with the build they install. A copy here would be a second place to
# fix every time they change, and would install a v2 tarball the way v1 used to
# want.
#
# Unlike macOS there is no Gatekeeper story here: nothing is signed, quarantined
# or blocked on Linux. This exists for the ordinary reason — one line is easier
# than "download, verify, untar, read the README, run the installer".
#
# Env overrides (for testing against a staging manifest):
#   ANTON_MANIFEST_URL   default https://saadhu-xyz.github.io/releases.json
# ---------------------------------------------------------------------------

# Everything lives in functions and nothing runs until the final line, so a
# connection that drops mid-pipe leaves a partial script that defines a few
# functions and exits — rather than one that half-installs.

set -euo pipefail

MANIFEST_URL="${ANTON_MANIFEST_URL:-https://saadhu-xyz.github.io/releases.json}"

WORK=""

die()  { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[1m==> %s\033[0m\n' "$*"; }
note() { printf '\033[2m    %s\033[0m\n' "$*"; }

cleanup() {
  [[ -n "$WORK" && -d "$WORK" ]] && rm -rf "$WORK" 2>/dev/null || true
}

require_linux() {
  [[ "$(uname -s)" == "Linux" ]] ||
    die "this installer is Linux-only. On a Mac, run:
    curl -fsSL ${MANIFEST_URL%/*}/install.sh | bash"

  # Root would create ~/.anton and ~/.claude owned by root, and the services
  # run as a normal user. Catching it here means the message arrives before
  # anything has been downloaded.
  [[ "${EUID:-$(id -u)}" -ne 0 ]] ||
    die "do not run this as root — Anton installs into your own \$HOME."

  local machine; machine="$(uname -m)"
  [[ "$machine" == "x86_64" ]] ||
    die "unsupported architecture: $machine (only x86-64 is published)"

  local missing=()
  for tool in curl tar sha256sum; do
    command -v "$tool" >/dev/null 2>&1 || missing+=("$tool")
  done
  [[ "${#missing[@]}" -eq 0 ]] ||
    die "missing required tool(s): ${missing[*]}"
}

# Read one field out of the manifest. macOS has plutil; Linux has no JSON parser
# it can count on, so this tries the good options and keeps a pure-shell
# fallback for a minimal box with neither. The fallback flattens the document
# and matches within one artifact's braces, which holds because the manifest's
# artifact objects are flat — every field we read is a string.
#
# An absent key is an empty answer, never a failure: under `set -e`,
# `url="$(manifest_field ...)"` returning non-zero would kill the script
# silently instead of reaching the "no build published yet" message below.
# grep exits 1 when it matches nothing, so the fallback pipeline needs saying
# so explicitly.
manifest_field() {
  local file="$1" key="$2" field="$3"

  if command -v jq >/dev/null 2>&1; then
    jq -r --arg k "$key" --arg f "$field" '.artifacts[$k][$f] // empty' "$file" 2>/dev/null || true
    return 0
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 -c 'import json,sys
d=json.load(open(sys.argv[1]))
print(d.get("artifacts",{}).get(sys.argv[2],{}).get(sys.argv[3],"") or "")' \
      "$file" "$key" "$field" 2>/dev/null || true
    return 0
  fi

  { tr -d ' \n\t' < "$file" \
    | grep -o "\"$key\":{[^}]*}" \
    | grep -o "\"$field\":\"[^\"]*\"" \
    | head -1 \
    | sed 's/.*:"//; s/"$//'; } || true
  return 0
}

main() {
  trap cleanup EXIT
  require_linux

  local key="linux-x86"
  WORK="$(mktemp -d "${TMPDIR:-/tmp}/anton-install.XXXXXX")"

  info "Reading the release manifest"
  curl -fsSL "$MANIFEST_URL" -o "$WORK/releases.json" ||
    die "could not fetch the release manifest at $MANIFEST_URL"

  local url sha version
  url="$(manifest_field "$WORK/releases.json" "$key" url)"
  sha="$(manifest_field "$WORK/releases.json" "$key" sha256)"
  version="$(manifest_field "$WORK/releases.json" "$key" version)"
  [[ -n "$url" ]] || die "the manifest publishes no build for $key yet."
  note "$key · ${version:-unknown version}"

  info "Downloading ${url##*/}"
  curl -fL --progress-bar "$url" -o "$WORK/anton.tar.gz" ||
    die "download failed: $url"

  # Nothing about this download is signed, so the checksum is the only
  # integrity check standing between the release and your $HOME. A mismatch is
  # fatal rather than a warning.
  if [[ -n "$sha" ]]; then
    info "Verifying checksum"
    local got
    got="$(sha256sum "$WORK/anton.tar.gz" | awk '{print $1}')"
    [[ "$got" == "$sha" ]] || die "checksum mismatch — refusing to install.
    expected $sha
    got      $got"
    note "sha256 ok"
  else
    note "the manifest publishes no sha256 for $key — skipping verification"
  fi

  info "Unpacking"
  tar -xzf "$WORK/anton.tar.gz" -C "$WORK" ||
    die "could not unpack the tarball"

  local installer
  installer="$(find "$WORK" -maxdepth 2 -name install-anton.sh -type f | head -1)"
  [[ -n "$installer" ]] ||
    die "this tarball carries no install-anton.sh.
    Unpack it yourself and follow its README:
    $url"

  # stdin is redirected because this script is usually itself being read from a
  # pipe: a child that read stdin would eat the bytes of the script still to
  # come. The installer asks its one question on /dev/tty precisely so that
  # closing stdin here does not cost it the ability to ask.
  info "Running the bundled installer"
  bash "$installer" "$@" </dev/null
}

main "$@"
