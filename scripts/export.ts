import {
  cpSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "fs";
import { spawnSync } from "child_process";
import matter from "gray-matter";
import { join, dirname } from "path";

export interface SkillFrontmatter {
  name: string;
  description: string;
  track: string;
  tags: string[];
  globs?: string[];
  version?: string;
  vtex_docs_verified?: string;
  metadata?: {
    track?: string;
    tags?: string[];
    globs?: string[];
    version?: string;
    purpose?: string;
    applies_to?: string[];
    excludes?: string[];
    decision_scope?: string[];
    vtex_docs_verified?: string;
  };
}

export interface Skill {
  frontmatter: SkillFrontmatter;
  content: string;
  filePath: string;
}

interface Track {
  name: string;
  skills: Skill[];
}

interface PlatformExporter {
  name: string;
  outputDir: string;
  export(skills: Skill[], tracks: Track[]): Promise<void>;
}

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

function cleanDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}

function writeOutput(filePath: string, content: string): void {
  ensureDir(dirname(filePath));
  writeFileSync(filePath, content, "utf-8");
  console.log(`  ✓ ${filePath}`);
}

function skillSlug(skill: Skill): string {
  return skill.frontmatter.name;
}

function copyCompanionDirs(skill: Skill, destDir: string): void {
  const sourceDir = dirname(skill.filePath);
  const entries = readdirSync(sourceDir);

  for (const entry of entries) {
    // Skip the skill file itself
    if (entry === "skill.md" || entry === "SKILL.md") continue;

    const sourcePath = join(sourceDir, entry);
    if (statSync(sourcePath).isDirectory()) {
      const destPath = join(destDir, entry);
      cpSync(sourcePath, destPath, { recursive: true });
      console.log(`  ✓ ${destPath}/ (companion dir)`);
    }
  }
}

function normalizeDescription(desc: string): string {
  return desc.replace(/\s+/g, " ").trim();
}

// ─── Companion File Helpers ─────────────────────────────────────────────────

interface CompanionFile {
  /** Relative path from skill dir, e.g. "references/project-structure.md" */
  relativePath: string;
  /** Just the filename, e.g. "project-structure.md" */
  fileName: string;
  /** The subdirectory name, e.g. "references" or "scripts" */
  dirName: string;
  /** Full content of the file */
  content: string;
  /** Whether it's a markdown file */
  isMarkdown: boolean;
}

function getCompanionFiles(skill: Skill): CompanionFile[] {
  const sourceDir = dirname(skill.filePath);
  const companions: CompanionFile[] = [];

  let entries: string[];
  try { entries = readdirSync(sourceDir); } catch { return []; }

  for (const entry of entries) {
    if (entry.toLowerCase() === "skill.md") continue;
    const entryPath = join(sourceDir, entry);
    try {
      if (!statSync(entryPath).isDirectory()) continue;
    } catch { continue; }

    const files = readdirSync(entryPath).sort();
    for (const file of files) {
      const filePath = join(entryPath, file);
      try {
        if (!statSync(filePath).isFile()) continue;
      } catch { continue; }

      companions.push({
        relativePath: join(entry, file).replace(/\\/g, "/"),
        fileName: file,
        dirName: entry,
        content: readFileSync(filePath, "utf-8"),
        isMarkdown: file.endsWith(".md"),
      });
    }
  }
  return companions;
}

function rewriteCompanionLinks(
  content: string,
  linkMap: Record<string, string>
): string {
  return content.replace(
    /\[([^\]]*)\]\(([^)]+)\)/g,
    (match, text, href) => {
      const newHref = linkMap[href];
      if (newHref) return `[${text}](${newHref})`;
      return match;
    }
  );
}

function companionSlug(skill: Skill, companion: CompanionFile): string {
  const track = resolveField<string>(skill.frontmatter, 'track') ?? skill.frontmatter.track;
  const base = companion.fileName.replace(/\.(md|sh|ts|js)$/, '');
  return `${track}-${skillSlug(skill)}-ref-${base}`;
}

/**
 * Build a rewritten copy of a skill with companion links replaced.
 * Does NOT mutate the original skill object.
 */
function skillWithRewrittenLinks(skill: Skill, linkMap: Record<string, string>): Skill {
  if (Object.keys(linkMap).length === 0) return skill;
  return { ...skill, content: rewriteCompanionLinks(skill.content, linkMap) };
}

