import { createDiagnostic } from "./diagnostics.js";
import type {
  FragmentKind,
  FragmentationResult,
  SourceDocument,
  SourceFragment,
} from "./fragment-model.js";
import type { InventoryLimits } from "./limits.js";
import type { FragmentationProfile } from "./model.js";
import { contentHash, fragmentIdentity, sectionIdentity } from "./source-bytes.js";

interface Line {
  readonly start: number;
  readonly end: number;
  readonly next: number;
  readonly text: string;
  readonly number: number;
}

interface Draft {
  readonly kind: FragmentKind;
  readonly start: number;
  readonly end: number;
  readonly ancestry: readonly string[];
  readonly sectionIdentity: string;
  readonly parentIndex?: number;
}

class FragmentLimitError extends Error {}

function linesOf(bytes: Uint8Array): readonly Line[] {
  const lines: Line[] = [];
  let start = 0;
  let number = 1;
  for (let index = 0; index <= bytes.length; index += 1) {
    if (index !== bytes.length && bytes[index] !== 0x0a && bytes[index] !== 0x0d) continue;
    let next = index;
    if (index < bytes.length) {
      next = index + 1;
      if (bytes[index] === 0x0d && bytes[next] === 0x0a) next += 1;
    }
    lines.push({
      start,
      end: index,
      next,
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(start, index)),
      number,
    });
    start = next;
    number += 1;
  }
  return lines;
}

function asciiTrimBounds(bytes: Uint8Array, start: number, end: number): [number, number] {
  while (start < end && (bytes[start] === 0x20 || bytes[start] === 0x09)) start += 1;
  while (end > start && (bytes[end - 1] === 0x20 || bytes[end - 1] === 0x09)) end -= 1;
  return [start, end];
}

function tableCellBounds(bytes: Uint8Array, start: number, end: number): [number, number] {
  if (start < end && bytes[start] === 0x20) start += 1;
  if (end > start && bytes[end - 1] === 0x20) end -= 1;
  return [start, end];
}

function heading(line: Line): { readonly level: number; readonly label: string } | undefined {
  const text = line.text.replace(/^\uFEFF/, "");
  const match = /^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/.exec(text);
  if (match === null) return undefined;
  const label = match[2]!.replace(/[ \t]+#+[ \t]*$/, "").trim();
  return { level: match[1]!.length, label };
}

function listMatch(line: Line): RegExpExecArray | null {
  return /^( *)(?:[-+*]|\d+[.)])([ \t]+)(.*)$/.exec(line.text);
}

function pipeOffsets(text: string): readonly number[] {
  const offsets: number[] = [];
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === "\\" && !escaped) {
      escaped = true;
      continue;
    }
    if (char === "|" && !escaped) offsets.push(Buffer.byteLength(text.slice(0, index), "utf8"));
    escaped = false;
  }
  return offsets;
}

function tableDelimiter(line: Line): boolean {
  const parts = line.text
    .split(/(?<!\\)\|/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 0 && parts.every((part) => /^:?-{3,}:?$/.test(part));
}

function fenceOpen(line: Line): { readonly marker: string; readonly length: number } | undefined {
  const match = /^ {0,3}(`{3,}|~{3,})[ \t]*([^ \t]*)/.exec(line.text);
  if (match === null || match[2]!.toLowerCase() !== "ebnf") return undefined;
  return { marker: match[1]![0]!, length: match[1]!.length };
}

function fenceClose(line: Line, marker: string, length: number): boolean {
  const expression = new RegExp(`^ {0,3}\\${marker}{${length},}[ \\t]*$`);
  return expression.test(line.text);
}

function paragraphEligible(line: Line): boolean {
  const text = line.text;
  if (text.trim() === "") return false;
  if (/^ {0,3}(?:>|<|`{3,}|~{3,})/.test(text)) return false;
  if (/^ {0,3}(?:[-*_][ \t]*){3,}$/.test(text)) return false;
  return heading(line) === undefined && listMatch(line) === null;
}

