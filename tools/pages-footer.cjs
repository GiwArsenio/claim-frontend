/* ─────────────────────────────────────────────────────────────────────────────
   GÉNÉRATEUR DES PAGES STATIQUES DU FOOTER

   Les quatre pages (À propos, CGU, Confidentialité, Contact) partagent la
   même charte que le reste du site : jetons du thème, en-tête et pied
   identiques à ceux du board, thème jour/nuit, accessibilité.

   Les écrire à la main ferait quatre fois la même erreur : un jour, l'en-tête
   change sur le board et les quatre pages restent en retard. Ce générateur
   part d'un gabarit unique, où l'en-tête et le pied sont des FONCTIONS du
   contenu. Une modification du gabarit se répercute partout.

   Le contenu est réel : ce sont les règles que le site applique
   effectivement — relevé public, aucune candidature collectée, source
   d'origine pour chaque annonce.

   Usage : node tools/pages-footer.cjs
   ───────────────────────────────────────────────────────────────────────────── */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..');

/* ── L'en-tête, identique sur toutes les pages ────────────────────────────
   Le lien de la page courante porte la classe « on » : c'est lui qui dit à
   l'utilisateur où il se trouve. */
function entete(pageActive) {
  const liens = [
    { href: '/job-board.html', texte: "Offres d'emploi", on: pageActive === 'offres' },
    { href: '/claim-entreprises.html', texte: 'Entreprises', on: pageActive === 'entreprises' },
    { href: '/claim-observatoire.html', texte: "Observatoire de l'assurance", on: pageActive === 'observatoire' },
  ];

  const items = liens.map((l) =>
    `          <a href="${l.href}"${l.on ? ' class="on"' : ''}>${l.texte}</a>`
  ).join('\n');

  return `  <header id="hd">
    <nav>
      <div style="display:flex;align-items:center;gap:2.5rem;">
        <a class="logo" href="/">Claim!</a>
        <div class="nav-links">
${items}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:.75rem;">
        <a class="btn-cta" href="/contact.html">Contactez-nous</a>
        <button class="btn-burger" id="btn-burger" onclick="toggleBurger()" aria-label="Menu" aria-expanded="false" aria-controls="burger-menu">
          <span></span><span></span><span></span>
        </button>
      </div>
    </nav>
  </header>`;
}

/* ── Le pied, identique sur toutes les pages ──────────────────────────────
   Le logo du pied est un LIEN vers l'accueil. C'était un simple texte sur
   certaines pages : le clic ne menait nulle part. */
function pied() {
  return `  <footer id="ft">
    <div class="ft-top">
      <div>
        <a class="ft-logo" href="/">Claim!</a>
        <div class="ft-tagline">pour les actuaires, data scientists &amp; profils IA</div>
      </div>
      <div class="ft-links">
        <a href="/a-propos.html">À propos</a>
        <a href="/cgu.html">CGU</a>
        <a href="/confidentialite.html">Confidentialité</a>
        <a href="/contact.html">Contact</a>
      </div>
    </div>
    <div class="ft-divider"></div>
    <div class="ft-copy">
      <span>© 2026 Claim your job</span>
      <span>·</span>
      <span>Fait avec <span class="heart">♥</span> pour les experts du risque assurantiel</span>
      <span>·</span>
      <span>Logos : <a href="https://hunter.io" rel="noopener" target="_blank">Hunter.io</a></span>
    </div>
  </footer>`;
}

/* ── Le menu mobile ───────────────────────────────────────────────────────
   Le logo du tiroir est un LIEN vers l'accueil, et ferme le tiroir. */
