const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const html = fs.readFileSync(require('node:path').join(__dirname, '../job-board.html'), 'utf8');
assert.match(html, /j\.published_at \|\| j\.source_published_at \|\| j\.first_seen_at/);

const context = vm.createContext({ Date, Math });
vm.runInContext('function formatDate(iso) { if (!iso) return \'\'; const d = new Date(iso), now = new Date(); const diff = Math.floor((now - d) / 86400000); if (diff === 0) return "Aujourd\'hui"; if (diff === 1) return \'Il y a 1 jour\'; if (diff < 7) return `Il y a ${diff} jours`; if (diff < 14) return \'Il y a 1 semaine\'; if (diff < 30) return `Il y a ${Math.floor(diff/7)} semaines`; return d.toLocaleDateString(\'fr-FR\', { day: \'numeric\', month: \'short\' }); }', context);
const date = new Date(Date.now() - 86400000).toISOString();
assert.equal(vm.runInContext(`formatDate(${JSON.stringify(date)})`, context), 'Il y a 1 jour');
console.log('date publique : tests ok');
