#!/usr/bin/env python3
"""Hook Stop — contrôle des affirmations de l'agent. MODE AVERTISSEMENT.

Ce hook ne bloque JAMAIS. Il lit le dernier message de l'agent
(`last_assistant_message`) et la transcription de la session, puis signale à
l'utilisateur (champ `systemMessage`) trois classes d'affirmations à risque :

  1. ABSENCE   — « n'existe pas », « introuvable »… sans aucune lecture ni
                 recherche (Read, Grep, Glob, commande de lecture, requête) dans
                 le tour courant.
  2. RÉFÉRENCE — un numéro de PR (#123) ou un hash de commit qui n'apparaît dans
                 AUCUNE sortie d'outil de la session : cité de mémoire.
  3. HORAIRE   — une expression cron ou « toutes les N minutes/heures » sans que
                 le tour ait lu une configuration de planification.

Pourquoi un avertissement et pas un blocage : on ne sait pas encore combien de
faux positifs ces règles produisent. On mesure d'abord (`--rejouer`), on durcit
ensuite, et seulement ce qui a fait ses preuves. Voir le dépôt claim-api (docs/GARDE_FOUS_REPONSES.md).

Ce que ce hook ne prouve PAS : qu'une affirmation est vraie. Il vérifie qu'une
trace de lecture existe, pas que la conclusion en est juste.

Le hook est « fail-open » : toute erreur (transcription illisible, format
changé) se termine en silence, code 0. Il ne doit jamais gêner une session.

Usage :
    (par Claude Code)  hook Stop, JSON sur stdin
    python3 verifier_affirmations.py --rejouer TRANSCRIPTION.jsonl [--detail]
"""
from __future__ import annotations

import json
import os
import re
import sys

# --- Détecteurs ---------------------------------------------------------------

ABSENCE = re.compile(
    r"n['’]existe (?:pas|plus)|n['’]existent (?:pas|plus)|inexistant|introuvable"
    r"|il n['’]y a (?:aucun|aucune|pas d|plus d)|aucune? [^.\n]{0,60}n['’]existe"
    r"|aucune? (?:\w+ ){1,3}(?:dédiée?|en place|existante?|prévue?|mise en place)"
    r"|pas d['’]\w+(?: \w+)? (?:dédiée?|en place|existante?)"
    r"|does not exist|doesn['’]t exist|no such (?:file|function|table|column)"
    r"|there is no |there['’]s no ",
    re.IGNORECASE,
)

REF_PR = re.compile(r"(?<![\w#&/])#(\d{2,5})\b")
REF_HASH = re.compile(r"\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{7,40}\b")

CHAMP_CRON = r"[\d*/\-]+(?:,[\d*/\-]+)*"
CRON = re.compile(rf"(?<![\w/*-])(?:{CHAMP_CRON} ){{4}}{CHAMP_CRON}(?![\w/*-])")
CADENCE = re.compile(r"toutes? les \d+ (?:minutes?|min|heures?|h)\b", re.IGNORECASE)

# Outils qui lisent quelque chose (le tour a « regardé »).
OUTILS_LECTURE = {"Read", "Grep", "Glob", "WebFetch", "WebSearch", "Agent"}
COMMANDE_LECTURE = re.compile(
    r"\b(?:grep|rg|find|ls|cat|sed|head|tail|awk|git|gh|python3?|node|curl|jq|wc)\b"
)
PREUVE_HORAIRE = re.compile(r"cron|railway|schedule|get-service-config|workflow", re.IGNORECASE)

MAX_EXTRAIT = 90


# --- Lecture de la transcription ---------------------------------------------

def _texte_resultat(contenu) -> str:
    if isinstance(contenu, str):
        return contenu
    if isinstance(contenu, list):
        return " ".join(
            b.get("text", "") for b in contenu if isinstance(b, dict) and b.get("type") == "text"
        )
    return ""


def lire_session(chemin: str) -> list[dict]:
    """Les entrées utiles de la transcription : prompts, appels et résultats d'outils."""
    entrees: list[dict] = []
    with open(chemin, encoding="utf-8") as fichier:
        for ligne in fichier:
            try:
                d = json.loads(ligne)
            except ValueError:
                continue
            message = d.get("message") or {}
            contenu = message.get("content")
            if d.get("type") == "user" and isinstance(contenu, str):
                entrees.append({"genre": "prompt", "texte": contenu})
            elif d.get("type") == "user" and isinstance(contenu, list):
                for bloc in contenu:
                    if not isinstance(bloc, dict):
                        continue
                    if bloc.get("type") == "tool_result":
                        entrees.append({"genre": "resultat", "texte": _texte_resultat(bloc.get("content"))})
                    elif bloc.get("type") == "text":
                        entrees.append({"genre": "prompt", "texte": bloc.get("text", "")})
            elif d.get("type") == "assistant" and isinstance(contenu, list):
                for bloc in contenu:
                    if isinstance(bloc, dict) and bloc.get("type") == "tool_use":
                        entrees.append({
                            "genre": "appel",
                            "nom": bloc.get("name", ""),
                            "entree": json.dumps(bloc.get("input", {}), ensure_ascii=False),
                        })
                    elif isinstance(bloc, dict) and bloc.get("type") == "text":
                        entrees.append({"genre": "texte", "texte": bloc.get("text", "")})
    return entrees


