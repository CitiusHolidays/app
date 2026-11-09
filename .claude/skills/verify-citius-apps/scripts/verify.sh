#!/usr/bin/env bash
# Drive Citius Connect or the Citius customer app on an iOS Simulator for verification.
# Usage: verify.sh <doctor|launch|shot|link|paste-login|cleanup> <connect|customer> [arg]
# Everything this script starts is recorded in $STATE and stopped by `cleanup`. Evidence goes to
# $OUT and is never deleted by this script.
set -euo pipefail

cmd=${1:-}; app=${2:-}; arg=${3:-}
case "$app" in
  connect)  bundle=com.citiusholidays.connect; port=8082; scheme=citiusconnect ;;
  customer) bundle=com.citiusholidays.app;     port=8081; scheme=citius ;;
  *) echo "usage: verify.sh <doctor|launch|shot|link|paste-login|cleanup> <connect|customer> [arg]" >&2; exit 2 ;;
esac

repo=$(git -C "$(dirname "$0")" rev-parse --show-toplevel)
appdir="$repo/apps/$app"
sim=${CITIUS_IOS_SIM:-}
STATE=${CITIUS_VERIFY_STATE:-${TMPDIR:-/tmp}/citius-verify-state}/$app
OUT=${CITIUS_VERIFY_OUT:-${TMPDIR:-/tmp}/citius-verify-evidence}
mkdir -p "$STATE" "$OUT"

need_sim() {
  if [ -z "$sim" ]; then
    echo "Set CITIUS_IOS_SIM to the UDID of the simulator that has the $app dev build installed." >&2
    echo "List them with: xcrun simctl list devices available" >&2
    exit 2
  fi
}

env_url() { grep -E "^$1=" "$appdir/.env.local" 2>/dev/null | cut -d= -f2-; }

metro_root() {
  # The project root the Metro on $port is serving, or empty when nothing listens there.
  local pid; pid=$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null | head -1)
  [ -n "$pid" ] && lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p'
}

case "$cmd" in
doctor)
  need_sim
  ok=1
  client=$(env_url EXPO_PUBLIC_CONVEX_URL); site=$(env_url EXPO_PUBLIC_CONVEX_SITE_URL)
  if [ -z "$client" ]; then echo "FAIL  $appdir/.env.local is missing EXPO_PUBLIC_CONVEX_URL"; ok=0
  else
    echo "INFO  backend $client"
    case "$client" in *127.0.0.1*|*localhost*) ;; *) echo "WARN  backend is not local: only read, never create or delete data";; esac
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 4 "$site/api/auth/ok" || true)
    [ "$code" = 200 ] && echo "OK    auth $site answers" || { echo "FAIL  auth $site answered '$code'"; ok=0; }
  fi
  state=$(xcrun simctl list devices | grep "$sim" | sed -E 's/.*\((Booted|Shutdown)\).*/\1/')
  echo "INFO  simulator $sim is ${state:-unknown}"
  if [ "$state" = Booted ]; then
    xcrun simctl get_app_container "$sim" "$bundle" >/dev/null 2>&1 \
      && echo "OK    $bundle installed" || { echo "FAIL  $bundle not installed: build with 'bunx expo run:ios --device $sim' in $appdir"; ok=0; }
  fi
  root=$(metro_root || true)
  if [ -z "$root" ]; then echo "INFO  nothing on port $port yet (launch starts Metro)"
  elif [ "$root" = "$appdir" ]; then echo "OK    Metro on $port serves $appdir"
  else echo "FAIL  port $port is held by Metro for $root; another session may own it. Do not kill it."; ok=0; fi
  [ $ok = 1 ] && echo "READY" || { echo "NOT READY"; exit 1; }
  ;;
