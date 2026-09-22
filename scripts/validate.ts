import { readFileSync, readdirSync, statSync } from "fs";
import matter from "gray-matter";
import { dirname, join } from "path";

interface SkillFrontmatter {
  name: string;
  description: string;
  track?: string;
  tags?: string[];
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

/**
 * Resolves a field from flat frontmatter first, falling back to metadata.
 * Supports dual-format skills (old flat format and new nested metadata format).
 */
function resolveField<T>(fm: SkillFrontmatter, field: string): T | undefined {
  const flat = (fm as any)[field];
  if (flat !== undefined && flat !== null) return flat as T;
  if (fm.metadata) return (fm.metadata as any)[field] as T | undefined;
  return undefined;
}

interface Skill {
  frontmatter: SkillFrontmatter;
  content: string;
  rawContent: string;
  filePath: string;
  lineCount: number;
}

interface ValidationResult {
  passed: boolean;
  message: string;
  line?: number;
}

interface ValidationCheck {
  name: string;
  severity: "hard" | "soft";
  check(skill: Skill): ValidationResult[];
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
          const rawContent = readFileSync(skillFile, "utf-8");
          const { data, content: markdownContent } = matter(rawContent);

          skills.push({
            frontmatter: data as SkillFrontmatter,
            content: markdownContent,
            rawContent,
            filePath: skillFile,
            lineCount: rawContent.split("\n").length,
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

/**
 * Strips fenced code blocks from markdown content, returning only prose lines.
 * Each returned entry preserves its original 1-based line number.
 */
function getProseLines(content: string): Array<{ line: number; text: string }> {
  const lines = content.split("\n");
  const result: Array<{ line: number; text: string }> = [];
  let inCodeBlock = false;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trimStart();
    if (trimmed.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!inCodeBlock) {
      result.push({ line: i + 1, text: lines[i] });
    }
  }

  return result;
}

// ─── Check 1: YAML Validity ────────────────────────────────────────────────────
const yamlValidity: ValidationCheck = {
  name: "yaml-validity",
  severity: "hard",
  check(skill: Skill): ValidationResult[] {
    const results: ValidationResult[] = [];

    for (const field of ["name", "description"] as const) {
      const value = skill.frontmatter[field];
      if (value === undefined || value === null || value === "") {
        results.push({
          passed: false,
          message: `Missing required frontmatter field: "${field}"`,
        });
      }
    }

    const track = resolveField<string>(skill.frontmatter, "track");
    if (track === undefined || track === null || track === "") {
      results.push({
        passed: false,
        message: `Missing required frontmatter field: "track"`,
      });
    }

    const tags = resolveField<string[]>(skill.frontmatter, "tags");
    if (tags === undefined || tags === null) {
      results.push({
        passed: false,
        message: `Missing required frontmatter field: "tags"`,
      });
    } else if (!Array.isArray(tags)) {
      results.push({
        passed: false,
        message: `"tags" must be an array`,
      });
    }

    if (results.length === 0) {
      results.push({ passed: true, message: "All required frontmatter fields present" });
    }

    return results;
  },
};

// ─── Check 2: Description Quality ──────────────────────────────────────────────
const descriptionQuality: ValidationCheck = {
  name: "description-quality",
  severity: "hard",
  check(skill: Skill): ValidationResult[] {
    const desc = skill.frontmatter.description ?? "";
    const wordCount = desc
      .split(/\s+/)
      .filter((w) => w.length > 0).length;

    if (wordCount < 20) {
      return [
        {
          passed: false,
          message: `Description has ${wordCount} words (minimum 20)`,
        },
      ];
    }

    return [{ passed: true, message: `Description has ${wordCount} words` }];
  },
};

// ─── Check 3: Required Sections ─────────────────────────────────────────────────
const requiredSections: ValidationCheck = {
  name: "required-sections",
  severity: "soft",
  check(skill: Skill): ValidationResult[] {
    const oldSections = [
      "Overview",
      "Key Concepts",
      "Constraints",
      "Implementation Pattern",
      "Anti-Patterns",
      "Reference",
    ];
    const newSections = [
      "When this skill applies",
      "Decision rules",
      "Hard constraints",
      "Preferred pattern",
      "Common failure modes",
      "Review checklist",
      "Reference",
    ];

    const isNewFormat =
      skill.frontmatter.metadata !== undefined ||
      /^##\s+When this skill applies/im.test(skill.content);

    const sections = isNewFormat ? newSections : oldSections;
    const results: ValidationResult[] = [];

    for (const section of sections) {
      const pattern = new RegExp(`^##\\s+${section}`, "im");
      if (!pattern.test(skill.content)) {
        results.push({
          passed: false,
          message: `Missing required H2 section: "## ${section}"`,
        });
      }
    }

    if (results.length === 0) {
      results.push({ passed: true, message: "All required H2 sections present" });
    }

    return results;
  },
};

// ─── Check 4: Code Block Annotations ────────────────────────────────────────────
const codeBlockAnnotations: ValidationCheck = {
  name: "code-block-annotations",
  severity: "hard",
  check(skill: Skill): ValidationResult[] {
    const lines = skill.content.split("\n");
    const results: ValidationResult[] = [];
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trimStart();
      if (!trimmed.startsWith("```")) continue;

      if (!inCodeBlock) {
        inCodeBlock = true;
        if (/^```\s*$/.test(trimmed)) {
          results.push({
            passed: false,
            message: `Bare code fence without language annotation`,
            line: i + 1,
          });
        }
      } else {
        inCodeBlock = false;
      }
    }

    if (results.length === 0) {
      results.push({ passed: true, message: "All code blocks have language annotations" });
    }

    return results;
  },
};

// ─── Check 5: No Placeholders ───────────────────────────────────────────────────
const noPlaceholders: ValidationCheck = {
  name: "no-placeholders",
  severity: "hard",
  check(skill: Skill): ValidationResult[] {
    const proseLines = getProseLines(skill.content);
    const results: ValidationResult[] = [];
    const placeholderPattern = /\b(TODO|TBD|FIXME)\b/;

    for (const { line, text } of proseLines) {
      const match = placeholderPattern.exec(text);
      if (match) {
        results.push({
          passed: false,
          message: `Found placeholder "${match[1]}" outside code block`,
          line,
        });
      }
    }

    if (results.length === 0) {
      results.push({ passed: true, message: "No placeholders found outside code blocks" });
    }

    return results;
  },
};

// ─── Check 6: Detection Patterns ────────────────────────────────────────────────
const detectionPatterns: ValidationCheck = {
  name: "detection-patterns",
  severity: "soft",
  check(skill: Skill): ValidationResult[] {
    const pattern = /\*\*Detection\*\*|(?:^|\s)Detection(?:\s|:|$)/m;

    if (!pattern.test(skill.content)) {
      return [
        {
          passed: false,
          message: `No "Detection" or "**Detection**" pattern found in content`,
        },
      ];
    }

    return [{ passed: true, message: "Detection pattern found" }];
  },
};

// ─── Check 7: Paired Examples ───────────────────────────────────────────────────
const pairedExamples: ValidationCheck = {
  name: "paired-examples",
  severity: "soft",
  check(skill: Skill): ValidationResult[] {
    const hasOldCorrect = skill.content.includes("✅");
    const hasOldIncorrect = skill.content.includes("❌");
    const hasNewCorrect = skill.content.includes("**Correct**");
    const hasNewIncorrect = skill.content.includes("**Wrong**");

    const hasCorrectPair = hasOldCorrect && hasOldIncorrect;
    const hasNewPair = hasNewCorrect && hasNewIncorrect;

    if (hasCorrectPair || hasNewPair) {
      return [{ passed: true, message: "Paired example markers present" }];
    }

    const results: ValidationResult[] = [];
    if (!hasOldCorrect && !hasNewCorrect) {
      results.push({
        passed: false,
        message: `Missing correct example marker (✅ or **Correct**)`,
      });
    }
    if (!hasOldIncorrect && !hasNewIncorrect) {
      results.push({
        passed: false,
        message: `Missing incorrect example marker (❌ or **Wrong**)`,
      });
    }

    return results;
  },
};

// ─── Check 8: URL Format ────────────────────────────────────────────────────────
const urlFormat: ValidationCheck = {
  name: "url-format",
  severity: "soft",
  check(skill: Skill): ValidationResult[] {
    const vtexUrlPattern =
      /https?:\/\/(developers\.vtex\.com|help\.vtex\.com)/;

    if (!vtexUrlPattern.test(skill.content)) {
      return [
        {
          passed: false,
          message: `No VTEX documentation URL found (developers.vtex.com or help.vtex.com)`,
        },
      ];
    }

    return [{ passed: true, message: "VTEX documentation URL present" }];
  },
};

// ─── Check 9: Size Bounds ───────────────────────────────────────────────────────
const sizeBounds: ValidationCheck = {
  name: "size-bounds",
  severity: "hard",
  check(skill: Skill): ValidationResult[] {
    if (skill.lineCount > 1000) {
      return [
        {
          passed: false,
          message: `File has ${skill.lineCount} lines (maximum 1000)`,
        },
      ];
    }

    return [
      { passed: true, message: `File has ${skill.lineCount} lines (≤ 1000)` },
    ];
  },
};

// ─── Check 10: Track Consistency ────────────────────────────────────────────────
const trackConsistency: ValidationCheck = {
  name: "track-consistency",
  severity: "hard",
  check(skill: Skill): ValidationResult[] {
    const pathParts = skill.filePath.split(/[/\\]/);
    const dirTrack = pathParts[1];
    const fmTrack = resolveField<string>(skill.frontmatter, "track");

    if (fmTrack !== dirTrack) {
      return [
        {
          passed: false,
          message: `Frontmatter track="${fmTrack}" does not match directory "tracks/${dirTrack}/skills/"`,
        },
      ];
    }

    return [
      {
        passed: true,
        message: `Track "${fmTrack}" matches directory path`,
      },
    ];
  },
};

// ─── Check 11: Globs Format ─────────────────────────────────────────────────
const globsFormat: ValidationCheck = {
  name: "globs-format",
  severity: "hard",
  check(skill: Skill): ValidationResult[] {
    const globs = resolveField<string[]>(skill.frontmatter, "globs");
    const results: ValidationResult[] = [];

    // If globs is undefined/missing, it's optional — pass
    if (globs === undefined) {
      results.push({ passed: true, message: "globs field is optional (not present)" });
      return results;
    }

    // If globs is present but not an array — fail
    if (!Array.isArray(globs)) {
      results.push({
        passed: false,
        message: `"globs" must be an array, got ${typeof globs}`,
      });
      return results;
    }

    // Check each element in the array
    for (let i = 0; i < globs.length; i++) {
      const glob = globs[i];

      // Each element must be a non-empty string
      if (typeof glob !== "string") {
        results.push({
          passed: false,
          message: `globs[${i}] must be a string, got ${typeof glob}`,
        });
        continue;
      }

      if (glob.length === 0) {
        results.push({
          passed: false,
          message: `globs[${i}] is an empty string`,
        });
        continue;
      }

      // Warn if no wildcard found
      if (!glob.includes("*")) {
        results.push({
          passed: true,
          message: `globs[${i}] "${glob}" has no wildcard (specific filename)`,
        });
      }
    }

    // If no failures, add a pass message
    if (results.length === 0 || results.every((r) => r.passed)) {
      if (results.length === 0) {
        results.push({ passed: true, message: `globs array is valid (${globs.length} patterns)` });
      }
    }

    return results;
  },
};

// ─── Check 12: Filename Casing ─────────────────────────────────────────────
const filenameCasing: ValidationCheck = {
  name: "filename-casing",
  severity: "hard",
  check(skill: Skill): ValidationResult[] {
    const skillDir = dirname(skill.filePath);
    const results: ValidationResult[] = [];

    try {
      const files = readdirSync(skillDir);
      const markdownFiles = files.filter((f) => f.endsWith(".md"));

      // Check if skill.md exists with correct casing
      if (markdownFiles.includes("skill.md")) {
        results.push({ passed: true, message: `File is correctly named "skill.md"` });
        return results;
      }

      // Check for case-insensitive matches (e.g., SKILL.md, Skill.md)
      const wrongCasing = markdownFiles.find(
        (f) => f.toLowerCase() === "skill.md" && f !== "skill.md"
      );

      if (wrongCasing) {
        results.push({
          passed: false,
          message: `Source file must be named "skill.md" (lowercase), found "${wrongCasing}"`,
        });
        return results;
      }

      // If no markdown file found at all
      results.push({
        passed: false,
        message: `No "skill.md" file found in directory`,
      });
    } catch (error) {
      results.push({
        passed: false,
        message: `Could not read directory: ${error instanceof Error ? error.message : String(error)}`,
      });
    }

    return results;
  },
};

// ─── Check 13: Companion Links ──────────────────────────────────────────────
const companionLinks: ValidationCheck = {
  name: "companion-links",
  severity: "hard",
  check(skill: Skill): ValidationResult[] {
    const results: ValidationResult[] = [];
    const skillDir = dirname(skill.filePath);

    // Match all markdown links: [text](href)
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let match: RegExpExecArray | null = linkRegex.exec(skill.content);

    while (match !== null) {
      const href = match[2];

      // Skip external URLs
      if (href.startsWith("http://") || href.startsWith("https://")) {
        match = linkRegex.exec(skill.content);
        continue;
      }
      // Skip absolute paths
      if (href.startsWith("/")) {
        match = linkRegex.exec(skill.content);
        continue;
      }
      // Skip anchor-only links
      if (href.startsWith("#")) {
        match = linkRegex.exec(skill.content);
        continue;
      }
      // Skip mailto links
      if (href.startsWith("mailto:")) {
        match = linkRegex.exec(skill.content);
        continue;
      }

      // Resolve the path relative to the skill's directory
      const targetPath = join(skillDir, href);

      try {
        statSync(targetPath);
      } catch {
        // Find the line number for better error reporting
        const lines = skill.content.split("\n");
        let lineNum: number | undefined;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(href)) {
            lineNum = i + 1;
            break;
          }
        }

        results.push({
          passed: false,
          message: `Broken companion link: "${href}" does not exist`,
          line: lineNum,
        });
      }

      match = linkRegex.exec(skill.content);
    }

    // If no broken links found, report success
    if (results.length === 0) {
      results.push({ passed: true, message: "All companion links resolve" });
    }

    return results;
  },
};

// ─── All checks ─────────────────────────────────────────────────────────────────
const validationChecks: ValidationCheck[] = [
  yamlValidity,
  descriptionQuality,
  requiredSections,
  codeBlockAnnotations,
  noPlaceholders,
  detectionPatterns,
  pairedExamples,
  urlFormat,
  sizeBounds,
  trackConsistency,
  globsFormat,
  filenameCasing,
  companionLinks,
];

async function main(): Promise<void> {
  const ciMode = process.argv.includes("--ci");
  const skills = discoverSkills();

  if (skills.length === 0) {
    console.log("No skills found. Nothing to validate.");
    process.exit(0);
  }

  const hardChecks = validationChecks.filter((c) => c.severity === "hard");
  const softChecks = validationChecks.filter((c) => c.severity === "soft");
  const totalChecks = validationChecks.length;

  console.log(
    `Validating ${skills.length} skill files (${hardChecks.length} hard, ${softChecks.length} soft checks)...\n`
  );

  let totalPassed = 0;
  let totalFailed = 0;
  let totalWarned = 0;

  for (const skill of skills) {
    const hardFailures: Array<{
      checkName: string;
      message: string;
      line?: number;
    }> = [];
    const softFailures: Array<{
      checkName: string;
      message: string;
      line?: number;
    }> = [];
    const failedHardChecks = new Set<string>();
    const failedSoftChecks = new Set<string>();

    for (const check of validationChecks) {
      const results = check.check(skill);
      const checkFailed = results.some((r) => !r.passed);

      if (checkFailed) {
        const bucket =
          check.severity === "hard" ? hardFailures : softFailures;
        const nameSet =
          check.severity === "hard" ? failedHardChecks : failedSoftChecks;
        nameSet.add(check.name);
        for (const result of results) {
          if (!result.passed) {
            bucket.push({
              checkName: check.name,
              message: result.message,
              line: result.line,
            });
          }
        }
      }
    }

    const passedChecks = totalChecks - failedHardChecks.size - failedSoftChecks.size;

    if (hardFailures.length === 0 && softFailures.length === 0) {
      console.log(
        `✅ ${skill.filePath} — ${totalChecks}/${totalChecks} checks passed`
      );
      totalPassed++;
    } else if (hardFailures.length === 0) {
      console.log(
        `⚠️  ${skill.filePath} — ${passedChecks}/${totalChecks} checks passed (${failedSoftChecks.size} warnings)`
      );
      for (const f of softFailures) {
        const lineInfo = f.line !== undefined ? ` (line ${f.line})` : "";
        console.log(`   WARN: [${f.checkName}] — ${f.message}${lineInfo}`);
        if (ciMode) {
          const lineParam = f.line !== undefined ? `,line=${f.line}` : "";
          console.log(
            `::warning file=${skill.filePath}${lineParam},title=${f.checkName}::${f.message}`
          );
        }
      }
      totalWarned++;
    } else {
      console.log(
        `❌ ${skill.filePath} — ${passedChecks}/${totalChecks} checks passed`
      );
      for (const f of hardFailures) {
        const lineInfo = f.line !== undefined ? ` (line ${f.line})` : "";
        console.log(`   FAIL: [${f.checkName}] — ${f.message}${lineInfo}`);
        if (ciMode) {
          const lineParam = f.line !== undefined ? `,line=${f.line}` : "";
          console.log(
            `::error file=${skill.filePath}${lineParam},title=${f.checkName}::${f.message}`
          );
        }
      }
      for (const f of softFailures) {
        const lineInfo = f.line !== undefined ? ` (line ${f.line})` : "";
        console.log(`   WARN: [${f.checkName}] — ${f.message}${lineInfo}`);
        if (ciMode) {
          const lineParam = f.line !== undefined ? `,line=${f.line}` : "";
          console.log(
            `::warning file=${skill.filePath}${lineParam},title=${f.checkName}::${f.message}`
          );
        }
      }
      totalFailed++;
    }
  }

  const summaryParts = [`${totalPassed} passed`];
  if (totalWarned > 0) summaryParts.push(`${totalWarned} warned`);
  if (totalFailed > 0) summaryParts.push(`${totalFailed} failed`);

  console.log(`\nSummary: ${summaryParts.join(", ")} (${skills.length} total)`);

  if (totalFailed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Validation failed:", error);
  process.exit(1);
});