/**
 * Build a rewritten copy of a track with companion links replaced in all skills.
 */
function trackWithRewrittenSkills(track: Track, rewrittenSkillMap: Map<string, Skill>): Track {
  if (rewrittenSkillMap.size === 0) return track;
  return {
    ...track,
    skills: track.skills.map(s => rewrittenSkillMap.get(s.filePath) ?? s),
  };
}

function resolveField<T>(fm: SkillFrontmatter, field: string): T | undefined {
  const flat = (fm as any)[field];
  if (flat !== undefined && flat !== null) return flat as T;
  if (fm.metadata) return (fm.metadata as any)[field] as T | undefined;
  return undefined;
}

function discoverSkills(): Skill[] {
  const skills: Skill[] = [];
  const tracksDir = "tracks";

  try {
    const tracks = readdirSync(tracksDir);
    for (const track of tracks) {
      const skillsDir = join(tracksDir, track, "skills");
      try {
        if (!statSync(skillsDir).isDirectory()) continue;
      } catch {
        continue;
      }

      const skillDirs = readdirSync(skillsDir);
      for (const skillDir of skillDirs) {
        const skillFile = join(skillsDir, skillDir, "skill.md");
        try {
          const content = readFileSync(skillFile, "utf-8");
          const { data, content: markdownContent } = matter(content);

          skills.push({
            frontmatter: data as SkillFrontmatter,
            content: markdownContent,
            filePath: skillFile,
          });
        } catch {
          // Skip if skill.md doesn't exist or can't be parsed
        }
      }
    }
  } catch {
    // tracks directory doesn't exist yet
  }

  return skills;
}

function organizeByTrack(skills: Skill[]): Track[] {
  const trackMap = new Map<string, Skill[]>();

  for (const skill of skills) {
    const trackName = resolveField<string>(skill.frontmatter, 'track') ?? skill.frontmatter.track;
    if (!trackMap.has(trackName)) {
      trackMap.set(trackName, []);
    }
    trackMap.get(trackName)!.push(skill);
  }

  return Array.from(trackMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, skills]) => ({
      name,
      skills: skills.sort((a, b) =>
        skillSlug(a).localeCompare(skillSlug(b))
      ),
    }));
}

// ─── Cursor Rules (.mdc) Exporter ───────────────────────────────────────────

function buildCursorMdc(skill: Skill): string {
  const desc = normalizeDescription(skill.frontmatter.description);
  const globs = resolveField<string[]>(skill.frontmatter, 'globs');
  const globsLine =
    globs && globs.length > 0 ? globs.map((g) => `"${g}"`).join(",") : "";
  return `---
description: "${desc}"
globs: ${globsLine}
alwaysApply: false
---

${skill.content.trim()}
`;
}

function buildCursorTrackMdc(track: Track): string {
  const descriptions = track.skills
    .map((s) => normalizeDescription(s.frontmatter.description))
    .join(" ");
  const trackDesc = `Composite skill for the ${track.name} track. ${descriptions}`;

  // Collect all unique globs from skills in this track
  const allGlobs = new Set<string>();
  for (const skill of track.skills) {
    const skillGlobs = resolveField<string[]>(skill.frontmatter, 'globs');
    if (skillGlobs) {
      for (const g of skillGlobs) {
        allGlobs.add(g);
      }
    }
  }
  const globsLine =
    allGlobs.size > 0
      ? Array.from(allGlobs)
          .map((g) => `"${g}"`)
          .join(",")
      : "";

  const body = track.skills
    .map((s) => s.content.trim())
    .join("\n\n---\n\n");

  return `---
description: "${trackDesc}"
globs: ${globsLine}
alwaysApply: false
---

${body}
`;
}

// ─── GitHub Copilot Exporter ────────────────────────────────────────────────

function buildCopilotTrackMd(track: Track): string {
  const sections = track.skills.map((skill) => {
    return skill.content.trim();
  });

  return `# ${formatTrackTitle(track.name)}

${sections.join("\n\n---\n\n")}
`;
}

function buildCopilotInstructions(tracks: Track[]): string {
  const sections = tracks.map((track) => {
    const skillContent = track.skills
      .map((s) => s.content.trim())
      .join("\n\n---\n\n");

    return `# ${formatTrackTitle(track.name)}

${skillContent}`;
  });

  return `# VTEX Development Skills

These instructions provide guidance for AI-assisted VTEX platform development.

${sections.join("\n\n---\n\n")}
`;
}

// ─── Claude Projects Exporter ───────────────────────────────────────────────

function buildClaudeSkillMd(skill: Skill): string {
  const desc = normalizeDescription(skill.frontmatter.description);
   const trackTitle = formatTrackTitle(resolveField<string>(skill.frontmatter, 'track') ?? skill.frontmatter.track);

  return `This skill provides guidance for AI agents working with VTEX ${trackTitle}. Apply these constraints and patterns when assisting developers with ${desc.toLowerCase().endsWith(".") ? desc.toLowerCase() : desc.toLowerCase() + "."}

${skill.content.trim()}
`;
}

function buildClaudeTrackMd(track: Track): string {
  const trackTitle = formatTrackTitle(track.name);

  const sections = track.skills.map((skill) => {
    const desc = normalizeDescription(skill.frontmatter.description);
    return `This skill provides guidance for AI agents working with VTEX ${trackTitle}. Apply these constraints and patterns when assisting developers with ${desc.toLowerCase().endsWith(".") ? desc.toLowerCase() : desc.toLowerCase() + "."}

${skill.content.trim()}`;
  });

  return `${sections.join("\n\n---\n\n")}
`;
}

// ─── AGENTS.md Exporter ─────────────────────────────────────────────────────

function buildAgentsMdTrack(track: Track): string {
  const trackTitle = formatTrackTitle(track.name);

  const skillSections = track.skills.map((skill) => {
    const desc = normalizeDescription(skill.frontmatter.description);
    return `## ${skill.frontmatter.name}

> ${desc}

${skill.content.trim()}`;
  });

  return `# AGENTS.md — ${trackTitle}

These instructions guide AI agents working on VTEX ${trackTitle} tasks.
Follow these patterns and constraints when assisting developers.

${skillSections.join("\n\n---\n\n")}
`;
}

function buildAgentsMdRoot(tracks: Track[]): string {
  const trackList = tracks
    .map((track) => {
      const trackTitle = formatTrackTitle(track.name);
      const skillList = track.skills
        .map(
          (s) =>
            `  - **${s.frontmatter.name}**: ${normalizeDescription(s.frontmatter.description)}`
        )
        .join("\n");
      return `## ${trackTitle}

See [\`${track.name}/AGENTS.md\`](./${track.name}/AGENTS.md) for detailed instructions.

${skillList}`;
    })
    .join("\n\n");

  return `# AGENTS.md — VTEX Development Skills

This repository contains AI agent skills for VTEX platform development.
Each track directory contains an AGENTS.md with detailed instructions.

${trackList}
`;
}

// ─── OpenCode SKILL.md Exporter ─────────────────────────────────────────────

function buildOpenCodeSkillMd(skill: Skill): string {
  const desc = normalizeDescription(skill.frontmatter.description);
  const content = skill.content.trim().replace(/\/skill\.md\)/g, "/SKILL.md)");

  return `---
name: ${skill.frontmatter.name}
description: "${desc}"
---

${content}
`;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTrackTitle(trackName: string): string {
  const titles: Record<string, string> = {
    architecture: "Well-Architected Commerce & Solution Architecture",
    faststore: "FastStore Implementation & Customization",
    payment: "Payment Connector Development",
    "vtex-io": "Custom VTEX IO Apps",
    marketplace: "Marketplace Integration",
    headless: "Headless Front-End Development",
    masterdata: "Master Data Storage & Schema Design",
  };
  return titles[trackName] || trackName;
}

export function rewriteSkillLinks(content: string, currentSkill: Skill, allSkills: Skill[]): string {
  const linkRegex = /\[([^\]]+)\]\(([^)]*\/skill\.md)\)/g;

  return content.replace(linkRegex, (match, text, href) => {
    // Extract skill name from the path: the directory just before /skill.md
    const parts = href.split("/");
    const skillDirIndex = parts.length - 2; // directory before "skill.md"
    if (skillDirIndex < 0) return match;

    const referencedSkillName = parts[skillDirIndex];

    // Find the referenced skill in allSkills
    const referencedSkill = allSkills.find(
      (s) => s.frontmatter.name === referencedSkillName
    );

    if (!referencedSkill) return match;

    const track = resolveField<string>(referencedSkill.frontmatter, "track") ?? referencedSkill.frontmatter.track;
    const newHref = `${track}-${referencedSkillName}.md`;
    return `[${text}](${newHref})`;
  });
}


