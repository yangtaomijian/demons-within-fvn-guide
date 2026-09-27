"""Prepare the ignored Quarto output for the staging-only Static Assets Worker."""
from pathlib import Path

site = Path(__file__).resolve().parents[1] / "_site"
if not (site / "index.html").is_file() or not (site / "en/index.html").is_file():
    raise SystemExit("Build the bilingual site before preparing staging assets")
# This step turns a production-default build into a staging-only asset bundle.
production = (
    '<meta name="dw-discussion-environment" content="production">',
    '<meta name="dw-discussion-api" content="https://discussion.carambi.com">',
    '<meta name="dw-discussion-turnstile-sitekey" content="0x4AAAAAAFE9bmYvoR54zpRe">',
)
staging = (
    '<meta name="dw-discussion-environment" content="staging">',
    '<meta name="dw-discussion-api" content="https://discussion-staging.carambi.com">',
    '<meta name="dw-discussion-turnstile-sitekey" content="0x4AAAAAAFEW58ENHynCclX5">',
)
pages = ("index.html", "guide/choices.html", "guide/faq.html",
         "reference/interventions.html", "collectibles/cg.html", "collectibles/memorium.html")
for prefix in (site, site / "en"):
    for page in pages:
        path = prefix / page
        text = path.read_text(encoding="utf-8")
        if all(text.count(marker) == 1 for marker in production):
            for old, new in zip(production, staging):
                text = text.replace(old, new)
            path.write_text(text, encoding="utf-8")
        elif not all(text.count(marker) == 1 for marker in staging):
            raise SystemExit(f"Unexpected Discussion config in {path}")

(site / "_headers").write_text("/*\n  X-Robots-Tag: noindex, nofollow\n", encoding="utf-8")
(site / "_redirects").write_text(
    "/ /index.html 302\n/en/ /en/index.html 302\n/en /en/index.html 302\n", encoding="utf-8"
)
(site / ".assetsignore").write_text("**/.DS_Store\nsite-en/**\n", encoding="utf-8")
