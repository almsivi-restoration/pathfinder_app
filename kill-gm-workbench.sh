#!/usr/bin/env bash
# Full-stop for every Game Master's Workbench process: packaged AppImage (+ its
# mounted binary and frozen backend), dev Electron, dev CRA server, dev backend,
# and the OCR subprocess venv. Every pattern is scoped to this project — never a
# bare "electron"/"python" match, which would also catch VS Code and unrelated
# tools on this machine.
#
# Usage: ./kill-gm-workbench.sh
set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KILLED_ANY=0

# term_pattern <label> <pgrep -f pattern>
term_pattern() {
    local label="$1" pattern="$2"
    local pids
    pids="$(pgrep -f "$pattern" 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
        echo "stopping $label (pid(s): $(tr '\n' ' ' <<<"$pids"))"
        # shellcheck disable=SC2086
        kill -TERM $pids 2>/dev/null || true
        KILLED_ANY=1
    fi
}

# kill_port <port> <expected substring in /proc/<pid>/cmdline>
kill_port() {
    local port="$1" expect="$2"
    local pids
    pids="$(lsof -ti "tcp:${port}" 2>/dev/null || true)"
    for pid in $pids; do
        local cmdline
        cmdline="$(tr '\0' ' ' < "/proc/${pid}/cmdline" 2>/dev/null || true)"
        if [[ "$cmdline" == *"$expect"* ]]; then
            echo "stopping port :$port holder (pid $pid: $cmdline)"
            kill -TERM "$pid" 2>/dev/null || true
            KILLED_ANY=1
        elif [[ -n "$cmdline" ]]; then
            echo "WARNING: port :$port is held by an unrelated process (pid $pid: $cmdline) — left alone"
        fi
    done
}

echo "== stopping Game Master's Workbench processes =="

# Packaged AppImage (launcher) and its extracted mount (main process + frozen backend)
term_pattern "packaged AppImage"        "Game-Masters-Workbench-.*\.AppImage"
term_pattern "packaged mounted binary"  "/tmp/\.mount_Game-"

# Dev Electron (npm start's "electron-start"), scoped to this repo's own copy
term_pattern "dev Electron"             "${REPO_ROOT}/frontend/node_modules/.*electron"

# Dev backend (backend/venv/bin/python main.py), scoped to this repo's own venv
term_pattern "dev backend"              "${REPO_ROOT}/backend/venv/bin/python.*main\.py"

# OCR subprocess venv (ocr_runner.py is a project-specific script name, safe to match generically)
term_pattern "OCR subprocess"           "ocr_runner\.py"

# Port fallbacks, in case something above didn't match by process pattern
kill_port 8000 "main.py"
kill_port 8000 "gm-workbench-backend"
kill_port 3000 "react-scripts"

if [[ "$KILLED_ANY" -eq 0 ]]; then
    echo "nothing found running."
    exit 0
fi

sleep 1

echo "== SIGKILL sweep for stragglers =="
for pattern in \
    "Game-Masters-Workbench-.*\.AppImage" \
    "/tmp/\.mount_Game-" \
    "${REPO_ROOT}/frontend/node_modules/.*electron" \
    "${REPO_ROOT}/backend/venv/bin/python.*main\.py" \
    "ocr_runner\.py"
do
    pids="$(pgrep -f "$pattern" 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
        echo "SIGKILL: $(tr '\n' ' ' <<<"$pids")"
        # shellcheck disable=SC2086
        kill -KILL $pids 2>/dev/null || true
    fi
done

echo "== done =="