function menuMobile(pageActive) {
  const liens = [
    { href: '/', icone: 'home', texte: 'Accueil', on: pageActive === 'accueil' },
    { href: '/job-board.html', icone: 'work', texte: "Offres d'emploi", on: pageActive === 'offres' },
    { href: '/claim-entreprises.html', icone: 'business', texte: 'Entreprises', on: pageActive === 'entreprises' },
    { href: '/claim-observatoire.html', icone: 'bar_chart', texte: "Observatoire de l'assurance", on: pageActive === 'observatoire' },
  ];

  const items = liens.map((l) =>
    `        <a href="${l.href}"${l.on ? ' class="on"' : ''} onclick="closeBurger()"><span class="ms">${l.icone}</span>${l.texte}</a>`
  ).join('\n');

  return `  <div id="burger-menu">
    <div class="bm-overlay" onclick="closeBurger()"></div>
    <div class="bm-panel">
      <div class="bm-head">
        <a class="bm-logo" href="/" onclick="closeBurger()">Claim!</a>
        <button class="bm-close" onclick="closeBurger()" aria-label="Fermer le menu">
          <span class="ms">close</span>
        </button>
      </div>
      <nav class="bm-nav" aria-label="Navigation principale">
${items}
      </nav>
      <div class="bm-footer">
        <a class="btn-cta" href="/contact.html" onclick="closeBurger()">Contactez-nous</a>
        <div class="bm-mentions">
          <a href="/a-propos.html" onclick="closeBurger()">À propos</a>
          <a href="/cgu.html" onclick="closeBurger()">CGU</a>
          <a href="/confidentialite.html" onclick="closeBurger()">Confidentialité</a>
        </div>
      </div>
    </div>
  </div>`;
}

/* ── La charte commune ────────────────────────────────────────────────────
   Les jetons viennent de /assets/theme.css. On n'en redéfinit aucun : la
   source unique des couleurs reste le thème. */
