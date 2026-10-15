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

// Profils d'entreprise du rail latéral : présentation, avantages, liens
// sociaux. Même source que le job board — la fiche se lit pareil, qu'on
// arrive par la liste ou par une adresse d'offre.
//
// La page ne doit pas tomber si ce fichier manque au déploiement : sans lui,
// le rail se réduit à ce que l'API publie et le reste de la page tient.
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

/* ── Rail latéral ──────────────────────────────────────────────────────────
   Même contenu, mêmes règles de style et même vocabulaire que le rail de la
   fiche du job board : le lecteur ne doit pas changer de page en changeant
   d'adresse.

   Il s'arrête au bouton. Les blocs « À propos », « Avantages », « Offres
   similaires » et le pied ont été retirés, ainsi que le siège et les liens
   sociaux. La page Entreprises prend le relais ; ce qui vient de l'API est
   repris tel quel, ce qui vient de l'annuaire est illustratif tant que les
   pages d'entreprise ne sont pas publiées. */
function railOffre(job) {
  const societe = job.companies || {};
  const profil = ANNUAIRE ? ANNUAIRE.profilEntreprise(societe.slug || job.source) : null;

  const nom = (profil && profil.nom) || societe.name || job.source || '';
  const typeLibelle = (profil && profil.type && ANNUAIRE)
    ? (ANNUAIRE.TYPES[profil.type] || profil.type) : '';
  const sousTitre = [typeLibelle, profil && profil.secteur].filter(Boolean).join(' · ');

  // Seul l'effectif reste sous le nom.
  const faits = [];
  if (profil && profil.taille) faits.push(`<li>${echapper(profil.taille)}</li>`);

  const adresseEntreprise = `/claim-entreprises.html?entreprise=${encodeURIComponent(societe.slug || job.source || '')}`;
  const teinte = ANNUAIRE ? ANNUAIRE.couleurEntreprise(societe.slug) : '#006876';
  const sigle = ANNUAIRE ? ANNUAIRE.initiales(nom) : '';

  return `<aside class="rail" aria-label="L'employeur qui recrute">
    <section class="rail-bloc">
      <div class="rail-entete">
        <div class="rail-logo" style="background:${echapper(teinte)}">${echapper(sigle)}</div>
        <div>
          <p class="rail-nom">${echapper(nom)}</p>
          ${sousTitre ? `<p class="rail-sous">${echapper(sousTitre)}</p>` : ''}
        </div>
      </div>
      ${faits.length ? `<ul class="rail-faits">${faits.join('')}</ul>` : ''}
      <a class="rail-btn" href="${echapper(adresseEntreprise)}">Découvrir l'entreprise</a>
    </section>
  </aside>`;
}