// ─── Kiro Power Exporter ────────────────────────────────────────────────────

export function buildKiroSkillSteering(skill: Skill, skills: Skill[]): string {
  const parts: string[] = [];

  const globs = resolveField<string[]>(skill.frontmatter, "globs");
  if (globs && globs.length > 0) {
    parts.push(`<!-- globs: ${globs.join(", ")} -->`);
  }

  const desc = skill.frontmatter.description;
  if (desc) {
    parts.push(normalizeDescription(desc));
  }

  const rewritten = rewriteSkillLinks(skill.content.trim(), skill, skills);
  parts.push(rewritten);

  return parts.join("\n\n") + "\n";
}

export function buildKiroPowerMd(skills: Skill[], tracks: Track[]): string {
  const lines: string[] = [];

  // Kiro Power frontmatter
  lines.push("---");
  lines.push('name: "vtex-platform"');
  lines.push('displayName: "VTEX Platform"');
  lines.push('description: "Complete guide for building on the VTEX ecommerce platform. Covers FastStore storefronts, headless architecture (BFF, checkout, search, caching), VTEX IO app development, marketplace integrations, and payment provider protocol."');
  lines.push('keywords: ["vtex", "faststore", "ecommerce", "storefront", "headless-cms", "headless", "checkout", "payment", "marketplace", "vtex-io", "graphql", "bff", "intelligent-search", "pci", "cart", "session", "catalog", "order", "fulfillment", "masterdata"]');
  lines.push('author: "Community"');
  lines.push("---");
  lines.push("");

  lines.push("# VTEX Skills — Kiro Power");
  lines.push("");
  lines.push(
    "Kiro Power com skills de desenvolvimento VTEX. Os arquivos de steering"
  );
  lines.push(
    "em `steering/` fornecem orientação contextual baseada nos globs dos skills."
  );
  lines.push("");
  lines.push("## Tracks");

  for (const track of tracks) {
    lines.push("");
    lines.push(`### ${formatTrackTitle(track.name)}`);
    lines.push("");
    for (const skill of track.skills) {
      const slug = skillSlug(skill);
      const desc = skill.frontmatter.description;
      if (desc) {
        lines.push(`- **${slug}**: ${normalizeDescription(desc)}`);
      } else {
        lines.push(`- **${slug}**`);
      }
    }
  }

  lines.push("");
  return lines.join("\n");
}

export function buildKiroTrackSteering(track: Track, skills: Skill[]): string {
  const parts: string[] = [];

  parts.push(`# ${formatTrackTitle(track.name)}`);

  for (let i = 0; i < track.skills.length; i++) {
    const skill = track.skills[i];
    const rewritten = rewriteSkillLinks(skill.content.trim(), skill, skills);
    parts.push(rewritten);

    if (i < track.skills.length - 1) {
      parts.push("---");
    }
  }

  return parts.join("\n\n") + "\n";
}


// ─── Platform Exporters ─────────────────────────────────────────────────────

