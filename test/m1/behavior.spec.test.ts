import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createSpriteBytes } from "../../examples/m1/qualification/sprite-recipe.js";
import {
  runBehaviorOracle,
  selectProjectileHit,
  type DeviceIntent,
  type OracleFrame,
  type OracleRun,
} from "../../examples/m1/qualification/oracle.js";

const NEUTRAL = 0x1f;
const LEFT = 0x1b;
const RIGHT = 0x17;
const FIRE = 0x0f;
const OPPOSING_DIRECTIONS = 0x13;
const UP_AND_DOWN = 0x1c;
const RECORD_NAMES = [
  "player",
  "invader-a-frame-1",
  "invader-a-frame-2",
  "invader-b-frame-1",
  "invader-b-frame-2",
  "projectile",
  "explosion-frame-1",
  "explosion-frame-2",
] as const;

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function expandRuns(runs: readonly (readonly [value: number, count: number])[]): readonly number[] {
  return runs.flatMap(([value, count]) => Array.from({ length: count }, () => value));
}

function intentCount(frame: OracleFrame, kind: DeviceIntent["kind"]): number {
  return frame.deviceIntents.filter((intent) => intent.kind === kind).length;
}

/** Check the fixed per-update device protocol shared by every published frame. */
function expectPublishedFrame(frame: OracleFrame, sample: number): void {
  expect(frame.sample).toBe(sample);
  expect(frame.deviceIntents[0]).toEqual({ kind: "wait-next-frame" });
  expect(frame.deviceIntents[1]).toEqual({ kind: "read-joystick-2", value: sample });
  expect(intentCount(frame, "wait-next-frame")).toBe(1);
  expect(intentCount(frame, "read-joystick-2")).toBe(1);
  expect(intentCount(frame, "publish-sprite")).toBe(8);
  expect(intentCount(frame, "publish-border")).toBe(1);
}

/** Expand the independently fixed input trace that wins and requests terminal exit. */
function winInput(): readonly number[] {
  return expandRuns([
    [LEFT, 8],
    [RIGHT, 1],
    [FIRE, 1],
    [NEUTRAL, 6],
    [RIGHT, 1],
    [NEUTRAL, 7],
    [RIGHT, 1],
    [NEUTRAL, 7],
    [RIGHT, 1],
    [NEUTRAL, 4],
    [LEFT, 35],
    [FIRE, 1],
    [NEUTRAL, 7],
    [RIGHT, 1],
    [NEUTRAL, 7],
    [RIGHT, 1],
    [NEUTRAL, 7],
    [RIGHT, 1],
    [NEUTRAL, 3],
    [LEFT, 36],
    [RIGHT, 1],
    [FIRE, 1],
    [NEUTRAL, 6],
    [RIGHT, 1],
    [NEUTRAL, 7],
    [RIGHT, 1],
    [NEUTRAL, 7],
    [RIGHT, 1],
    [NEUTRAL, 4],
    [RIGHT, 116],
    [FIRE, 1],
    [NEUTRAL, 6],
    [LEFT, 1],
    [NEUTRAL, 7],
    [LEFT, 1],
    [NEUTRAL, 7],
    [LEFT, 1],
    [NEUTRAL, 2],
    [RIGHT, 36],
    [FIRE, 1],
    [LEFT, 1],
    [NEUTRAL, 7],
    [LEFT, 1],
    [NEUTRAL, 7],
    [LEFT, 1],
    [NEUTRAL, 7],
    [LEFT, 1],
    [RIGHT, 36],
    [FIRE, 1],
    [NEUTRAL, 2],
    [LEFT, 1],
    [NEUTRAL, 7],
    [LEFT, 1],
    [NEUTRAL, 7],
    [LEFT, 1],
    [NEUTRAL, 7],
    [LEFT, 1],
    [NEUTRAL, 7],
    [FIRE, 1],
  ]);
}

function frame(run: OracleRun, index: number): OracleFrame {
  const found = run.frames[index];
  expect(found, `Missing frame ${index}`).toBeDefined();
  if (found === undefined) throw new Error(`Missing frame ${index}`);
  return found;
}

