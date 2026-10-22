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

## Ajouter un logo

1. Déposer le fichier dans ce dossier, en PNG ou SVG.
2. Vérifier qu'il est lisible sur le fond clair de la tuile : un logo blanc
   sur transparent doit être aplati, sinon il disparaît.
3. Noter ici son origine et sa taille.
4. Dans `assets/companies-data.js`, remplacer la valeur du domaine par
   `/logos/nom-du-fichier`.
