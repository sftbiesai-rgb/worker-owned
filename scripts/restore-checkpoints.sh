#!/bin/bash
# Restore scrape checkpoints from checkpoints/ to /tmp/
# Run this if checkpoints were lost (e.g. after reboot)

DIR="$(cd "$(dirname "$0")/.." && pwd)/checkpoints"

if [ ! -d "$DIR" ]; then
  echo "No checkpoints directory found"
  exit 1
fi

count=0
for f in "$DIR"/*.json; do
  base=$(basename "$f")
  dest="/tmp/$base"
  if [ ! -f "$dest" ]; then
    cp "$f" "$dest"
    echo "Restored $base"
    count=$((count + 1))
  else
    echo "Skipped $base (already exists in /tmp)"
  fi
done

# Map special names
if [ -f "$DIR/scheels-categories-checkpoint.json" ] && [ ! -f "/tmp/scheels-categories-checkpoint.json" ]; then
  cp "$DIR/scheels-categories-checkpoint.json" "/tmp/scheels-categories-checkpoint.json"
  echo "Restored scheels-categories-checkpoint.json"
fi

echo "Done: $count checkpoints restored"
