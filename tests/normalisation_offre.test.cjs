const assert = require('node:assert/strict');
const test = require('node:test');
const { corpsNormalise, texteOriginal, construireCorps } = require('../src/pages/_offre-normalise.js');

test('corpsNormalise utilise les sections prêtes et conserve les blocs', () => {
  const html = corpsNormalise({
    status: 'ready',
    sections: [
      { key: 'overview', block_ids: ['b001'] },
      { key: 'missions', block_ids: ['b002'] },
    ],
    blocks: [
      { id: 'b001', kind: 'paragraph', text: 'Contexte exact' },
      { id: 'b002', kind: 'list', ordered: false, items: [{ kind: 'list_item', text: 'Mission exacte' }] },
    ],
  });
  assert.match(html, /section-overview/);
  assert.match(html, /Présentation du poste/);
  assert.match(html, /<li><p>Mission exacte<\/p><\/li>/);
});

test('corpsNormalise rejette une référence inconnue et laisse le repli intact', () => {
  assert.equal(corpsNormalise({ status: 'ready', sections: [{ key: 'missions', block_ids: ['missing'] }], blocks: [] }), null);
  assert.equal(construireCorps({ normalized: { status: 'fallback' } }, '<p>Legacy</p>'), '<p>Legacy</p>');
});

test('texteOriginal échappe le texte et garde le HTML sûr tel quel', () => {
  const texte = texteOriginal({ available: true, kind: 'description_raw', content: '<script>alert(1)</script>\nMission' });
  assert.doesNotMatch(texte, /<script>/);
  assert.match(texte, /&lt;script&gt;/);
  assert.match(texte, /Consulter le texte original/);
  const safe = texteOriginal({ available: true, kind: 'description_html_safe', content: '<p>Texte sûr</p>' });
  assert.match(safe, /<p>Texte sûr<\/p>/);
});

test('contrat legacy conservé sans normalized', () => {
  assert.equal(construireCorps({}, '<p>Ancien corps</p>'), '<p>Ancien corps</p>');
});

test('un bloc dupliqué ne produit pas deux affectations visibles', () => {
  const html = corpsNormalise({
    status: 'ready',
    sections: [
      { key: 'overview', block_ids: ['b001'] },
      { key: 'missions', block_ids: ['b001'] },
    ],
    blocks: [{ id: 'b001', kind: 'paragraph', text: 'Texte unique' }],
  });
  assert.equal(html.match(/Texte unique/g).length, 1);
});

test('corpsNormalise ignore les titres internes : une seule rubrique h2 par section', () => {
  const normalized = {
    status: 'ready',
    blocks: [
      { id: 'b001', kind: 'heading', inlines: [{ text: 'Vos missions' }] },
      { id: 'b002', kind: 'paragraph', inlines: [{ text: 'Mission exacte' }] },
    ],
    sections: [{ key: 'missions', block_ids: ['b001', 'b002'] }],
  };
  const html = corpsNormalise(normalized);
  const titres = html.match(/<h2>/g) || [];
  assert.equal(titres.length, 1, 'une seule rubrique h2 attendue');
  assert.match(html, /<h2>Vos missions<\/h2>/);
  assert.doesNotMatch(html, /<h2>Vos missions<\/h2>.*<h2>/s);
  assert.match(html, /Mission exacte/);
});
