/**
 * Argument parsing for `blendc`.
 *
 * Isolates ALL yargs interaction: {@link parseArgs} configures the parser (the
 * normative flag table), parses via the callback form so help/version/usage text
 * routes through {@link CliIo} rather than yargs' own console binding, and
 * returns a discriminated {@link ParseOutcome} — clean `ParsedArgs`, help/version
 * text, or a usage failure. Config-backed flags carry NO yargs defaults (defaults
 * live in `CONFIG_DEFAULTS` — a yargs default would masquerade as an explicit
 * override).
 */

import yargs from "yargs";
import { VERSION } from "./version.js";

/** The parsed, cleaned CLI arguments (yargs typing contained to this module). */
export interface ParsedArgs {
  /** The resolved command. */
  command: "build" | "check";
  /** Positional source files (tier-1 discovery). */
  files: string[];

  // Config-backed options (undefined = not set → config default applies).
  platform?: string;
  config?: string;
  include?: string[];
  exclude?: string[];
  acmePath?: string;
  outDir?: string;
  outName?: string;
  maxErrors?: number;
  warnAsError?: boolean | string[];
  suppressWarnings?: string[];
  diagnosticsFormat?: "terminal" | "json";
  optimize?: boolean;
  quiet?: boolean;
  startup?: "auto" | "terminating" | "minimal" | "bare";

  // CLI-only flags.
  emitAsm?: boolean;
  emitIl?: boolean;
  emitReport?: boolean;
  color?: boolean;
  report?: "json";
}

/** The result of parsing argv. */
export type ParseOutcome =
  | { kind: "args"; args: ParsedArgs }
  | { kind: "help"; text: string } // --help/--version → stdout, exit 0
  | { kind: "fail"; text: string }; // usage/flag error → stderr, exit 2

/** The raw yargs argv shape we read (kept local; mapped to {@link ParsedArgs}). */
interface RawArgv {
  files?: (string | number)[];
  platform?: string;
  config?: string;
  include?: string[];
  exclude?: string[];
  "acme-path"?: string;
  "out-dir"?: string;
  "out-name"?: string;
  "max-errors"?: number;
  "warn-as-error"?: (string | number)[];
  "suppress-warning"?: (string | number)[];
  "diagnostics-format"?: "terminal" | "json";
  optimize?: boolean;
  quiet?: boolean;
  startup?: "auto" | "terminating" | "minimal" | "bare";
  "emit-asm"?: boolean;
  "emit-il"?: boolean;
  "emit-report"?: boolean;
  color?: boolean;
  report?: "json";
}

/**
 * Parse `argv` into a {@link ParseOutcome} (callback routing).
 *
 * @param argv The argument vector (already `hideBin`-stripped in `bin.ts`).
 * @returns The parse outcome — args, help/version text, or a usage failure.
 */