describe("deterministic sprite asset", () => {
  // The source recipe and checked-in bytes agree exactly and retain a reviewable origin record.
  it("creates eight ordered distinct nonblank sprite records with recorded provenance", async () => {
    const first = Uint8Array.from(createSpriteBytes());
    const second = Uint8Array.from(createSpriteBytes());
    const assetPath = fileURLToPath(
      new URL("../../examples/m1/assets/sprites.bin", import.meta.url),
    );
    const readmePath = fileURLToPath(
      new URL("../../examples/m1/qualification/README.md", import.meta.url),
    );
    const checkedIn = await readFile(assetPath);
    const readme = await readFile(readmePath, "utf8");

    expect(first).toHaveLength(512);
    expect(second).toEqual(first);
    expect([...checkedIn]).toEqual([...first]);
    const records = RECORD_NAMES.map((_, index) => first.slice(index * 64, (index + 1) * 64));
    expect(records.every((record) => record.some((byte) => byte !== 0))).toBe(true);
    expect(new Set(records.map((record) => Buffer.from(record).toString("hex"))).size).toBe(8);
    expect(readme).toContain(sha256(first));
    expect(readme).toMatch(/original(?:ly authored)? art|original artwork/iu);
    expect(readme).toMatch(/retain/iu);
    let prior = -1;
    for (const name of RECORD_NAMES) {
      const position = readme.indexOf(name);
      expect(position, `README is missing ordered record ${name}`).toBeGreaterThan(prior);
      prior = position;
    }
  });
});

