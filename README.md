# CLAIM! — Frontend sur Cloudflare Workers

Le site est du HTML/CSS/JS vanilla, sans build. Cette Workers remplace
l'hébergement Vercel : le CDN sert les fichiers statiques, le Worker rend
les trois adresses qui ne peuvent pas être des fichiers.

## Ce qui est rendu par le Worker

| Adresse | Rendu | Pourquoi ce n'est pas un fichier |
| :--- | :--- | :--- |
| `/offre/{slug}` | `src/pages/offre.js` | La page porte le balisage `JobPosting` que Google indexe, construit à partir de l'API. |
| `/sitemap.xml` | `src/pages/sitemap.js` | La liste des offres change chaque matin : le sitemap est lu au moment de la demande. |
| `/robots.txt` | `src/pages/robots.js` | Mentionne le sitemap, dont l'adresse est variable. |
| `/claim-job-board.html` | `src/index.js` | Redirection 301 vers `/job-board.html` (ancienne adresse indexée). |
| `/` | `src/index.js` | Sert `index.html` : voir la note sur `html_handling` ci-dessous. |

Tout le reste — les pages HTML, le CSS, les scripts, les images, les logos —
est servi **directement par le CDN**, gratuitement et sans limite de trafic.

## Deux réglages qui ne sont pas évidents

### `html_handling: "none"`

Par défaut, Workers Static Assets redirige (307) toute adresse `.html` vers
sa version sans extension : `/job-board.html` devient `/job-board`.

Sur CLAIM!, c'est un piège. Le board, l'accueil, les pages Entreprises et
Observatoire sont des adresses `.html` connues, indexées par Google et
partagées en lien. `none` sert l'adresse exacte : les liens existants
continuent de pointer au bon endroit et le signal SEO ne bouge pas.

La contrepartie : avec `none`, Cloudflare ne résout plus `/` vers
`/index.html`. La racine est donc servie explicitement par le Worker
(cf. `src/index.js`).

### `not_found_handling: "404-page"`

Cloudflare cherche la page d'erreur dans `public/404.html` — le fichier
le plus proche de l'adresse demandée. La page
porte `noindex` : une adresse inexistante ne doit jamais entrer à l'index.

C'est un gain par rapport à Vercel, qui renvoyait sa page d'erreur par
défaut de la plateforme (79 octets) : l'utilisateur voit désormais le
gabarit du site.

## Le quota

Les requêtes vers les fichiers statiques sont gratuites et illimitées. Seul
le passage par le Worker compte dans le quota d'invocations (100 000 par
jour en gratuit). Comme le Worker n'est interrogé que pour les adresses
ci-dessus, le trafic SEO — HTML, CSS, images — n'est jamais compté.

## Le rendu doit rester identique a la production

Le Worker ne sert pas une copie du site : il rend la meme page que Vercel,
au caractere pres. C'est la regle qui permet de basculer le DNS sans
risque SEO — les 355 fiches d'offre doivent produire le meme HTML avant et
apres.

Cette regle a un corollaire : `api/offre.js` (Vercel) et
`src/pages/_offre-rendu.js` (Worker) portent le meme rendu, et le site
continue d'evoluer. Un correctif de style arrive dans `api/offre.js` : sans
report, le Worker servirait une page differente de la production —
silencieusement, et pour toutes les fiches.

Le report est automatise :

```sh
npm run aligner:rendu              # regenere _offre-rendu.js depuis api/offre.js
npm run aligner:rendu:verifier    # dit si les deux sont alignes
```

Et la verification, une fois le Worker lance (`npm run dev`) :

```sh
npm run test:workers               # quelques offres temoins
npm run test:workers:complet       # les 355 fiches
```

Le harnais compare le Worker a la reference (la production Vercel par
defaut, modifiable avec `--ref`). Il controlle aussi les adresses fixes :
la racine, le board, la redirection, la 404.

## Lancer en local

```sh
npm install
npm run dev          # http://127.0.0.1:8788
```

## Déployer

```sh
npx wrangler deploy
```

Le domaine `claimyourjob.fr` est rattaché par le bloc `routes` de
`wrangler.jsonc` (`custom_domain: true`). Cela suppose que les serveurs de
noms du domaine soient gérés par Cloudflare.
