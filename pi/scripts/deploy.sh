#!/usr/bin/env bash
# Pulls the latest main and redeploys whichever pi/services/* changed.
#
# Run on fart-pi from anywhere -- it finds the repo root itself:
#   pi/scripts/deploy.sh                              # redeploy everything the pull touched
#   pi/scripts/deploy.sh website-backend mallard-counter  # redeploy just these, regardless of the diff
#
# Docker services (anything with a docker-compose.yml) get rebuilt and
# restarted. Venv+systemd services (mallard-counter, trash-reminder) get
# their deps reinstalled and the unit restarted. Anything else -- like
# pac-tyler-updater, which is run by hand, not as a service -- is skipped
# with a warning so it's never restarted by accident.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SERVICES_DIR="$REPO_ROOT/pi/services"

cd "$REPO_ROOT"

if [[ -n "$(git status --porcelain)" ]]; then
    echo "error: repo has local changes -- commit or stash them before deploying" >&2
    git status --short
    exit 1
fi

echo "pulling latest..."
before_commit="$(git rev-parse HEAD)"
git pull origin main
after_commit="$(git rev-parse HEAD)"

if [[ "$before_commit" == "$after_commit" ]]; then
    echo "already up to date."
fi

if [[ $# -gt 0 ]]; then
    services=("$@")
else
    # service dirs are pi/services/<name>/... -- awk grabs the <name> segment
    mapfile -t services < <(
        git diff --name-only "$before_commit" "$after_commit" -- pi/services \
            | awk -F/ '{print $3}' | sort -u
    )
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
    fi
done

echo "done."
