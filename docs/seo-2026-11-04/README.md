## Contrôle Google du 4 novembre 2026

32 inspections sur 16 slugs appariés (6 anciennes dates, 6 récentes, 4 sans date ; 12 sources distinctes). Résultats bruts non secrets joints.

- `.com/fr` : 16 « Google ne reconnaît pas cette URL ».
- `.fr` : 5 « Envoyée et indexée », 5 « Détectée, actuellement non indexée », 6 inconnues.
- Accueil `.com/fr/` indexé, canonique Google identique ; dernier crawl 2 novembre 2026 21:37:17Z.
- Board `.com/fr/job-board.html` inconnu.
- API au relevé : **374 offres**, 175 dates source absentes (les 352/153 précédentes ne sont plus le relevé courant).
- Le compte de service est propriétaire `.com`, fullUser `.fr`.
- Indexing v3 metadata : HTTP 404 NOT_FOUND, aucune notification existante pour l'URL interrogée. Cela ne prouve pas une capacité d'écriture ni un quota disponible ; pas d'erreur SERVICE_DISABLED dans cette réponse.

Les inspections concernent l'état mémorisé par Google, pas un test live de la migration. Aucune pénalité n'est démontrée ; les 292 anciennes URL non indexées ne sont pas un diagnostic actuel. Descriptions identiques ne signifient pas automatiquement faible qualité.

## Changements

- Aucune expiration publiée par l'API : suppression de publication + 90 jours.
- Date de publication uniquement si date source réelle et valide. Aucune substitution par date de collecte. L'absence de datePosted affecte l'éligibilité JobPosting rich results, pas directement l'indexation web.
- directApply false : candidature via site recruteur externe.
- Titres du board : liens href crawlables, clic ordinaire intercepté pour garder split view ; clic modifié/nouvel onglet natif.
- `/fr/offres.html` : annuaire lisible sans JS, 20 offres/page, navigation précédente/suivante ; canonique propre à chaque page. Lien visible depuis accueil et board. Aucun JobPosting sur la liste. Aucune carte supplémentaire dans le premier écran du board.
- Filtres conservés dans le board existant ; annuaire refuse les filtres et pages invalides, ne fabrique pas de pages indexables filtrées.

## Indexing API : utilisation prudente

`python tools/indexing-notify.py URL [URL ...] --state /chemin/persistant/notifications.jsonl` : dry-run par défaut, 1–5 URL explicitement choisies.

`--publish` nécessite un jeton temporaire `GOOGLE_INDEXING_ACCESS_TOKEN`, scope indexing, du propriétaire vérifié. Aucun JSON de compte de service au dépôt. Vérifie URL 200 non redirigée, canonique, absence noindex, JobPosting unique, date réelle confrontée à l'API, statut active, titre, lieu précis, absence expiration passée, directApply non trompeur. Arrête le lot au premier refus droits/quota. Journal fsync, verrou exclusif, empreinte du balisage évitant une republication inchangée. **Conserver le journal hors sandbox éphémère.** Une interruption après acceptation distante mais avant journal local laisse une fenêtre d'incertitude : vérifier metadata avant reprise, pas de garantie exactly-once réseau.

Une notification acceptée n'est jamais une indexation. L'outil ne modifie ni IAM ni Cloudflare, ni les dates, ni les données backend.

Documentation Google :
- https://developers.google.com/search/docs/appearance/structured-data/job-posting
- https://developers.google.com/search/apis/indexing-api/v3/using-api
- https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading
