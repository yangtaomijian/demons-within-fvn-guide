"""Prepare the ignored Quarto output for the staging-only Static Assets Worker."""
from pathlib import Path

site = Path(__file__).resolve().parents[1] / "_site"
if not (site / "index.html").is_file() or not (site / "en/index.html").is_file():
    raise SystemExit("Build the bilingual site before preparing staging assets")
(site / "_headers").write_text("/*\n  X-Robots-Tag: noindex, nofollow\n", encoding="utf-8")
(site / "_redirects").write_text(
    "/ /index.html 302\n/en/ /en/index.html 302\n/en /en/index.html 302\n", encoding="utf-8"
)
(site / ".assetsignore").write_text("**/.DS_Store\nsite-en/**\n", encoding="utf-8")
