#!/usr/bin/env python3
"""Verify the assembled bilingual GitHub Pages publication contract."""

from __future__ import annotations

from html import unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET
from urllib.parse import unquote, urljoin, urlsplit


ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "_site"
ORIGIN = "https://yangtaomijian.github.io"
PREFIX = "/demons-within-fvn-guide/"
ZH_ROOT = ORIGIN + PREFIX
EN_ROOT = ZH_ROOT + "en/"
PAGES = {
    "index.html",
    "guide/choices.html",
    "guide/faq.html",
    "reference/interventions.html",
    "collectibles/cg.html",
    "collectibles/memorium.html",
}
GOOGLE_VERIFICATION_FILE = "googlef0776754787f4a8e.html"
CLOUDFLARE_ANALYTICS_SRC = "https://static.cloudflareinsights.com/beacon.min.js"
CLOUDFLARE_ANALYTICS_TOKEN = "ffdbb2df0096481c8eda339206a91164"
ZH_SITE_NAME = "Demons Within 玩家攻略"
EN_SITE_NAME = "Demons Within Player Guide"
ZH_HOME_TITLE = "心魔在焉（Demons Within）Public 14.6 中文攻略"
EN_HOME_TITLE = "Demons Within Public 14.6 Player Guide"
ZH_HOME_DESCRIPTION = "《心魔在焉（Demons Within）》Public 14.6 FVN 中文攻略，涵盖本源之轮选择、分支与结局、CG、辞书和 Sprite Viewer 解锁条件。"
EN_HOME_DESCRIPTION = "An unofficial Public 14.6 guide for the furry visual novel Demons Within, covering Essence Wheel choices, branch outcomes, endings, CG scenes, Memory Codex entries and Sprite Viewer unlocks."
ZH_SITE_DESCRIPTION = "《心魔在焉（Demons Within）》Public 14.6 非官方中文玩家攻略，涵盖主线选择、结局、CG 与辞书收集。"
EN_SITE_DESCRIPTION = "An unofficial Public 14.6 player guide for Demons Within, covering story choices, endings, CGs, and Memory Codex unlocks."
ISSUES_URL = "https://github.com/yangtaomijian/demons-within-fvn-guide/issues"
FORBIDDEN_URL_PARTS = ("localhost", "file://", "/dw-guide", "\\Users\\", "/Users/")
NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}


