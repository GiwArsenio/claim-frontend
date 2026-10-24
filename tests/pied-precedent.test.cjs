/* ─────────────────────────────────────────────────────────────────────────────
   LE PIED PRÉCÉDENT EST BIEN VISIBLE, PARTOUT

   La version précédente du pied est celle de l'accueil : un pied clair,
   en deux colonnes — l'identité et la navigation d'un côté, le texte de
   mentions de l'autre.

   Ce test vérifie trois choses, et pas seulement une :

   1. LE PIED EST VISIBLE. Pas « présent dans le DOM » : visible. Un
      élément dans un document verrouillé a un style calculé correct et
      ne s'affiche pas.

   2. LE PIED EST ATTEIGNABLE. On defile jusqu'en bas, et le pied doit
      etre la, dans la fenetre.

   3. LE PIED EST IDENTIQUE A LA REFERENCE. Meme structure, meme fond,
      meme position, memes liens — sur les huit pages, bureau et telephone.

   Le point 1 est celui qui a echappe aux corrections precedentes : le
   pied etait mesure comme present, et il ne l'etait pas a l'ecran.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');

const PAGES = [
  { nom: 'accueil', url: '/index.html' },
  { nom: 'board', url: '/job-board.html' },
  { nom: 'entreprises', url: '/claim-entreprises.html' },
  { nom: 'observatoire', url: '/claim-observatoire.html' },
  { nom: 'a-propos', url: '/a-propos.html' },
  { nom: 'cgu', url: '/cgu.html' },
  { nom: 'confidentialite', url: '/confidentialite.html' },
  { nom: 'contact', url: '/contact.html' },
];

const FORMATS = [
  { nom: 'bureau', format: 'bureau' },
  { nom: 'phone', format: 'phone' },
];

/** L'empreinte du pied : ce qui doit être identique partout. */
async function empreinte(page) {
  return page.evaluate(() => {
    const ft = document.querySelector('footer.pied, footer#ft');
    if (!ft) return { present: false };

    const st = getComputedStyle(ft);
    const r = ft.getBoundingClientRect();

    const logo = ft.querySelector('.logo, .ft-logo');
    const rl = logo ? logo.getBoundingClientRect() : null;

    return {
      present: true,
      balise: ft.tagName.toLowerCase(),
      classe: ft.className,
      fond: st.backgroundColor,
      hauteur: Math.round(r.height),
      largeur: Math.round(r.width),
      logoX: rl ? Math.round(rl.x) : null,
      logoCouleur: logo ? getComputedStyle(logo).color : null,
      colonnes: ft.querySelector('.haut') ?
        getComputedStyle(ft.querySelector('.haut')).gridTemplateColumns : null,
      nav: Array.from(ft.querySelectorAll('.nav2 a, .ft-links a')).map((a) =>
        (a.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 26) + '→' + a.getAttribute('href')),
      aMentions: ft.querySelector('.mentions') ? ft.querySelector('.mentions').textContent.trim().slice(0, 40) : null,
    };
  });
}

/** Le pied est-il réellement à l'écran ? */
async function visible(page) {
  return page.evaluate(() => {
    const ft = document.querySelector('footer.pied, footer#ft');
    if (!ft) return { present: false };

    const de = document.documentElement;
    const r = ft.getBoundingClientRect();
    const st = getComputedStyle(ft);

    /* On defile jusqu'en bas : le pied doit pouvoir etre atteint. */
    window.scrollTo(0, de.scrollHeight);
    const r2 = ft.getBoundingClientRect();

    return {
      present: true,
      defilable: de.scrollHeight > de.clientHeight + 2,
      hauteur: Math.round(r2.height),
      dansLaFenetre: r2.top < window.innerHeight && r2.bottom > 0,
      visible: r2.height > 0 && st.display !== 'none' && st.visibility === 'visible',
      /* La page est-elle verrouillee ? */
      bodyOverflow: getComputedStyle(document.body).overflow,
      scrollH: de.scrollHeight,
      clientH: de.clientHeight,
    };
  });
}

