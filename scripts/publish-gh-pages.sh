#!/usr/bin/env bash
# Push dist/ to origin/gh-pages (static files at branch root).
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

npm run build
test -f dist/.nojekyll
test -f dist/index.html

remote="$(git remote get-url origin)"
work="$(mktemp -d)"
cleanup() { rm -rf "$work"; }
trap cleanup EXIT

git init "$work"
cp -a "$root/dist/." "$work/"
cd "$work"
git checkout -b gh-pages
git add -A
git -c user.email="pages@micseed.local" -c user.name="micseed pages" commit -m "pages: micseed dist"
git push -f "$remote" HEAD:gh-pages
