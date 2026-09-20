#!/usr/bin/env python3
"""English labels over the shared heading-only search generator."""
import html
import importlib.util
import os
from pathlib import Path

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('shared_search', root.parent / 'scripts/build-safe-search.py')
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)
shared.ALIASES = {"Massage": 'Ludwig massage', 'Memory Codex': 'Memorium · Codex'}
shared.PAGES = {
    'guide/choices.html': ('h2', 'Key choices and save advice for this scene.'),
    'reference/interventions.html': ('h3', 'Essence Wheel options and variations for this scene.'),
    'collectibles/cg.html': ('h2', 'Where this scene appears and how to see its variations.'),
    'collectibles/memorium.html': ('items', ''),
}

def record(page, names, anchor, name, summary, extra=()):
    if not name or anchor not in names.ids:
        raise ValueError('Missing name or anchor: ' + page + '#' + anchor)
    if page == 'collectibles/memorium.html':
        summary = ('Where to find this entry and how to unlock it.' if anchor.startswith('mem-') else
                   'Unlock requirements for this Sprite Viewer state.' if anchor.startswith('sprite-') and anchor != 'sprite-viewer' else
                   'Look up unlock requirements by entry name.')
    aliases = set(extra)
    aliases.update(words for term, words in shared.ALIASES.items() if term.casefold() in name.casefold())
    words = ' · '.join(sorted(a for a in aliases if a and a != name))
    label = name + (' (' + words + ')' if words else '')
    href = page + '#' + anchor
    return dict(objectID=href, href=href, title=names.title, section=label, text=html.escape(label + '. ' + summary))

shared.record = record
rebuild = shared.rebuild
if __name__ == '__main__':
    output = Path(os.environ.get('QUARTO_PROJECT_OUTPUT_DIR', '_site'))
    if not output.is_absolute():
        output = root / output
    native, safe, total = rebuild(output)
    print(f'English safe search: {native} native + {safe} locator records = {total}.')
