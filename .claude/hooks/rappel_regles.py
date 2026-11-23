#!/usr/bin/env python3
"""Hook UserPromptSubmit — rappelle les règles de vérité à chaque message.

Il injecte un court rappel dans le contexte (champ `additionalContext`). Il
garantit que le rappel est PRÉSENT à chaque tour ; il ne garantit pas qu'il est
appliqué. Fail-open : toute erreur se termine en silence, code 0.
"""
import json
import sys

RAPPEL = (
    "Règles de vérité de ce dépôt (voir CLAUDE.md) :\n"
    "1. Avant de dire qu'une chose n'existe pas : cherche (Grep/Glob/Read, plusieurs noms "
    "possibles) et écris le périmètre : « Pas trouvé dans <dossiers> avec <commande> ».\n"
    "2. Un fait tiré d'un audit, d'une note ou d'un résumé porte sa date et sa source ; "
    "sinon relis l'état réel (planificateur, base, git) avant de l'affirmer.\n"
    "3. Pour attribuer un correctif à un PR ou une cause, cite la commande git/gh lancée "
    "dans cette session.\n"
    "4. Quand tu reprends une de tes phrases, recopie ses réserves telles quelles.\n"
    "5. « Non vérifié » est une réponse autorisée et attendue."
)

if __name__ == "__main__":
    try:
        sys.stdin.read()
        print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": RAPPEL}},
                         ensure_ascii=False))
    except Exception:  # noqa: BLE001
        pass
    sys.exit(0)
