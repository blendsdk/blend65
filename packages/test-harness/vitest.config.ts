import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Discover both the spec tier (*.spec.test.ts) and the logic tier
    // (*.impl.test.ts). RD-12 introduces the first test-harness *.impl.test.ts
    // (the VICE codec / PNG tests), so the glob is widened here, mirroring the
    // compiler/codegen packages. The brace pattern is disjoint by filename suffix,
    // so spec tests are not double-counted.
    include: ["src/**/*.{spec,impl}.test.ts"],
    environment: "node",
    passWithNoTests: false,
    // Run test FILES sequentially: the Local emulator suites each spawn a real
    // VICE `x64sc`, and several full C64 emulators running concurrently contend
    // (a VICE can crash → "monitor socket closed"). Sequential files keep at most
    // one VICE alive at a time. In CI (no VICE) these suites skip, so the only
    // cost is a slightly slower CI-tier run of small files. (AR-H6 lifecycle.)
    fileParallelism: false,
  },
});