test('A08 — le pied est visible et atteignable, sur les huit pages', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const f of FORMATS) {
      await t.test(f.nom, async () => {
        for (const p of PAGES) {
          const { ctx, page } = await aide.ouvrirPage(aide.FORMATS[f.format]);
          try {
            await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
            await aide.attendre(page, 1400);

            const v = await visible(page);

            assert.ok(v.present, `${p.nom} / ${f.nom} : pas de pied de page`);
            assert.ok(
              v.visible && v.hauteur > 0,
              `${p.nom} / ${f.nom} : le pied n'est pas visible — ` +
              `hauteur ${v.hauteur}px, display=${v.display || '?'}. ` +
              `Un élément dans un document verrouillé a un style calculé ` +
              `correct et ne s'affiche pas.`
            );
            assert.ok(
              v.dansLaFenetre,
              `${p.nom} / ${f.nom} : le pied n'est pas dans la fenêtre après ` +
              `défilement en bas — il est hors de l'écran. ` +
              `(page verrouillée ? body overflow=${v.bodyOverflow}, ` +
              `scrollH=${v.scrollH} clientH=${v.clientH})`
            );
          } finally {
            await ctx.close();
          }
        }
      });
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('A08 — le pied est identique à celui de l\'accueil, partout', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const f of FORMATS) {
      await t.test(f.nom, async () => {
        const { ctx, page } = await aide.ouvrirPage(aide.FORMATS[f.format]);
        try {
          await page.goto(aide.BASE + '/index.html', { waitUntil: 'domcontentloaded' });
          await aide.attendre(page, 1400);
          const ref = await empreinte(page);

          const ecartsVus = [];

          for (const p of PAGES) {
            if (p.nom === 'accueil') continue;

            await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
            await aide.attendre(page, 1400);
            const e = await empreinte(page);

            const ec = [];
            if (!e.present) ec.push('ABSENT');
            if (e.balise !== ref.balise) ec.push(`balise ${e.balise} ≠ ${ref.balise}`);
            if (e.classe !== ref.classe) ec.push(`classe « ${e.classe} » ≠ « ${ref.classe} »`);
            if (e.fond !== ref.fond) ec.push(`fond ${e.fond} ≠ ${ref.fond}`);
            if (e.largeur !== ref.largeur) ec.push(`largeur ${e.largeur} ≠ ${ref.largeur}`);
            if (e.hauteur !== ref.hauteur) ec.push(`hauteur ${e.hauteur} ≠ ${ref.hauteur}`);
            if (e.logoX !== ref.logoX) ec.push(`logo x=${e.logoX} ≠ x=${ref.logoX}`);
            if (e.logoCouleur !== ref.logoCouleur) {
              ec.push(`couleur du logo ${e.logoCouleur} ≠ ${ref.logoCouleur}`);
            }
            if (e.colonnes !== ref.colonnes) ec.push(`colonnes ${e.colonnes} ≠ ${ref.colonnes}`);
            if (e.nav.join(' | ') !== ref.nav.join(' | ')) {
              ec.push(`navigation : [${e.nav.join(', ')}] ≠ [${ref.nav.join(', ')}]`);
            }
            if (e.aMentions !== ref.aMentions) {
              ec.push(`mentions : « ${e.aMentions} » ≠ « ${ref.aMentions} »`);
            }
            if (ec.length) ecartsVus.push({ page: p.nom, ecarts: ec });
          }

          assert.deepEqual(
            ecartsVus, [],
            `${f.nom} : ${ecartsVus.length} pied(s) diffèrent de la référence (l'accueil) — ` +
            JSON.stringify(ecartsVus)
          );
        } finally {
          await ctx.close();
        }
      });
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('A08 — les mentions « D\'ici là » ont disparu des pages à chantier', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const p of [
      { nom: 'entreprises', url: '/claim-entreprises.html' },
      { nom: 'observatoire', url: '/claim-observatoire.html' },
    ]) {
      await t.test(p.nom, async () => {
        const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
        try {
          await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
          await aide.attendre(page, 1400);

          const etat = await page.evaluate(() => {
            const texte = document.body.innerText;
            const bloc = document.querySelector('.retour');
            return {
              aLaMention: /D['’]ici\s+l[àa]/i.test(texte),
              aLeBloc: Boolean(bloc),
              texteBloc: bloc ? bloc.textContent.replace(/\s+/g, ' ').trim() : null,
              /* Les liens de renvoi : « offres d'emploi » et « accueil », dans
                 ce paragraphe de renvoi. */
              liensRenvoi: bloc ? Array.from(bloc.querySelectorAll('a')).map((a) => a.getAttribute('href')) : [],
            };
          });

          assert.equal(
            etat.aLaMention, false,
            `${p.nom} : la mention « D'ici là, tout le reste du site est ouvert » est encore là`
          );
          assert.equal(
            etat.aLeBloc, false,
            `${p.nom} : le paragraphe de renvoi « .retour » est encore là — « ${etat.texteBloc} »`
          );
          assert.deepEqual(
            etat.liensRenvoi, [],
            `${p.nom} : les liens de renvoi sont encore là — ${JSON.stringify(etat.liensRenvoi)}`
          );
        } finally {
          await ctx.close();
        }
      });
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
