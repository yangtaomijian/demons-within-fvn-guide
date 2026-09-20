#!/usr/bin/env python3
"""Rebuild locator records after Quarto, without reading guide paragraphs or tables' conditions."""
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
from urllib.parse import urlsplit

# Only public names, not route instructions. CG table link labels supply their own aliases.
ALIASES = {
    '心魔在焉': 'Demons Within',
    '庇护所': 'Shelter',
    '记闻': 'Memorium／辞书／Memory Codex／Codex',
    '辞书': 'Memory Codex／Codex／记闻／Memorium',
    'Sprite Viewer': '立绘／Viewer',
    '仓库': 'warehouse',
    '长官浴场': 'Officer Bath／Commander Brigham／Brigham 指挥官',
    '前期 Garret 浴场谈话': 'Watch House／哨所',
    '色欲': 'Lust',
    '骑士团': 'Order',
    '懒惰': 'Sloth',
    '真心话大冒险': 'Truth or Dare',
    '主线流程与关键分歧': 'Essence Wheel／本源之轮',
    '红眼狼': 'Red-eyes Wolf／黑狼',
    '红眼狐狸': 'Red-eyes Fox／狐狸',
    '疗养处': 'Infirmary',
    'Resnick的宿舍': "Resnick's Bedroom",
    '浴室': 'Baths',
    '中庭': 'Inner Courtyard',
    'Heirdall城': 'Heirdall City',
    'Heirdall图书馆': 'Heirdall Library',
    '疲兵酒馆': 'The Weary Soldier',
    '旧仓库': 'Old Warehouse',
    '沼泽地': 'The Marshlands',
    '首都': 'The Capital',
    '破晓竞技赛': 'Dawn Tournament',
    '休息日': 'Spare Days',
    'Resnick喜欢的书': "Resnick's Favorite Book",
    '捉弄Edwin': 'Prank on Edwin',
    '与父亲一起钓鱼': 'Fishing with Father',
    '水中培根': 'Bacon in the Water',
    'Russel最棒的恶作剧': "Russel's Best Prank",
    '遇见Sam': 'Meeting Sam',
    '晕倒在浴室': 'Passing Out in the Baths',
    '队长最烂的惩罚': "Captain's Worst Punishment",
    '夜中怪声': 'Scary Sounds at Night',
    '破晓骑士团': 'Dawnbreak Order',
    '红眼怪': 'Red-eyes',
    'Alistair团长': 'Grand Marshall Alistair',
    '取得生前名': 'Earning a Name',
    'Arlington指挥官': 'Commander Arlington',
    '破晓精英小队': 'Dawnbreak Elites',
    '崇高之捐赠': 'Exalted Donations',
}

PAGES = {
    'guide/choices.html': ('h2', '查看该场景的关键选择与回看建议。'),
    'reference/interventions.html': ('h3', '查看该场景中的本源之轮操作与差分。'),
    'collectibles/cg.html': ('h2', '查看该场景组的出现位置、观看条件与变体。'),
    'collectibles/memorium.html': ('items', ''),
}
FIELDS = {'objectID', 'href', 'title', 'section', 'text'}


