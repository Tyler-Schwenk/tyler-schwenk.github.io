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
# One service failing (bad compose file, missing .env, whatever) does not
# stop the others -- each is deployed independently and its marker is only
# written on success, so a failed service just keeps showing up as pending
# next run instead of blocking every service alphabetically after it.
#
# Docker services (anything with a docker-compose.yml) get rebuilt and
# restarted. Venv+systemd services (mallard-counter, trash-reminder) get
# their deps reinstalled and the unit restarted. Anything else -- like
# pac-tyler-updater, which is run by hand, not as a service -- is skipped
# with a warning so it's never restarted by accident, and its marker is
# never written, so it keeps showing as pending until it's handled some
# other way.
#
# On the very first run (no .deploy-state/ yet) with no services named,
# nothing is actually deployed -- it just records every existing service's
# current commit as its baseline. Without this, "no marker yet" would look
# like every service changed, and a first run would blindly run `docker
# compose up` / restart against services nobody asked to touch, including
# ones that were never fully set up. Name services explicitly to deploy on
# that first run anyway.
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

first_run=false
if [[ ! -d "$STATE_DIR" ]]; then
    first_run=true
fi

echo "pulling latest..."
git pull origin main

mkdir -p "$STATE_DIR"
head_commit="$(git rev-parse HEAD)"

if [[ "$first_run" == true && $# -eq 0 ]]; then
    echo "first run -- recording a baseline for every service without deploying anything."
    echo "name a service explicitly if you want it deployed right now."
    for dir in "$SERVICES_DIR"/*/; do
        echo "$head_commit" > "$STATE_DIR/$(basename "$dir")"
    done
    exit 0
fi

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

failed_services=()

for service in "${services[@]}"; do
    service_dir="$SERVICES_DIR/$service"

    if [[ ! -d "$service_dir" ]]; then
        echo "warning: skipping unknown service '$service'" >&2
        continue
    fi

    echo "--- $service ---"

    if [[ -f "$service_dir/docker-compose.yml" ]]; then
        if ! (cd "$service_dir" && docker compose up -d --build); then
            echo "error: $service failed to deploy -- marker left untouched" >&2
            failed_services+=("$service")
            continue
        fi
    elif [[ -x "$service_dir/.venv/bin/pip" ]]; then
        if ! "$service_dir/.venv/bin/pip" install --quiet -r "$service_dir/requirements.txt"; then
            echo "error: $service failed to deploy (pip install) -- marker left untouched" >&2
            failed_services+=("$service")
            continue
        fi
        if ! sudo systemctl restart "$service.service"; then
            echo "error: $service failed to deploy (systemctl restart) -- marker left untouched" >&2
            failed_services+=("$service")
            continue
        fi
    else
        echo "warning: don't know how to deploy '$service' -- no docker-compose.yml or .venv found, skipping" >&2
        continue
    fi

    echo "$head_commit" > "$STATE_DIR/$service"
done

if [[ ${#failed_services[@]} -gt 0 ]]; then
    echo "done, but these failed: ${failed_services[*]}" >&2
    exit 1
fi

echo "done."
