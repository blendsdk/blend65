import { describe, expect, it } from "vitest";
import { hostObservations } from "./snapshot.js";

describe("bounded runtime identity policy", () => {
  // Classified identities are not execution evidence for a different native host.
  it.each(["linux", "win32"])(
    "should classify Node 22 %s/x64 as production without warnings",
    (os) => {
      expect(hostObservations(22, os, "x64")).toEqual([]);
    },
  );

  // Admitted 64-bit combinations outside the production pair remain explicitly best-effort.
  it.each([
    ["darwin", "x64"],
    ["linux", "arm64"],
    ["linux", "ppc64"],
    ["linux", "s390x"],
    ["linux", "riscv64"],
    ["linux", "loong64"],
  ])("should observe Node 22 %s/%s as best-effort", (os, arch) => {
    const observations = hostObservations(22, os, arch);
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({
      code: "PROJECT_HOST_BEST_EFFORT",
      severity: "warning",
      message: `Project host is best-effort: 22/${os}/${arch}`,
    });
  });

  // Unsupported runtime majors and architectures are failures, never downgraded warnings.
  it.each([
    [20, "linux", "x64"],
    [24, "linux", "x64"],
    [22, "linux", "ia32"],
    [22, "linux", "unknown"],
  ] as const)("should reject unsupported host %s/%s/%s", (major, os, arch) => {
    let failure: unknown;
    try {
      hostObservations(major, os, arch);
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({
      diagnostics: [
        {
          code: "PROJECT_HOST_UNSUPPORTED",
          severity: "error",
          message: `Unsupported project host: ${major}/${os}/${arch}`,
        },
      ],
    });
  });
});
