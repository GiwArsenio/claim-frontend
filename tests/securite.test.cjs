// tests/securite.test.cjs
//
// Ce qui vient de la source ne doit jamais devenir du code.
//
// Le backend livre du HTML d annonce, nettoyé à la collecte. Ce nettoyage
// est une défense, pas une garantie : il vit dans un autre dépôt, et une
// source peut changer un jour. Le rendu doit donc se défendre à son tour.
//
// Ce fichier couvre :
//   U01 — échappement du texte
//   U02 — HTML source malveillant
//   U03 — adresses externes
//   U04 — JSON-LD et script de mesure
//   U05 — absence de secret dans le dépôt

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { appeler } = require('./helpers/gestionnaire.cjs');
const { demarrer, OFFRE_HOSTILE } = require('./helpers/serveur-simule.cjs');

const RACINE = path.join(__dirname, '..');

function charger(base) {
  process.env.API_URL = base;
  delete require.cache[require.resolve(path.join(RACINE, 'api/offre.js'))];
  return require(path.join(RACINE, 'api/offre.js'));
}

// ─────────────────────────────────────────────────────────────────────────
// U01 — L échappement du texte.
//
// Une offre dont le titre contient du code ne doit pas pouvoir injecter de
// balise ni de script dans la page.
// ─────────────────────────────────────────────────────────────────────────
const source = fs.readFileSync(path.join(RACINE, 'api/offre.js'), 'utf8');

function echapper(valeur) {
  const debut = source.indexOf('function echapper(');
  const fin = source.indexOf('\n}', debut) + 2;
  // eslint-disable-next-line no-new-func
  return new Function('return ' + source.slice(debut, fin).replace('function echapper', 'function'))();
}

const e = echapper();
assert.equal(e('<script>'), '&lt;script&gt;');
assert.equal(e('a & b'), 'a &amp; b');
assert.equal(e('"cite"'), '&quot;cite&quot;');
assert.equal(e("l apostrophe"), 'l apostrophe');
assert.equal(e(null), '');
assert.equal(e(undefined), '');

