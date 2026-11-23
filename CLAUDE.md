# claim-frontend — consignes pour l'agent

Site de Claim! (offres d'emploi en actuariat, data et IA en assurance) : HTML/CSS/JS sans build, servi
par un Worker Cloudflare (`src/index.js`). Réponds en français, simplement. Le propriétaire n'est pas développeur.

## Repères (vérifiés le 23/11/2026)
- Pages à la racine (`index.html`, `job-board.html`…), `assets/`, `logos/`. `public/` est **généré** par
  `scripts/prepare-assets.sh` : ne l'édite pas. Le Worker rend `/offre/{slug}`, `/sitemap.xml`, `/robots.txt` (voir `README.md`).
- Tests : `node tools/run-tests.cjs --famille=statique|navigateur|production` ou `--fichier=tests/x.test.cjs`.
  Les tests navigateur utilisent Playwright (Chromium).
- La CI (`.github/workflows/deploy.yml`, sur `main`) enchaîne : contrôles statiques → tests navigateur en 4 morceaux →
  déploiement Cloudflare. Les jobs « Contrôles de production » et « Rendu visuel (indicatif) » ne bloquent pas le
  déploiement ; le rendu visuel échoue tant que `captures/reference/*.png` n'est pas régénéré.
- Les polices de la CI sont un peu plus larges que celles de l'environnement de l'agent : une mesure de largeur
  faite en local n'est pas une preuve. Mesure en CI (branche de diagnostic jetable) quand cela compte.

## Avant toute fusion
- **Toute fusion dans `main` déploie en production** (claimyourjob.fr et claimyourjob.com). Fusionne seulement
  avec l'accord explicite du propriétaire, après une suite verte, et vérifie le site en ligne ensuite.
- Les PR se créent avec `gh api repos/GiwArsenio/claim-frontend/pulls --input fichier.json` (GraphQL est refusé).
  Fusion : `gh api -X PUT repos/GiwArsenio/claim-frontend/pulls/N/merge -f merge_method=merge`.
- Ne régénère jamais `captures/reference/*.png`. Ne fusionne jamais les branches `design/T10-captures`,
  `design/T12-captures`, `design/T13-captures` (pièces jointes de PR).
- La suppression de branches à distance est refusée par l'environnement (erreur 403) : ne la contourne pas ;
  donne au propriétaire les liens à supprimer dans GitHub.

## Règles de vérité
Elles existent parce que des erreurs réelles ont eu lieu : « n'existe pas » dit sans chercher, un
audit ancien présenté comme actuel, une cause attribuée de mémoire, des réserves perdues au résumé.
1. Avant de dire qu'une chose n'existe pas : cherche (Grep/Glob/Read, plusieurs noms possibles) et écris
   le périmètre : « Pas trouvé dans assets/ et index.html avec grep card-fact ».
2. Un fait tiré d'un audit, d'une note ou d'un résumé porte sa date et sa source. Sinon, relis l'état réel
   (fichier, CI, site en ligne) avant de l'affirmer.
3. Pour attribuer un correctif à un PR ou à une cause, cite la commande git ou gh lancée dans cette session.
4. Quand tu reprends une de tes phrases, recopie ses réserves telles quelles.
5. « Non vérifié » est une réponse autorisée et attendue.
6. Quand le propriétaire corrige un fait, ne défends pas la version précédente : relis la source.

## Dispositif automatique (mode avertissement)
`.claude/settings.json` branche un rappel de ces règles à chaque message et un contrôle de fin de réponse
qui **avertit sans jamais bloquer** (absence sans recherche, PR ou commit jamais vu dans une sortie d'outil,
horaire sans lecture de la planification). C'est la même mécanique que dans `claim-api`, qui est la référence :
voir `claim-api/docs/GARDE_FOUS_REPONSES.md`. Un avertissement n'est pas une preuve d'erreur : vérifie.
