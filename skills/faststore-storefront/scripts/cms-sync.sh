#!/usr/bin/env bash
#
# DEPRECATED — Headless CMS schema publishing
# Prefer running from the project root (global VTEX CLI):
#   vtex content generate-schema -o cms/faststore/schema.json  
#   vtex content upload-schema cms/faststore/schema.json
# Do not use yarn/npm cms-sync or faststore cms-sync for this workflow.
# See references/cms-schema-and-section-registration.md and skill.md.
#

# Generate final schema.json for Headless CMS (canonical flags — matches skill.md)
vtex content generate-schema -o cms/faststore/schema.json  

# Upload final schema.json to Headless CMS (expects interactive prompts or use expect — see reference)
expect -c 'spawn vtex content upload-schema cms/faststore/schema.json; expect "store ID"; send "faststore\r"; expect "uploaded with"; send "y\r"; expect "Are you sure"; send "y\r"; expect eof' 2>&1