const CSS_COMMUN = `
  /* ══ CHARTE COMMUNE — en-tête, pied, pages de contenu ══ */
  html, body { margin: 0; }
  body { font-family: 'Inter', system-ui, -apple-system, sans-serif;
         color: var(--encre); background: var(--fond); line-height: 1.65; }

  #hd { background: var(--teal-fond); position: sticky; top: 0; z-index: 200; }
  #hd nav { display: flex; justify-content: space-between; align-items: center; padding: .75rem 2rem; }
  .logo { font-size: 1.5rem; font-weight: 900; color: var(--blanc); letter-spacing: -.05em; text-decoration: none; }
  .logo:hover { color: var(--blanc-survol); }
  .nav-links { display: flex; gap: 2rem; }
  .nav-links a { color: rgba(255, 255, 255, .8); text-decoration: none; font-size: .925rem; font-weight: 600; }
  .nav-links a:hover { color: var(--blanc); }
  .nav-links a.on { color: var(--blanc); border-bottom: 2px solid #fff; padding-bottom: 2px; }
  .nav-links a.on:hover { color: var(--blanc); border-bottom-color: var(--blanc-survol); }
  .btn-cta { background: var(--surface); color: var(--teal); padding: .45rem 1.2rem; border-radius: .5rem;
             font-weight: 700; font-size: .925rem; border: none; cursor: pointer; font-family: inherit;
             white-space: nowrap; text-decoration: none; display: inline-block;
             transition: background .15s, border-color .15s, color .15s; }
  .btn-cta:hover { background: var(--teal-survol-element); border-color: var(--teal); color: var(--encre); }
  .btn-burger { display: none; background: none; border: none; cursor: pointer; padding: .4rem;
                flex-direction: column; gap: 5px; }
  .btn-burger span { display: block; width: 22px; height: 2px; background: var(--blanc); border-radius: 2px; }

  /* ── Pied de page ── */
  #ft { background: var(--teal-fond); color: rgba(255,255,255,.65);
        padding: 1.25rem 1.375rem 1rem; display: flex; flex-direction: column; gap: .75rem;
        border-top: 2px solid rgba(255,255,255,.1); }
  #ft .ft-top { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
  #ft .ft-logo { font-size: 1.1rem; font-weight: 900; color: var(--blanc); letter-spacing: -.05em; text-decoration: none; }
  #ft .ft-logo:hover { color: var(--blanc-survol); }
  #ft .ft-tagline { font-size: 0.7rem; color: rgba(255,255,255,.5); font-style: italic; margin-top: 1px; }
  #ft .ft-links { display: flex; gap: .625rem; flex-wrap: wrap; }
  #ft .ft-links a { color: rgba(255,255,255,.6); text-decoration: none; font-size: 0.7rem; font-weight: 500;
                    padding: .2rem .5rem; border-radius: .25rem; border: 1px solid rgba(255,255,255,.15);
                    transition: background .15s, color .15s; }
  #ft .ft-links a:hover { background: var(--surbrillance); color: var(--blanc); }
  #ft .ft-divider { height: 1px; background: rgba(255,255,255,.1); }
  #ft .ft-copy { font-size: 0.65rem; color: rgba(255,255,255,.35); display: flex; align-items: center; gap: .3rem; flex-wrap: wrap; }
  #ft .ft-copy .heart { color: var(--coeur); font-size: 0.75rem; }
  #ft .ft-copy a { color: rgba(255,255,255,.6); text-decoration: none; }
  #ft .ft-copy a:hover { color: var(--blanc); text-decoration: underline; }

  /* ── Menu mobile ── */
  #burger-menu { display: none; }
  .bm-panel { background: var(--teal-fond); }
  .bm-head { display: flex; align-items: center; justify-content: space-between; padding: 1rem 1.25rem; }
  .bm-logo { font-size: 1.3rem; font-weight: 900; color: var(--blanc); letter-spacing: -.05em; text-decoration: none; }
  .bm-logo:hover { color: var(--blanc-survol); }
  .bm-close { background: none; border: none; color: var(--blanc); cursor: pointer; font-size: 1.4rem; padding: .2rem; }
  .bm-nav { flex: 1; display: flex; flex-direction: column; padding: .75rem 0; gap: .1rem; }
  .bm-nav a { display: flex; align-items: center; gap: .75rem; color: rgba(255, 255, 255, .85);
              padding: .7rem 1.25rem; text-decoration: none; font-weight: 600; }
  .bm-nav a.on { color: var(--blanc); background: var(--surbrillance); }
  .bm-nav a .ms { font-size: 20px; color: rgba(255, 255, 255, .6); }
  .bm-nav a.on .ms { color: rgba(255, 255, 255, .9); }
  .bm-footer { padding: 1rem 1.25rem 1.5rem; border-top: 1px solid rgba(255, 255, 255, .12); }
  .bm-footer .btn-cta { display: flex; width: 100%; justify-content: center; }
  .bm-mentions { display: flex; gap: 1rem; margin-top: 1rem; flex-wrap: wrap; }
  .bm-mentions a { color: rgba(255,255,255,.6); font-size: .75rem; text-decoration: none; }
  .bm-mentions a:hover { color: var(--blanc); text-decoration: underline; }

  /* ── Contenu ── */
  .enveloppe { max-width: 46rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
  .fil { font-size: .8rem; color: var(--gris); margin-bottom: 1.2rem; }
  .fil a { color: var(--gris); text-decoration: none; }
  .fil a:hover { color: var(--teal); text-decoration: underline; }
  h1 { font-size: clamp(1.6rem, 3.5vw, 2.3rem); font-weight: 900; letter-spacing: -.02em;
       line-height: 1.15; margin: 0 0 .5rem; color: var(--encre); }
  .chapo { font-size: 1.05rem; color: var(--gris); margin: 0 0 2rem; line-height: 1.6; }
  h2 { font-size: 1.2rem; font-weight: 800; letter-spacing: -.01em; color: var(--encre);
       margin: 2.2rem 0 .7rem; padding-top: 1.4rem; border-top: 1px solid var(--bord); }
  h3 { font-size: 1rem; font-weight: 800; color: var(--encre); margin: 1.5rem 0 .5rem; }
  p, li { color: var(--gris-texte); font-size: .95rem; }
  p { margin: 0 0 1rem; line-height: 1.7; }
  ul, ol { margin: 0 0 1rem; padding-left: 1.3rem; }
  li { margin-bottom: .45rem; line-height: 1.65; }
  strong { color: var(--encre); }
  a { color: var(--teal); }
  a:hover { color: var(--teal-texte); }
  .encart { background: var(--surface); border: 1px solid var(--bord); border-radius: .75rem;
            padding: 1.1rem 1.25rem; margin: 1.5rem 0; }
  .encart p:last-child { margin-bottom: 0; }
  .encart-titre { font-weight: 800; color: var(--encre); font-size: .95rem; margin: 0 0 .35rem; }
  .carte { background: var(--surface); border: 1px solid var(--bord); border-radius: .75rem;
           padding: 1.25rem 1.4rem; margin: 1.2rem 0; }
  .carte h3 { margin-top: 0; }
  .liste-def { display: grid; gap: .1rem; margin: 0 0 1.2rem; }
  .liste-def div { display: grid; grid-template-columns: 11rem minmax(0,1fr); gap: 1rem;
                   padding: .55rem 0; border-bottom: 1px solid var(--bord); }
  .liste-def dt { font-weight: 700; color: var(--encre); font-size: .9rem; }
  .liste-def dd { margin: 0; color: var(--gris-texte); font-size: .9rem; }
  .bouton { display: inline-block; background: var(--teal-fond); color: var(--blanc);
            padding: .65rem 1.4rem; border-radius: .5rem; font-weight: 700; font-size: .95rem;
            text-decoration: none; border: 1px solid var(--teal-fond);
            transition: background .15s, border-color .15s; }
  .bouton:hover { background: var(--teal-aplat-survol); border-color: var(--teal-aplat-survol); color: var(--blanc); }
  .form-ligne { display: grid; gap: .35rem; margin-bottom: 1rem; }
  .form-ligne label { font-weight: 700; color: var(--encre); font-size: .9rem; }
  .form-ligne input, .form-ligne textarea { font: inherit; font-size: .95rem; padding: .65rem .8rem;
    border: 1px solid var(--bord-fort); border-radius: .5rem; background: var(--surface); color: var(--encre); }
  .form-ligne input:focus-visible, .form-ligne textarea:focus-visible { outline: 2px solid var(--teal); outline-offset: 1px; }
  .form-ligne textarea { min-height: 9rem; resize: vertical; }
  .aide { font-size: .85rem; color: var(--gris-doux); margin: -.5rem 0 1rem; }

  @media (max-width: 768px) {
    #hd nav { padding: .6rem 1rem; }
    .nav-links, .btn-cta { display: none; }
    .btn-burger { display: flex; }
    #burger-menu { display: block; position: fixed; inset: 0; z-index: 300; pointer-events: none; }
    #burger-menu.open { pointer-events: all; }
    .bm-overlay { position: absolute; inset: 0; background: rgba(0,0,0,.5); opacity: 0; transition: opacity .2s; }
    #burger-menu.open .bm-overlay { opacity: 1; }
    .bm-panel { position: absolute; top: 0; right: 0; bottom: 0; width: min(20rem, 86vw);
                display: flex; flex-direction: column; transform: translateX(100%);
                transition: transform .25s cubic-bezier(.4,0,.2,1); }
    #burger-menu.open .bm-panel { transform: translateX(0); }
    .enveloppe { padding: 1.75rem 1.1rem 3rem; }
    .liste-def div { grid-template-columns: 1fr; gap: .15rem; }
    h2 { margin-top: 1.8rem; }
  }`;

