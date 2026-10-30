/* CLAIM! — Microsoft Clarity, chargé après accord seulement.
 *
 * Ce que ce fichier garantit, et ce qu'il ne garantit pas.
 *
 *  1. Aucun appel à clarity.ms avant un accord explicite. Le refus ne
 *     charge rien du tout — pas même en mode « sans témoin ». Clarity
 *     sait fonctionner sans cookie après un refus, mais ce mode reste
 *     une collecte : la CNIL demande un accord préalable pour un rejeu
 *     de session, donc on ne s'appuie pas dessus.
 *  2. Le signal de consentement est transmis par `consentv2` dès le
 *     chargement. Sans lui, Clarity reste en état « denied » par défaut
 *     pour les visiteurs de l'EEE et ne rendrait qu'un service partiel.
 *  3. `ad_Storage` reste « denied » : CLAIM! ne fait pas de publicité et
 *     ne recible personne. Ce n'est pas un réglage à activer par erreur.
 *  4. Sans identifiant de projet, le fichier ne fait rien. Mieux vaut une
 *     intégration muette qu'un envoi vers un projet inexistant.
 *
 * L'identifiant se renseigne après création du projet dans
 * clarity.microsoft.com (Paramètres → Configuration → code de suivi).
 * Il est public : il figure dans le code source de la page.
 */
(function () {
  'use strict';

  var CLE = 'claim-consentement';
  var ACCORD = 'tout';

  /* Identifiant du projet Clarity de CLAIM!, relevé le 30 octobre 2026.
     Il est public : Microsoft le fait figurer en clair dans le code de
     chaque page mesurée, et c'est ce même extrait qui est repris ici.

     Aucune variable globale ne permet de le remplacer : un identifiant
     modifiable depuis la console serait un moyen de détourner la mesure
     sans toucher au dépôt. Les tests lisent cette constante. */
  var PROJET = 'z5zmx1kbnb';

  function choix() {
    try { return localStorage.getItem(CLE); } catch (e) { return null; }
  }

  function charger() {
    if (!PROJET || typeof window.clarity === 'function') return;

    /* Extrait officiel de Microsoft, sans modification : la file d'attente
       `clarity.q` accepte les appels avant l'arrivée du script. */
    (function (c, l, a, r, i, t, y) {
      c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
      t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
      y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', PROJET);

    window.clarity('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: 'granted'
    });
  }

  /* Retrait : Clarity supprime son témoin et coupe la session en cours.
     Il est appelé par le bouton de la page Confidentialité. */
  function retirer() {
    if (typeof window.clarity !== 'function') return;
    window.clarity('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: 'denied'
    });
  }

  window.claimClarityRetirer = retirer;

  /* Le bandeau peut être posé avant ou après ce fichier : on écoute le
     clic au lieu de dépendre de l'ordre des scripts. */
  document.addEventListener('click', function (e) {
    var bouton = e.target && e.target.closest ? e.target.closest('[data-consent]') : null;
    if (!bouton) return;
    if (bouton.getAttribute('data-consent') === ACCORD) charger();
    else retirer();
  });

  if (choix() === ACCORD) charger();
})();
