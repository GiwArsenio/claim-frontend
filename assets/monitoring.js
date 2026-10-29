// ─────────────────────────────────────────────────────────────────────────────
// CLAIM! — client du dashboard de monitoring
//
// Quatre règles tiennent ce fichier, et elles expliquent presque tout :
//
// 1. Une donnée absente ne s'affiche jamais comme zéro. L'API le dit
//    (`status: "unavailable"`) ; l'interface écrit « Non disponible » et
//    la raison. Un 0 ferait croire à une absence d'activité.
// 2. Une réponse tardive ne remplace jamais une réponse récente. Chaque
//    chargement porte un numéro ; seul le dernier a le droit d'écrire.
// 3. Un échec de chargement conserve l'affichage précédent et le signale.
//    Vider l'écran donnerait l'impression d'un service sans données.
// 4. Un jour sans passage n'est pas un jour à zéro. Les séries
//    distinguent `null` (aucun passage) de `0` (passage, rien trouvé) :
//    c'est la différence entre « je n'ai pas regardé » et « j'ai regardé,
//    il n'y avait rien ».
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  const API = '/monitoring/api';
  const etat = {
    periode: 7,
    onglet: 'apercu',
    chargement: 0,
    sessionValide: true,
    donnees: {}
  };

  const $ = (id) => document.getElementById(id);

  // ── Formatage ────────────────────────────────────────────────────────────

  const nombre = new Intl.NumberFormat('fr-FR');
  const dateHeure = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });
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
    // `null` n'est pas `0`. Le tiret cadratin est le signe conventionnel
    // d'une donnée absente dans un tableau.
    if (v === null || v === undefined) return '—';
    // Certaines cartes ne portent pas un nombre mais un état (« Disponible »).
    // Les passer au formateur numérique affichait « NaN » — un défaut vu au
    // premier rendu réel, pas en test.
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

  // ── Micro-visualisations ─────────────────────────────────────────────────

  /* Éticelle : sept jours de volume pour une source.
     Trois états visuels, et trois seulement :
       - une barre    : volume mesuré (hauteur proportionnelle)
       - un trait gris: aucun passage ce jour-là (donnée absente)
       - un trait ambre : passage effectué, zéro offre (anomalie possible) */
  function eticelle(serie, jours) {
    if (!Array.isArray(serie) || !serie.length
        || serie.every((v) => v === null || v === undefined)) {
      return '<span class="eticelle eticelle--absente">aucun passage</span>';
    }
    const valeurs = serie.filter((v) => typeof v === 'number');
    const max = valeurs.length ? Math.max(...valeurs, 1) : 1;
    const barres = serie.map((v, i) => {
      const titre = `${jourLisible(jours[i])} : ${v === null ? 'aucun passage' : `${v} offre(s)`}`;
      if (v === null || v === undefined) {
        return `<i data-vide="1" style="height:2px" title="${echapper(titre)}"></i>`;
      }
      if (v === 0) {
        return `<i data-zero="1" style="height:3px" title="${echapper(titre)}"></i>`;
      }
      const h = Math.max(4, Math.round((v / max) * 18));
      return `<i style="height:${h}px" title="${echapper(titre)}"></i>`;
    });
    return `<span class="eticelle" aria-hidden="true">${barres.join('')}</span>`;
  }

  /* Bandeau de verdict : une colonne par jour, empilant réussites et
     échecs. La hauteur est proportionnelle au nombre d'exécutions, ce qui
     rend une journée creuse lisible comme creuse. */
  function serieVerdict(serie, jours) {
    const zone = $('verdict-serie');
    if (!Array.isArray(serie) || !serie.length) {
      zone.innerHTML = '';
      $('verdict-legende').textContent = 'Aucune exécution enregistrée sur la période';
      return;
    }
    const max = Math.max(...serie.map((j) => j.runs || 0), 1);
    zone.innerHTML = serie
      .map((j, i) => {
        const libelle = `${jourLisible(jours[i])} : ${j.runs} passage(s), ${j.succes} réussi(s), ${j.echecs} en échec`;
        if (!j.runs) {
          return `<div class="verdict__jour verdict__jour--vide" title="${echapper(libelle)}"></div>`;
        }
        // Un segment non nul garde toujours 3 px : deux échecs sur cent
        // vingt-neuf passages doivent rester visibles. Sans plancher, ils
        // se réduisaient à un filet d'un pixel, qu'on prenait pour un
        // artefact de rendu.
        const hOk = j.succes ? Math.max(3, Math.round((j.succes / max) * 76)) : 0;
        const hKo = j.echecs ? Math.max(3, Math.round((j.echecs / max) * 76)) : 0;
        // Les réussites reposent sur la ligne de base, les échecs
        // s'empilent au-dessus : on lit « combien a échoué par-dessus ce
        // qui a marché », pas l'inverse.
        return `<div class="verdict__jour" title="${echapper(libelle)}">
          ${hOk ? `<span class="verdict__seg verdict__seg--ok" style="height:${hOk}px"></span>` : ''}
          ${hKo ? `<span class="verdict__seg verdict__seg--ko" style="height:${hKo}px"></span>` : ''}
        </div>`;
      })
      .join('');
    $('verdict-jours').innerHTML = jours
      .slice(-serie.length)
      .map((j) => `<span>${echapper(String(new Date(`${j}T12:00:00Z`).getUTCDate()))}</span>`)
      .join('');

    const total = serie.reduce((s, j) => s + (j.runs || 0), 0);
    const echecs = serie.reduce((s, j) => s + (j.echecs || 0), 0);
    $('verdict-legende').textContent = `${nombre.format(total)} passages · ${nombre.format(echecs)} en échec`;
  }

  // ── Réseau ───────────────────────────────────────────────────────────────

  async function appeler(chemin, options) {
    const reponse = await fetch(API + chemin, {
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
      ...(options || {})
    });
    if (reponse.status === 401) {
      basculerConnexion(false);
      throw new Error('Session requise');
    }
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: champ.value })
      });
      if (reponse.ok) {
        champ.value = '';
        basculerConnexion(true);
        chargerTout();
        return;
      }
      zoneErreur.textContent =
        reponse.status === 429 ? 'Trop de tentatives. Réessayez dans quelques minutes.'
          : reponse.status === 503 ? 'Le monitoring n’est pas configuré côté serveur.'
            : 'Clé refusée.';
      champ.value = '';
      champ.focus();
    } catch (e) {
      zoneErreur.textContent = 'Service injoignable.';
    } finally {
      bouton.disabled = false;
    }
  }

  async function fermerSession() {
    try { await appeler('/session', { method: 'DELETE' }); } catch (e) { /* déjà expirée */ }
    basculerConnexion(false);
  }

  // ── Vue d'ensemble ───────────────────────────────────────────────────────

  const ORDRE_CHIFFRES = ['offres_publiees', 'nouveautes', 'a_classer', 'sources_recentes', 'service', 'recherches_vides'];
  // `service` et `recherches_vides` ne sont pas des nombres : le premier
  // part dans la barre supérieure, le second dans la note sous la grille.

  /* Séparation des mesures et des états.
     « Disponible » n'est pas un chiffre : le poser au même corps qu'un
     « 334 » mettait un statut système et un volume au même poids visuel.
     Les états vont dans la barre supérieure, les mesures non branchées
     sous la ligne, et seuls les nombres restent dans la grille. */
  function rendreChiffres(cartes) {
    const estNombre = (c) => typeof c.value === 'number' && c.status !== 'unavailable';
    const nombres = [...cartes]
      .filter(estNombre)
      .sort((a, b) => (ORDRE_CHIFFRES.indexOf(a.key) + 1 || 99) - (ORDRE_CHIFFRES.indexOf(b.key) + 1 || 99));
    const autres = cartes.filter((c) => !estNombre(c));

    $('chiffres').innerHTML = nombres
      .map((c) => {
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
      })
      .join('');

    const indisponibles = autres.filter((c) => c.status === 'unavailable');
    const note = $('note-mesures');
    if (!indisponibles.length) {
      note.hidden = true;
      note.textContent = '';
    } else {
      note.hidden = false;
      note.innerHTML = 'Mesures non branchées : ' +
        indisponibles.map((c) => `<strong>${echapper(c.label)}</strong>`).join(', ') +
        '. Elles sont inconnues, pas nulles.';
    }
  }

  function rendreEtatService(probes) {
    const zone = $('etat-service');
    const texte = $('etat-service-texte');
    if (!probes) { zone.hidden = true; return; }
    const sondes = probes.sondes || [];
    const base = probes.base || {};
    const toutOk = base.disponible !== false && sondes.every((s) => s.disponible);
    zone.hidden = false;
    zone.dataset.etat = toutOk ? 'ok' : 'critique';
    texte.textContent = toutOk ? 'Service disponible' : 'Service dégradé';
    zone.title = sondes.map((s) => `${s.nom} : ${s.disponible ? 'ok' : 'injoignable'} (${s.latence_ms} ms)`).join(' · ') || '';
  }

  function rendreVerdict(donnees) {
    const c = donnees.collection;
    const bloc = $('verdict');
    const libelle = { ok: 'Saine', degrade: 'Dégradée', rompu: 'Rompue' }[c.statut] || 'Indéterminée';
    bloc.dataset.etat = c.statut;
    $('verdict-mot').textContent = libelle;
    $('verdict-phrase').textContent = c.diagnostic || '—';
    serieVerdict(donnees.serie || [], donnees.jours || []);
  }

  function rendreSourcesApercu(donnees) {
    const zone = $('sources-apercu');
    const jours = donnees.jours || [];
    if (!donnees.sources || !donnees.sources.length) {
      zone.innerHTML = '<p class="vide">Aucune source activée lue.</p>';
      return;
    }
    // Priorité aux anomalies ; à défaut, les six plus gros volumes.
    const rang = { erreur: 0, bloquee: 1, jamais: 2, retard: 3, ok: 4 };
    const triees = [...donnees.sources].sort((a, b) => {
      const d = (rang[a.etat] ?? 9) - (rang[b.etat] ?? 9);
      if (d !== 0) return d;
      const va = (a.total_found || 0), vb = (b.total_found || 0);
      return vb - va;
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

  async function chargerApercu() {
    const [apercu, sources, alertes] = await Promise.all([
      appeler(`/overview?period=${etat.periode}`),
      appeler(`/sources?period=${etat.periode}`),
      appeler(`/alerts?period=${etat.periode}`)
    ]);

    rendreVerdict(apercu);
    rendreEtatService(apercu.probes);
    rendreChiffres(apercu.cards);
    rendreSourcesApercu(sources);
    rendreAlertes(alertes.alertes, $('alertes-apercu'), 5);
    $('compte-alertes').textContent = `${alertes.ouverts} ouverte(s) / ${alertes.total}`;

    const c = apercu.collection;
    $('horodatage').textContent =
      `Données au ${heure(apercu.generated_at)} · ${c.sources_a_jour} sources à jour sur ${c.sources_attendues} · période ${apercu.period_days} jours`;

    etat.donnees.apercu = { apercu, sources, alertes };
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

  // ── Collecte ─────────────────────────────────────────────────────────────

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

  // ── Qualité ──────────────────────────────────────────────────────────────

  function rendreQualite(d) {
    $('corps-champs').innerHTML = d.champs.map((c) => `<tr>
      <td><code>${echapper(c.champ)}</code></td>
      <td class="num">${valeur(c.manquants)}</td>
      <td class="num">${part(c.part)}</td>
    </tr>`).join('');

    const ecart = d.ecart_coeur_publie;
    const lignes = [
      ['Offres publiées', valeur(d.published)],
      ['Cœur de cible actif', valeur(d.classification.coeur)],
      ['Exclues actives', valeur(d.classification.exclu)],
      ['Part du cœur', part(d.classification.part_coeur)],
      ['En attente de classement', valeur(d.classification.a_classer)],
      ['Liens vérifiés valides', valeur(d.liens.verifies_valides)],
      ['Liens non vérifiés', `${valeur(d.liens.non_verifies)} (${part(d.liens.part_non_verifies)})`],
      ['Écart cœur / publié', ecart.status === 'available' ? valeur(ecart.value) : 'non discriminant']
    ];
    $('detail-qualite').innerHTML = lignes
      .map(([k, v]) => `<dt>${echapper(k)}</dt><dd>${echapper(v)}</dd>`).join('');

    $('aide-qualite').textContent = `${valeur(d.published)} offres publiées — les parts sont calculées sur ce total.`;
  }

  async function chargerQualite() {
    rendreQualite(await appeler('/quality'));
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
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
    collecte: chargerCollecte,
    qualite: chargerQualite,
    usage: async () => {},
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
    } finally {
      bouton.disabled = false;
    }
  }

  function choisirOnglet(nom) {
    etat.onglet = nom;
    document.querySelectorAll('[role="tab"]').forEach((b) => {
      const actif = b.id === `onglet-${nom}`;
      b.setAttribute('aria-selected', String(actif));
      b.tabIndex = actif ? 0 : -1;
    });
    document.querySelectorAll('[role="tabpanel"]').forEach((p) => {
      p.hidden = p.id !== `panneau-${nom}`;
    });
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

    document.querySelectorAll('[data-onglet]').forEach((b) => {
      b.addEventListener('click', () => choisirOnglet(b.dataset.onglet));
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

    // Délégation : les boutons d'acquittement sont recréés à chaque rendu.
    document.addEventListener('click', (e) => {
      const bouton = e.target.closest('[data-ack]');
      if (bouton) acquitter(bouton.dataset.ack, bouton);
    });

    const formulaire = $('connexion');
    if (formulaire) formulaire.addEventListener('submit', soumettreConnexion);

    // Rafraîchissement au retour sur l'onglet, sans boucle de polling :
    // un dashboard interne n'a pas à interroger le serveur chaque minute.
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
