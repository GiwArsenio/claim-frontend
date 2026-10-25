/* ─────────────────────────────────────────────────────────────────────────────
   FAMILLE A07 — La pastille de filtre

   Le signalement initial : en mode nuit, les pastilles de filtre sous la
   barre de recherche ne réagissent pas au survol. La famille générale
   (survol-a07.test.cjs) mesurait l'écart de couleur et le trouvait
   suffisant — le fond changeait bien.

   Ce que la famille générale ne pouvait pas voir, et que ce test vérifie :

   1. LA FLÈCHE. Une liste déroulante porte sa flèche en `background-image`.
      Le raccourci CSS `background` remet à zéro `background-position` et
      `background-repeat` : la flèche partait dans le coin haut-gauche,
      répétée sur toute la pastille. 101 pixels de trait au repos, 464 au
      survol. C'est le défaut le plus visible, et il n'apparaît dans
      AUCUNE mesure de couleur.

   2. LE TON DU SURVOL. Un aplat de couleur saturée sur un fond sombre ne
      se lit pas comme un survol : l'œil lit « ça s'allume », pas « ça se
      détend ». Le survol d'une pastille doit être un éclaircissement de
      surface.

   3. LA LISIbilITÉ DE LA FLÈCHE. Son trait était figé dans le SVG, à
      2,64 de contraste sur le fond de pause en mode nuit.

   Ces trois points sont vérifiés par le STYLE CALCULÉ, et non par une
   capture d'écran : le style calculé est exact et déterministe, là où
   l'anticrenelage d'un trait fin rend toute mesure par pixels douteuse.
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const aide = require('./aide-parcours.cjs');

const PAGES = [
  { nom: 'accueil', url: '/index.html', selecteur: '#acc-contrat' },
  { nom: 'board', url: '/job-board.html', selecteur: '#contract-filter' },
];

/** L'état de survol d'une pastille, mesuré par le style calculé. */
async function mesurerSurvol(page, selecteur) {
  const avant = await page.evaluate((c) => {
    const el = document.querySelector(c);
    if (!el) return null;
    const st = getComputedStyle(el);
    return {
      fond: st.backgroundColor,
      position: st.backgroundPosition,
      repetition: st.backgroundRepeat,
      image: st.backgroundImage,
      couleur: st.color,
      bordure: st.borderTopColor,
      ombre: st.boxShadow,
    };
  }, selecteur);

  if (!avant) return null;

  const pos = await page.evaluate((c) => {
    const el = document.querySelector(c);
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }, selecteur);

  await page.mouse.move(pos.x, pos.y);
  await page.waitForTimeout(300);

  const apres = await page.evaluate((c) => {
    const el = document.querySelector(c);
    const st = getComputedStyle(el);
    return {
      fond: st.backgroundColor,
      position: st.backgroundPosition,
      repetition: st.backgroundRepeat,
      image: st.backgroundImage,
      couleur: st.color,
      bordure: st.borderTopColor,
      ombre: st.boxShadow,
    };
  }, selecteur);

  await page.mouse.move(2, 2);
  await page.waitForTimeout(150);

  return { avant, apres };
}

