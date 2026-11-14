#!/usr/bin/env python3
"""Aligne la table des familles de competences du board sur la source unique.

La table vit dans src/pages/_competences-familles.js. La fiche l'importe ;
job-board.html est une page statique dont le JS est en ligne, il ne peut pas
importer un module. La table y est donc recopiee entre deux marqueurs.

Ce script la regenere, et --verifier dit si les deux copies sont identiques.

    python3 scripts/aligner-familles.py [--verifier]
"""
import re
import sys

SOURCE = "src/pages/_competences-familles.js"
CIBLE = "job-board.html"
DEBUT = "/* DEBUT FAMILLES GENEREES — source : src/pages/_competences-familles.js */"
FIN = "/* FIN FAMILLES GENEREES */"
VERIFIER = "--verifier" in sys.argv


def table_source():
    """Extrait le bloc `const SKILLS_FAMILIES = { ... };` du module."""
    texte = open(SOURCE, encoding="utf-8").read()
    m = re.search(r"^(?:export )?const SKILLS_FAMILIES = \{.*?^\};\n", texte, re.S | re.M)
    if not m:
        sys.exit("  x SKILLS_FAMILIES introuvable dans " + SOURCE)
    # le board n'a pas de module : il recoit une constante simple
    return m.group(0).replace('export const', 'const', 1)


bloc = f"{DEBUT}\n{table_source()}{FIN}\n"

page = open(CIBLE, encoding="utf-8").read()
m = re.search(re.escape(DEBUT) + r".*?" + re.escape(FIN) + r"\n", page, re.S)

if VERIFIER:
    if not m:
        sys.exit("  x marqueurs absents de " + CIBLE)
    if m.group(0) != bloc:
        sys.exit("  x la table de " + CIBLE + " differe de " + SOURCE)
    print("  VERIFICATION : la table du board est alignee sur " + SOURCE)
    sys.exit(0)

if not m:
    sys.exit("  x marqueurs absents de " + CIBLE + " : ajoutez-les autour de la table")

open(CIBLE, "w", encoding="utf-8").write(page[:m.start()] + bloc + page[m.end():])
print("  " + CIBLE + " : table des familles regeneree depuis " + SOURCE)