const exporters: Record<string, PlatformExporter> = {
  cursor: {
    name: "Cursor",
    outputDir: "exports/cursor",
    async export(skills: Skill[], tracks: Track[]): Promise<void> {
      const outDir = this.outputDir;
      ensureDir(outDir);

      const rewrittenSkillMap = new Map<string, Skill>();

      for (const skill of skills) {
        const companions = getCompanionFiles(skill);
        const linkMap: Record<string, string> = {};

        for (const comp of companions) {
          if (!comp.isMarkdown) continue;
          const slug = companionSlug(skill, comp);
          linkMap[comp.relativePath] = `@${slug}.mdc`;

          const { data: compFm, content: compContent } = matter(comp.content);
          const desc = normalizeDescription(
            (compFm as any).description || comp.fileName
          );
          writeOutput(
            join(outDir, `${slug}.mdc`),
            `---\ndescription: "${desc}"\nglobs: \nalwaysApply: false\n---\n\n${compContent.trim()}\n`
          );
        }

        const rewritten = skillWithRewrittenLinks(skill, linkMap);
        rewrittenSkillMap.set(skill.filePath, rewritten);
        const track = resolveField<string>(skill.frontmatter, 'track') ?? skill.frontmatter.track;
        const fileName = `${track}-${skillSlug(skill)}.mdc`;
        writeOutput(join(outDir, fileName), buildCursorMdc(rewritten));
      }

      for (const track of tracks) {
        const rewrittenTrack = trackWithRewrittenSkills(track, rewrittenSkillMap);
        const fileName = `${track.name}-all.mdc`;
        writeOutput(join(outDir, fileName), buildCursorTrackMdc(rewrittenTrack));
      }
    },
  },
  copilot: {
    name: "GitHub Copilot",
    outputDir: "exports/copilot",
    async export(skills: Skill[], tracks: Track[]): Promise<void> {
      const outDir = this.outputDir;
      ensureDir(outDir);

      const rewrittenSkillMap = new Map<string, Skill>();

      for (const skill of skills) {
        const companions = getCompanionFiles(skill);
        const linkMap: Record<string, string> = {};

        for (const comp of companions) {
          if (!comp.isMarkdown) continue;
          const slug = companionSlug(skill, comp);
          linkMap[comp.relativePath] = `${slug}.md`;

          const { content: compContent } = matter(comp.content);
          writeOutput(
            join(outDir, `${slug}.md`),
            compContent.trim() + "\n"
          );
        }

        rewrittenSkillMap.set(skill.filePath, skillWithRewrittenLinks(skill, linkMap));
      }

      for (const track of tracks) {
        const rewrittenTrack = trackWithRewrittenSkills(track, rewrittenSkillMap);
        const fileName = `${track.name}.md`;
        writeOutput(join(outDir, fileName), buildCopilotTrackMd(rewrittenTrack));
      }

      const rewrittenTracks = tracks.map(t => trackWithRewrittenSkills(t, rewrittenSkillMap));
      writeOutput(
        join(outDir, "copilot-instructions.md"),
        buildCopilotInstructions(rewrittenTracks)
      );
    },
  },
  claude: {
    name: "Claude",
    outputDir: "exports/claude",
    async export(skills: Skill[], tracks: Track[]): Promise<void> {
      const outDir = this.outputDir;
      ensureDir(outDir);

      const rewrittenSkillMap = new Map<string, Skill>();

      for (const skill of skills) {
        const companions = getCompanionFiles(skill);
        const linkMap: Record<string, string> = {};

        for (const comp of companions) {
          if (!comp.isMarkdown) continue;
          const slug = companionSlug(skill, comp);
          linkMap[comp.relativePath] = `${slug}.md`;

          const { content: compContent } = matter(comp.content);
          writeOutput(
            join(outDir, `${slug}.md`),
            compContent.trim() + "\n"
          );
        }

        const rewritten = skillWithRewrittenLinks(skill, linkMap);
        rewrittenSkillMap.set(skill.filePath, rewritten);
        const fileName = `${resolveField<string>(skill.frontmatter, 'track') ?? skill.frontmatter.track}-${skillSlug(skill)}.md`;
        writeOutput(join(outDir, fileName), buildClaudeSkillMd(rewritten));
      }

      for (const track of tracks) {
        const rewrittenTrack = trackWithRewrittenSkills(track, rewrittenSkillMap);
        const fileName = `${track.name}.md`;
        writeOutput(join(outDir, fileName), buildClaudeTrackMd(rewrittenTrack));
      }
    },
  },
  "agents-md": {
    name: "AGENTS.md",
    outputDir: "exports/agents-md",
    async export(skills: Skill[], tracks: Track[]): Promise<void> {
      const outDir = this.outputDir;
      ensureDir(outDir);

      const rewrittenSkillMap = new Map<string, Skill>();

      for (const skill of skills) {
        const companions = getCompanionFiles(skill);
        const linkMap: Record<string, string> = {};
        const track = resolveField<string>(skill.frontmatter, 'track') ?? skill.frontmatter.track;
        const slug = skillSlug(skill);

        for (const comp of companions) {
          linkMap[comp.relativePath] = `${slug}/${comp.relativePath}`;
        }

        if (companions.length > 0) {
          const skillDestDir = join(outDir, track, slug);
          copyCompanionDirs(skill, skillDestDir);
        }

        rewrittenSkillMap.set(skill.filePath, skillWithRewrittenLinks(skill, linkMap));
      }

      for (const track of tracks) {
        const rewrittenTrack = trackWithRewrittenSkills(track, rewrittenSkillMap);
        writeOutput(
          join(outDir, track.name, "AGENTS.md"),
          buildAgentsMdTrack(rewrittenTrack)
        );
      }

      writeOutput(join(outDir, "AGENTS.md"), buildAgentsMdRoot(tracks));
    },
  },
  opencode: {
    name: "OpenCode",
    outputDir: "exports/opencode",
    async export(skills: Skill[], tracks: Track[]): Promise<void> {
      const outDir = this.outputDir;
      ensureDir(outDir);

      for (const skill of skills) {
        const skillDir = join(outDir, skillSlug(skill));
        writeOutput(
          join(skillDir, "SKILL.md"),
          buildOpenCodeSkillMd(skill)
        );
        copyCompanionDirs(skill, skillDir);
      }
    },
  },
  kiro: {
    name: "Kiro",
    outputDir: "exports/kiro",
    async export(skills: Skill[], tracks: Track[]): Promise<void> {
      const outDir = this.outputDir;
      const steeringDir = join(outDir, "steering");
      ensureDir(outDir);
      ensureDir(steeringDir);

      writeOutput(join(outDir, "POWER.md"), buildKiroPowerMd(skills, tracks));

      const rewrittenSkillMap = new Map<string, Skill>();

      for (const skill of skills) {
        const companions = getCompanionFiles(skill);
        const linkMap: Record<string, string> = {};

        for (const comp of companions) {
          if (!comp.isMarkdown) continue;
          const slug = companionSlug(skill, comp);
          linkMap[comp.relativePath] = `${slug}.md`;

          const { content: compContent } = matter(comp.content);
          writeOutput(
            join(steeringDir, `${slug}.md`),
            compContent.trim() + "\n"
          );
        }

        const rewritten = skillWithRewrittenLinks(skill, linkMap);
        rewrittenSkillMap.set(skill.filePath, rewritten);
        const track = resolveField<string>(skill.frontmatter, "track") ?? skill.frontmatter.track;
        const fileName = `${track}-${skillSlug(skill)}.md`;
        writeOutput(join(steeringDir, fileName), buildKiroSkillSteering(rewritten, skills));
      }

      for (const track of tracks) {
        const rewrittenTrack = trackWithRewrittenSkills(track, rewrittenSkillMap);
        const fileName = `${track.name}-all.md`;
        writeOutput(join(steeringDir, fileName), buildKiroTrackSteering(rewrittenTrack, skills));
      }
    },
  },
};

