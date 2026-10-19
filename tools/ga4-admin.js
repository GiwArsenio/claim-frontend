#!/usr/bin/env node
// tools/ga4-admin.js
// Pilotage de la propriete GA4 « Claim your job - GA4 » via l'API
// Google Analytics Admin. Aucune dependance externe.
//
// Prerequis : un compte de service GCP autorise en Editeur sur la propriete,
// sa cle JSON sur disque, et GA4_KEY pointant vers ce fichier.
//
//   GA4_KEY=/chemin/vers/cle.json node tools/ga4-admin.js inventory
//
// Commandes :
//   check      verifie l'authentification et liste les proprietes accessibles
//   inventory  releve l'etat courant de la propriete
//   apply      cree ce qui manque (idempotent, relancable sans doublon)
//   reset-off  passe resetUserDataOnNewActivity a false (recommandation CNIL)
//   test-page  verifie si le nom de parametre « page » est accepte par l'API
//
// Contrainte d'API decouverte a l'usage : displayName n'accepte que les
// caracteres alphanumeriques, l'underscore et l'espace. Les lettres accentuees
// passent ; l'apostrophe typographique et le tiret cadratin provoquent un
// HTTP 400 INVALID_ARGUMENT.

const fs = require('fs');
const crypto = require('crypto');

if (!process.env.GA4_KEY) {
  console.error('GA4_KEY manquant : indiquez le chemin de la cle JSON du compte de service.');
  process.exit(2);
}

const KEY_PATH = process.env.GA4_KEY;
const PROP = process.env.GA4_PROPERTY || '558484799';
const SCOPE = 'https://www.googleapis.com/auth/analytics.edit';
const BASE = 'https://analyticsadmin.googleapis.com/v1beta';

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

async function token() {
  const key = JSON.parse(fs.readFileSync(KEY_PATH, 'utf8'));
  const iat = Math.floor(Date.now() / 1000);
  const input = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: key.client_email,
    scope: SCOPE,
    aud: 'https://oauth2.googleapis.com/token',
    iat: iat,
    exp: iat + 3600,
  });
  const sig = crypto.createSign('RSA-SHA256').update(input).sign(key.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: input + '.' + sig,
    }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error('Token HTTP ' + res.status + ' : ' + JSON.stringify(j));
  return { access: j.access_token, email: key.client_email };
}

async function api(method, path, body, tok) {
  const opts = { method: method, headers: { Authorization: 'Bearer ' + tok } };
  if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, opts);
  const txt = await res.text();
  let data;
  try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
  return { status: res.status, ok: res.ok, data: data };
}

// Libelles sans apostrophe ni tiret cadratin : l'API les refuse.
const DIMENSIONS = [
  ['contract_type', 'Type de contrat'],
  ['experience_level', 'Niveau exp\u00e9rience'],
  ['job_source', 'Source offre'],
  ['view_context', 'Contexte de consultation'],
  ['filtre_contrat', 'Filtre contrat'],
  ['filtre_specialite', 'Filtre sp\u00e9cialit\u00e9'],
  ['filtre_experience', 'Filtre exp\u00e9rience'],
  ['filtre_source', 'Filtre source'],
  ['filtre_ville', 'Filtre ville'],
];
const METRICS = [['results_count', 'Nombre de r\u00e9sultats']];
const KEY_EVENTS = ['job_apply_click'];

