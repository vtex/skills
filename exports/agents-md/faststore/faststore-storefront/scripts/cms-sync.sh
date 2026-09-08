#!/usr/bin/env bash
#
# CMS schema sync (FastStore v4 / Content Platform)
#
# Recommended: the consolidated FastStore CLI command, run from the project root.
# It auto-detects cms/faststore/components (and cms/faststore/pages), generates
# cms/faststore/schema.json, and uploads it (interactive prompts).
# See references/cms-schema-and-section-registration.md and skill.md.
#
# Prerequisite: an up-to-date @vtex/cli-plugin-content (cms-sync calls
# `vtex content` under the hood). Old versions (e.g. 1.0.4) fail with
# "Failed to fetch the base schema from the registry. Not Found".
#   vtex plugins install @vtex/cli-plugin-content
#
set -euo pipefail

# Primary path: run cms-sync (install the CLI first if the binary is missing).
#   npm install -g @faststore/cli   # if the "faststore" binary is not available
faststore cms-sync "$@"

# --- Manual fallback (run individually if `faststore cms-sync` is unavailable) ---
#
# 1) Generate the schema:
#   vtex content generate-schema -o cms/faststore/schema.json
#
# 2) Upload it. When prompted for the store ID, enter contentSource.project
#    from discovery.config.js (the published id is {account}.{project}),
#    NOT the hardcoded "faststore". To automate the prompts:
#   export STORE_ID=$(node -e "const c=require('./discovery.config.js'); console.log((c.contentSource&&c.contentSource.project)||'faststore')")
#   expect -c '
#     spawn vtex content upload-schema cms/faststore/schema.json
#     expect "store ID"; send "$env(STORE_ID)\r"
#     expect -re "uploaded|confirm"; send "y\r"
#     expect -re "Are you sure|confirm"; send "y\r"
#     expect eof
#   ' 2>&1
