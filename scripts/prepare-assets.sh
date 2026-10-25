#!/usr/bin/env bash
# CLAIM! — Prepare the static assets for the Worker.
#
# The site files live at the repository root (they have always been there:
# index.html, job-board.html, assets/, logos/…). The Worker needs them in
# `public/`. Rather than keeping two copies — which drift the moment one
# is edited — this script copies the root into `public/` before each
# deployment.
#
# The only file that is NOT copied is `public/404.html`: the error page
# belongs to the Workers configuration, not to the site. Cloudflare's
# `not_found_handling: "404-page"` looks for the nearest `404.html`.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== copie des fichiers du site =="
# Tout ce qui est a la racine, sauf ce qui ne doit pas etre publie.
for element in *.html assets logos; do
  [ -e "$element" ] || continue
  rm -rf "public/$element"
  cp -r "$element" "public/$element"
done

echo "== controle =="
count=$(find public -type f | wc -l)
echo "  $count fichiers dans public/"
for must in public/index.html public/job-board.html public/assets/theme.css public/404.html; do
  if [ ! -f "$must" ]; then
    echo "  MANQUANT : $must" >&2
    exit 1
  fi
done
echo "  fichiers essentiels presents"
