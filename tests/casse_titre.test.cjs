/* ─────────────────────────────────────────────────────────────────────────────
   CASSE DE TITRE — la règle, éprouvée sur des titres réels.

   Ce fichier ne touche ni au réseau ni au navigateur : la règle est une
   fonction pure, elle se juge sur une table de cas. Les titres viennent des
   sources telles qu'elles les publient — c'est là qu'on voit si la casse
   tient debout.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const enCasseDeTitre = require('../assets/casse-titre.js');

/* Chaque cas : [entrée réelle, sortie attendue, ce que le cas éprouve]. */
const CAS = [
  [
    'Actuaire ALM et modélisation - Stage 3 mois',
    'Actuaire ALM et Modélisation - Stage 3 mois',
    'le petit mot « et » reste bas ; le mot après le tiret monte ; le sigle ALM et l\'unité « 3 mois » ne bougent pas',
  ],
  [
    'chargé de développement pôle protection sociale & avantages h/f',
    'Chargé de Développement Pôle Protection Sociale & Avantages H/F',
    'un titre tout en minuscules remonte, et « h/f » devient « H/F »',
  ],
  [
    'DATA SCIENTIST - STAGE 6 MOIS',
    'Data Scientist - Stage 6 mois',
    'un titre crié redescend — les capitales n\'y sont pas des sigles',
  ],
  [
    'Actuaire (H/F) — vie',
    'Actuaire (H/F) — Vie',
    'le tiret cadratin sépare comme le tiret simple',
  ],
  [
    "Stage - Actuaire / Analyste ALM & Allocation Stratégique d'Actifs (H/F)",
    "Stage - Actuaire / Analyste ALM & Allocation Stratégique d'Actifs (H/F)",
    'l\'élision « d\' » ne prend pas de majuscule, et un titre déjà juste ne bouge pas',
  ],
  [
    "chargé d'études actuarielles - IFRS 17",
    "Chargé d'Études Actuarielles - IFRS 17",
    'IFRS reste un sigle, 17 reste un nombre',
  ],
  [
    'STAGIAIRE',
    'Stagiaire',
    'un titre d\'un seul mot, tout en capitales, redescend — le cas Generali',
  ],
  [
    'ACTUAIRE ALM ET MODELISATION',
    'Actuaire ALM et Modelisation',
    'un titre crié entier redescend, mais ALM reste un sigle',
  ],
  [
    'DATA SCIENTIST',
    'Data Scientist',
    'deux mots en capitales suffisent à reconnaître un titre crié',
  ],
  [
    'ASSISTANT(E)',
    'Assistant(e)',
    'les parenthèses collées ne cassent rien',
  ],
  [
    "Chargé d'études",
    "Chargé d'Études",
    'apres une elision, le nom prend la majuscule — l\'article reste bas',
  ],
  [
    "CDI - Responsable D'ETUDES D'ACTUARIAT N1 - H/F",
    "CDI - Responsable d'Etudes d'Actuariat N1 - H/F",
    'le titre Generali : sigle garde, elisions traitees, H/F intact',
  ],
  [
    "qu'il",
    "qu'il",
    'une elision suivie d\'un pronom ne prend pas de majuscule',
  ],
  [
    "aujourd'hui",
    "Aujourd'hui",
    'une apostrophe qui n\'est pas une elision ne coupe pas le mot',
  ],
  [
    'Actuaire confirmé (H/F) — risques Non-Vie',
    'Actuaire Confirmé (H/F) — Risques Non-Vie',
    'un composé « Non-Vie » garde ses deux majuscules',
  ],
];

test('A — la casse de titre suit la règle souple', () => {
  for (const [entree, attendu, pourquoi] of CAS) {
    assert.equal(enCasseDeTitre(entree), attendu, pourquoi);
  }
});

test('A — la casse de titre est idempotente', () => {
  for (const [entree] of CAS) {
    const une = enCasseDeTitre(entree);
    const deux = enCasseDeTitre(une);
    assert.equal(deux, une, `« ${une} » change au second passage : la règle n'est pas stable`);
  }
});

test('A — la casse de titre ne casse rien', () => {
  assert.equal(enCasseDeTitre(''), '');
  assert.equal(enCasseDeTitre('   '), '   ');
  assert.equal(enCasseDeTitre(null), null);
  assert.equal(enCasseDeTitre(undefined), undefined);

  /* Les chiffres, les sigles courts et les formes composées traversent la
     fonction sans être réécrits. */
  for (const intact of ['IFRS 17', 'ALM', 'CDI', 'R&D', 'V.I.E', 'H/F', 'S2']) {
    assert.equal(enCasseDeTitre(intact), intact, `« ${intact} » a été abîmé`);
  }
});

test('A — la casse de titre ne prétend pas nettoyer du balisage', () => {
  /* Un titre peut contenir du balisage : cette fonction ne le retire pas,
     elle change une casse. Le nettoyage est le rôle de l'échappement, au
     rendu — et c'est là qu'il est vérifié (voir le parcours du board). */
  const hostile = 'Actuaire <script>alert("xss")</script>';
  const sortie = enCasseDeTitre(hostile);
  assert.equal(typeof sortie, 'string');
  assert.match(sortie, /<\/?script/i, 'la fonction a mangé le balisage au lieu de le laisser à l\'échappement');
});