function productionEnd(
  lines: readonly Line[],
  start: number,
  fenceEnd: number,
  fallbackEnd: number,
): number {
  let quote: "'" | '"' | undefined;
  let escaped = false;
  for (let lineIndex = start; lineIndex < fenceEnd; lineIndex += 1) {
    const line = lines[lineIndex]!;
    for (let index = 0; index < line.text.length; index += 1) {
      const char = line.text[index];
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (quote !== undefined && char === quote) {
        quote = undefined;
      } else if (quote === undefined && (char === "'" || char === '"')) {
        quote = char;
      } else if (quote === undefined && char === ";") {
        return line.start + Buffer.byteLength(line.text.slice(0, index + 1), "utf8");
      }
    }
  }
  return fallbackEnd;
}

function displayLocation(
  bytes: Uint8Array,
  lines: readonly Line[],
  byte: number,
): { line: number; column: number } {
  const line = [...lines].reverse().find((candidate) => candidate.start <= byte)!;
  return {
    line: line.number,
    column: [...new TextDecoder().decode(bytes.subarray(line.start, byte))].length + 1,
  };
}

function draftSource(
  source: SourceDocument,
  maxFragments: number,
): { readonly drafts: readonly Draft[]; readonly lines: readonly Line[] } {
  const bytes = source.bytes;
  const lines = linesOf(bytes);
  const drafts: Draft[] = [];
  const ancestry: string[] = [];
  const sectionOccurrences = new Map<string, number>();
  let currentSection = sectionIdentity([], 0);
  let index = 0;

  const add = (kind: FragmentKind, start: number, end: number, parentIndex?: number): number => {
    if (drafts.length >= maxFragments) throw new FragmentLimitError();
    drafts.push({
      kind,
      start,
      end,
      ancestry: [...ancestry],
      sectionIdentity: currentSection,
      ...(parentIndex === undefined ? {} : { parentIndex }),
    });
    return drafts.length - 1;
  };

  while (index < lines.length) {
    const line = lines[index];
    if (line === undefined || line.text.trim() === "") {
      index += 1;
      continue;
    }
    const headingValue = heading(line);
    if (headingValue !== undefined) {
      ancestry.length = Math.max(0, headingValue.level - 1);
      ancestry[headingValue.level - 1] = headingValue.label;
      const normalizedAncestry = ancestry.map((value) => value.normalize("NFC"));
      const key = JSON.stringify(normalizedAncestry);
      const occurrence = sectionOccurrences.get(key) ?? 0;
      sectionOccurrences.set(key, occurrence + 1);
      currentSection = sectionIdentity(normalizedAncestry, occurrence);
      const [start, end] = asciiTrimBounds(bytes, line.start, line.end);
      add("heading", start, end);
      index += 1;
      continue;
    }
    const fence = fenceOpen(line);
    if (fence !== undefined) {
      let close = index + 1;
      while (
        close < lines.length &&
        !fenceClose(lines[close] as Line, fence.marker, fence.length)
      ) {
        close += 1;
      }
      let finalLineIndex = Math.min(close, lines.length - 1);
      while (finalLineIndex > index && (lines[finalLineIndex] as Line).text.trim() === "") {
        finalLineIndex -= 1;
      }
      const finalLine = lines[finalLineIndex] as Line;
      const [start] = asciiTrimBounds(bytes, line.start, line.end);
      const [, end] = asciiTrimBounds(bytes, finalLine.start, finalLine.end);
      const parent = add("ebnf-fence", start, end);
      const contentEnd = close < lines.length ? close : finalLineIndex + 1;
      const contentEndByte = (lines[Math.max(index + 1, contentEnd - 1)] as Line).end;
      const productions: { readonly start: number; readonly end: number }[] = [];
      let productionLine = index + 1;
      while (productionLine < contentEnd) {
        const candidate = lines[productionLine] as Line;
        if (/^[A-Za-z_][A-Za-z0-9_]*[ \t]*=/.test(candidate.text)) {
          const [childStart] = asciiTrimBounds(bytes, candidate.start, candidate.end);
          const childEnd = productionEnd(lines, productionLine, contentEnd, contentEndByte);
          productions.push({ start: childStart, end: childEnd });
          while (productionLine < contentEnd && (lines[productionLine] as Line).end < childEnd) {
            productionLine += 1;
          }
        }
        productionLine += 1;
      }
      const children: {
        readonly kind: "ebnf-production" | "residual";
        readonly start: number;
        readonly end: number;
      }[] = productions.map((production) => ({ kind: "ebnf-production", ...production }));
      for (let lineIndex = index; lineIndex <= finalLineIndex; lineIndex += 1) {
        const candidate = lines[lineIndex] as Line;
        const blockers = productions
          .filter(
            (production) => production.start < candidate.end && production.end > candidate.start,
          )
          .sort((left, right) => left.start - right.start);
        let cursor = candidate.start;
        for (const blocker of blockers) {
          const [gapStart, gapEnd] = asciiTrimBounds(
            bytes,
            cursor,
            Math.min(blocker.start, candidate.end),
          );
          if (gapStart < gapEnd) children.push({ kind: "residual", start: gapStart, end: gapEnd });
          cursor = Math.max(cursor, blocker.end);
        }
        const [gapStart, gapEnd] = asciiTrimBounds(bytes, cursor, candidate.end);
        if (gapStart < gapEnd) children.push({ kind: "residual", start: gapStart, end: gapEnd });
      }
      for (const child of children.sort(
        (left, right) => left.start - right.start || left.end - right.end,
      )) {
        add(child.kind, child.start, child.end, parent);
      }
      index = Math.min(close + 1, lines.length);
      continue;
    }
    if (index + 1 < lines.length && tableDelimiter(lines[index + 1] as Line)) {
      let row = index;
      while (
        row < lines.length &&
        (row <= index + 1 ||
          ((lines[row] as Line).text.includes("|") && (lines[row] as Line).text.trim() !== ""))
      ) {
        const candidate = lines[row] as Line;
        const [start, end] = asciiTrimBounds(bytes, candidate.start, candidate.end);
        const parent = add("table-row", start, end);
        const separators = pipeOffsets(candidate.text).map((offset) => candidate.start + offset);
        let segmentStart = candidate.start;
        for (const separator of [...separators, candidate.end]) {
          const [cellStart, cellEnd] = tableCellBounds(bytes, segmentStart, separator);
          if (cellStart < cellEnd) add("table-cell", cellStart, cellEnd, parent);
          if (separator < candidate.end) add("residual", separator, separator + 1, parent);
          segmentStart = separator + 1;
        }
        row += 1;
      }
      index = row;
      continue;
    }
    const item = listMatch(line);
    if (item !== null) {
      const indent = item[1]!.length;
      const contentColumn = indent + item[0].length - item[3]!.length;
      let endLine = index;
      while (endLine + 1 < lines.length) {
        const next = lines[endLine + 1] as Line;
        if (next.text.trim() === "") break;
        const nextItem = listMatch(next);
        if (nextItem !== null) break;
        const nextIndent = /^ */.exec(next.text)![0].length;
        if (
          nextIndent < contentColumn ||
          heading(next) !== undefined ||
          fenceOpen(next) !== undefined
        )
          break;
        endLine += 1;
      }
      const start = line.start;
      const [, end] = asciiTrimBounds(
        bytes,
        (lines[endLine] as Line).start,
        (lines[endLine] as Line).end,
      );
      add("list-item", start, end);
      index = endLine + 1;
      continue;
    }
    if (paragraphEligible(line)) {
      let endLine = index;
      while (endLine + 1 < lines.length && paragraphEligible(lines[endLine + 1] as Line)) {
        if (endLine + 2 < lines.length && tableDelimiter(lines[endLine + 2] as Line)) break;
        endLine += 1;
      }
      const [start] = asciiTrimBounds(bytes, line.start, line.end);
      const [, end] = asciiTrimBounds(
        bytes,
        (lines[endLine] as Line).start,
        (lines[endLine] as Line).end,
      );
      add("paragraph", start, end);
      index = endLine + 1;
      continue;
    }
    const [start, end] = asciiTrimBounds(bytes, line.start, line.end);
    add("residual", start, end);
    index += 1;
  }
  return { drafts, lines };
}

