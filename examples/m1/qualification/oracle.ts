/** One observable platform action emitted in exact frame order. */
export type DeviceIntent =
  | { readonly kind: "wait-next-frame" }
  | { readonly kind: "read-joystick-2"; readonly value: number }
  | {
      readonly kind: "publish-sprite";
      readonly index: number;
      readonly enabled: boolean;
      readonly x: number;
      readonly y: number;
      readonly art: string;
      readonly color: number;
      readonly highResolution: true;
      readonly expanded: false;
    }
  | { readonly kind: "set-sprite-enabled"; readonly index: number; readonly enabled: boolean }
  | {
      readonly kind: "set-sprite-position";
      readonly index: number;
      readonly x: number;
      readonly y: number;
    }
  | {
      readonly kind: "set-sprite-pointer";
      readonly index: number;
      readonly block: number;
      readonly art: string;
    }
  | { readonly kind: "set-sprite-color"; readonly index: number; readonly color: number }
  | { readonly kind: "publish-border"; readonly color: number }
  | { readonly kind: "restore-owned-state" }
  | { readonly kind: "return-to-basic" };

/** One state transition recorded by the independent model. */
export type OracleEvent =
  | { readonly kind: "projectile-spawn"; readonly x: number; readonly y: number }
  | {
      readonly kind: "invader-hit";
      readonly invader: number;
      readonly x: number;
      readonly y: number;
    };

interface PlayerState {
  readonly x: number;
  readonly y: 220;
  readonly color: 3;
  readonly frozen: boolean;
}

interface InvaderState {
  readonly index: number;
  readonly x: number;
  readonly y: number;
  readonly alive: boolean;
  readonly color: 5;
  readonly art: string;
}

type SlotSevenState =
  | { readonly kind: "idle" }
  | { readonly kind: "projectile"; readonly x: number; readonly y: number; readonly color: 1 }
  | {
      readonly kind: "explosion";
      readonly x: number;
      readonly y: number;
      readonly frame: 1 | 2;
      readonly color: 8;
    };

interface GameState {
  readonly phase: "playing" | "won" | "lost" | "exited";
  readonly player: PlayerState;
  readonly formation: { readonly direction: "left" | "right"; readonly frozen: boolean };
  readonly invaders: readonly InvaderState[];
  readonly slot7: SlotSevenState;
  readonly background: 0;
  readonly border: 0 | 2 | 5;
}

/** Complete state and device intent after one PAL update. */
export interface OracleFrame {
  /** Zero-based frame number. */
  readonly index: number;
  /** Exact active-low joystick sample consumed by this update. */
  readonly sample: number;
  /** Immutable post-update game state. */
  readonly state: GameState;
  /** Ordered platform actions for the update. */
  readonly deviceIntents: readonly DeviceIntent[];
  /** Logical transitions useful to independent assertions. */
  readonly events: readonly OracleEvent[];
}

/** Complete result of replaying one fixed joystick trace. */
export interface OracleRun {
  /** Terminal game result, or playing when the trace ends early. */
  readonly outcome: "playing" | "won" | "lost";
  /** Whether the trace reached cooperative restoration and return. */
  readonly returnedToBasic: boolean;
  /** Every frame in input order. */
  readonly frames: readonly OracleFrame[];
}

interface MutableInvader {
  readonly index: number;
  x: number;
  y: number;
  alive: boolean;
  readonly design: "a" | "b";
}

interface MutableGame {
  phase: "playing" | "won" | "lost" | "exited";
  outcome: "playing" | "won" | "lost";
  playerX: number;
  direction: "left" | "right";
  formationCounter: number;
  animationFrame: 1 | 2;
  readonly invaders: MutableInvader[];
  slot7:
    | { kind: "idle" }
    | { kind: "projectile"; x: number; y: number }
    | { kind: "explosion"; x: number; y: number; frame: 1 | 2 };
  previousFire: boolean;
  terminalSawRelease: boolean;
  returnedToBasic: boolean;
}

const JOYSTICK_LEFT = 0x04;
const JOYSTICK_RIGHT = 0x08;
const JOYSTICK_FIRE = 0x10;

/** Inclusive rectangle overlap used by projectile collision. */
function overlaps(
  left: {
    readonly minimumX: number;
    readonly maximumX: number;
    readonly minimumY: number;
    readonly maximumY: number;
  },
  right: {
    readonly minimumX: number;
    readonly maximumX: number;
    readonly minimumY: number;
    readonly maximumY: number;
  },
): boolean {
  return (
    left.minimumX <= right.maximumX &&
    left.maximumX >= right.minimumX &&
    left.minimumY <= right.maximumY &&
    left.maximumY >= right.minimumY
  );
}

/**
 * Select the lowest array index hit by the projectile's two-by-eight rectangle.
 * This small pure seam proves deterministic collision priority even for states unreachable from M1's fixed spacing.
 */
