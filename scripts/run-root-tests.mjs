import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const vitest = fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url));
const foundation = process.env.BLEND65_FOUNDATION_CI === "1" || process.platform === "win32";
const hostOnly = process.argv.includes("--host");
const configs = foundation
  ? ["vitest.config.ts"]
  : hostOnly
    ? ["vitest.host.config.ts"]
    : ["vitest.host.config.ts", "vitest.vice.config.ts"];

for (const config of configs) {
  process.stdout.write(`\n▶ ${config}\n`);
  const result = spawnSync(
    process.execPath,
    [vitest, "run", "--config", config, "--reporter=dot", "--silent"],
    { stdio: "inherit", env: process.env },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
}
