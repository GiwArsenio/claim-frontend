// ─────────────────────────────────────────────────────────────────────────────
// CLAIM! — /monitoring
//
// Deux rôles, et un seul point de vigilance :
//
// 1. servir la page du dashboard ;
// 2. relayer `/monitoring/api/*` vers l'API Railway.
//
// Pourquoi relayer plutôt qu'appeler l'API directement depuis le navigateur :
//
//   Le site vit sur claimyourjob.fr, l'API sur *.up.railway.app. Deux
//   origines. Un cookie de session posé par l'API ne serait pas renvoyé par
//   le navigateur vers claimyourjob.fr, et il faudrait ouvrir CORS avec
//   credentials — donc remplacer le `allow_origins=["*"]` actuel par une
//   liste explicite, pour un seul écran interne.
//
//   En relayant, le navigateur ne connaît qu'une origine. Aucun CORS, aucun
//   cookie inter-domaines, et le cookie reste `HttpOnly` + `Secure` +
//   `SameSite=Strict` + `Path=/monitoring` : il n'est jamais envoyé au site
//   public.
//
// Ce que ce module NE fait PAS : vérifier la signature du jeton. Il ne
// possède pas le secret, et le dupliquer dans un Worker créerait un second
// endroit à révoquer. La présence du cookie décide seulement de la page
// servie ; l'autorité reste l'API, qui refuse toute lecture sans session
// valide. Une page servie sans droit ne contient aucune donnée.

const COOKIE = 'claim_mon';

function lireCookie(request) {
  const entete = request.headers.get('Cookie') || '';
  for (const morceau of entete.split(';')) {
    const [nom, ...reste] = morceau.trim().split('=');
    if (nom === COOKIE) return decodeURIComponent(reste.join('='));
  }
  return '';
}

// La page de connexion. Elle ne dépend d'aucun fichier : servie depuis le
// Worker, elle ne peut pas manquer à l'appel si `public/` n'a pas encore été
// régénéré.
const PAGE_CONNEXION = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>CLAIM! — Accès au monitoring</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    font-family: 'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    background: #f5f8f9; color: #191c1d; padding: 1.5rem;
  }
  .carte {
    width: 100%; max-width: 24rem; background: #fff; border: 1px solid #d5dfe3;
    border-radius: 12px; padding: 2rem 1.75rem;
    box-shadow: 0 1px 2px rgba(25,44,52,.06), 0 8px 24px rgba(25,44,52,.06);
  }
  h1 { font-size: 1.25rem; margin: 0 0 .35rem; letter-spacing: -.02em; }
  p.aide { margin: 0 0 1.5rem; color: #515f78; font-size: .875rem; line-height: 1.5; }
  label { display: block; font-size: .8125rem; font-weight: 600; margin-bottom: .4rem; }
  input {
    width: 100%; padding: .7rem .8rem; font: inherit; font-size: .9375rem;
    border: 1px solid #c7d3d8; border-radius: 8px; background: #fff; color: inherit;
  }
  input:focus-visible { outline: 2px solid #006876; outline-offset: 1px; border-color: #006876; }
  button {
    width: 100%; margin-top: 1rem; padding: .75rem; font: inherit; font-weight: 600;
    background: #006876; color: #fff; border: 0; border-radius: 8px; cursor: pointer;
  }
  button:hover { background: #00545f; }
  button:focus-visible { outline: 2px solid #00545f; outline-offset: 2px; }
  [role="alert"] { margin-top: .9rem; font-size: .875rem; color: #a3231b; min-height: 1.25rem; }
  .retour { margin-top: 1.25rem; font-size: .8125rem; }
  a { color: #006876; }
</style>
</head>
<body>
  <main class="carte">
    <h1>Monitoring CLAIM!</h1>
    <p class="aide">Espace interne. Saisissez la clé d’administration pour ouvrir une session d’une heure.</p>
    <form id="connexion" novalidate>
      <label for="cle">Clé d’administration</label>
      <input id="cle" name="cle" type="password" autocomplete="current-password"
             required aria-describedby="erreur" autofocus>
      <button type="submit">Ouvrir la session</button>
      <p id="erreur" role="alert"></p>
    </form>
    <p class="retour"><a href="/">← Retour au site</a></p>
  </main>
  <script>
  (function () {
    var form = document.getElementById('connexion');
    var champ = document.getElementById('cle');
    var erreur = document.getElementById('erreur');
    form.addEventListener('submit', async function (evenement) {
      evenement.preventDefault();
      erreur.textContent = '';
      var bouton = form.querySelector('button');
      bouton.disabled = true;
      try {
        var reponse = await fetch('/monitoring/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: champ.value })
        });
        if (reponse.ok) {
          window.location.replace('/monitoring');
          return;
        }
        if (reponse.status === 429) {
          erreur.textContent = 'Trop de tentatives. Réessayez dans quelques minutes.';
        } else if (reponse.status === 503) {
          erreur.textContent = 'Le monitoring n’est pas configuré côté serveur.';
        } else {
          erreur.textContent = 'Clé refusée.';
        }
        champ.value = '';
        champ.focus();
      } catch (e) {
        erreur.textContent = 'Service injoignable. Vérifiez votre connexion.';
      } finally {
        bouton.disabled = false;
      }
    });
  })();
  </script>
</body>
</html>`;

export async function rendreMonitoring(request, env) {
  if (!lireCookie(request)) {
    return new Response(PAGE_CONNEXION, {
      status: 401,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Une page d'accès ne doit jamais être mise en cache par un
        // intermédiaire : elle changerait d'état sans changer d'adresse.
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex',
      },
    });
  }

  const url = new URL('/monitoring.html', request.url);
  const reponse = await env.ASSETS.fetch(new Request(url, request));
  if (!reponse.ok) {
    return new Response('Page de monitoring indisponible', { status: 500 });
  }
  return new Response(reponse.body, {
    status: 200,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'x-robots-tag': 'noindex',
    },
  });
}

export async function relayerMonitoringApi(request, env) {
  const url = new URL(request.url);
  const reste = url.pathname.slice('/monitoring/api/'.length);
  const base = (env.API_URL || '').replace(/\/+$/, '');
  if (!base) {
    return Response.json({ detail: 'API_URL absent' }, { status: 503 });
  }

  // La chaîne de requête est transmise telle quelle : les filtres du
  // dashboard vivent dans l'adresse, et le Worker n'a pas à les comprendre.
  const cible = `${base}/admin/monitoring/${reste}${url.search}`;

  const entetes = new Headers(request.headers);
  entetes.delete('host');
  entetes.delete('cf-connecting-ip');
  // Le Worker est le seul à connaître l'adresse réelle du visiteur ; sans
  // cet en-tête, toutes les tentatives de connexion viendraient d'une même
  // adresse Cloudflare et la limitation bloquerait tout le monde.
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) entetes.set('x-forwarded-for', ip);

  const methode = request.method;
  const corps = methode === 'GET' || methode === 'HEAD' ? undefined : await request.arrayBuffer();

  let amont;
  try {
    amont = await fetch(cible, {
      method: methode,
      headers: entetes,
      body: corps,
      redirect: 'manual',
    });
  } catch (erreur) {
    return Response.json(
      { detail: 'API de monitoring injoignable', erreur: String(erreur && erreur.name) },
      { status: 502 }
    );
  }

  const sortie = new Headers(amont.headers);
  sortie.set('cache-control', 'no-store');
  // `Set-Cookie` traverse sans réécriture : l'API fixe déjà `Path=/monitoring`,
  // que le navigateur applique tel quel.
  return new Response(amont.body, { status: amont.status, headers: sortie });
}