function canonicalSourcePath(path: string): boolean {
  return (
    path.startsWith("spec/") &&
    !path.includes("\\") &&
    path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..")
  );
}

/**
 * Derives deterministic fragment trees from one canonical source document.
 *
 * @example
 * ```ts
 * const result = fragmentSource(source, profile, INVENTORY_V1_LIMITS);
 * ```
 */
export function fragmentSource(
  source: SourceDocument,
  profile: FragmentationProfile,
  limits: InventoryLimits,
): FragmentationResult {
  if (
    profile.profileId !== "markdown-ebnf-v1" ||
    profile.version !== 1 ||
    profile.contentHashAlgorithm !== "sha256" ||
    profile.newlinePolicy !== "lf"
  ) {
    return {
      ok: false,
      fragments: [],
      diagnostics: [
        createDiagnostic({
          phase: "source",
          code: "source.unsupported-profile",
          path: source.path,
          message: "Only the markdown-ebnf-v1 fragmentation profile is supported.",
        }),
      ],
    };
  }
  if (!canonicalSourcePath(source.path)) {
    return {
      ok: false,
      fragments: [],
      diagnostics: [
        createDiagnostic({
          phase: "source",
          code: "source.invalid-path",
          path: source.path,
          message: "Source path must be canonical beneath spec/.",
        }),
      ],
    };
  }
  if (source.bytes.byteLength > limits.maxInputBytes) {
    return {
      ok: false,
      fragments: [],
      diagnostics: [
        createDiagnostic({
          phase: "source",
          code: "source.byte-limit",
          path: source.path,
          message: `Source exceeds ${limits.maxInputBytes} bytes.`,
        }),
      ],
    };
  }
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(source.bytes);
    const { drafts, lines } = draftSource(source, limits.maxFragments);
    const fragments: SourceFragment[] = [];
    const occurrences = new Map<string, number>();
    for (const draft of drafts) {
      const hash = contentHash(source.bytes.subarray(draft.start, draft.end), draft.start === 0);
      const parentFragmentId =
        draft.parentIndex === undefined ? undefined : fragments[draft.parentIndex]?.fragmentId;
      const tuple = [
        profile.profileId,
        profile.version,
        source.path,
        draft.sectionIdentity,
        parentFragmentId ?? "",
        draft.kind,
        hash,
      ].join("\u0000");
      const occurrence = occurrences.get(tuple) ?? 0;
      occurrences.set(tuple, occurrence + 1);
      const fragmentId = fragmentIdentity({
        profileId: profile.profileId,
        profileVersion: profile.version,
        path: source.path,
        sectionIdentity: draft.sectionIdentity,
        ...(parentFragmentId === undefined ? {} : { parentFragmentId }),
        kind: draft.kind,
        contentHash: hash,
        occurrence,
      });
      const location = displayLocation(source.bytes, lines, draft.start);
      fragments.push({
        fragmentId,
        ...(parentFragmentId === undefined ? {} : { parentFragmentId }),
        kind: draft.kind,
        startByte: draft.start,
        endByte: draft.end,
        headingAncestry: draft.ancestry,
        sectionIdentity: draft.sectionIdentity,
        contentHash: hash,
        displayLine: location.line,
        displayColumn: location.column,
      });
    }
    return { ok: true, fragments, diagnostics: [] };
  } catch (error) {
    if (error instanceof FragmentLimitError) {
      return {
        ok: false,
        fragments: [],
        diagnostics: [
          createDiagnostic({
            phase: "source",
            code: "source.fragment-limit",
            path: source.path,
            message: `Source produces more than ${limits.maxFragments} fragments.`,
          }),
        ],
      };
    }
    return {
      ok: false,
      fragments: [],
      diagnostics: [
        createDiagnostic({
          phase: "source",
          code: "source.invalid-utf8",
          path: source.path,
          message: "Source is not valid UTF-8.",
        }),
      ],
    };
  }
}