def tour_courant(entrees: list[dict]) -> list[dict]:
    """Les entrées depuis le dernier prompt de l'utilisateur."""
    debut = 0
    for i, e in enumerate(entrees):
        if e["genre"] == "prompt":
            debut = i + 1
    return entrees[debut:]


def a_regarde(tour: list[dict]) -> bool:
    for e in tour:
        if e["genre"] != "appel":
            continue
        nom = e["nom"]
        if nom in OUTILS_LECTURE or nom.startswith("mcp__"):
            return True
        if nom == "Bash" and COMMANDE_LECTURE.search(e["entree"]):
            return True
    return False


JETON = re.compile(r"\b[0-9a-fA-F]{2,40}\b")


def jetons_vus(entrees: list[dict]) -> set[str]:
    """Nombres et hash vus dans les prompts, appels et sorties d'outils (minuscules)."""
    vus: set[str] = set()
    for e in entrees:
        if e["genre"] in ("resultat", "appel", "prompt"):
            vus.update(t.lower() for t in JETON.findall(e.get("texte", "") + " " + e.get("entree", "")))
    return vus


MOTS_VIDES = {
    "aucun", "aucune", "existe", "existent", "exist", "dédiée", "dédié", "dédiées", "place", "pas",
    "introuvable", "inexistant", "inexistante", "prévue", "prévu", "mise", "there", "does", "doesn",
    "this", "that", "plus", "dans", "pour", "avec", "sans", "cette", "mais", "donc", "quand", "elle",
    "elles", "leur", "leurs", "sont", "être", "avoir", "faire", "entre", "chez", "alors", "comme",
}


def _entre_guillemets(message: str, position: int) -> bool:
    """Vrai si la position est dans « … », "…" ou un bloc de code `…` : c'est une citation."""
    avant = message[:position]
    ligne = avant.rsplit("\n", 1)[-1]
    return (
        avant.count("«") > avant.count("»")
        or ligne.count("`") % 2 == 1
        or ligne.count('"') % 2 == 1
    )


def premiere_absence(message: str):
    """La première affirmation d'absence qui n'est pas une citation, ou None."""
    for m in ABSENCE.finditer(message):
        if not _entre_guillemets(message, m.start()):
            return m
    return None


def _phrase(message: str, debut: int, fin: int) -> str:
    """La phrase qui contient l'affirmation."""
    a = max(message.rfind(c, 0, debut) for c in ".!?\n") + 1
    b_candidats = [message.find(c, fin) for c in ".!?\n"]
    b = min((x for x in b_candidats if x != -1), default=len(message))
    return message[a:b]


def recherche_pertinente(phrase: str, tour: list[dict]) -> bool:
    """Un mot de la phrase (5 premières lettres) figure dans un appel d'outil du tour.

    Heuristique : on ne sait pas dire qu'une recherche prouve une absence, mais on
    sait dire qu'aucun appel du tour ne parle du sujet de la phrase.
    """
    # Les écritures (Write, Edit…) ne comptent pas : elles contiennent l'affirmation elle-même.
    ecritures = {"Write", "Edit", "NotebookEdit", "TaskCreate", "TaskUpdate", "SendUserFile"}
    appels = " ".join(e["entree"].lower() for e in tour if e["genre"] == "appel" and e["nom"] not in ecritures)
    mots = [m for m in re.findall(r"[a-zàâçéèêëîïôûùüÿ]{5,}", phrase.lower()) if m not in MOTS_VIDES]
    return any(m[:5] in appels for m in mots)


def a_lu_planification(tour: list[dict]) -> bool:
    return any(
        PREUVE_HORAIRE.search(e.get("nom", "") + " " + e.get("entree", "") + " " + e.get("texte", ""))
        for e in tour
        if e["genre"] in ("appel", "resultat")
    )


# --- Analyse (fonction pure) ---------------------------------------------------

def _extrait(texte: str, debut: int, fin: int) -> str:
    morceau = " ".join(texte[max(0, debut - 30): fin + 40].split())
    return morceau[:MAX_EXTRAIT]


def _vu(ref: str, vus: set[str]) -> bool:
    r = ref.lstrip("#").lower()
    if r in vus:
        return True
    # Un hash cité en forme courte se retrouve en tête d'un hash long vu dans une sortie.
    return len(r) >= 7 and any(t.startswith(r) for t in vus if len(t) > len(r))


