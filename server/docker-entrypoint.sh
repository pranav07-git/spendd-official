#!/bin/sh
set -e
# Disks mounted at run time (Render, a VM bind mount) can be owned by root. Hand the data folder to
# the unprivileged node user, then run the server as that user.
if [ "$(id -u)" = 0 ]; then
  mkdir -p "$DATA_DIR"
  chown -R node:node "$DATA_DIR"
  exec setpriv --reuid=node --regid=node --init-groups "$@"
fi
exec "$@"
