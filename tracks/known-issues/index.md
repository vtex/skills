# Known Issues Track

Skills for discovering, triaging, and specifying fixes for open VTEX Known Issues (KIs) — tickets tagged `ki` in Zendesk.

## Overview

This track provides two skills that work together: `ki-check` to surface which Known Issues affect a given
repository or product area, and `ki-specify` to convert a specific KI into a Software Design Document (SDD)
ready for engineering review.

Both skills use pre-processed index files stored in `tracks/known-issues/data/` for fast, token-efficient
lookups without hitting the Zendesk API at query time.

## Skills

| Skill | Description |
|---|---|
| [`ki-check`](skills/ki-check/skill.md) | Look up open KIs for the current repo, a product area, or a specific ticket ID |
| [`ki-specify`](skills/ki-specify/skill.md) | Generate a full SDD spec for a KI ticket and optionally open a GitHub PR |

## Recommended Learning Order

1. `ki-check` — understand what KIs exist for your area before writing any spec
2. `ki-specify` — generate and submit the SDD for a specific KI

## Data Files

| File | Size | Description |
|---|---|---|
| `data/ki-index.json` | ~1.4 MB | All KI tickets with description excerpts and capability tags |
| `data/ki-product-map.json` | ~480 KB | Inverted index: product area → tickets, repo name → areas |

Data files are regenerated from the Zendesk export using `scripts/preprocess-ki.py`.
Run `python3 scripts/preprocess-ki.py <export.json> --output-dir tracks/known-issues/data/`
to update them when a new export is available.

## Key Constraints Summary

- Load `ki-product-map.json` for area lookups — never the raw Zendesk export (19 MB)
- Load `ki-index.json` only when full ticket descriptions are needed (SDD generation)
- Resolve repo names through `repo_to_areas` before querying `product_areas`
- Deduplicate tickets by ID when merging results from multiple areas
- Sort results by severity: very_high → high → moderate → low → unknown

## Related Tracks

- All tracks — KIs may affect any product area; use `ki-check` before starting work in any track
