// tests/helpers/gestionnaire.cjs
//
// Appeler un gestionnaire Vercel (api/*.js) comme le fait la plateforme.
//
// Le gestionnaire attend (req, res) et écrit la réponse. On fournit un
// « res » qui enregistre ce qui est écrit, pour que le test puisse lire le
// statut, les en-têtes et le corps.
//
// Point important : le gestionnaire est une fonction asynchrone. L'appel doit
// donc être attendu, sinon le test lit une réponse vide et passe sans rien
// vérifier.

/**
 * Appelle un gestionnaire et renvoie la réponse enregistrée.
 * @param {Function} handler
 * @param {object} req   requête simulée
 * @returns {Promise<{status:number, entetes:object, corps:any, html:string}>}
 */
function appeler(handler, req = {}) {
  return new Promise((resolve, reject) => {
    const requete = { method: 'GET', headers: {}, query: {}, body: undefined, ...req };

    const entetes = {};
    let statut = 200;
    let corps = null;
    let termine = false;

    const res = {
      setHeader(nom, valeur) { entetes[nom] = valeur; return res; },
      getHeader(nom) { return entetes[nom]; },
      removeHeader(nom) { delete entetes[nom]; },
      status(code) { statut = code; return res; },
      json(valeur) { corps = valeur; termine = true; resolve(reponse()); return res; },
      send(valeur) { corps = valeur; termine = true; resolve(reponse()); return res; },
      end(valeur) { if (valeur !== undefined) corps = valeur; termine = true; resolve(reponse()); return res; },
      redirect(code, adresse) { statut = code; entetes.Location = adresse; termine = true; resolve(reponse()); return res; },
      setPreviewData() { return res; },
    };

    function reponse() {
      const texte = typeof corps === 'string' ? corps : (corps === null ? '' : JSON.stringify(corps));
      return { status: statut, entetes, corps, html: texte };
    }

    let promesse;
    try {
      promesse = handler(requete, res);
    } catch (erreur) {
      reject(erreur);
      return;
    }

    Promise.resolve(promesse).then(() => {
      // Le gestionnaire a pu répondre de façon asynchrone : on attend la
      // résolution avant de conclure, sinon on lit un état intermédiaire.
      if (!termine) setTimeout(() => { if (!termine) resolve(reponse()); }, 0);
    }).catch((erreur) => {
      if (!termine) reject(erreur);
    });
  });
}

/**
 * Fait une requête HTTP réelle vers un serveur local.
 * Utilisé quand le test doit suivre une redirection ou lire les en-têtes
 * tels qu'un navigateur les reçoit.
 */
async function http(method, url, options = {}) {
  const reponse = await fetch(url, { method, redirect: 'manual', ...options });
  const texte = await reponse.text();
  return {
    status: reponse.status,
    entetes: Object.fromEntries(reponse.headers),
    corps: texte,
    json: () => { try { return JSON.parse(texte); } catch (e) { return null; } },
  };
}

/**
 * Extrait un objet littéral d'un source JavaScript, par équilibrage.
 * Un simple `indexOf` se trompe : il faut la vraie accolade fermante.
 */
function objetLitteral(source, ancre) {
  const debut = source.indexOf(ancre);
  if (debut === -1) return '';
  const ouverture = source.indexOf('{', debut);
  if (ouverture === -1) return '';
  let profondeur = 0;
  let j = ouverture;
  let dansChaine = false;
  let delimiteur = '';
  for (; j < source.length; j++) {
    const c = source[j];
    if (dansChaine) {
      if (c === '\\') { j++; continue; }
      if (c === delimiteur) dansChaine = false;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { dansChaine = true; delimiteur = c; continue; }
    if (c === '{') profondeur++;
    else if (c === '}') { profondeur--; if (profondeur === 0) break; }
  }
  return source.slice(ouverture, j + 1);
}

/**
 * Exécute un code JavaScript dans un contexte isolé.
 * Sert à éprouver une fonction pure sans l'exporter depuis le fichier.
 */
function evaluer(source, variables = {}) {
  const vm = require('node:vm');
  const contexte = vm.createContext({ ...variables });
  vm.runInContext(source, contexte);
  return contexte;
}

module.exports = { appeler, http, objetLitteral, evaluer };
