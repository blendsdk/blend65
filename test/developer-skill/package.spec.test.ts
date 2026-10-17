import { lstat, readFile, readdir } from "node:fs/promises";
import { join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/** Fixed native ownership prevents this check from discovering unrelated skills. */
const SKILL = ".opencode/skills/blend65-game-developer";
const ROUTER = `${SKILL}/SKILL.md`;
const REFERENCES = [
  `${SKILL}/references/workflow-and-source.md`,
  `${SKILL}/references/game-systems.md`,
  `${SKILL}/references/evidence-and-boundaries.md`,
];
const FILES = [ROUTER, ...REFERENCES];
const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const EXPERT = ".agents/skills/blend65-domain-expert";

/** Only the frozen teaching chapters are approved specification destinations. */
const CHAPTERS = new Set(
  [
    "00-introduction.md",
    "01-lexical-structure.md",
    "02-type-system.md",
    "03-variables.md",
    "04-expressions-operators.md",
    "05-statements-control-flow.md",
    "06-functions.md",
    "07-structs.md",
    "08-arrays-strings.md",
    "09-enums.md",
    "10-modules.md",
    "11-memory-model.md",
    "12-intrinsics.md",
    "13-data-inclusion.md",
    "14-diagnostics.md",
    "15-platform-profile.md",
    "grammar.ebnf.md",
    "appendix-c64.md",
    "00-normative-inventory.md",
  ].map((name) => `spec/${name}`),
);

/** Separate filesystem failures from content failures without throwing on absence. */
interface Payload {
  /** Only the four approved files may have their contents loaded. */
  files: Map<string, string>;
  /** Missing, unreadable, extra or symlinked entries fail explicit assertions. */
  issues: string[];
}

/**
 * Inspect each component before proceeding, so even an approved name cannot
 * redirect a read or directory listing through a symlink. Callers supply only
 * fixed payload paths or destinations already accepted by resolveLink.
 */
async function pathIssue(
  relative: string,
  kind: "file" | "directory",
): Promise<string | undefined> {
  const parts = relative.split("/");
  let current = ROOT;
  for (const [index, part] of parts.entries()) {
    current = join(current, part);
    try {
      const entry = await lstat(current);
      if (entry.isSymbolicLink()) return `Symlink rejected: ${relative}`;
      const needsDirectory = index < parts.length - 1 || kind === "directory";
      if (needsDirectory ? !entry.isDirectory() : !entry.isFile()) {
        return `Wrong entry type: ${relative}`;
      }
    } catch (error) {
      const missing = error instanceof Error && "code" in error && error.code === "ENOENT";
      return `${missing ? "Missing" : "Cannot inspect"}: ${relative}`;
    }
  }
  return undefined;
}

/** Read only the fixed payload, with bounded listings to detect added machinery. */
async function readPayload(): Promise<Payload> {
  const result: Payload = { files: new Map(), issues: [] };
  for (const file of FILES) {
    const issue = await pathIssue(file, "file");
    if (issue) {
      result.issues.push(issue);
      continue;
    }
    try {
      result.files.set(file, await readFile(join(ROOT, file), "utf8"));
    } catch {
      result.issues.push(`Cannot read: ${file}`);
    }
  }
  for (const [directory, expected] of [
    [SKILL, ["SKILL.md", "references"]],
    [`${SKILL}/references`, REFERENCES.map((file) => posix.basename(file))],
  ] satisfies [string, string[]][]) {
    if (await pathIssue(directory, "directory")) continue;
    try {
      const actual = (await readdir(join(ROOT, directory))).sort();
      if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
        result.issues.push(`Unexpected payload entries: ${directory}`);
      }
    } catch {
      result.issues.push(`Cannot list approved payload directory: ${directory}`);
    }
  }
  return result;
}

/**
 * Extract Markdown destinations, including reference definitions. Code examples
 * are literal teaching text, not requests to inspect their apparent links.
 */
