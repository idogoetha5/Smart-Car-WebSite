#!/bin/bash
# Runs pa11y against every URL in scripts/a11y-urls.txt and writes a combined
# JSON report to $1.
#
# The previous version turned `result=""` into `[]`, so a browser that failed
# to launch was recorded as a page with zero accessibility issues. That is how
# the evidence bundle claimed a clean pass while the DOM still had unlabelled
# fields — and pa11y exits 0 on a launch failure, so the exit code could not be
# trusted either. Both are handled here:
#
#   - stderr is captured, not discarded
#   - a page that could not be scanned is recorded as NOT_TESTED, never as 0
#   - the script exits non-zero if any page failed OR any error was found
#
# A run that cannot scan is a failed run. It must never read as a pass.
set -uo pipefail

OUT="${1:?usage: run-a11y.sh <output.json>}"
URLS="scripts/a11y-urls.txt"
STAMP="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
ERR_LOG="${OUT%.json}.stderr.log"

# Deliberately not pinning PUPPETEER_EXECUTABLE_PATH to /Applications: pa11y's
# bundled puppeteer expects a specific Chrome build, and pointing it at
# whatever Chrome the machine happens to have is what produced the dlopen
# failure this script used to swallow. Let puppeteer resolve its own binary;
# install it with `npx puppeteer browsers install chrome@<version>`.

: > "$ERR_LOG"
scanned=0; failed=0; total_errors=0
echo "{" > "$OUT"
printf '  "generatedAt": "%s",\n  "pages": [\n' "$STAMP" >> "$OUT"

first=1
while IFS= read -r url; do
  [ -z "$url" ] && continue
  case "$url" in \#*) continue ;; esac

  result="$(node_modules/.bin/pa11y "$url" --reporter json --timeout 45000 --standard WCAG2AA 2>>"$ERR_LOG")"

  [ $first -eq 0 ] && printf ',\n' >> "$OUT"
  first=0

  if [ -z "$result" ] || ! printf '%s' "$result" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{try{JSON.parse(s);process.exit(0)}catch{process.exit(1)}})'; then
    # Could not scan. NOT a clean page.
    failed=$((failed + 1))
    printf '    {"url": %s, "status": "NOT_TESTED", "errorCount": null}' \
      "$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$url")" >> "$OUT"
    echo "NOT_TESTED  $url" >&2
  else
    scanned=$((scanned + 1))
    n="$(printf '%s' "$result" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const a=JSON.parse(s);process.stdout.write(String(a.filter(i=>i.type==="error").length))})')"
    total_errors=$((total_errors + n))
    printf '    {"url": %s, "status": "SCANNED", "errorCount": %s, "issues": %s}' \
      "$(node -e 'process.stdout.write(JSON.stringify(process.argv[1]))' "$url")" "$n" "$result" >> "$OUT"
    echo "SCANNED     $url  errors=$n" >&2
  fi
done < "$URLS"

printf '\n  ],\n' >> "$OUT"
printf '  "summary": {"scanned": %d, "notTested": %d, "totalErrors": %d}\n}\n' \
  "$scanned" "$failed" "$total_errors" >> "$OUT"

echo "----"
echo "scanned=$scanned  notTested=$failed  totalErrors=$total_errors"
echo "report:  $OUT"
echo "stderr:  $ERR_LOG"

if [ "$failed" -gt 0 ]; then
  echo "FAIL: $failed page(s) could not be scanned — this is not a pass." >&2
  exit 2
fi
if [ "$total_errors" -gt 0 ]; then
  echo "FAIL: $total_errors accessibility error(s)." >&2
  exit 1
fi
echo "PASS: all $scanned page(s) scanned, no errors."