class Page(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.html: dict[str, str] = {}
        self.meta: list[dict[str, str]] = []
        self.links: list[dict[str, str]] = []
        self.references: list[tuple[str, str]] = []
        self.ids: set[str] = set()
        self.title = ""
        self._in_title = False
        self._in_body = False
        self._title_chunks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        data = {key: value or "" for key, value in attrs}
        if tag == "html":
            self.html = data
        elif tag == "body":
            self._in_body = True
        elif tag == "meta":
            self.meta.append(data)
        elif tag == "link":
            self.links.append(data)
        elif tag == "title":
            self._in_title = True
            self._title_chunks = []
        if self._in_body and data.get("id"):
            if data["id"] in self.ids:
                raise AssertionError(f"duplicate anchor id: {data['id']}")
            self.ids.add(data["id"])
        if self._in_body and data.get("name") and tag == "a":
            self.ids.add(data["name"])
        for attribute in ("href", "src"):
            if data.get(attribute):
                self.references.append((tag, data[attribute]))

    def handle_endtag(self, tag: str) -> None:
        if tag == "title" and self._in_title:
            self.title = unescape("".join(self._title_chunks).strip())
            self._in_title = False
        elif tag == "body":
            self._in_body = False

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self._title_chunks.append(data)


def parse(path: Path) -> Page:
    page = Page()
    page.feed(path.read_text(encoding="utf-8"))
    return page


def one_meta(page: Page, key: str, path: Path, property_key: bool = False) -> str:
    attribute = "property" if property_key else "name"
    values = [item.get("content", "") for item in page.meta if item.get(attribute) == key]
    if len(values) != 1:
        raise AssertionError(f"{path}: expected exactly one {key}, found {len(values)}")
    return values[0]


def rel_links(page: Page, rel: str) -> list[dict[str, str]]:
    return [item for item in page.links if rel in item.get("rel", "").split()]


def page_url(root: str, logical: str) -> str:
    return root if logical == "index.html" else root + logical


def assert_clean_url(url: str, label: str) -> None:
    if any(part.casefold() in url.casefold() for part in FORBIDDEN_URL_PARTS):
        raise AssertionError(f"{label}: forbidden URL value {url}")


def expected_content_pages() -> dict[Path, tuple[str, str, str, str]]:
    expected: dict[Path, tuple[str, str, str, str]] = {}
    for logical in PAGES:
        expected[SITE / logical] = (logical, ZH_ROOT, "zh-CN", "zh_CN")
        expected[SITE / "en" / logical] = (logical, EN_ROOT, "en", "en_US")
    return expected


def verify_metadata() -> dict[Path, Page]:
    expected = expected_content_pages()
    actual = {
        path
        for path in SITE.rglob("*.html")
        if "site_libs" not in path.parts
        and path != SITE / "404.html"
        and path != SITE / GOOGLE_VERIFICATION_FILE
    }
    if actual != set(expected):
        raise AssertionError(f"content page set mismatch: {sorted(str(p.relative_to(SITE)) for p in actual)}")

    parsed: dict[Path, Page] = {}
    for path, (logical, root, language, locale) in expected.items():
        page = parse(path)
        parsed[path] = page
        canonical = page_url(root, logical)
        if page.html.get("lang") != language:
            raise AssertionError(f"{path}: html lang is {page.html.get('lang')!r}, expected {language}")
        if not page.title:
            raise AssertionError(f"{path}: missing title")
        description = one_meta(page, "description", path)
        canonicals = rel_links(page, "canonical")
        if len(canonicals) != 1 or canonicals[0].get("href") != canonical:
            raise AssertionError(f"{path}: canonical mismatch")

        for key, expected_value in (
            ("og:title", page.title),
            ("og:description", description),
            ("og:url", canonical),
            ("og:locale", locale),
            ("og:site_name", EN_SITE_NAME if language == "en" else ZH_SITE_NAME),
        ):
            if one_meta(page, key, path, property_key=True) != expected_value:
                raise AssertionError(f"{path}: {key} mismatch")
        for key, expected_value in (
            ("twitter:card", "summary"),
            ("twitter:title", page.title),
            ("twitter:description", description),
        ):
            if one_meta(page, key, path) != expected_value:
                raise AssertionError(f"{path}: {key} mismatch")

        if any(item.get("property") == "og:image" for item in page.meta):
            raise AssertionError(f"{path}: unexpected Open Graph image")
        if any(item.get("name") == "twitter:image" for item in page.meta):
            raise AssertionError(f"{path}: unexpected Twitter image")

        alternates = rel_links(page, "alternate")
        actual_alternates = {item.get("hreflang"): item.get("href") for item in alternates if item.get("hreflang")}
        expected_alternates = {
            "zh-CN": page_url(ZH_ROOT, logical),
            "en": page_url(EN_ROOT, logical),
        }
        if len(alternates) != 2 or actual_alternates != expected_alternates:
            raise AssertionError(f"{path}: hreflang mismatch: {actual_alternates}")
        if "x-default" in actual_alternates:
            raise AssertionError(f"{path}: unexpected x-default")

        if logical == "index.html":
            expected_title = EN_HOME_TITLE if language == "en" else ZH_HOME_TITLE
            expected_description = EN_HOME_DESCRIPTION if language == "en" else ZH_HOME_DESCRIPTION
            if page.title != expected_title or description != expected_description:
                raise AssertionError(f"{path}: homepage title or description mismatch")

        for value in [canonical, *actual_alternates.values(), one_meta(page, "og:url", path, True)]:
            assert_clean_url(value, str(path))
    return parsed


def sitemap_urls(path: Path) -> list[str]:
    root = ET.parse(path).getroot()
    return [node.text or "" for node in root.findall("sm:url/sm:loc", NS)]


def verify_sitemaps() -> None:
    for path, root in ((SITE / "sitemap.xml", ZH_ROOT), (SITE / "en/sitemap.xml", EN_ROOT)):
        urls = sitemap_urls(path)
        expected = {page_url(root, logical) for logical in PAGES}
        if len(urls) != len(expected) or len(set(urls)) != len(urls) or set(urls) != expected:
            raise AssertionError(f"{path}: sitemap URL set mismatch")
        for url in urls:
            assert_clean_url(url, str(path))
    if list(SITE.rglob("robots.txt")):
        raise AssertionError("project-local robots.txt must be omitted")


def public_url_for(path: Path) -> str:
    relative = path.relative_to(SITE).as_posix()
    return ZH_ROOT if relative == "index.html" else ZH_ROOT + relative


def output_target(url: str) -> tuple[Path, str]:
    parsed = urlsplit(url)
    if parsed.netloc and parsed.netloc != "yangtaomijian.github.io":
        raise ValueError("external")
    if not parsed.path.startswith(PREFIX):
        raise AssertionError(f"same-origin URL escapes project subpath: {url}")
    relative = unquote(parsed.path[len(PREFIX):])
    if not relative or relative.endswith("/"):
        relative += "index.html"
    return SITE / relative, unquote(parsed.fragment)


def verify_reference(source: Path, source_url: str, value: str, pages: dict[Path, Page]) -> None:
    if value.startswith(("data:", "mailto:", "tel:", "javascript:")):
        return
    absolute = urljoin(source_url, value)
    parsed = urlsplit(absolute)
    if parsed.scheme not in ("http", "https"):
        raise AssertionError(f"{source}: unsupported local reference {value}")
    if parsed.netloc != "yangtaomijian.github.io":
        return
    assert_clean_url(absolute, str(source))
    target, fragment = output_target(absolute)
    if not target.is_file():
        raise AssertionError(f"{source}: broken internal reference {value} -> {target}")
    if fragment:
        if target.suffix != ".html":
            raise AssertionError(f"{source}: fragment points to non-HTML asset {value}")
        target_page = pages.setdefault(target, parse(target))
        if fragment not in target_page.ids:
            raise AssertionError(f"{source}: missing anchor {value}")


def verify_links_and_assets(pages: dict[Path, Page]) -> None:
    page_paths = sorted(expected_content_pages()) + [SITE / "404.html"]
    for path in page_paths:
        page = pages.setdefault(path, parse(path))
        source_url = public_url_for(path)
        for _, value in page.references:
            verify_reference(path, source_url, value, pages)

    css_url = re.compile(r"url\(\s*(['\"]?)([^)'\"]+)\1\s*\)")
    for path in SITE.rglob("*.css"):
        source_url = public_url_for(path)
        for _, value in css_url.findall(path.read_text(encoding="utf-8", errors="replace")):
            if value.startswith("#"):
                continue
            verify_reference(path, source_url, value, pages)

    for language_root in (SITE, SITE / "en"):
        for name in ("favicon.svg", "favicon-32x32.png", "apple-touch-icon.png"):
            if not (language_root / "assets" / name).is_file():
                raise AssertionError(f"missing favicon asset: {language_root / 'assets' / name}")


def verify_search(pages: dict[Path, Page]) -> None:
    for path, root in ((SITE / "search.json", SITE), (SITE / "en/search.json", SITE / "en")):
        records = json.loads(path.read_text(encoding="utf-8"))
        found_pages: set[str] = set()
        for record in records:
            href = record.get("href", "")
            if not href or href.startswith("/") or urlsplit(href).scheme or urlsplit(href).netloc:
                raise AssertionError(f"{path}: unsafe search href {href!r}")
            assert_clean_url(href, str(path))
            parsed = urlsplit(href)
            logical = unquote(parsed.path)
            target = root / logical
            if not target.is_file():
                raise AssertionError(f"{path}: missing search target {href}")
            found_pages.add(logical)
            if parsed.fragment:
                target_page = pages.setdefault(target, parse(target))
                if unquote(parsed.fragment) not in target_page.ids:
                    raise AssertionError(f"{path}: missing search anchor {href}")
        if found_pages != PAGES:
            raise AssertionError(f"{path}: search page set mismatch: {sorted(found_pages)}")


def verify_404(pages: dict[Path, Page]) -> None:
    path = SITE / "404.html"
    page = pages.setdefault(path, parse(path))
    if rel_links(page, "canonical") or rel_links(page, "alternate"):
        raise AssertionError("404.html must not be canonicalized or indexed as a language pair")
    robots = one_meta(page, "robots", path).casefold()
    if "noindex" not in robots:
        raise AssertionError("404.html must be noindex")
    expected_hrefs = {PREFIX, PREFIX + "en/"}
    actual_hrefs = {value for tag, value in page.references if tag == "a"}
    if actual_hrefs != expected_hrefs:
        raise AssertionError(f"404.html homepage links mismatch: {actual_hrefs}")
    for _, value in page.references:
        if value.startswith("/") and not value.startswith(PREFIX):
            raise AssertionError(f"404.html escapes the project subpath: {value}")


def verify_giscus() -> None:
    common = (
        'script.src = "https://giscus.app/client.js";',
        'script.dataset.repo = "yangtaomijian/demons-within-fvn-guide";',
        'script.dataset.repoId = "R_kgDOUinN_Q";',
        'script.dataset.category = "Guide Feedback";',
        'script.dataset.categoryId = "DIC_kwDOUinN_c4DGBwW";',
        'script.dataset.mapping = "pathname";',
        'script.dataset.reactionsEnabled = "1";',
        'script.dataset.inputPosition = "top";',
        'script.dataset.loading = "lazy";',
        '<input type="hidden" id="giscus-base-theme" value="light">',
        '<input type="hidden" id="giscus-alt-theme" value="dark_dimmed">',
        'script.dataset.theme = getTheme();',
    )
    for root, language in ((SITE, "zh-CN"), (SITE / "en", "en")):
        home = (root / "index.html").read_text(encoding="utf-8")
        if "giscus.app/client.js" in home or '<input type="hidden" id="giscus-base-theme"' in home:
            raise AssertionError(f"{root / 'index.html'}: homepage must not contain Giscus")
        for logical in PAGES - {"index.html"}:
            path = root / logical
            text = path.read_text(encoding="utf-8")
            for marker in (*common, f'script.dataset.lang = "{language}";'):
                if text.count(marker) != 1:
                    raise AssertionError(f"{path}: expected one Giscus marker {marker!r}")


def verify_web_analytics() -> None:
    for path in expected_content_pages():
        text = path.read_text(encoding="utf-8")
        for marker in (CLOUDFLARE_ANALYTICS_SRC, CLOUDFLARE_ANALYTICS_TOKEN):
            if text.count(marker) != 1:
                raise AssertionError(f"{path}: expected one Cloudflare Web Analytics marker {marker!r}")

    for path in (SITE / "404.html", SITE / GOOGLE_VERIFICATION_FILE):
        text = path.read_text(encoding="utf-8")
        for marker in (CLOUDFLARE_ANALYTICS_SRC, CLOUDFLARE_ANALYTICS_TOKEN):
            if marker in text:
                raise AssertionError(f"{path}: unexpected Cloudflare Web Analytics marker {marker!r}")


def verify_public_docs() -> None:
    for path, description in (
        (ROOT / "_quarto.yml", ZH_SITE_DESCRIPTION),
        (ROOT / "site-en/_quarto.yml", EN_SITE_DESCRIPTION),
    ):
        expected = f'  description: "{description}"'
        if path.read_text(encoding="utf-8").count(expected) != 1:
            raise AssertionError(f"{path}: site-level description mismatch")

    parsed = urlsplit(ISSUES_URL)
    if (
        parsed.scheme != "https"
        or parsed.netloc != "github.com"
        or parsed.path != "/yangtaomijian/demons-within-fvn-guide/issues"
        or parsed.query
        or parsed.fragment
    ):
        raise AssertionError("future GitHub Issues URL is malformed")
    for path in (ROOT / "index.md", ROOT / "site-en/index.md", ROOT / "README.md"):
        if ISSUES_URL not in path.read_text(encoding="utf-8"):
            raise AssertionError(f"{path}: future GitHub Issues URL missing")


def main() -> None:
    pages = verify_metadata()
    verify_sitemaps()
    verify_links_and_assets(pages)
    verify_search(pages)
    verify_404(pages)
    verify_giscus()
    verify_web_analytics()
    verify_public_docs()
    print("Indexable HTML pages: 12/12 (6 Chinese + 6 English)")
    print("Canonical, description, language, OG, Twitter: 12/12")
    print("Reciprocal hreflang pairs: 6/6")
    print("Sitemap URLs: 6 Chinese + 6 English; home URLs normalized")
    print("Internal links, anchors, assets, favicons, and search targets: PASS")
    print("Project-local robots.txt omitted; project-safe noindex 404 present: PASS")
    print("Giscus: 10 content pages configured; 2 homepages excluded; bilingual UI and lazy loading: PASS")
    print("Cloudflare Web Analytics: 12/12 content pages; excluded from 404 and verification HTML")
    print("Site descriptions and future GitHub Issues URL: PASS")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, ET.ParseError, OSError, ValueError, json.JSONDecodeError) as error:
        print(f"FAIL: {error}", file=sys.stderr)
        raise SystemExit(1)