function destinations(markdown: string): string[] {
  const prose = markdown.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, "").replace(/`[^`\n]*`/g, "");
  const targets: string[] = [];
  const patterns = [
    /!?\[[^\]\n]*\]\(\s*(<[^>\n]+>|[^\s)]+)(?:\s+["'][^\n]*?["'])?\s*\)/g,
    /^ {0,3}\[[^\]\n]+\]:[ \t]*(<[^>\n]+>|[^\s]+)(?:[ \t]+.*)?$/gm,
  ];
  for (const pattern of patterns) {
    for (const match of prose.matchAll(pattern)) {
      const target = match[1];
      if (target) targets.push(target.replace(/^<|>$/g, ""));
    }
  }
  return targets;
}

/**
 * Resolve before touching the filesystem. Undefined rejects a destination; null
 * denotes an offline HTTPS link. Linked authority is never read, and fragments
 * are not claimed to prove the content or meaning of a selected heading.
 */
function resolveLink(source: string, destination: string): string | null | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(destination);
  } catch {
    return undefined;
  }
  if (/[\\\u0000-\u001f\u007f]/.test(decoded)) return undefined;
  if (/^[a-z][a-z0-9+.-]*:/i.test(decoded)) {
    try {
      const url = new URL(decoded);
      return url.protocol === "https:" && !url.username && !url.password ? null : undefined;
    } catch {
      return undefined;
    }
  }
  if (decoded.startsWith("/") || decoded.includes("?")) return undefined;
  const [pathname, fragment] = decoded.split("#");
  const target = pathname ? posix.normalize(posix.join(posix.dirname(source), pathname)) : source;
  if (FILES.includes(target) || CHAPTERS.has(target)) return target;
  if (target === `${EXPERT}/SKILL.md`) return target;
  if (target === `${EXPERT}/qualification/release.md`) return target;
  const reference = target.slice(`${EXPERT}/references/`.length);
  if (
    target.startsWith(`${EXPERT}/references/`) &&
    /^[a-z0-9-]+\.md$/.test(reference) &&
    !/evaluat|qualification|grader|case-map|preamble/.test(reference) &&
    fragment?.trim()
  ) {
    return target;
  }
  return undefined;
}

/**
 * Check packaging only. Native advertisement, actual selected body/override,
 * seven-area semantics, ordinary-source ergonomics and absence of invented APIs
 * or copied answers require separate native workflow and independent review.
 */
function contentIssues(files: ReadonlyMap<string, string>): string[] {
  const issues: string[] = [];
  const authorityLinks: string[] = [];
  for (const file of FILES) {
    const text = files.get(file);
    if (!text?.trim()) issues.push(`Missing payload content: ${file}`);
    if (
      REFERENCES.includes(file) &&
      text &&
      text.split(/\r?\n/).length - Number(text.endsWith("\n")) >= 700
    ) {
      issues.push(`Reference must remain below 700 lines: ${file}`);
    }
    for (const destination of destinations(text ?? "")) {
      const target = resolveLink(file, destination);
      if (target === undefined) {
        issues.push(`Unapproved reference in: ${file}`);
      } else if (target !== null) {
        authorityLinks.push(target);
      }
    }
  }
  if (!authorityLinks.some((target) => CHAPTERS.has(target))) {
    issues.push("Payload must link frozen specification authority");
  }
  if (!authorityLinks.some((target) => target.startsWith(`${EXPERT}/references/`))) {
    issues.push("Payload must link selected expert normative guidance");
  }
  const router = files.get(ROUTER) ?? "";
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(router);
  if (!frontmatter) {
    issues.push("Router requires plain frontmatter");
    return issues;
  }
  const header = frontmatter[1] ?? "";
  const names = [...header.matchAll(/^name:[ \t]*(.*)$/gm)];
  if (names.length !== 1 || names[0]?.[1]?.trim() !== "Blend65 Game Developer") {
    issues.push("Router requires the display name Blend65 Game Developer");
  }
  const descriptions = [...header.matchAll(/^description:[ \t]*(.*)$/gm)];
  const description = descriptions[0]?.[1]?.trim() ?? "";
  if (
    descriptions.length !== 1 ||
    !description ||
    /^(?:["'|>#[{]|null$|~$|true$|false$)/i.test(description)
  ) {
    issues.push("Router requires a nonempty plain description");
  }
  if (!/\b0\.1\.0\b/.test(router.slice(frontmatter[0].length))) {
    issues.push("Router body requires version 0.1.0");
  }
  const linked = destinations(router).map((link) => resolveLink(ROUTER, link));
  for (const reference of REFERENCES) {
    if (!linked.includes(reference)) {
      issues.push(`Router must link its focused reference: ${reference}`);
    }
  }
  return issues;
}

/** Harmless in-memory Markdown tests the checks without touching any fixtures. */
function validFixture(): Map<string, string> {
  return new Map([
    [
      ROUTER,
      [
        "---",
        "name: Blend65 Game Developer",
        "description: Write ordinary Blend65 applications with bounded evidence.",
        "---",
        "Version: 0.1.0",
        "[Workflow](references/workflow-and-source.md)",
        "[Systems][systems]",
        "[systems]: references/game-systems.md",
        "[Evidence](references/evidence-and-boundaries.md)",
      ].join("\n"),
    ],
    [
      REFERENCES[0]!,
      "[Types](../../../../spec/02-type-system.md)\n" +
        "[Native documentation](https://opencode.ai/v2/docs/skills)",
    ],
    [REFERENCES[1]!, "Guidance placeholder for structural controls only."],
    [
      REFERENCES[2]!,
      "[Release](../../../../.agents/skills/blend65-domain-expert/qualification/release.md)\n" +
        "[Evidence](../../../../.agents/skills/blend65-domain-expert/references/evidence-parity-and-recovery.md#evidence-boundary-rules)",
    ],
  ]);
}

describe("developer skill packaging, not native or semantic qualification", () => {
  it("should provide exactly four readable native files when the payload is installed", async () => {
    const payload = await readPayload();
    expect(payload.issues, "Native payload filesystem contract").toEqual([]);
    expect([...payload.files.keys()].sort()).toEqual([...FILES].sort());
  });

  it("should provide frontmatter, body version and focused references when the payload is installed", async () => {
    const payload = await readPayload();
    expect(contentIssues(payload.files), "Native payload content contract").toEqual([]);
  });

  it("should resolve approved local files without reading authority when the payload is installed", async () => {
    const payload = await readPayload();
    expect(payload.issues, "Cannot validate links without the native payload").toEqual([]);
    const issues: string[] = [];
    for (const [source, text] of payload.files) {
      for (const destination of destinations(text)) {
        const target = resolveLink(source, destination);
        if (target === undefined) {
          issues.push(`Unapproved reference in: ${source}`);
        } else if (target !== null) {
          const issue = await pathIssue(target, "file");
          if (issue) issues.push(issue);
        }
      }
    }
    expect(issues, "Approved local reference destinations must exist").toEqual([]);
  });

  it("should accept valid packaging when harmless Markdown uses inline and reference links", () => {
    expect(contentIssues(validFixture())).toEqual([]);
  });

  it.each(FILES)("should reject missing content when %s is absent", (file) => {
    const files = validFixture();
    files.delete(file);
    expect(contentIssues(files)).toContain(`Missing payload content: ${file}`);
  });

  it.each(["", "   ", "null", '""', "|"])(
    "should reject an unusable description when its value is %j",
    (description) => {
      const files = validFixture();
      files.set(
        ROUTER,
        files.get(ROUTER)!.replace(/^description:.*$/m, `description: ${description}`),
      );
      expect(contentIssues(files)).toContain("Router requires a nonempty plain description");
    },
  );

  it("should reject a misplaced version when only frontmatter contains 0.1.0", () => {
    const files = validFixture();
    files.set(
      ROUTER,
      files.get(ROUTER)!.replace("---\nVersion: 0.1.0", "version: 0.1.0\n---\nVersion: 0.2.0"),
    );
    expect(contentIssues(files)).toContain("Router body requires version 0.1.0");
  });

  it("should reject an omitted reference when the router no longer links it", () => {
    const files = validFixture();
    files.set(
      ROUTER,
      files.get(ROUTER)!.replace("[Evidence](references/evidence-and-boundaries.md)", ""),
    );
    expect(contentIssues(files)).toContain(
      `Router must link its focused reference: ${REFERENCES[2]}`,
    );
  });

  it("should reject a different display name when the directory ID is unchanged", () => {
    const files = validFixture();
    files.set(
      ROUTER,
      files.get(ROUTER)!.replace("name: Blend65 Game Developer", "name: Another Skill"),
    );
    expect(contentIssues(files)).toContain(
      "Router requires the display name Blend65 Game Developer",
    );
  });

  it("should reject an oversized reference when it reaches the file ceiling", () => {
    const files = validFixture();
    files.set(REFERENCES[1]!, Array.from({ length: 700 }, () => "Text").join("\n"));
    expect(contentIssues(files)).toContain(
      `Reference must remain below 700 lines: ${REFERENCES[1]}`,
    );
  });

  it.each([
    "../../../../../../outside-note.md",
    "../../../.unapproved/notes.md",
    "references/extra.md",
    "references/%2e%2e/%2e%2e/outside-note.md",
    "references\\workflow-and-source.md",
    "/outside-note.md",
    "file:///outside-note.md",
    "javascript:harmless-text",
  ])("should reject a destination before access when it is unapproved: %s", (destination) => {
    expect(resolveLink(ROUTER, destination)).toBeUndefined();
    const files = validFixture();
    files.set(ROUTER, `${files.get(ROUTER)}\n[Harmless control](${destination})`);
    expect(contentIssues(files)).toContain(`Unapproved reference in: ${ROUTER}`);
  });

  it("should resolve from the containing file when a reference links to its sibling", () => {
    expect(resolveLink(REFERENCES[0]!, "game-systems.md#guidance")).toBe(REFERENCES[1]);
    expect(resolveLink(REFERENCES[0]!, "references/game-systems.md")).toBeUndefined();
  });
});
