import { access } from "node:fs/promises";
import { join } from "node:path";
import { buildProject, checkProject } from "@blend65/compiler";
import { describe, expect, it } from "vitest";
import {
  profileRecord,
  profileRecords,
  readProfileArtifacts,
  withProfileProject,
} from "./profile-fixture.js";

const PROFILE = "c64-pal-prg-kernal-6581";

/** One opaque class carries all three unproved external obligations of a cooperative NMI route. */
const EXTERNAL_EFFECT =
  "external-nmi-aggregate-stack+retained-nmi-firmware-completion+external-nmi-finite-deadline";

/** A balanced install/restore of an empty handler, through whichever installer is named. */
function balanced(installer: "setNMI" | "setNMIExclusive"): string {
  return `module Game;
import { ${installer}, restoreNMI } from c64.system;
interrupt function handler(): void {}
function main(): void { ${installer}(&handler); restoreNMI(); }
`;
}

/** What the two installers must agree on for an empty handler, gathered from one build. */
interface Admission {
  readonly checked: string;
  readonly built: string;
  readonly artifactPresent: boolean;
  readonly handlerPrivateHomes: readonly unknown[];
  readonly runtimeMemorySafety: unknown;
  readonly externalEffects: readonly unknown[];
}

/** Build one balanced empty handler and collect the facts its route admission rests on. */
async function admit(installer: "setNMI" | "setNMIExclusive"): Promise<Admission> {
  const source = balanced(installer);
  return await withProfileProject(source, PROFILE, async (project) => {
    const checked = await checkProject({ project });
    const built = await buildProject({ project, optimization: "none" });
    if (built.kind !== "success")
      return {
        checked: checked.kind,
        built: `${built.kind}: ${JSON.stringify(built.diagnostics)}`,
        artifactPresent: false,
        handlerPrivateHomes: [],
        runtimeMemorySafety: null,
        externalEffects: [],
      };
    const artifacts = await readProfileArtifacts(built);
    const artifactPath = join(built.generation.directory, built.generation.primaryArtifact);
    const artifactPresent = await access(artifactPath).then(
      () => true,
      () => false,
    );
    // An invocation-private home owned by the handler is what a cooperative route cannot provide.
    // Mainline's own predecessor links are owned by `main` and are not private to an invocation.
    const privateKinds = new Set(["sfa", "zeroPage", "scratch"]);
    const handlerPrivateHomes = profileRecords(artifacts.memory.intervals).filter((interval) => {
      if (!privateKinds.has(String(interval.kind))) return false;
      const owner = profileRecord(interval.owner);
      return typeof owner.id === "string" && owner.id.includes("Game.handler");
    });
    return {
      checked: checked.kind,
      built: built.kind,
      artifactPresent,
      handlerPrivateHomes,
      runtimeMemorySafety: artifacts.memory.runtimeMemorySafety,
      externalEffects: profileRecords(artifacts.memory.unboundedEffects).map(
        (effect) => effect.effectClass,
      ),
    };
  });
}

describe("a balanced empty handler on either cooperative NMI installer", () => {
  it("should check, build and publish an artifact on both routes alike", async () => {
    // The exclusive installer is the subject. It is asserted beside the chained one rather than
    // alone, because the claim worth pinning is not that it happens to succeed but that an empty
    // handler is admitted for the same reason on both: there is nothing for it to retain.
    const [exclusive, chained] = await Promise.all([admit("setNMIExclusive"), admit("setNMI")]);

    expect({ exclusive, chained }).toEqual({
      exclusive: {
        checked: "success",
        built: "success",
        artifactPresent: true,
        handlerPrivateHomes: [],
        runtimeMemorySafety: "unproven",
        externalEffects: [EXTERNAL_EFFECT],
      },
      chained: {
        checked: "success",
        built: "success",
        artifactPresent: true,
        handlerPrivateHomes: [],
        runtimeMemorySafety: "unproven",
        externalEffects: [EXTERNAL_EFFECT],
      },
    });
  }, 180_000);

  it("should keep admission separate from any ownership promise", async () => {
    // Admitting the route says the handler needs no private storage. It says nothing about who
    // owns the chip or completes the firmware path, and the single retained external-effect class
    // is where that distinction is recorded. Asserted on its own so a future change that admitted
    // the route by quietly discharging those obligations could not pass unnoticed.
    const exclusive = await admit("setNMIExclusive");

    expect(exclusive.runtimeMemorySafety, "route admission was read as proved memory safety").toBe(
      "unproven",
    );
    expect(exclusive.externalEffects, "the unproved external obligations were dropped").toEqual([
      EXTERNAL_EFFECT,
    ]);
  }, 180_000);
});