export function selectProjectileHit(
  projectile: { readonly x: number; readonly y: number },
  invaders: readonly { readonly x: number; readonly y: number; readonly alive: boolean }[],
): number | null {
  const projectileBounds = {
    minimumX: projectile.x + 11,
    maximumX: projectile.x + 12,
    minimumY: projectile.y,
    maximumY: projectile.y + 7,
  };
  for (let index = 0; index < invaders.length; index++) {
    const invader = invaders[index]!;
    if (
      invader.alive &&
      overlaps(projectileBounds, {
        minimumX: invader.x,
        maximumX: invader.x + 23,
        minimumY: invader.y,
        maximumY: invader.y + 20,
      })
    ) {
      return index;
    }
  }
  return null;
}

/** Advance one projectile or the two visible explosion frames. */
function advanceSlot(game: MutableGame): void {
  if (game.slot7.kind === "projectile") {
    game.slot7.y -= 4;
    if (game.slot7.y < 50) game.slot7 = { kind: "idle" };
  } else if (game.slot7.kind === "explosion") {
    game.slot7 = game.slot7.frame === 1 ? { ...game.slot7, frame: 2 } : { kind: "idle" };
  }
}

/** Move or descend the live formation on every eighth playing update. */
function advanceFormation(game: MutableGame): void {
  game.formationCounter++;
  if (game.formationCounter < 8) return;
  game.formationCounter = 0;
  const live = game.invaders.filter(({ alive }) => alive);
  if (live.length === 0) return;
  const left = Math.min(...live.map(({ x }) => x));
  const right = Math.max(...live.map(({ x }) => x + 23));
  if (game.direction === "right" && right + 1 > 320) {
    game.direction = "left";
    live.forEach((invader) => (invader.y += 8));
  } else if (game.direction === "left" && left - 1 < 48) {
    game.direction = "right";
    live.forEach((invader) => (invader.y += 8));
  } else {
    const delta = game.direction === "right" ? 1 : -1;
    live.forEach((invader) => (invader.x += delta));
  }
  game.animationFrame = game.animationFrame === 1 ? 2 : 1;
}

/** Resolve at most one hit and make its first explosion frame immediately visible. */
function resolveHit(game: MutableGame, events: OracleEvent[]): void {
  if (game.slot7.kind !== "projectile") return;
  const hit = selectProjectileHit(game.slot7, game.invaders);
  if (hit === null) return;
  const invader = game.invaders[hit]!;
  invader.alive = false;
  game.slot7 = { kind: "explosion", x: invader.x, y: invader.y, frame: 1 };
  events.push(
    Object.freeze({ kind: "invader-hit", invader: invader.index, x: invader.x, y: invader.y }),
  );
}

/** Return the currently selected immutable art record name. */
function invaderArt(invader: MutableInvader, frame: 1 | 2): string {
  return `invader-${invader.design}-frame-${frame}`;
}

/** Freeze a complete post-update state snapshot. */
function snapshot(game: MutableGame): GameState {
  const frozen = game.phase !== "playing";
  const slot7: SlotSevenState =
    game.slot7.kind === "idle"
      ? Object.freeze({ kind: "idle" })
      : game.slot7.kind === "projectile"
        ? Object.freeze({ kind: "projectile", x: game.slot7.x, y: game.slot7.y, color: 1 })
        : Object.freeze({
            kind: "explosion",
            x: game.slot7.x,
            y: game.slot7.y,
            frame: game.slot7.frame,
            color: 8,
          });
  return Object.freeze({
    phase: game.phase,
    player: Object.freeze({ x: game.playerX, y: 220, color: 3, frozen }),
    formation: Object.freeze({ direction: game.direction, frozen }),
    invaders: Object.freeze(
      game.invaders.map((invader) =>
        Object.freeze({
          index: invader.index,
          x: invader.x,
          y: invader.y,
          alive: invader.alive,
          color: 5,
          art: invaderArt(invader, game.animationFrame),
        }),
      ),
    ),
    slot7,
    background: 0,
    border: game.outcome === "won" ? 5 : game.outcome === "lost" ? 2 : 0,
  });
}

/** Return the raw asset record selected by one symbolic sprite-art name. */
function spriteBlock(art: string): number {
  const blocks: Readonly<Record<string, number>> = {
    player: 0,
    "invader-a-frame-1": 1,
    "invader-a-frame-2": 2,
    "invader-b-frame-1": 3,
    "invader-b-frame-2": 4,
    projectile: 5,
    "explosion-frame-1": 6,
    "explosion-frame-2": 7,
  };
  const block = blocks[art];
  if (block === undefined) throw new Error(`Unknown sprite art '${art}'`);
  return block;
}

interface SpritePublication {
  readonly index: number;
  readonly enabled: boolean;
  readonly x: number;
  readonly y: number;
  readonly art: string;
  readonly color: number;
}

