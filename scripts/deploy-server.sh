#!/usr/bin/env bash
set -Eeuo pipefail

# Run on the production server from the repository checkout.
# Secrets and server/data are intentionally outside Git.
repo_dir="${MOONSPRITE_DIR:-/opt/moonsprite-website}"
service_name="${MOONSPRITE_SERVICE:-moonsprite}"

cd "$repo_dir"
git fetch origin main
git checkout main
git reset --hard origin/main
pnpm install --frozen-lockfile
VITE_API_BASE_URL=/api VITE_FEATURES=open pnpm build
# The editor is a separate repository. Build its browser trial into the
# same-origin /try/ directory expected by the website navigation.
trial_dir="$(mktemp -d)"
trap 'rm -rf "$trial_dir"' EXIT
git clone --depth 1 https://github.com/MoonPixelTeam/moonsprite.git "$trial_dir/editor"
cd "$trial_dir/editor"
pnpm install --frozen-lockfile
pnpm build:web-trial
cd "$repo_dir"
rm -rf dist/try
cp -R "$trial_dir/editor/out/web-trial" dist/try
test -s dist/try/index.html
sudo systemctl restart "$service_name"
sudo systemctl --no-pager --full status "$service_name"
curl --fail --silent --show-error --head http://127.0.0.1:3001/ >/dev/null
echo "MoonSprite deployed from $(git rev-parse --short HEAD)"