function parseArgs(): string[] {
  const args = process.argv.slice(2);
  let platforms: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--platform" && i + 1 < args.length) {
      const platform = args[i + 1];
      if (platform === "all") {
        platforms = Object.keys(exporters);
      } else if (exporters[platform]) {
        platforms.push(platform);
      } else {
        console.error(`Unknown platform: ${platform}`);
        process.exit(1);
      }
      i++;
    }
  }

  // Default to all platforms if none specified
  if (platforms.length === 0) {
    platforms = Object.keys(exporters);
  }

  return platforms;
}

async function main(): Promise<void> {
  const platforms = parseArgs();
  const skills = discoverSkills();

  if (skills.length === 0) {
    console.log("No skills found. Skipping export.");
    process.exit(0);
  }

  console.log(`Found ${skills.length} skills.`);
  const tracks = organizeByTrack(skills);
  console.log(
    `Organized into ${tracks.length} tracks: ${tracks.map((t) => t.name).join(", ")}\n`
  );

  for (const platform of platforms) {
    const exporter = exporters[platform];
    if (exporter) {
      console.log(`Exporting to ${exporter.name}...`);
      cleanDir(exporter.outputDir);
      await exporter.export(skills, tracks);
      console.log("");
    }
  }

  console.log("Export complete.");

  if (platforms.length === Object.keys(exporters).length) {
    console.log("\nGenerating banner...");
    const result = spawnSync("python3", ["scripts/generate_banner.py"], {
      stdio: "inherit",
      encoding: "utf-8",
    });
    if (result.status !== 0) {
      console.warn("Banner generation failed (python3/cairosvg not available). Skipping.");
    }
  }

  process.exit(0);
}

// Only run main when executed directly (not when imported as a module)
const isMainModule = process.argv[1]?.endsWith("export.ts");
if (isMainModule) {
  main().catch((error) => {
    console.error("Export failed:", error);
    process.exit(1);
  });
}
