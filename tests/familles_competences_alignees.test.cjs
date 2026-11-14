// La table des familles de compétences vit dans une source unique
// (src/pages/_competences-familles.js). La fiche l'importe ; job-board.html la
// recopie, faute de pouvoir importer un module dans une page statique.
//
// Sans ce test, une famille ajoutée d'un côté disparaîtrait de l'autre en
// silence : la fiche et le board n'afficheraient plus les mêmes compétences.
const test = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const RACINE = path.join(__dirname, '..');

test('la table des familles du board est alignee sur la source unique', () => {
  assert.doesNotThrow(() => {
    execFileSync('python3', ['scripts/aligner-familles.py', '--verifier'], {
      cwd: RACINE,
      stdio: 'pipe',
    });
  }, 'la table de job-board.html differe de src/pages/_competences-familles.js : lancer `npm run aligner:familles`');
});
