/* ── BASCULE JOUR / NUIT ────────────────────────────────────────────────────
   La préférence est posée sur <html> le plus tôt possible — un script en
   ligne dans le <head> de chaque page — pour qu'aucune page ne s'affiche en
   clair avant de basculer. Ce fichier-ci n'ajoute que le bouton. */
(function () {
  var CLE = 'claim-theme';
  var racine = document.documentElement;

  function courant() {
    return racine.getAttribute('data-theme') === 'nuit' ? 'nuit' : 'jour';
  }

  function appliquer(theme) {
    if (theme === 'nuit') racine.setAttribute('data-theme', 'nuit');
    else racine.removeAttribute('data-theme');
    var bouton = document.querySelector('.bascule-theme');
    if (!bouton) return;
    var libelle = theme === 'nuit' ? 'Passer en version jour' : 'Passer en version nuit';
    bouton.setAttribute('aria-label', libelle);
    bouton.title = libelle;
    bouton.setAttribute('aria-pressed', theme === 'nuit' ? 'true' : 'false');
    /* L'icone passe par le pseudo-element CSS : son nom ne vit pas dans le
       DOM. Un `aria-label` « Passer en version nuit » et un texte visible
       « dark_mode » divergeaient : la regle 2.5.3 (Label in Name) exige que
       le texte visible figure dans le nom accessible. `aria-hidden` ne
       suffisait pas : il retire la prononciation, pas le rendu. */
    var icone = bouton.querySelector('.ms');
    if (icone) icone.setAttribute('data-icone', theme === 'nuit' ? 'light_mode' : 'dark_mode');
  }

  function basculer() {
    var suivant = courant() === 'nuit' ? 'jour' : 'nuit';
    try { localStorage.setItem(CLE, suivant); } catch (e) { /* navigation privée */ }
    appliquer(suivant);
  }

  function poserBouton() {
    if (document.querySelector('.bascule-theme')) return;

    var bouton = document.createElement('button');
    bouton.type = 'button';
    bouton.className = 'bascule-theme';
    /* Le contenu du bouton est vide : l'icone est un pseudo-element. */
    bouton.innerHTML = '<span class="ms" aria-hidden="true" data-icone="dark_mode"></span>';
    bouton.addEventListener('click', basculer);

    var nav = document.querySelector('.hd nav') || document.querySelector('#hd nav');

    if (nav) {
      // À côté de l'action principale, jamais devant elle.
      var cta = nav.querySelector('.btn-cta');
      if (cta && cta.parentElement) cta.parentElement.insertBefore(bouton, cta);
      else nav.appendChild(bouton);

      // Deux pages masquent leur en-tête derrière l'affiche « en construction » :
      // la barre y mesure zéro. Le bouton ne doit pas disparaître avec elle — il
      // passe alors en haut à droite, par-dessus l'affiche.
      if (nav.getBoundingClientRect().height < 1) {
        bouton.classList.add('bascule-flottante');
        document.body.appendChild(bouton);
      }
    } else {
      // Une page sans barre de navigation — la fiche d'offre, qui s'ouvre
      // seule — n'a pas d'endroit naturel pour le bouton. Il se pose alors en
      // haut à droite, par-dessus la page : le thème reste accessible partout.
      bouton.classList.add('bascule-flottante');
      document.body.appendChild(bouton);
    }

    appliquer(courant());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', poserBouton);
  } else {
    poserBouton();
  }
})();
