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

function construire(job, urlCanonique) {
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
  if ((job.source_published_at || '').length >= 10) offre.datePosted = job.source_published_at.slice(0, 10);
  if (TYPES_EMPLOI[contrat]) offre.employmentType = TYPES_EMPLOI[contrat];
  const salaire = blocSalaire(job);
  if (salaire) offre.baseSalary = salaire;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${echapper(titrePage)}</title>
${resume ? `<meta name="description" content="${echapper(resume)}">` : ''}
<link rel="canonical" href="${echapper(urlCanonique)}">
<meta property="og:type" content="article">
<meta property="og:title" content="${echapper(job.title + ' — ' + nomSociete)}">
<meta property="og:url" content="${echapper(urlCanonique)}">
${resume ? `<meta property="og:description" content="${echapper(resume)}">` : ''}
${societe.logo_url ? `<meta property="og:image" content="${echapper(societe.logo_url)}">` : ''}
<script type="application/ld+json">${JSON.stringify(offre)}</script>
<style>
 :root { --teal:#006876; --encre:#191c1d; --gris:#515f78; }
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
</style>
</head>
<body>
<main class="enveloppe">
  <a class="retour" href="/claim-job-board.html">← Toutes les offres</a>
  <h1>${echapper(job.title)}</h1>
  <div class="societe">${echapper(nomSociete)}${ville ? ' · ' + echapper(ville) : ''}</div>
  <div class="pastilles">${pastilles.join('')}</div>
  ${corps || '<p>Description non disponible.</p>'}
  <div class="pied">
    Offre publiée sur <a href="${SITE_URL}/claim-job-board.html">Claim!</a>.
    ${job.source_url ? `Source : <a href="${echapper(job.source_url)}" rel="nofollow noopener" target="_blank">l'annonce d'origine</a>.` : ''}
  </div>
</main>
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
    const { html } = construire(job, urlCanonique);
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
