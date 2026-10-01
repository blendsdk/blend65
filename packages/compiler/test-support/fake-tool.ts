import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { chmod, copyFile, mkdtemp, writeFile } from "node:fs/promises";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
let windowsLauncher: Promise<string> | undefined;

/**
 * Compile one native Windows test launcher per worker and reuse its executable.
 * Direct process spawning cannot execute Unix shebang fixtures on Windows.
 * Compilation failures remain test failures; only the owned temporary launcher
 * directory is removed when this worker exits.
 */
async function launcher(): Promise<string> {
  windowsLauncher ??= (async () => {
    const root = await mkdtemp(join(tmpdir(), "blend65-windows-fake-launcher-"));
    const output = join(root, "fake-tool.exe");
    const source = fileURLToPath(new URL("./windows-fake-tool.cs", import.meta.url));
    const compiler = join(
      process.env.WINDIR ?? "C:\\Windows",
      "Microsoft.NET",
      "Framework64",
      "v4.0.30319",
      "csc.exe",
    );
    await execFileAsync(compiler, ["/nologo", "/target:exe", `/out:${output}`, source]);
    process.once("exit", () => {
      const resolved = dirname(output);
      const parent = tmpdir();
      if (
        resolved.startsWith(parent + sep) &&
        basename(resolved).startsWith("blend65-windows-fake-launcher-")
      )
        rmSync(resolved, { recursive: true, force: true });
    });
    return output;
  })();
  return windowsLauncher;
}

/** Install an executable fake external tool, preserving direct spawn on both hosts. */
export async function fakeTool(
  path: string,
  body: string,
  module: "commonjs" | "module" = "commonjs",
  ownsDescendants = true,
): Promise<string> {
  if (process.platform === "win32") {
    const executable = path.endsWith(".exe") ? path : `${path}.exe`;
    await copyFile(await launcher(), executable);
    await writeFile(`${executable}.${module === "module" ? "mjs" : "cjs"}`, body);
    await writeFile(`${executable}.node`, process.execPath);
    if (!ownsDescendants) await writeFile(`${executable}.nojob`, "");
    return executable;
  }
  await writeFile(path, `#!/usr/bin/env node\n${body}\n`, "utf8");
  await chmod(path, 0o755);
  return path;
}