describe("complete game behavior", () => {
  // This fixed input is a complete pure trace from startup through all kills and return.
  it("publishes every frame of the fixed win trace in exact state order", () => {
    const input = winInput();
    const run = runBehaviorOracle(input);

    expect(run.outcome).toBe("won");
    expect(run.returnedToBasic).toBe(true);
    expect(run.frames).toHaveLength(input.length);
    run.frames.forEach((current, index) => {
      expect(current.index).toBe(index);
      expectPublishedFrame(current, input[index] ?? NEUTRAL);
      expect(current.state.player.y).toBe(220);
      expect(current.state.player.x).toBeGreaterThanOrEqual(48);
      expect(current.state.player.x).toBeLessThanOrEqual(296);
      expect(current.state.invaders.map(({ index: spriteIndex }) => spriteIndex)).toEqual([
        1, 2, 3, 4, 5, 6,
      ]);
    });
    expect(frame(run, 0).state).toMatchObject({
      phase: "playing",
      player: { x: 159, y: 220, color: 3, frozen: false },
      formation: { direction: "right", frozen: false },
      invaders: [
        { index: 1, x: 72, y: 72, alive: true, color: 5, art: "invader-a-frame-1" },
        { index: 2, x: 112, y: 72, alive: true, color: 5, art: "invader-b-frame-1" },
        { index: 3, x: 152, y: 72, alive: true, color: 5, art: "invader-a-frame-1" },
        { index: 4, x: 192, y: 72, alive: true, color: 5, art: "invader-b-frame-1" },
        { index: 5, x: 232, y: 72, alive: true, color: 5, art: "invader-a-frame-1" },
        { index: 6, x: 272, y: 72, alive: true, color: 5, art: "invader-b-frame-1" },
      ],
      slot7: { kind: "idle" },
      background: 0,
      border: 0,
    });
    expect(frame(run, 7).state.invaders).toEqual([
      { index: 1, x: 73, y: 72, alive: true, color: 5, art: "invader-a-frame-2" },
      { index: 2, x: 113, y: 72, alive: true, color: 5, art: "invader-b-frame-2" },
      { index: 3, x: 153, y: 72, alive: true, color: 5, art: "invader-a-frame-2" },
      { index: 4, x: 193, y: 72, alive: true, color: 5, art: "invader-b-frame-2" },
      { index: 5, x: 233, y: 72, alive: true, color: 5, art: "invader-a-frame-2" },
      { index: 6, x: 273, y: 72, alive: true, color: 5, art: "invader-b-frame-2" },
    ]);
    expect(frame(run, 9).state.slot7).toEqual({
      kind: "projectile",
      x: 153,
      y: 199,
      color: 1,
    });
    expect(frame(run, 10).state.slot7).toEqual({
      kind: "projectile",
      x: 153,
      y: 195,
      color: 1,
    });
    expect(
      frame(run, 9).deviceIntents.filter((intent) => intent.kind === "publish-sprite"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          index: 0,
          enabled: true,
          highResolution: true,
          expanded: false,
          color: 3,
        }),
        expect.objectContaining({
          index: 7,
          enabled: true,
          highResolution: true,
          expanded: false,
          color: 1,
        }),
      ]),
    );

    expect(
      run.frames.flatMap((current) =>
        current.events
          .filter((event) => event.kind === "invader-hit")
          .map((event) => ({
            frame: current.index,
            invader: event.invader,
            x: event.x,
            y: event.y,
          })),
      ),
    ).toEqual([
      { frame: 36, invader: 3, x: 156, y: 72 },
      { frame: 99, invader: 2, x: 124, y: 72 },
      { frame: 164, invader: 1, x: 92, y: 72 },
      { frame: 306, invader: 4, x: 205, y: 80 },
      { frame: 368, invader: 5, x: 237, y: 80 },
      { frame: 430, invader: 6, x: 270, y: 80 },
    ]);
    expect(frame(run, 430).state).toMatchObject({
      phase: "won",
      player: { frozen: true },
      slot7: { kind: "explosion", frame: 1, color: 8 },
      border: 5,
    });
    expect(frame(run, 431).state.slot7).toMatchObject({ kind: "explosion", frame: 2 });
    expect(frame(run, 432).state.slot7).toEqual({ kind: "idle" });
    expect(frame(run, 440).state).toMatchObject({ phase: "exited", slot7: { kind: "idle" } });
    expect(frame(run, 440).deviceIntents.slice(-2)).toEqual([
      { kind: "restore-owned-state" },
      { kind: "return-to-basic" },
    ]);
  });

  // Neutral input drives the formation to the player line and exits only on a fresh press.
  it("freezes on loss and restores state after release then press", () => {
    const input = [...Array.from({ length: 6208 }, () => NEUTRAL), FIRE];
    const run = runBehaviorOracle(input);

    expect(run.outcome).toBe("lost");
    expect(run.returnedToBasic).toBe(true);
    expect(frame(run, 6207).state).toMatchObject({
      phase: "lost",
      player: { x: 160, y: 220, frozen: true },
      formation: { frozen: true },
      border: 2,
    });
    expect(frame(run, 6208).state.phase).toBe("exited");
    expect(frame(run, 6208).deviceIntents.slice(-2)).toEqual([
      { kind: "restore-owned-state" },
      { kind: "return-to-basic" },
    ]);
  });

  // Simultaneous directions and vertical bits do not move the player.
  it("ignores opposing horizontal directions and vertical joystick bits", () => {
    const run = runBehaviorOracle([
      ...Array.from({ length: 16 }, () => OPPOSING_DIRECTIONS),
      ...Array.from({ length: 16 }, () => UP_AND_DOWN),
    ]);

    expect(run.frames.every((current) => current.state.player.x === 160)).toBe(true);
  });

  // A held fire level has one rising edge and cannot allocate a second slot-seven owner.
  it("limits held fire to one projectile and completes both explosion frames", () => {
    const input = Array.from({ length: 80 }, () => FIRE);
    const run = runBehaviorOracle(input);

    expect(
      run.frames.flatMap((current) =>
        current.events.filter((event) => event.kind === "projectile-spawn"),
      ),
    ).toHaveLength(1);
    expect(
      run.frames.flatMap((current) =>
        current.events.filter((event) => event.kind === "invader-hit"),
      ),
    ).toHaveLength(1);
    expect(frame(run, 27).state.slot7).toMatchObject({ kind: "explosion", frame: 1 });
    expect(frame(run, 28).state.slot7).toMatchObject({ kind: "explosion", frame: 2 });
    expect(frame(run, 29).state.slot7).toEqual({ kind: "idle" });
    expect(run.frames.slice(29).every((current) => current.state.slot7.kind === "idle")).toBe(true);
  });

  // When rectangles overlap together, collision ownership is deterministic by array order.
  it("selects the lowest live invader index for a simultaneous projectile hit", () => {
    const projectile = { x: 100, y: 80 };
    const simultaneous = [
      { x: 111, y: 70, alive: true },
      { x: 100, y: 80, alive: true },
      { x: 112, y: 87, alive: true },
    ];

    expect(selectProjectileHit(projectile, simultaneous)).toBe(0);
    expect(
      selectProjectileHit(projectile, [
        { ...simultaneous[0], alive: false },
        ...simultaneous.slice(1),
      ]),
    ).toBe(1);
    expect(
      selectProjectileHit(
        projectile,
        simultaneous.map((invader) => ({ ...invader, alive: false })),
      ),
    ).toBeNull();
  });
});
