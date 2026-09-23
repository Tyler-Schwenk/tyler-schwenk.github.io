#!/usr/bin/env bash
# Pulls the latest main and redeploys whichever pi/services/* changed since
# they were last deployed by this script.
#
# Run on fart-pi from anywhere -- it finds the repo root itself:
#   pi/scripts/deploy.sh                              # redeploy everything that changed since its last deploy
#   pi/scripts/deploy.sh website-backend mallard-counter  # redeploy just these, regardless of what changed
#
# Tracks per-service state in .deploy-state/<service> (gitignored -- holds
# the commit SHA it was last deployed at), so it's correct even if you
# `git pull` by hand before running this. Diffing "before vs. after this
# script's own pull" would miss changes that already landed that way.
#
# Docker services (anything with a docker-compose.yml) get rebuilt and
# restarted. Venv+systemd services (mallard-counter, trash-reminder) get
# their deps reinstalled and the unit restarted. Anything else -- like
# pac-tyler-updater, which is run by hand, not as a service -- is skipped
# with a warning so it's never restarted by accident, and its marker is
# never written, so it keeps showing as pending until it's handled some
# other way.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVICES_DIR="$REPO_ROOT/pi/services"
STATE_DIR="$SCRIPT_DIR/.deploy-state"

cd "$REPO_ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
    echo "error: repo has local changes -- commit or stash them before deploying" >&2
    git status --short
    exit 1
fi

echo "pulling latest..."
git pull origin main

mkdir -p "$STATE_DIR"
head_commit="$(git rev-parse HEAD)"

# a service counts as changed if it has no marker yet (never deployed by
# this script) or if anything under its directory differs since its marker
# commit.
service_changed() {
    local service="$1"
    local marker="$STATE_DIR/$service"

    if [[ ! -f "$marker" ]]; then
        return 0
    fi

    local last_deployed
    last_deployed="$(cat "$marker")"
    [[ -n "$(git diff --name-only "$last_deployed" "$head_commit" -- "pi/services/$service")" ]]
}

if [[ $# -gt 0 ]]; then
    services=("$@")
else
    services=()
    for dir in "$SERVICES_DIR"/*/; do
        name="$(basename "$dir")"
        if service_changed "$name"; then
            services+=("$name")
        fi
    done
fi

if [[ ${#services[@]} -eq 0 ]]; then
    echo "no service changes to deploy."
    exit 0
fi

echo "deploying: ${services[*]}"

for service in "${services[@]}"; do
    service_dir="$SERVICES_DIR/$service"

    if [[ ! -d "$service_dir" ]]; then
        echo "warning: skipping unknown service '$service'" >&2
        continue
    fi

    echo "--- $service ---"

    if [[ -f "$service_dir/docker-compose.yml" ]]; then
        (cd "$service_dir" && docker compose up -d --build)
    elif [[ -x "$service_dir/.venv/bin/pip" ]]; then
        "$service_dir/.venv/bin/pip" install --quiet -r "$service_dir/requirements.txt"
        sudo systemctl restart "$service.service"
    else
        echo "warning: don't know how to deploy '$service' -- no docker-compose.yml or .venv found, skipping" >&2
        continue
    fi

    echo "$head_commit" > "$STATE_DIR/$service"
done

echo "done."
