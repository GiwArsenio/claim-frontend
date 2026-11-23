/* Les hooks de vérification des affirmations de l'agent (`.claude/hooks/`), en mode avertissement.

   Ils ne bloquent JAMAIS et ne gênent jamais une session (fail-open). Ces tests fixent ces deux
   garanties, deux détecteurs (absence, référence) et la configuration. La référence complète
   (28 tests) est dans le dépôt claim-api : tests/test_hook_verification.py. */
'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const RACINE = path.join(__dirname, '..');
const VERIF = path.join(RACINE, '.claude', 'hooks', 'verifier_affirmations.py');
const RAPPEL = path.join(RACINE, '.claude', 'hooks', 'rappel_regles.py');

const prompt = (c) => ({ type: 'user', message: { role: 'user', content: c } });
const appel = (name, input) => ({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name, input }] } });
const resultat = (texte) => ({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: texte }] } });

function transcription(lignes) {
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-'));
  const chemin = path.join(dossier, 't.jsonl');
  fs.writeFileSync(chemin, lignes.map((l) => JSON.stringify(l)).join('\n') + '\n');
  return chemin;
}

function lancer(script, entree) {
  return spawnSync('python3', [script], { input: entree, encoding: 'utf8', timeout: 30000 });
}

function verifier(message, lignes) {
  return lancer(VERIF, JSON.stringify({ last_assistant_message: message, transcript_path: transcription(lignes) }));
}

test("une absence affirmée sans lecture est signalée, sans jamais bloquer", () => {
  const r = verifier("Le mécanisme d'alerte n'existe pas.", [prompt('q')]);
  assert.equal(r.status, 0);
  const sortie = JSON.parse(r.stdout);
  assert.match(sortie.systemMessage, /absence/);
  assert.ok(!('decision' in sortie) && !('continue' in sortie), 'le hook ne doit jamais bloquer');
});

test("une recherche sur le sujet fait taire l'alerte d'absence", () => {
  const r = verifier("Le mécanisme d'alerte n'existe pas.", [prompt('q'), appel('Grep', { pattern: 'alert' }), resultat('rien')]);
  assert.deepEqual([r.status, r.stdout], [0, '']);
});

test("un numéro de PR jamais vu dans une sortie d'outil est signalé ; un numéro vu ne l'est pas", () => {
  const vu = [prompt('q'), resultat('Merge pull request #196')];
  assert.match(JSON.parse(verifier('Corrigé par #999.', vu).stdout).systemMessage, /reference/);
  assert.equal(verifier('Corrigé par #196.', vu).stdout, '');
});

test("fail-open : entrée inutilisable, transcription absente ou illisible, le hook se tait (code 0)", () => {
  for (const entree of ['', 'pas du json', '{}', JSON.stringify({ last_assistant_message: "n'existe pas", transcript_path: '/inexistant.jsonl' })]) {
    const r = lancer(VERIF, entree);
    assert.deepEqual([r.status, r.stdout], [0, ''], `entrée : ${entree}`);
  }
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), 'hook-'));
  const chemin = path.join(dossier, 't.jsonl');
  fs.writeFileSync(chemin, '{pas json\n\u0000\u0001');
  assert.equal(lancer(VERIF, JSON.stringify({ last_assistant_message: "Le truc n'existe pas.", transcript_path: chemin })).status, 0);
});

test("le rappel est un JSON valide, court, pour l'événement UserPromptSubmit", () => {
  const r = lancer(RAPPEL, '{}');
  const sortie = JSON.parse(r.stdout).hookSpecificOutput;
  assert.equal(r.status, 0);
  assert.equal(sortie.hookEventName, 'UserPromptSubmit');
  assert.ok(sortie.additionalContext.length > 0 && sortie.additionalContext.length < 10000);
});

