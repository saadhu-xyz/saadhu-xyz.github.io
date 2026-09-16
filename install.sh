#!/bin/bash
# Anton — macOS installer.
#
#   curl -fsSL https://saadhu-xyz.github.io/install.sh | bash
#
# ---------------------------------------------------------------------------
# Why this exists
#
# Anton is an unsigned personal build (no Apple Developer account). A browser
# stamps every download with com.apple.quarantine, and everything inside a
# quarantined DMG inherits that judgment — including "Install Anton.command",
# which is a shell script and therefore cannot be signed or notarized at all.
# Gatekeeper has nothing to check, so it refuses with "Apple could not verify
# 'Install Anton.command' is free of malware".
#
# That block is not new. What changed is the way out of it: macOS 15 removed
# the right-click -> Open bypass for unnotarized software, leaving only System
# Settings -> Privacy & Security -> Open Anyway, which nobody finds unaided.
# Notarizing would not help either — it would let Anton.app drag-install
# cleanly, but a shell script stays unsignable forever.
#
# The flag is set by whatever downloads the file. curl does not set it. So this
# script moves the download out of the browser, and the whole problem class
# disappears: nothing involved is ever marked as downloaded, and no dialog can
# appear.
#
# ---------------------------------------------------------------------------
# What it does NOT do
#
# It does not install anything itself. It fetches the DMG, checks it against
# the SHA256 in the published manifest, mounts it, and runs the
# "Install Anton.command" that ships inside — under `bash`, which Gatekeeper
# does not police, because its check happens in LaunchServices (double-click
# and `open`) rather than in the shell.
#
# That delegation is the point. The install steps — stopping the running
# bundle, copying to /Applications, clearing quarantine, ad-hoc signing,
# installing the Claude Code plugin — live in exactly one place, inside the
# DMG, versioned with the build they install. A copy here would be a second
# place to fix every time they change, and would silently install a v1.2.0 DMG
# the way v1.0.0 used to want.
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
MNT=""

die()  { printf '\033[31merror:\033[0m %s\n' "$*" >&2; exit 1; }
info() { printf '\033[1m==> %s\033[0m\n' "$*"; }
note() { printf '\033[2m    %s\033[0m\n' "$*"; }

# Order matters: the image has to be detached before the directory holding its
# mountpoint is removed, and -force covers the case where something is still
# holding the volume and the plain detach loses the race.
cleanup() {
  if [[ -n "$MNT" && -d "$MNT" ]]; then
    hdiutil detach "$MNT" -quiet 2>/dev/null ||
      hdiutil detach "$MNT" -force -quiet 2>/dev/null || true
  fi
  [[ -n "$WORK" && -d "$WORK" ]] && rm -rf "$WORK" 2>/dev/null || true
}

require_macos() {
  [[ "$(uname -s)" == "Darwin" ]] ||
    die "this installer is macOS-only. On Linux, grab the tarball from ${MANIFEST_URL%/*}/#download"
}

# The manifest names the Intel slice "macos-intel" while Apple Silicon is
# "macos-arm64" — an asymmetry inherited from the release manifest, mirrored
# here rather than corrected, so this file agrees with what is published.
#
# Under Rosetta `uname -m` reports x86_64 on an M-series Mac, which would fetch
# the Intel DMG and land the user in the menu bar app's "Wrong Anton DMG
# installed" warning. proc_translated is the only honest answer.
detect_arch_key() {
  local machine
  machine="$(uname -m)"
  if [[ "$machine" == "x86_64" && "$(sysctl -n sysctl.proc_translated 2>/dev/null || echo 0)" == "1" ]]; then
    machine="arm64"
  fi
  case "$machine" in
    arm64)  echo "macos-arm64" ;;
    x86_64) echo "macos-intel" ;;
    *)      die "unsupported architecture: $machine" ;;
  esac
}

# plutil reads JSON and ships with macOS, so the manifest is parsed with no jq,
# no python3, and no regex guessing at a format that is allowed to grow fields.
manifest_field() {
  local manifest="$1" key="$2" field="$3"
  plutil -extract "artifacts.$key.$field" raw -o - "$manifest" 2>/dev/null || true
}

main() {
  trap cleanup EXIT
  require_macos

  local key; key="$(detect_arch_key)"
  WORK="$(mktemp -d /tmp/anton-install.XXXXXX)"

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
  curl -fL --progress-bar "$url" -o "$WORK/Anton.dmg" ||
    die "download failed: $url"

  # An unsigned build cannot prove its origin through Gatekeeper, so the
  # checksum is the only integrity check standing between the release and
  # /Applications. A mismatch is fatal rather than a warning.
  if [[ -n "$sha" ]]; then
    info "Verifying checksum"
    local got
    got="$(shasum -a 256 "$WORK/Anton.dmg" | awk '{print $1}')"
    [[ "$got" == "$sha" ]] || die "checksum mismatch — refusing to install.
    expected $sha
    got      $got"
    note "sha256 ok"
  else
    note "the manifest publishes no sha256 for $key — skipping verification"
  fi

  info "Mounting the disk image"
  MNT="$WORK/mnt"
  mkdir -p "$MNT"
  hdiutil attach "$WORK/Anton.dmg" -nobrowse -readonly -quiet -mountpoint "$MNT" ||
    die "could not mount the disk image"

  # $WORK is removed by the EXIT trap, so this points at the download rather
  # than at the copy that is about to disappear.
  local installer="$MNT/Install Anton.command"
  [[ -f "$installer" ]] ||
    die "this DMG carries no 'Install Anton.command'.
    Download it yourself and drag Anton.app to /Applications by hand:
    $url"

  # stdin is redirected because this script is usually itself being read from a
  # pipe: a child that read stdin would eat the bytes of the script still to
  # come. It also keeps the installer's closing "press any key" from firing
  # against a pipe that has nothing to give it.
  info "Running the bundled installer"
  bash "$installer" </dev/null
}

main "$@"