/** Append the exact named VIC operations for one logical sprite publication. */
function publishSprite(intents: DeviceIntent[], sprite: SpritePublication): void {
  intents.push(
    Object.freeze({
      kind: "publish-sprite",
      ...sprite,
      highResolution: true,
      expanded: false,
    }),
    Object.freeze({ kind: "set-sprite-enabled", index: sprite.index, enabled: sprite.enabled }),
    Object.freeze({
      kind: "set-sprite-position",
      index: sprite.index,
      x: sprite.x,
      y: sprite.y,
    }),
    Object.freeze({
      kind: "set-sprite-pointer",
      index: sprite.index,
      block: spriteBlock(sprite.art),
      art: sprite.art,
    }),
    Object.freeze({ kind: "set-sprite-color", index: sprite.index, color: sprite.color }),
  );
}

/** Publish all eight hardware sprite slots and the result border exactly once. */
function publish(state: GameState): readonly DeviceIntent[] {
  const intents: DeviceIntent[] = [];
  publishSprite(intents, {
    index: 0,
    enabled: true,
    x: state.player.x,
    y: state.player.y,
    art: "player",
    color: 3,
  });
  for (const invader of state.invaders) {
    publishSprite(intents, {
      index: invader.index,
      enabled: invader.alive,
      x: invader.x,
      y: invader.y,
      art: invader.art,
      color: 5,
    });
  }
  const slot = state.slot7;
  publishSprite(intents, {
    index: 7,
    enabled: slot.kind !== "idle",
    x: slot.kind === "idle" ? 0 : slot.x,
    y: slot.kind === "idle" ? 0 : slot.y,
    art:
      slot.kind === "projectile"
        ? "projectile"
        : slot.kind === "explosion"
          ? `explosion-frame-${slot.frame}`
          : "projectile",
    color: slot.kind === "explosion" ? 8 : 1,
  });
  intents.push(Object.freeze({ kind: "publish-border", color: state.border }));
  return Object.freeze(intents);
}

/** Create the exact initial state from the frozen M1 behavior table. */
function initialGame(): MutableGame {
  return {
    phase: "playing",
    outcome: "playing",
    playerX: 160,
    direction: "right",
    formationCounter: 0,
    animationFrame: 1,
    invaders: [72, 112, 152, 192, 232, 272].map((x, index) => ({
      index: index + 1,
      x,
      y: 72,
      alive: true,
      design: index % 2 === 0 ? "a" : "b",
    })),
    slot7: { kind: "idle" },
    previousFire: false,
    terminalSawRelease: false,
    returnedToBasic: false,
  };
}

/**
 * Replay an exact active-low joystick-port-2 sequence through the pure M1 behavior model.
 * The model performs no compiler, emulator, filesystem or generated-code access.
 */
export function runBehaviorOracle(input: readonly number[]): OracleRun {
  const game = initialGame();
  const frames: OracleFrame[] = [];
  input.forEach((sample, index) => {
    if (!Number.isInteger(sample) || sample < 0 || sample > 0x1f) {
      throw new RangeError(`Joystick sample ${index} must be an integer from 0 to 31`);
    }
    const fire = (sample & JOYSTICK_FIRE) === 0;
    const fireEdge = fire && !game.previousFire;
    const intents: DeviceIntent[] = [
      Object.freeze({ kind: "wait-next-frame" }),
      Object.freeze({ kind: "read-joystick-2", value: sample }),
    ];
    const events: OracleEvent[] = [];

    if (game.phase === "playing") {
      const left = (sample & JOYSTICK_LEFT) === 0;
      const right = (sample & JOYSTICK_RIGHT) === 0;
      if (left !== right)
        game.playerX = Math.max(48, Math.min(296, game.playerX + (right ? 1 : -1)));
      advanceSlot(game);
      advanceFormation(game);
      resolveHit(game, events);
      if (game.slot7.kind === "idle" && fireEdge) {
        game.slot7 = { kind: "projectile", x: game.playerX, y: 199 };
        events.push(Object.freeze({ kind: "projectile-spawn", x: game.playerX, y: 199 }));
      }
      if (game.invaders.every(({ alive }) => !alive)) {
        game.phase = "won";
        game.outcome = "won";
        game.terminalSawRelease = !fire;
      } else if (game.invaders.some(({ alive, y }) => alive && y + 20 >= 220)) {
        game.phase = "lost";
        game.outcome = "lost";
        game.terminalSawRelease = !fire;
      }
    } else if (game.phase === "won" || game.phase === "lost") {
      advanceSlot(game);
      if (!fire) game.terminalSawRelease = true;
      if (game.slot7.kind === "idle" && game.terminalSawRelease && fireEdge) {
        game.phase = "exited";
        game.returnedToBasic = true;
      }
    }

    const state = snapshot(game);
    intents.push(...publish(state));
    if (game.returnedToBasic) {
      intents.push(Object.freeze({ kind: "restore-owned-state" }));
      intents.push(Object.freeze({ kind: "return-to-basic" }));
    }
    frames.push(
      Object.freeze({
        index,
        sample,
        state,
        deviceIntents: Object.freeze(intents),
        events: Object.freeze(events),
      }),
    );
    game.previousFire = fire;
  });
  return Object.freeze({
    outcome: game.outcome,
    returnedToBasic: game.returnedToBasic,
    frames: Object.freeze(frames),
  });
}
