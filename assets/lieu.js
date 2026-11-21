/* ─────────────────────────────────────────────────────────────────────────────
   LIEU — comment un lieu s'affiche.

   L'API publie le lieu d'une offre avec un préfixe pays brut : « FR, Paris »,
   « MA, Casablanca ». Le code n'est pas fait pour être lu. Cette fonction ne
   fait que de l'AFFICHAGE : la donnée de l'API, les filtres et les données
   structurées gardent la valeur d'origine.

   Règles :

   1. France : le pays n'est pas dit — « FR, Paris » devient « Paris » ;
   2. étranger : le pays suit la ville, entre parenthèses —
      « MA, Casablanca » devient « Casablanca (Maroc) » ;
   3. code inconnu : la valeur est rendue telle quelle. Mieux vaut « XX, Ville »
      qu'un pays inventé ; la fonction ne lève jamais d'erreur ;
   4. valeur sans code (« Paris », « Casablanca (Maroc) ») : rendue inchangée,
      donc la fonction est idempotente ;
   5. valeur vide ou absente : chaîne vide.

   Même source pour les trois surfaces : l'accueil, le board et la fiche
   autonome (rendue côté serveur).
   ───────────────────────────────────────────────────────────────────────────── */
(function (racine) {
  'use strict';

  /* Code pays à deux lettres (ISO 3166-1) → nom français. « FR » est traité à
     part : en France, on ne dit pas le pays. */
  const PAYS = {
    FR: 'France',
    MA: 'Maroc',
    IN: 'Inde',
    GB: 'Royaume-Uni',
    UK: 'Royaume-Uni',
    DE: 'Allemagne',
    ES: 'Espagne',
    BE: 'Belgique',
    CH: 'Suisse',
    LU: 'Luxembourg',
    IE: 'Irlande',
    US: 'États-Unis',
    NL: 'Pays-Bas',
    IT: 'Italie',
    PT: 'Portugal',
    CA: 'Canada',
    MC: 'Monaco',
    AT: 'Autriche',
    DK: 'Danemark',
    SE: 'Suède',
    NO: 'Norvège',
    FI: 'Finlande',
    PL: 'Pologne',
    CZ: 'Tchéquie',
    RO: 'Roumanie',
    GR: 'Grèce',
    MT: 'Malte',
    CY: 'Chypre',
    TN: 'Tunisie',
    DZ: 'Algérie',
    SN: 'Sénégal',
    CI: "Côte d'Ivoire",
    MU: 'Maurice',
    EG: 'Égypte',
    ZA: 'Afrique du Sud',
    AE: 'Émirats arabes unis',
    SG: 'Singapour',
    HK: 'Hong Kong',
    CN: 'Chine',
    JP: 'Japon',
    AU: 'Australie',
    BR: 'Brésil',
    MX: 'Mexique',
  };

  /* « FR, Paris » : deux lettres capitales, une virgule, le reste est le lieu. */
  const AVEC_CODE = /^([A-Z]{2})\s*,\s*(\S.*)$/;

  function formaterLieu(brut) {
    if (brut === null || brut === undefined) return '';
    const texte = String(brut).trim();
    if (!texte) return '';

    const trouve = AVEC_CODE.exec(texte);
    if (!trouve) return texte;

    const code = trouve[1];
    const reste = trouve[2].trim();
    if (!Object.prototype.hasOwnProperty.call(PAYS, code)) return texte;
    if (code === 'FR') return reste;
    return reste + ' (' + PAYS[code] + ')';
  }

  racine.formaterLieu = formaterLieu;
  if (typeof module !== 'undefined' && module.exports) module.exports = formaterLieu;
})(typeof window !== 'undefined' ? window : globalThis);
