#!/bin/sh
# fills the passwords into icecast's config and starts it. icecast.xml can't read
# env vars itself, so the template gets copied to /tmp with them swapped in.
set -eu

TEMPLATE=/etc/icecast2/icecast.xml.template
CONFIG=/tmp/icecast.xml

# hex only so the sed below can't be broken by a / or & in a password
require_hex() {
    name="$1"
    value="$2"
    if [ -z "$value" ]; then
        echo "dj-stream: $name is empty. set it in pi/services/dj-stream/.env (openssl rand -hex 16) and restart." >&2
        exit 1
    fi
    case "$value" in
        *[!0-9a-fA-F]*)
            echo "dj-stream: $name has characters other than hex. regenerate it with openssl rand -hex 16." >&2
            exit 1
            ;;
    esac
}

require_hex ICECAST_SOURCE_PASSWORD "${ICECAST_SOURCE_PASSWORD:-}"
require_hex ICECAST_ADMIN_PASSWORD "${ICECAST_ADMIN_PASSWORD:-}"

sed \
    -e "s/__SOURCE_PASSWORD__/${ICECAST_SOURCE_PASSWORD}/" \
    -e "s/__ADMIN_PASSWORD__/${ICECAST_ADMIN_PASSWORD}/" \
    "$TEMPLATE" > "$CONFIG"

exec icecast2 -c "$CONFIG"
