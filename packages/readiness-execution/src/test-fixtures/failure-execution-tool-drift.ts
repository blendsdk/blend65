import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";

/** Scoped executable-version drift installed ahead of the authenticated tool on PATH. */
export interface FailureExecutionToolDriftV1 {
  cleanup(): void;
}

/**
 * Installs one exact executable shim that reports an incompatible version.
 * The returned cleanup restores the original process environment and removes only its owned root.
 */
export function installFailureExecutionToolVersionDriftV1(
  executableName: "acme" | "x64sc",
): FailureExecutionToolDriftV1 {
  const directory = mkdtempSync(join(tmpdir(), "blend65-tool-drift-"));
  const executable = join(directory, executableName);
  const originalPath = process.env.PATH;
  writeFileSync(
    executable,
    `#!${process.execPath}\nprocess.stdout.write("${executableName} incompatible 99.99\\n");\n`,
    { encoding: "utf8", mode: 0o700 },
  );
  chmodSync(executable, 0o700);
  process.env.PATH = `${directory}${delimiter}${originalPath ?? ""}`;
  let closed = false;
  return {
    cleanup() {
      if (closed) return;
      closed = true;
      if (originalPath === undefined) delete process.env.PATH;
      else process.env.PATH = originalPath;
      rmSync(directory, { recursive: true, force: false });
    },
  };
}