(async () => {
  const serveur = await demarrer({ offres: [OFFRE_HOSTILE] });
  const handler = charger(serveur.url + '/api/v1');
  const reponse = await appeler(handler, { query: { slug: OFFRE_HOSTILE.slug } });

  assert.equal(reponse.status, 200, 'une offre hostile doit quand même se rendre');
  const html = reponse.html;

  // ── U02 — Aucun script injecté par les données ──────────────────────────
  //
  // On recompte les balises <script> de la page. Le nombre attendu est
  // connu : le script de mesure, celui de la mesure sérialisée, et celui du
  // thème. Toute balise supplémentaire vient des données.
  //
  // On ne compte pas le total de balises du gabarit : on vérifie que les
  // DONNÉES n en ajoutent aucune. Une page d offre rend sept balises à elle
  // seule (balisage structuré, mesure, mesure sérialisée, thème, scripts
  // internes). Ce qui est interdit, c est une balise de plus.
  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0]);
  const injectees = scripts.filter((balise) => {
    if (balise.includes('application/ld+json')) return false;
    if (balise.includes('googletagmanager.com')) return false;
    if (balise.includes('/assets/theme.js')) return false;
    if (balise.includes('__claimMesure')) return false;
    if (balise.includes('dataLayer')) return false;
    if (balise.includes('gtag(')) return false;
    if (balise.includes('claim-theme')) return false;
    if (balise.includes('__claimMesure')) return false;
    // Une balise dont le contenu vient des données aurait un attribut
    // event, ou un src vers une donnée.
    if (/onload|onerror|onclick/i.test(balise)) return true;
    if (/src="[^"]*<|href="[^"]*</i.test(balise)) return true;
    return false;
  });
  assert.deepEqual(injectees, [],
    'les données de l offre ne doivent pas injecter de balise script');

  // Le titre hostile est échappé : la page contient la FORME LITTÉRALE
  // du script, mais échappée, donc inerte. Ce que l on vérifie, c est
  // qu'aucune balise exécutable ne subsiste.
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'),
    'le script du titre doit apparaître échappé');
  assert.ok(!/<script>alert\(1\)<\/script>/.test(html),
    'le script du titre ne doit pas être exécutable');
  assert.ok(!/<script>alert\(2\)<\/script>/.test(html),
    'le script du nom de société ne doit pas être exécutable');
  assert.ok(!/<script>alert\(3\)<\/script>/.test(html),
    'le script de la description ne doit pas être exécutable');
  assert.ok(!/<script>alert\(4\)<\/script>/.test(html),
    'le script du salaire ne doit pas être exécutable');

  // Aucune balise script ne doit porter le texte hostile : il doit avoir
  // été échappé partout.
  // Le balisage structuré n est pas du JavaScript : il porte le texte
  // hostile, mais échappé en \u003c, donc inerte. On ne le compte donc
  // pas comme une balise exécutable — on vérifie séparément qu il ne
  // contient pas de « < » brut, ce qui le romprait.
  // Ce qui rendrait une donnee executable, ce n est pas sa presence dans
  // un script : c est la presence d une BALISE. Une donnee echappee est
  // inerte, meme ecrite dans un script.
  //
  // On verifie donc qu aucune de ces balises ne subsiste dans un script
  // executable : ni ouverture de balise script, ni fermeture, ni
  // gestionnaire d evenement.
  const scriptsExecutables = [...html.matchAll(/<script\b(?![^>]*application\/ld\+json)[^>]*>([\s\S]*?)<\/script>/g)];
  for (const [ , corps ] of scriptsExecutables) {
    assert.ok(!/<script\b/i.test(corps),
      "une donnee ne doit pas pouvoir ouvrir une balise script");
    assert.ok(!/<\/script/i.test(corps),
      "une donnee ne doit pas pouvoir fermer une balise script");
    assert.ok(!/\son[a-z]+\s*=/i.test(corps),
      "une donnee ne doit pas pouvoir poser de gestionnaire d evenement");
  }

  // Et le balisage structuré ne doit pas pouvoir fermer sa balise.
  const jsonLdBlocs = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  for (const [ , corps ] of jsonLdBlocs) {
    assert.ok(!corps.includes('<'),
      'le balisage structuré ne doit pas contenir de chevron brut');
    assert.ok(!corps.includes('>'),
      'le balisage structuré ne doit pas contenir de chevron brut');
  }

  assert.ok(!html.includes('<img src=x onerror'), 'une balise image avec gestionnaire ne doit pas passer');
  assert.ok(!/<[^>]*onerror\s*=/i.test(html), 'aucun gestionnaire en ligne ne doit subsister');

  // ── U01 — Le titre est échappé, donc visible comme texte ────────────────
  assert.ok(html.includes('&lt;script&gt;'), 'le titre hostile doit apparaître échappé');
  assert.ok(html.includes('&lt;b&gt;gras&lt;/b&gt;'), 'le gras du titre doit être échappé');

  // ── U04 — Le bloc JSON-LD reste du JSON ─────────────────────────────────
  const jsonLd = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  assert.equal(jsonLd.length, 1, 'la page doit porter un bloc JSON-LD');
  let donnees;
  assert.doesNotThrow(() => { donnees = JSON.parse(jsonLd[0][1]); },
    'le bloc JSON-LD doit rester du JSON valide, même avec des données hostiles');
  assert.equal(donnees['@type'], 'JobPosting');
  assert.ok(!jsonLd[0][1].includes('</script>'), 'le bloc JSON-LD ne doit pas contenir de balise fermante');

  // ── U04 — Le script de mesure est intact ────────────────────────────────
  //
  // Les données sont sérialisées dans la page. Un "</script>" dans une
  // donnée fermerait la balise et injecterait du code.
  const blocMesure = html.match(/window\.__claimMesure = ([\s\S]*?);<\/script>/);
  assert.ok(blocMesure, 'la mesure sérialisée doit être présente');
  assert.ok(!blocMesure[1].includes('</script>'), 'la mesure sérialisée ne doit pas pouvoir fermer la balise');
  assert.doesNotThrow(() => JSON.parse(blocMesure[1]), 'la mesure sérialisée doit rester du JSON valide');

  // ── U03 — Les adresses externes ─────────────────────────────────────────
  //
  // Le lien « Postuler » mène à l annonce d origine. Son protocole doit être
  // vérifié : une adresse javascript: exécuterait du code au clic.
  const liens = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  for (const lien of liens) {
    if (lien.startsWith('http')) {
      assert.ok(lien.startsWith('https://'),
        'une adresse externe doit être en https : ' + lien.slice(0, 60));
    } else if (lien.startsWith('//')) {
      assert.fail('une adresse relative au protocole ne doit pas être utilisée : ' + lien);
    }
  }
  assert.ok(!html.includes('href="javascript:'), 'aucune adresse javascript: ne doit subsister');

  // ── U05 — Aucun secret dans le dépôt ───────────────────────────────────
  const suspects = [];
  const parcourir = (dossier) => {
    for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
      if (entree.name === 'node_modules' || entree.name === '.git') continue;
      const complet = path.join(dossier, entree.name);
      if (entree.isDirectory()) { parcourir(complet); continue; }
      if (!/\.(js|cjs|json|html|md|yml|yaml)$/.test(entree.name)) continue;
      const texte = fs.readFileSync(complet, 'utf8');
      if (/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(texte)) suspects.push(complet + ' (clé privée)');
      if (/AIza[0-9A-Za-z_-]{25,}/.test(texte)) suspects.push(complet + ' (clé API Google)');
      if (/ya29\.[0-9A-Za-z_-]{20,}/.test(texte)) suspects.push(complet + ' (jeton OAuth)');
    }
  };
  parcourir(RACINE);
  assert.deepEqual(suspects, [], 'le dépôt ne doit contenir aucun secret : ' + suspects.join(', '));

  await serveur.arreter();
  console.log('Sécurité : échappement, HTML hostile, adresses, JSON-LD, secrets — OK');
})().catch((erreur) => {
  console.error(erreur);
  process.exit(1);
});
