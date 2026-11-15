#!/usr/bin/env python3
"""Normalize generated publication artifacts that Quarto cannot express directly."""

from pathlib import Path
import hashlib


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "_site"
ROOT_URL = "https://demons-within.carambi.com/"
EN_URL = ROOT_URL + "en/"
PAGES = (
    "index.html",
    "discussions.html",
    "updates.html",
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


def fingerprint_home_assets() -> None:
    """Version only homepage resources; leave other page references unchanged."""
    assets = OUTPUT / "assets"
    def write_versioned(name: str, data: bytes) -> str:
        original = Path(name)
        digest = hashlib.sha256(data).hexdigest()[:12]
        versioned = f"{original.stem}.{digest}{original.suffix}"
        (assets / versioned).write_bytes(data)
        return "/assets/" + versioned

    image_urls = {}
    for name in ("memory-environment.webp", "resnick-memory.webp"):
        image_urls[name] = write_versioned(name, (assets / name).read_bytes())

    css = (assets / "dw-home-scene.css").read_text(encoding="utf-8")
    css = css.replace("memory-environment.webp", image_urls["memory-environment.webp"])
    js = (assets / "dw-home-scene.js").read_text(encoding="utf-8")
    js = js.replace("/assets/resnick-memory.webp", image_urls["resnick-memory.webp"])
    css_url = write_versioned("dw-home-scene.css", css.encode("utf-8"))
    js_url = write_versioned("dw-home-scene.js", js.encode("utf-8"))
    for page in (OUTPUT / "index.html", OUTPUT / "en/index.html"):
        html = page.read_text(encoding="utf-8")
        if 'href="assets/dw-home-scene.css"' not in html or 'src="assets/dw-home-scene.js"' not in html:
            raise RuntimeError(f"{page}: homepage scene asset references missing")
        html = html.replace('href="assets/dw-home-scene.css"', f'href="{css_url}"')
        html = html.replace('src="assets/dw-home-scene.js"', f'src="{js_url}"')
        page.write_text(html, encoding="utf-8")
    print("Homepage asset fingerprints: 2 images + CSS/JS; Chinese/English share origin-root assets")


def main() -> None:
    for page in PAGES:
        zh_url = page_url(ROOT_URL, page)
        en_url = page_url(EN_URL, page)
        add_publication_links(OUTPUT / page, zh_url, zh_url, en_url)
        add_publication_links(OUTPUT / "en" / page, en_url, zh_url, en_url)

    fingerprint_home_assets()

    normalize_home(OUTPUT / "sitemap.xml", ROOT_URL)
    normalize_home(OUTPUT / "en/sitemap.xml", EN_URL)

    # Only the origin-root robots.txt is authoritative.
    en_robots = OUTPUT / "en/robots.txt"
    if en_robots.exists():
        en_robots.unlink()

    print(f"Publication metadata finalized: {len(PAGES)} bilingual pairs, normalized sitemaps, origin-root robots.txt retained.")


if __name__ == "__main__":
    main()
