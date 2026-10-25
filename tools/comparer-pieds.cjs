/* Comparaison pixel par pixel des pieds de page.
 *
 * On ne se fie pas a une mesure de style : deux elements peuvent avoir le
 * meme style calcule et differer a l'ecran. On compare les pixels.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');

const D = path.join(__dirname, '..', 'captures', 'vision');

const GROUPES = [
  { nom: 'bureau', ref: 'bureau-accueil-pied.png', autres: ['bureau-board-pied.png', 'bureau-entreprises-pied.png', 'bureau-observatoire-pied.png', 'bureau-a-propos-pied.png', 'bureau-cgu-pied.png', 'bureau-confidentialite-pied.png', 'bureau-contact-pied.png'] },
  { nom: 'phone', ref: 'phone-accueil-pied.png', autres: ['phone-board-pied.png', 'phone-entreprises-pied.png', 'phone-observatoire-pied.png', 'phone-a-propos-pied.png', 'phone-cgu-pied.png', 'phone-confidentialite-pied.png', 'phone-contact-pied.png'] },
];

for (const g of GROUPES) {
  console.log(`\n══ ${g.nom} — référence : ${g.ref} ══`);

  const refPath = path.join(D, g.ref);
  if (!fs.existsSync(refPath)) { console.log('  référence absente'); continue; }
  const ref = PNG.sync.read(fs.readFileSync(refPath));

  for (const nom of g.autres) {
    const p = path.join(D, nom);
    if (!fs.existsSync(p)) { console.log(`  ${nom} : ABSENT`); continue; }
    const img = PNG.sync.read(fs.readFileSync(p));

    if (img.width !== ref.width || img.height !== ref.height) {
      console.log(`  ${nom} : taille ${img.width}x${img.height} ≠ ${ref.width}x${ref.height}`);
      continue;
    }

    const diff = new PNG({ width: ref.width, height: ref.height });
    const n = pixelmatch(ref.data, img.data, diff.data, ref.width, ref.height, { threshold: 0.1 });
    const total = ref.width * ref.height;
    const pct = ((n / total) * 100).toFixed(2);

    /* On ecrit le diff quand il y a une difference : on ne peut pas
       juger une capture sans la voir. */
    const out = path.join(D, `diff-${g.nom}-${nom.replace('.png', '')}.png`);
    if (n > 0) fs.writeFileSync(out, PNG.sync.write(diff));

    console.log(`  ${nom.padEnd(38)} ${String(n).padStart(8)} px différents (${pct.padStart(6)} %)` +
      (n > 0 ? `  -> ${path.basename(out)}` : '  IDENTIQUE'));
  }
}
