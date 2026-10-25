#!/usr/bin/env python3
"""Aligne src/pages/_offre-rendu.js sur api/offre.js.

Les deux fichiers portent le meme rendu de fiche. Ils different par trois
choses, voulues :

  1. l'en-tete : le Worker injecte les URL (configurerUrls) et importe
     l'annuaire en ESM, la version Vercel lit process.env et require() ;
  2. `construire` est exporte par le Worker ;
  3. le Worker n'a pas de handler HTTP — c'est src/pages/offre.js qui
     appelle `construire` et renvoie une Response.

Tout le reste doit etre identique, au caractere pres. C'est la regle qui
permet de dire que le portage ne change rien au site : la production
Vercel et le Worker rendent la meme page.

Ce script regenere _offre-rendu.js a partir de api/offre.js, en
reappliquant ces trois differences. Il existe parce que le site continue
d'evoluer : un correctif de style arrive dans api/offre.js, et sans
report le Worker servirait une page differente de la production —
silencieusement, et pour toutes les fiches.

    python3 scripts/aligner-rendu.py [--verifier]

--verifier ne modifie rien : il se contente de dire si les deux fichiers
sont alignes, et sort en erreur sinon.
"""
import re
import sys

SRC = "api/offre.js"
DST = "src/pages/_offre-rendu.js"
VERIFIER = "--verifier" in sys.argv

with open(SRC, encoding="utf-8") as f:
    src = f.read()


def bloc_constante(texte, nom):
    """Une constante template litterale : `const NOM = ` ... `;`."""
    m = re.search(r"^const " + nom + r" = `.*?`;\n", texte, re.S | re.M)
    return m.group(0) if m else None


# ── 1. Le corps de la construction : il produit le HTML ────────────────────
m = re.search(r"^(?:export )?async function construire\(job, urlCanonique\) \{", src, re.M)
if not m:
    sys.exit("  ✗ fonction construire() introuvable dans api/offre.js")

corps = src[m.end():]
# On s'arrete a la fin de la fonction : ce qui suit est le handler Vercel.
fin_handler = corps.find("\nconst PAGE_ABSENTE")
if fin_handler < 0:
    sys.exit("  ✗ handler Vercel introuvable dans api/offre.js")
corps = corps[:fin_handler].rstrip() + "\n"

# ── 2. Les elements partages, repris tels quels ───────────────────────────
constantes = src[src.find("const LABELS_CONTRAT"):m.start()].rstrip() + "\n"

# BLOC_CONSENTEMENT est defini DANS la fonction de construction dans
# l'original : il est donc deja dans `corps`, et ne doit pas etre ajoute
# une seconde fois.
if "const BLOC_CONSENTEMENT" not in corps:
    sys.exit("  ✗ BLOC_CONSENTEMENT introuvable dans le corps de construire()")

# ── 3. L'en-tete propre au Worker ──────────────────────────────────────────
ENTETE = """// src/pages/_offre-rendu.js — Construction du HTML d'une fiche d'offre.
//
// Le rendu vient de api/offre.js (Vercel), repris tel quel : le Worker
// doit rendre exactement la meme page que la production, au caractere
// pres. Ce fichier ne fait que lbracketing Workers : l'environnement est
// injecte, le HTML est renvoye.
//
// Ce qui change par rapport a la version Vercel :
//   - les URL sont injectees (configurerUrls) au lieu de lues dans
//     process.env ;
//   - l'annuaire des entreprises est importe en ESM (il est CommonJS
//     pour rester partage avec le job board) ;
//   - `construire` est exporte : c'est src/pages/offre.js qui l'appelle.
//
// Toute evolution de api/offre.js doit etre reportee ici. Le script
// scripts/aligner-rendu.py fait ce report et verifie l'alignement.

let API_BASE = 'https://api.claimyourjob.fr/api/v1';
let SITE_URL = 'https://claimyourjob.fr';

export function configurerUrls(apiBase, siteUrl) {
  if (apiBase) API_BASE = apiBase;
  if (siteUrl) SITE_URL = siteUrl;
}

// Profils d'entreprise : présentation, avantages, liens sociaux. Même source
// que le job board. La page ne doit pas tomber si ce fichier manque au
// déploiement : sans lui, la page se lit avec ce que l'API publie.
// L'annuaire des entreprises est un module partage avec le job board. Il
// expose la meme source dans les deux surfaces : le rendu ne peut pas
// diverger entre la carte du board et la fiche lue en direct.
// Le fichier est un module CommonJS (il sert aussi le job board dans le
// navigateur). En ESM, on l'importe par defaut.
import ANNUAIRE_CJS from './companies-data.cjs';
const ANNUAIRE = ANNUAIRE_CJS;

"""

sortie = (
    ENTETE
    + constantes
    + "\n"
    + "export async function construire(job, urlCanonique) {"
    + corps
    + "\n"
)

if VERIFIER:
    with open(DST, encoding="utf-8") as f:
        actuel = f.read()
    if actuel == sortie:
        print("  VERIFICATION : _offre-rendu.js est aligne sur api/offre.js")
        sys.exit(0)
    print("  VERIFICATION : ecart detecte entre _offre-rendu.js et api/offre.js")
    lignes_a = actuel.split("\n")
    lignes_b = sortie.split("\n")
    for i, (a, b) in enumerate(zip(lignes_a, lignes_b)):
        if a != b:
            print(f"    premiere difference — ligne {i + 1}")
            print(f"      actuel : {a.strip()[:100]}")
            print(f"      attendu: {b.strip()[:100]}")
            break
    else:
        print(f"    longueur differente ({len(lignes_a)} vs {len(lignes_b)} lignes)")
    sys.exit(1)

with open(DST, "w", encoding="utf-8") as f:
    f.write(sortie)
print(f"  _offre-rendu.js regenere ({len(sortie.splitlines())} lignes) depuis api/offre.js")
