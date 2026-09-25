<p align="center">
  <img src="assets/banner.png" alt="VTEX Skills" width="100%">
</p>

<h1 align="center">VTEX Skills</h1>
<p align="center">
  <strong>41 AI agent skills for VTEX platform development — one source, six export formats.</strong>
</p>
<p align="center">
  <a href="#quick-start">Quick Start</a> •
  <a href="#tracks--skills">Tracks</a> •
  <a href="#supported-platforms">Platforms</a> •
  <a href="#contributing">Contributing</a>
</p>
<p align="center">
  <img src="https://img.shields.io/badge/skills-41-F71963" alt="41 skills">
  <img src="https://img.shields.io/badge/tracks-7-blue" alt="7 tracks">
  <img src="https://img.shields.io/badge/platforms-6-green" alt="6 platforms">
  <img src="https://img.shields.io/github/license/vtex/skills" alt="License">
  <img src="https://img.shields.io/github/actions/workflow/status/vtex/skills/generate-exports.yml?label=exports" alt="Build">
</p>

---

## Quick Start

### GitHub CLI (Recommended — requires `gh` v2.90.0+)

If you have the [GitHub CLI](https://cli.github.com/) installed, this is the fastest path. It auto-detects which agents you have configured, supports version pinning, and provides `gh skill update` to stay current.

```bash
# Browse and install skills interactively
gh skill install vtex/skills

# Install a specific skill
gh skill install vtex/skills payment-provider-protocol

# Target a specific agent explicitly
gh skill install vtex/skills payment-provider-protocol --agent claude-code

# Pin to a release for reproducibility
gh skill install vtex/skills payment-provider-protocol --pin v1.9.0

# Keep all installed skills up to date
gh skill update --all
```

Skills are installed to `.agents/skills/` at project scope by default — shared automatically across GitHub Copilot, Cursor, Claude Code, Codex, OpenCode, Windsurf, and [40+ other agents](https://cli.github.com/manual/gh_skill_install). Use `--scope user` to install globally instead.

### npx (No GitHub CLI required)

Works on any machine with Node.js. Handles bulk installs and is CI-friendly:

```bash
npx skills add vtex/skills
```

Use `--list` to preview available skills before installing, `--all --yes` to install everything non-interactively, or `--agent <name>` to target a specific tool.

### Platform-specific installs (fallback)

<details>
<summary>Install directly via curl, manual copy, or file upload — no CLI needed</summary>

#### AGENTS.md (works with Cursor, Copilot, Codex, Windsurf, Amp, Devin, and more)

```bash
curl -sL https://github.com/vtex/skills/releases/latest/download/agents-md.tar.gz | tar xz -C your-project/
```

This places a root `AGENTS.md` with links to per-track files in subdirectories. Most AI coding tools discover and follow these instructions automatically.

#### Cursor

```bash
mkdir -p your-project/.cursor/rules
curl -sL https://github.com/vtex/skills/releases/latest/download/cursor-rules.tar.gz | tar xz -C your-project/.cursor/rules/
```

Each `.mdc` file includes glob patterns that auto-attach the rule when you open matching files. Per-track composites (e.g., `faststore-all.mdc`) are also available.

#### GitHub Copilot

```bash
mkdir -p your-project/.github
curl -sL https://github.com/vtex/skills/releases/latest/download/copilot-instructions.tar.gz | tar xz -C your-project/.github/
```

Per-track files are available in `exports/copilot/` if you only need a subset.

#### Claude Projects

Upload files from [`exports/claude/`](exports/claude/) as project knowledge in your Claude Project settings. Use individual skill files for focused context, or per-track composites (e.g., `faststore.md`) for broader coverage.

#### OpenCode

```bash
curl -sL https://github.com/vtex/skills/releases/latest/download/opencode-skills.tar.gz | tar xz -C ~/.config/opencode/skills/
```

Each skill becomes a directory with a `SKILL.md` file. OpenCode discovers them automatically and makes them available as loadable skills in your sessions.

#### Clone and copy locally

```bash
git clone https://github.com/vtex/skills.git
cd skills

# AGENTS.md
cp -r exports/agents-md/. /path/to/your-project/

# Cursor
mkdir -p /path/to/your-project/.cursor/rules
cp exports/cursor/*.mdc /path/to/your-project/.cursor/rules/

# Copilot
cp exports/copilot/copilot-instructions.md /path/to/your-project/.github/copilot-instructions.md

# OpenCode
cp -r exports/opencode/. ~/.config/opencode/skills/
```

</details>

---

## Why Use This?

- **AI assistants don't know VTEX-specific patterns.** The Overrides API, PPP endpoints, BFF requirements, and MasterData schema limits aren't in any LLM's training data at the depth you need. These skills fill that gap.
- **Real constraints, not generic advice.** PCI compliance via the Secure Proxy, idempotency requirements on payment endpoints, the 2.5s fulfillment simulation timeout, the 60-schema MasterData limit — these are the details that prevent costly mistakes in production.
- **One source, six platforms.** Skills are authored once in a canonical Markdown format and exported automatically. No manual sync, no drift between tools.
- **Built from official VTEX documentation.** Not generic LLM knowledge. Every constraint has a source, a detection pattern, and paired correct/wrong code examples.

---

## Supported Platforms

| Platform | Format | Auto-detection | Layout |
|---|---|---|---|
| **AGENTS.md** | Markdown | ✅ Native in 7+ tools | 1 root file + 1 per track |
| **Cursor** | `.mdc` rules | ✅ Glob + description | 1 per skill + per-track composites |
| **GitHub Copilot** | Instructions | ✅ Auto-loaded | 1 master file + 1 per track |
| **Claude Projects** | Knowledge files | Manual upload | 1 per skill + per-track composites |
| **OpenCode** | `SKILL.md` | ✅ Auto-discovered | 1 directory per skill |
| **Kiro** | `POWER.md` + steering | ✅ Auto-discovered | 1 `POWER.md` + per-skill steering files |

---

## Tracks & Skills

<details>
<summary><strong>Track 1: Well-Architected Commerce & Solution Architecture</strong> — 1 skill for cross-cutting architecture</summary>

Cross-cutting guidance for designing and reviewing VTEX commerce solutions. Encodes the Well-Architected Commerce pillars: Technical Foundation, Future-proof, and Operational Excellence.

| Skill | Description |
|---|---|
| `architecture-well-architected-commerce` | Solution design, architecture reviews, and RFP-level technical structure |

</details>

<details>
<summary><strong>Track 2: FastStore Implementation</strong> — 1 skill for storefront development</summary>

Coding rules and workflow for developing VTEX FastStore storefronts. Covers TypeScript/React conventions, section overrides, BFF extensions, SCSS styling, and CMS sync workflows.

| Skill | Description |
|---|---|
| `faststore-storefront` | Core coding rules, conventions, and development workflow for FastStore storefronts |

</details>

<details>
<summary><strong>Track 3: Payment Connector Development</strong> — 6 skills for PPP integration</summary>

All 9 Payment Provider Protocol endpoints, Payment Provider Framework lifecycle, idempotency patterns, async payment flows, PCI compliance via the Secure Proxy, and POS / VTEX Sales App card-present payments.

| Skill | Description |
|---|---|
| `payment-provider-protocol` | All 9 PPP endpoints: 6 payment flow + 3 configuration flow |
| `payment-provider-framework` | PPF lifecycle, configuration endpoints, retry and notification patterns |
| `payment-idempotency` | `paymentId` and `requestId` idempotency, duplicate prevention |
| `payment-async-flow` | Async approval, callback URLs, and the 7-day retry window |
| `payment-pci-security` | Secure Proxy, card tokenization, and PCI constraint enforcement |
| `payment-ppp-pos` | PPP applied to POS on VTEX Sales App: Venda Direta methods, Payment Apps, and terminal callbacks |

</details>

<details>
<summary><strong>Track 4: Custom VTEX IO Apps</strong> — 24 skills for IO app development</summary>

Comprehensive coverage of VTEX IO app development organized into five groups: Foundations, API Exposure, Frontend, Data & Config, and Security & Operations.

| Group | Skills |
|---|---|
| **Foundations** | `vtex-io-app-contract`, `vtex-io-service-runtime`, `vtex-io-client-integration`, `vtex-io-service-apps`¹ |
| **API Exposure** | `vtex-io-graphql-api`, `vtex-io-http-routes`, `vtex-io-events-and-workers` |
| **Frontend** | `vtex-io-storefront-react`, `vtex-io-admin-react`, `vtex-io-render-runtime-and-blocks`, `vtex-io-messages-and-i18n`, `vtex-io-react-apps`¹ |
| **Data & Config** | `vtex-io-app-settings`, `vtex-io-service-configuration-apps`, `vtex-io-masterdata-strategy`, `vtex-io-data-access-patterns`, `vtex-io-masterdata`¹, `vtex-io-service-paths-and-cdn`, `vtex-io-application-performance`, `vtex-io-session-apps` |
| **Security & Ops** | `vtex-io-auth-tokens-and-context`, `vtex-io-auth-and-policies`, `vtex-io-security-boundaries`, `vtex-io-observability-and-ops` |

¹ Original broader skills retained alongside the newer focused splits.

See [tracks/vtex-io/index.md](tracks/vtex-io/index.md) for the full skill table and learning order.

</details>

<details>
<summary><strong>Track 5: Marketplace Integration</strong> — 4 skills for marketplace connectors</summary>

SKU catalog sync, order hooks, fulfillment simulation, and rate limiting for marketplace connectors. Covers the Change Notification flow, Feed v3 vs Hook tradeoffs, and invoice/tracking patterns.

| Skill | Description |
|---|---|
| `marketplace-catalog-sync` | Change Notification entry point, SKU suggestion lifecycle |
| `marketplace-order-hook` | Feed v3 (pull) vs Hook (push), filter types, commit patterns |
| `marketplace-fulfillment` | External Seller protocol, simulation, orders, invoice and tracking |
| `marketplace-rate-limiting` | 429 handling, exponential backoff, circuit breaker patterns |

</details>

<details>
<summary><strong>Track 6: Headless Front-End Development</strong> — 4 skills for headless storefronts</summary>

BFF architecture, Intelligent Search API, checkout proxy patterns, and caching strategy for headless VTEX storefronts. Covers why a BFF is mandatory and which APIs can never be called from the browser.

| Skill | Description |
|---|---|
| `headless-bff-architecture` | BFF layer design, auth proxy, and API key protection |
| `headless-intelligent-search` | Search, facets, autocomplete, and Search Events API |
| `headless-checkout-proxy` | Checkout API proxying, session cookies, and the 5-minute order window |
| `headless-caching-strategy` | TTL rules, stale-while-revalidate, and what must never be cached |

</details>

<details>
<summary><strong>Track 7: Sales App Extension Development</strong> — 1 skill for Sales App extensions</summary>

Complete 6-step workflow for building VTEX Sales App extensions. Covers extension points (cart, PDP, menu), React hooks (useCart, usePDP, useCartItem, useCurrentUser, useExtension), TypeScript types, secure API integration patterns, code generation, validation, and deployment.

| Skill | Description |
|---|---|
| `sales-app-extensibility` | Full lifecycle of Sales App extension development — prerequisites, discovery, code generation, validation, and deployment |

</details>

---

## Open Plugins / Cursor Directory

This repository is an [Open Plugin](https://open-plugins.com) — a portable, platform-agnostic skill pack that any AI coding tool can discover and install.

```
rules/*.mdc              # Cursor rules (auto-discovered)
skills/*/SKILL.md        # Agent skills (auto-discovered)
.cursor-plugin/plugin.json   # Cursor plugin manifest
.plugin/plugin.json          # Vendor-neutral plugin manifest
```

Compatible tools (Cursor, Claude Code, and others implementing the Open Plugins spec) can install this repo directly as a plugin. The `rules/` and `skills/` directories at the repo root follow the standard layout, and the manifests provide metadata for discovery.

---

## For Contributors

<details>
<summary>Directory structure, export commands, and validation</summary>

### Directory Structure

```text
vtex_skills/
  _templates/
    skill-template.md       # Canonical template for new skills
  tracks/                   # SOURCE — edit skill files here
    architecture/
      index.md
      skills/
        architecture-well-architected-commerce/skill.md
    faststore/
      index.md
      skills/
        faststore-storefront/skill.md
    headless/
      index.md
      skills/
        headless-bff-architecture/skill.md
        headless-intelligent-search/skill.md
        headless-checkout-proxy/skill.md
        headless-caching-strategy/skill.md
    marketplace/
      index.md
      skills/
        marketplace-catalog-sync/skill.md
        marketplace-order-hook/skill.md
        marketplace-fulfillment/skill.md
        marketplace-rate-limiting/skill.md
    payment/
      index.md
      skills/
        payment-provider-protocol/skill.md
        ...
    sales-app/
      index.md
      skills/
        sales-app-extensibility/skill.md
    vtex-io/
      index.md
      skills/
        vtex-io-app-contract/skill.md
        vtex-io-service-runtime/skill.md
        vtex-io-client-integration/skill.md
        ... (24 skills — see tracks/vtex-io/index.md)
  exports/                  # auto-generated — do not edit
    agents-md/              # AGENTS.md format
    claude/                 # Claude Projects format
    copilot/                # GitHub Copilot format
    cursor/                 # Cursor .mdc format
    kiro/                   # Kiro Power + steering format
    opencode/               # OpenCode SKILL.md format
  skills/                   # auto-generated — do not edit (OpenCode export)
  rules/                    # auto-generated — do not edit (Cursor export)
  scripts/
    export.ts               # Generates all platform exports
    validate.ts             # Validates all skill files
  package.json
  tsconfig.json
```

### Export Commands

Generate platform exports from the source skill files:

```bash
# Export to all platforms
bun run export

# Export to a specific platform
bun run export:cursor
bun run export:copilot
bun run export:claude
bun run export:agents-md
bun run export:opencode
bun run export:kiro
```

Exports are written to `exports/{platform}/` and overwrite existing files. Run export after any skill changes before committing.

### Validation

Check all skill files for quality and correctness before exporting:

```bash
bun run validate
```

The validator runs 13 checks on every skill file, split into **hard** (must pass — block CI) and **soft** (produce warnings only):

**Hard checks** (9):
- **yaml-validity** — frontmatter parses without errors, has required fields (name, description, track, tags)
- **description-quality** — description is at least 20 words
- **code-block-annotations** — all opening code fences have a language annotation
- **no-placeholders** — no `TBD`, `TODO`, or `FIXME` text in prose
- **size-bounds** — skill files are within acceptable size limits
- **track-consistency** — the `track` frontmatter field matches the directory
- **globs-format** — if present, the `globs` field is a valid array of glob pattern strings
- **filename-casing** — the file is named `skill.md` (lowercase)
- **companion-links** — all relative links in the skill file resolve to existing files

**Soft checks** (4) — produce warnings but do not block CI:
- **required-sections** — recommended H2 sections present (decision-oriented template)
- **detection-patterns** — constraints include a Detection field
- **paired-examples** — constraints have both a Correct and Wrong example
- **url-format** — VTEX doc links use the correct domain format

</details>

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for a complete guide on adding skills, tracks, and export platforms.

---

## License

See [LICENSE](LICENSE) for details.
