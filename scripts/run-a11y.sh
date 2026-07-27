#!/bin/bash
# Runs pa11y against every URL in a11y-urls.txt, writes one combined JSON array to $1
set -u
OUT="$1"
export PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
echo "[" > "$OUT"
first=1
while IFS= read -r url; do
  [ -z "$url" ] && continue
  result=$(node_modules/.bin/pa11y "$url" --reporter json --timeout 30000 2>/dev/null)
  if [ -z "$result" ]; then result="[]"; fi
  if [ $first -eq 0 ]; then echo "," >> "$OUT"; fi
  first=0
  printf '{"url":"%s","issues":%s}\n' "$url" "$result" >> "$OUT"
done < scripts/a11y-urls.txt
echo "]" >> "$OUT"