test("la configuration pointe vers des scripts exécutables et un délai raisonnable", () => {
  const config = JSON.parse(fs.readFileSync(path.join(RACINE, '.claude', 'settings.json'), 'utf8'));
  assert.deepEqual(Object.keys(config.hooks).sort(), ['Stop', 'UserPromptSubmit']);
  for (const groupes of Object.values(config.hooks)) {
    for (const groupe of groupes) {
      for (const hook of groupe.hooks) {
        assert.equal(hook.type, 'command');
        assert.ok(hook.timeout <= 30);
        const script = hook.command.replace('${CLAUDE_PROJECT_DIR}', RACINE);
        assert.ok(fs.existsSync(script), script);
        assert.ok(fs.statSync(script).mode & 0o100, `${script} n'est pas exécutable`);
      }
    }
  }
});

/* ── Règles de permission (`.claude/settings.json`) ───────────────────────────────────────── */

const permissions = () => JSON.parse(fs.readFileSync(path.join(RACINE, '.claude', 'settings.json'), 'utf8')).permissions;

test("le fichier ne donne aucun droit : que des restrictions (deny, ask)", () => {
  assert.deepEqual(Object.keys(permissions()).sort(), ['ask', 'deny']);
});

test("les secrets sont refusés en dur", () => {
  for (const r of ['Read(./.env)', 'Read(./.env.*)']) assert.ok(permissions().deny.includes(r), r);
});

test("les actions irréversibles demandent confirmation", () => {
  const ask = permissions().ask;
  for (const r of ['Bash(git push --force*)', 'Bash(git push -f*)', 'Bash(git reset --hard *)', 'Bash(gh api -X DELETE *)',
    'mcp__Supabase__apply_migration', 'mcp__Railway__delete-service', 'mcp__Railway__accept-deploy',
    'mcp__Railway__set-variables', 'mcp__Cloudflare_Developer_Platform__d1_database_delete']) {
    assert.ok(ask.includes(r), r);
  }
});

test("les fusions de PR ne sont pas couvertes (décision du propriétaire : une règle ask l'emporterait sur toute règle allow)", () => {
  const regles = [...permissions().deny, ...permissions().ask];
  assert.deepEqual(regles.filter((r) => r.includes('merge') && r.includes('/pulls/')), []);
});

test("chaque règle a une forme valide et n'est pas en double", () => {
  const regles = [...permissions().deny, ...permissions().ask];
  const forme = /^(?:Read|Bash)\(.+\)$|^mcp__[A-Za-z0-9_]+__[A-Za-z0-9_-]+$/;
  assert.deepEqual(regles.filter((r) => !forme.test(r)), []);
  assert.equal(new Set(regles).size, regles.length);
});

/* ── Skills du projet (`.claude/skills/`) ──────────────────────────────────────────────────── */

const lireSkill = (nom) => {
  const texte = fs.readFileSync(path.join(RACINE, '.claude', 'skills', nom, 'SKILL.md'), 'utf8');
  assert.ok(texte.startsWith('---\n'), nom);
  const [entete, ...reste] = texte.slice(4).split('\n---\n');
  const meta = Object.fromEntries(entete.split('\n').filter((l) => l.includes(': ')).map((l) => [l.slice(0, l.indexOf(': ')), l.slice(l.indexOf(': ') + 2)]));
  return { meta, corps: reste.join('\n---\n') };
};

test("skills : le seul skill est fusionner-pr, avec un nom identique à son dossier", () => {
  assert.deepEqual(fs.readdirSync(path.join(RACINE, '.claude', 'skills')).sort(), ['fusionner-pr']);
  const { meta } = lireSkill('fusionner-pr');
  assert.equal(meta.name, 'fusionner-pr');
  assert.ok(meta.description.length > 20);
});

test("skills : fusionner-pr ne peut pas être déclenché par l'agent et garde ses garde-fous", () => {
  const { meta, corps } = lireSkill('fusionner-pr');
  assert.equal(meta['disable-model-invocation'], 'true');
  assert.ok(corps.includes('cette PR') && corps.includes('seulement'));
  assert.ok(corps.includes('design/T10-captures') && corps.includes('captures/reference'));
  assert.ok(corps.includes('Monitor'));
});

test("skills : aucune clé dans fusionner-pr", () => {
  const { corps } = lireSkill('fusionner-pr');
  assert.ok(!/eyJ[A-Za-z0-9_-]{20,}|sb_secret_|ghp_[A-Za-z0-9]{20,}/.test(corps));
});
