/**
 * Generates the Boing Ball sprite animation for `examples/boing-ball/`.
 *
 * The ball is a 2x2 block of unexpanded multicolor sprites: 24 multicolor
 * cells across by 42 rows, which at the C64's non-square pixel aspect reads as
 * very nearly a circle. Each cell is ray-cast against a unit sphere carrying a
 * checkerboard texture, and the sphere is spun about a tilted axis.
 *
 * Only one band's worth of rotation is generated. A checkerboard with an even
 * number of meridian bands reproduces itself colour-inverted when it turns by
 * exactly one band, so the demo gets a second half-cycle for free by swapping
 * the two sprite colours instead of storing more frames.
 *
 * Usage:
 *   node scripts/gen-boing-ball.mjs            # write examples/boing-ball/ball.bin
 *   node scripts/gen-boing-ball.mjs --preview  # ASCII preview, writes nothing
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Multicolor cells across the whole ball (two 12-cell sprites side by side). */
const WIDTH = 24;
/** Rows down the whole ball (two 21-row sprites stacked). */
const HEIGHT = 42;
/** Meridian bands around the sphere. Even, so one band of turn inverts the checker. */
const MERIDIANS = 8;
/** Latitude bands from pole to pole. */
const PARALLELS = 4;
/**
 * Stored frames, covering exactly one meridian band of rotation.
 *
 * Four is not an artistic choice. In the VIC's default bank the region
 * $1000-$1FFF is the character-ROM shadow, so sprite data has to fit between
 * the end of the compiled code and $1000 — and the compiler places const data
 * immediately after code with no way to pin it elsewhere. Four frames (1024
 * bytes) is what fits. Raise it here if the ceiling ever moves.
 */
const FRAMES = Number(
  process.argv.find((a) => a.startsWith("--frames="))?.slice("--frames=".length) ?? 4,
);
/** Lean of the spin axis, radians — the original leans to the right. */
const TILT = (15 * Math.PI) / 180;

/** Multicolor bit pairs: 00 transparent, 01 shared colour, 10 per-sprite colour. */
const TRANSPARENT = 0b00;
const LIGHT = 0b01;
const DARK = 0b10;

/** Rotate `p` about the unit vector `axis` by `angle` radians (Rodrigues). */
function rotate(p, axis, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const dot = p[0] * axis[0] + p[1] * axis[1] + p[2] * axis[2];
  const cross = [
    axis[1] * p[2] - axis[2] * p[1],
    axis[2] * p[0] - axis[0] * p[2],
    axis[0] * p[1] - axis[1] * p[0],
  ];
  return [
    p[0] * c + cross[0] * s + axis[0] * dot * (1 - c),
    p[1] * c + cross[1] * s + axis[1] * dot * (1 - c),
    p[2] * c + cross[2] * s + axis[2] * dot * (1 - c),
  ];
}

/**
 * The colour of one cell of the ball at a given rotation.
 *
 * @param cx Cell column, 0..WIDTH-1.
 * @param cy Cell row, 0..HEIGHT-1.
 * @param angle Rotation about the tilted axis, radians.
 * @returns One of the multicolor bit pairs.
 */
function cellColor(cx, cy, angle) {
  // Cell centres in normalised screen space, -1..1 across the ball's bounds.
  const u = ((cx + 0.5) / WIDTH) * 2 - 1;
  const v = ((cy + 0.5) / HEIGHT) * 2 - 1;
  const r2 = u * u + v * v;
  if (r2 > 1) return TRANSPARENT;

  // Front surface point of a unit sphere, y up.
  const p = [u, -v, Math.sqrt(1 - r2)];

  // Spin the point backwards to find where it sits on the unrotated texture.
  const axis = [Math.sin(TILT), Math.cos(TILT), 0];
  const q = rotate(p, axis, -angle);

  // Latitude is the component along the axis; longitude is the angle around it.
  const along = Math.max(-1, Math.min(1, q[0] * axis[0] + q[1] * axis[1] + q[2] * axis[2]));
  const perp = [q[0] - along * axis[0], q[1] - along * axis[1], q[2] - along * axis[2]];
  const e1 = [-axis[1], axis[0], 0];
  const e2 = [
    axis[1] * e1[2] - axis[2] * e1[1],
    axis[2] * e1[0] - axis[0] * e1[2],
    axis[0] * e1[1] - axis[1] * e1[0],
  ];
  const lon = Math.atan2(
    perp[0] * e2[0] + perp[1] * e2[1] + perp[2] * e2[2],
    perp[0] * e1[0] + perp[1] * e1[1] + perp[2] * e1[2],
  );

  const latBand = Math.floor(((Math.asin(along) + Math.PI / 2) / Math.PI) * PARALLELS);
  const lonBand = Math.floor(((lon + Math.PI) / (2 * Math.PI)) * MERIDIANS);
  return (latBand + lonBand) & 1 ? DARK : LIGHT;
}

/** Render one frame as a WIDTH x HEIGHT grid of bit pairs. */
function renderFrame(angle) {
  const grid = [];
  for (let cy = 0; cy < HEIGHT; cy++) {
    const row = [];
    for (let cx = 0; cx < WIDTH; cx++) row.push(cellColor(cx, cy, angle));
    grid.push(row);
  }
  return grid;
}

/**
 * Pack one quadrant of a frame into a 64-byte sprite block.
 *
 * @param grid The frame from {@link renderFrame}.
 * @param qx Quadrant column, 0 (left) or 1 (right).
 * @param qy Quadrant row, 0 (top) or 1 (bottom).
 */
function packChunk(grid, qx, qy) {
  const block = Buffer.alloc(64, 0);
  for (let row = 0; row < 21; row++) {
    for (let b = 0; b < 3; b++) {
      let byte = 0;
      for (let pix = 0; pix < 4; pix++) {
        const cell = grid[qy * 21 + row][qx * 12 + b * 4 + pix];
        byte |= cell << (6 - pix * 2);
      }
      block[row * 3 + b] = byte;
    }
  }
  return block;
}

const angles = [];
for (let f = 0; f < FRAMES; f++) {
  angles.push((f * ((2 * Math.PI) / MERIDIANS)) / FRAMES);
}

if (process.argv.includes("--preview")) {
  const glyph = { [TRANSPARENT]: "  ", [LIGHT]: "██", [DARK]: "▒▒" };
  for (const [i, angle] of angles.entries()) {
    console.log(`\n--- frame ${i}  (${((angle * 180) / Math.PI).toFixed(1)} degrees) ---`);
    for (const row of renderFrame(angle)) {
      console.log(row.map((c) => glyph[c]).join(""));
    }
  }
} else {
  // Frame-major, then quadrant: block index = frame * 4 + quadrant, so the
  // sprite pointers for a frame are four consecutive blocks.
  const chunks = [];
  for (const angle of angles) {
    const grid = renderFrame(angle);
    for (const [qx, qy] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      chunks.push(packChunk(grid, qx, qy));
    }
  }
  const out = Buffer.concat(chunks);
  const here = dirname(fileURLToPath(import.meta.url));
  const target = join(here, "..", "examples", "boing-ball", "ball.bin");
  writeFileSync(target, out);
  console.log(`${target}: ${out.length} bytes (${FRAMES} frames x 4 chunks x 64)`);
}
