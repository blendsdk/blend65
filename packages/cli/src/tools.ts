import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { parseTree } from "jsonc-parser";
import type { Node, ParseError } from "jsonc-parser";

/** Machine-local executable selections loaded from the optional tools file. */
export interface ToolsConfig {
  /** Optional absolute ACME executable path. */
  readonly acmePath?: string;
  /** Optional absolute VICE x64sc executable path. */
  readonly x64scPath?: string;
}

/** One tools-file read and validation outcome. */
export type ToolsConfigResult =
  | {
      readonly kind: "success";
      /** Exact tools-file path consulted for this outcome. */
      readonly path: string;
      /** Accepted selections; empty when the file is absent. */
      readonly config: ToolsConfig;
    }
  | {
      readonly kind: "failure";
      /** Exact tools-file path consulted for this outcome. */
      readonly path: string;
      /** Stable configuration diagnostic without file content. */
      readonly diagnostic: string;
    };

/**
 * Resolve the one machine-local tools-file location for the selected host.
 *
 * Linux and macOS use `${XDG_CONFIG_HOME:-$HOME/.config}/blend65/tools.jsonc`. Windows uses
 * `%APPDATA%\blend65\tools.jsonc` and falls back to the roaming profile when `APPDATA` is absent.
 * A relative configuration root is ignored so the file cannot move with the working directory.
 *
 * @param environment Process environment snapshot.
 * @param platform Host platform discriminator.
 * @param home Home directory used when the platform-specific root is absent.
 * @returns Absolute tools-file path.
 */
export function toolsConfigPath(
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home: string = homedir(),
): string {
  if (platform === "win32") {
    const appData = environment.APPDATA;
    const base =
      appData !== undefined && appData.length > 0 && isAbsolute(appData)
        ? appData
        : join(home, "AppData", "Roaming");
    return join(base, "blend65", "tools.jsonc");
  }
  const xdg = environment.XDG_CONFIG_HOME;
  const base = xdg !== undefined && xdg.length > 0 && isAbsolute(xdg) ? xdg : join(home, ".config");
  return join(base, "blend65", "tools.jsonc");
}

/** Return whether a filesystem error means that the tools file is absent. */
function isNotFound(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** Build one stable validation failure. */
function failure(path: string, diagnostic: string): ToolsConfigResult {
  return Object.freeze({ kind: "failure" as const, path, diagnostic });
}

/** Read the accepted optional absolute path from one validated value node. */
function optionalAbsolutePath(
  values: ReadonlyMap<string, Node>,
  key: "acmePath" | "x64scPath",
): { readonly value?: string; readonly diagnostic?: string } {
  const node = values.get(key);
  if (node === undefined) return {};
  if (node.type !== "string" || typeof node.value !== "string" || !isAbsolute(node.value)) {
    return { diagnostic: `The tools file field "${key}" must be an absolute path string` };
  }
  return { value: node.value };
}

/**
 * Parse one JSONC tools file without reading any other host state.
 *
 * The accepted shape is an object with required integer `schemaVersion: 1` and optional absolute
 * string `acmePath` and `x64scPath` fields. Comments and trailing commas are valid JSONC.
 * Unknown keys, duplicate keys, wrong types, and relative paths fail with stable diagnostics.
 *
 * @param text Complete tools-file text.
 * @param path Exact path used only to identify the failure.
 * @returns Accepted selections or one stable configuration failure.
 */
export function parseToolsConfig(text: string, path: string): ToolsConfigResult {
  const errors: ParseError[] = [];
  const root = parseTree(text, errors, {
    allowTrailingComma: true,
    disallowComments: false,
  });
  if (root === undefined || errors.length > 0 || root.type !== "object")
    return failure(path, "The tools file must contain one JSON object");

  const seen = new Set<string>();
  const values = new Map<string, Node>();
  for (const property of root.children ?? []) {
    if (property.type !== "property" || property.children === undefined)
      return failure(path, "The tools file must contain only named fields");
    const [keyNode, valueNode] = property.children;
    if (keyNode?.type !== "string" || typeof keyNode.value !== "string" || valueNode === undefined)
      return failure(path, "The tools file must contain only named fields");
    const key = keyNode.value;
    if (seen.has(key)) return failure(path, `The tools file contains the duplicate key "${key}"`);
    seen.add(key);
    if (key !== "schemaVersion" && key !== "acmePath" && key !== "x64scPath")
      return failure(path, `The tools file contains the unknown key "${key}"`);
    values.set(key, valueNode);
  }

  const version = values.get("schemaVersion");
  if (
    version === undefined ||
    version.type !== "number" ||
    !Number.isInteger(version.value) ||
    version.value !== 1
  )
    return failure(path, "The tools file requires integer schemaVersion 1");

  const acme = optionalAbsolutePath(values, "acmePath");
  if (acme.diagnostic !== undefined) return failure(path, acme.diagnostic);
  const x64sc = optionalAbsolutePath(values, "x64scPath");
  if (x64sc.diagnostic !== undefined) return failure(path, x64sc.diagnostic);

  return Object.freeze({
    kind: "success" as const,
    path,
    config: Object.freeze({
      ...(acme.value === undefined ? {} : { acmePath: acme.value }),
      ...(x64sc.value === undefined ? {} : { x64scPath: x64sc.value }),
    }),
  });
}

/**
 * Read and validate the optional machine-local tools file.
 *
 * The absent file is a valid empty selection. Any other read error, malformed JSONC, or invalid
 * field is a stable configuration failure. The caller decides which operations load the file;
 * `check` and ordinary language-server analysis must never call this function.
 *
 * @param environment Process environment snapshot.
 * @param platform Host platform discriminator.
 * @param home Home directory used when the platform-specific root is absent.
 * @returns Accepted selections or one stable configuration failure.
 * @example const tools = await readToolsConfig();
 */
export async function readToolsConfig(
  environment: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
  home: string = homedir(),
): Promise<ToolsConfigResult> {
  const path = toolsConfigPath(environment, platform, home);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (isNotFound(error)) return Object.freeze({ kind: "success" as const, path, config: {} });
    return failure(path, "The tools file could not be read");
  }
  return parseToolsConfig(text, path);
}
