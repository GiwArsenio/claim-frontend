/* ─────────────────────────────────────────────────────────────────────────────
   CASSE DE TITRE — la variante souple, celle des sites d'emploi.

   Les titres d'offres arrivent tels que les sources les publient : parfois
   tout en minuscules, parfois tout en capitales, parfois justes. Un board qui
   les affiche bruts donne une liste ou l'œil ne trouve pas de point d'appui.

   Cette fonction applique une casse de titre SOUBLE :

   1. le premier mot du titre et les mots qui suivent un séparateur
      (-, /, :, &, |, ·) prennent une majuscule — « - Stage » ;
   2. les petits mots de liaison restent en minuscules — « et », « de »,
      « pour » — sauf en position 1 ;
   3. les sigles et les formes composées ne sont jamais touchés : ALM, IFRS,
      CDI, H/F, R&D, V.I.E. On reconnaît un sigle à sa longueur courte et à
      ses capitales, ou à son séparateur interne — un mot de huit lettres
      tout en capitales est un titre crié, pas un sigle, et redescend ;
   4. les unités de durée qui suivent un nombre restent en minuscules —
      « Stage 3 mois », pas « Stage 3 Mois » ;
   5. partout ailleurs, seule la PREMIÈRE lettre change. Le reste du mot
      n'est jamais réécrit : « Modélisation » reste « Modélisation », un
      accent ne bouge pas, et un mot déjà correct ne bouge pas non plus —
      la fonction est idempotente.
   ───────────────────────────────────────────────────────────────────────────── */
