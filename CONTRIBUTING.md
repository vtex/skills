# Contributing to VTEX External Developer Skills

This guide covers everything you need to add skills, tracks, and export platforms to this repository.

## How this repository works

> **Edit source files only.** Files in `exports/`, `skills/`, and `rules/` are auto-generated
> and will be silently overwritten the next time `bun run export` runs.

The workflow is always: **edit `tracks/` → validate → export → commit both.**

| Path                                    | What it is                                              | Editable?         |
| --------------------------------------- | ------------------------------------------------------- | ----------------- |
| `tracks/{track}/skills/{name}/skill.md` | Skill source of truth                                   | ✅ Edit here      |
| `exports/`                              | All platform exports (cursor, copilot, agents-md, etc.) | ❌ Auto-generated |
| `skills/` _(root-level)_                | OpenCode exports                                        | ❌ Auto-generated |
| `rules/`                                | Cursor `.mdc` exports                                   | ❌ Auto-generated |

> **Common trap**: There is a `skills/` directory at the repository root that looks like source
> files. It is not — it is the auto-generated OpenCode export. Source files live under
> `tracks/{track}/skills/`, not at the root.

## Table of Contents

- [Adding a New Skill](#adding-a-new-skill)
- [Skill Template Reference](#skill-template-reference)
- [Adding a New Track](#adding-a-new-track)
- [Adding a New Export Platform](#adding-a-new-export-platform)
- [Quality Checklist](#quality-checklist)
- [Public Documentation Sync](#public-documentation-sync)
- [Naming Conventions](#naming-conventions)

---

## Adding a New Skill

### Step 1: Create the skill directory

Skills live at `tracks/{track}/skills/{skill-name}/skill.md`. Create the directory and file:

```bash
mkdir -p tracks/faststore/skills/faststore-my-new-skill
touch tracks/faststore/skills/faststore-my-new-skill/skill.md
```

> **Not** `skills/{skill-name}/` at the repo root — that directory is the auto-generated OpenCode export and will be overwritten on the next `bun run export`.

### Step 2: Copy the template

Copy `_templates/skill-template.md` into your new file:

```bash
cp _templates/skill-template.md tracks/faststore/skills/faststore-my-new-skill/skill.md
```

### Step 3: Fill in the frontmatter

Open the file and update the YAML frontmatter at the top:

```yaml
---
name: faststore-my-new-skill
description: Apply when deciding, designing, or implementing [capability] in [platform/context]. Covers when [mechanism A] is the right choice, the core contracts and implementation pattern, and the most important constraints to avoid common failures.
metadata:
  track: faststore
  tags:
    - faststore
    - relevant-keyword
    - another-keyword
  version: "1.0"
  purpose: Decide when to use [pattern] and how to implement it safely
  applies_to:
    - task type 1
    - task type 2
  excludes:
    - use case this skill should not cover
  decision_scope:
    - decision-a-vs-b
  vtex_docs_verified: "2026-03-17"
---
```

The `description` field should be activation-oriented and specific. Start with `Apply when ...` so AI trigger matching can detect when the skill is relevant.

### Step 4: Write the required sections

Every new skill should use the decision-oriented template sections in this order:

1. `## When this skill applies`
2. `## Decision rules`
3. `## Hard constraints`
4. `## Preferred pattern`
5. `## Common failure modes`
6. `## Review checklist`
7. `## Related skills` (optional)
8. `## Reference`

See [Skill Template Reference](#skill-template-reference) for what goes in each section.

### Step 5: Annotate all code blocks

Every opening code fence must have a language annotation. The validator will fail on bare fences. The examples below use a 4-backtick outer fence so the inner 3-backtick fence (and its bare closing fence) are rendered literally:

````markdown
```typescript
const x = 1;
```
````

````markdown
```text
src/
  components/
```
````

Closing fences are always bare (just ` ``` `). Only opening fences need the annotation.

### Step 6: Run validation

```bash
bun run validate
```

Fix any reported issues before proceeding. The validator checks 10 things; see the [README](README.md#validation) for the full list.

### Step 7: Run export

```bash
bun run export
```

This regenerates all platform exports. Commit both the skill file and the updated `exports/` directory.

### Step 8: Update the track index

Open `tracks/{track}/index.md` and add your skill to the skills table, grouping, and recommended learning order if the track uses grouped organization.

---

## Skill Template Reference

The canonical template is at `_templates/skill-template.md`. Here's what each section should contain.

### When this skill applies

Describe the cases where the skill should be used and the nearby cases where it should not. This is the skill-selection layer. Keep it short and concrete.

### Decision rules

State the main decision criteria in flat bullets. This section should help an AI or developer decide whether this mechanism, pattern, or platform feature is the right choice before implementation starts.

### Hard constraints

Rules that must be followed to avoid failures, security issues, or platform incompatibilities. This is the most important section.

Each constraint needs:

- A clear rule
- `Why this matters`
- `Detection`
- `Correct` example
- `Wrong` example

Keep platform constraints strong, but do not present example values as universal defaults. If an example uses placeholder identifiers, credentials, policies, `productCode`, or `resourceCode`, say that they must be replaced with the actual values configured for the app.

Use backticks consistently for technical identifiers such as file names, builders, directives, routes, resolver keys, and API clients.

### Preferred pattern

Show the canonical implementation shape in a compact way. Prefer a minimal file layout, minimal configuration pattern, and minimal working example over a long tutorial.

### Common failure modes

List the mistakes that the skill is specifically trying to prevent. Keep this section short and pattern-recognition friendly.

### Review checklist

Turn the constraints into fast yes/no review questions. The checklist should match the constraints and examples exactly.

### Related skills

Use this optional section for short cross-links to nearby skills when it helps the AI or developer choose between mechanisms or understand adjacent responsibilities. Keep it short.

Cross-skill links use a relative path from the current skill's directory:

```markdown
- [`headless-bff-architecture`](../headless-bff-architecture/skill.md) — Use for general BFF and API routing
```

Add `Related skills` when:

- the skill sits near a real decision boundary, such as `graphql` vs `http-routes`
- the user or AI would plausibly pick the wrong adjacent skill without guidance
- another skill is a natural companion needed right after this one

Skip `Related skills` when:

- the links would only restate the obvious track structure
- there is no meaningful ambiguity about when to use the skill
- the section would become a second reference list instead of a decision aid

### Reference

Links to VTEX documentation. Use this format:

```markdown
- [Article Title](https://developers.vtex.com/docs/guides/...) — Why this is relevant
- [Help Center Article](https://help.vtex.com/en/docs/...) — Why this is relevant
```

Only link to `developers.vtex.com` or `help.vtex.com`. Don't link to third-party sites or GitHub issues. If you verified facts against the docs, update `metadata.vtex_docs_verified` in the frontmatter.

---

## Adding a New Track

### Step 1: Create the track directory

Track directory names are kebab-case and short. Existing tracks: `faststore`, `payment`, `vtex-io`, `marketplace`, `headless`.

```bash
mkdir -p tracks/my-new-track/skills
```

### Step 2: Create the track index

```bash
touch tracks/my-new-track/index.md
```

The index file should include:

- H1 title
- One-line description
- Overview paragraph (2-3 sentences)
- Skills table with name, description, and relative link to each skill file
- Recommended Learning Order (numbered list)
- Key Constraints Summary (bullet list of the most critical rules from all skills)
- Related Tracks (cross-references to other tracks)

See any existing `tracks/*/index.md` for a complete example.

### Step 3: Add skills

Follow the [Adding a New Skill](#adding-a-new-skill) steps. Set the `metadata.track` frontmatter field to your new track's directory name.

### Step 4: Update the README

Add the new track to the Tracks section in `README.md` with its skill count and a brief description.

---

## Adding a New Export Platform

### Step 1: Create the exporter

Add a new exporter function in `scripts/export.ts`. The exporter receives a list of `Track` objects (each containing an array of `Skill` objects) and writes files to `exports/{platform}/`.

Follow the pattern of the existing exporters. Each exporter should:

- Accept `tracks: Track[]` as its argument
- Write output files using the `writeOutput(path, content)` helper
- Create one file per skill, or composite files per track, depending on what the platform needs
- Handle the platform's specific format requirements (frontmatter, headers, etc.)

### Step 2: Register the exporter

In `scripts/export.ts`, add your platform to:

1. The `--platform` CLI argument validation list
2. The `exporters` map that routes platform names to exporter functions
3. The `export:my-platform` script in `package.json`

### Step 3: Add the export directory

Create `exports/my-platform/` and add a `.gitkeep` if needed. The export script creates directories automatically, but having the directory in the repo makes the structure visible.

### Step 4: Document the platform

Add a subsection to the Usage section in `README.md` explaining how to use the exported files with the new platform.

---

## Quality Checklist

Before submitting a pull request, verify all of these:

- [ ] `bun run validate` passes with no errors
- [ ] `bun run export` completes with exit code 0
- [ ] All edits are in `tracks/`, not in `exports/`, `skills/`, or `rules/`
- [ ] No `TBD`, `TODO`, or `[placeholder]` text in prose sections
- [ ] All code blocks have language annotations on opening fences
- [ ] The `description` frontmatter field starts with `Apply when ...`
- [ ] The decision-oriented sections are present in the correct order
- [ ] Each hard constraint has `Why this matters`, `Detection`, and paired `Correct`/`Wrong` examples
- [ ] Example values are clearly marked as placeholders or documented examples when they are not universal defaults
- [ ] All VTEX doc links use `developers.vtex.com` or `help.vtex.com`
- [ ] The `metadata.vtex_docs_verified` date reflects when you last checked the docs
- [ ] The track `index.md` includes the new skill in its table and learning order
- [ ] The `exports/` directory is updated (run `bun run export` and commit the output)
- [ ] [Public documentation sync](#public-documentation-sync) considered — either confirmed not needed, or a follow-up is linked in the PR

---

## Public Documentation Sync

This repository is mirrored on the official VTEX developer portal (`developers.vtex.com`) and referenced from the help center (`help.vtex.com`). When user-facing behavior changes here, every public page that references the affected concepts must be updated so external developers see consistent information.

### Example pages that commonly mirror this repository

The list below is **not exhaustive** — treat it as a starting point. Always search `developers.vtex.com` and `help.vtex.com` for any other page that references the affected tracks, skills, install commands, supported platforms, or the repository URL.

- [VTEX Skills guide](https://developers.vtex.com/docs/guides/vtex-skills) — install commands, supported platforms, track and skill counts, behavior overview
- [Release notes — VTEX Developer MCP and Skills](https://developers.vtex.com/updates/release-notes/2026-04-09-vtex-developer-mcp-and-skills) — historical announcement; only correct factual errors here, do not rewrite history

Other places to check before opening the docs follow-up:

- The AI-assisted development overview / index page on `developers.vtex.com`
- Any track-specific guide that links into this catalog (FastStore, Payment, VTEX IO, Marketplace, Headless, Architecture)
- More recent release notes that mention VTEX Skills or the VTEX Developer MCP
- Any internal portals or onboarding material that embed install snippets

The source for the developer portal pages lives in [`vtex/dev-portal-content`](https://github.com/vtex/dev-portal-content). Help center articles are managed by the docs team. Documentation changes are landed via a PR or ticket in the appropriate repository.

> **Tip — use the `vtex-docs` MCP if you have it.** The [`vtex-docs` MCP server](https://developers.vtex.com/docs/guides/vtex-developer-mcp) (and the broader VTEX Developer MCP) indexes both `developers.vtex.com` and `help.vtex.com`. From any MCP-aware AI assistant you can call `search_documentation` with track names, skill names, or install snippet strings to discover every page that references the affected behavior, then `fetch_document` to read the current content and propose precise edits. AI agents working on this repo are instructed to use it automatically — see [`AGENTS.md`](AGENTS.md#use-the-vtex-docs-mcp-for-discovery-and-diffing).

### When a docs update is required

Open a follow-up in `vtex/dev-portal-content` (or flag it in the PR description) when this PR does any of the following:

- **Adds, removes, or renames a track** — update the "Tracks and skills" table and the per-track skill counts.
- **Changes the total number of skills** — update the count in the page intro and the per-track totals.
- **Adds or removes a supported export platform** — update both the "Installation" and "Supported platforms" sections.
- **Changes any install command** — `npx`, `curl`, `git clone`, paths, or release asset names.
- **Renames a release asset or changes the GitHub release layout** — every `curl -sL https://github.com/vtex/skills/releases/...` command on the public page must still work.
- **Renames the repository or moves it under a different org** — every link to `github.com/vtex/skills` must be updated.
- **Changes the AGENTS.md / Cursor / Copilot / Claude / OpenCode / Kiro layout** — update the corresponding "Auto-detection" row and code snippet.
- **Changes the description, purpose, or scope of the skill catalog** — update the "Behavior" section.
- **Changes the relationship with the VTEX Developer MCP** — update the "VTEX Skills vs. VTEX Developer MCP" section.

### When a docs update is **not** required

Most skill-content work does not require a public docs update:

- Edits to the body of an existing `skill.md` (constraints, examples, references).
- Validator, exporter, or CI changes that do not change the install commands or output layout.
- Internal refactors, template changes, or documentation inside this repo (`README.md`, `AGENTS.md`, `CONTRIBUTING.md`).
- Release-please or version bumps.

### How to flag the follow-up

In the PR description, fill out the "Public Documentation Sync" section of the PR template with one of:

1. **Confirmation that no docs change is needed**, or
2. **A description of what needs to change** plus a link to the follow-up issue or PR in `vtex/dev-portal-content`.

If you cannot open the follow-up yourself, file an issue on `vtex/dev-portal-content` describing the change so the docs team can pick it up.

---

## Naming Conventions

### Skill names

Use kebab-case. Prefix with the track name. Examples: `faststore-overrides`, `payment-idempotency`, `vtex-io-graphql`.

The name must be unique across the entire repository. It's used as the skill ID in exports.

### Track directory names

Short, lowercase, kebab-case. Match the `track` frontmatter field exactly. Current names: `faststore`, `payment`, `vtex-io`, `marketplace`, `headless`.

### Skill file structure

Every skill lives at exactly this path:

```text
tracks/{track-name}/skills/{skill-name}/skill.md
```

No other file names or locations are supported. The export and validation scripts discover skills by looking for files matching this pattern.

### Tags

Use lowercase, hyphenated tags. Tags should be technology names, concept names, or API names. Examples: `faststore`, `graphql`, `masterdata`, `pci-compliance`, `rate-limiting`.

Don't use tags that duplicate the track name or skill name. Tags are for cross-cutting concepts that help with discovery.

### Export file names

Export file names are derived from skill names and track names automatically by the export script. Don't create or rename export files manually.

---

## Releases and Versioning

This repository uses [Release Please](https://github.com/googleapis/release-please) for automated versioning. **Do not push version tags or edit version fields manually.**

### How it works

1. Merge a PR to `main` → CI regenerates exports and the Release Please bot opens (or updates) a release PR.
2. The release PR title is `chore(release): vX.Y.Z` and contains a generated changelog.
3. Merge the release PR → Release Please creates the git tag → the release workflow packages tarballs and publishes a GitHub Release.

`package.json`, `.plugin/plugin.json`, `.cursor-plugin/plugin.json`, and the `.claude-plugin/` manifests are bumped together automatically.

### Commit conventions → version bump

| Commit prefix                            | Version bump | When to use                                         |
| ---------------------------------------- | ------------ | --------------------------------------------------- |
| `feat(scope):`                           | **minor**    | New skill, new export platform, new validator check |
| `fix(scope):`                            | patch        | Bug fix, broken reference URL, wrong constraint     |
| `refactor(scope):`                       | patch        | Skill content improvement, template conversion      |
| `chore:`, `docs:`                        | none         | No release opened                                   |
| `feat!:` or `BREAKING CHANGE:` in footer | **major**    | Removed skill, renamed track, changed skill name    |

Use `refactor(track-name):` for skill content work (e.g. `refactor(payment): improve idempotency examples`). This creates a patch bump and shows up in the changelog under "Skill Improvements".

### What not to do

- Do not run `npm version`, `bun version`, or edit `"version"` in any JSON file by hand.
- Do not push `v*` tags manually.
- Do not merge the release PR until you are ready to publish — you can let it accumulate multiple commits first.

---

## For AI Agents

If you are an AI coding agent contributing to this repository, read [`AGENTS.md`](AGENTS.md) first. It contains the quick-reference rules for skill format, validation, export workflow, and release conventions.
