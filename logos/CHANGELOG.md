# Logos des employeurs

Ces fichiers sont la source de vérité pour les logos dont le favicon ne
rendait rien de lisible. Ils sont servis par notre propre domaine
(`/logos/…`), sans requête vers un tiers.

Chaque logo a été relevé sur le site de l'employeur lui-même, ou sur une
source libre, puis mesuré : la taille naturelle est notée ici.

| Employeur | Fichier | Taille | Origine |
|---|---|---|---|
| AIG | `aig.png` | 908 × 165 | `aig.fr/static/assets/logo-group.8d29bba6.png` — aplati sur fond clair, le fichier d'origine est blanc sur transparent |
| AESIO | `aesio.svg` | 300 × 106 | `aesio.fr/themes/custom/aesio/images/logo.svg` |
| APICIL | `apicil.png` | 295 × 80 | `groupe-apicil.com/wp-content/uploads/2023/06/Groupe-APICIL.png` (via archive) |
| CARAC | `carac.png` | 793 × 213 | `carac.fr/media/logo-carac.png` |
| Garance | `garance.png` | 400 × 400 | Welcome to the Jungle, image de l'entreprise |
| La Mutuelle Générale | `la-mutuelle-generale.svg` | 242 × 56 | `lamutuellegenerale.fr/themes/custom/lmg_corporate/logo.svg` |
| Malakoff Humanis | `malakoff-humanis.png` | 3 508 × 2 481 | `malakoffhumanis.com/sites/smile/files/images/logo-mh-metiers-bas-rvb.png` |
| Pro BTP | `pro-btp.png` | 179 × 139 | `recrute-probtp.talent-soft.com/Handlers/Image.ashx?imagetype=logo` |
| SCOR | `scor.svg` | 1 510 × 556 | `scor.com/themes/custom/scor/logo.svg` |
| Seabird Conseil | `seabird.svg` | 185 × 25 | `seabirdconseil.com/wp-content/themes/seabird/images/logos/logo.svg` |
| SMABTP | `smabtp.png` | 194 × 120 | `smabtp.fr/sma/upload/docs/image/png/2023-01/logo-smabtp-footer.png` |
| UMR | `umr.png` | 398 × 199 | `umr-retraite.fr/themes/umr/assets/dist/images/logo/logo.png` |
| Alan | `alan.png` | 1 928 × 852 | `jobs.ashbyhq.com/alan` — endpoint `org-theme-wordmark` |
| Covéa | `covea.png` | 65 × 66 | `jobs.smartrecruiters.com/COVEA1` — monogramme COvea |
| KPMG | `kpmg.svg` | 77 × 30 | `kpmg.com` — logo de l'en-tête |
| AON | `aon.png` | 508 × 306 | `aon.com` — signature rouge |
| Suravenir | `suravenir.svg` | 300 × 62 | `suravenir.fr/wp-content/uploads/2025/09/logo-2025.svg` |
| Verlingue | `verlingue.png` | 280 × 96 | `verlingue.fr` — logo courtier en assurances |
| Natixis | `natixis.png` | 360 × 62 | `recrutement.bpce.fr` — logotype de la marque |
| SMACL | `smacl.png` | 203 × 119 | `smacl.fr/ref-images-web/smacl_logo.png` |
| Shift Technology | `shift-technology.svg` | — | `shift-technology.com` |
| Sia Partners | `sia-partners.svg` | — | `sia-partners.com` |

## Deux points de droit

**SCOR.** Un logo nommé « SCOR » existe aussi sur Wikimedia Commons : c'est
celui du *Scientific Committee on Oceanic Research*, sans rapport avec
l'assureur français. Le logo retenu ici vient de `scor.com`, le site du
groupe. Il n'y a donc aucune attribution à faire pour SCOR.

**BPCE.** Son logo reste une adresse externe, tirée de Wikimedia Commons.
Il n'est pas versionné ici parce que le format retenu sur Commons est un
SVG dont les conditions de réutilisation demandaient un crédit explicite.
Il est credited en pied de page, sur les surfaces qui affichent un logo.

**AIG.** L'entrée a été retirée de la table : elle pointait sur `aig.fr`,
qui est « Alliances Informatique de Gestion », et non l'assureur. AIG
n'existe ni parmi les entreprises de la base, ni parmi les sources
collectées, ni parmi les scrapers — l'entrée était un résidu. Si
l'assureur entre un jour dans le relevé, il faudra son vrai logo : celui
d'`aig.com/fr` est blanc et fait 89 px de large, ce qui ne convient pas à
une tuile claire.

## Ajouter un logo

1. Déposer le fichier dans ce dossier, en PNG ou SVG.
2. Vérifier qu'il est lisible sur le fond clair de la tuile : un logo blanc
   sur transparent doit être aplati, sinon il disparaît.
3. Noter ici son origine et sa taille.
4. Dans `assets/companies-data.js`, remplacer la valeur du domaine par
   `/logos/nom-du-fichier`.

## Ce que la mesure ne voyait pas

La taille naturelle ne dit pas si une image est un logo. Hunter servait, pour
six employeurs, la **photo de couverture de marque** — un pont, un surfeur,
un collaborateur en bureau — là où la tuile attend le logotype. Ces images
faisaient 1 024 px de large : la mesure les jugeait parfaites, et elles
étaient fausses.

La vérification visuelle, elle, les a vues. Elle a aussi révélé que
l'entrée `aig` pointait sur `aig.fr`, qui est « Alliances Informatique de
Gestion », et non l'assureur AIG — l'entrée a été retirée.

Chaque logo de ce dossier a été regardé avant d'être retenu.
