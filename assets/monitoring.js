// ─────────────────────────────────────────────────────────────────────────────
// CLAIM! — client du dashboard de monitoring
//
// Quatre règles tiennent ce fichier :
//
// 1. Une donnée absente ne s'affiche jamais comme zéro. L'API le dit
//    (`status: "unavailable"`) ; l'interface écrit « Non disponible » et
//    la raison. Un 0 ferait croire à une absence d'activité.
// 2. Une réponse tardive ne remplace jamais une réponse récente. Chaque
//    chargement porte un numéro ; seul le dernier a le droit d'écrire.
// 3. Un échec de chargement conserve l'affichage précédent et le signale.
// 4. Un jour sans passage n'est pas un jour à zéro : `null` et `0` sont
//    dessinés différemment. C'est la différence entre « je n'ai pas
//    regardé » et « j'ai regardé, il n'y avait rien ».
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  const API = '/monitoring/api';
  const etat = { periode: 7, onglet: 'apercu', chargement: 0, sessionValide: true };

  const $ = (id) => document.getElementById(id);

  // ── Formatage ────────────────────────────────────────────────────────────

  const nombre = new Intl.NumberFormat('fr-FR');
  const dateHeure = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });
  const heureSeule = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
  const jourCourt = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'short' });

  function heure(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : dateHeure.format(d);
  }
  function depuis(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const min = Math.round((Date.now() - d.getTime()) / 60000);
    if (min < 1) return 'à l’instant';
    if (min < 60) return `il y a ${min} min`;
    const h = Math.round(min / 60);
    if (h < 48) return `il y a ${h} h`;
    return `il y a ${Math.round(h / 24)} j`;
  }
  function valeur(v) {
    if (v === null || v === undefined) return '—';
    if (typeof v !== 'number') return String(v);
    return nombre.format(v);
  }
  function part(p) {
    if (p === null || p === undefined) return '—';
    return `${String(p).replace('.', ',')} %`;
  }
  function echapper(t) {
    if (t === null || t === undefined) return '';
    return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function jourLisible(iso) {
    const d = new Date(`${iso}T12:00:00Z`);
    return Number.isNaN(d.getTime()) ? iso : jourCourt.format(d);
  }
  function duree(min) {
    if (min === null || min === undefined) return '—';
    if (min < 60) return `${min} min`;
    const h = Math.floor(min / 60);
    return `${h} h ${String(min % 60).padStart(2, '0')}`;
  }

  // ── Micro-visualisations ─────────────────────────────────────────────────

  function eticelle(serie, jours) {
    if (!Array.isArray(serie) || !serie.length
        || serie.every((v) => v === null || v === undefined)) {
      return '<span class="eticelle eticelle--absente">aucun passage</span>';
    }
    const valeurs = serie.filter((v) => typeof v === 'number');
    const max = valeurs.length ? Math.max(...valeurs, 1) : 1;
    const barres = serie.map((v, i) => {
      const titre = `${jourLisible(jours[i])} : ${v === null ? 'aucun passage' : `${v} offre(s)`}`;
      if (v === null || v === undefined) return `<i data-vide="1" style="height:3px" title="${echapper(titre)}"></i>`;
      if (v === 0) return `<i data-zero="1" style="height:4px" title="${echapper(titre)}"></i>`;
      return `<i style="height:${Math.max(4, Math.round((v / max) * 18))}px" title="${echapper(titre)}"></i>`;
    });
    return `<span class="eticelle" aria-hidden="true">${barres.join('')}</span>`;
  }

  function serieVerdict(serie, jours) {
    const zone = $('verdict-serie');
    if (!Array.isArray(serie) || !serie.length) {
      zone.innerHTML = '';
      $('verdict-legende').textContent = 'Aucune exécution enregistrée sur la période';
      $('verdict-jours').innerHTML = '';
      return;
    }
    const max = Math.max(...serie.map((j) => j.runs || 0), 1);
    zone.innerHTML = serie.map((j, i) => {
      const libelle = `${jourLisible(jours[i])} : ${j.runs} passage(s), ${j.succes} réussi(s), ${j.echecs} en échec`;
      if (!j.runs) return `<div class="verdict__jour verdict__jour--vide" title="${echapper(libelle)}"></div>`;
      const hOk = j.succes ? Math.max(3, Math.round((j.succes / max) * 76)) : 0;
      const hKo = j.echecs ? Math.max(3, Math.round((j.echecs / max) * 76)) : 0;
      return `<div class="verdict__jour" title="${echapper(libelle)}">
        ${hOk ? `<span class="verdict__seg verdict__seg--ok" style="height:${hOk}px"></span>` : ''}
        ${hKo ? `<span class="verdict__seg verdict__seg--ko" style="height:${hKo}px"></span>` : ''}
      </div>`;
    }).join('');
    $('verdict-jours').innerHTML = jours.slice(-serie.length)
      .map((j) => `<span>${echapper(String(new Date(`${j}T12:00:00Z`).getUTCDate()))}</span>`).join('');
    const total = serie.reduce((s, j) => s + (j.runs || 0), 0);
    const echecs = serie.reduce((s, j) => s + (j.echecs || 0), 0);
    $('verdict-legende').textContent = `${nombre.format(total)} passages · ${nombre.format(echecs)} en échec`;
  }

  // ── Réseau ───────────────────────────────────────────────────────────────

  async function appeler(chemin, options) {
    const reponse = await fetch(API + chemin, {
      credentials: 'same-origin', headers: { Accept: 'application/json' }, ...(options || {})
    });
    if (reponse.status === 401) { basculerConnexion(false); throw new Error('Session requise'); }
    let corps = null;
    try { corps = await reponse.json(); } catch (e) { corps = null; }
    if (!reponse.ok) {
      const err = new Error((corps && corps.detail) || `HTTP ${reponse.status}`);
      err.statut = reponse.status;
      throw err;
    }
    return corps;
  }

  function bandeau(message, ton) {
    const zone = $('bandeau');
    if (!message) { zone.hidden = true; zone.textContent = ''; return; }
    zone.hidden = false;
    zone.dataset.ton = ton || 'inconnu';
    zone.textContent = message;
  }

  // ── Session ──────────────────────────────────────────────────────────────

  function basculerConnexion(connecte) {
    etat.sessionValide = connecte;
    $('contenu').hidden = !connecte;
    $('etat-initial').hidden = connecte;
    if (!connecte) { const c = $('cle'); if (c) c.focus(); }
  }

  async function soumettreConnexion(evenement) {
    evenement.preventDefault();
    const champ = $('cle');
    const zoneErreur = $('erreur-connexion');
    const bouton = evenement.target.querySelector('button');
    zoneErreur.textContent = '';
    bouton.disabled = true;
    try {
      const reponse = await fetch(`${API}/session`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: champ.value })
      });
      if (reponse.ok) { champ.value = ''; basculerConnexion(true); chargerTout(); return; }
      zoneErreur.textContent =
        reponse.status === 429 ? 'Trop de tentatives. Réessayez dans quelques minutes.'
          : reponse.status === 503 ? 'Le monitoring n’est pas configuré côté serveur.'
            : 'Clé refusée.';
      champ.value = ''; champ.focus();
    } catch (e) {
      zoneErreur.textContent = 'Service injoignable.';
    } finally { bouton.disabled = false; }
  }

  async function fermerSession() {
    try { await appeler('/session', { method: 'DELETE' }); } catch (e) { /* déjà expirée */ }
    basculerConnexion(false);
  }

  // ── Vue d'ensemble ───────────────────────────────────────────────────────

  // Seules ces mesures occupent la grille : les autres ne sont pas des
  // nombres, et les poser au même poids visuel aplatissait la hiérarchie.
  // `offres_publiees` n'est pas affiché : il vaut exactement `offres_coeur`
