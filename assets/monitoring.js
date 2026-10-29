// ─────────────────────────────────────────────────────────────────────────────
// CLAIM! — client du dashboard de monitoring
//
// Trois principes gouvernent ce fichier, et ils expliquent la plupart des
// choix de code ci-dessous :
//
// 1. Une donnée absente ne s'affiche jamais comme zéro. L'API le dit
//    (`status: "unavailable"`) ; l'interface doit le rendre lisible, pas
//    convertir `null` en `0`.
// 2. Une réponse tardive ne remplace jamais une réponse récente. Chaque
//    chargement porte un numéro ; seul le dernier a le droit d'écrire.
// 3. Une erreur de chargement conserve l'affichage précédent et le signale.
//    Vider l'écran donnerait l'impression d'un service sans données.
// ─────────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  const API = '/monitoring/api';
  const etat = {
    periode: 7,
    onglet: 'apercu',
    chargement: 0,
    dernieres: {},
    sessionValide: true
  };

  const $ = (id) => document.getElementById(id);

  // ── Utilitaires ──────────────────────────────────────────────────────────

  const formatNombre = new Intl.NumberFormat('fr-FR');
  const formatDate = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'short',
    timeStyle: 'short'
  });

  function heure(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return formatDate.format(d);
  }

  function depuis(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    const minutes = Math.round((Date.now() - d.getTime()) / 60000);
    if (minutes < 1) return 'à l’instant';
    if (minutes < 60) return `il y a ${minutes} min`;
    const h = Math.round(minutes / 60);
    if (h < 48) return `il y a ${h} h`;
    return `il y a ${Math.round(h / 24)} j`;
  }

  function valeur(entier) {
    if (entier === null || entier === undefined) return '—';
    return formatNombre.format(entier);
  }

  function pourcent(part) {
    // `null` signifie « dénominateur nul », pas « 0 % ».
    if (part === null || part === undefined) return '—';
    return `${String(part).replace('.', ',')} %`;
  }

  function echapper(texte) {
    if (texte === null || texte === undefined) return '';
    return String(texte)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function pastille(libelle, etatPastille) {
    return `<span class="pastille" data-etat="${etatPastille}">${echapper(libelle)}</span>`;
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
    try {
      corps = await reponse.json();
    } catch (e) {
      corps = null;
    }

    if (!reponse.ok) {
      const detail = (corps && corps.detail) || `HTTP ${reponse.status}`;
      const erreur = new Error(detail);
      erreur.statut = reponse.status;
      throw erreur;
    }
    return corps;
  }

  function bandeau(message, ton) {
    const zone = $('bandeau');
    if (!message) {
      zone.hidden = true;
      zone.textContent = '';
      return;
    }
    zone.hidden = false;
    zone.dataset.ton = ton || 'inconnu';
    zone.textContent = message;
  }

  // ── Session ──────────────────────────────────────────────────────────────

  function basculerConnexion(connecte) {
    etat.sessionValide = connecte;
    $('contenu').hidden = !connecte;
    $('etat-initial').hidden = connecte;
    if (!connecte) {
      const champ = $('cle');
      if (champ) champ.focus();
    }
  }

  async function ouvrirSessionDepuisFormulaire(evenement) {
    evenement.preventDefault();
    const champ = $('cle');
    const erreur = $('erreur-connexion');
    erreur.textContent = '';
    const bouton = evenement.target.querySelector('button');
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
      erreur.textContent =
        reponse.status === 429
          ? 'Trop de tentatives. Réessayez dans quelques minutes.'
          : 'Clé refusée.';
      champ.value = '';
      champ.focus();
    } catch (e) {
      erreur.textContent = 'Service injoignable.';
    } finally {
      bouton.disabled = false;
    }
  }

  async function fermerSession() {
    try {
      await appeler('/session', { method: 'DELETE' });
    } catch (e) {
      // La session est peut-être déjà expirée : on bascule quand même.
    }
    basculerConnexion(false);
  }

  // ── Rendu : vue d'ensemble ───────────────────────────────────────────────

  function rendreCartes(cartes) {
    const zone = $('cartes');
    zone.innerHTML = cartes
      .map((c) => {
        const indisponible = c.status === 'unavailable';
        const affichage = indisponible
          ? 'Non disponible'
          : `${valeur(c.value)}${c.unit ? ` <small>${echapper(c.unit)}</small>` : ''}`;
        return `
          <article class="carte" data-ton="${echapper(c.tone || 'neutre')}" data-etat="${indisponible ? 'unavailable' : 'available'}">
            <p class="carte__libelle">${echapper(c.label)}</p>
            <p class="carte__valeur">${affichage}</p>
            <p class="carte__detail">${echapper(indisponible ? (c.reason || 'Donnée absente') : (c.detail || ''))}</p>
            ${c.href && !indisponible ? `<a class="carte__lien" href="${echapper(c.href)}">Voir le détail →</a>` : ''}
          </article>`;
      })
      .join('');
  }

  function rendreAlertes(alertes) {
    const zone = $('alertes-apercu');
    if (!alertes || !alertes.length) {
      zone.innerHTML = '<li class="vide">Aucune anomalie détectée sur la période.</li>';
      return;
    }
    // La vue d'ensemble montre les cinq premières non acquittées : c'est
    // un point d'entrée, pas un journal.
    const visibles = alertes.filter((a) => !a.acquittee).slice(0, 5);
    if (!visibles.length) {
      zone.innerHTML = '<li class="vide">Toutes les anomalies sont prises en charge.</li>';
      return;
    }
    zone.innerHTML = visibles
      .map(
        (a) => `
      <li class="alerte" data-acquittee="false">
        <div class="alerte__corps">
          <p class="alerte__titre">${echapper(a.titre)}</p>
          <p class="alerte__detail">${echapper(a.detail || '')}</p>
        </div>
        <div class="alerte__actions">${pastille(a.gravite === 'critique' ? 'Critique' : 'À surveiller', a.gravite === 'critique' ? 'critique' : 'attention')}</div>
      </li>`
      )
      .join('');
  }

  async function chargerApercu() {
    const donnees = await appeler(`/overview?period=${etat.periode}`);
    rendreCartes(donnees.cards);
    const alertes = await appeler(`/alerts?period=${etat.periode}`);
    rendreAlertes(alertes.alertes);
    $('note-alertes').textContent = `${alertes.ouverts} anomalie(s) non prise(s) en charge sur ${alertes.total}.`;

    const collecte = donnees.collection;
    const verdict = $('verdict-collecte');
    verdict.hidden = false;
    verdict.dataset.ton = collecte.statut === 'ok' ? 'ok' : collecte.statut === 'degrade' ? 'attention' : 'critique';
    verdict.textContent = `Collecte ${collecte.statut} — ${collecte.diagnostic}`;

    $('horodatage').textContent =
      `Dernière actualisation : ${heure(donnees.generated_at)} · ${collecte.sources_a_jour}/${collecte.sources_attendues} sources à jour · période ${donnees.period_days} j`;
    etat.dernieres.apercu = donnees;
  }

  // ── Rendu : collecte ─────────────────────────────────────────────────────

  function rendreSources(donnees) {
    const libelles = {
      ok: ['à jour', 'ok'],
      retard: ['en retard', 'attention'],
      erreur: ['en erreur', 'critique'],
      bloquee: ['bloquée', 'critique'],
      jamais: ['jamais collectée', 'critique']
    };
    const corps = $('corps-sources');
    if (!donnees.sources.length) {
      corps.innerHTML = '<tr><td colspan="6" class="vide">Aucune source activée lue.</td></tr>';
      return;
    }
    corps.innerHTML = donnees.sources
      .map((s) => {
        const [texte, tons] = libelles[s.etat] || ['inconnu', 'inconnu'];
        return `<tr>
          <td><strong>${echapper(s.source_slug)}</strong><br><span style="font-size:.75rem;color:var(--gris-doux)">${echapper(s.ats_type || '—')}</span></td>
          <td>${pastille(texte, tons)}</td>
          <td>${s.dernier_succes ? `${heure(s.dernier_succes)}<br><span style="font-size:.75rem;color:var(--gris-doux)">${depuis(s.dernier_succes)}</span>` : '—'}</td>
          <td>${s.derniere_tentative ? depuis(s.derniere_tentative) : '—'}</td>
          <td class="num">${valeur(s.total_found)}</td>
          <td style="font-size:.78rem;color:var(--critique)">${echapper(s.erreur || '')}</td>
        </tr>`;
      })
      .join('');
  }

  async function chargerCollecte() {
    const donnees = await appeler(`/sources?period=${etat.periode}`);
    rendreSources(donnees);
    const verdict = $('verdict-collecte');
    verdict.hidden = false;
    verdict.dataset.ton = donnees.verdict.statut === 'ok' ? 'ok' : donnees.verdict.statut === 'degrade' ? 'attention' : 'critique';
    verdict.textContent = `${donnees.verdict.diagnostic} Seuils : retard après ${donnees.verdict.seuils.retard_heures} h, blocage après ${donnees.verdict.seuils.blocage_heures} h.`;
  }

  // ── Rendu : qualité ──────────────────────────────────────────────────────

  function rendreQualite(donnees) {
    $('corps-champs').innerHTML = donnees.champs
      .map(
        (c) => `<tr>
          <td><code>${echapper(c.champ)}</code></td>
          <td class="num">${valeur(c.manquants)}</td>
          <td class="num">${pourcent(c.part)}</td>
        </tr>`
      )
      .join('');

    const ecart = donnees.ecart_coeur_publie;
    const lignes = [
      ['Offres publiées', valeur(donnees.published)],
      ['Cœur de cible actif', valeur(donnees.classification.coeur)],
      ['Exclues actives', valeur(donnees.classification.exclu)],
      ['Part du cœur', pourcent(donnees.classification.part_coeur)],
      ['En attente de classement', valeur(donnees.classification.a_classer)],
      ['Liens vérifiés valides', valeur(donnees.liens.verifies_valides)],
      ['Liens non vérifiés', `${valeur(donnees.liens.non_verifies)} (${pourcent(donnees.liens.part_non_verifies)})`],
      [
        'Écart cœur / publié',
        ecart.status === 'available' ? valeur(ecart.value) : 'non discriminant'
      ]
    ];
    $('detail-qualite').innerHTML = lignes
      .map(([libelle, val]) => `<dt style="color:var(--gris)">${echapper(libelle)}</dt><dd style="margin:0;font-weight:600">${echapper(val)}</dd>`)
      .join('');

    $('note-qualite').textContent = `${valeur(donnees.published)} offres publiées — les parts sont calculées sur ce total.`;
  }

  async function chargerQualite() {
    rendreQualite(await appeler('/quality'));
  }

  // ── Rendu : exploitation ─────────────────────────────────────────────────

  function rendreExploitation(donnees) {
    $('corps-sondes').innerHTML = donnees.probes
      .map(
        (p) => `<tr>
          <td>${echapper(p.nom)}</td>
          <td>${pastille(p.disponible ? 'disponible' : 'injoignable', p.disponible ? 'ok' : 'critique')}</td>
          <td class="num">${p.code === null || p.code === undefined ? '—' : p.code}</td>
          <td class="num">${p.latence_ms === undefined ? '—' : `${p.latence_ms} ms`}</td>
          <td>${depuis(p.verifie_le)}</td>
        </tr>`
      )
      .join('');

    const manquants = [];
    if (donnees.sauvegarde.status === 'unavailable') manquants.push(`Sauvegarde : ${donnees.sauvegarde.reason}.`);
    if (donnees.couts.status === 'unavailable') manquants.push(`Coûts : ${donnees.couts.reason}.`);
    $('operations-vide').innerHTML = manquants.length
      ? `${manquants.map(echapper).join('<br>')}<br><span style="font-size:.8rem">Ces deux blocs s’activeront quand la preuve sera exposée par l’API.</span>`
      : 'Sauvegarde et coûts disponibles.';
  }

  async function chargerExploitation() {
    rendreExploitation(await appeler('/operations'));
  }

  // ── Orchestration ────────────────────────────────────────────────────────

  const CHARGEURS = {
    apercu: chargerApercu,
    collecte: chargerCollecte,
    qualite: chargerQualite,
    usage: async () => {}, // mesure non branchée : rien à charger
    exploitation: chargerExploitation
  };

  async function chargerTout() {
    const numero = ++etat.chargement;
    bandeau('');
    const bouton = $('rafraichir');
    bouton.disabled = true;
    try {
      // Séquentiel par onglet, mais un onglet en échec ne bloque pas les
      // autres : chaque vue est indépendante.
      const chargeur = CHARGEURS[etat.onglet] || chargerApercu;
      await chargeur();
      if (etat.onglet !== 'apercu') {
        await chargerApercu().catch(() => {});
      }
    } catch (erreur) {
      if (erreur.message === 'Session requise') return;
      // On garde l'affichage précédent : l'effacer ferait croire à une
      // absence de données alors que c'est une absence de réponse.
      if (numero === etat.chargement) {
        bandeau(`Chargement incomplet — ${erreur.message}. Les valeurs affichées peuvent être anciennes.`, 'attention');
        $('horodatage').textContent = 'Dernière tentative de chargement échouée.';
      }
    } finally {
      bouton.disabled = false;
    }
  }

  function choisirOnglet(nom) {
    etat.onglet = nom;
    for (const bouton of document.querySelectorAll('[role="tab"]')) {
      const actif = bouton.id === `onglet-${nom}`;
      bouton.setAttribute('aria-selected', String(actif));
      bouton.tabIndex = actif ? 0 : -1;
    }
    for (const panneau of document.querySelectorAll('[role="tabpanel"]')) {
      panneau.hidden = panneau.id !== `panneau-${nom}`;
    }
    chargerTout();
  }

  // ── Démarrage ────────────────────────────────────────────────────────────

  function brancher() {
    document.querySelectorAll('[role="tab"]').forEach((bouton) => {
      bouton.addEventListener('click', () => choisirOnglet(bouton.id.replace('onglet-', '')));
      // Navigation au clavier entre onglets, comme attendu d'un tablist.
      bouton.addEventListener('keydown', (evenement) => {
        const onglets = [...document.querySelectorAll('[role="tab"]')];
        const index = onglets.indexOf(bouton);
        let cible = null;
        if (evenement.key === 'ArrowRight') cible = onglets[(index + 1) % onglets.length];
        if (evenement.key === 'ArrowLeft') cible = onglets[(index - 1 + onglets.length) % onglets.length];
        if (cible) {
          evenement.preventDefault();
          cible.focus();
          cible.click();
        }
      });
    });

    $('periode').addEventListener('change', (evenement) => {
      etat.periode = Number(evenement.target.value) || 7;
      chargerTout();
    });
    $('rafraichir').addEventListener('click', chargerTout);
    $('deconnexion').addEventListener('click', fermerSession);

    const formulaire = $('connexion');
    if (formulaire) formulaire.addEventListener('submit', ouvrirSessionDepuisFormulaire);

    // Retour à l'onglet : on rafraîchit sans boucle de polling. Un
    // dashboard interne n'a pas besoin d'interroger le serveur toutes les
    // minutes, et chaque requête coûte une invocation.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && etat.sessionValide) chargerTout();
    });
  }

  async function demarrer() {
    brancher();
    try {
      const session = await appeler('/session');
      basculerConnexion(Boolean(session.authenticated));
      if (session.authenticated) chargerTout();
    } catch (erreur) {
      if (erreur.message !== 'Session requise') {
        bandeau("Le service de monitoring ne répond pas. Réessayez dans un instant.", 'critique');
      }
      basculerConnexion(false);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})();
