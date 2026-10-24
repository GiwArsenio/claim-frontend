/* ─────────────────────────────────────────────────────────────────────────────
   LE PIED PRÉCÉDENT — HTML et CSS

   La version précédente du pied est celle de l'accueil d'avant
   l'unification : un pied CLAIR, sur le fond de surface, en deux colonnes —
   l'identité et la navigation d'un côté, le texte de mentions de l'autre.

   Ce module est la RÉFÉRENCE du pied. Toutes les pages le portent, à
   l'identique.

   Il faut le HTML ET le CSS : sur six des huit pages, les règles
   n'existaient pas du tout. Seul l'accueil les avait, parce que c'est
   là que le pied avait été écrit.

   Usage : node tools/restaurer-pied.cjs
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');

/* ── Le HTML ──────────────────────────────────────────────────────────────
   Les trois liens de navigation du site, puis le texte de mentions. */
const PIED = `<footer class="pied">
  <div class="env">
    <div class="haut">
      <div>
        <a class="logo" href="/">Claim!</a>
        <div class="nav2">
          <a href="/job-board.html">Offres d'emploi</a>
          <a href="/claim-entreprises.html">Entreprises</a>
          <a href="/claim-observatoire.html">Observatoire de l'assurance</a>
        </div>
      </div>
      <p class="mentions">
        Les offres sont relevées sur les sites carrières des employeurs et les plateformes de recrutement ;
        chaque annonce renvoie à sa source d'origine. Claim! ne collecte aucune candidature et ne stocke
        aucune donnée de candidat. Les logos des employeurs proviennent, selon les cas,
        de leur site ou de <a href="https://hunter.io" rel="noopener" target="_blank">Hunter.io</a>.
      </p>
    </div>
  </div>
</footer>`;

/* ── Le CSS ───────────────────────────────────────────────────────────────
   Repris tel quel de la version précédente. Le logo du pied est sur fond
   clair : son survol l'assombrit, alors que la règle générale
   `.logo:hover` l'éclaircit — celle-ci vaut pour l'en-tête, où le logo est
   blanc sur aplat de marque. Ici, c'est l'inverse. */
const CSS_PIED = `
  /* ══ LE PIED PRÉCÉDENT — référence ══
     Un pied clair, sur le fond de surface, en deux colonnes : l'identité
     et la navigation d'un côté, le texte de mentions de l'autre. Le texte
     de mentions tient dans une colonne courte — un texte qui traverse
     l'écran ne se lit pas.

     Ce bloc est posé en fin de feuille : plus spécifique que les règles
     du milieu de la page, il ne peut pas être annulé, et identique sur
     les huit pages, il garantit que le pied se ressemble exactement. */
  .pied { background: var(--surface); border-top: 1px solid var(--bord);
          padding: 1.1rem 0 .95rem;
          /* La PILE de polices est posee ici. La deuxieme colonne du pied
             se mesure en 44ch : le ch depend de la police du conteneur.
             Les pages n'avaient pas la meme pile — le board tombait sur
             'Inter', sans-serif, l'accueil sur 'Inter', system-ui, ... —
             et la colonne de mentions mesurait 332 px sur l'un, 448 px sur
             l'autre. Le pied pose sa pile, comme il pose sa largeur. */
          font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
          /* La TAILLE et l'INTERLIGNE sont poses ici, comme la pile.
             La deuxieme colonne se mesure en 44ch : le ch depend de la
             police ET de la taille du conteneur. Les pages n'avaient pas
             les memes : le pied mesurait 127 px sur Entreprises et 150 px
             sur l'accueil, et la colonne de mentions 380 px sur le board
             et 448 px sur l'accueil. Le pied pose les trois, et ne
             depend plus du reste de la page. */
          font-size: 1rem; line-height: 1.65; }
  /* box-sizing: border-box, comme sur l'accueil. Sans lui, le padding
     s'AJOUTE a la largeur : le pied avait 1000 px de contenu au lieu de
     936, et ses deux colonnes ne s'alignaient pas sur la reference. */
  .pied .env { max-width: 1000px; margin: 0 auto; padding: 0 2rem;
                box-sizing: border-box; }
  .pied .haut { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 44ch);
                gap: 2.5rem; align-items: start; }
  .pied .logo { color: var(--encre); font-size: 1.25rem; font-weight: 900;
                letter-spacing: -.05em; text-decoration: none; }
  .pied .logo:hover { color: var(--teal); }
  .pied .nav2 { display: flex; gap: 1.75rem; flex-wrap: wrap; margin-top: .55rem; }
  .pied a { color: var(--gris); text-decoration: none; font-size: .88rem; font-weight: 600;
            transition: color .15s ease; }
  .pied a:hover { color: var(--teal); }
  .pied .nav2 a { position: relative; }
  .pied .nav2 a::after { content: ''; position: absolute; left: 0; right: 0; bottom: -3px;
                         height: 1.5px; border-radius: 2px; background: var(--teal);
                         transform: scaleX(0); transform-origin: left;
                         transition: transform .18s ease; }
  .pied .nav2 a:hover::after { transform: scaleX(1); }
  .pied .mentions { margin: 0; font-size: .78rem; line-height: 1.45; color: var(--gris-doux); }
  .pied .mentions a { color: var(--gris); text-decoration: underline;
                      text-decoration-thickness: 1px; text-underline-offset: 2px; }

  @media (max-width: 900px) {
    .pied .env { padding: 0 1.25rem; }
    .pied .haut { grid-template-columns: 1fr; gap: 1.5rem; }
  }`;

