// PR DE TEST, NE JAMAIS FUSIONNER (27/11/2026).
// Ce fichier n'est rangé dans aucune famille de tests : le lanceur
// (tools/run-tests.cjs) fait alors échouer la famille « statique ». Le
// contrôle « Controles statiques » doit donc être ROUGE, et la règle de
// protection de `main` doit refuser la fusion de cette PR.
process.exit(1);