async function construire(job, urlCanonique) {
  const societe = job.companies || {};
  const nomSociete = societe.name || job.source || '';
  const ville = job.ville || job.city || '';
  const contrat = job.contract_type || '';
  const description = job.description_raw || '';
  const sections = Array.isArray(job.sections) ? job.sections : [];

  const premierParagraphe = paragraphesDe(description)[0] || '';
  const resume = premierParagraphe.slice(0, 155).trim();
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

  // Paramètres de mesure, sérialisés dans la page. Même vocabulaire que le
  // board, pour que les deux surfaces se lisent dans les mêmes rapports.
  const mesure = {
    item_id:          String(job.id == null ? '' : job.id),
    item_name:        job.title || '',
    company_name:     nomSociete,
    job_specialty:    job.jev_specialty || job.specialty || '',
    contract_type:    contrat,
    experience_level: job.jev_experience || '',
    job_source:       job.source || '',
    view_context:     'standalone',
  };

  // Rail latéral : qui recrute, et le geste pour en savoir plus. Aucun
  // aller-retour vers l'API — la page n'attend que sa propre offre.
  const rail = railOffre(job);

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
 :root { --teal:#006876; --encre:#191c1d; --gris:#515f78; --rail-largeur:18rem; --rail-large:394px; --gouttiere-fiche:1.6rem; }
 * { box-sizing:border-box; }
 body { margin:0; font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; color:var(--encre); line-height:1.65; }
 .enveloppe { max-width:46rem; margin:0 auto; padding:1.5rem 1.25rem 4rem; }
 .retour { display:inline-block; margin-bottom:1.25rem; color:var(--teal); text-decoration:none; font-weight:600; font-size:.9rem; }
 h1 { font-size:1.6rem; margin:0 0 .4rem; line-height:1.25; }
 .societe { color:var(--gris); font-size:1rem; font-weight:600; margin-bottom:.9rem; }
 .pastilles { display:flex; flex-wrap:wrap; gap:.4rem; margin-bottom:1.6rem; }
 .pastille { padding:3px 10px; border:1px solid #dce5e9; border-radius:9999px; background:#f5f8f9; font-size:.78rem; font-weight:600; color:#24363d; }
 .pastille-ville { background:#e9f6f8; border-color:#bfe2e8; color:#00545f; }
 .pastille-salaire { background:#f2f8f2; border-color:#cfe6cf; color:#2d5a2d; }
 .pastille-specialite { background:#ffdcc2; border-color:#f0c8a6; color:#6d3a00; }
 h2 { font-size:1.05rem; margin:1.8rem 0 .5rem; }
 p { margin:0 0 .7rem; color:#3c494c; }
 /* Structure éditoriale venue de la source : listes, emphases, sous-titres. */
 ul, ol { margin:0 0 .9rem; padding-left:1.3rem; color:#3c494c; }
 li { margin:.25rem 0; }
 li > ul, li > ol { margin:.25rem 0 .1rem; }
 strong, b { color:#191c1d; }
 em, i { font-style:italic; }
 h3, h4, h5, h6 { font-size:.98rem; margin:1.2rem 0 .4rem; color:#191c1d; }
 blockquote { margin:0 0 .9rem; padding-left:.8rem; border-left:3px solid #bfe2e8; color:#3c494c; }
 a { color:var(--teal); }
 .pied { margin-top:2.5rem; padding-top:1.2rem; border-top:1px solid #e6edf0; font-size:.85rem; color:var(--gris); }
 .pied a { color:var(--teal); font-weight:600; }

 /* ── RAIL LATÉRAL ──
    Mêmes règles que le rail de la fiche du job board (voir
    claim-job-board.html) : la fiche doit se lire pareil, qu'on arrive par la
    liste ou par cette adresse.

    Ici la colonne des offres n'existe pas : le rail tient donc dès 1 120 px,
    quand le board attend 1 280 px. En dessous, il se replie sous la fiche. */
 .page { display: grid; grid-template-columns: minmax(0, 1fr); }
 .rail { display: none; }

 /* La carte du rail : un seul bloc, de l'employeur au bouton. Rien ne se
    succède — les filets restent au cas où un second bloc reviendrait. */
 .rail-bloc { padding:1.1rem 1.25rem; border-top:1px solid #eef3f5; }
 .rail-bloc:first-child { border-top:none; }

 /* L'employeur : qui recrute, et où le retrouver. */
 .rail-entete { display: flex; align-items: center; gap: .625rem; margin-bottom: .75rem; }
 .rail-logo { width: 40px; height: 40px; border-radius: .5rem; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  color: #fff; font-weight: 900; font-size: 11px; letter-spacing: -.02em; overflow: hidden; }
 .rail-nom { margin: 0; font-size: .95rem; font-weight: 700; color: var(--encre); line-height: 1.3; }
 .rail-sous { margin: .1rem 0 0; font-size: .78rem; font-weight: 500; color: var(--gris); }
 .rail-faits { margin: 0 0 .75rem; padding: 0; list-style: none; font-size: .8rem; color: #3c494c; }
 .rail-faits li { padding: .3rem 0; border-top: 1px solid #f0f4f6; }
 .rail-faits li:first-child { border-top: none; }

 .rail-btn { display: block; padding: .55rem .75rem; border: 1px solid #bfe2e8; border-radius: .5rem;
  background: #fff; color: var(--teal); font-size: .82rem; font-weight: 700;
  text-align: center; text-decoration: none; }
 .rail-btn:hover { background: #e9f6f8; }

 /* ── La fiche et le rail sont deux zones ──
    Deux cartes blanches posées sur le champ gris, séparées par la gouttière.
    C'est la délimitation du modèle : elle se voit sans qu'on trace un trait
    entre les deux. */
 @media (min-width: 769px) {
  body { background: #f3f4f5; }
  .page { padding: 1.25rem 1.25rem 3rem; }
  .enveloppe {
   background: #fff;
   border-radius: .75rem;
   box-shadow: 0 1px 2px rgba(25, 44, 52, .06), 0 4px 14px rgba(25, 44, 52, .05);
  }
 }

 /* ── SOUS 1 120 px, LE RAIL SE REPLIE SOUS LA FICHE ──
    Meme regle que sur le board : faute de place, le rail ne s'efface pas, il
    passe sous la fiche. Ici la colonne des offres n'existe pas, le seuil tombe
    donc plus bas. Seul le telephone le garde masque. */
 @media (min-width: 769px) and (max-width: 1119.98px) {
  .page { row-gap: 1.25rem; }
  .rail {
   display: block;
   max-width: 46rem;
   margin: 0 auto;
   border: 1px solid #e2e9ec;
   border-radius: .75rem;
   background: #fff;
   box-shadow: 0 1px 2px rgba(25, 44, 52, .06), 0 4px 14px rgba(25, 44, 52, .05);
   overflow: hidden;
  }
 }

 @media (min-width: 1120px) {
  /* Sur cette page, la colonne des offres n'existe pas : rien ne pousse le
     bloc d'un côté, il se centre. La fiche et le rail prennent les mêmes
     largeurs hautes que sur le board : la fiche doit se lire pareil. */
  /* La même gouttière que sur le board : la fiche et le rail ne se touchent
     pas de plus près selon l'adresse par laquelle on arrive. */
  .page { display: flex; justify-content: center; align-items: flex-start; gap: var(--gouttiere-fiche);
   padding-left: 2rem; padding-right: 2rem; }
  .enveloppe { flex-grow: 1; flex-shrink: 1; flex-basis: 46rem; max-width: 842px; }
  /* Le rail est une carte, comme la fiche en face : une seule, dont les blocs
     se succèdent, séparés par un filet. */
  .rail {
   flex-grow: 1;
   flex-shrink: 1;
   flex-basis: 18rem;
   max-width: var(--rail-large);
   display: block;
   position: sticky;
   top: 1.25rem;
   border: 1px solid #e2e9ec;
   border-radius: .75rem;
   background: #fff;
   box-shadow: 0 1px 2px rgba(25, 44, 52, .06), 0 4px 14px rgba(25, 44, 52, .05);
   overflow: hidden;
  }
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
</head>
<body>
<div class="page">
<main class="enveloppe">
  <a class="retour" href="/claim-job-board.html">← Toutes les offres</a>
  <h1>${echapper(job.title)}</h1>
  <div class="societe">${echapper(nomSociete)}${ville ? ' · ' + echapper(ville) : ''}</div>
  <div class="pastilles">${pastilles.join('')}</div>
  ${corps || '<p>Description non disponible.</p>'}
  <div class="pied">
    Offre publiée sur <a href="${SITE_URL}/claim-job-board.html">Claim!</a>.
    ${job.source_url ? `Source : <a href="${echapper(job.source_url)}" rel="nofollow noopener" target="_blank" data-sortie="annonce">l'annonce d'origine</a>.` : ''}
  </div>
</main>
${rail}
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

const PAGE_ABSENTE = (titre, message) => `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${titre}</title><meta name="robots" content="noindex"><link rel="canonical" href="${SITE_URL}/claim-job-board.html"></head><body style="font-family:system-ui;padding:2rem"><h1>${titre}</h1><p>${message}</p></body></html>`;

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
        `Cette offre n'est plus en ligne. <a href="${SITE_URL}/claim-job-board.html">Voir les offres actuelles</a>.`));
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
      `<a href="${SITE_URL}/claim-job-board.html">Retour aux offres</a>`));
  }
};