// (le prédicat de publication porte sur la classification). Deux fois le
// même nombre fait douter de la mesure. On montre l'entonnoir.
  const CHIFFRES_AFFICHES = ['offres_coeur', 'offres_actives', 'a_classer', 'nouveautes'];

  function rendreChiffres(cartes) {
    const retenues = CHIFFRES_AFFICHES
      .map((cle) => cartes.find((c) => c.key === cle))
      .filter(Boolean);

    $('chiffres').innerHTML = retenues.map((c) => {
      const indisponible = c.status === 'unavailable';
      const texte = typeof c.value === 'string';
      const corps = indisponible
        ? 'Non disponible'
        : `${echapper(valeur(c.value))}${c.unit ? ` <small>${echapper(c.unit)}</small>` : ''}`;
      return `<div class="chiffre" data-etat="${indisponible ? 'unavailable' : 'available'}" data-ton="${echapper(c.tone || 'neutre')}" data-type="${texte ? 'texte' : 'nombre'}">
        <p class="chiffre__etiquette">${echapper(c.label)}</p>
        <p class="chiffre__valeur">${corps}</p>
        <p class="chiffre__note">${echapper(indisponible ? (c.reason || 'Donnée absente') : (c.detail || ''))}</p>
      </div>`;
    }).join('');

    const indisponibles = cartes.filter((c) => c.status === 'unavailable');
    const note = $('note-mesures');
    if (!indisponibles.length) { note.hidden = true; note.textContent = ''; }
    else {
      note.hidden = false;
      note.innerHTML = 'Mesures non branchées : ' +
        indisponibles.map((c) => `<strong>${echapper(c.label)}</strong>`).join(', ') +
        '. Elles sont inconnues, pas nulles.';
    }
  }

  function rendreVerdict(donnees) {
    const c = donnees.collection;
    $('verdict').dataset.etat = c.statut;
    $('verdict-mot').textContent = { ok: 'Saine', degrade: 'Dégradée', rompu: 'Rompue' }[c.statut] || 'Indéterminée';
    $('verdict-phrase').textContent = c.diagnostic || '—';
    serieVerdict(donnees.serie || [], donnees.jours || []);
  }

  function rendreEtatService(probes) {
    const zone = $('etat-service');
    if (!probes) { zone.hidden = true; return; }
    const sondes = probes.sondes || [];
    const toutOk = (probes.base || {}).disponible !== false && sondes.every((s) => s.disponible);
    zone.hidden = false;
    zone.dataset.etat = toutOk ? 'ok' : 'critique';
    $('etat-service-texte').textContent = toutOk ? 'Service disponible' : 'Service dégradé';
    zone.title = sondes.map((s) => `${s.nom} : ${s.disponible ? 'ok' : 'injoignable'} (${s.latence_ms} ms)`).join(' · ');
  }

  /* Ligne du cron dans la vue d'ensemble. Elle répond à une question que
     la carte « sources récentes » ne pose pas : le passage prévu a-t-il eu
     lieu, et jusqu'à quand a-t-il tourné ? */
  function rendreLigneCron(cron) {
    const zone = $('ligne-cron');
    if (!cron) { zone.hidden = true; return; }
    zone.hidden = false;
    zone.dataset.etat = cron.statut;

    const libelle = { ok: 'terminé', en_cours: 'en cours', bloque: 'bloqué', retard: 'en retard', inconnu: 'inconnu' }[cron.statut] || cron.statut;
    const d = cron.dernier;
    const details = d
      ? `Dernier passage ${jourLisible(d.business_date_utc)} · ${heureSeule.format(new Date(d.started_at))}${d.finished_at ? ` → ${heureSeule.format(new Date(d.finished_at))}` : ' → non terminé'}`
      : 'Aucun passage enregistré';
    const prochain = cron.prochain
      ? `Prochain prévu ${jourLisible(cron.prochain.slice(0, 10))} à ${heureSeule.format(new Date(cron.prochain))} (UTC)`
      : '';

    zone.innerHTML = `
      <span class="ligne-cron__etat">
        <i class="temoin-etat"></i>Cron ${echapper(libelle)}
      </span>
      <span class="ligne-cron__detail">${echapper(details)}</span>
      ${prochain ? `<span class="ligne-cron__suite">${echapper(prochain)}</span>` : ''}
      <button type="button" class="lien" data-onglet="cron">Détail →</button>`;
  }

  function rendreSourcesApercu(donnees) {
    const zone = $('sources-apercu');
    const jours = donnees.jours || [];
    if (!donnees.sources || !donnees.sources.length) {
      zone.innerHTML = '<p class="vide">Aucune source activée lue.</p>';
      return;
    }
    const rang = { erreur: 0, bloquee: 1, jamais: 2, retard: 3, ok: 4 };
    const triees = [...donnees.sources].sort((a, b) => {
      const d = (rang[a.etat] ?? 9) - (rang[b.etat] ?? 9);
      return d !== 0 ? d : (b.total_found || 0) - (a.total_found || 0);
    });
    const libelles = { ok: 'à jour', retard: 'en retard', erreur: 'en erreur', bloquee: 'bloquée', jamais: 'jamais' };
    zone.innerHTML = triees.slice(0, 6).map((s) => {
      const ton = s.etat === 'ok' ? 'ok' : (s.etat === 'retard' ? 'attention' : 'critique');
      return `<div class="ligne-source">
        <span><span class="ligne-source__nom">${echapper(s.source_slug)}</span><span class="ligne-source__ats">${echapper(s.ats_type || '')}</span></span>
        ${eticelle(s.etincelle, jours)}
        <span class="pastille" data-etat="${ton}">${libelles[s.etat] || s.etat}</span>
      </div>`;
    }).join('');
  }

  function rendreAlertes(alertes, zone, limite) {
    const visibles = (alertes || []).filter((a) => !a.acquittee);
    if (!visibles.length) {
      zone.innerHTML = '<li class="vide">Aucune anomalie détectée sur la période.</li>';
      return;
    }
    zone.innerHTML = visibles.slice(0, limite || 100).map((a) => `
      <li class="alerte" data-gravite="${echapper(a.gravite)}" data-acquittee="false" data-cle="${echapper(a.key)}">
        <div class="alerte__corps">
          <p class="alerte__titre">${echapper(a.titre)}</p>
          ${a.detail ? `<p class="alerte__detail">${echapper(a.detail)}</p>` : ''}
        </div>
        <button type="button" class="alerte__ack" data-ack="${echapper(a.key)}">Prendre en charge</button>
      </li>`).join('');
  }

  async function chargerApercu() {
    const [apercu, sources, alertes] = await Promise.all([
      appeler(`/overview?period=${etat.periode}`),
      appeler(`/sources?period=${etat.periode}`),
      appeler(`/alerts?period=${etat.periode}`)
    ]);
    rendreVerdict(apercu);
    rendreEtatService(apercu.probes);
    rendreLigneCron(apercu.cron);
    rendreChiffres(apercu.cards);
    rendreSourcesApercu(sources);
    rendreAlertes(alertes.alertes, $('alertes-apercu'), 5);
    $('compte-alertes').textContent = `${alertes.ouverts} à traiter`;
    $('compte-alertes').title = `${alertes.ouverts} non prise(s) en charge sur ${alertes.total} anomalie(s) détectée(s)`;
    const c = apercu.collection;
    $('horodatage').textContent =
      `Données au ${heure(apercu.generated_at)} · ${c.sources_a_jour} sources à jour sur ${c.sources_attendues} · période ${apercu.period_days} jours`;
  }

  // ── Cron ─────────────────────────────────────────────────────────────────

  function rendreCron(d) {
    const r = d.resume;
    const dernier = d.dernier || {};
    const cartes = [
      {
        etiquette: 'Verdict', valeur: { ok: 'Terminé', en_cours: 'En cours', bloque: 'Bloqué', retard: 'En retard', inconnu: 'Inconnu' }[r.statut] || r.statut,
        note: r.diagnostic, ton: r.statut === 'ok' ? 'ok' : (r.statut === 'inconnu' ? 'neutre' : 'attention')
      },
      {
        etiquette: 'Dernier passage', valeur: duree(dernier.duree_minutes),
        note: dernier.started_at ? `${heure(dernier.started_at)} → ${dernier.finished_at ? heure(dernier.finished_at) : 'en cours'} ` : '—',
        ton: 'neutre'
      },
      {
        etiquette: 'Sources traitées', valeur: `${dernier.sources_traitees ?? 0} / ${dernier.sources_attendues ?? 0}`,
        note: r.prochain ? `Prochain prévu ${heure(r.prochain)}` : 'Aucun horaire configuré',
        ton: (dernier.sources_traitees === dernier.sources_attendues && dernier.sources_attendues) ? 'ok' : 'attention'
      }
    ];
    $('cron-chiffres').innerHTML = cartes.map((c) => `<div class="chiffre" data-ton="${c.ton}">
        <p class="chiffre__etiquette">${echapper(c.etiquette)}</p>
        <p class="chiffre__valeur" data-type="texte">${echapper(c.valeur)}</p>
        <p class="chiffre__note">${echapper(c.note || '')}</p>
      </div>`).join('');

    $('cron-mention').textContent = `horaires UTC : ${(r.horaires_utc || []).join(' h, ')} h`;

    const libellesEtat = { completed: ['terminé', 'ok'], open: ['ouvert', 'attention'], failed: ['échoué', 'critique'] };
    $('corps-batchs').innerHTML = d.batchs.length
      ? d.batchs.map((b) => {
        const [texte, ton] = libellesEtat[b.status] || [b.status, 'inconnu'];
        return `<tr>
          <td>${echapper(jourLisible(b.business_date_utc))}</td>
          <td><span class="pastille" data-etat="${ton}">${texte}</span></td>
          <td>${heure(b.started_at)}</td>
          <td>${b.finished_at ? heure(b.finished_at) : '—'}</td>
          <td class="num">${b.started_at && b.finished_at ? duree(Math.round((new Date(b.finished_at) - new Date(b.started_at)) / 60000)) : '—'}</td>
          <td class="num" title="${b.sources_attendues ? '' : 'Le passage n’a déclaré aucune source attendue'}">${b.sources_attendues ? b.sources_attendues : '—'}</td>
        </tr>`;
      }).join('')
      : '<tr><td colspan="6" class="vide">Aucun passage enregistré sur la période.</td></tr>';

    const par = d.work_items.par_statut || {};
    const total = d.work_items.total || 0;
    $('cron-items').textContent = total ? `${total} source(s)` : '';
    if (!total) {
      $('cron-repartition').innerHTML = '<p class="vide">Aucune source détaillée pour ce passage.</p>';
      return;
    }
    const entrees = Object.entries(par).sort((a, b) => b[1] - a[1]);
    const tonDe = (s) => (s === 'success' ? 'ok' : (s === 'error' || s === 'failed' ? 'critique' : 'attention'));
    $('cron-repartition').innerHTML = `
      <div class="barre-repartition" role="img" aria-label="${echapper(entrees.map(([s, n]) => `${n} ${s}`).join(', '))}">
        ${entrees.map(([s, n]) => `<span data-etat="${tonDe(s)}" style="width:${(100 * n) / total}%"></span>`).join('')}
      </div>
      <div class="repartition__legende">
        ${entrees.map(([s, n]) => `<span class="pastille" data-etat="${tonDe(s)}">${echapper(s)} · ${n}</span>`).join('')}
      </div>`;
  }

  async function chargerCron() {
    rendreCron(await appeler(`/cron?period=${etat.periode}`));
  }

  // ── Sources ──────────────────────────────────────────────────────────────

  function rendreTableauSources(donnees) {
    const corps = $('corps-sources');
    const jours = donnees.jours || [];
    if (!donnees.sources.length) {
      corps.innerHTML = '<tr><td colspan="5" class="vide">Aucune source activée lue.</td></tr>';
      return;
    }
    const libelles = { ok: ['à jour', 'ok'], retard: ['en retard', 'attention'], erreur: ['en erreur', 'critique'], bloquee: ['bloquée', 'critique'], jamais: ['jamais collectée', 'critique'] };
    const rang = { erreur: 0, bloquee: 1, jamais: 2, retard: 3, ok: 4 };
    const triees = [...donnees.sources].sort((a, b) => (rang[a.etat] ?? 9) - (rang[b.etat] ?? 9) || a.source_slug.localeCompare(b.source_slug));
    corps.innerHTML = triees.map((s) => {
      const [texte, ton] = libelles[s.etat] || ['inconnu', 'inconnu'];
      const erreur = s.erreur ? `<span class="message-erreur" title="${echapper(s.erreur)}">${echapper(s.erreur)}</span>` : '';
      return `<tr>
        <td><strong>${echapper(s.source_slug)}</strong>${s.ats_type ? `<span class="ligne-source__ats">${echapper(s.ats_type)}</span>` : ''}${erreur}</td>
        <td><span class="pastille" data-etat="${ton}">${texte}</span></td>
        <td class="col-serie">${eticelle(s.etincelle, jours)}</td>
        <td><span title="${s.dernier_succes ? echapper(heure(s.dernier_succes)) : ''}">${s.dernier_succes ? depuis(s.dernier_succes) : '—'}</span></td>
        <td class="num">${valeur(s.total_found)}</td>
      </tr>`;
    }).join('');
  }

  async function chargerCollecte() {
    const donnees = await appeler(`/sources?period=${etat.periode}`);
    rendreTableauSources(donnees);
    $('aide-collecte').textContent =
      `${donnees.verdict.diagnostic} Retard au-delà de ${donnees.verdict.seuils.retard_heures} h, blocage au-delà de ${donnees.verdict.seuils.blocage_heures} h.`;
  }

  // ── Offres ───────────────────────────────────────────────────────────────

  function rendreClassification(d) {
    const c = d.classification;
    const lignes = [
      ['Offres actives', valeur(c.actifs), 'neutre'],
      ['Cœur de cible', `${valeur(c.coeur)} <small>${part(c.part_coeur)}</small>`, 'ok'],
      ['Exclues', valeur(c.exclu), 'neutre'],
      ['À classer', `${valeur(c.a_classer)} <small>${part(c.part_a_classer)}</small>`, c.a_classer ? 'attention' : 'ok'],
      ['Classées', valeur(c.classes), 'neutre'],
      ['Curation en attente', valeur(c.curation_attente), c.curation_attente ? 'attention' : 'ok'],
      ['Cas limites', valeur(c.cas_limites), c.cas_limites ? 'attention' : 'ok'],
      ['Échecs de curation', valeur(c.curation_echec), c.curation_echec ? 'critique' : 'ok']
    ];
    $('bloc-classification').innerHTML =
      `<div class="grille-chiffres">${lignes.map(([k, v, ton]) => `
        <div class="mini-chiffre" data-ton="${ton}">
          <p class="mini-chiffre__etiquette">${echapper(k)}</p>
          <p class="mini-chiffre__valeur">${v}</p>
        </div>`).join('')}</div>` +
      (d.alertes.length
        ? `<ul class="constats">${d.alertes.map((a) => `<li data-gravite="${echapper(a.gravite)}">
            <strong>${echapper(a.titre)}</strong><span>${echapper(a.detail)}</span></li>`).join('')}</ul>`
        : '<p class="vide">Aucune anomalie de classification.</p>');
  }

  function rendreQualite(q) {
    $('corps-champs').innerHTML = q.champs.map((c) => `<tr>
      <td><code>${echapper(c.champ)}</code></td>
      <td class="num">${valeur(c.manquants)}</td>
      <td class="num">${part(c.part)}</td>
    </tr>`).join('');

    const ecart = q.ecart_coeur_publie;
    const lignes = [
      ['Offres publiées', valeur(q.published)],
      ['Liens vérifiés valides', valeur(q.liens.verifies_valides)],
      ['Liens non vérifiés', `${valeur(q.liens.non_verifies)} (${part(q.liens.part_non_verifies)})`],
      ['Écart cœur / publié', ecart.status === 'available' ? valeur(ecart.value) : 'non discriminant']
    ];
    $('detail-qualite').innerHTML = lignes.map(([k, v]) => `<dt>${echapper(k)}</dt><dd>${echapper(v)}</dd>`).join('');
    $('aide-offres').textContent = `${valeur(q.published)} offres publiées — les parts sont calculées sur ce total.`;
  }

  /* Les deux mesures de classification.
     Même échelle temporelle, même gabarit : deux graphiques qui se
     ressemblent mais ne disent pas la même chose. L'un rejoue l'état des
     offres à la fin de chaque journée — reconstitué. L'autre compte les
     décisions de chaque passage — mesuré, exact, et il ne commence qu'à
     l'instrumentation. Le dire est la moitié du travail. */

  // Complète une série sur la grille commune des jours. Un jour absent
  // n'est pas un zéro : c'est un jour sans donnée, et il se distingue.
  function _completerSurJours(serie, jours) {
    const parJour = new Map((serie || []).map((j) => [j.jour, j]));
    if (!jours || !jours.length) return serie || [];
    return jours.map((jour) => parJour.get(jour) || {
      jour,
      passages: 0,
      mesures: 0,
      creees: 0,
      classees: 0,
      non_classees: 0,
      sans_description: 0,
      sans_activite: true,
    });
  }

  // Un repère de dates sous les deux graphiques. Sans lui, deux échelles
  // temporelles différentes rendent la comparaison impossible.
  //
  // Sur un écran étroit, trente dates côte à côte sont illisibles : on
  // n'en montre qu'une sur cinq. La grille ne change pas — les colonnes
  // restent alignées — seule l'étiquette s'espace.
  function rendreDates(jours, zone) {
    if (!zone) return;
    const etroits = window.matchMedia('(max-width: 720px)').matches;
    const pas = etroits ? 7 : 1;
    zone.innerHTML = (jours || []).map((j, i) => {
      const d = new Date(`${j}T12:00:00Z`);
      const numero = Number.isNaN(d.getTime()) ? '' : String(d.getUTCDate());
      if (i % pas !== 0 && i !== (jours || []).length - 1) {
        return '<span aria-hidden="true"></span>';
      }
      return `<span title="${echapper(j)}">${echapper(numero)}</span>`;
    }).join('');
  }

  function rendreHistorique(historique, zone, legende, zoneDates) {
    if (!historique || !historique.length) {
      zone.innerHTML = '<p class="vide">Aucun historique disponible.</p>';
      legende.textContent = '';
      if (zoneDates) zoneDates.innerHTML = '';
      return;
    }
    const max = Math.max(...historique.map((j) => j.creees || 0), 1);
    // L'échelle porte l'unité : sans elle, la hauteur des barres n'a pas
    // de sens. C'est le maximum de la série, pas un maximum théorique.
    zone.innerHTML = `<span class="mesure__echelle" aria-hidden="true">max ${nombre.format(max)}</span>`
      + historique.map((j) => {
        // Un jour sans création n'est pas une barre à zéro : c'est un
        // jour sans activité. La différence se voit — un point, pas une
        // colonne — et surtout pas une barre « 0 % classées ».
        if (j.sans_activite || !j.creees) {
          const titre = `${j.jour} : aucune offre créée`;
          return `<div class="mesure__colonne" data-sans-activite="true" title="${echapper(titre)}"></div>`;
        }
        const crees = j.creees || 0;
        const classees = j.classees || 0;
        const hTotal = Math.max(6, Math.round((crees / max) * 88));
        const hClasse = Math.round((classees / Math.max(crees, 1)) * hTotal);
        const hReste = Math.max(0, hTotal - hClasse);
        const part = j.part_classee === null || j.part_classee === undefined
          ? '—'
          : `${j.part_classee} %`;
        const titre = `${j.jour} : ${classees} classée(s) sur ${crees} créée(s) — ${part}`;
        return `<div class="mesure__colonne" title="${echapper(titre)}">
          ${hReste ? `<span class="mesure__part" data-etat="non-classe" style="height:${hReste}px"></span>` : ''}
          ${hClasse ? `<span class="mesure__part" data-etat="classe" style="height:${hClasse}px"></span>` : ''}
        </div>`;
      }).join('');

    const totalCrees = historique.reduce((s, j) => s + (j.creees || 0), 0);
    const totalClasses = historique.reduce((s, j) => s + (j.classees || 0), 0);
    const part = totalCrees ? Math.round((100 * totalClasses) / totalCrees) : null;
    const sansActivite = historique.filter((j) => j.sans_activite || !j.creees).length;
    legende.innerHTML = `<span>${nombre.format(totalCrees)} créées · ${nombre.format(totalClasses)} classées</span>
      <span class="mesure__cle"><i data-etat="classe"></i>classées<i data-etat="non-classe"></i>non classées</span>
      <span>${part === null ? '—' : `${part} % classées`}</span>
      ${sansActivite ? `<span>${sansActivite} jour(s) sans création</span>` : ''}`;
    rendreDates(historique.map((j) => j.jour), zoneDates);
  }

  /* Mesure par passage : ce que chaque passage a produit. Un jour dont
     les passages ne portent pas de compteur n'est pas mesuré : le point
     le dit, et la légende l'annonce. */
  function rendrePassages(serie, zone, legende, zoneDates) {
    if (!serie || !serie.length) {
      zone.innerHTML = '<p class="vide">Aucune mesure disponible.</p>';
      legende.textContent = '';
      if (zoneDates) zoneDates.innerHTML = '';
      return 0;
    }
    const max = Math.max(...serie.map((j) => j.classees || 0), 1);
    zone.innerHTML = `<span class="mesure__echelle" aria-hidden="true">max ${nombre.format(max)}</span>`
      + serie.map((j) => {
        const nonMesure = j.passages > 0 && j.mesures === 0;
        const titre = nonMesure
          ? `${j.jour} : ${j.passages} passage(s), non mesuré(s)`
          : `${j.jour} : ${j.classees} décision(s) sur ${j.mesures} passage(s) mesuré(s)`;
        const h = Math.max(3, Math.round(((j.classees || 0) / max) * 88));
        return `<div class="mesure__colonne" data-non-mesure="${nonMesure}" title="${echapper(titre)}">
          ${j.classees ? `<span class="mesure__part" data-etat="classe" style="height:${h}px"></span>` : ''}
        </div>`;
      }).join('');

    const nonMesures = serie.filter((j) => j.passages > 0 && j.mesures === 0).length;
    const mesures = serie.filter((j) => j.mesures > 0).length;
    // La légende doit dire ce que CHAQUE signe veut dire. Sans la clé du
    // point « non mesuré », un lecteur prend le point pour une barre à
    // zéro — et la conclusion inverse, « la cascade a tourné et n'a rien
    // décidé », alors que personne ne l'a mesuré.
    legende.innerHTML = `<span>${mesures} jour(s) mesuré(s)</span>
      <span class="mesure__cle"><i data-etat="classe"></i>décisions de classification</span>
      ${nonMesures ? `<span class="mesure__cle"><i data-etat="non-mesure"></i>non mesuré</span>` : ''}`;
    rendreDates(serie.map((j) => j.jour), zoneDates);
    return nonMesures;
  }


  async function chargerOffres() {
    const [qualite, classification] = await Promise.all([
      appeler('/quality'),
      appeler('/classification')
    ]);
    rendreClassification(classification);
    rendreQualite(qualite);

    const historique = classification.historique || [];
    const serie = classification.mesure_par_passage || [];

    // Deux graphiques côte à côte ne se comparent que s'ils partagent
    // leurs abscisses. L'API renvoie les deux séries sur la même grille
    // de jours ; si l'une des deux manque, on complète avec des jours
    // vides pour que les colonnes restent alignées.
    const jours = classification.jours || [];
    const historiqueAligne = _completerSurJours(historique, jours);
    const serieAligne = _completerSurJours(serie, jours);

    rendreHistorique(
      historiqueAligne, $('graphique-historique'), $('legende-historique'), $('dates-historique')
    );

    const nonMesures = rendrePassages(
      serieAligne, $('graphique-passages'), $('legende-passages'), $('dates-passages')
    );

    // Le passage mesure exactement, mais seulement depuis
    // l'instrumentation. Les jours qui précèdent ne sont pas « à zéro » :
    // ils sont inconnus, et le dire vaut mieux que le laisser vide.
    const mention = $('mesure-mention');
    const depuis = classification.instrumentation_depuis;
    if (nonMesures) {
      mention.textContent = depuis
        ? `${nonMesures} jour(s) sans mesure — mesurée depuis le ${jourLisible(depuis)}`
        : `${nonMesures} jour(s) sans mesure — la mesure exacte n’a pas encore commencé`;
    } else if (depuis) {
      mention.textContent = `Mesurée depuis le ${jourLisible(depuis)}`;
    } else {
      mention.textContent = 'Aucun passage n’a encore mesuré la classification';
    }

    // L'avertissement n'est pas un détail : les deux graphiques n'ont pas
    // la même portée, et les lire comme s'ils en avaient une revient à
    // confondre une reconstitution avec une mesure.
    const avertissement = $('mesure-avertissement');
    if (avertissement) {
      const portee = depuis
        ? `L’historique est reconstitué et couvre ${historique.length} jour(s). La mesure par passage est exacte, mais ne commence que le ${jourLisible(depuis)} : avant cette date, elle n’est pas « à zéro », elle est inconnue.`
        : `L’historique est reconstitué et couvre ${historique.length} jour(s). La mesure par passage n’a pas encore produit de donnée : elle est non instrumentée, pas nulle.`;
      avertissement.innerHTML = `<span aria-hidden="true">⚠</span><span>${echapper(portee)}</span>`;
      avertissement.hidden = false;
    }
  }

  // ── Blocs indisponibles (indexation, audience) ───────────────────────────

  function rendreIndisponible(zone, d, complement) {
    zone.innerHTML = `
      <div class="panneau">
        <div class="absent">
          <p class="surtitre">Non disponible</p>
          <p class="absent__titre">Cette mesure n’est pas branchée</p>
          <p class="absent__texte">${echapper(d.reason)}</p>
          ${d.a_faire && d.a_faire.length ? `<ol class="a-faire">${d.a_faire.map((x) => `<li>${echapper(x)}</li>`).join('')}</ol>` : ''}
        </div>
      </div>
      ${complement || ''}`;
  }

  async function chargerIndexation() {
    const d = await appeler('/indexation');
    const mesure = d.ce_qui_est_mesure || {};
    const complement = `
      <div class="panneau">
        <header class="panneau__tete">
          <h3 class="panneau__titre">Ce qui est vérifiable sans Google</h3>
        </header>
        <dl class="faits">
          <dt>Fiches publiées</dt><dd>${valeur(mesure.fiches_publiees)}</dd>
          ${(mesure.sondes || []).map((s) => `<dt>${echapper(s.nom)}</dt>
            <dd>${s.disponible ? `<span class="pastille" data-etat="ok">${s.code}</span>` : '<span class="pastille" data-etat="critique">injoignable</span>'}</dd>`).join('')}
        </dl>
      </div>`;
    rendreIndisponible($('bloc-indexation'), d, complement);
  }

  async function chargerAudience() {
    rendreIndisponible($('bloc-audience'), await appeler('/analytics'));
  }

  // ── Exploitation ─────────────────────────────────────────────────────────

  function rendreExploitation(d) {
    $('corps-sondes').innerHTML = d.probes.map((p) => `<tr>
      <td>${echapper(p.nom)}</td>
      <td><span class="pastille" data-etat="${p.disponible ? 'ok' : 'critique'}">${p.disponible ? 'disponible' : 'injoignable'}</span></td>
      <td class="num">${p.code == null ? '—' : p.code}</td>
      <td class="num">${p.latence_ms == null ? '—' : `${p.latence_ms} ms`}</td>
      <td>${depuis(p.verifie_le)}</td>
    </tr>`).join('');

    const manques = [];
    if (d.sauvegarde.status === 'unavailable') manques.push(`<strong>Sauvegarde</strong> — ${echapper(d.sauvegarde.reason)}.`);
    if (d.couts.status === 'unavailable') manques.push(`<strong>Coûts</strong> — ${echapper(d.couts.reason)}.`);
    $('operations-vide').innerHTML = manques.length
      ? `${manques.join('<br>')}<br><span style="opacity:.75">Ces blocs s’activeront quand la preuve sera exposée par l’API.</span>`
      : 'Sauvegarde et coûts disponibles.';
  }

  async function chargerExploitation() {
    rendreExploitation(await appeler('/operations'));
  }

  // ── Acquittement ─────────────────────────────────────────────────────────

  async function acquitter(cle, bouton) {
    bouton.disabled = true;
    bouton.textContent = '…';
    try {
      await appeler(`/alerts/${encodeURIComponent(cle)}/ack`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
      });
      const item = bouton.closest('.alerte');
      if (item) item.dataset.acquittee = 'true';
      bouton.textContent = 'Pris en charge';
    } catch (e) {
      bouton.disabled = false;
      bouton.textContent = 'Réessayer';
      bandeau(`Acquittement non enregistré — ${e.message}`, 'attention');
    }
  }

  // ── Orchestration ────────────────────────────────────────────────────────

  const CHARGEURS = {
    apercu: chargerApercu,
    cron: chargerCron,
    collecte: chargerCollecte,
    offres: chargerOffres,
    indexation: chargerIndexation,
    audience: chargerAudience,
    exploitation: chargerExploitation
  };

  async function chargerTout() {
    const numero = ++etat.chargement;
    bandeau('');
    const bouton = $('rafraichir');
    bouton.disabled = true;
    try {
      await (CHARGEURS[etat.onglet] || chargerApercu)();
      if (etat.onglet !== 'apercu') await chargerApercu().catch(() => {});
    } catch (err) {
      if (err.message === 'Session requise') return;
      if (numero === etat.chargement) {
        bandeau(`Chargement incomplet — ${err.message}. Les valeurs affichées peuvent être anciennes.`, 'attention');
      }
    } finally { bouton.disabled = false; }
  }

  function choisirOnglet(nom) {
    etat.onglet = nom;
    document.querySelectorAll('[role="tab"]').forEach((b) => {
      const actif = b.id === `onglet-${nom}`;
      b.setAttribute('aria-selected', String(actif));
      b.tabIndex = actif ? 0 : -1;
    });
    document.querySelectorAll('[role="tabpanel"]').forEach((p) => { p.hidden = p.id !== `panneau-${nom}`; });
    chargerTout();
  }

  function brancher() {
    document.querySelectorAll('[role="tab"]').forEach((bouton) => {
      bouton.addEventListener('click', () => choisirOnglet(bouton.id.replace('onglet-', '')));
      bouton.addEventListener('keydown', (e) => {
        const onglets = [...document.querySelectorAll('[role="tab"]')];
        const i = onglets.indexOf(bouton);
        let cible = null;
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') cible = onglets[(i + 1) % onglets.length];
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') cible = onglets[(i - 1 + onglets.length) % onglets.length];
        if (cible) { e.preventDefault(); cible.focus(); cible.click(); }
      });
    });

    document.querySelectorAll('[data-periode]').forEach((b) => {
      b.addEventListener('click', () => {
        etat.periode = Number(b.dataset.periode) || 7;
        document.querySelectorAll('[data-periode]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        chargerTout();
      });
    });

    $('rafraichir').addEventListener('click', chargerTout);
    $('deconnexion').addEventListener('click', fermerSession);

    // Délégation : les boutons et les liens sont recréés à chaque rendu.
    document.addEventListener('click', (e) => {
      const ack = e.target.closest('[data-ack]');
      if (ack) { acquitter(ack.dataset.ack, ack); return; }
      const onglet = e.target.closest('[data-onglet]');
      if (onglet) choisirOnglet(onglet.dataset.onglet);
    });

    const formulaire = $('connexion');
    if (formulaire) formulaire.addEventListener('submit', soumettreConnexion);

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && etat.sessionValide) chargerTout();
    });
  }

  async function demarrer() {
    brancher();
    try {
      const s = await appeler('/session');
      basculerConnexion(Boolean(s.authenticated));
      if (s.authenticated) chargerTout();
    } catch (err) {
      if (err.message !== 'Session requise') {
        bandeau('Le service de monitoring ne répond pas. Réessayez dans un instant.', 'critique');
      }
      basculerConnexion(false);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
