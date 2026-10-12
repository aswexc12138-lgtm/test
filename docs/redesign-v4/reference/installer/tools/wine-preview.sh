#!/bin/bash
# usage: shoot-installer.sh <installer.exe> <outprefix>
set -u
EXE="$1"; OUT="$2"
export WINEDEBUG=-all DISPLAY=:77
Xvfb :77 -screen 0 1100x760x24 >/dev/null 2>&1 &
XPID=$!
sleep 1.5
xsetroot -solid "#3a3f44" 2>/dev/null || true
openbox >/dev/null 2>&1 &
sleep 1
LC_ALL=C.UTF-8 LANG=zh_CN.UTF-8 wine "$EXE" >/dev/null 2>&1 &
WPID=$!
w=""; for i in $(seq 1 40); do w=$(xdotool search --onlyvisible --name ".+" 2>/dev/null | tail -1); [ -n "$w" ] && break; sleep 0.5; done
sleep 2
grab() { import -window root "$OUT-$1.png" 2>/dev/null; echo "shot $1 (win=$w)"; }
grab 1-welcome
xdotool windowactivate --sync "$w" 2>/dev/null; sleep 0.3; xdotool key Return; sleep 0.3; grab 2-progress
sleep 6; grab 3-finish
xdotool windowactivate --sync "$w" 2>/dev/null; sleep 0.3; xdotool key Return; sleep 1.5
kill $WPID 2>/dev/null; wineserver -k 2>/dev/null; kill $XPID 2>/dev/null
