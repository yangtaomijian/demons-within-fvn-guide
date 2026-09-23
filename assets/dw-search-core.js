/* Offline search over the existing safe Quarto search records only. No page reads. */
(function (root) {
  'use strict';

  // Query aliases can be broad; record aliases must be evidence in safe fields.
  const VOCABULARY = [
    { id: 'NO_INTERVENTION', query: ['不干预', '不介入', 'no intervention', "don't intervene", 'do not intervene'], record: ['不干预', '不介入', 'no intervention', "don't intervene", 'do not intervene', "don't select an essence"] },
    { id: 'BAD_ENDING', query: ['坏结局', 'bad ending'], record: ['坏结局', 'bad ending'] },
    { id: 'SPRITE_VIEWER', query: ['sprite viewer', '立绘', 'viewer'], record: ['sprite viewer', '立绘'] },
    { id: 'ESSENCE_WHEEL', query: ['本源之轮', '圆盘', '轮盘', 'essence wheel', 'wheel'], record: ['本源之轮', '圆盘', '轮盘', 'essence wheel', 'wheel'] },
    { id: 'INTERVENTION', query: ['干预', '介入', 'intervention', 'intervene'], record: ['干预', '介入', 'intervention', 'intervene'] },
    { id: 'CHOICE', query: ['怎么选', '如何选', '选择', '选', 'choice', 'choices', 'choose'], record: ['选择', 'choice', 'choices', 'choose'] },
    { id: 'CG', query: ['cg', '画廊', 'gallery'], record: ['cg', '画廊', 'gallery'] },
    { id: 'COLLECTION', query: ['收集', 'collection', 'collect'], record: ['收集', 'collection', 'collect'] },
    { id: 'UNLOCK', query: ['解锁', 'unlock', 'unlocks'], record: ['解锁', 'unlock', 'unlocks'] },
    { id: 'ENDING', query: ['结局', 'ending', 'endings'], record: ['结局', 'ending', 'endings'] },
    { id: 'GLUTTONY', query: ['暴食', 'gluttony'], record: ['暴食', 'gluttony'] },
    { id: 'CODEX', query: ['辞书', '记闻', 'memorium', 'memory codex', 'codex'], record: ['辞书', '记闻', 'memorium', 'memory codex', 'codex'] },
    { id: 'WAREHOUSE', query: ['仓库', 'warehouse'], record: ['仓库', 'warehouse'] },
    { id: 'MECHANICS', query: ['机制', 'mechanics'], record: ['机制', 'mechanics'] },
    { id: 'SAVE', query: ['存档', 'save'], record: ['存档', 'save'] },
    { id: 'FAQ', query: ['常见问题', 'faq'], record: ['常见问题', 'faq'] },
  ];

  const PAGE_CONCEPTS = {
    'guide/choices.html': ['CHOICE', 'ESSENCE_WHEEL', 'SAVE'],
    'reference/interventions.html': ['CHOICE', 'INTERVENTION', 'ESSENCE_WHEEL', 'MECHANICS'],
    'collectibles/cg.html': ['CG', 'COLLECTION', 'UNLOCK'],
    'collectibles/memorium.html': ['CODEX', 'SPRITE_VIEWER', 'COLLECTION', 'UNLOCK'],
    'guide/faq.html': ['FAQ'],
  };
  const STOPWORDS = new Set([
    '怎么', '如何', '怎样', '哪里', '什么', '为什么', '我', '的', '了', '在', '想', '要', '能', '可以', '吗', '查', '查看', '找到',
    'how', 'do', 'i', 'to', 'the', 'a', 'an', 'and', 'is', 'can', 'where', 'find',
  ]);
  const CJK = /[\p{Script=Han}]/u;
  const WORD = /[\p{L}\p{N}]/u;

  function normalize(text) {
    return String(text ?? '').normalize('NFKC').toLowerCase()
      .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
      .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
  }

  function boundary(text, start, end, phrase) {
    // Latin words need word boundaries, but CG场景 and 暴食CG need none at the Han edge.
    return (!WORD.test(phrase[0]) || CJK.test(phrase[0]) || start === 0 || !WORD.test(text[start - 1]) || CJK.test(text[start - 1])) &&
      (!WORD.test(phrase.at(-1)) || CJK.test(phrase.at(-1)) || end === text.length || !WORD.test(text[end]) || CJK.test(text[end]));
  }

  function aliases(kind) {
    return VOCABULARY.flatMap(({ id, [kind]: forms }) => forms.map(form => ({ id, form: normalize(form) })))
      .sort((a, b) => b.form.length - a.form.length || a.id.localeCompare(b.id) || a.form.localeCompare(b.form));
  }
  const QUERY_ALIASES = aliases('query');
  const RECORD_ALIASES = aliases('record');

  function extract(text, forms) {
    const concepts = new Set();
    const spans = [];
    // Longest-first over the entire string; a consumed negation cannot also match its suffix.
    for (const { id, form } of forms) {
      let at = text.indexOf(form);
      while (at !== -1) {
        const end = at + form.length;
        if (boundary(text, at, end, form) && !spans.some(([a, b]) => at < b && a < end)) {
          spans.push([at, end]);
          concepts.add(id);
        }
        at = text.indexOf(form, at + 1);
      }
    }
    const chars = text.split('');
    for (const [start, end] of spans) chars.fill(' ', start, end);
    return { concepts, remainder: chars.join('').replace(/\s+/g, ' ').trim() };
  }

  function tokenize(text, lang) {
    const pieces = [];
    // Isolate Latin runs first, so a Chinese segmenter never merges CG with adjacent Han.
    for (const run of text.match(/[\p{Script=Han}]+|[\p{L}\p{N}]+/gu) || []) {
      if (CJK.test(run[0])) {
        if (typeof Intl !== 'undefined' && Intl.Segmenter) {
          const segmenter = new Intl.Segmenter('zh', { granularity: 'word' });
          const segments = Array.from(segmenter.segment(run), item => item.segment);
          pieces.push(...(segments.every(part => part.length === 1) ? [run] : segments));
        } else {
          // Deterministic fallback: whole Han run, never a broad OR of characters.
          pieces.push(run);
        }
      } else {
        pieces.push(run);
      }
    }
    return [...new Set(pieces.map(normalize).filter(part => part && !STOPWORDS.has(part)))];
  }

  function parseQuery(query, lang) {
    const normalized = normalize(query);
    const { concepts, remainder } = extract(normalized, QUERY_ALIASES);
    return {
      raw: String(query ?? ''), normalized,
      concepts: [...concepts].sort(), tokens: tokenize(remainder, lang),
      phrase: normalized,
    };
  }

  function words(text) {
    return new Set(text.match(/[\p{L}\p{N}]+/gu) || []);
  }

  function prepare(records, lang) {
    return records.map(record => {
      const visible = { title: record.title, section: record.section, text: record.text };
      const fields = Object.fromEntries(Object.entries(visible).map(([key, value]) => [key, normalize(value)]));
      const fieldWords = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, words(value)]));
      const path = String(record.href).split(/[?#]/, 1)[0];
      const hidden = new Set(PAGE_CONCEPTS[path] || []);
      const fieldConcepts = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, extract(value, RECORD_ALIASES).concepts]));
      // A Bad Ending is also an ending; the converse is not true.
      for (const set of Object.values(fieldConcepts)) if (set.has('BAD_ENDING')) set.add('ENDING');
      return { record, fields, fieldWords, fieldConcepts, hidden, lang };
    });
  }

  function tokenQuality(token, field, fieldWords) {
    if (fieldWords.has(token)) return 3;
    if ([...fieldWords].some(word => word.startsWith(token))) return 2;
    return field.includes(token) ? 1 : 0;
  }

  function scoreUnit(unit, item, concept) {
    const weights = { section: 24, title: 20, text: 5 };
    let best = 0;
    for (const field of ['section', 'title', 'text']) {
      const quality = concept ? (item.fieldConcepts[field].has(unit) ? 3 : 0) :
        tokenQuality(unit, item.fields[field], item.fieldWords[field]);
      if (quality) best = Math.max(best, weights[field] + (concept ? 25 : [0, 2, 20, 90][quality]));
    }
    // A page tag is weaker than safe text alone, but corroborates a visible match.
    if (concept && item.hidden.has(unit)) best = best ? best + 12 : 18;
    return best;
  }

  function containsPhrase(field, phrase) {
    let at = field.indexOf(phrase);
    while (at !== -1) {
      if (boundary(field, at, at + phrase.length, phrase)) return true;
      at = field.indexOf(phrase, at + 1);
    }
    return false;
  }

  function search(query, preparedRecords, lang) {
    const parsed = parseQuery(query, lang);
    const units = [...parsed.concepts.map(id => ({ value: id, concept: true })),
      ...parsed.tokens.map(value => ({ value, concept: false }))];
    if (!units.length) return [];
    return preparedRecords.flatMap((item, index) => {
      const scores = units.map(unit => scoreUnit(unit.value, item, unit.concept));
      if (scores.some(score => score === 0)) return [];
      let score = scores.reduce((total, value) => total + value, 0);
      const { section, title, text } = item.fields;
      const phrase = parsed.phrase;
      if (phrase && (containsPhrase(section, phrase) || containsPhrase(title, phrase))) score += 45;
      else if (phrase && containsPhrase(text, phrase)) score += 8;
      return [{ record: item.record, score, index }];
    }).sort((a, b) => b.score - a.score || a.index - b.index || a.record.href.localeCompare(b.record.href))
      .map(({ record }) => ({ objectID: record.objectID, href: record.href, title: record.title, section: record.section, text: record.text }));
  }

  const core = { normalize, parseQuery, prepare, search };
  if (typeof module !== 'undefined' && module.exports) module.exports = core;
  root.DWSearchCore = core;
})(globalThis);