(function (racine) {
  'use strict';

  /* Mots de liaison : minuscules, sauf en tête ou après un séparateur. */
  const LIAISON = new Set([
    'et', 'ou', 'ni', 'de', 'du', 'des', 'en', 'a', 'à', 'au', 'aux',
    'le', 'la', 'les', 'l', 'un', 'une', 'pour', 'par', 'sur', 'sous',
    'dans', 'avec', 'chez', 'sans', 'vers', 'd', 'y',
  ]);

  /* Sigles du metier, preserves meme dans un titre crie. Sans cette liste,
     « ACTUAIRE ALM » devenait « Actuaire Alm » : la regle qui redescend les
     titres cries ne sait pas distinguer un sigle d'un mot crie. */
  const SIGLES = new Set(['alm', 'ifrs', 'scr', 'orsa', 'ats', 'cdi', 'cdd', 'vie', 'rh', 'ia', 'bi', 'es', 'rgpd', 'cnil']);

  /* Unités qui suivent un nombre : « 3 mois », « 6 ans ». */
  const UNITES = new Set([
    'mois', 'an', 'ans', 'jour', 'jours', 'semaine', 'semaines', 'heure', 'heures',
  ]);

  const SEPARATEUR_FINAL = /[-/:&|·\u2013\u2014]\s*$/;
  const SEPARATEUR_INTERNE = /[-/&|·.]/;
  const ELISION = /^(d|l|n|s|c|j|m|t|qu)['\u2019]/i;

  /* Seule la PREMIERE lettre change : le reste du mot n'est jamais reecrit.
     « laMethode » devient « LaMethode », pas « Lamethode » ; un accent ne
     bouge pas. Un titre crie redescend d'abord, lui. */
  function majusculeInitiale(mot) {
    return mot.charAt(0).toLocaleUpperCase('fr') + mot.slice(1);
  }

  /* Un sigle : court et tout en capitales — ALM, IFRS, CDI, RH. Au-delà de
     quatre lettres, un mot en capitales est un titre crié, pas un sigle. */
  function estSigle(mot) {
    if (mot !== mot.toLocaleUpperCase('fr')) return false;
    if (!/\p{L}/u.test(mot)) return false;
    return mot.replace(/[^\p{L}]/gu, '').length <= 4;
  }

  /* « h/f » -> « H/F », « R&D » reste « R&D », « d'Actifs » garde son
     élision. Chaque segment prend une majuscule, sauf les sigles déjà
     corrects. */
  function casseComposee(mot, hurle) {
    if (ELISION.test(mot)) {
      // « d'Actifs » : l'élision reste en minuscules, le mot qui suit aussi
      // (il est déjà capitalisé par la source ou par la règle générale).
      return mot;
    }
    return mot.split(/([-/&|·.'])/).map((segment) => {
      if (!/\p{L}/u.test(segment)) return segment;
      if (!hurle && estSigle(segment)) return segment;
      return majusculeInitiale(hurle ? segment.toLocaleLowerCase('fr') : segment);
    }).join('');
  }

  /* Un titre dont presque tous les mots sont en capitales est un titre crié :
     les capitales y sont une humeur de saisie, pas des sigles. On les
     redescend toutes. Sans cela, « DATA SCIENTIST - STAGE 6 MOIS » gardait
     « DATA » et « MOIS ». */
  function hurle(texte) {
    const mots = texte.split(/\s+/).filter((m) => /\p{L}{2,}/u.test(m));
    if (mots.length < 2) return false;
    const criards = mots.filter((m) => m === m.toLocaleUpperCase('fr') && /\p{L}/u.test(m));
    return criards.length / mots.length >= 0.7;
  }

  function enCasseDeTitre(texte) {
    if (typeof texte !== 'string' || !texte.trim()) return texte;

    const titreCrie = hurle(texte);
    let apresSeparateur = true;   // début de titre
    let precedeNombre = false;
    const sortie = [];

    for (const morceau of texte.split(/(\s+)/)) {
      if (!morceau) continue;
      if (!morceau.trim()) { sortie.push(morceau); continue; }

      // Ponctuation de bord : parenthèses, guillemets, point final.
      const bords = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u.exec(morceau);
      const avant = bords[1];
      const coeur = bords[2];
      const apres = bords[3];

      let transforme = coeur;
      if (coeur) {
        const bas = coeur.toLocaleLowerCase('fr');
        const estNombre = /^\d/.test(coeur);

        if (estNombre) {
          transforme = coeur;
        } else if (!apresSeparateur && LIAISON.has(bas)) {
          transforme = bas;                                   // « et », « de »
        } else if (!apresSeparateur && precedeNombre && UNITES.has(bas)) {
          transforme = bas;                                   // « 3 mois »
        } else if (SEPARATEUR_INTERNE.test(coeur) || coeur.includes("'") || coeur.includes('\u2019')) {
          transforme = casseComposee(coeur, titreCrie);       // H/F, d'Actifs
        } else if (!titreCrie && estSigle(coeur)) {
          transforme = coeur;                                 // ALM, IFRS
        } else if (SIGLES.has(bas) && coeur === coeur.toLocaleUpperCase('fr')) {
          // Deja en capitales dans la source : c'est ALM, pas « alm ».
          // « vie » ecrit en minuscules reste le mot vie, pas le contrat V.I.E.
          transforme = coeur.toLocaleUpperCase('fr');
        } else {
          /* Un mot seul tout en capitales est un titre crie comme un autre :
             « STAGIAIRE » doit redescendre. On ne le reconnait qu'a sa
             longueur — un sigle fait quatre lettres au plus, et il est deja
             sorti par la branche precedente. */
          const crie = coeur === coeur.toLocaleUpperCase('fr') && /\p{L}{2,}/u.test(coeur);
          transforme = majusculeInitiale(titreCrie || crie ? bas : coeur);
        }
        precedeNombre = estNombre;
      }

      sortie.push(avant + transforme + apres);
      apresSeparateur = SEPARATEUR_FINAL.test(morceau);
    }

    return sortie.join('');
  }

  racine.enCasseDeTitre = enCasseDeTitre;
  if (typeof module !== 'undefined' && module.exports) module.exports = enCasseDeTitre;
})(typeof window !== 'undefined' ? window : globalThis);
