#!/usr/bin/env bash
# Fails if tracked files or the commits about to be pushed look private. Run before pushing (or install as pre-push hook).
# Add your own private strings (names, hostnames, IPs), one regex per line, to local/private-patterns.txt (gitignored).
set -u
cd "$(git rev-parse --show-toplevel)"
bad=0
if git ls-files | grep -E '(^|/)\.env($|\.)|\.(db|sqlite3?|key|pem|gpx|fit|xlsx|csv)$|^(media|exports|local)/' | grep -v '^\.env\.example$' | grep -v '^data/lists/'; then
  echo "ERROR: private-looking files are tracked (listed above)"; bad=1
fi
pat='192\.168\.[0-9]+\.[0-9]+|10\.[0-9]+\.[0-9]+\.[0-9]+|BEGIN [A-Z ]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}|(secret|token|api_?key|password)[A-Za-z_]*\s*[:=]\s*["'"'"'][A-Za-z0-9+/_-]{16,}["'"'"']'
[ -f local/private-patterns.txt ] && pat="$pat|$(grep -v '^#' local/private-patterns.txt | paste -sd'|' -)"
if git grep -InE "$pat" -- . ':!pnpm-lock.yaml' ':!scripts/check-public-safe.sh' ':!docs/import-sources.md' ':!data/lists' | head -20 | grep .; then
  echo "ERROR: possible private data in tracked files (listed above)"; bad=1
fi
[ $bad = 0 ] && echo "public-safe check passed"
exit $bad
