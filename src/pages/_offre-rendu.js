// src/pages/_offre-rendu.js — Construction du HTML d'une fiche d'offre.
//
// Le rendu vient de api/offre.js (Vercel), repris tel quel : le Worker
// doit rendre exactement la meme page que la production, au caractere
// pres. Ce fichier ne fait que lbracketing Workers : l'environnement est
// injecte, le HTML est renvoye.
//
// Ce qui change par rapport a la version Vercel :
//   - les URL sont injectees (configurerUrls) au lieu de lues dans
//     process.env ;
//   - l'annuaire des entreprises est importe en ESM (il est CommonJS
//     pour rester partage avec le job board) ;
//   - `construire` est exporte : c'est src/pages/offre.js qui l'appelle.
//
// Toute evolution de api/offre.js doit etre reportee ici. Le script
// scripts/aligner-rendu.py fait ce report et verifie l'alignement.

let API_BASE = 'https://api.claimyourjob.fr/api/v1';
let SITE_URL = 'https://claimyourjob.fr';

export function configurerUrls(apiBase, siteUrl) {
  if (apiBase) API_BASE = apiBase;
  if (siteUrl) SITE_URL = siteUrl;
}

// Profils d'entreprise : présentation, avantages, liens sociaux. Même source
// que le job board. La page ne doit pas tomber si ce fichier manque au
// déploiement : sans lui, la page se lit avec ce que l'API publie.
// L'annuaire des entreprises est un module partage avec le job board. Il
// expose la meme source dans les deux surfaces : le rendu ne peut pas
// diverger entre la carte du board et la fiche lue en direct.
//
// SOURCE UNIQUE. Le fichier est assets/companies-data.js : il est charge
// par le job board dans le navigateur, et importe ici par le Worker. Il
// n'y a pas de copie — une copie divergerait en silence, comme l'a fait
// celle qui precedait ce portage.
import ANNUAIRE_CJS from '../../assets/companies-data.js';
const ANNUAIRE = ANNUAIRE_CJS;

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

