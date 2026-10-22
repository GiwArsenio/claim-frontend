// api/offre.js — Page d'une offre, rendue côté serveur.
// Adresse publique : /offre/{slug} (voir vercel.json).
//
// Rôle : donner à chaque offre une adresse réelle, avec son contenu, ses
// balises et son balisage JobPosting. Sans cela, les offres n'existent pas
// pour un moteur de recherche : le job board les affiche en JavaScript, sans
// que l'adresse change.
//
// Aucune donnée n'est inventée : tout vient de l'API. Les champs absents sont
// omis plutôt que comblés.

const API_BASE = process.env.API_URL || 'https://claim-api-production-06b3.up.railway.app/api/v1';
const SITE_URL = process.env.SITE_URL || 'https://claimyourjob.fr';

// Profils d'entreprise : présentation, avantages, liens sociaux. Même source
// que le job board. La page ne doit pas tomber si ce fichier manque au
// déploiement : sans lui, la page se lit avec ce que l'API publie.
let ANNUAIRE = null;
try {
  ANNUAIRE = require('../assets/companies-data.js');
} catch (erreur) {
  console.error('[offre] annuaire des entreprises indisponible :', erreur.message);
}

const LABELS_CONTRAT = {
  cdi: 'CDI', cdd: 'CDD', alternance: 'Alternance', stage: 'Stage',
  freelance: 'Freelance', interim: 'Intérim', vie: 'V.I.E', autre: 'Non précisé',
};

// Vocabulaire attendu par les moteurs de recherche.
const TYPES_EMPLOI = {
  cdi: 'FULL_TIME', cdd: 'TEMPORARY', stage: 'INTERN',
  alternance: 'OTHER', freelance: 'CONTRACTOR', interim: 'TEMPORARY', vie: 'OTHER',
};

const LABELS_SPECIALITE = {
  actuariat: 'Actuariat', ia_data: 'IA / Data',
  souscription_technique: 'Souscription technique', autre: 'Autre',
};

const LABELS_EXPERIENCE = { junior: 'Junior', confirmed: 'Confirmé', senior: 'Senior', lead: 'Lead' };

// Durée de validité annoncée à Google pour une offre.
//
// L'API ne publie aucune date d'expiration : le seul repère temporel est la
// date de publication d'origine. Ce n'est donc pas une donnée de la source,
// et c'est nommé comme tel. Sans validThrough, Google ne sait pas quand
// retirer une offre et la laisse en ligne dans Google Jobs bien après sa
// disparition du site.
const DUREE_VALIDITE_JOURS = 90;

