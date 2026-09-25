#!/usr/bin/env python3
"""Normalize generated publication artifacts that Quarto cannot express directly."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "_site"
ROOT_URL = "https://demons-within.carambi.com/"
EN_URL = ROOT_URL + "en/"
PAGES = (
    "index.html",
    "guide/choices.html",
    "guide/faq.html",
    "reference/interventions.html",
    "collectibles/cg.html",
    "collectibles/memorium.html",
)


def page_url(root: str, page: str) -> str:
    return root if page == "index.html" else root + page


def add_publication_links(path: Path, canonical: str, zh_url: str, en_url: str) -> None:
    text = path.read_text(encoding="utf-8")
    for marker in ('property="og:url"', 'hreflang="zh-CN"', 'hreflang="en"'):
        if marker in text:
            raise RuntimeError(f"{path}: unexpected existing publication metadata: {marker}")
    if text.count("</head>") != 1:
        raise RuntimeError(f"{path}: expected exactly one closing head tag")
    metadata = (
        f'<meta property="og:url" content="{canonical}">\n'
        f'<link rel="alternate" hreflang="zh-CN" href="{zh_url}">\n'
        f'<link rel="alternate" hreflang="en" href="{en_url}">\n'
    )
    path.write_text(text.replace("</head>", metadata + "</head>"), encoding="utf-8")


def normalize_home(path: Path, site_root: str) -> None:
    text = path.read_text(encoding="utf-8")
    old = f"<loc>{site_root}index.html</loc>"
    new = f"<loc>{site_root}</loc>"
    if text.count(old) != 1:
        raise RuntimeError(f"{path}: expected exactly one generated homepage URL")
    path.write_text(text.replace(old, new), encoding="utf-8")


def normalize_giscus_loading(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    loading = '    script.dataset.loading = "lazy";\n'
    if text.count(loading) == 1:
        return
    marker = '    script.dataset.inputPosition = "top";\n'
    if text.count('script.src = "https://giscus.app/client.js";') != 1 or text.count(marker) != 1:
        raise RuntimeError(f"{path}: expected exactly one native Quarto Giscus embed")
    path.write_text(text.replace(marker, marker + loading), encoding="utf-8")


def main() -> None:
    for page in PAGES:
        zh_url = page_url(ROOT_URL, page)
        en_url = page_url(EN_URL, page)
        add_publication_links(OUTPUT / page, zh_url, zh_url, en_url)
        add_publication_links(OUTPUT / "en" / page, en_url, zh_url, en_url)
        if page != "index.html":
            normalize_giscus_loading(OUTPUT / page)
            normalize_giscus_loading(OUTPUT / "en" / page)

    normalize_home(OUTPUT / "sitemap.xml", ROOT_URL)
    normalize_home(OUTPUT / "en/sitemap.xml", EN_URL)

    # Only the origin-root robots.txt is authoritative.
    en_robots = OUTPUT / "en/robots.txt"
    if en_robots.exists():
        en_robots.unlink()

    print("Publication metadata finalized: 12 paired pages, 10 lazy Giscus embeds, normalized sitemaps, origin-root robots.txt retained.")


if __name__ == "__main__":
    main()