test('A07 — la flèche de la pastille ne bouge pas au survol', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const p of PAGES) {
      await t.test(p.nom, async () => {
        const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau);
        try {
          await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
          await aide.attendre(page, 1600);

          const m = await mesurerSurvol(page, p.selecteur);
          assert.ok(m, `la pastille ${p.selecteur} est introuvable`);

          assert.equal(
            m.apres.position, m.avant.position,
            `${p.nom} : la flèche change de place au survol — ` +
            `"${m.avant.position}" devient "${m.apres.position}". ` +
            `Le raccourci \`background\` a réinitialisé background-position.`
          );

          assert.equal(
            m.apres.repetition, m.avant.repetition,
            `${p.nom} : la flèche se répète au survol — ` +
            `"${m.avant.repetition}" devient "${m.apres.repetition}". ` +
            `Elle seRepeint alors sur toute la pastille.`
          );

          assert.notEqual(
            m.apres.image, 'none',
            `${p.nom} : la flèche a disparu au survol`
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

test('A07 — le survol de la pastille éclaire la surface, il ne la colore pas', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const p of PAGES) {
      for (const theme of ['jour', 'nuit']) {
        await t.test(`${p.nom} / ${theme}`, async () => {
          const options = theme === 'nuit' ? { theme: 'nuit' } : {};
          const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau, options);
          try {
            await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
            await aide.attendre(page, 1600);

            const m = await mesurerSurvol(page, p.selecteur);
            assert.ok(m, `la pastille ${p.selecteur} est introuvable`);

            const rgb = (s) => {
              const t = /rgba?\(([^)]+)\)/.exec(s || '');
              if (!t) return null;
              const p = t[1].split(',').map((x) => parseFloat(x));
              return { r: p[0], g: p[1], b: p[2] };
            };

            const repos = rgb(m.avant.fond);
            const survol = rgb(m.apres.fond);
            assert.ok(repos && survol, `les fonds ne sont pas lisibles : ${m.avant.fond} / ${m.apres.fond}`);

            assert.notEqual(
              m.apres.fond, m.avant.fond,
              `${p.nom} / ${theme} : le fond de la pastille ne change pas au survol`
            );

            /* Un survol d'une surface s'éclaircit : les trois composantes
               montent, ou descendent ensemble si le fond est clair. */
            const monte = survol.r > repos.r && survol.g > repos.g && survol.b > repos.b;
            const descend = survol.r < repos.r && survol.g < repos.g && survol.b < repos.b;
            assert.ok(
              monte || descend,
              `${p.nom} / ${theme} : le fond change de nature au survol — ` +
              `${m.avant.fond} devient ${m.apres.fond}. ` +
              `Un aplat saturé sur un fond sombre se lit « ça s'allume », ` +
              `pas « ça se détend ».`
            );

            /* Le survol ne doit pas non plus laisser la pastille sans
               signal : le fond change, mais l'ombre doit le detacher. */
            assert.notEqual(
              m.apres.ombre, 'none',
              `${p.nom} / ${theme} : la pastille n'a aucune ombre au survol — ` +
              `sur un fond sombre, l'éclaircissement seul ne suffit pas à détacher l'élément`
            );
          } finally {
            await ctx.close();
          }
        });
      }
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});

test('A07 — le trait de la flèche est lisible sur le fond de la pastille', async (t) => {
  await aide.demarrerServeur();
  const nav = await aide.demarrerNavigateur();

  try {
    for (const p of PAGES) {
      for (const theme of ['jour', 'nuit']) {
        await t.test(`${p.nom} / ${theme}`, async () => {
          const options = theme === 'nuit' ? { theme: 'nuit' } : {};
          const { ctx, page } = await aide.ouvrirPage(aide.FORMATS.bureau, options);
          try {
            await page.goto(aide.BASE + p.url, { waitUntil: 'domcontentloaded' });
            await aide.attendre(page, 1600);

            /* Le trait de la flèche est porte par l'URI de l'image. On
               en extrait la couleur, et on la mesure sur le fond de la
               pastille. */
            const mesure = await page.evaluate((c) => {
              const el = document.querySelector(c);
              const st = getComputedStyle(el);
              const m = /stroke='%23([0-9a-f]{6})'/i.exec(st.backgroundImage || '');
              return {
                trait: m ? '#' + m[1].toLowerCase() : null,
                fond: st.backgroundColor,
              };
            }, p.selecteur);

            assert.ok(
              mesure.trait,
              `${p.nom} / ${theme} : impossible de lire la couleur du trait de la flèche`
            );

            const lum = (hex) => {
              const v = [1, 3, 5].map((i) => parseInt(hex.substr(i, 2), 16) / 255);
              const f = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
              return 0.2126 * f(v[0]) + 0.7152 * f(v[1]) + 0.0722 * f(v[2]);
            };
            const ratio = (a, b) => {
              const la = lum(a), lb = lum(b);
              return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
            };

            const fond = mesure.fond.replace(/rgba?\(([^)]+)\)/, (m0, p) => {
              const c = p.split(',').map((x) => parseInt(x, 10));
              return '#' + c.slice(0, 3).map((x) => x.toString(16).padStart(2, '0')).join('');
            });

            const contraste = ratio(mesure.trait, fond);
            assert.ok(
              contraste >= 3,
              `${p.nom} / ${theme} : le trait de la flèche est à ${contraste.toFixed(2)} ` +
              `sur le fond ${fond} — sous 3, la flèche est presque invisible`
            );
          } finally {
            await ctx.close();
          }
        });
      }
    }
  } finally {
    await aide.arreterNavigateur();
    await aide.arreterServeur();
  }
});
