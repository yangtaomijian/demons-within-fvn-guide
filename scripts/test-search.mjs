import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const core = require(join(root, 'assets/dw-search-core.js'));
assert.equal(globalThis.DWSearchCore, core, 'browser global and CommonJS must expose one implementation');
const readJSON = path => JSON.parse(readFileSync(join(root, path), 'utf8'));
const corpus = {
  zh: readJSON('_site/search.json'),
  en: readJSON('_site/en/search.json'),
};
const before = JSON.stringify(corpus);
const prepared = Object.fromEntries(Object.entries(corpus).map(([lang, records]) => [lang, core.prepare(records, lang)]));
const cases = readJSON('scripts/search-cases.json').cases;

assert.equal(core.normalize('  ＣＧ，  场景  '), 'cg 场景');
function parsed(query, lang, concepts, tokens = []) {
  const actual = core.parseQuery(query, lang);
  for (const concept of concepts) assert.ok(actual.concepts.includes(concept), `${query}: missing ${concept}: ${JSON.stringify(actual)}`);
  for (const token of tokens) assert.ok(actual.tokens.includes(token), `${query}: missing token ${token}: ${JSON.stringify(actual)}`);
  return actual;
}
parsed('CG场景', 'zh', ['CG'], ['场景']);
parsed('CG 场景', 'zh', ['CG'], ['场景']);
parsed('暴食CG', 'zh', ['GLUTTONY', 'CG']);
parsed('Sprite Viewer解锁', 'zh', ['SPRITE_VIEWER', 'UNLOCK']);
parsed('本源之轮怎么选', 'zh', ['ESSENCE_WHEEL', 'CHOICE']);
parsed('圆盘怎么选', 'zh', ['ESSENCE_WHEEL', 'CHOICE']);
parsed('仓库结局', 'zh', ['WAREHOUSE', 'ENDING']);
parsed('how to choose Essence Wheel', 'en', ['CHOICE', 'ESSENCE_WHEEL']);
parsed('Bad Ending', 'en', ['BAD_ENDING']);
parsed('Memory Codex', 'en', ['CODEX']);
const negative = parsed('no intervention', 'en', ['NO_INTERVENTION']);
assert.ok(!negative.concepts.includes('INTERVENTION'), 'negated phrase must not also extract INTERVENTION');
assert.ok(!parsed('不介入', 'zh', ['NO_INTERVENTION']).concepts.includes('INTERVENTION'));
assert.ok(parsed('intervention', 'en', ['INTERVENTION']).concepts.includes('INTERVENTION'));

let failed = 0;
for (const test of cases) {
  assert.ok(test.lang in prepared, `Unsupported case language ${test.lang}`);
  const found = core.search(test.query, prepared[test.lang], test.lang);
  const hrefs = found.map(result => result.href);
  const pages = hrefs.map(href => href.split('#')[0]);
  const expectations = Object.entries(test).filter(([key]) => !['lang', 'query'].includes(key));
  const problems = [];
  if (!expectations.length) problems.push('case has no expectation');
  if (test.expectNoResults && found.length) problems.push('expected no results');
  if (test.mustIncludeHref && !hrefs.includes(test.mustIncludeHref)) problems.push(`must include href ${test.mustIncludeHref}`);
  if (test.mustIncludePage && !pages.includes(test.mustIncludePage)) problems.push(`must include page ${test.mustIncludePage}`);
  if (test.topHref && hrefs[0] !== test.topHref) problems.push(`top href must be ${test.topHref}`);
  if (test.topPage && pages[0] !== test.topPage) problems.push(`top page must be ${test.topPage}`);
  if (test.mustRankBeforeHref) {
    const first = hrefs.indexOf(test.rankHref);
    const second = hrefs.indexOf(test.mustRankBeforeHref);
    if (first < 0 || second < 0 || first >= second) problems.push(`${test.rankHref} must rank before ${test.mustRankBeforeHref}`);
  }
  if (problems.length) {
    failed++;
    console.error(`[${test.lang}] ${JSON.stringify(test.query)}: ${problems.join('; ')}`);
    console.error(`  expected: ${JSON.stringify(Object.fromEntries(expectations))}`);
    console.error(`  actual (${found.length}): ${JSON.stringify(found.slice(0, 8).map(({ href, section }) => ({ href, section })))}`);
  }
  for (const result of found) {
    const original = corpus[test.lang].find(record => record.href === result.href);
    assert.deepEqual(result, original, `${test.query}: result must contain only unchanged safe display fields`);
  }
}
assert.equal(JSON.stringify(corpus), before, 'search must not mutate the source corpus');
const counts = { zh: cases.filter(c => c.lang === 'zh').length, en: cases.filter(c => c.lang === 'en').length,
  negative: cases.filter(c => c.expectNoResults).length, ranking: cases.filter(c => c.mustRankBeforeHref).length };
console.log(`Search v2: ${cases.length} cases (${counts.zh} zh, ${counts.en} en; ${counts.negative} negative, ${counts.ranking} ranking), parser assertions; ${failed ? `${failed} FAILED` : 'PASS'}`);
if (failed) process.exitCode = 1;