export async function construire(job, urlCanonique) {
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
    // Un logo se pose sur fond clair : sur la couleur de la marque, il se
    // fond. La couleur reste pour la tuile des initiales.
    if (!logoSociete) return `<span class="slogo" style="background:${fond}">${inits}</span>`;
    // Un logo a fond sombre n'est pas inverse en mode nuit.
    const inversable = (ANNUAIRE && ANNUAIRE.logoInversable)
      ? ANNUAIRE.logoInversable(societe.slug || '') : true;
    // Ce logo n'existe qu'en version claire : il lui faut son fond.
    const surFondSombre = (ANNUAIRE && ANNUAIRE.logoSurFondSombre)
      ? ANNUAIRE.logoSurFondSombre(societe.slug || '') : false;
    return `<span class="slogo fond-logo${inversable ? ' logo-inversable' : ''}${surFondSombre ? ' logo-fond-sombre' : ''}"><span>${inits}</span>`
      + `<img src="${echapper(logoSociete)}" alt="Logo ${echapper(nomSociete)}" `
      + `onerror="this.remove()" onload="this.previousElementSibling.remove()"/></span>`;
  })();

  const html = `<!DOCTYPE html>
<html lang="fr" style="--plan: var(--champ);">
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
 /* Meme signature que le titre de l'accueil — graisse 900 et
    interlettrage serre — pour que les deux pages se lisent comme la
    meme maison. La taille reste celle d'une page de lecture : un titre
    de poste fait parfois quinze mots, il ne peut pas prendre l'echelle
    d'une accroche. L'interlettrage et la hauteur de ligne sont donc un
    peu moins tendus qu'a l'accueil : sur un corps plus petit, un
    crénage trop serré colle les lettres. */
 h1 { font-size:1.6rem; font-weight:900; letter-spacing:-.02em; line-height:1.2; margin:0 0 .4rem; }
 .societe { display:flex; align-items:center; gap:.55rem; color:var(--gris); font-size:1rem; font-weight:600; margin-bottom:.9rem; }
 /* Tuile d'identité de l'employeur. Même dessin que les cartes, à l'échelle
    de la page de lecture : elle situe l'entreprise sans concurrencer le titre. */
 .slogo { width:26px; height:26px; border-radius:.375rem; flex-shrink:0; position:relative; overflow:hidden;
   display:inline-flex; align-items:center; justify-content:center; color: var(--blanc); font-weight:900;
   font-size:9px; letter-spacing:-.02em; }
 .slogo img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain;
   border-radius:inherit; padding:2px; }
 /* Fond clair pour un logo ; la couleur de la marque garde les initiales. */
 /* La tuile porte un fond pris dans le theme : clair le jour, sombre la
    nuit. L'image n'a pas de fond — un filtre s'applique aussi au fond de
    l'element, et celui-ci s'inversait avec le logo.
    En mode nuit, seul le logo est inverse. */
 .slogo.fond-logo { background: var(--surface-2); }
 .slogo.fond-logo.logo-fond-sombre { background: #0b1c2c; }
 .slogo.fond-logo span { color: var(--encre-forte); }
 .slogo.fond-logo img { padding: 2px; }
 html[data-theme="nuit"] .slogo.fond-logo.logo-inversable img { filter: invert(1) hue-rotate(180deg); }
 .pastilles { display:flex; flex-wrap:wrap; gap:.4rem; margin-bottom:1.6rem; }
 /* L'action de la page. Sur telephone, une carte ouvre cette page :
    sans ce bouton, la candidature n'avait aucun point de depart. Meme
    dessin que sur le board — c'est la meme action, au meme endroit. */
 .dact { display:flex; gap:.5rem; margin:0 0 1.6rem; }
 .bap { display:inline-flex; align-items:center; background:var(--teal-fond); color:var(--blanc);
        border:1px solid var(--teal); padding:.55rem 1.15rem; border-radius:.5rem;
        font-weight:700; font-size:.925rem; text-decoration:none; }
 .bap:hover { background:var(--teal-aplat-survol); border-color:var(--teal-aplat-survol); color:var(--blanc); }
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
 /* La proposition de valeur : un encart en retrait, apres l'offre.
    Elle informe, elle ne concurrence pas — d'ou le fond discret et le
    corps plus petit que le texte de l'annonce. */
 .pv { margin-top:2rem; padding:.95rem 1.1rem; background:var(--surface-2);
       border:1px solid var(--bord-carte); border-radius:.625rem; }
 .pv p { margin:0; font-size:.86rem; line-height:1.6; color:var(--gris); }
 .pv strong { color:var(--encre-forte); }
 .pied a { color:var(--teal); font-weight:600; }

 /* ── La fiche est une carte sur le champ gris ──
    Le volet n'est plus blanc : la fiche se détache, comme sur le board.
    C'est la délimitation du modèle — elle se voit sans qu'on trace un trait. */
 @media (min-width: 769px) {
  body { background: var(--champ); }
  .page { padding: 1.25rem 1.25rem 3rem; }
  .enveloppe {
   background: var(--surface);
   border-radius: .625rem;
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

  /* Le pied de navigation. La fiche n'en avait aucun : depuis
     /offre/{slug}, les mentions legales etaient inatteignables. La teinte
     et la structure sont celles du pied de l'accueil et du board. */
  #ft { background: var(--teal-fond); color: rgba(255,255,255,0.9);
        padding: .625rem 1.375rem .5rem; display: flex; flex-direction: column; gap: .4rem;
        border-top: 2px solid rgba(255,255,255,.28); }
  #ft .ft-top { display: flex; align-items: center; justify-content: space-between;
                gap: 1rem; flex-wrap: wrap; max-width: 62rem; margin: 0 auto; width: 100%; }
  #ft .ft-logo { font-size: .95rem; font-weight: 900; color: var(--blanc);
                 letter-spacing: -.05em; text-decoration: none; }
  #ft .ft-logo:hover { color: var(--blanc-survol); }
  #ft .ft-links { display: flex; gap: .4rem; flex-wrap: wrap; }
  #ft .ft-links a { color: rgba(255,255,255,0.9); text-decoration: none; font-size: .68rem;
                    font-weight: 500; padding: .2rem .5rem; border-radius: .25rem;
                    border: 1px solid rgba(255,255,255,.15); transition: background .15s, color .15s; }
  #ft .ft-links a:hover { background: var(--surbrillance); color: var(--blanc); }
  #ft .ft-copy { font-size: .62rem; color: rgba(255,255,255,0.9); margin-top: .15rem; }

/* ── PIED SUR TELEPHONE ───────────────────────────────────────────────
   Le logo et les liens partagent une ligne ; la copie passe dessous.
   Sans cela, le logo prenait une ligne entiere pour rien, et la copie
   s'etalait sur cinq lignes dans le pied cantonne a la colonne de
   gauche du board. display: contents promeut les enfants du div au
   rang de flex ; order les replace.

   Le gap du ft-top passe de 1rem a .4rem : a 320 px, le logo (45 px)
   et les liens (267 px) ne tenaient pas dans 288 px avec 16 px de
   separation. Les liens sont resserres pour que « Confidentialite »
   ne passe pas a la ligne.

   Ces regles viennent apres le bloc principal du footer : en CSS, la
   regle qui vient plus tard gagne. */
  @media (max-width: 768px) {
    #ft .ft-top { flex-wrap: wrap; align-items: center; gap: .4rem; }
    #ft .ft-top > div:first-child { display: contents; }
    #ft .ft-logo { order: 1; }
    #ft .ft-links { order: 2; gap: .3rem; }
    #ft .ft-copy { order: 3; flex-basis: 100%; margin-top: 0; gap: .12rem; }
  }

/* Sous 380 px, la copie tient sur deux lignes seulement a cette taille.
   Au-dessus, elle tient deja en deux lignes : inutile de la reduire la
   ou elle n'a pas besoin de l'etre. */
  @media (max-width: 380px) {
    #ft .ft-copy { font-size: .58rem; line-height: 1.3; }
    #ft .ft-copy .heart { font-size: .66rem; }
  }
  @media (max-width: 768px) {
    #ft { padding: .625rem 1rem .5rem; }
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
\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<style id="plan-critique">\n/* CSS CRITIQUE DU PLAN — injecte, ne pas modifier ici */\n/* ══ CSS CRITIQUE DU PLAN — doit precede la feuille de theme ══\n *\n * Le symptome : sur iPad, au chargement d'une page, le defilement\n * semble depasser le pied de page. Le fond sous le pied, d'une couleur\n * qui n'appartient pas au site, s'affiche pendant quelques instants,\n * puis tout se stabilise.\n *\n * La cause : les regles qui posent le fond du plan vivent dans\n * assets/theme.css — une feuille EXTERNE. Avant qu'elle n'arrive, le\n * navigateur ne sait rien : --plan, --fond et --champ sont indefinis,\n * \`background: var(--plan)\` ne s'applique pas, le fond est transparent,\n * et \`overscroll-behavior-y\` reste a \`auto\`.\n *\n * CE FICHIER EST UN GABARIT. Les marqueurs #f3f4f5 et\n * #12181b sont remplaces par scripts/injecter-plan-critique.cjs\n * avec la couleur de la page : toutes les pages n'ont pas le meme plan.\n *\n *   accueil, entreprises, observatoire, offer, 404\n *       --plan: var(--champ)   jour #f3f4f5   nuit #12181b\n *   a-propos, cgu, confidentialite, contact\n *       --plan: var(--fond)    jour #fff      nuit #0f1416\n *\n * Mettre le meme repli partout etait l'erreur de la version\n * precedente : les quatre pages du pied affichaient du gris la ou\n * elles doivent etre blanches — un fond qui n'appartient pas a la page.\n *\n * Les fallbacks de var() gardent la main des que la feuille de theme\n * arrive : --plan est alors defini, et c'est lui qui s'applique.\n */\n\nhtml {\n  background: var(--plan, #f3f4f5);\n  /* Le rebond du geste est desactive des le premier octet : sans\n     cela, le canvas deborde du body pendant que la feuille arrive. */\n  overscroll-behavior-y: none;\n  min-height: 100%;\n}\n\nbody {\n  background: var(--plan, #f3f4f5);\n  overscroll-behavior-y: none;\n  /* Le body doit couvrir la fenetre MEME quand le contenu est court.\n     Sans cela, quand la page est plus courte que l'ecran — ce qui\n     arrive au premier paint — le pied flotte au milieu et le fond\n     apparait dessous. C'est le « vide sous le pied ». */\n  min-height: 100dvh;\n  margin: 0;\n}\n\n/* Le mode nuit, des le premier paint. Le script qui pose data-theme\n   est inline dans le <head> : il s'execute avant le premier rendu.\n   Sans ces deux regles, un lecteur en mode nuit voyait un flash clair. */\nhtml[data-theme="nuit"] {\n  background: var(--plan, #12181b);\n}\nhtml[data-theme="nuit"] body {\n  background: var(--plan, #12181b);\n}\n\n/* ══ LE PIED EST TENU AU BAS ══\n *\n * Sans cela, quand le contenu est plus court que la fenetre, le pied\n * flotte au milieu de l'ecran et le fond du body occupe le bas : c'est\n * la bande grise sous le pied. Elle apparait des que la page ne\n * remplit pas l'ecran — au premier paint, et sur les pages courtes.\n *\n * #app porte min-height: 100% dans son propre CSS. Un pourcentage se\n * resout contre la hauteur du parent ; le body n'en a pas, donc il vaut\n * auto, et l'etirement ne se fait pas. On donne ici une valeur absolue\n * au viewport, qui ne depend de rien.\n *\n * Les selecteurs sont volontairement nus : ils doivent gagner sur le\n * CSS de chaque page, qui arrive apres. A specificite egale, le dernier\n * declare l'emporte — theme.css ne redefinit ni le display du body ni\n * la marge du pied.\n *\n * Le board est exclu (bloc retire a l'injection) : c'est une\n * application a hauteur fixe, son document ne defile pas.\n */\n/* __DEBUT_PIED_COLLE__ */\nbody {\n  display: flex;\n  flex-direction: column;\n  min-height: 100dvh;\n}\n#app {\n  min-height: 100dvh;\n}\n#ft {\n  margin-top: auto;\n}\n/* __FIN_PIED_COLLE__ */\n\n</style>\n<link rel="stylesheet" href="/assets/theme.css">
<script>(function(){try{var t=localStorage.getItem('claim-theme-v2');if(t==='nuit'){document.documentElement.setAttribute('data-theme','nuit');}}catch(e){}})();</script>
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
  ${job.source_url ? `<div class="dact"><a class="bap" href="${echapper(job.source_url)}" target="_blank" rel="nofollow noopener" data-sortie="postuler">Postuler</a></div>` : ''}
  ${corps || '<p>Description non disponible.</p>'}
  <!-- La proposition de valeur, la meme que sur l'accueil mais tournee
       pour un lecteur arrive au milieu du sujet : il ne sait pas ce
       qu'est Claim!, et c'est ici qu'il peut le comprendre. Le
       vocabulaire est celui de l'accueil — releve, sites carrieres,
       perimetre etroit — pour que les deux pages disent la meme chose
       sans se recopier. -->
  <div class="pv">
    <p><strong>Claim!</strong> relève chaque matin les offres d'actuariat, de data et d'IA
       en assurance, directement sur les sites carrières des employeurs — assureurs, mutuelles,
       courtiers, cabinets de conseil et réassurance. Le périmètre est étroit, c'est le principe :
       rien à trier, rien qui sorte du métier.</p>
  </div>
  <div class="pied">
    Offre publiée sur <a href="${SITE_URL}/">Claim!</a>.
    ${logoParHunter ? `Logo : <a href="https://hunter.io" rel="noopener" target="_blank">Hunter.io</a>.` : ''}
    ${job.source_url ? `Source : <a href="${echapper(job.source_url)}" rel="nofollow noopener" target="_blank" data-sortie="annonce">l'annonce d'origine</a>.` : ''}
  </div>
</main>
</div>
<footer id="ft">
  <div class="ft-top">
    <div>
      <a class="ft-logo" href="/">Claim!</a>
      <div class="ft-copy">© 2026 Claim your job</div>
    </div>
    <div class="ft-links">
      <a href="/a-propos.html">À propos</a>
      <a href="/cgu.html">CGU</a>
      <a href="/confidentialite.html">Confidentialité</a>
      <a href="/contact.html">Contact</a>
    </div>
  </div>
</footer>
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

