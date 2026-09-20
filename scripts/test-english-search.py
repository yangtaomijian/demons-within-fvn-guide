"""Run shared search-boundary tests with English labels, then check the built corpus."""
import importlib.util
import json
from pathlib import Path
import re
import unittest

root = Path(__file__).resolve().parents[1]
def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module
adapter = load('english_search', root / 'site-en/scripts/build-safe-search.py')
base = load('search_tests', root / 'scripts/test-safe-search.py')
base.search = adapter.shared

class EnglishBoundaryTests(base.SafeSearchTests):
    # These two assertions are specifically about Chinese aliases, tested separately.
    test_chinese_names_retain_english_search_and_stable_targets = None
    test_home_game_name_aliases_preserve_native_text_and_are_idempotent = None

class EnglishCorpusTests(unittest.TestCase):
    def test_built_queries_and_language_boundary(self):
        records = json.loads((root / '_site/en/search.json').read_text())
        self.assertEqual(len(records), 121)
        for r in records:
            self.assertIsNone(re.search('[\u4e00-\u9fff]', r['title'] + r['section'] + r['text']))
        for query in ('warehouse', 'Boris', 'Prank on Edwin', 'Exalted Donations',
                      'Garret Asleep', 'Ludwig massage', 'Red-eyes Wolf', 'Sprite Viewer'):
            self.assertTrue(any(query.casefold() in (r['section'] + ' ' + r['text']).casefold() for r in records), query)

if __name__ == '__main__':
    unittest.main()
