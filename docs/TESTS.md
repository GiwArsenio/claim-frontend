# Les tests du site : lesquels lancer ?

Document écrit le 26/11/2026 à partir de la lecture de `tools/run-tests.cjs`, `package.json`,
`.github/workflows/deploy.yml`, `.github/workflows/nuit.yml` et de `tests/`. Tout se lance depuis la racine du dépôt.

## 1. Les familles

Le lanceur `tools/run-tests.cjs` range chaque fichier `tests/*.test.cjs` dans une famille (`node tools/run-tests.cjs --liste`
les affiche). Chaque fichier tourne dans son propre processus. Un fichier rangé dans aucune famille fait échouer le lanceur.
Il y a 62 fichiers `*.test.cjs` : 26 + 33 + 1 + 2.

| Option | Fichiers | Ce que ça vérifie |
|---|---|---|
| `--famille=statique` | 26 | Le code et les fichiers du site, sans réseau et sans navigateur (cartes, texte, dates, consentement, jetons de design, hooks de l'agent…). |
| `--famille=navigateur` | 33 | Le site ouvert dans un vrai Chromium (Playwright) sur un serveur local : parcours, accessibilité, affichage selon la largeur, survol, thème. |
| `--famille=visuel` | 1 | Le rendu comparé au pixel aux images de `captures/reference/`. Jamais lancé par défaut. |
| `--famille=production` | 2 | Le site en ligne (SEO des offres, Google Analytics). Jamais lancé par défaut. |

Autres options : `--fichier=tests/x.test.cjs` (un seul fichier), `--liste` (affiche sans lancer),
`--shard=2/4` (le deuxième quart de la sélection, découpé par poids), `--delai=<ms>` (délai maximal par fichier ;
12 minutes par défaut), `--live` (voir « Pièges »).

Sans option (`npm test`) : toutes les familles sauf `visuel` et `production`, soit 26 + 33 = 59 fichiers.

Un fichier absent, vide ou sans code de sortie compte comme un échec, jamais comme une réussite.

## 2. Quelle famille lancer ?

| Ma tâche | Je lance |
|---|---|
| Retouche de texte ou de style, document | `--famille=statique` |
| Un test précis que je viens d'écrire ou de modifier | `--fichier=tests/x.test.cjs` |
| Changement de comportement dans le navigateur (clic, filtre, fiche, mise en page) | `statique` puis `--fichier=` sur les tests concernés, puis `--famille=navigateur` si le changement est large |
| Avant de demander une fusion | `statique` en local ; la CI rejoue `statique` et `navigateur` (voir 3). La suite complète seulement si on le demande. |
| Vérifier le site en ligne | `--famille=production` (parle au vrai site, ne bloque rien) |
| Comparer le rendu au pixel | `--famille=visuel` (voir « Pièges ») |

Les tests navigateur demandent Chromium (`npx playwright install chromium`).

## 3. Ce que fait la CI

`deploy.yml` (se déclenche à chaque push sur `main`, et à la main via `workflow_dispatch`) :

1. `statique` « Contrôles statiques » : `--famille=statique`, puis `npm run aligner:rendu:verifier`. C'est la porte : tout attend ce job.
2. `tests` « Navigateur 1/4 à 4/4 » (après `statique`) : `--famille=navigateur --shard=i/4`, quatre parties en parallèle. Aujourd'hui 8, 8, 8 et 9 fichiers (mesuré avec `--liste`). Largeurs d'écran : `LARGEURS: '360,768,1280'`.
3. `production` « Contrôles de production » (après `statique`) : `--famille=production`, `continue-on-error: true`, ne bloque pas.
4. `visuel` « Rendu visuel (indicatif) » (après `statique`) : `--famille=visuel`, `continue-on-error: true`, ne bloque pas.
5. `deploy` « Déployer sur Cloudflare » : attend seulement `statique` et `tests`. Il prépare les assets, déploie avec wrangler, puis vérifie le site en ligne et les redirections.

`nuit.yml` (tous les jours à 03:12 UTC, ou à la main) : un seul job « Suite complète » (délai 60 min) : `statique`, `navigateur` (sans découpage, avec les six largeurs 360, 390, 768, 769, 1280, 1920 car `LARGEURS` n'est pas défini), `visuel` et `production` (ces deux-là sans bloquer). Il ne publie rien et ouvre une issue GitHub « Suite de nuit rouge » si la nuit échoue.

## 4. Durées

- Famille `statique` : **environ 2 secondes** (bilan du lanceur : 2,0 s puis 1,8 s sur deux lancements, 26 fichiers sur 26 réussis ; 1,83 s mesurées au chronomètre), mesurée le 26/11/2026 dans la copie de travail de l'agent, après `npm ci`, avec ce document présent.
- Suite complète `npm test`, relevé du propriétaire du 26/11/2026 : 59 fichiers sur 59 réussis en 21 min 17 s (session de test sur l'environnement de développement) ; fichier le plus lent : `survol-a07-lisibilite`, environ 240 s.
- Source du lanceur : un fichier a 12 minutes au plus (`DELAI_DEFAUT`).

## 5. Pièges connus

- `deploy.yml` : le job `deploy` n'a pas de condition de branche (relu aujourd'hui : le seul `if:` du fichier est sur la dernière étape). Constat antérieur, non revérifié aujourd'hui : il ne faut jamais lancer un workflow à la main (`workflow_dispatch`).
- Constat antérieur, non revérifié aujourd'hui : le job « visuel » échoue par conception. Le code dit qu'une référence appartient à la machine qui l'a produite (`tests/captures-visuel.test.cjs`) ; ne pas le « corriger », ne pas régénérer `captures/reference/*.png` (`CLAUDE.md`).
- `npm run test:production` lance `--live`, qui exécute **les 62 fichiers**, y compris `visuel` et toute la famille navigateur, pas seulement `production`. Pour la production seule : `--famille=production`.
- Dans `tools/run-tests.cjs`, les listes déclarent 30 fichiers `statique` et 5 `production`, mais le lanceur ne découvre que les `*.test.cjs` : seuls 26 et 2 s'exécutent. Les autres (`aide-parcours.cjs`, `captures-reference.cjs`, `survol-a07-aide.cjs`, `audit-survol.cjs`, `verifier-production.cjs`, `verifier-reference-prod.cjs`, `verifier-chrome-prod.cjs`) ne sont pas lancés par `--famille`. Ne pas en conclure qu'ils sont testés. Comparer avec le compte de `--liste`.
- Les commentaires de `deploy.yml` sont en retard : « dix-huit fichiers » pour la porte statique et « 37 fichiers » pour l'ancienne chaîne ; la porte en exécute 26 aujourd'hui.
- Les poids de `POIDS` (secondes, « machine locale ») ne servent qu'à équilibrer les parties de la CI ; un fichier absent compte pour 15.
- Les mesures de largeur faites en local ne prouvent rien : les polices de la CI sont plus larges (`CLAUDE.md`).

## 6. Non vérifié

- La durée de `navigateur` et de la suite complète : seul le relevé du propriétaire ci-dessus existe, je ne l'ai pas rejoué.
- Les tests `navigateur`, `visuel` et `production` n'ont pas été lancés pour ce document.
- Le contenu de `npm run aligner:rendu:verifier` (script Python) n'a pas été lu ni lancé.
- Les durées en CI : non relevées. Seuls les réglages (délais, découpage) ont été lus.
- Si les jobs de CI passent réellement aujourd'hui : non observé.
