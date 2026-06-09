/**
 * Specification tests for the four non-MVP built-in profiles — ST-PROF1..6
 * (07-testing-strategy.md, derived from 03-03 + the frozen appendices).
 *
 * Each profile is transcribed from its appendix §10 block; these tests pin the
 * headline distinguishing fields + the internal-consistency invariant for all
 * five plugins. Written BEFORE the profile modules; verified RED first.
 */

import { describe, expect, it } from "vitest";

import { c64Plugin } from "./c64.js";
import { c64uPlugin } from "./c64u.js";
import { cx16Plugin } from "./cx16.js";
import { a800xlPlugin } from "./a800xl.js";
import { a7800Plugin } from "./a7800.js";

describe("Built-in profiles (ST-PROF1..6)", () => {
  it("validateProfile() === [] for all five plugins — ST-PROF1", () => {
    for (const plugin of [
      c64Plugin,
      c64uPlugin,
      cx16Plugin,
      a800xlPlugin,
      a7800Plugin,
    ]) {
      expect(plugin.validateProfile()).toEqual([]);
    }
  });

  it("cx16.profile.cpu === 'wdc65c02' — ST-PROF2", () => {
    expect(cx16Plugin.profile.cpu).toBe("wdc65c02");
  });

  it("a7800.getMainTerminationPolicy().canReturn === false — ST-PROF3", () => {
    expect(a7800Plugin.getMainTerminationPolicy().canReturn).toBe(false);
  });

  it("a7800.profile.outputFormat === 'a78' — ST-PROF4", () => {
    expect(a7800Plugin.profile.outputFormat).toBe("a78");
  });

  it("a800xl.profile.defaultEncoding === 'atascii' — ST-PROF5", () => {
    expect(a800xlPlugin.profile.defaultEncoding).toBe("atascii");
  });

  it("c64u profile present + consistent — ST-PROF6", () => {
    expect(c64uPlugin.profile).toBeDefined();
    expect(c64uPlugin.validateProfile()).toEqual([]);
  });
});
