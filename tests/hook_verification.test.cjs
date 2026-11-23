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
