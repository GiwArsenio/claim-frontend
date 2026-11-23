---
name: fusionner-pr
description: Fusionne une PR de claim-frontend dans main (déploiement en production), puis vérifie la CI, le déploiement Cloudflare et le site en ligne. À lancer par le propriétaire : /fusionner-pr 136
disable-model-invocation: true
---

# Fusionner une PR de claim-frontend et vérifier le site en ligne

Numéro de la PR : `$0`. S'il manque, demande-le. **Lancer ce skill vaut accord du propriétaire pour cette PR
seulement** : n'en fusionne aucune autre. Réponds en français, simplement.

**Toute fusion dans `main` déploie en production** (claimyourjob.fr et claimyourjob.com).

## 1. Vérifier avant de fusionner

1. **État de la PR** :
   `gh api repos/GiwArsenio/claim-frontend/pulls/$0 --jq '[.state,.mergeable,.mergeable_state,.head.ref,.head.sha]|@tsv'`
   Attendu : `open`, `true`, `clean`. Sinon, arrête-toi et explique. **Refuse** les branches
   `design/T10-captures`, `design/T12-captures`, `design/T13-captures` (pièces jointes de PR, jamais fusionnées).
2. **Suite verte.** Ce dépôt n'a pas de CI sur les PR : la CI ne tourne qu'après la fusion. Avant de fusionner,
   la suite statique doit avoir été lancée sur le **dernier commit de la PR** : `node tools/run-tests.cjs --famille=statique`
   (« echecs : 0 »). Si tu ne l'as pas lancée sur ce commit dans cette session, lance-la, ou dis « non vérifié ».
   Si la PR touche l'affichage, des tests navigateur ou une mesure de largeur, une branche de diagnostic jetable
   en CI vaut mieux qu'une mesure locale (les polices de la CI sont plus larges).
3. **Ne régénère jamais** `captures/reference/*.png`.

## 2. Fusionner

`gh api -X PUT repos/GiwArsenio/claim-frontend/pulls/$0/merge -f merge_method=merge --jq '[.merged,.sha]|@tsv'`

Note le `sha` de fusion renvoyé.

## 3. Vérifier le déploiement et le site

- **Workflow « Deploy » du commit de fusion** (attends avec un Monitor, pas de `sleep`) :
  `gh api "repos/GiwArsenio/claim-frontend/actions/runs?head_sha=<sha>" --jq '.workflow_runs[]|[.id,.name,.status,.conclusion]|@tsv'`
  (d'autres workflows, comme « Nuit », peuvent figurer dans la liste : prends celui qui s'appelle « Deploy »),
  puis ses jobs : `gh api repos/GiwArsenio/claim-frontend/actions/runs/<id du run Deploy>/jobs --jq '.jobs[]|[.name,.conclusion]|@tsv'`.
  Attendu : contrôles statiques, 4 tests navigateur, contrôles de production et « Deployer sur Cloudflare » en
  `success`. Le job « Rendu visuel (indicatif) » échoue tant que `captures/reference/*.png` n'est pas régénéré :
  ce n'est pas un blocage.
- **Site en ligne** : `curl -sL -o /dev/null -w "%{http_code} %{url_effective}\n" https://claimyourjob.fr/`
  À la date de ce skill, `claimyourjob.fr` répond 301 vers `https://claimyourjob.com/fr/` qui répond 200.
  Si l'une de tes pages a changé, lis aussi cette page-là (`curl`), pas seulement l'accueil.

## 4. Rendre compte

Dis pour chaque élément ce que tu as **lu** : PR fusionnée (sha), jobs de la CI, code HTTP du site. Ce que tu n'as pas
lu se dit « non vérifié ». Rappelle que la branche de la PR est à supprimer dans GitHub par le propriétaire
(la suppression de branches à distance est refusée par l'environnement : ne la contourne pas).
