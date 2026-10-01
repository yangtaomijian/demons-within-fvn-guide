#!/usr/bin/env python3
"""Give the custom TOC independent ownership before browser initialization."""
from pathlib import Path
import sys

PANEL_ID = "dw-page-toc-panel"


def normalize(text):
    # Quarto's right-margin manager collapses and clones its native panel when
    # an aside or wide column is visible. Our responsive TOC lives on the left
    # on desktop and in a custom drawer on mobile; retain #TOC for scrollspy,
    # but do not expose its container to the native collision manager.
    # Also update Quarto's generated inline theme-transition selectors.
    return text.replace("quarto-margin-sidebar", PANEL_ID)


def main():
    output = Path(sys.argv[1]) if len(sys.argv) == 2 else Path(__file__).resolve().parents[1] / "_site"
    panels = 0
    for page in output.rglob("*.html"):
        if "site_libs" in page.relative_to(output).parts:
            continue
        text = page.read_text(encoding="utf-8")
        updated = normalize(text)
        count = updated.count(f'id="{PANEL_ID}"')
        if count > 1 or ('id="TOC"' in updated and count != 1):
            raise ValueError(f"{page}: expected one custom TOC panel, found {count}")
        if updated != text:
            page.write_text(updated, encoding="utf-8")
        panels += count
    if not panels:
        raise ValueError(f"{output}: no TOC panels found")
    print(f"Custom TOC ownership: {panels} panels; native #TOC and fragment IDs retained")


if __name__ == "__main__":
    main()
