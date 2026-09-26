#!/usr/bin/env python3
"""Source consistency checks for DW reference components."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
CATEGORIES = ("characters", "events", "environments", "factions")


def section(source: str, panel_id: str) -> str:
    match = re.search(rf"\{{\.dw-tab-panel #{re.escape(panel_id)}\}}(.*?)(?=\n:::|\Z)", source, re.S)
    assert match, f"Missing panel {panel_id}"
    return match.group(1)


for base in (ROOT, ROOT / "site-en"):
    memory = (base / "collectibles/memorium.md").read_text()
    choices = (base / "guide/choices.qmd").read_text()
    cg = (base / "collectibles/cg.md").read_text()
    language = "English" if base.name == "site-en" else "Chinese"

    assert ("3 columns × 4 rows" if language == "English" else "3 列 × 4 行") in memory
    all_slots: list[str] = []
    all_records: list[str] = []
    for category in CATEGORIES:
        locator = section(memory, f"memory-panel-{category}")
        conditions = section(memory, f"condition-panel-{category}")
        grids = re.findall(r'<div class="dw-slot-grid">(.*?)</div>', locator, re.S)
        assert grids, f"{language} {category}: no slot page"
        slots = []
        for page, grid in enumerate(grids, 1):
            count = len(re.findall(r'<(?:a|span)\b', grid))
            assert 1 <= count <= 12, f"{language} {category} page {page}: capacity {count}"
            slots.extend(re.findall(r'href="#(mem-[^"]+)"', grid))
        records = re.findall(r'\{#(mem-[^}]+)\}', conditions)
        assert len(slots) == len(set(slots)), f"{language} {category}: repeated slot"
        assert len(records) == len(set(records)), f"{language} {category}: repeated record"
        assert set(slots) == set(records), f"{language} {category}: slot/record mismatch"
        all_slots.extend(slots)
        all_records.extend(records)
    assert len(all_slots) == len(set(all_slots)) == len(all_records) == len(set(all_records))

    graph = choices.split("```{mermaid}", 1)[1].split("```", 1)[0]
    headings = set(re.findall(r"^## .+?\{#([^}]+)\}", choices, re.M))
    map_targets = re.findall(r'^\s*click\s+\w+\s+href\s+"#([^"]+)"', graph, re.M)
    assert map_targets and set(map_targets) <= headings, f"{language}: missing Story Map targets"
    for edge in ("days --> bear", "days --> tiger", "bear --> merge", "tiger --> merge"):
        assert edge in graph, f"{language}: changed branch topology {edge}"

    cg_targets = re.findall(r'^\| \[[^]]+\]\(#([^)]+)\)', cg, re.M)
    cg_headings = set(re.findall(r"^## .+?\{#([^}]+)\}", cg, re.M))
    assert cg_targets and len(cg_targets) == len(set(cg_targets))
    assert set(cg_targets) <= cg_headings, f"{language}: missing CG targets"

    sprite_ids = re.findall(r'\{#(sprite-(?!viewer\b)[^}]+)\}', memory)
    assert sprite_ids and len(sprite_ids) == len(set(sprite_ids)), f"{language}: duplicate Sprite IDs"
    print(f"{language}: {len(all_slots)} Memory slots, {len(map_targets)} map links, "
          f"{len(cg_targets)} CG records, {len(sprite_ids)} Viewer records verified.")
