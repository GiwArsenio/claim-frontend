// Toutes les pages publiées doivent porter le bandeau de consentement.
//
// Les styles du bandeau vivent sur les pages statiques. Le gabarit
// api/offre.js n'en a pas : ses fiches partagent la feuille de leur page
// d'origine, et toute règle CSS ajoutée au gabarit polluerait sa mesure —
// c'est ce qu'a fait .consent-panneau p, qui a fait dérailler
// fiche_style_offre.test.cjs.
//
// Sans lui, le site informe de rien : les cookies GA4 se déposent dès le
// chargement, sans que le visiteur ait été consulté. Le défaut est invisible
// à l'œil — il faut donc le rendre vérifiable.
//
// Exigences vérifiées :
//   1. le bloc présent, dans le <head> ;
//   2. un vrai bouton « Refuser », pas un simple lien discret ;
//   3. la classe refus distincte de la classe acceptation — si les deux
//      partageaient la même couleur, la CNIL parlerait de traitement inégal.
const fs = require('fs');
const path = require('path');

const racine = path.join(__dirname, '..');
const PAGES = ['index.html', 'job-board.html', 'claim-entreprises.html', 'claim-observatoire.html', 'api/offre.js'];

let echecs = 0;

for (const page of PAGES) {
  const contenu = fs.readFileSync(path.join(racine, page), 'utf8');

  if (!contenu.includes('id="claim-consentement"')) {
    console.error(`✘ ${page} : le bloc consentement est absent.`);
    echecs++;
    continue;
  }

  const debut = contenu.indexOf('<!-- ── Consentement');
  const fin = contenu.indexOf('</script>', debut);
  const bloc = debut === -1 || fin === -1 ? '' : contenu.slice(debut, fin);

  if (!bloc) {
    console.error(`✘ ${page} : le bloc consentement n'a pas de limite lisible.`);
    echecs++;
    continue;
  }

  // Un vrai bouton de refus, et pas un lien en petit caractère.
  if (!/<button[^>]*>\s*Refuser\s*<\/button>/.test(bloc)) {
    console.error(`✘ ${page} : pas de bouton « Refuser ». Un lien discret ne suffit pas.`);
    echecs++;
  }

  // Le refus doit se voir sans être indiqué par la seule couleur.
  const classeAccept = (bloc.match(/class="[^"]*consent-accepter/g) || []).length;
  const classeRefus = (bloc.match(/class="[^"]*consent-refuser/g) || []).length;
  if (!classeAccept || !classeRefus) {
    console.error(`✘ ${page} : les classes d'acceptation et de refus sont incomplètes.`);
    echecs++;
  }

  // Deux styles distincts : si les deux boutons avaient le même rendu, la
  // CNIL parlerait de traitement inégal des choix. Le gabarit ne porte pas
  // de style — il n'a pas de feuille propre.
  if (page.endsWith('.html')) {
    const cssAccept = /\.consent-accepter[^{]*\{[^}]*\}/.test(bloc);
    const cssRefus = /\.consent-refuser[^{]*\{[^}]*\}/.test(bloc);
    if (!cssAccept || !cssRefus) {
      console.error(`✘ ${page} : les deux boutons n'ont pas de style propre.`);
      echecs++;
    }
  } else {
    if (bloc.includes('<style>')) {
      console.error(`✘ ${page} : le gabarit ne doit pas porter de feuille de style.`);
      console.error(`  Une règle CSS ici pollue fiche_style_offre.test.cjs.`);
      echecs++;
    }
  }
}

if (echecs) {
  console.error(`\n${echecs} page(s) non conforme(s).`);
  process.exit(1);
}
console.log('✓ bandeau de consentement présent et conforme sur toutes les pages.');