/* ── Le script commun ─────────────────────────────────────────────────────
   Un seul script pour les quatre pages : le menu mobile, et le thème. */
const SCRIPT_COMMUN = `
function toggleBurger() {
  var m = document.getElementById('burger-menu');
  var b = document.getElementById('btn-burger');
  if (!m) return;
  var ouvert = m.classList.toggle('open');
  if (b) b.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
  document.body.style.overflow = ouvert ? 'hidden' : '';
}
function closeBurger() {
  var m = document.getElementById('burger-menu');
  var b = document.getElementById('btn-burger');
  if (m) m.classList.remove('open');
  if (b) b.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
}
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') closeBurger();
});`;

/* ── L'assemblage d'une page ─────────────────────────────────────────────── */
function construire({ slug, titre, description, pageActive, corps }) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titre} | Claim!</title>
<meta name="description" content="${description}">
<link rel="canonical" href="https://claimyourjob.fr/${slug}">
<meta property="og:title" content="${titre} | Claim!">
<meta property="og:description" content="${description}">
<meta property="og:type" content="website">
<meta property="og:url" content="https://claimyourjob.fr/${slug}">
<meta property="og:image" content="https://claimyourjob.fr/assets/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/favicon.png">
<link rel="apple-touch-icon" href="/assets/apple-touch-icon.png">
<style>
${CSS_COMMUN}
</style>
<link rel="stylesheet" href="/assets/theme.css">
<script>(function(){try{var t=localStorage.getItem('claim-theme');if(t==='nuit'||(!t&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.setAttribute('data-theme','nuit');}}catch(e){}})();</script>
<script src="/assets/theme.js" defer></script>
</head>
<body>
${entete(pageActive)}
<main class="enveloppe">
${corps}
</main>
${pied()}
${menuMobile(pageActive)}
<script>
${SCRIPT_COMMUN}
</script>
</body>
</html>
`;
}

/* ── Les contenus ──────────────────────────────────────────────────────────
   Écris à partir des règles que le site applique effectivement. Aucune
   invention : chaque affirmation est vérifiable sur le site. */
const PAGES = [
  {
    slug: 'a-propos.html',
    titre: 'À propos',
    description: "Claim! relève les offres d'emploi en actuariat et IA dans le secteur assurantiel, et renvoie chaque annonce à sa source d'origine.",
    pageActive: 'propos',
    corps: `  <nav class="fil" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › À propos</nav>

  <h1>À propos de Claim!</h1>
  <p class="chapo">Claim! est un relevé d'offres d'emploi, pas un forum d'emploi. Chaque annonce
     est relevée sur le site carrière de l'employeur ou sur la plateforme qui la publie, et
     chaque fiche renvoie à l'annonce d'origine.</p>

  <h2>Ce que fait Claim!</h2>
  <p>Le service relève quotidiennement les offres publiées par les employeurs du secteur
     assurantiel — assureurs, mutuelles, réassureurs, courtiers et cabinets de conseil
     actuariel — sur leurs sites carrières et sur les plateformes de recrutement qu'ils
     utilisent. Les annonces sont classées par spécialité, par contrat et par niveau
     d'expérience, et le relevé est consultable librement.</p>

  <h2>Ce que Claim! ne fait pas</h2>
  <div class="encart">
    <p class="encart-titre">Aucune candidature ne transite par ce site.</p>
    <p>Le bouton « Postuler » d'une fiche d'offre ouvre l'annonce publiée par l'employeur.
       Claim! ne reçoit pas de candidature, ne conserve aucune donnée de candidat et ne
       propose aucun parcours de candidature. C'est une règle du site, pas une promesse.</p>
  </div>
  <ul>
    <li><strong>Aucune candidature n'est collectée.</strong> Claim! ne propose ni formulaire
        de candidature, ni espace candidat, ni suivi de candidature.</li>
    <li><strong>Aucune donnée personnelle n'est stockée</strong> relative aux personnes qui
        consultent le site.</li>
    <li><strong>Chaque annonce renvoie à sa source.</strong> Le lien « l'annonce d'origine »
        mène à la page publiée par l'employeur, sur le site qui l'a produite.</li>
  </ul>

  <h2>Les sources</h2>
  <p>Le relevé agrège les sites carrières des employeurs et les plateformes de recrutement
     qu'ils utilisent. Certains logos d'employeurs proviennent de
     <a href="https://hunter.io" rel="noopener" target="_blank">Hunter.io</a>, dont l'usage
     gratuit est conditionné à la mention d'un lien de retour — il figure en bas des fiches
     concernées.</p>

  <h2>Comment corriger une fiche</h2>
  <p>Une offre mal relevée, une entreprise manquante, un lien périmé : signalez-le. Le relevé
     est refait chaque jour, et une correction est en ligne au cycle suivant.</p>
  <p><a class="bouton" href="/contact.html">Signaler une correction</a></p>

  <h2>Le nom</h2>
  <p>Claim! se lit « Claim your job » : prendre sa chance, en langage du recrutement. Le
     service s'adresse à celles et ceux qui cherchent dans le secteur du risque : actuaires,
     data scientists, profils IA — et à ceux qui les embauchent.</p>`,
  },

  {
    slug: 'cgu.html',
    titre: "Conditions générales d'utilisation",
    description: "Conditions générales d'utilisation de Claim! : usage du service, responsabilité sur les annonces, propriété intellectuelle et contact.",
    pageActive: 'cgu',
    corps: `  <nav class="fil" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › CGU</nav>

  <h1>Conditions générales d'utilisation</h1>
  <p class="chapo">Les règles qui s'appliquent à l'usage de claimyourjob.fr. Date de dernière
     mise à jour : 23 octobre 2026.</p>

  <h2>Article 1 — Objet du service</h2>
  <p>Claim! est un service gratuit de relevé et de consultation d'offres d'emploi. Il rend
     accessible une liste d'offres publiées dans le secteur de l'assurance et des services
     actuariels, en les organisant par spécialité, par contrat et par expérience.</p>
  <p>Le service est un <strong>outil de veille et de découverte</strong>. Il ne constitue ni
     une agence de recrutement, ni une plateforme de recrutement, ni un intermédiaire entre
     l'employeur et le candidat.</p>

  <h2>Article 2 — Accès au service</h2>
  <p>Le service est accessible librement, sans création de compte et sans abonnement. Aucun
     identifiant, aucun mot de passe, aucune coordonnée personnelle ne sont demandés pour
     consulter le relevé.</p>

  <h2>Article 3 — Contenu du service</h2>
  <p>Les offres publiées sur le service sont <strong>relevées auprès de leur source</strong>.
     Elles sont reproduites dans un but d'information. Chaque fiche renvoie à l'annonce
     d'origine : la version faisant foi est celle publiée par l'employeur, sur le site qui
     l'a produite.</p>
  <ul>
    <li>Le relevé est automatique et quotidien. Une offre peut donc être retirée, modifiée
        ou expirée entre deux passages.</li>
    <li>Les informations affichées (poste, lieu, contrat, rémunération, description) sont
        celles du relevé. Elles peuvent être incomplètes ou en retard sur la source.</li>
    <li>Les logos d'employeurs proviennent, selon les cas, du site de l'employeur ou de
        <a href="https://hunter.io" rel="noopener" target="_blank">Hunter.io</a>.</li>
  </ul>

  <h2>Article 4 — Candidature</h2>
  <div class="encart">
    <p class="encart-titre">La candidature se fait chez l'employeur, jamais ici.</p>
    <p>Le service ne collecte aucune candidature et ne reçoit aucune donnée de candidat. Un
       clic sur « Postuler » ouvre l'annonce d'origine : Le candidat postule
       directement à l'employeur, sur les modalités et les données que l'employeur lui-même définit.</p>
  </div>
  <p>Claim! n'est partie à aucune étape de la relation d'emploi. Les questions relatives à
     une candidature, à un contrat ou à une rémunération se posent à l'employeur, dont les
     coordonnées figurent sur l'annonce d'origine.</p>

  <h2>Article 5 — Responsabilité</h2>
  <p>Claim! s'efforce de relever fidèlement les annonces. Toutefois, le service est fourni
     « en l'état », sans garantie d'exhaustivité, d'exactitude ou de disponibilité. L
     conséquence d'une erreur de relevé — une offre retirée à tort, une rémunération
     erronée — relève de l'utilisateur.</p>
  <p>Claim! ne peut être tenu responsable du contenu des annonces, qui est publié par les
     employeurs et les plateformes, ni des relations contractuelles nouées entre un employeur
     et un candidat à la suite d'une candidature passée par l'annonce d'origine.</p>

  <h2>Article 6 — Mesure d'audience</h2>
  <p>Le service mesure sa fréquentation, pour mesurer ce qui est utile et corriger ce qui ne
     l'est pas. Cette mesure repose sur Google Analytics. Aucun bandeau de consentement
     n'est déposé avant le chargement du script de mesure : le consentement est demandé
     avant, et le refus est aussi simple que l'acceptation.</p>

  <h2>Article 7 — Propriété intellectuelle</h2>
  <p>La structure du service, son code et son identité visuelle appartiennent à Claim!.
     Les contenus affichés — intitulés de poste, descriptions, logos — appartiennent à leurs
     auteurs : les employeurs et les plateformes qui les publient. Le service les reproduit
     pour permettre de renvoyer à leur source.</p>

  <h2>Article 8 — Modification des conditions</h2>
  <p>Ces conditions peuvent être modifiées. La date de dernière mise à jour figure en tête
     de page. L'usage continu du service vaut acceptation de la version en vigueur.</p>

  <h2>Article 9 — Contact</h2>
  <p>Pour toute question relative à ces conditions, à une annonce ou à un relevé :
     <a href="/contact.html">la page de contact</a>.</p>`,
  },

  {
    slug: 'confidentialite.html',
    titre: 'Confidentialité',
    description: "Politique de confidentialité de Claim! : données mesurées, cookies, mesure d'audience, durée de conservation et droits des personnes.",
    pageActive: 'confidentialite',
    corps: `  <nav class="fil" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › Confidentialité</nav>

  <h1>Politique de confidentialité</h1>
  <p class="chapo">Ce que Claim! collecte, pourquoi, et pendant combien de temps. Date de
     dernière mise à jour : 23 octobre 2026.</p>

  <h2>1 — Responsable de traitement</h2>
  <dl class="liste-def">
    <div><dt>Éditeur</dt><dd>Claim! — claimyourjob.fr</dd></div>
    <div><dt>Contact</dt><dd><a href="/contact.html">contact@claimyourjob.fr</a></dd></div>
    <div><dt>Territoire</dt><dd>France</dd></div>
  </dl>

  <h2>2 — Ce que le service ne collecte pas</h2>
  <div class="encart">
    <p class="encart-titre">Aucune donnée de candidat. Aucune candidature.</p>
    <p>Le service ne demande ni compte, ni adresse électronique, ni nom, ni aucune
       coordonnée pour être consulté. Il ne reçoit aucune candidature : la candidature se
       fait sur le site de l'employeur. Aucune donnée relative aux personnes qui
       consultent le service n'est collectée à des fins de candidature ou de prospection.</p>
  </div>

  <h2>3 — Données mesurées</h2>
  <p>Le service mesure sa fréquentation avec Google Analytics. Cette mesure sert à savoir
     quelles pages sont consultées et à corriger ce qui ne l'est pas. Elle porte sur des
     données techniques, transmises par le navigateur :</p>
  <ul>
    <li>adresse IP, tronquée par le service de mesure ;</li>
    <li>type de navigateur et de système d'exploitation ;</li>
    <li>pages consultées et durée de consultation ;</li>
    <li>référent, c'est-à-dire la page d'arrivée.</li>
  </ul>
  <p>Ces données ne sont pas utilisées pour établir un profil, ni pour prospecter, ni pour
     contacted les personnes qui consultent le site.</p>

  <h2>4 — Bandeau de consentement</h2>
  <p>Avant tout chargement du script de mesure, un bandeau demande l'accord. L'acceptation
     et le refus ont la même hauteur, le même poids typographique et la même facilité :
     c'est la recommandation de la CNIL. Tant qu'aucun choix n'est exprimé, aucune mesure
     n'est effectuée.</p>
  <p>Le choix est mémorisé dans le stockage local du navigateur. Il peut être modifié à
     tout moment en effaçant les données de site de votre navigateur.</p>

  <h2>5 — Adresse électronique</h2>
  <p>L'adresse <a href="mailto:contact@claimyourjob.fr">contact@claimyourjob.fr</a> n'est
     utilisée que pour répondre aux messages envoyés. Elle n'est ni vendue, ni échangée, ni
     utilisée à des fins d'envoi d'offres ou de prospection. Les messages reçus sont
     conservés le temps nécessaire au traitement de la demande.</p>

  <h2>6 — Témoins de connexion (cookies)</h2>
  <p>Le service utilise un témoin de connexion pour la mesure d'audience, déposé seulement
     après accord. Aucun témoin publicitaire, de reciblage ou de réseau social n'est déposé.
     Aucun service tiers de suivi n'est appelé.</p>

  <h2>7 — Durée de conservation</h2>
  <ul>
    <li><strong>Mesure d'audience :</strong> quatorze mois par défaut, puis anonymisation.</li>
    <li><strong>Préférence de thème :</strong> conservée dans le stockage local du navigateur,
        jusqu'à l'effacement des données de site.</li>
    <li><strong>Choix de consentement :</strong> conservé de la même manière, pour ne pas
        redemander à chaque visite.</li>
    <li><strong>Messages reçus :</strong> conservés le temps du traitement de la demande, puis
        supprimés.</li>
  </ul>

  <h2>8 — Vos droits</h2>
  <p>Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation et
     d'opposition, ainsi que du droit à la portabilité de vos données. Ces droits s'exercent
     par courriel à <a href="mailto:contact@claimyourjob.fr">contact@claimyourjob.fr</a>. Une
     réponse est apportée dans un délai d'un mois.</p>
  <p>En cas de réponse insatisfaisante, il est possible d'introduire une réclamation auprès de
     la CNIL.</p>

  <h2>9 — Hébergement</h2>
  <p>Le site est hébergé au sein de l'Union européenne. Les données de mesure d'audience sont
     traitées par Google, également au sein de l'Union européenne.</p>

  <h2>10 — Modification</h2>
  <p>Cette politique peut être mise à jour. La date de dernière mise à jour figure en tête
     de page.</p>`,
  },

  {
    slug: 'contact.html',
    titre: 'Contact',
    description: "Écrire à l'équipe de Claim! : signaler une offre manquante, une annonce erronée, demander la suppression d'une fiche, ou poser une question.",
    pageActive: 'contact',
    corps: `  <nav class="fil" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › Contact</nav>

  <h1>Contact</h1>
  <p class="chapo">Une offre manque ? Une annonce est erronée ? Une page doit être retirée ?
     Écrivez-nous. Le relevé est refait chaque jour.</p>

  <h2>Écrire directement</h2>
  <p><a class="bouton" href="mailto:contact@claimyourjob.fr">contact@claimyourjob.fr</a></p>
  <p>Le plus simple, et le plus rapide. Précisez l'employeur et l'intitulé du poste si votre
     message porte sur une offre en particulier.</p>

  <h2>Ce que nous traitons le plus souvent</h2>
  <div class="carte">
    <h3>Une entreprise ne figure pas dans le relevé</h3>
    <p>Indiquez son nom et, si vous l'avez, le lien de sa page carrières. Nous ajoutons la
       source au relevé.</p>
  </div>
  <div class="carte">
    <h3>Une offre est périmée, ou le lien de candidature est mort</h3>
    <p>Le lien de l'annonce d'origine suffit. Nous corrigeons au cycle suivant.</p>
  </div>
  <div class="carte">
    <h3>Une fiche doit être retirée</h3>
    <p>Un employeur, ou une personne, peut demander le retrait d'une fiche. Nous
       procédons au retrait.</p>
  </div>
  <div class="carte">
    <h3>Une question sur le service, les données ou les CGU</h3>
    <p>Les <a href="/confidentialite.html">données collectées</a> et les
       <a href="/cgu.html">conditions d'utilisation</a> répondent à la plupart des questions.
       Pour le reste, écrivez-nous.</p>
  </div>

  <h2>Le formulaire</h2>
  <p>Le formulaire ci-dessous ouvre votre logiciel de messagerie avec le message prérempli.
     Il n'envoie rien à un serveur : le message part de votre boîte, ce qui évite qu'il
     transite par un intermédiaire.</p>
  <form action="mailto:contact@claimyourjob.fr" method="post" enctype="text/plain">
    <div class="form-ligne">
      <label for="c-nom">Votre nom</label>
      <input id="c-nom" name="nom" type="text" autocomplete="name">
    </div>
    <div class="form-ligne">
      <label for="c-sujet">Sujet</label>
      <input id="c-sujet" name="sujet" type="text">
    </div>
    <div class="form-ligne">
      <label for="c-message">Message</label>
      <textarea id="c-message" name="message" required></textarea>
    </div>
    <p class="aide">Les champs marqués d'un astérisque sont facultatifs : un message sans
       nom reste traité.</p>
    <button class="bouton" type="submit">Envoyer le message</button>
  </form>

  <h2>Délai de réponse</h2>
  <p>Le relevé étant refait chaque jour, une correction d'annonce est en ligne en général le
     lendemain. Les demandes de retrait sont traitées en priorité.</p>`,
  },
];

/* ── Écriture ────────────────────────────────────────────────────────────── */
let ecrits = 0;
for (const page of PAGES) {
  const html = construire(page);
  const chemin = path.join(RACINE, page.slug);
  fs.writeFileSync(chemin, html, 'utf8');
  console.log('  écrit  ' + page.slug + '  (' + html.length + ' octets)');
  ecrits++;
}
console.log(`${ecrits} page(s) écrite(s).`);