launch)
  need_sim
  root=$(metro_root || true)
  if [ -n "$root" ] && [ "$root" != "$appdir" ]; then echo "Port $port belongs to $root; stopping." >&2; exit 1; fi
  if ! xcrun simctl list devices | grep "$sim" | grep -q Booted; then
    xcrun simctl boot "$sim"; echo "$sim" > "$STATE/booted-sim"
  fi
  open -b com.apple.iphonesimulator --args -CurrentDeviceUDID "$sim" 2>/dev/null || true  # optional: the window
  if [ -z "$root" ]; then
    # No watchman on some machines: --clear stops Metro from serving a stale bundle.
    (cd "$appdir" && CI=1 EXPO_NO_TELEMETRY=1 nohup bunx expo start --dev-client --port "$port" --clear \
      > "$OUT/metro-$app.log" 2>&1 & echo $! > "$STATE/metro.pid")
    until curl -s --max-time 2 "http://127.0.0.1:$port/status" | grep -q running; do sleep 1; done
  fi
  xcrun simctl spawn "$sim" defaults write "$bundle" RCT_jsLocation "127.0.0.1:$port"
  xcrun simctl terminate "$sim" "$bundle" 2>/dev/null || true
  # The app bundle is the line naming the entry file; lazy chunks ("(1 module)") come later.
  count() { grep -cE "Bundled.*(index|entry)|Bundling failed" "$OUT/metro-$app.log" 2>/dev/null || true; }
  before=$(count); before=${before:-0}
  xcrun simctl launch "$sim" "$bundle" >/dev/null
  for _ in $(seq 1 180); do
    now=$(count); now=${now:-0}
    [ "$now" -gt "$before" ] && break; sleep 1
  done
  last=$(grep -E "Bundled.*(index|entry)|Bundling failed" "$OUT/metro-$app.log" 2>/dev/null | tail -1 || true)
  echo "${last:-no bundle line yet: check $OUT/metro-$app.log}"
  case "$last" in *failed*) exit 1;; esac
  ;;
shot)
  need_sim
  name=${arg:?shot needs a name}
  xcrun simctl io "$sim" screenshot "$OUT/$app-$name.png" >/dev/null 2>&1
  echo "$OUT/$app-$name.png"
  ;;
link)
  need_sim
  url=${arg:?link needs a URL such as $scheme://...}
  xcrun simctl openurl "$sim" "$url"
  ;;
paste-login)
  # Puts the test account's email or password on the simulator pasteboard without printing it.
  need_sim
  file=${CITIUS_VERIFY_LOGIN_FILE:?Set CITIUS_VERIFY_LOGIN_FILE to a local file with email= and password= lines}
  field=${arg:?paste-login needs email or password}
  grep -E "^$field=" "$file" | head -1 | cut -d= -f2- | tr -d '\n' | xcrun simctl pbcopy "$sim"
  echo "$field is on the simulator pasteboard"
  ;;
cleanup)
  [ -n "$sim" ] && xcrun simctl terminate "$sim" "$bundle" 2>/dev/null || true
  [ -n "$sim" ] && printf '' | xcrun simctl pbcopy "$sim" 2>/dev/null || true
  if [ -f "$STATE/metro.pid" ]; then
    pid=$(cat "$STATE/metro.pid")
    pkill -P "$pid" 2>/dev/null || true; kill "$pid" 2>/dev/null || true
    sleep 1
    # Expo forks node under bunx; stop the listener too, but only when it serves this app (ours).
    if [ "$(metro_root || true)" = "$appdir" ]; then kill "$(lsof -nP -tiTCP:"$port" -sTCP:LISTEN | head -1)" 2>/dev/null || true; fi
    rm -f "$STATE/metro.pid"
  fi
  if [ -f "$STATE/booted-sim" ]; then xcrun simctl shutdown "$(cat "$STATE/booted-sim")" 2>/dev/null || true; rm -f "$STATE/booted-sim"; fi
  echo "cleaned up; evidence kept in $OUT"
  ;;
*) echo "unknown command: $cmd" >&2; exit 2 ;;
esac
