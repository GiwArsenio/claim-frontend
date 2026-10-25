#!/usr/bin/env bash
# CLAIM! — Deploiement du frontend sur Cloudflare Workers.
#
# Prerequis : un compte Cloudflare dont les serveurs de noms gouvernent
# claimyourjob.fr, et le token d'authentification dans l'environnement :
#   export CLOUDFLARE_API_TOKEN=...
#
# Le deploiement ne touche pas au DNS : la bascule du domaine se fait a la
# main, apres verification, pour qu'aucune erreur ne coupe le site en
# production.
set -euo pipefail

echo "== preparation des fichiers statiques =="
bash scripts/prepare-assets.sh

echo
echo "== verification de la configuration =="
npx wrangler deploy --dry-run --outdir=./_dist

echo
echo "== deploiement =="
npx wrangler deploy

echo
echo "== verification du deploiement =="
npx wrangler deployments list | head -5
echo
echo "Le site est deploye sur workers.dev."
echo "Pour brancher claimyourjob.fr :"
echo "  1. dans le tableau de bord Cloudflare, Workers > claim-frontend > Settings"
echo "     > Custom Domains > claimyourjob.fr"
echo "  2. attendre la propagation, puis controler les trois adresses rendues :"
echo "     curl -sI https://claimyourjob.fr/offre/<un-slug-du-sitemap>"
echo "     curl -s  https://claimyourjob.fr/sitemap.xml | grep -c '<loc>'"
echo "     curl -sI https://claimyourjob.fr/job-board.html   # 200 attendu, pas 307"