export function parseArgs(argv: string[]): ParseOutcome {
  let command: "build" | "check" = "build";
  let failMsg: string | undefined;

  const parser = yargs(argv)
    .scriptName("blendc")
    .usage("$0 [command] [files..] [options]")
    .command(
      ["$0 [files..]", "build [files..]"],
      "Compile and assemble to a platform binary",
      (y) => y.positional("files", { type: "string", array: true }),
      () => {
        command = "build";
      },
    )
    .command(
      "check [files..]",
      "Check for errors without building",
      (y) => y.positional("files", { type: "string", array: true }),
      () => {
        command = "check";
      },
    )
    // Config-backed flags — NO defaults (defaults belong to CONFIG_DEFAULTS).
    .option("platform", { type: "string", describe: "Target platform (e.g. c64)" })
    .option("config", { type: "string", describe: "Path to blend65.json" })
    .option("include", { type: "string", array: true, describe: "Source globs" })
    .option("exclude", { type: "string", array: true, describe: "Exclude globs" })
    .option("acme-path", { type: "string", describe: "Path to the ACME executable" })
    .option("out-dir", { type: "string", describe: "Output directory (default ./build/)" })
    .option("out-name", { type: "string", describe: "Output base name" })
    .option("max-errors", { type: "number", describe: "Max errors before stopping" })
    .option("warn-as-error", {
      type: "string",
      array: true,
      describe: "Promote warnings to errors (bare = all; repeat with codes)",
    })
    .option("suppress-warning", { type: "string", array: true, describe: "Suppress a warning code" })
    .option("diagnostics-format", {
      choices: ["terminal", "json"] as const,
      describe: "Diagnostic output format",
    })
    .option("optimize", { type: "boolean", describe: "Enable the peephole optimizer" })
    .option("quiet", { alias: "q", type: "boolean", describe: "Suppress the build summary" })
    .option("startup", {
      choices: ["auto", "terminating", "minimal", "bare"] as const,
      describe: "Startup shim variant",
    })
    // CLI-only flags.
    .option("emit-asm", { type: "boolean", describe: "Emit ACME assembly only" })
    .option("emit-il", { type: "boolean", describe: "Emit IL text only" })
    .option("emit-report", { type: "boolean", describe: "Also write the report JSON" })
    .option("color", { type: "boolean", describe: "Force color on/off" })
    .option("report", { choices: ["json"] as const, describe: "Machine-readable report format" })
    .strict()
    .help()
    .version(VERSION)
    .exitProcess(false)
    // Custom failure handler (R50): record the message; main.ts maps it to exit 2.
    .fail((msg, err) => {
      failMsg = msg ?? (err instanceof Error ? err.message : "invalid arguments");
    });

  let raw: RawArgv | undefined;
  let output: string | undefined;
  parser.parse(argv, (_err: unknown, parsed: unknown, out: string) => {
    raw = parsed as RawArgv;
    if (out) {
      output = out;
    }
  });

  if (failMsg !== undefined) {
    // Include yargs' usage text when it captured any.
    return { kind: "fail", text: output && output.length > 0 ? `${failMsg}\n${output}` : failMsg };
  }
  // --help/--version: yargs produced output and set the flag; nothing else to do.
  if (output !== undefined && (isHelp(raw) || isVersion(raw))) {
    return { kind: "help", text: output };
  }
  return { kind: "args", args: toParsedArgs(raw ?? {}, command) };
}

/** Whether the parse requested help. */
function isHelp(raw: RawArgv | undefined): boolean {
  return (raw as { help?: boolean } | undefined)?.help === true;
}

/** Whether the parse requested the version. */
function isVersion(raw: RawArgv | undefined): boolean {
  return (raw as { version?: boolean } | undefined)?.version === true;
}

/** Map the raw yargs argv to a clean {@link ParsedArgs}. */
function toParsedArgs(raw: RawArgv, command: "build" | "check"): ParsedArgs {
  const args: ParsedArgs = {
    command,
    files: (raw.files ?? []).map(String),
  };
  assign(args, "platform", raw.platform);
  assign(args, "config", raw.config);
  assign(args, "include", raw.include);
  assign(args, "exclude", raw.exclude);
  assign(args, "acmePath", raw["acme-path"]);
  assign(args, "outDir", raw["out-dir"]);
  assign(args, "outName", raw["out-name"]);
  assign(args, "maxErrors", raw["max-errors"]);
  assign(args, "warnAsError", coerceWarnAsError(raw["warn-as-error"]));
  assign(args, "suppressWarnings", toStringArray(raw["suppress-warning"]));
  assign(args, "diagnosticsFormat", raw["diagnostics-format"]);
  assign(args, "optimize", raw.optimize);
  assign(args, "quiet", raw.quiet);
  assign(args, "startup", raw.startup);
  assign(args, "emitAsm", raw["emit-asm"]);
  assign(args, "emitIl", raw["emit-il"]);
  assign(args, "emitReport", raw["emit-report"]);
  assign(args, "color", raw.color);
  assign(args, "report", raw.report);
  return args;
}

/** Assign `value` to `args[key]` only when defined (explicit-undefined discipline). */
function assign<K extends keyof ParsedArgs>(
  args: ParsedArgs,
  key: K,
  value: ParsedArgs[K] | undefined,
): void {
  if (value !== undefined) {
    args[key] = value;
  }
}

/**
 * Coerce the repeatable `--warn-as-error` occurrences: a bare flag
 * (empty-string occurrence) is blanket promotion (`true`); code-valued
 * occurrences accumulate into the code list.
 */
function coerceWarnAsError(raw: (string | number)[] | undefined): boolean | string[] | undefined {
  if (raw === undefined) {
    return undefined;
  }
  const values = raw.map(String);
  if (values.length === 0 || values.some((v) => v === "")) {
    return true;
  }
  return values;
}

/** Normalize a repeatable string option to a `string[]` (or undefined). */
function toStringArray(raw: (string | number)[] | undefined): string[] | undefined {
  return raw === undefined ? undefined : raw.map(String);
}
