#!/bin/sh
# Fix ownership of the data volume, then drop root. PUID/PGID default to Unraid's nobody:users (99:100).
# If the container is started with a non-root --user, just run the app as that user.
set -e
if [ "$(id -u)" = "0" ]; then
  PUID="${PUID:-99}"; PGID="${PGID:-100}"
  mkdir -p "$DATA_DIR"
  if [ -n "$(find "$DATA_DIR" \( ! -user "$PUID" -o ! -group "$PGID" \) -print -quit)" ]; then
    chown -R "$PUID:$PGID" "$DATA_DIR"
  fi
  export HOME="$DATA_DIR"
  exec setpriv --reuid="$PUID" --regid="$PGID" --clear-groups "$@"
fi
exec "$@"
