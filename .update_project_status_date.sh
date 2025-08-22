#!/bin/bash

STATUS_FILE="PROJECT_STATUS.md"
DATE_LINE=$(grep -n 'Current State' "$STATUS_FILE" | cut -d: -f1)
if [ -z "$DATE_LINE" ]; then
  echo "Could not find 'Current State' section in $STATUS_FILE."
  exit 1
fi

NEW_DATE="## Current State (as of $(date '+%Y-%m-%d %H:%M:%S'))"
sed -i '' "${DATE_LINE}s/.*/$NEW_DATE/" "$STATUS_FILE" 