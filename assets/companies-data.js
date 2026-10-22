// assets/companies-data.js
//
// Profils d'entreprise du rail latéral de la fiche de poste.
//
// L'API ne publie de la société que son nom, son type et ses liens. Tout le
// reste — présentation, avantages, liens sociaux — vit ici.
//
// Ces informations sont ILLUSTRATIVES : elles tiennent la place de ce que
// porteront les pages individuelles d'entreprise, encore à publier. Ce fichier
// est la source unique, partagée par les deux surfaces de la fiche :
//   - le job board, qui le charge par <script src="/assets/companies-data.js"> ;
//   - la page d'offre rendue côté serveur, qui le require().
// Le jour où les pages existent, seul ce fichier change : le rendu, lui, reste.
//
// Rien n'est deviné : les liens sociaux n'apparaissent que s'ils ont été
// vérifiés. Une entreprise sans lien connu n'affiche pas de lien.

(function (racine, fabrique) {
  if (typeof module === 'object' && module.exports) module.exports = fabrique();
  else racine.CLAIM_ENTREPRISES = fabrique();
}(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  /* ── Vocabulaire des avantages ──────────────────────────────────────────
     Un code stable, un libellé d'affichage. La table reprend les codes de la
     page Entreprises et l'élargit aux avantages qui reviennent le plus dans
     les annonces du secteur. */
  var AVANTAGES = {
    teletravail: 'Télétravail',
    full_remote: 'Full remote',
    flexibilite: 'Horaires flexibles',
    tickets_restaurant: 'Tickets restaurant',
    mutuelle: 'Mutuelle',
    prevoyance: 'Prévoyance',
    interessement: 'Intéressement',
    participation: 'Participation',
    abondement: 'Abondement',
    pee: 'PEE',
    epargne_salariale: 'Épargne salariale',
    actionnariat: 'Actionnariat',
    bspce: 'BSPCE',
    rtt: 'RTT',
    treizieme_mois: '13e mois',
    formation: 'Formation',
    mobilite: 'Forfait mobilité',
    creche: 'Crèche',
    cse: 'CSE',
    conges: 'Congés supp.',
    retraite: 'Retraite supp.'
  };

  /* ── Types d'employeur ─────────────────────────────────────────────────── */
  var TYPES = {
    assureur: 'Assureur',
    mutuelle: 'Mutuelle',
    reassurance: 'Réassureur',
    bancassurance: 'Bancassurance',
    conseil: 'Conseil / Audit',
    courtier: 'Courtier',
    institution: 'Institution',
    autre: 'Entreprise'
  };

  /* ── Profils ────────────────────────────────────────────────────────────
     `alias` porte les autres écritures du même employeur : l'API nomme ses
     sociétés tantôt avec un tiret, tantôt avec un souligné, et parfois sous
     une raison sociale abrégée. La comparaison, elle, ignore casse, accents
     et ponctuation — un alias ne sert donc qu'aux noms réellement distincts. */
  var PROFILS = [
    {
      slug: 'axa',
      nom: 'AXA France',
      type: 'assureur',
      secteur: 'Assurance IARD & Vie',
      taille: '12 000+ collaborateurs',
      siege: 'Paris 8e',
      site: 'https://www.axa.fr/',
      linkedin: 'https://www.linkedin.com/company/axa-france',
      aPropos: "Leader mondial de l'assurance, AXA France développe des modèles de tarification et de risque de pointe. La direction data & actuariat recrute activement des profils quantitatifs.",
      avantages: ['teletravail', 'pee', 'participation', 'interessement', 'abondement', 'cse'],
      tags: ['IARD', 'Vie', 'Tarification', 'Data Science', 'Solvabilité II']
    },
    {
      slug: 'allianz',
      nom: 'Allianz France',
      type: 'assureur',
      secteur: 'Assurance IARD & Vie',
      taille: '8 500+ collaborateurs',
      siege: 'La Défense',
      site: 'https://www.allianz.fr/',
      linkedin: 'https://www.linkedin.com/company/allianz-france',
      aPropos: 'Filiale française du groupe Allianz, 2e assureur mondial. Forte culture data avec un lab IA interne dédié à la modélisation des risques et au pricing.',
      avantages: ['teletravail', 'pee', 'participation', 'interessement', 'cse'],
      tags: ['Pricing', 'IFRS 17', 'MLOps', 'Actuariat', 'IA']
    },
    {
      slug: 'bnp-paribas-cardif',
      alias: ['bnp_cardif', 'bnp-cardif', 'cardif'],
      nom: 'BNP Paribas Cardif',
      type: 'assureur',
      secteur: 'Assurance Vie & Épargne',
      taille: '2 300+ collaborateurs',
      siege: 'Paris 8e',
      site: 'https://www.bnpparibascardif.com/',
      linkedin: 'https://www.linkedin.com/company/bnp-paribas-cardif',
      aPropos: "Spécialiste de l'assurance vie et de l'épargne au sein du groupe BNP Paribas. Acteur majeur de la transition IFRS 17 avec des équipes actuarielles en pleine transformation.",
      avantages: ['teletravail', 'pee', 'participation', 'interessement', 'abondement', 'cse'],
      tags: ['Vie', 'Épargne', 'IFRS 17', 'ALM', 'Prophet']
    },
    {
      slug: 'covea',
      alias: ['covea-assurances'],
      nom: 'Covéa',
      type: 'mutuelle',
      secteur: 'Assurance IARD (Mutualiste)',
      taille: '22 000+ collaborateurs',
      siege: 'Paris 15e',
      site: 'https://www.covea.com/fr',
      linkedin: 'https://www.linkedin.com/company/groupecovea',
      aPropos: "1er groupe d'assurance mutualiste français (MMA, MAAF, GMF). Covéa investit massivement dans l'IA et le MLOps pour industrialiser ses modèles de détection de fraude et de tarification.",
      avantages: ['full_remote', 'pee', 'participation', 'interessement', 'abondement', 'cse'],
      tags: ['MLOps', 'IA / ML', 'RGPD', 'Fraude', 'Full Remote']
    },
    {
      slug: 'mazars',
      alias: ['forvis-mazars'],
      nom: 'Mazars Actuariat',
      type: 'conseil',
      secteur: 'Conseil & Audit actuariel',
      taille: '500+ actuaires',
      siege: 'Paris 8e',
      site: 'https://www.forvismazars.com/fr/fr',
      linkedin: 'https://www.linkedin.com/company/mazars',
      aPropos: "Cabinet de conseil et d'audit de référence pour les acteurs de l'assurance. L'équipe actuariat accompagne les assureurs sur Solvabilité II, IFRS 17 et les risques émergents.",
      avantages: ['teletravail', 'pee', 'interessement', 'cse'],
      tags: ['Conseil', 'Solvabilité II', 'Risques émergents', 'IFRS 17', 'Audit']
    },
    {
      slug: 'generali',
      alias: ['generali-france'],
      nom: 'Generali France',
      type: 'assureur',
      secteur: 'Assurance IARD & Vie',
      taille: '5 800+ collaborateurs',
      siege: 'Paris 9e',
      site: 'https://www.generali.fr/',
      linkedin: 'https://www.linkedin.com/company/generali-france',
      aPropos: "Filiale française du groupe Generali, 3e assureur européen. Le Digital & Innovation Lab développe des solutions NLP et IA générative pour automatiser la gestion des sinistres.",
      avantages: ['teletravail', 'pee', 'participation', 'interessement', 'cse'],
      tags: ['NLP', 'LLM', 'Sinistres', 'IA générative', 'RGPD']
    },
    {
      slug: 'malakoff-humanis',
      nom: 'Malakoff Humanis',
      type: 'mutuelle',
      secteur: 'Protection sociale complémentaire',
      taille: '10 000+ collaborateurs',
      siege: 'Paris 13e',
      site: 'https://www.malakoffhumanis.com/',
      linkedin: 'https://www.linkedin.com/company/malakoff-humanis',
      aPropos: "1er groupe de protection sociale complémentaire en France. Recrute des actuaires santé et prévoyance pour accompagner sa transformation digitale et réglementaire.",
      avantages: ['teletravail', 'pee', 'participation', 'interessement', 'abondement', 'cse'],
      tags: ['Santé', 'Prévoyance', 'ANI', 'Paritaire', 'Collectif']
    },
    {
      slug: 'scor',
      alias: ['scor-se', 'scor-se-'],
      nom: 'SCOR SE',
      type: 'reassurance',
      secteur: 'Réassurance mondiale',
      taille: '3 000+ collaborateurs',
      siege: 'Paris 1er',
      site: 'https://www.scor.com/',
      linkedin: 'https://www.linkedin.com/company/scor',
      aPropos: "4e réassureur mondial, SCOR recrute des quants d'excellence pour modéliser les risques extrêmes (catastrophes naturelles, pandémies, cyber) et piloter le capital économique.",
      avantages: ['teletravail', 'pee', 'participation', 'interessement', 'abondement', 'cse'],
      tags: ['Réassurance', 'Capital économique', 'Monte Carlo', 'Stress-test', 'ORSA']
    },
    {
      slug: 'societe-generale-assurances',
      alias: ['sg_assurances', 'sg-assurances', 'sogecap'],
      nom: 'Société Générale Assurances',
      type: 'bancassurance',
      secteur: 'Assurance Vie & Prévoyance',
      taille: '1 800+ collaborateurs',
      siege: 'Paris 17e',
      site: 'https://www.assurances.societegenerale.com/fr/',
      linkedin: 'https://www.linkedin.com/company/societe-generale-assurances',
      aPropos: "Filiale assurance du groupe Société Générale, spécialisée en assurance vie, prévoyance et assurance emprunteur. Équipes actuarielles en pleine montée en puissance data.",
      avantages: ['teletravail', 'pee', 'participation', 'interessement', 'abondement', 'cse'],
      tags: ['Vie', 'Emprunteur', 'Prévoyance', 'IFRS 17', 'Python']
    },
    {
      slug: 'milliman',
      nom: 'Milliman',
      type: 'conseil',
      secteur: 'Conseil actuariel international',
      taille: '4 000+ actuaires (monde)',
      siege: 'Paris 2e',
      site: 'https://fr.milliman.com/',
      linkedin: 'https://www.linkedin.com/company/milliman',
      aPropos: "Cabinet de conseil actuariel indépendant de référence mondiale. Le bureau parisien accompagne les assureurs et réassureurs sur des missions à fort enjeu quantitatif.",
      avantages: ['teletravail', 'pee', 'interessement'],
      tags: ['Conseil', 'Actuariat', 'Vie', 'IARD', 'International']
    },
    {
      slug: 'groupama',
      alias: ['groupama-gan', 'groupama_gan'],
      nom: 'Groupama',
      type: 'mutuelle',
      secteur: 'Assurance IARD & Vie (Mutualiste)',
      taille: '30 000+ collaborateurs',
      siege: 'Paris 8e',
      site: 'https://www.groupama.fr/',
      linkedin: 'https://www.linkedin.com/company/groupama',
      aPropos: 'Groupe mutualiste agricole et rural, Groupama développe ses capacités data et actuariat pour moderniser sa tarification IARD et améliorer la gestion des sinistres.',
      avantages: ['teletravail', 'pee', 'participation', 'interessement', 'cse'],
      tags: ['IARD', 'Tarification', 'Sinistres', 'Mutualiste', 'Data']
    },
    {
      slug: 'wtw',
      alias: ['willis-towers-watson', 'willis_towers_watson'],
      nom: 'WTW',
      type: 'courtier',
      secteur: 'Conseil & Courtage actuariel',
      taille: '45 000+ collaborateurs (monde)',
      siege: 'La Défense',
      site: 'https://www.wtwco.com/fr-fr',
      linkedin: 'https://www.linkedin.com/company/wtwcorporate',
      aPropos: "Leader mondial du conseil en risques et actuariat. L'équipe Insurance Consulting & Technology développe des outils de modélisation avancés pour les assureurs européens.",
      avantages: ['teletravail', 'pee', 'participation', 'interessement', 'cse'],
      tags: ['Conseil', 'Courtage', 'Modélisation', 'Solvabilité II', 'International']
    },
    {
      slug: 'kpmg',
      alias: ['kpmg-france'],
      nom: 'KPMG France',
      type: 'conseil',
      secteur: 'Audit & Conseil',
      taille: '10 000+ collaborateurs',
      siege: 'La Défense',
      site: 'https://kpmg.com/fr/fr.html',
      linkedin: 'https://www.linkedin.com/company/kpmg-france',
      aPropos: "Cabinet d'audit et de conseil de premier plan. L'équipe Actuariat & Risk accompagne assureurs et mutuelles sur Solvabilité II, IFRS 17 et la modélisation des risques.",
      avantages: ['teletravail', 'pee', 'participation', 'interessement', 'cse'],
      tags: ['Audit', 'Conseil', 'Solvabilité II', 'IFRS 17', 'Risk']
    },
    {
      slug: 'ey',
      alias: ['ernst-young'],
      nom: 'EY',
      type: 'conseil',
      secteur: 'Audit & Conseil',
      taille: '8 000+ collaborateurs (France)',
      siege: 'Paris La Défense',
      site: 'https://www.ey.com/fr_fr',
      linkedin: 'https://www.linkedin.com/company/ernstandyoung',
      aPropos: "L'équipe Actuarial & Insurance Risk d'EY conseille les assureurs, mutuelles et réassureurs sur leurs modèles, leur capital et leurs normes comptables.",
      avantages: ['teletravail', 'pee', 'participation', 'interessement', 'cse'],
      tags: ['Actuariat', 'Audit', 'Solvabilité II', 'IFRS 17', 'Conseil']
    },
    {
      slug: 'deloitte',
      alias: ['deloitte-france'],
      nom: 'Deloitte France',
      type: 'conseil',
      secteur: 'Audit & Conseil',
      taille: '7 000+ collaborateurs',
      siege: 'Paris La Défense',
      site: 'https://www.deloitte.com/fr/fr.html',
      linkedin: 'https://www.linkedin.com/company/deloitte',
      aPropos: "Deloitte accompagne les acteurs de l'assurance sur la modélisation, le reporting réglementaire et la transformation de leurs fonctions actuariat et risque.",
      avantages: ['teletravail', 'pee', 'participation', 'interessement', 'cse'],
      tags: ['Actuariat', 'Conseil', 'IFRS 17', 'Data', 'Risk']
    },
    {
      slug: 'aon',
      alias: ['aon-france'],
      nom: 'Aon',
      type: 'courtier',
      secteur: 'Courtage & Conseil en risques',
      taille: '50 000+ collaborateurs (monde)',
      siege: 'Paris',
      site: 'https://www.aon.com/fr-fr/',
      linkedin: 'https://www.linkedin.com/company/aon',
      aPropos: "Courtier et conseil mondial en risques. Les équipes Aon France interviennent sur le transfert de risques, l'actuariat de prévoyance et la modélisation catastrophe.",
      avantages: ['teletravail', 'pee', 'participation', 'interessement', 'cse'],
      tags: ['Courtage', 'Risques', 'Prévoyance', 'Catastrophes', 'Conseil']
    },
    {
      slug: 'april',
      alias: ['april-assurances', 'april-group'],
      nom: 'April',
      type: 'courtier',
      secteur: 'Courtage grossiste en assurance',
      taille: '2 500+ collaborateurs',
      siege: 'Lyon',
      site: 'https://www.april.com/fr/',
      linkedin: 'https://www.linkedin.com/company/april-assurances',
      aPropos: "Groupe de courtage grossiste en assurance, April conçoit et distribue des solutions de prévoyance, santé et dommages pour les particuliers et les professionnels.",
      avantages: ['teletravail', 'pee', 'participation', 'interessement', 'abondement', 'cse'],
      tags: ['Courtage', 'Prévoyance', 'Santé', 'Dommages', 'Distribution']
    },
    {
      slug: 'alan',
      nom: 'Alan',
      type: 'assureur',
      secteur: 'Assurance santé digitale',
      taille: '600+ collaborateurs',
      siege: 'Paris',
      site: 'https://alan.com/',
      linkedin: 'https://www.linkedin.com/company/avec-alan',
      aPropos: "Assureur santé indépendant, Alan construit sa propre plateforme et ses modèles de risque en interne. Culture produit forte, télétravail total, équipes data et actuariat rapprochées.",
      avantages: ['full_remote', 'flexibilite', 'actionnariat', 'mutuelle', 'formation'],
      tags: ['Santé', 'Produit', 'Full Remote', 'Data', 'Actuariat']
    },
    {
      slug: 'wakam',
      alias: ['wakam-assurances'],
      nom: 'Wakam',
      type: 'assureur',
      secteur: 'Assurance affinitaire B2B2C',
      taille: '700+ collaborateurs',
      siege: 'Paris',
      site: 'https://www.wakam.com/',
      linkedin: 'https://www.linkedin.com/company/wearewakam',
      aPropos: "Assureur européen en marque blanche, Wakam couvre les risques affinitaires de ses partenaires. Tarification, provisionnement et pilotage du capital sont portés en interne.",
      avantages: ['full_remote', 'flexibilite', 'actionnariat', 'mutuelle', 'cse'],
      tags: ['Affinitaire', 'B2B2C', 'Tarification', 'Provisions', 'Europe']
    },
    {
      slug: 'cnp-assurances',
      alias: ['cnp'],
      nom: 'CNP Assurances',
      type: 'bancassurance',
      secteur: 'Assurance Vie & Prévoyance',
      taille: '5 000+ collaborateurs',
      siege: 'Paris 15e',
      site: 'https://www.cnp.fr/',
      linkedin: 'https://www.linkedin.com/company/cnp',
      aPropos: "1er assureur de personnes en France, CNP Assurances distribue ses contrats par les réseaux bancaires et postal. Les équipes actuarielles pilotent épargne, retraite et prévoyance.",
      avantages: ['teletravail', 'pee', 'participation', 'interessement', 'abondement', 'cse'],
      tags: ['Vie', 'Prévoyance', 'Retraite', 'ALM', 'Bancassurance']
    }
  ];

  /* ── Index ──────────────────────────────────────────────────────────────── */
  function cle(valeur) {
    return String(valeur == null ? '' : valeur)
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '');
  }

  var INDEX = {};
  PROFILS.forEach(function (profil) {
    INDEX[cle(profil.slug)] = profil;
    (profil.alias || []).forEach(function (autre) { INDEX[cle(autre)] = profil; });
  });

  function profilEntreprise(slug) {
    return INDEX[cle(slug)] || null;
  }

  /* ── Identité visuelle ──────────────────────────────────────────────────
     Une teinte et deux initiales par employeur : sa pastille se reconnaît
     d'une ligne à l'autre. La table vit ici — et non dans chaque page — pour
     que la même entreprise ait la même couleur sur la carte, sur la fiche et
     sur la page d'offre. Les clés sont normalisées au chargement, ce qui
     confond « malakoff_humanis » et « malakoff-humanis ». */
  var COULEURS = {
    'ag2r': '#1B4F72', 'axa': '#00395D', 'allianz': '#003781',
    'bnp-paribas-cardif': '#009966', 'covea': '#E30613', 'scor': '#1A1A2E',
    'swiss_life': '#E4003A', 'swiss-life': '#E4003A',
    'generali': '#C8102E', 'malakoff_humanis': '#005B8E', 'malakoff-humanis': '#005B8E',
    'groupama_gan': '#009B3A', 'groupama-gan': '#009B3A',
    'groupe_vyv': '#6B2D8B', 'groupe-vyv': '#6B2D8B',
    'klesia': '#E85D04', 'cnp': '#003F7F',
    'cm_arkea': '#E30613', 'cm-arkea': '#E30613',
    'ca_assurances': '#007A3D', 'ca-assurances': '#007A3D',
    'pro_btp': '#F5A623', 'groupe_agrica': '#4A7C59',
    'matmut': '#E8001D', 'la_mutuelle_generale': '#0066CC'
  };

  // Teal de la maison quand l'employeur n'a pas de teinte déclarée.
  var TEAL = '#006876';

  var COULEURS_INDEX = {};
  Object.keys(COULEURS).forEach(function (nom) { COULEURS_INDEX[cle(nom)] = COULEURS[nom]; });

  function couleurEntreprise(slug) {
    return COULEURS_INDEX[cle(slug)] || TEAL;
  }

  // Les initiales se lisent sur la tuile de repli, quand le logo manque ou
  // n'a pas encore été chargé. On ne garde que des mots portant une lettre
  // ou un chiffre : « Groupama / Gan » doit donner « GG », pas « G/ ».
  function initiales(nom) {
    return String(nom == null ? '?' : nom)
      .split(/[\s/|,–—-]+/)
      .map(function (mot) { return mot.replace(/[^0-9A-Za-zÀ-ÿ]/g, ''); })
      .filter(function (mot) { return mot.length > 0; })
      .slice(0, 2)
      .map(function (mot) { return mot.charAt(0); })
      .join('').toUpperCase();
  }

  /* ── Lecture d'une annonce ──────────────────────────────────────────────── */

  // Ramène un texte d'annonce à du texte nu : les balises sautent, les
  // entités HTML sont résolues, les paragraphes restent séparés.
  function texteNu(valeur) {
    return String(valeur == null ? '' : valeur)
      .replace(/<\s*br\s*\/?\s*>/gi, '\n')
      .replace(/<\s*\/\s*(p|div|li|h[1-6]|tr|section)\s*>/gi, '\n\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(parseInt(d, 10)); })
      .replace(/&amp;/gi, '&')
      .replace(/[ \t]+/g, ' ');
  }

  // Coupe à la fin d'une phrase, sans dépasser `max` quand c'est possible.
  function couperPhrases(texte, max) {
    var sortie = '';
    var reste = texte;
    while (reste.length) {
      var phrase = reste.match(/^[\s\S]*?[.!?](?=\s|$)/);
      var morceau = phrase ? phrase[0].trim() : reste.trim();
      if (sortie && sortie.length + 1 + morceau.length > max) break;
      sortie = sortie ? sortie + ' ' + morceau : morceau;
      if (!phrase) break;
      reste = reste.slice(phrase[0].length);
      if (sortie.length >= max) break;
    }
    if (!sortie) sortie = texte;
    return sortie.length < texte.length ? sortie + '…' : sortie;
  }

  // L'annonce s'ouvre presque toujours sur la présentation de l'employeur, puis
  // bascule sur le poste. On repère le basculement aux intitulés qui le
  // signalent, et on ne garde que ce qui précède.
  var DEBUT_POSTE = /\b(VOS? MISSIONS?|VOTRE R[ÔO]LE|MISSIONS?|DESCRIPTION DU POSTE|LE POSTE|VOS RESPONSABILIT[ÉE]S|PROFIL RECHERCH[ÉE]|QUI [ÊE]TES[- ]VOUS|CE QUE NOUS (VOUS )?PROPOSONS|VOTRE PROFIL)\b/i;

  var MARQUES_EMPLOYEUR = /\b(leader|leaders|acteur|groupe|filiale|sp[ée]cialiste|assureur|mutuelle|r[ée]assureur|banque|cabinet|implant[ée]e?|nous sommes|notre (entreprise|groupe|m[ée]tier))\b|depuis \d{4}|cr[ée][ée]/i;

  // Les annonces recopiées d'un site carrières s'ouvrent souvent sur le fil
  // d'Ariane, le titre repris deux fois, un « Partager sur : ». Ce n'est pas la
  // présentation de l'employeur. On coupe ce qui précède le dernier de ces
  // repères — cherchés dans les premiers 400 caractères seulement, sinon un
  // « Postuler » du corps de l'annonce ferait sauter tout le paragraphe.
  var CHROME = /(Partager (sur|via)\s*:|Partager cette offre|Candidater|Postuler|Retour aux offres|Retour à la liste|Accueil\s*\/|Offres d['’]emploi\s*\/|Imprimer|Envoyer à un ami)/gi;

  function retirerChrome(bloc) {
    var tete = bloc.slice(0, 400);
    var re = new RegExp(CHROME.source, 'gi');
    var dernier = 0;
    var m;
    while ((m = re.exec(tete))) dernier = m.index + m[0].length;
    if (dernier === 0) return bloc;
    return bloc.slice(dernier).replace(/^[\s:–—/|·.,-]+/, '');
  }

  // Un paragraphe qui parle de la page plutôt que de l'employeur. Ces textes
  // passent tous les autres filtres — ils contiennent « groupe », « carrière »,
  // une date — et deviendraient une présentation absurde. On les écarte.
  var PARASITE = /(suivez[- ]nous|site carri[eè]re|d[ée]poser une candidature|ma recherche, mon alerte|la carte des offres|search by keyword|show more|loading\.\.\.|politique de confidentialit[ée]|mentions l[ée]gales|gestion des cookies|s'inscrire [àa] la newsletter)/i;

  function accrocheEntreprise(description) {
    var paragraphes = texteNu(description).split(/\n{2,}/)
      .map(function (p) { return p.replace(/\s+/g, ' ').trim(); })
      .filter(Boolean);

    for (var i = 0; i < Math.min(2, paragraphes.length); i += 1) {
      var bloc = retirerChrome(paragraphes[i]);
      var bascule = bloc.search(DEBUT_POSTE);

      // Un intitulé de section en tête de paragraphe : on est déjà dans
      // l'annonce — « Missions », « Profil recherché » — et non dans la
      // présentation de l'employeur.
      if (bascule >= 0 && bascule < 80) continue;
      if (bascule > 80) bloc = bloc.slice(0, bascule).trim();
      if (PARASITE.test(bloc)) continue;

      // La marque doit ouvrir le propos : plus loin, on raconte déjà le poste.
      var marque = bloc.search(MARQUES_EMPLOYEUR);
      if (bloc.length < 80 || marque < 0 || marque > 180) continue;
      return couperPhrases(bloc, 300);
    }
    return '';
  }

  var MAX_AVANTAGES = 6;

  /* ── Avantages ──────────────────────────────────────────────────────────
     Deux familles de signatures, parce que tous les mots ne se valent pas.

     Les unes ne trompent pas : « tickets restaurant », « intéressement »,
     « BSPCE » ne désignent un avantage que dans une annonce, jamais un métier.
     Elles se lisent dans tout le texte, du plus précis au plus général —
     « full remote » avant « télétravail », sinon il se fait absorber.

     Les autres sont ambiguës : « mutuelle », « prévoyance » et « formation »
     sont aussi des métiers, et une annonce d'actuaire santé les emploie
     constamment. Elles ne comptent que prises dans une liste d'avantages
     annoncée comme telle. Mieux vaut ne rien dire que promettre un avantage
     qui n'existe pas. */
  var SIGNATURES = [
    ['full_remote', /(100\s*%\s*(de\s*)?t[ée]l[ée]travail|full[\s-]?remote|t[ée]l[ée]travail\s+(total|int[ée]gral))/i],
    ['tickets_restaurant', /(tickets?\s+restaurant|titres?\s+restaurant)/i],
    ['interessement', /int[ée]ressement/i],
    ['participation', /(participation aux r[ée]sultats?|prime de participation)/i],
    ['abondement', /abondement/i],
    ['pee', /(\bPEE\b|plan d'[ée]pargne\s*(d'entreprise|interentreprises|salariale)?)/i],
    ['epargne_salariale', /[ée]pargne salariale/i],
    ['actionnariat', /(actionnariat|stock[\s-]?options?|actions? gratuites?)/i],
    ['bspce', /\bBSPCE\b/i],
    ['rtt', /(\bRTT\b|r[ée]duction du temps de travail)/i],
    ['treizieme_mois', /(13\s*(e|ème|eme)?\s*mois|treizi[èe]me mois)/i],
    ['retraite', /(retraite suppl[ée]mentaire|PERCO|article 83)/i],
    ['creche', /cr[èe]che/i],
    ['cse', /(\bCSE\b|comit[ée] social et [ée]conomique|comit[ée] d'entreprise)/i],
    ['mobilite', /(forfait mobilit[ée]s?|mobilit[ée] durable|prime transport)/i],
    ['conges', /(cong[ée]s? (suppl[ée]mentaires?|d'anciennet[ée])|jours? de cong[ée]s? en plus)/i],
    ['teletravail', /(t[ée]l[ée]travail|t[ée]l[ée]working|2\s*jours?\s*(de\s*)?t[ée]l[ée]travail)/i]
  ];

  // Les mots ambigus, et l'intitulé qui les rend lisibles comme des avantages.
  var ZONE_AVANTAGES = /(avantages?|ce que nous (vous )?offrons|nous vous (proposons|offrons)|vos avantages|notre offre|le package|en nous rejoignant|pourquoi nous rejoindre)/i;

  var SIGNATURES_DECLAREES = [
    ['mutuelle', /(mutuelle|compl[ée]mentaire sant[ée])/i],
    ['formation', /(\bCPF\b|plan de formation|formation continue|budget formation)/i],
    ['flexibilite', /(horaires?\s+(flexibles?|am[ée]nag[ée]s?)|flexibilit[ée]\s+(horaire|des horaires|d'organisation))/i]
  ];

  // Les avantages déclarés par le profil d'abord — ce sont les seuls certains —
  // puis ce que l'annonce laisse voir. Filtre et plafond compris : mieux vaut
  // une liste courte qu'une liste fausse.
  function avantagesDe(description, profil) {
    var codes = [];

    function ajouter(code) {
      if (codes.length < MAX_AVANTAGES && codes.indexOf(code) === -1) codes.push(code);
    }

    if (profil && profil.avantages) profil.avantages.forEach(ajouter);

    var texte = texteNu(description);
    if (texte) {
      SIGNATURES.forEach(function (signature) {
        if (signature[1].test(texte)) ajouter(signature[0]);
      });

      var debut = ZONE_AVANTAGES.exec(texte);
      if (debut) {
        var zone = texte.slice(debut.index, debut.index + 600);
        SIGNATURES_DECLAREES.forEach(function (signature) {
          if (signature[1].test(zone)) ajouter(signature[0]);
        });
      }
    }

    return codes.map(function (code) { return AVANTAGES[code] || code; });
  }

  // Fraîcheur d'une offre : « publiée il y a 3 jours ». C'est le repère qui
  // décide le plus vite à cliquer, et il ne figure nulle part ailleurs sur la
  // fiche. Computé ici pour que les deux surfaces le disent de la même façon.
  function publicationLabel(iso) {
    var t = Date.parse(iso || '');
    if (!isFinite(t)) return '';
    var jours = Math.floor((Date.now() - t) / 86400000);
    if (jours <= 0) return "publiée aujourd'hui";
    if (jours === 1) return 'publiée hier';
    if (jours < 31) return 'publiée il y a ' + jours + ' jours';
    var mois = Math.round(jours / 30);
    return mois <= 1 ? 'publiée il y a 1 mois' : 'publiée il y a ' + mois + ' mois';
  }


  /* ── Domaines des employeurs ─────────────────────────────────────────────
     Un slug, un domaine. C'est la donnée vraie. Le service qui fournit
     l'image est une politique, décidée juste après — les deux ne se
     mélangent plus.

     Quatorze entrées portent une adresse directe, parce que leur logo n'est
     pas un favicon : ce sont les fichiers du dossier logos/, servis par
     notre propre domaine. Une valeur qui commence par « / » est un fichier
     du dépôt ; une valeur contenant « :// » est une adresse externe
     (BPCE vient de Wikimedia).

     Ces quatorze fichiers ont été relevés sur le site de l'employeur lui-même
     ou sur une source libre, puis mesurés : le plus petit fait 185 px de
     large, le plus grand 3 508. Le dossier logos/CHANGELOG.md dit d'où
     vient chacun. */
  var DOMAINES = {
    "abeille": "abeille-assurances.fr",
    "acm": "acm.fr",
    "actelior": "actelior.fr",
    "addactis": "addactis.com",
    "aesio": "/logos/aesio.svg",
    "ag2r": "ag2rlamondiale.fr",
    "aig": "/logos/aig.png",
    "akur8": "akur8.com",
    "alan": "alan.com",
    "allianz": "allianz.fr",
    "alptis": "alptis.fr",
    "aon": "aon.com",
    "apicil": "/logos/apicil.png",
    "april": "april.fr",
    "axa": "axa.fr",
    "bdo": "bdo.fr",
    "bnp_cardif": "bnpparibascardif.com",
    "carac": "/logos/carac.png",
    "cm_arkea": "cm-arkea.com",
    "cnp": "cnp.fr",
    "coface": "coface.fr",
    "covea": "covea.eu",
    "deloitte": "deloitte.com",
    "descartes_underwriting": "descartesunderwriting.com",
    "diot_siaci": "diot-siaci.com",
    "exiom": "exiompartners.com",
    "ey": "ey.com",
    "forsides": "forsides.fr",
    "galea": "galea-associes.eu",
    "garance": "/logos/garance.png",
    "generali": "generali.fr",
    "groupama_gan": "groupama.fr",
    "groupe_agrica": "groupagrica.com",
    "groupe_vyv": "groupe-vyv.fr",
    "klesia": "klesia.fr",
    "kpmg": "kpmg.fr",
    "la_france_mutualiste": "la-france-mutualiste.fr",
    "la_mutuelle_generale": "/logos/la-mutuelle-generale.svg",
    "luko": "luko.eu",
    "macif": "macif.fr",
    "macsf": "macsf.fr",
    "maif": "maif.fr",
    "malakoff-humanis": "/logos/malakoff-humanis.png",
    "matmut": "matmut.fr",
    "mazars": "mazars.fr",
    "milliman": "milliman.com",
    "mutuelle_motards": "mutuelledesmotards.fr",
    "natixis-assurances": "natixis.com",
    "nexialog": "nexialog.com",
    "oliver_wyman": "oliverwyman.com",
    "onepoint": "groupeonepoint.com",
    "partnerre": "partnerre.com",
    "prevoir": "prevoir.fr",
    "primact": "primact.fr",
    "pro_btp": "/logos/pro-btp.png",
    "pwc": "pwc.fr",
    "scor": "/logos/scor.svg",
    "seabird": "/logos/seabird.svg",
    "seyna": "seyna.eu",
    "sg-assurances": "assurances.societegenerale.com",
    "smabtp": "/logos/smabtp.png",
    "smacl": "smacl.fr",
    "suravenir": "suravenir.fr",
    "swiss-re": "swissre.com",
    "swiss_life": "swisslife.fr",
    "umr": "/logos/umr.png",
    "verlingue": "verlingue.fr",
    "viasante": "viasante.fr",
    "wakam": "wakam.com",
    "wp_ca_assurances": "ca-assurances.com",
    "wtw": "wtwco.com",
    "zelros": "zelros.com",
    "bpce": "https://upload.wikimedia.org/wikipedia/fr/0/0a/Groupe_BPCE_%28logo%29.svg",
    "shift_technology": "/logos/shift-technology.svg",
    "sia": "/logos/sia-partners.svg",
  };

  /* ── Alias ───────────────────────────────────────────────────────────────
     L'API n'écrit pas toujours un employeur de la même façon : « bnp_cardif »
     ici, « bnp-paribas-cardif » ailleurs, « wp_ca_assurances » ou
     « ca-assurances ». Une seule écriture vit dans LOGOS ; les autres
     renvoient dessus. Rien n'est dupliqué, et changer un logo reste une
     seule ligne à toucher.

     Les deux écritures de Suravenir sont, elles, réellement émises par l'API :
     l'alias n'est pas un doublon à nettoyer, c'est un cas à couvrir. */
  var ALIAS_LOGOS = {
    "abeille-assurances": "abeille",
    "bnp-paribas-cardif": "bnp_cardif",
    "ca-assurances": "wp_ca_assurances",
    "ca_assurances": "wp_ca_assurances",
    "cnp-assurances": "cnp",
    "groupama": "groupama_gan",
    "malakoff_humanis": "malakoff-humanis",
    "sg_assurances": "sg-assurances",
    "shift-technology": "shift_technology",
    "societe-generale-assurances": "sg-assurances",
    "suravenir_assurances": "suravenir",
  };

  /* ── Qui fournit l'image ─────────────────────────────────────────────────
     Deux services gratuits, sans compte : Google rend le favicon du site,
     Hunter le logo de la marque depuis sa propre base. Aucun des deux ne
     fabrique d'image — vérifié par empreinte sur les 72 domaines, les
     fichiers sont tous distincts.

     Le choix est mesuré, employeur par employeur, et Hunter n'est retenu que
     lorsqu'il apporte au moins le double de résolution, ou que Google n'a
     rien. Ailleurs il dégraderait la tuile : AIG passe de 48 px à 16 px,
     SMABTP reste à 48. On ne change pas ce qui va bien.

     Mutuelle des Motards n'a de logo nulle part : sa tuile retombe sur les
     initiales, ce qui est le comportement prévu.

     Hunter exige un lien de retour en contrepartie : il figure en pied de
     page, sur chaque surface qui affiche un logo. */
  var FOURNISSEUR_HUNTER = { "actelior.fr": true, "addactis.com": true, "ag2rlamondiale.fr": true, "alan.com": true, "aon.com": true, "april.fr": true, "cm-arkea.com": true, "coface.fr": true, "covea.eu": true, "deloitte.com": true, "diot-siaci.com": true, "ey.com": true, "garance.fr": true, "generali.fr": true, "groupagrica.com": true, "kpmg.fr": true, "la-france-mutualiste.fr": true, "macsf.fr": true, "matmut.fr": true, "mazars.fr": true, "milliman.com": true, "natixis.com": true, "suravenir.fr": true, "verlingue.fr": true, "ca-assurances.com": true, "wtwco.com": true, "zelros.com": true };

  /* ── Ceux dont aucun fournisseur n'a le logo ─────────────────────────────
     Google ne signale pas une absence : faute de favicon, il sert une icône
     générique de 16 px — la même pour un domaine inconnu que pour un domaine
     réel. Mesuré : empreinte « b8a0bf372c76 », 726 octets, HTTP 404, mais une
     balise <img> la charge sans erreur. Le repli sur les initiales ne se
     déclenche donc jamais tout seul : il faut le décider ici.

     Criblage des 45 domaines confiés à Google, en navigateur : un seul reçoit
     cette icône, Mutuelle des Motards. Hunter n'en a pas non plus. Mieux vaut
     ses initiales qu'un globe gris. */
  var SANS_LOGO = { "mutuelledesmotards.fr": true };

  /* ── Recherche ───────────────────────────────────────────────────────────
     Trois essais, du plus précis au plus tolérant : le slug exact, l'alias
     déclaré — en suivant la chaîne s'il en existe une —, puis la forme
     normalisée. */
  var DOMAINES_INDEX = {};
  Object.keys(DOMAINES).forEach(function (nom) { DOMAINES_INDEX[cle(nom)] = DOMAINES[nom]; });
  function domaineEntreprise(slug) {
    var exact = DOMAINES[slug];
    if (exact) return exact;
    var nom = ALIAS_LOGOS[slug], garde = 0;
    while (nom && !DOMAINES[nom] && garde++ < 4) nom = ALIAS_LOGOS[nom];
    if (nom && DOMAINES[nom]) return DOMAINES[nom];
    return DOMAINES_INDEX[cle(slug)] || null;
  }

  // L'adresse de l'image, ou null : la tuile affiche alors les initiales.
  function logoEntreprise(slug) {
    var cible = domaineEntreprise(slug);
    if (!cible) return null;
    // Une adresse qui commence par « / » est servie par notre propre
    // domaine : le fichier du dépôt. Elle ne contient pas « :// », et
    // l'envoyer a Google la transformerait en nom de domaine.
    if (cible.charAt(0) === '/') return cible;
    if (cible.indexOf('://') !== -1) return cible;
    if (SANS_LOGO[cible]) return null;
    return FOURNISSEUR_HUNTER[cible]
      ? 'https://logos.hunter.io/' + cible
      : 'https://www.google.com/s2/favicons?domain=' + cible + '&sz=256';
  }

  return {
    publicationLabel: publicationLabel,
    AVANTAGES: AVANTAGES,
    TYPES: TYPES,
    PROFILS: PROFILS,
    profilEntreprise: profilEntreprise,
    couleurEntreprise: couleurEntreprise,
    initiales: initiales,
    accrocheEntreprise: accrocheEntreprise,
    avantagesDe: avantagesDe,
    texteNu: texteNu,
    DOMAINES: DOMAINES,
    FOURNISSEUR_HUNTER: FOURNISSEUR_HUNTER,
    SANS_LOGO: SANS_LOGO,
    ALIAS_LOGOS: ALIAS_LOGOS,
    domaineEntreprise: domaineEntreprise,
    logoEntreprise: logoEntreprise
  };
}));