def analyser(message: str, session: list[dict], vus: set[str] | None = None) -> list[dict]:
    """Alertes pour un message final, d'après la transcription. Aucun effet de bord.

    `vus` (facultatif) : jetons déjà relevés dans la session, pour ne pas la relire
    à chaque appel quand on rejoue une longue transcription.
    """
    alertes: list[dict] = []
    tour = tour_courant(session)

    m = premiere_absence(message)
    if m:
        if not a_regarde(tour):
            detail = "affirmation d'absence sans lecture ni recherche dans ce tour"
        elif not recherche_pertinente(_phrase(message, m.start(), m.end()), tour):
            detail = "affirmation d'absence : aucun appel d'outil du tour ne porte sur ce sujet"
        else:
            detail = ""
        if detail:
            alertes.append({"type": "absence", "extrait": _extrait(message, m.start(), m.end()), "detail": detail})

    vus = vus if vus is not None else jetons_vus(session)
    refs = {m.group(0) for m in REF_PR.finditer(message)} | {m.group(0) for m in REF_HASH.finditer(message)}
    inconnues = sorted(r for r in refs if not _vu(r, vus))
    if inconnues:
        alertes.append({
            "type": "reference",
            "extrait": ", ".join(inconnues[:6]),
            "detail": "référence absente de toute sortie d'outil de la session (citée de mémoire ?)",
        })

    cron = next((c for c in CRON.finditer(message) if "*" in c.group(0) or "/" in c.group(0)), None)
    h = cron or CADENCE.search(message)
    if h and not a_lu_planification(tour):
        alertes.append({
            "type": "horaire",
            "extrait": _extrait(message, h.start(), h.end()),
            "detail": "horaire ou cadence cités sans lecture d'une configuration de planification dans ce tour",
        })
    return alertes


def format_avertissement(alertes: list[dict]) -> str:
    lignes = ["⚠ Garde-fou de vérification (avertissement, rien n'est bloqué) :"]
    lignes += [f"  - [{a['type']}] « {a['extrait']} » : {a['detail']}" for a in alertes]
    return "\n".join(lignes)


# --- Points d'entrée -------------------------------------------------------------

def _journaliser(alertes: list[dict], message: str) -> None:
    chemin = os.environ.get("VERIF_JOURNAL")
    if not chemin:
        return
    with open(chemin, "a", encoding="utf-8") as j:
        j.write(json.dumps({"alertes": alertes, "message": message[:300]}, ensure_ascii=False) + "\n")


def main_hook() -> int:
    try:
        donnees = json.loads(sys.stdin.read() or "{}")
        message = donnees.get("last_assistant_message") or ""
        chemin = donnees.get("transcript_path") or ""
        if not message or not chemin:
            return 0
        alertes = analyser(message, lire_session(os.path.expanduser(chemin)))
        if not alertes:
            return 0
        _journaliser(alertes, message)
        # Avertissement seulement : ni `decision`, ni code 2.
        print(json.dumps({"systemMessage": format_avertissement(alertes)}, ensure_ascii=False))
    except Exception:  # noqa: BLE001 — fail-open : ne jamais gêner une session
        return 0
    return 0


def rejouer(chemin: str, detail: bool) -> int:
    """Rejoue la règle sur une session passée : combien d'alertes, de quel type."""
    entrees = lire_session(chemin)
    # Un « tour » finit par un texte de l'assistant, juste avant le prochain prompt.
    tours, courant = [], []
    for e in entrees:
        if e["genre"] == "prompt" and courant:
            tours.append(courant)
            courant = []
        courant.append(e)
    if courant:
        tours.append(courant)

    total = avec_alerte = 0
    par_type: dict[str, int] = {}
    reperes = 0
    session: list[dict] = []
    vus: set[str] = set()
    for tour in tours:
        session = session + tour
        vus |= jetons_vus(tour)
        textes = [e["texte"] for e in tour if e["genre"] == "texte"]
        if not textes:
            continue
        total += 1
        alertes = analyser(textes[-1], session, vus)
        if alertes:
            avec_alerte += 1
            for a in alertes:
                par_type[a["type"]] = par_type.get(a["type"], 0) + 1
            if detail and reperes < 25:
                reperes += 1
                print(f"--- tour {total}\n{format_avertissement(alertes)}\n    message : {textes[-1][:160]!r}")
    print(f"Tours avec réponse : {total} ; avec au moins une alerte : {avec_alerte}")
    print(f"Par type : {par_type}")
    return 0


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "--rejouer":
        sys.exit(rejouer(sys.argv[2], "--detail" in sys.argv))
    sys.exit(main_hook())