(async () => {
  const cmd = process.argv[2] || 'check';
  const t = await token();
  console.log('compte de service : ' + t.email);

  if (cmd === 'check') {
    const r = await api('GET', '/accountSummaries', null, t.access);
    console.log('accountSummaries -> HTTP ' + r.status);
    for (const a of (r.data.accountSummaries || [])) {
      console.log('- ' + a.account + '  ' + a.displayName);
      for (const p of (a.propertySummaries || [])) console.log('    * ' + p.property + '  ' + p.displayName);
    }
    return;
  }

  if (cmd === 'inventory') {
    const ke = await api('GET', '/properties/' + PROP + '/keyEvents', null, t.access);
    console.log('=== EVENEMENTS CLES (HTTP ' + ke.status + ') ===');
    for (const k of (ke.data.keyEvents || [])) console.log('- ' + k.eventName + '  [' + (k.countingMethod || '?') + ']');
    const cd = await api('GET', '/properties/' + PROP + '/customDimensions', null, t.access);
    console.log('=== DIMENSIONS (HTTP ' + cd.status + ') ===');
    for (const d of (cd.data.customDimensions || [])) console.log('- ' + d.parameterName + '  |  ' + d.displayName + '  |  ' + d.scope);
    const cm = await api('GET', '/properties/' + PROP + '/customMetrics', null, t.access);
    console.log('=== METRIQUES (HTTP ' + cm.status + ') ===');
    if (!(cm.data.customMetrics || []).length) console.log('(aucune)');
    for (const d of (cm.data.customMetrics || [])) console.log('- ' + d.parameterName + '  |  ' + d.displayName + '  |  ' + d.scope);
    const dr = await api('GET', '/properties/' + PROP + '/dataRetentionSettings', null, t.access);
    console.log('=== CONSERVATION (HTTP ' + dr.status + ') ===');
    console.log(JSON.stringify(dr.data, null, 2));
    return;
  }

  if (cmd === 'apply') {
    console.log('--- 1. Evenements cles ---');
    const ke = await api('GET', '/properties/' + PROP + '/keyEvents', null, t.access);
    const keNames = new Set((ke.data.keyEvents || []).map(k => k.eventName));
    for (const name of KEY_EVENTS) {
      if (keNames.has(name)) { console.log('= deja present : ' + name); continue; }
      const r = await api('POST', '/properties/' + PROP + '/keyEvents', { eventName: name, countingMethod: 'ONCE_PER_EVENT' }, t.access);
      console.log((r.ok ? 'OK    ' : 'ECHEC ') + name + '   HTTP ' + r.status + (r.ok ? '' : '   ' + JSON.stringify(r.data)));
    }

    console.log('--- 2. Dimensions personnalisees (portee EVENEMENT) ---');
    const cd = await api('GET', '/properties/' + PROP + '/customDimensions', null, t.access);
    const cdNames = new Set((cd.data.customDimensions || []).map(d => d.parameterName));
    for (const d of DIMENSIONS) {
      if (cdNames.has(d[0])) { console.log('= deja presente : ' + d[0]); continue; }
      const r = await api('POST', '/properties/' + PROP + '/customDimensions', { parameterName: d[0], displayName: d[1], scope: 'EVENT' }, t.access);
      console.log((r.ok ? 'OK    ' : 'ECHEC ') + d[0] + '  (' + d[1] + ')   HTTP ' + r.status + (r.ok ? '' : '   ' + JSON.stringify(r.data)));
    }

    console.log('--- 3. Metrique personnalisee ---');
    const cm = await api('GET', '/properties/' + PROP + '/customMetrics', null, t.access);
    const cmNames = new Set((cm.data.customMetrics || []).map(d => d.parameterName));
    for (const d of METRICS) {
      if (cmNames.has(d[0])) { console.log('= deja presente : ' + d[0]); continue; }
      const r = await api('POST', '/properties/' + PROP + '/customMetrics', { parameterName: d[0], displayName: d[1], scope: 'EVENT', measurementUnit: 'STANDARD' }, t.access);
      console.log((r.ok ? 'OK    ' : 'ECHEC ') + d[0] + '  (' + d[1] + ')   HTTP ' + r.status + (r.ok ? '' : '   ' + JSON.stringify(r.data)));
    }

    console.log('--- 4. Conservation des donnees ---');
    const r = await api('PATCH', '/properties/' + PROP + '/dataRetentionSettings?updateMask=eventDataRetention,resetUserDataOnNewActivity',
      { name: 'properties/' + PROP + '/dataRetentionSettings', eventDataRetention: 'FOURTEEN_MONTHS', resetUserDataOnNewActivity: false }, t.access);
    console.log((r.ok ? 'OK    ' : 'ECHEC ') + 'evenement -> 14 mois, reset desactive   HTTP ' + r.status);
    return;
  }

  if (cmd === 'reset-off') {
    const r = await api('PATCH', '/properties/' + PROP + '/dataRetentionSettings?updateMask=resetUserDataOnNewActivity',
      { name: 'properties/' + PROP + '/dataRetentionSettings', resetUserDataOnNewActivity: false }, t.access);
    console.log((r.ok ? 'OK    ' : 'ECHEC ') + 'resetUserDataOnNewActivity -> false   HTTP ' + r.status);
    return;
  }

  if (cmd === 'test-page') {
    const r = await api('POST', '/properties/' + PROP + '/customDimensions', { parameterName: 'page', displayName: 'Page test', scope: 'EVENT' }, t.access);
    if (r.ok) {
      console.log('ACCEPTE : le nom « page » n est pas reserve (dimension creee puis supprimee).');
      const del = await api('DELETE', '/' + r.data.name, null, t.access);
      console.log('nettoyage -> HTTP ' + del.status);
    } else if (r.status === 409) {
      console.log('ACCEPTE : une dimension « page » existe deja (HTTP 409). Le nom passe donc la validation de l API.');
    } else {
      console.log('REFUSE : HTTP ' + r.status + '  ' + JSON.stringify(r.data));
    }
    return;
  }

  console.log('commande inconnue : ' + cmd);
})().catch((e) => { console.error('ECHEC : ' + e.message); process.exit(1); });
