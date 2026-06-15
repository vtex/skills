This skill provides guidance for AI agents working with VTEX known-issues. Apply these constraints and patterns when assisting developers with apply when checking whether the current repository or a given product area has open known issues (kis) registered in zendesk with tag:ki. covers auto-detecting the app from git context or manifest.json, looking up a specific ticket by id, and listing all open kis for a product area ranked by fix complexity. use before starting implementation work, during support triage, or when a customer reports a bug that may already be a tracked ki.

# KI Check — Known Issue Lookup

## When this skill applies

Use this skill when the user wants to know whether a repository or product area has open Known Issues before
starting work, triaging a bug, or assessing the scope of a fix.

- User runs `/ki-check` with no arguments → detect the current repo and list its KIs
- User runs `/ki-check <ticket_id>` (numeric) → look up one specific KI by Zendesk ticket ID
- User runs `/ki-check <area_or_repo>` (text) → list all KIs for that product area or repository

Do not use this skill for:
- Creating or updating Zendesk tickets
- Querying live Zendesk data (this skill uses pre-built local indexes)
- Searching non-KI tickets

## Decision rules

- If the argument is numeric → use **Mode B** (ticket ID lookup).
- If the argument matches a known repo name in `repo_to_areas` → use **Mode A** (repo → area → tickets).
- If the argument matches a product area name in `product_areas` → use **Mode C** (direct area lookup).
- If no argument is given → attempt repo auto-detection from `manifest.json` or `git remote`, then fall back to Mode C with the inferred area.
- If auto-detection fails → ask the user to specify a repo name or area explicitly.
- Always load `ki-product-map.json` first (480 KB). Load `ki-index.json` (1.4 MB) only when the user asks for the full description of a specific ticket.
- Never load the raw Zendesk export (`tikets-KI.json`, 19 MB).

## Hard constraints

### Constraint: Always load ki-product-map.json, never the raw export

The pre-processed index files must be used for all lookups. The raw Zendesk export is 19 MB and contains
irrelevant fields. Loading it wastes tokens and defeats the purpose of the index.

**Why this matters**

Loading 19 MB of JSON in a skill context consumes the entire context window and produces no additional
accuracy over the 480 KB index.

**Detection**

If you see code that opens `tikets-KI.json` or any file larger than 2 MB → stop and load the index instead.

**Correct**

```python
import json

# Load only the compact product map
with open("tracks/known-issues/data/ki-product-map.json") as f:
    pm = json.load(f)

area_data = pm["product_areas"].get("checkout_ui", {})
tickets = area_data.get("tickets", [])
```

**Wrong**

```python
import json

# WRONG: loads the full 19 MB raw Zendesk export
with open("tikets-KI.json") as f:
    all_tickets = json.load(f)  # 1817 tickets, 19 MB, all fields
```

---

### Constraint: Resolve repo name to product area before querying tickets

All ticket lookups must go through the area mapping. Never filter tickets by repo name directly — the
index is keyed by product area, not by repo.

**Why this matters**

The index `product_areas` map is keyed by product area (e.g. `checkout_ui`), not by repo name. Attempting
to look up by repo name directly will always return empty results.

**Detection**

If you see code that tries `pm["product_areas"].get("checkout-ui-custom")` or similar repo name → stop
and resolve through `repo_to_areas` first.

**Correct**

```python
import json

with open("tracks/known-issues/data/ki-product-map.json") as f:
    pm = json.load(f)

repo = "checkout-ui-custom"

# Step 1: resolve repo → areas
areas = pm["repo_to_areas"].get(repo, [])

# Step 2: fetch tickets for each area
results = []
seen = set()
for area in areas:
    for ticket in pm["product_areas"].get(area, {}).get("tickets", []):
        if ticket["id"] not in seen:
            seen.add(ticket["id"])
            results.append(ticket)
```

**Wrong**

```python
import json

with open("tracks/known-issues/data/ki-product-map.json") as f:
    pm = json.load(f)

# WRONG: repo name is not a key in product_areas
tickets = pm["product_areas"].get("checkout-ui-custom", {}).get("tickets", [])
# Returns [] — checkout-ui-custom is in repo_to_areas, not product_areas
```

---

### Constraint: Sort results by complexity before presenting

Tickets must be sorted by fix complexity (very_high → high → moderate → low → unknown) so the most
critical issues appear first.

**Why this matters**

Without sorting, the user sees tickets in arbitrary order and must scan the entire list to find critical issues.
The index already stores tickets pre-sorted per area, but when merging multiple areas deduplication breaks the order.

**Detection**

If you see results presented in arbitrary dict-insertion order after a multi-area merge → warn and apply the
severity sort before rendering.