class Names(HTMLParser):
    """Read only headings, anchored item names, and same-page link labels inside main."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.in_main = False
        self.title = ''
        self.headings = []
        self.items = []
        self.labels = {}
        self.capture = None
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'main':
            self.in_main = True
        if not self.in_main:
            return
        if attrs.get('id'):
            if attrs['id'] in self.ids:
                raise ValueError('Duplicate public anchor: ' + attrs['id'])
            self.ids.add(attrs['id'])
        if self.capture:
            return
        anchor = attrs.get('data-anchor-id', '')
        if tag == 'h1' and 'title' in attrs.get('class', '').split():
            self.capture = [tag, 'title', '', []]
        elif tag in ('h2', 'h3') and anchor:
            self.capture = [tag, 'heading', anchor, []]
        elif tag == 'span' and attrs.get('id', '').startswith(('mem-', 'sprite-')):
            self.capture = [tag, 'item', attrs['id'], []]
        elif tag == 'a' and attrs.get('href', '').startswith('#'):
            self.capture = [tag, 'label', attrs['href'][1:], []]

    def handle_data(self, data):
        if self.capture:
            self.capture[3].append(data)

    def handle_endtag(self, tag):
        if self.capture and self.capture[0] == tag:
            start, kind, anchor, chunks = self.capture
            text = ' '.join(''.join(chunks).split())
            if kind == 'title':
                self.title = text
            elif kind == 'heading':
                self.headings.append((start, anchor, text))
            elif kind == 'item':
                self.items.append((anchor, text))
            else:
                self.labels.setdefault(anchor, set()).add(text)
            self.capture = None
        if tag == 'main':
            self.in_main = False


def record(page, names, anchor, name, summary, extra=()):
    if not name or anchor not in names.ids:
        raise ValueError('Missing name or anchor: ' + page + '#' + anchor)
    aliases = list(extra)
    for term, words in ALIASES.items():
        if term.casefold() in name.casefold():
            aliases.append(words)
    words = ' · '.join(sorted(set(a for a in aliases if a and a != name)))
    # Quarto treats text as rich HTML. Escape names even though current names are plain text.
    text = html.escape(name + ('（' + words + '）' if words else '') + '。' + summary)
    href = page + '#' + anchor
    return dict(objectID=href, href=href, title=names.title, section=name + ('（' + words + '）' if words else ''), text=text)


def locators(output):
    result = []
    for page, (level, summary) in PAGES.items():
        names = Names()
        names.feed((output / page).read_text(encoding='utf-8'))
        if not names.title:
            raise ValueError('Missing page title: ' + page)
        if level == 'items':
            for tag, anchor, name in names.headings:
                if anchor in ('memorium', 'sprite-viewer'):
                    result.append(record(page, names, anchor, name, '按条目名称查找对应的收集说明。'))
            for anchor, name in names.items:
                summary = ('查看该辞书条目的出现位置与解锁方式。' if anchor.startswith('mem-')
                           else '查看该 Sprite Viewer 状态的取得条件。')
                result.append(record(page, names, anchor, name, summary))
            if not names.items:
                raise ValueError('No anchored collection items: ' + page)
        else:
            headings = [h for h in names.headings if h[0] == level]
            if not headings:
                raise ValueError('No scene headings: ' + page)
            for tag, anchor, name in headings:
                extra = names.labels.get(anchor, ()) if page == 'collectibles/cg.html' else ()
                result.append(record(page, names, anchor, name, summary, extra))
    return result


def rebuild(output):
    path = output / 'search.json'
    original = json.loads(path.read_text(encoding='utf-8'))
    # Sidebar breadcrumbs are navigation metadata; retain the existing safe index schema.
    for record in original:
        record.pop('crumbs', None)
    # Replace all owned pages, including stale anchors left by incremental Quarto indexing.
    retained = [r for r in original if urlsplit(r['href']).path not in PAGES]
    # The home page's two localized game names also need their old English queries.
    # Only append names already present on that public page; preserve native body text.
    for r in retained:
        if r['href'] == 'index.html':
            aliases = [ALIASES[name] for name in ('心魔在焉', '庇护所')
                       if name in r['text'] and ALIASES[name] not in r['section']]
            if aliases:
                r['section'] = ' · '.join(filter(None, [r['section'], *aliases]))
    generated = locators(output)
    result = []
    seen = {}
    for r in retained + generated:
        if set(r) != FIELDS or not all(isinstance(v, str) for v in r.values()):
            raise ValueError('Unexpected Quarto search schema')
        if r['href'] in seen:
            if seen[r['href']] != r:
                raise ValueError('Conflicting records for ' + r['href'])
            continue
        seen[r['href']] = r
        result.append(r)
    if len({r['objectID'] for r in result}) != len(result):
        raise ValueError('Duplicate objectID')
    temporary = path.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temporary.replace(path)
    return len(retained), len(generated), len(result)


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    output = Path(os.environ.get('QUARTO_PROJECT_OUTPUT_DIR', '_site'))
    if not output.is_absolute():
        output = root / output
    native, safe, total = rebuild(output)
    print(f'Safe search: {native} native + {safe} locator records = {total}.')
