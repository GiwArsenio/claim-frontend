const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const html = fs.readFileSync(require('node:path').join(__dirname, '../job-board.html'), 'utf8');
assert.match(html, /j\.published_at \|\| j\.source_published_at \|\| j\.first_seen_at/);

const context = vm.createContext({ Date, Math });
const formatDate = `
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Il y a 1 jour';
  if (diff < 7) return 'Il y a ' + diff + ' jours';
  if (diff < 14) return 'Il y a 1 semaine';
  if (diff < 30) return 'Il y a ' + Math.floor(diff / 7) + ' semaines';
  if (diff < 60) return 'Il y a 1 mois';
  const mois = Math.max(1, Math.floor(diff / 30));
  return mois === 1 ? 'Il y a 1 mois' : 'Il y a ' + mois + ' mois';
}`;
vm.runInContext(formatDate, context);
for (const [jours, attendu] of [[1, 'Il y a 1 jour'], [8, 'Il y a 1 semaine'], [30, 'Il y a 1 mois'], [35, 'Il y a 1 mois'], [59, 'Il y a 1 mois'], [60, 'Il y a 2 mois'], [89, 'Il y a 2 mois'], [90, 'Il y a 3 mois'], [365, 'Il y a 12 mois']]) {
  const date = new Date(Date.now() - jours * 86400000).toISOString();
  assert.equal(vm.runInContext(`formatDate(${JSON.stringify(date)})`, context), attendu);
}
console.log('date publique : tests ok');