const PAGES = [
  'index.html',
  'job-board.html',
  'claim-entreprises.html',
  'claim-observatoire.html',
  'a-propos.html',
  'cgu.html',
  'confidentialite.html',
  'contact.html',
];

const MARQUEUR = '  /* ══ LE PIED PRÉCÉDENT — référence ══';

for (const fichier of PAGES) {
  const chemin = path.join(RACINE, fichier);
  let s = fs.readFileSync(chemin, 'utf8');
  console.log('\n── ' + fichier + ' ──');

  /* 1. Le HTML du pied. */
  const debut = s.indexOf('<footer id="ft">');
  if (debut !== -1) {
    const fin = s.indexOf('</footer>', debut) + '</footer>'.length;
    s = s.slice(0, debut) + PIED + s.slice(fin);
    console.log('  pied restauré (HTML)');
  } else if (s.includes('<footer class="pied">')) {
    console.log('  pied déjà dans la version précédente');
  } else {
    console.log('  pied INTROUVABLE');
    continue;
  }

  /* 2. Le CSS, pose en fin de feuille. On retire l'ancien bloc du
     référentiel, qui portait le pied navy : il ne sert plus. */
  const debutRef = s.indexOf('  /* ══ RÉFÉRENTIEL');
  if (debutRef !== -1) {
    const finRef = s.indexOf('</style>', debutRef);
    const bloc = s.slice(debutRef, finRef);
    const debutFt = bloc.indexOf('  /* ── Pied (référence : le board)');
    const finFt = bloc.indexOf('  @media (max-width: 768px) {');
    if (debutFt !== -1 && finFt !== -1 && finFt > debutFt) {
      s = s.slice(0, debutRef) + bloc.slice(0, debutFt) + bloc.slice(finFt) + s.slice(finRef);
      console.log('  CSS du pied navy retiré du référentiel');
    }
  }

  /* 3. Le bloc CSS du pied précédent : il est posé en dernier, et il
        remplace celui qui pouvait déjà s'y trouver. */
  const debutPied = s.indexOf(MARQUEUR);
  if (debutPied !== -1) {
    const finPied = s.indexOf('</style>', debutPied);
    s = s.slice(0, debutPied) + CSS_PIED + '\n' + s.slice(finPied);
    console.log('  CSS du pied précédent mis à jour');
  } else {
    const dernierStyle = s.lastIndexOf('</style>');
    if (dernierStyle !== -1) {
      s = s.slice(0, dernierStyle) + CSS_PIED + '\n' + s.slice(dernierStyle);
      console.log('  CSS du pied précédent posé');
    }
  }

  fs.writeFileSync(chemin, s, 'utf8');
}

console.log('\nTerminé.');
