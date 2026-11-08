import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repository = process.cwd();
const producer = JSON.parse(
  readFileSync(join(repository, "test/rd06/fixtures/producer-evidence.json"), "utf8"),
) as {
  producerRoot: string;
  retention: { disposition: string };
  manuals: { path: string; sha256: string }[];
  fixtures: { family: string; path: string; sha256: string }[];
};

describe("producer evidence honesty", () => {
  // The real vendor examples are referenced but never committed.
  it("should keep producer files local-only and their hashes pinned", () => {
    expect(producer.retention.disposition).toBe("local-only");
    expect(producer.manuals).toHaveLength(2);
    for (const manual of producer.manuals) {
      expect(manual.path).toMatch(/^SpritePad|^CharPad/u);
      expect(manual.sha256).toMatch(/^[0-9a-f]{64}$/u);
    }
    for (const fixture of producer.fixtures) {
      expect(fixture.path).toMatch(/^(SpritePad|CharPad) C64 3\.80 Pro\//u);
      expect(fixture.sha256).toMatch(/^[0-9a-f]{64}$/u);
    }
    for (const family of ["spritepad", "charpad"]) {
      expect(existsSync(join(repository, "test/rd06/fixtures/public", family))).toBe(false);
    }
  });

  // The status text names the exact evidence boundary and never claims hardware proof.
  it("should report VICE-verified / hardware-unverified", () => {
    const status = readFileSync(
      join(
        repository,
        "codeops/features/blend65-v4/plans/rd-06-native-assets/08-host-observations.md",
      ),
      "utf8",
    );
    expect(status).toContain("VICE-verified / hardware-unverified");
    expect(status).toContain("Local producer examples");
    expect(status).toMatch(/not committed/iu);
  });

  // The public manifest remains synthetic and redistributable.
  it("should keep committed public fixtures synthetic", () => {
    const manifest = JSON.parse(
      readFileSync(join(repository, "test/rd06/fixtures/manifest.json"), "utf8"),
    ) as {
      fixtures: { provenance: { kind: string }; license: { disposition: string } }[];
    };
    expect(manifest.fixtures.length).toBeGreaterThan(0);
    for (const fixture of manifest.fixtures) {
      expect(fixture.provenance.kind).toBe("constructed");
      expect(fixture.license.disposition).toBe("redistributable");
    }
  });
});
