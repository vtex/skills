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

---

This skill provides guidance for AI agents working with VTEX known-issues. Apply these constraints and patterns when assisting developers with apply when generating a software design document (sdd) specification for a vtex known issue ticket. covers loading the ki details by zendesk ticket id, detecting whether the current repository has sdd infrastructure in place, generating a structured specification with problem statement, root cause, proposed solution, implementation plan, testing strategy, and rollout plan, and optionally opening a github pull request with the resulting document.

# KI Specify — SDD Generator for Known Issues

## When this skill applies

Use this skill when the user wants to convert a Known Issue ticket into a specification document (SDD)
that can be reviewed, approved, and tracked as a PR before implementation begins.

- User runs `/ki-specify <ticket_id>` → load the KI, detect the repo, generate and save the SDD
- If the GitHub MCP connector is available → also create a branch and open a draft PR
- If the repo has no SDD infrastructure → scaffold `docs/specs/` automatically

Do not use this skill for:
- Looking up KIs without intent to produce a spec (use `ki-check` instead)
- Implementing the fix described in the KI
- Creating or updating the Zendesk ticket itself

## Decision rules

- Require a numeric ticket ID argument. If missing, ask: "Which KI ticket should I create a spec for? Run `/ki-specify <ticket_id>`."
- Load ticket details from `ki-index.json`. If not found → report and link to the Zendesk URL directly.
- Check for SDD readiness before writing: look for `docs/specs/`, `.vtex/sdd.yaml`, or a PR template mentioning "spec".
- If no SDD infrastructure exists → scaffold `docs/specs/` and a `docs/README.md` without asking.
- Write the SDD to `docs/specs/ki-<ticket_id>.md`.
- If the GitHub MCP connector is connected → create branch `ki/<ticket_id>-spec` and open a draft PR.
- If GitHub MCP is not connected → save locally and instruct the user to push manually.

## Hard constraints

### Constraint: Load ticket details from ki-index.json, not from ki-product-map.json

`ki-product-map.json` contains only the minimal fields needed for listing (id, subject, complexity, status).
The SDD requires the full description excerpt and capability tags, which are only in `ki-index.json`.

**Why this matters**

Using only the product map produces a spec with an empty problem statement, which is unusable for
engineering review.

**Detection**

If you see the SDD problem statement section filled only with the ticket subject and no description →
the skill loaded from the wrong file. Load `ki-index.json` for SDD generation.

**Correct**

```python
import json

def load_ki(ticket_id: int) -> dict | None:
    # ki-index.json has the full desc and capability_tags fields
    with open("tracks/known-issues/data/ki-index.json") as f:
        ki_index = json.load(f)
    return next((k for k in ki_index if k["id"] == ticket_id), None)

ki = load_ki(759842)
# ki["desc"]             → 400-char description excerpt
# ki["capability_tags"]  → ["commerce_capabilities_checkout_api_tax_service"]
# ki["complexity"]       → "high"
# ki["has_workaround"]   → False
```

**Wrong**

```python
import json

# WRONG: product map has no desc or capability_tags
with open("tracks/known-issues/data/ki-product-map.json") as f:
    pm = json.load(f)

# All area ticket entries only have: id, subject, complexity, fix_effort, status, has_workaround, url
# "desc" and "capability_tags" are missing — problem statement will be empty
```

---

### Constraint: Mark all engineer-required sections explicitly in the SDD

The generated SDD must clearly mark sections that require engineer input with a `⚠️` prefix and an
HTML comment prompt. Sections left blank without markers will be approved as-is and create silent gaps
in the implementation.

**Why this matters**

A spec that looks complete but has empty root cause or solution sections will be merged without the
critical engineering decisions that the SDD is meant to capture.

**Detection**

If you see SDD sections like "Root Cause Analysis" or "Proposed Solution" with no content and no
`⚠️` marker → warn and add the marker with a prompt comment.

**Correct**

```markdown
## 2. Root Cause Analysis

> ⚠️ This section must be completed by the engineer assigned to the fix.

**Hypothesis:**
<!-- What do we believe is causing this behavior? -->

**Affected Components:**
- commerce_capabilities_checkout_api_tax_service
```

**Wrong**

```markdown
## 2. Root Cause Analysis

(to be filled)
```

---

### Constraint: Branch name must follow the ki/<id>-spec pattern

When creating a GitHub branch for the SDD PR, the branch name must be `ki/<ticket_id>-spec`.
Free-form branch names make it impossible to correlate the branch to the KI ticket programmatically.