function echapper(valeur) {
  return String(valeur == null ? '' : valeur).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function decoderEntites(texte) {
  return String(texte || '')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, x) => String.fromCharCode(parseInt(x, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

function paragraphesDe(description) {
  let texte = decoderEntites(description || '');
  texte = texte.replace(/<\s*\/?\s*(p|div|br|li|tr|h[1-6]|section|article)\b[^>]*>/gi, '\n');
  for (let i = 0; i < 3 && /<\/?[a-z][\s\S]*>/i.test(texte); i += 1) {
    texte = decoderEntites(texte.replace(/<[^>]+>/g, ' '));
  }
  return texte.split(/\n+/).map((p) => p.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function blocSalaire(job) {
  if (!job.jev_publishable || job.jev_publishable.salaire !== true) return null;
  const bas = Number(job.jev_salaire_bas);
  const haut = Number(job.jev_salaire_haut);
  if (!Number.isFinite(bas) && !Number.isFinite(haut)) return null;
  const unite = /mensuel|mois/i.test(job.jev_salaire_periodicite || '') ? 'MONTH' : 'YEAR';
  const valeur = { '@type': 'QuantitativeValue', unitText: unite };
  if (Number.isFinite(bas)) valeur.minValue = bas;
  if (Number.isFinite(haut)) valeur.maxValue = haut;
  return { '@type': 'MonetaryAmount', currency: 'EUR', value: valeur };
}

async function construire(job, urlCanonique) {
  const societe = job.companies || {};
  const nomSociete = societe.name || job.source || '';

  // Identité de l'employeur : la même cascade que sur les cartes — le logo
  // publié par la source, puis la table partagée, puis les initiales sur la
  // teinte de sa fiche. Jamais de trou, et jamais deux rendus différents
  // selon la surface.
  const logoSociete = societe.logo_url
    || (ANNUAIRE && societe.slug ? ANNUAIRE.logoEntreprise(societe.slug) : null);
  // Hunter fournit le logo de certains employeurs : son usage gratuit demande
  // un lien de retour, posé en pied de page — et seulement quand il a servi.
  const logoParHunter = Boolean(logoSociete && logoSociete.indexOf('logos.hunter.io') === 0);
  const initialesSociete = ANNUAIRE ? ANNUAIRE.initiales(nomSociete) : '';
  const teinteSociete = (ANNUAIRE && societe.slug)
    ? ANNUAIRE.couleurEntreprise(societe.slug) : 'var(--teal)';
  const ville = job.ville || job.city || '';
  const contrat = job.contract_type || '';
  const description = job.description_raw || '';
  const sections = Array.isArray(job.sections) ? job.sections : [];

  const premierParagraphe = paragraphesDe(description)[0] || '';
  // La description du document dépend d'un seul champ. Si le corps de
  // l'annonce est vide, la page serait publiée sans aucune meta description :
  // invisible dans les résultats de Google, sans que rien ne se plaigne.
  // Le titre sert de repli — il existe toujours.
  const resume = (premierParagraphe || job.title || '').slice(0, 155).trim();
  const titrePage = ville
    ? `${job.title} — ${nomSociete} (${ville}) | Claim!`
    : `${job.title} — ${nomSociete} | Claim!`;

  const pastilles = [`<span class="pastille pastille-ville">${echapper(ville || 'Lieu non précisé')}</span>`];
  if (contrat) pastilles.push(`<span class="pastille">${echapper(LABELS_CONTRAT[contrat] || contrat)}</span>`);
  if (job.jev_publishable && job.jev_publishable.experience && job.jev_experience) {
    pastilles.push(`<span class="pastille">${echapper(LABELS_EXPERIENCE[job.jev_experience] || job.jev_experience)}</span>`);
  }
  if (job.jev_publishable && job.jev_publishable.salaire && job.jev_salaire_libelle) {
    pastilles.push(`<span class="pastille pastille-salaire">${echapper(job.jev_salaire_libelle)}</span>`);
  }
  if (job.jev_publishable && job.jev_publishable.specialty && job.jev_specialty) {
    pastilles.push(`<span class="pastille pastille-specialite">${echapper(LABELS_SPECIALITE[job.jev_specialty] || job.jev_specialty)}</span>`);
  }

  // Priorité à la structure éditoriale de la source quand elle a été
  // conservée : paragraphes, puces et emphases sont ce que le lecteur attend.
  // Le HTML a été nettoyé à la collecte ; il ne contient que du texte et des
  // balises de lecture.
  const htmlSource = typeof job.description_html === 'string' ? job.description_html.trim() : '';
  const structureSource = htmlSource && /<(p|ul|ol|li|h[2-6]|blockquote)\b/i.test(htmlSource);

  let corps = '';
  if (structureSource) {
    corps = htmlSource;
  } else if (sections.length) {
    corps = sections.map((s) => {
      const paragraphes = (s.paragraphes || []).map((p) => `<p>${echapper(p)}</p>`).join('');
      return `<section class="section"><h2>${echapper(s.titre)}</h2>${paragraphes}</section>`;
    }).join('');
  } else {
    corps = paragraphesDe(description).map((p) => `<p>${echapper(p)}</p>`).join('');
  }

  const offre = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title: job.title,
    description: corps || `<p>${echapper(job.title)}</p>`,
    hiringOrganization: {
      '@type': 'Organization',
      name: nomSociete,
      ...(societe.website_url ? { sameAs: societe.website_url } : {}),
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress', addressCountry: 'FR',
        ...(ville ? { addressLocality: ville } : {}),
      },
    },
    identifier: { '@type': 'PropertyValue', name: 'Claim!', value: job.id },
    directApply: true,
  };
  if ((job.source_published_at || '').length >= 10) {
    offre.datePosted = job.source_published_at.slice(0, 10);
    const fin = new Date(`${offre.datePosted}T00:00:00Z`);
    fin.setUTCDate(fin.getUTCDate() + DUREE_VALIDITE_JOURS);
    offre.validThrough = fin.toISOString().slice(0, 10);
  }
  if (TYPES_EMPLOI[contrat]) offre.employmentType = TYPES_EMPLOI[contrat];
  const salaire = blocSalaire(job);
  if (salaire) offre.baseSalary = salaire;

  // ── Consentement CNIL ──
// Même bandeau que les pages statiques, en copie locale : le gabarit ne
// peut pas lire un fichier au moment de la réponse. En mode dégradé la
// mesure reste active — choix assumé, consigné en documentation.
const BLOC_CONSENTEMENT = `
<!-- ── Consentement CNIL ──
Deux issues, sans SDK ni tiers : rien n'est déposé ni lu depuis un domaine
étranger. L'acceptation et le refus ont même hauteur et même poids — la CNIL
demande que refuser soit aussi simple qu'accepter. En mode dégradé la mesure
reste active : le bandeau informe, il ne bloque rien (choix assumé, consigné
en documentation).
-->
<aside id="claim-consentement" class="consent" role="dialog" aria-live="polite"
       aria-labelledby="consent-titre" aria-describedby="consent-texte" hidden>
  <div class="consent-interieur">
    <div class="consent-corps">
      <span class="consent-sceau" aria-hidden="true"><span class="ms">cookie</span></span>
      <div>
        <p class="consent-titre" id="consent-titre">Mesure d'audience</p>
        <p class="consent-texte" id="consent-texte">Claim! mesure la fréquentation
           du site avec Google Analytics. Aucun cookie publicitaire n'est déposé,
           et aucune donnée n'est partagée avec un tiers.</p>
      </div>
    </div>
    <div class="consent-boutons">
      <button type="button" class="consent-accepter" data-consent="tout">Tout accepter</button>
      <button type="button" class="consent-refuser" data-consent="rien">Refuser</button>
    </div>
  </div>
</aside>

<script>
(function () {
  var CLE = 'claim-consentement';
  var racine = document.getElementById('claim-consentement');
  if (!racine) return;

  function lire() { try { return localStorage.getItem(CLE); } catch (e) { return null; } }
  function ecrire(v) { try { localStorage.setItem(CLE, v); } catch (e) { /* stockage refusé */ } }

  if (lire()) return;             // choix déjà exprimé : le bandeau ne revient pas
  racine.hidden = false;          // aucun traceur tiers : rien à bloquer au chargement

  racine.addEventListener('click', function (e) {
    var bouton = e.target.closest('button[data-consent]');
    if (!bouton) return;
    // Choix enregistré. En mode dégradé la mesure reste active : c'est un
    // choix assumé, pas un oubli.
    ecrire(bouton.getAttribute('data-consent'));
    racine.hidden = true;
    racine.setAttribute('aria-hidden', 'true');
  });
})();
</script>
`;

// Paramètres de mesure, sérialisés dans la page. Même vocabulaire que le
  // board, pour que les deux surfaces se lisent dans les mêmes rapports.
  // item_id et item_name ne sont pas des paramètres ordinaires : ils
  // n'existent que dans le tableau items[] du e-commerce. Au premier
  // niveau, GA4 les ignore en silence — et aucun tableau n'y est accepté
  // en dehors de items[].
  const mesure = {
    items: [{
      item_id:   String(job.id == null ? '' : job.id),
      item_name: job.title || '',
    }],
    company_name:     nomSociete,
    // Même règle que les pastilles : une valeur non publiable n'est jamais
    // transmise. Sans cela, une offre « autre » envoyait job_specialty=autre.
    job_specialty:    (job.jev_publishable || {}).specialty ? job.jev_specialty : '',
    contract_type:    contrat,
    experience_level: (job.jev_publishable || {}).experience ? job.jev_experience : '',
    job_source:       job.source || '',
    view_context:     'standalone',
  };

  // La page ne depend que de sa propre offre : aucun aller-retour vers l'API
  // au-dela de l'annonce elle-meme.

  // Discret par construction : la tuile accompagne le nom de l'entreprise,
  // elle ne dispute pas la vedette au titre. L'initiale reste dessous : elle
  // s'efface dès que l'image est chargée, et reprend la main si elle échoue.
  const tuileSociete = (() => {
    const fond = echapper(teinteSociete);
    const inits = echapper(initialesSociete);
    if (!logoSociete) return `<span class="slogo" style="background:${fond}">${inits}</span>`;
    return `<span class="slogo" style="background:${fond}"><span>${inits}</span>`
      + `<img src="${echapper(logoSociete)}" alt="Logo ${echapper(nomSociete)}" `
      + `onerror="this.remove()" onload="this.previousElementSibling.remove()"/></span>`;
  })();

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(titrePage)}</title>
${resume ? `<meta name="description" content="${echapper(resume)}">` : ''}
<link rel="canonical" href="${echapper(urlCanonique)}">
<link rel="icon" type="image/png" sizes="512x512" href="/assets/favicon.png"/>
<link rel="apple-touch-icon" sizes="180x180" href="/assets/apple-touch-icon.png"/>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap">
<style>.ms{font-family:'Material Symbols Outlined';font-weight:normal;font-style:normal;line-height:1;letter-spacing:normal;text-transform:none;display:inline-block;white-space:nowrap;font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 24;vertical-align:middle;}</style>
<meta property="og:type" content="article">
<meta property="og:title" content="${echapper(job.title + ' — ' + nomSociete)}">
<meta property="og:url" content="${echapper(urlCanonique)}">
${resume ? `<meta property="og:description" content="${echapper(resume)}">` : ''}
${societe.logo_url
  ? `<meta property="og:image" content="${echapper(societe.logo_url)}">`
  : `<meta property="og:image" content="${SITE_URL}/assets/og-image.png">`}
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(offre)}</script>
<style>
 /* Les couleurs viennent de assets/theme.css (source unique). */
 * { box-sizing:border-box; }
 body { margin:0; font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; color:var(--encre); line-height:1.65; }
 .enveloppe { max-width:46rem; margin:0 auto; padding:1.5rem 1.25rem 4rem; }
 .retour { display:inline-block; margin-bottom:1.25rem; color:var(--teal); text-decoration:none; font-weight:600; font-size:.9rem; }
 h1 { font-size:1.6rem; margin:0 0 .4rem; line-height:1.25; }
 .societe { display:flex; align-items:center; gap:.55rem; color:var(--gris); font-size:1rem; font-weight:600; margin-bottom:.9rem; }
 /* Tuile d'identité de l'employeur. Même dessin que les cartes, à l'échelle
    de la page de lecture : elle situe l'entreprise sans concurrencer le titre. */
 .slogo { width:26px; height:26px; border-radius:.375rem; flex-shrink:0; position:relative; overflow:hidden;
   display:inline-flex; align-items:center; justify-content:center; color: var(--blanc); font-weight:900;
   font-size:9px; letter-spacing:-.02em; }
 .slogo img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain;
   border-radius:inherit; padding:2px; }
 .pastilles { display:flex; flex-wrap:wrap; gap:.4rem; margin-bottom:1.6rem; }
/* Pastilles : chaque badge tient sur sa ligne, sans jamais déborder. */
 .pastille { display:inline-block !important; width:fit-content; max-width:100%; padding:3px 10px; border:1px solid var(--bord-carte); border-radius:9999px; background:var(--surface-2); font-size:.78rem; font-weight:600; color:var(--encre-forte); overflow-wrap:anywhere; white-space:normal; line-height:1.4; }
 .pastille-ville { background:var(--teal-clair); border-color:var(--teal-bord); color:var(--teal-texte); }
 .pastille-salaire { background:var(--vert-clair); border-color:var(--vert-bord); color:var(--vert-texte); }
 .pastille-specialite { background:var(--teal-clair); border-color:var(--teal-bord); color:var(--teal-texte); }
 h2 { font-size:1.05rem; margin:1.8rem 0 .5rem; }
 p { margin:0 0 .7rem; color:var(--gris-texte); }
 /* Structure éditoriale venue de la source : listes, emphases, sous-titres. */
 ul, ol { margin:0 0 .9rem; padding-left:1.3rem; color:var(--gris-texte); }
 li { margin:.25rem 0; }
 li > ul, li > ol { margin:.25rem 0 .1rem; }
 strong, b { color:var(--encre); }
 em, i { font-style:italic; }
 h3, h4, h5, h6 { font-size:.98rem; margin:1.2rem 0 .4rem; color:var(--encre); }
 blockquote { margin:0 0 .9rem; padding-left:.8rem; border-left:3px solid var(--teal-bord); color:var(--gris-texte); }
 a { color:var(--teal); }
 .pied { margin-top:2.5rem; padding-top:1.2rem; border-top:1px solid var(--bord); font-size:.85rem; color:var(--gris); }
 .pied a { color:var(--teal); font-weight:600; }

 /* ── La fiche est une carte sur le champ gris ──
    Le volet n'est plus blanc : la fiche se détache, comme sur le board.
    C'est la délimitation du modèle — elle se voit sans qu'on trace un trait. */
 @media (min-width: 769px) {
  body { background: var(--champ); }
  .page { padding: 1.25rem 1.25rem 3rem; }
  .enveloppe {
   background: var(--surface);
   border-radius: .75rem;
   box-shadow: 0 1px 2px rgba(25, 44, 52, .06), 0 4px 14px rgba(25, 44, 52, .05);
  }
 }

 @media (min-width: 1120px) {
  /* Sur cette page, la colonne des offres n'existe pas : rien ne pousse le
     bloc d'un côté, il se centre, et la fiche prend sa largeur haute — la
     même que sur le board : elle doit se lire pareil partout. */
  .page { display: flex; justify-content: center; align-items: flex-start;
   padding-left: 2rem; padding-right: 2rem; }
  .enveloppe { flex-grow: 1; flex-shrink: 1; flex-basis: 46rem; max-width: 842px; }
 }
  /* ── Bandeau de consentement ── */
  /* ── Bandeau de consentement ──
     Deux issues de même rang : l'acceptation éclaire, elle n'écrase pas le
     refus. Couleurs, rayons, ombre et typographie sont ceux du site. */
  .consent {
    position: fixed; inset: auto 0 0 0; z-index: 900;
    background: var(--surface); border-top: 1px solid var(--bord);
    box-shadow: 0 -10px 30px rgba(25, 44, 52, .10);
    padding: 1.15rem 0;
    animation: consent-entree .3s cubic-bezier(.2, .8, .3, 1);
  }
  @keyframes consent-entree { from { transform: translateY(100%); } to { transform: translateY(0); } }
  @media (prefers-reduced-motion: reduce) {
    .consent { animation: none; }
  }
  
  .consent-interieur {
    max-width: 46rem; margin: 0 auto; padding: 0 2rem;
    display: grid; grid-template-columns: minmax(0, 1fr) auto;
    gap: .9rem 1.8rem; align-items: center;
  }
  
  .consent-corps { display: flex; gap: .85rem; align-items: flex-start; min-width: 0; }
  
  /* Le sceau : même teinte que les pastilles du board. */
  .consent-sceau {
    flex: 0 0 auto; width: 38px; height: 38px; border-radius: 50%;
    display: grid; place-items: center;
    background: var(--teal-clair); border: 1px solid var(--teal-bord);
    color: var(--teal);
  }
  .consent-sceau .ms { font-size: 20px; }
  
  .consent-titre {
    margin: 0 0 .1rem; font-size: .95rem; font-weight: 700;
    color: var(--encre); line-height: 1.35; letter-spacing: -.005em;
  }
  .consent-texte {
    margin: 0; font-size: .845rem; color: var(--gris);
    line-height: 1.55; max-width: 48rem;
  }
  
  .consent-boutons { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
  
  .consent button {
    font: inherit; font-size: .845rem; font-weight: 600;
    height: 40px; padding: 0 1.1rem; border-radius: .5rem;
    cursor: pointer; white-space: nowrap;
    transition: background .15s ease, border-color .15s ease, color .15s ease;
  }
  .consent button:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; }
  
  /* Accepter : la couleur de la marque, pleine. */
  .consent-accepter { background: var(--teal); color: var(--blanc); border: 1px solid var(--teal); }
  .consent-accepter:hover { background: var(--teal-fonce); border-color: var(--teal-fonce); }
  
  /* Refuser : même hauteur, même poids typographique, un trait franc — jamais
     grisé, jamais relégué. C'est la recommandation de la CNIL : refuser doit
     être aussi simple qu'accepter. */
  .consent-refuser { background: var(--surface); color: var(--encre); border: 1px solid var(--bord-fort); }
  .consent-refuser:hover { background: var(--champ); border-color: var(--bord-fort); }
  
  @media (max-width: 780px) {
    .consent { padding: .95rem 0; }
    .consent-interieur { grid-template-columns: 1fr; padding: 0 1.1rem; gap: .8rem; }
    .consent-texte { font-size: .82rem; }
    .consent-boutons { display: grid; grid-template-columns: 1fr 1fr; gap: .5rem; }
    .consent button { height: 42px; padding: 0 .75rem; }
  }
</style>
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-SKQQXZW4LH"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-SKQQXZW4LH');
</script>
<script>window.__claimMesure = ${JSON.stringify(mesure).replace(/</g, '\\u003c')};</script>
<link rel="stylesheet" href="/assets/theme.css">
<script>(function(){try{var t=localStorage.getItem('claim-theme');if(t==='nuit'||(!t&&window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.setAttribute('data-theme','nuit');}}catch(e){}})();</script>
<script src="/assets/theme.js" defer></script>
</head>
<body>
${BLOC_CONSENTEMENT}
<div class="page">
<main class="enveloppe">
  <a class="retour" href="/job-board.html">← Toutes les offres</a>
  <h1>${echapper(job.title)}</h1>
  <div class="societe">${tuileSociete}<span>${echapper(nomSociete)}${ville ? ' · ' + echapper(ville) : ''}</span></div>
  <div class="pastilles">${pastilles.join('')}</div>
  ${corps || '<p>Description non disponible.</p>'}
  <div class="pied">
    Offre publiée sur <a href="${SITE_URL}/">Claim!</a>.
    ${logoParHunter ? `Logo : <a href="https://hunter.io" rel="noopener" target="_blank">Hunter.io</a>.` : ''}
    ${job.source_url ? `Source : <a href="${echapper(job.source_url)}" rel="nofollow noopener" target="_blank" data-sortie="annonce">l'annonce d'origine</a>.` : ''}
  </div>
</main>
</div>
<script>
  (function () {
    var d = window.__claimMesure || {};
    if (typeof gtag !== 'function') return;
    var p = {};
    Object.keys(d).forEach(function (k) {
      if (d[k] === '' || d[k] == null) return;
      p[k] = String(d[k]).slice(0, 100);
    });
    // Entrée sur une page d'offre : c'est la consultation.
    gtag('event', 'view_item', p);
    // Le lien vers l'annonce d'origine est la seule sortie de la page. C'est
    // lui qui porte l'intention de candidature — pas une candidature envoyée :
    // Claim! ne voit pas ce qui se passe ensuite chez l'employeur.
    var sortie = document.querySelector('a[data-sortie="annonce"]');
    if (sortie) sortie.addEventListener('click', function () {
      gtag('event', 'job_apply_click', p);
    });
  })();
</script>
</body>
</html>`;
  return { html, resume };
}

const PAGE_ABSENTE = (titre, message) => `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${titre}</title><meta name="robots" content="noindex"><link rel="canonical" href="${SITE_URL}/job-board.html"></head><body style="font-family:system-ui;padding:2rem"><h1>${titre}</h1><p>${message}</p></body></html>`;

module.exports = async (req, res) => {
  const brut = (req.query && req.query.slug) || '';
  let slug = String(brut).trim();
  try { slug = decodeURIComponent(slug); } catch (e) { /* slug mal encodé : on garde tel quel */ }

  if (!slug) {
    res.status(404).send(PAGE_ABSENTE('Offre introuvable', 'Cette adresse ne correspond à aucune offre.'));
    return;
  }

  try {
    const reponse = await fetch(`${API_BASE}/jobs/${encodeURIComponent(slug)}`);
    if (!reponse.ok) {
      // Une offre retirée doit répondre 404 : c'est ce que le sitemap garantit.
      res.status(404).send(PAGE_ABSENTE('Offre introuvable',
        `Cette offre n'est plus en ligne. <a href="${SITE_URL}/job-board.html">Voir les offres actuelles</a>.`));
      return;
    }
    const job = await reponse.json();
    const urlCanonique = `${SITE_URL}/offre/${encodeURIComponent(job.slug || slug)}`;
    const { html } = await construire(job, urlCanonique);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=3600');
    res.status(200).send(html);
  } catch (erreur) {
    // Ne jamais rendre une page vide en silence : une panne doit se voir.
    console.error('[offre] echec pour', slug, erreur);
    res.status(502).send(PAGE_ABSENTE('Service momentanément indisponible',
      `<a href="${SITE_URL}/job-board.html">Retour aux offres</a>`));
  }
};
