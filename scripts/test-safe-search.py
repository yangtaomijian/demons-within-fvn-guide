"""Boundary regressions for the build hook; uses temporary, synthetic public HTML only."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('safe_search', Path(__file__).with_name('build-safe-search.py'))
search = importlib.util.module_from_spec(spec)
spec.loader.exec_module(search)


class SafeSearchTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.output = Path(self.temp.name)
        self.native = dict(objectID='index.html', href='index.html', title='Home', section='', text='Safe native text')
        for page, (level, _) in search.PAGES.items():
            content = ('<section id="memorium"><h2 data-anchor-id="memorium">Memorium</h2></section>'
                       '<table><tr><td><span id="mem-example">Example &amp; Name</span></td>'
                       '<td>PRIVATE_ROUTE_SENTINEL</td></tr></table>' if level == 'items' else
                       f'<section id="scene"><{level} data-anchor-id="scene">Example <em>scene</em></{level}>'
                       '<p>PRIVATE_ROUTE_SENTINEL</p></section>')
            path = self.output / page
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('<main><h1 class="title">Public title</h1>' + content + '</main>')
        self.index = self.output / 'search.json'
        self.index.write_text(json.dumps([self.native]))

    def test_no_body_leak_and_native_preserved(self):
        search.rebuild(self.output)
        result = json.loads(self.index.read_text())
        self.assertEqual(result[0], self.native)
        self.assertNotIn('PRIVATE_ROUTE_SENTINEL', self.index.read_text())
        item = next(r for r in result if r['href'].endswith('#mem-example'))
        self.assertIn('Example &amp; Name', item['text'])
        self.assertEqual(item['section'], 'Example & Name')

    def test_repeat_replaces_stale_anchors_and_unsafe_owned_records(self):
        search.rebuild(self.output)
        first = self.index.read_bytes()
        search.rebuild(self.output)
        self.assertEqual(first, self.index.read_bytes())
        records = json.loads(first)
        records.append(dict(self.native, objectID='guide/choices.html#removed', href='guide/choices.html#removed', text='PRIVATE_ROUTE_SENTINEL'))
        self.index.write_text(json.dumps(records))
        page = self.output / 'guide/choices.html'
        page.write_text(page.read_text().replace('scene', 'renamed'))
        search.rebuild(self.output)
        hrefs = [r['href'] for r in json.loads(self.index.read_text())]
        self.assertNotIn('guide/choices.html#scene', hrefs)
        self.assertNotIn('guide/choices.html#removed', hrefs)
        self.assertIn('guide/choices.html#renamed', hrefs)
        self.assertNotIn('PRIVATE_ROUTE_SENTINEL', self.index.read_text())
        self.assertEqual(len(hrefs), len(set(hrefs)))

    def test_missing_page_fails_without_overwriting_index(self):
        first = self.index.read_bytes()
        (self.output / 'collectibles/cg.html').unlink()
        with self.assertRaises(FileNotFoundError):
            search.rebuild(self.output)
        self.assertEqual(first, self.index.read_bytes())

    def test_chinese_names_retain_english_search_and_stable_targets(self):
        page = self.output / 'collectibles/memorium.html'
        page.write_text('<main><h1 class="title">辞书与 Sprite Viewer 查漏</h1>'
                        '<span id="mem-prank-on-edwin">捉弄Edwin</span>'
                        '<span id="mem-exalted-donations">崇高之捐赠</span>'
                        '<span id="mem-red-eyes-wolf">红眼狼</span>'
                        '<p>PRIVATE_ROUTE_SENTINEL</p></main>')
        search.rebuild(self.output)
        records = {r['href']: r for r in json.loads(self.index.read_text())}
        for anchor, chinese, english in (
            ('mem-prank-on-edwin', '捉弄Edwin', 'Prank on Edwin'),
            ('mem-exalted-donations', '崇高之捐赠', 'Exalted Donations'),
            ('mem-red-eyes-wolf', '红眼狼', 'Red-eyes Wolf'),
        ):
            href = 'collectibles/memorium.html#' + anchor
            record = records[href]
            self.assertEqual(record['objectID'], href)
            self.assertIn(chinese, record['section'])
            self.assertIn(english, record['section'])
        self.assertNotIn('PRIVATE_ROUTE_SENTINEL', self.index.read_text())

    def test_home_game_name_aliases_preserve_native_text_and_are_idempotent(self):
        native = dict(self.native, title='心魔在焉玩家攻略', text='心魔在焉；不包含庇护所联动。')
        self.index.write_text(json.dumps([native]))
        search.rebuild(self.output)
        first = self.index.read_bytes()
        record = json.loads(first)[0]
        self.assertEqual(record['text'], native['text'])
        self.assertEqual(record['objectID'], native['objectID'])
        self.assertEqual(record['href'], native['href'])
        self.assertIn('Demons Within', record['section'])
        self.assertIn('Shelter', record['section'])
        search.rebuild(self.output)
        self.assertEqual(first, self.index.read_bytes())


if __name__ == '__main__':
    unittest.main()
