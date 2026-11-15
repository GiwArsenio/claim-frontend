/* ─────────────────────────────────────────────────────────────────────────────
   CASSE D'AFFICHAGE DES TITRES — Lot 2

   Vérifie que les titres reçus en capitales sont recomposés pour la lecture,
   et surtout que rien de ce qui porte un sens n'est abîmé : acronymes métier,
   formes composées (H/F, V.I.E), chiffres, et titres déjà rédigés.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../job-board.html'), 'utf8');

function extraire(nom) {
  const debut = html.indexOf('function ' + nom + '(');
  assert.ok(debut >= 0, 'fonction absente : ' + nom);
  // La fonction se termine à la première accolade fermante en colonne 0.
  const fin = html.indexOf('\n}', debut) + 2;
  assert.ok(fin > debut, 'fin introuvable : ' + nom);
  return html.slice(debut, fin);
}

const bloc = [
  extraire('protegerTitres'),
  extraire('composerSousMot'),
  extraire('composerMot'),
  extraire('titreAffichage'),
].join('\n');

// Les deux tables sont déclarées avant les fonctions : on les reprend telles
// quelles depuis la page, pour que le test éprouve le vrai jeu d'acronymes.
const tAcro = html.match(/const ACRONYMES_TITRE = new Set\(\[[\s\S]*?\]\);/)[0];
const tPetits = html.match(/const PETITS_MOTS_TITRE = new Set\(\[[\s\S]*?\]\);/)[0];

const contexte = vm.createContext({});
vm.runInContext(`${tAcro}\n${tPetits}\n${bloc}`, contexte);
const titre = (v) => vm.runInContext(`titreAffichage(${JSON.stringify(v)})`, contexte);

let cas = 0;
function egal(entree, attendu, pourquoi) {
  cas++;
  const obtenu = titre(entree);
  assert.equal(obtenu, attendu, `${pourquoi} — « ${entree} » a donné « ${obtenu} »`);
}

/* ── 1. Les titres réellement observés sur le board ─────────────────────── */
egal('STAGIAIRE', 'Stagiaire', 'un mot en capitales est composé');
egal('STAGE - DATA SCIENTIST H/F', 'Stage - Data Scientist H/F', 'les mots après tiret prennent une majuscule, H/F est préservé');
egal('CDI - RESPONSABLE D\'ETUDES D\'ACTUARIAT N1 - H/F',
     'CDI - Responsable d\'etudes d\'actuariat N1 - H/F',
     'particules élidées en minuscules, CDI et N1 préservés');
egal('CDI - CHARGE DE SOUSCRIPTION N1 - H/F',
     'CDI - Charge de Souscription N1 - H/F',
     'les petits mots au milieu restent en minuscules');
egal('VIE - REGIONAL HR DATA ANALYST - ITALY',
     'VIE - Regional HR Data Analyst - Italy',
     'VIE et HR restent des sigles');

/* ── 2. Rien n'est réécrit quand le titre est déjà rédigé ───────────────── */
egal('Chargé d\'études actuarielles (F/H) - stage',
     'Chargé d\'études actuarielles (F/H) - stage',
     'une minuscule suffit à prouver un titre rédigé');
egal('Senior AI Engineer – AI Factory - CDI (H/F)',
     'Senior AI Engineer – AI Factory - CDI (H/F)',
     'titre mixte jamais touché');
egal('Data Scientist', 'Data Scientist', 'titre déjà composé');
egal('Stage - Actuaire / Analyste ALM & Allocation Stratégique d\'Actifs (H/F)',
     'Stage - Actuaire / Analyste ALM & Allocation Stratégique d\'Actifs (H/F)',
     'titre long déjà rédigé');

/* ── 3. Formes composées et chiffres ────────────────────────────────────── */
egal('ACTUAIRE H/F', 'Actuaire H/F', 'H/F reste un bloc');
egal('DEVELOPPEUR F/H', 'Developpeur F/H', 'F/H reste un bloc');
egal('DATA ENGINEER M/F', 'Data Engineer M/F', 'M/F reste un bloc');
egal('STAGE V.I.E', 'Stage V.I.E', 'V.I.E reste un bloc');
egal('ANALYSTE BAC+5', 'Analyste BAC+5', 'BAC+5 reste un bloc');
egal('PILOTE P&L', 'Pilote P&L', 'P&L reste un bloc');
egal('ACTUAIRE IFRS 17', 'Actuaire IFRS 17', 'IFRS 17 est préservé');

/* ── 4. Cas limites ─────────────────────────────────────────────────────── */
egal('', '', 'chaîne vide');
egal('AXA', 'AXA', 'titre trop court pour être recomposé');
egal('STAGE', 'Stage', 'cinq lettres suffisent');
egal('   STAGIAIRE   ', 'Stagiaire', 'espaces parasites');
egal('A  B   C', 'A B C', 'espaces multiples réduits');

/* ── 5. Aucune balise n'est créée par la composition ─────────────────────── */
// La casse ne fabrique ni n'ajoute de caractère de balise : les chevrons de
// l'entrée restent exactement les mêmes dans la sortie. L'échappement reste
// le rôle d'escapeHtml, au rendu.
cas++;
const avecBalise = titre('STAGIAIRE <SCRIPT>');
assert.equal((avecBalise.match(/</g) || []).length, 1, 'aucun chevron ajouté');
assert.equal((avecBalise.match(/>/g) || []).length, 1, 'aucun chevron ajouté');

console.log(`${cas} cas de casse d'affichage passés`);