**Correct**

```python
SEVERITY = {"very_high": 0, "high": 1, "moderate": 2, "low": 3, "unknown": 4}

results.sort(key=lambda t: SEVERITY.get(t.get("complexity", "unknown"), 4))
```

**Wrong**

```python
# WRONG: no sorting — order depends on dict iteration and area merge order
for area in areas:
    results.extend(pm["product_areas"][area]["tickets"])
# User sees tickets in arbitrary order, critical issues buried at the bottom
```

## Preferred pattern

### Repo auto-detection

```bash
# VTEX IO app: read vendor + name from manifest.json
cat manifest.json 2>/dev/null

# Standard git repo: extract name from remote URL
git remote get-url origin 2>/dev/null
# https://github.com/vtex/checkout-ui-custom → "checkout-ui-custom"
# https://github.com/vtex-apps/search-result → "search-result"
```

### Mode A — repo lookup

```python
import json, re, subprocess

def detect_repo() -> str | None:
    # Try manifest.json (VTEX IO)
    try:
        with open("manifest.json") as f:
            m = json.load(f)
            return m.get("name", "")
    except FileNotFoundError:
        pass
    # Try git remote
    try:
        url = subprocess.check_output(
            ["git", "remote", "get-url", "origin"], text=True
        ).strip()
        return re.sub(r"\.git$", "", url.rstrip("/").split("/")[-1])
    except Exception:
        return None

def lookup_repo(pm: dict, repo: str) -> list[dict]:
    areas = pm["repo_to_areas"].get(repo, [])
    if not areas:
        # Partial match fallback
        areas = list({
            a for k, v in pm["repo_to_areas"].items()
            if repo in k or k in repo
            for a in v
        })
    results, seen = [], set()
    for area in areas:
        for t in pm["product_areas"].get(area, {}).get("tickets", []):
            if t["id"] not in seen:
                seen.add(t["id"])
                results.append(t)
    SEVERITY = {"very_high": 0, "high": 1, "moderate": 2, "low": 3, "unknown": 4}
    results.sort(key=lambda t: SEVERITY.get(t.get("complexity", "unknown"), 4))
    return results
```

### Mode B — ticket ID lookup

```python
import json

def lookup_ticket(ticket_id: int) -> dict | None:
    with open("tracks/known-issues/data/ki-index.json") as f:
        ki_index = json.load(f)
    return next((k for k in ki_index if k["id"] == ticket_id), None)
```

### Output format

```text
## Known Issues for `checkout-ui-custom`
Areas: checkout_ui, checkout | Total: 12 KIs

🔴 Critical: 1  🟠 Hard: 4  🟡 Moderate: 5  🟢 Easy: 2

### 🔴 Critical
| ID | Issue | Status | Workaround |
|---|---|---|---|
| [627261](https://vtexhelp.zendesk.com/agent/tickets/627261) | Partial scheduled delivery window selection... | backlog | ❌ |

### 🟠 Hard
...
```

Complexity tiers: `very_high` → 🔴 Critical, `high` → 🟠 Hard, `moderate` → 🟡 Moderate, `low` → 🟢 Easy, `unknown` → ⚪ Unclassified.

## Common failure modes

- **Loading the raw export.** The file `tikets-KI.json` is 19 MB. Always use `ki-product-map.json` (480 KB) for area lookups and `ki-index.json` (1.4 MB) only for full descriptions.
- **Looking up repo name directly in `product_areas`.** Repo names are in `repo_to_areas`, not `product_areas`. Always resolve the repo to areas first.
- **Forgetting to deduplicate after multi-area merge.** A ticket can belong to multiple areas. Track seen IDs with a set.
- **Presenting results without a severity sort.** After merging areas, always re-sort by the SEVERITY map before rendering.
- **No fallback when auto-detection fails.** If neither `manifest.json` nor `git remote` returns a usable name, ask the user to specify explicitly rather than silently returning empty results.

## Review checklist

- [ ] Is `ki-product-map.json` loaded (not the 19 MB raw export)?
- [ ] Is the repo name resolved through `repo_to_areas` before querying `product_areas`?
- [ ] Are results deduplicated by ticket ID after merging multiple areas?
- [ ] Are results sorted by severity (very_high → high → moderate → low → unknown)?
- [ ] Does the output include ticket ID, subject, status, and workaround availability?
- [ ] Is `ki-index.json` loaded only when the user requests a full ticket description?

## Related skills

- [`ki-specify`](../ki-specify/skill.md) — Generate a full SDD specification document for a specific KI ticket

## Reference

- [VTEX Known Issues Help Center](https://help.vtex.com/known-issues) — Public list of open Known Issues
