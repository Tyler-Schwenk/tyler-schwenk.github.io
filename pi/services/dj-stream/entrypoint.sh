#!/bin/sh
# fills the passwords and guest dj mounts into icecast's config and starts it. icecast.xml
# can't read env vars itself, so the template gets copied to /tmp with them swapped in.
set -eu

TEMPLATE=/etc/icecast2/icecast.xml.template
CONFIG=/tmp/icecast.xml
GUEST_MOUNTS_XML=/tmp/guest-mounts.xml
# tyler's own mount, which runs on the global source password. a guest can't take it
HOST_MOUNT=live

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

# mount names go into the config and urls, so lowercase letters, digits and dashes only
require_mount_name() {
    mount="$1"
    case "$mount" in
        "" | *[!a-z0-9-]*)
            echo "dj-stream: guest mount '$mount' in ICECAST_GUEST_MOUNTS can only have lowercase letters, digits and dashes. fix it in pi/services/dj-stream/.env." >&2
            exit 1
            ;;
    esac
    if [ "$mount" = "$HOST_MOUNT" ]; then
        echo "dj-stream: '$HOST_MOUNT' is tyler's mount, a guest can't have it. pick another name in ICECAST_GUEST_MOUNTS." >&2
        exit 1
    fi
}

# one <mount> per "name:password" in ICECAST_GUEST_MOUNTS (space separated, may be empty)
write_guest_mounts() {
    : > "$GUEST_MOUNTS_XML"
    for entry in ${ICECAST_GUEST_MOUNTS:-}; do
        mount="${entry%%:*}"
        password="${entry#*:}"
        if [ "$mount" = "$entry" ]; then
            echo "dj-stream: '$entry' in ICECAST_GUEST_MOUNTS needs to be mount:password, like tracepoint:<openssl rand -hex 16>." >&2
            exit 1
        fi
        require_mount_name "$mount"
        require_hex "the password for guest mount $mount" "$password"
        cat >> "$GUEST_MOUNTS_XML" <<EOF
    <mount type="normal">
        <mount-name>/$mount</mount-name>
        <username>source</username>
        <password>$password</password>
    </mount>
EOF
        echo "dj-stream: guest mount /$mount is set up"
    done
}

require_hex ICECAST_SOURCE_PASSWORD "${ICECAST_SOURCE_PASSWORD:-}"
require_hex ICECAST_ADMIN_PASSWORD "${ICECAST_ADMIN_PASSWORD:-}"
write_guest_mounts

# the r command reads the mounts file in after the placeholder line, then d drops the placeholder
sed \
    -e "s/__SOURCE_PASSWORD__/${ICECAST_SOURCE_PASSWORD}/" \
    -e "s/__ADMIN_PASSWORD__/${ICECAST_ADMIN_PASSWORD}/" \
    -e "/__GUEST_MOUNTS__/{
r $GUEST_MOUNTS_XML
d
}" \
    "$TEMPLATE" > "$CONFIG"

exec icecast2 -c "$CONFIG"
