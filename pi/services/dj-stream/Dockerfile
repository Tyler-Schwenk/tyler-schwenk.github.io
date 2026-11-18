# icecast for the live dj stream. debian's package rather than a third party image
# so it's a known build for the pi's arm64 and nothing else rides along
FROM debian:bookworm-slim

RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends icecast2 \
    && rm -rf /var/lib/apt/lists/*

COPY icecast.xml.template /etc/icecast2/icecast.xml.template
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# icecast won't run as root, and debian's package already made this user
USER icecast2

EXPOSE 8000

ENTRYPOINT ["/entrypoint.sh"]