**Why this matters**

The branch naming convention allows automated tooling (e.g., the KI update pipeline) to detect which
branches contain SDD drafts and avoid overwriting them during index regeneration.

**Detection**

If you see a branch name that does not match `ki/[0-9]+-spec` → warn and use the correct pattern.

**Correct**

```text
branch: ki/759842-spec
commit: docs: add SDD spec for KI #759842 — Checkout pipeline doesn't update taxes
```

**Wrong**

```text
branch: fix/checkout-taxes
branch: sdd-759842
branch: wender/ki-spec
```

## Preferred pattern

### SDD document structure

```markdown
# [KI-{id}] {subject}

> **Zendesk:** {url}
> **Status:** {status} | **Complexity:** {complexity} | **Fix Effort:** {fix_effort}
> **Workaround Available:** {has_workaround}
> **Product Areas:** {product_areas}

---

## 1. Problem Statement

{desc}

## 2. Root Cause Analysis

> ⚠️ Must be completed by the assigned engineer.

**Hypothesis:**
<!-- What do we believe is causing this behavior? -->

**Affected Components:**
{capability_tags}

## 3. Proposed Solution

> ⚠️ Must be reviewed and approved before implementation begins.

**Approach:**
<!-- High-level description of the fix -->

**Breaking Changes:**
- [ ] None expected
- [ ] API contract changes
- [ ] Data migration required

## 4. Implementation Plan

| Step | Description | Owner | ETA |
|---|---|---|---|
| 1 | Reproduce in staging | | |
| 2 | Implement fix | | |
| 3 | Unit + integration tests | | |
| 4 | QA validation | | |
| 5 | Deploy to production | | |

## 5. Testing Strategy

- [ ] Unit tests covering the affected capability
- [ ] Regression: existing behavior not broken
- [ ] Manual QA: reproduce original bug → confirm resolved

## 6. Rollout Plan

- [ ] Direct deploy (low risk)
- [ ] Feature flag (moderate/high risk) — flag name: `ki-{id}-fix`
- [ ] Gradual rollout (very high complexity)

## 7. Communication

**Customer-facing?** {is_public}
**Zendesk ticket to close:** `{id}` — `{url}`

---
*SDD generated by `/ki-specify` on {date}. Complete sections marked ⚠️ before requesting review.*
```

### SDD readiness detection

```bash
# Check for existing SDD infrastructure
ls docs/specs/ 2>/dev/null \
  || ls .vtex/sdd.yaml 2>/dev/null \
  || grep -l "spec\|SDD" .github/PULL_REQUEST_TEMPLATE*.md 2>/dev/null \
  || echo "not-ready"
```

If not ready, scaffold:

```bash
mkdir -p docs/specs
cat > docs/README.md << 'EOF'
# docs/

This directory contains Software Design Documents (SDDs) for Known Issues and feature work.

## SDDs

SDDs live in `docs/specs/` and follow the naming convention `ki-<ticket_id>.md`.
EOF
```

## Common failure modes

- **Using ki-product-map.json for SDD generation.** It lacks `desc` and `capability_tags`. Always load `ki-index.json` for `/ki-specify`.
- **Leaving engineer-required sections blank without markers.** Always use the `⚠️` prefix and HTML comment prompts so reviewers know what needs to be filled.
- **Wrong branch naming.** Use `ki/<id>-spec` exactly. Free-form names break the update pipeline correlation.
- **Not scaffolding docs/specs/ when missing.** Always create the directory structure if it does not exist — do not ask permission, just scaffold and continue.
- **Claiming the spec is complete.** The generated SDD is always a draft. Always state that sections 2 and 3 require engineer input before the PR can be approved.

## Review checklist

- [ ] Was the ticket ID resolved from `ki-index.json` (not `ki-product-map.json`)?
- [ ] Does the SDD include all 7 sections?
- [ ] Are sections 2 (Root Cause) and 3 (Proposed Solution) marked with `⚠️` and prompt comments?
- [ ] Is the output file saved to `docs/specs/ki-<ticket_id>.md`?
- [ ] If GitHub MCP is connected, is the branch named `ki/<ticket_id>-spec`?
- [ ] Is the PR marked as draft?

## Related skills

- [`ki-check`](../ki-check/skill.md) — Look up open KIs for a repo or product area before deciding which one to spec

## Reference

- [VTEX Known Issues Help Center](https://help.vtex.com/known-issues) — Public list of open Known Issues
