# AGENTS.md — AI Contributor Guide

This file provides instructions for AI coding agents working on this repository.

## Quick rules

1. **Source files only**: Edit skill files in `tracks/{track}/skills/{name}/skill.md`. Never edit `exports/`, `skills/`, or `rules/` — they are auto-generated and will be silently overwritten the next time `bun run export` runs.
2. **Validate before committing**: Run `bun run validate`. All hard checks must pass; soft checks produce warnings but do not block CI.
3. **Regenerate exports**: Run `bun run export` after any skill change. Commit both source and generated files.
4. **Flag public docs sync**: After completing the change, evaluate whether public VTEX docs (developer portal + help center) need to be updated and tell the user. See [Public documentation sync](#public-documentation-sync) below.

## Skill template

The decision-oriented template at `_templates/skill-template.md` is the recommended structure for new skills.

Recommended H2 sections (in order):

1. `## When this skill applies`
2. `## Decision rules`
3. `## Hard constraints`
4. `## Preferred pattern`
5. `## Common failure modes`
6. `## Review checklist`
7. `## Reference`

`## Related skills` is optional — add it only when it helps choose between nearby skills.

Skills that use a different structure (e.g., rules-based or tutorial-style) will pass validation with warnings instead of errors. The template sections are enforced as soft checks.

## Frontmatter format

```yaml
name: skill-name-kebab-case
description: Apply when [trigger condition]. Covers [key areas]. Use for [specific task].
metadata:
  track: faststore # one of: faststore, payment, vtex-io, marketplace, headless
  tags: [keyword1, keyword2]
  globs: ["src/path/**/*.ts"]
  version: "1.0"
  vtex_docs_verified: "YYYY-MM-DD"
  # Optional:
  purpose: One-line goal summary
  applies_to: [task type 1, task type 2]
  excludes: [excluded use case]
  decision_scope: [decision-a-vs-b]
```

## Hard constraint format

Each constraint in `## Hard constraints` must include:

- A clear rule statement
- `**Why this matters**` — failure mode or security consequence
- `**Detection**` — what to look for and when to stop
- `**Correct**` — working code example
- `**Wrong**` — broken code example

## Description format

Must start with `Apply when ...` for AI activation matching.

## Reference URLs

Only link to `developers.vtex.com` or `help.vtex.com`. Verify URLs resolve before committing.

## Validation checks

`bun run validate` runs 13 checks on every skill file. Checks are split into **hard** (must pass — block CI) and **soft** (produce warnings only):

**Hard checks** (9): yaml-validity, description-quality, code-block-annotations, no-placeholders, size-bounds, track-consistency, globs-format, filename-casing, companion-links.

**Soft checks** (4): required-sections, detection-patterns, paired-examples, url-format.

## Releases and versioning

Releases are automated via [Release Please](https://github.com/googleapis/release-please). **Do not push version tags manually.**

- Merging to `main` triggers a bot-managed **release PR** that bumps the version based on conventional commits.
- Merging that release PR creates the tag and GitHub Release automatically.
- `package.json`, `.plugin/plugin.json`, `.cursor-plugin/plugin.json`, and the `.claude-plugin/` manifests are all bumped together — never edit their `version` fields by hand.

**Commit prefix → version bump:**

| Prefix                                   | Bump  | Example                        |
| ---------------------------------------- | ----- | ------------------------------ |
| `feat:` / `feat(scope):`                 | minor | new skill, new export platform |
| `fix:` / `fix(scope):`                   | patch | bug fix, broken URL            |
| `refactor:` / `refactor(scope):`         | patch | skill content improvement      |
| `chore:`, `docs:`                        | none  | no release PR opened           |
| `feat!:` or `BREAKING CHANGE:` in footer | major | removed skill, renamed track   |

Use `refactor(track):` for skill content changes so they appear in the changelog under "Skill Improvements" without triggering a minor bump.

## Public documentation sync

This repository is mirrored across the official VTEX developer portal (`developers.vtex.com`) and referenced from the help center (`help.vtex.com`). The pages below are **examples**, not an exhaustive list — there are likely other pages that reference VTEX Skills, the VTEX Developer MCP, or specific tracks/skills, and you should treat all of them as in scope.

Known examples:

- [VTEX Skills guide](https://developers.vtex.com/docs/guides/vtex-skills) — install commands, supported platforms, track and skill counts, behavior overview.
- [Release notes — VTEX Developer MCP and Skills](https://developers.vtex.com/updates/release-notes/2026-04-09-vtex-developer-mcp-and-skills) — historical announcement; only correct factual errors here.

When evaluating a change, also consider: the AI-assisted development overview/index, track-specific guides that link into this catalog, more recent release notes, and any onboarding material that embeds install snippets. If you are uncertain whether other pages exist, say so explicitly and recommend the user search `developers.vtex.com` and `help.vtex.com` for the affected terms.

The source for the developer portal pages lives in [`vtex/dev-portal-content`](https://github.com/vtex/dev-portal-content). Help center articles are owned by the docs team. Whenever you finish a change in this repo, evaluate whether the public docs need a follow-up and surface it to the user.

### Use the `vtex-docs` MCP for discovery and diffing

If the `vtex-docs` MCP server is available in your environment (server identifier `user-vtex-docs`, tools: `search_documentation`, `fetch_document`, `search_endpoints`, `get_endpoint_details`), prefer it over guessing. It indexes both `developers.vtex.com` and `help.vtex.com` and is the most reliable way to find pages that may need updates.

Recommended workflow when a change in this repo could affect public docs:

1. **Discover** with `search_documentation` (locale `en` by default; also check `pt` and `es` for translated pages). Run multiple targeted queries, for example:
   - The track or skill name that changed (e.g. `"VTEX IO MasterData skill"`, `"FastStore overrides"`).
   - User-facing strings that appear in install snippets (e.g. `"npx skills add"`, `"vtex/skills"`, `"agents-md.tar.gz"`).
   - Concept names from the catalog (e.g. `"VTEX Skills"`, `"VTEX Developer MCP"`, `"AI-assisted development"`).
2. **Fetch** each promising URL with `fetch_document` and read the relevant sections. Confirm whether the page genuinely references the changed behavior, or just mentions an unrelated topic.
3. **Diff in your head**: compare the page content against the change in this PR. Identify the exact paragraphs, table rows, code blocks, or counts that are now stale.
4. **Report** the findings to the user as part of the "Public docs sync" note: list each affected URL, what is stale on it, and a concrete proposed edit (e.g. "the 'Tracks and skills' table on `developers.vtex.com/docs/guides/vtex-skills` lists `Custom VTEX IO Apps — 24 skills`; this PR brings the count to 25").
5. **Recommend the follow-up venue**: developer portal pages → PR in [`vtex/dev-portal-content`](https://github.com/vtex/dev-portal-content); help center articles → ticket with the docs team.

If the MCP is **not** available, say so explicitly in your "Public docs sync" note, fall back to the known examples listed above, and ask the user to verify on `developers.vtex.com` and `help.vtex.com`. Do not invent URLs — only cite pages you have actually retrieved or that are linked from this repository.

### Trigger checklist

Suggest a public docs update when the change does any of the following:

- Adds, removes, or renames a track.
- Changes the total number of skills, or the per-track skill count.
- Adds, removes, or renames a supported export platform (AGENTS.md, Cursor, Copilot, Claude, OpenCode, Kiro, …).
- Changes any install command, release asset name, repository URL, or directory layout that appears in install snippets.
- Changes the description, scope, or behavior of the skill catalog itself.
- Changes the relationship with the VTEX Developer MCP.

Do **not** suggest a docs update for purely internal changes: edits to skill bodies (constraints, examples, references), validator/exporter/CI tweaks, refactors, or in-repo docs (`README.md`, `AGENTS.md`, `CONTRIBUTING.md`, `_templates/`).

### What to tell the user

At the end of the task, include a short "Public docs sync" note with one of:

- **No public docs change needed** — state why (e.g. "skill body edit only, no install command or counts changed").
- **Public docs update required** — list every page you can identify that needs to change (the known examples above plus any others you spotted), and suggest opening a follow-up in [`vtex/dev-portal-content`](https://github.com/vtex/dev-portal-content) or with the docs team for help-center articles. When relevant, draft the exact wording or table cell that needs updating. If you suspect there are additional pages you cannot enumerate, call that out and ask the user to verify.

Also remind the user that the PR template's **Public Documentation Sync** section needs to be filled out before merging. The full criteria are in [`CONTRIBUTING.md`](CONTRIBUTING.md#public-documentation-sync).
