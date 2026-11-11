// Rendu déterministe des représentations normalisées et du repli sûr.
//
// Ce module est volontairement séparé du gabarit principal : il accepte un
// objet `job` partiel, ne touche jamais aux champs source et renvoie un HTML
// déjà échappé. En l'absence d'une représentation `ready`, il renvoie null
// pour laisser l'ancien chemin intact.

const SECTION_KEYS = [
  ['overview', 'Présentation du poste'],
  ['missions', 'Vos missions'],
  ['profile', 'Profil recherché'],
  ['skills', 'Compétences et outils'],
  ['conditions', 'Conditions et avantages'],
  ['recruitment', 'Processus de recrutement'],
  ['additional', 'Informations complémentaires'],
];

function echapper(valeur) {
  return String(valeur == null ? '' : valeur).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function texteDeBloc(bloc) {
  if (typeof bloc.text === 'string') return bloc.text;
  if (Array.isArray(bloc.inlines)) return bloc.inlines.map((i) => i && i.text || '').join('');
  return '';
}

function renduBloc(bloc) {
  if (!bloc || typeof bloc !== 'object') return '';
  switch (bloc.kind) {
    case 'heading':
      return `<h2>${echapper(texteDeBloc(bloc))}</h2>`;
    case 'quote':
      return `<blockquote><p>${echapper(texteDeBloc(bloc))}</p></blockquote>`;
    case 'list': {
      const items = Array.isArray(bloc.items) ? bloc.items : [];
      const tag = bloc.ordered ? 'ol' : 'ul';
      return `<${tag}>${items.map((item) => `<li>${renduBloc(item)}</li>`).join('')}</${tag}>`;
    }
    case 'list_item':
    case 'paragraph':
    default:
      return `<p>${echapper(texteDeBloc(bloc))}</p>`;
  }
}

export function corpsNormalise(normalized) {
  if (!normalized || normalized.status !== 'ready' || !Array.isArray(normalized.sections) || !Array.isArray(normalized.blocks)) {
    return null;
  }
  const blocksById = new Map(normalized.blocks.map((b) => [b && b.id, b]));
  const labels = new Map(SECTION_KEYS);
  const seen = new Set();
  const sections = normalized.sections
    .filter((s) => s && labels.has(s.key) && Array.isArray(s.block_ids))
    .map((s) => {
      const blocs = s.block_ids.map((id) => {
        if (seen.has(id)) return null;
        seen.add(id);
        return blocksById.get(id);
      }).filter(Boolean);
      if (!blocs.length) return '';
      return `<section class="section section-${echapper(s.key)}"><h2>${echapper(labels.get(s.key))}</h2>${blocs.map(renduBloc).join('')}</section>`;
    })
    .filter(Boolean);
  return sections.length ? sections.join('') : null;
}

export function texteOriginal(original) {
  if (!original || original.available !== true || typeof original.content !== 'string' || !original.content.trim()) {
    return '';
  }
  const kind = original.kind === 'description_html_safe' ? 'html-safe' : 'text';
  return `<details class="texte-original" data-original-kind="${kind}"><summary>Consulter le texte original</summary><div class="original-sure">${kind === 'html-safe' ? original.content : paragraphes(original.content)}</div></details>`;
}

function paragraphes(texte) {
  return String(texte || '')
    .split(/\n+/)
    .map((p) => echapper(p).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((p) => `<p>${p}</p>`)
    .join('');
}

export function construireCorps(job, ancienCorps) {
  const normalise = corpsNormalise(job && job.normalized);
  if (normalise) return normalise;
  return ancienCorps || '';
}
