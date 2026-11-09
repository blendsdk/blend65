import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/** Root of the committed fixture tree. */
const fixturesRoot = fileURLToPath(new URL("../fixtures/", import.meta.url));

/** Lowercase digest of exact bytes. */
function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Deterministic pseudo-random bytes without a runtime dependency. */
function patterned(length, seed) {
  const bytes = Buffer.alloc(length);
  let state = seed >>> 0 || 0x9e3779b9;
  for (let index = 0; index < length; index += 1) {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    bytes[index] = state & 0xff;
  }
  return bytes;
}

/** Tiny readable payload used by every constructed PSID fixture. */
const CODE = Buffer.from([0x60, 0xea, 0xea, 0x60, 0xa9, 0x00, 0x60, 0xea]);
const LOAD = 0xc000;

/** Build one PSID v1-v4 container with fixed or payload-supplied load address. */
function psid(version, payloadLoad) {
  const dataOffset = version === 1 ? 0x76 : 0x7c;
  const header = Buffer.alloc(dataOffset);
  header.write("PSID", 0, "ascii");
  header.writeUInt16BE(version, 0x04);
  header.writeUInt16BE(dataOffset, 0x06);
  header.writeUInt16BE(payloadLoad ? 0 : LOAD, 0x08);
  header.writeUInt16BE(payloadLoad ? 0 : LOAD, 0x0a);
  header.writeUInt16BE(LOAD + 3, 0x0c);
  header.writeUInt16BE(1, 0x0e);
  header.writeUInt16BE(1, 0x10);
  if (version >= 2) {
    // PAL video (1) and 6581 model (1) are the qualified compatible subset.
    header.writeUInt16BE(0x0014, 0x76);
    header[0x78] = 0;
    header[0x79] = 0;
  }
  if (version >= 3) header[0x7a] = 0;
  if (version >= 4) header[0x7b] = 0;
  const payload = payloadLoad ? Buffer.concat([Buffer.from([LOAD & 0xff, LOAD >> 8]), CODE]) : CODE;
  return Buffer.concat([header, payload]);
}

/** Build one exact 10,003-byte Koala image with caller-provided components. */
function koala({ bitmap, screen, color, background }) {
  return Buffer.concat([
    Buffer.from([0x00, 0x60]),
    bitmap,
    screen,
    color,
    Buffer.from([background]),
  ]);
}

/** Build one synthetic SpritePad v5 project with one sprite and no tiles. */
function spritepad() {
  const header = Buffer.alloc(20);
  header.write("SPD", 0, "ascii");
  header[3] = 5;
  header[4] = 0;
  header.writeUInt16LE(1, 5);
  header.writeUInt16LE(0, 7);
  const sprite = patterned(64, 23);
  return { bytes: Buffer.concat([header, sprite]), sprite };
}

/** Build one synthetic CharPad v9 project with two characters and one map cell. */
function charpad() {
  const header = Buffer.alloc(19);
  header.write("CTM", 0, "ascii");
  header[3] = 9;
  header[4] = 1;
  header[5] = 0;
  header[6] = 0;
  header.writeUInt16LE(1, 7);
  header.writeUInt16LE(1, 9);
  const charset = patterned(16, 29);
  const attributes = Buffer.from([0x01, 0x02]);
  const block = (number) => Buffer.from([0xda, 0xb0 | (number & 0x0f)]);
  const count = (items) => Buffer.from([(items - 1) & 0xff, ((items - 1) >> 8) & 0xff]);
  return {
    bytes: Buffer.concat([
      header,
      block(0),
      count(2),
      charset,
      block(1),
      attributes,
      block(2),
      Buffer.from([1, 0, 1, 0, 1, 0]),
    ]),
    charset,
  };
}

const fixtureDir = join(fixturesRoot, "public");
await mkdir(join(fixtureDir, "raw"), { recursive: true });
await mkdir(join(fixtureDir, "psid"), { recursive: true });
await mkdir(join(fixtureDir, "koala"), { recursive: true });
await mkdir(join(fixtureDir, "spritepad"), { recursive: true });
await mkdir(join(fixtureDir, "charpad"), { recursive: true });

const entries = [];
const write = async (relativePath, bytes) => {
  const path = join(fixtureDir, relativePath);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
  return { path: `public/${relativePath}`, sha256: sha256(bytes) };
};

const constructed = (source, sourceSha256) => ({
  kind: "constructed",
  source,
  sourceSha256,
  author: "Blend65 compiler team",
  date: "2026-11-08",
});

const license = {
  disposition: "redistributable",
  text: "Synthetic public-format fixture; no third-party content.",
};

for (const [id, bytes] of [
  ["raw-nonempty", Buffer.from([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef])],
  ["raw-empty", Buffer.alloc(0)],
  ["raw-511", patterned(511, 1)],
  ["raw-513", patterned(513, 2)],
]) {
  const written = await write(`raw/${id}.bin`, bytes);
  entries.push({
    id,
    family: "raw",
    ...written,
    provenance: constructed("Deterministic public byte sequence", sha256(Buffer.from(id))),
    producer: null,
    producerVersion: null,
    settings: {},
    license,
    expected:
      bytes.length === 0
        ? { parse: "reject", selectors: {} }
        : {
            parse: "accept",
            selectors: {
              raw: { type: "byte[]", length: bytes.length, sha256: sha256(bytes) },
            },
          },
    malformedOf: null,
    derivation: null,
  });
}

for (const version of [1, 2, 3, 4]) {
  for (const payloadLoad of [false, true]) {
    const id = `psid-v${version}-${payloadLoad ? "payload" : "fixed"}`;
    const bytes = psid(version, payloadLoad);
    const written = await write(`psid/${id}.sid`, bytes);
    const dataOffset = version === 1 ? 0x76 : 0x7c;
    const data = payloadLoad ? bytes.subarray(dataOffset + 2) : bytes.subarray(dataOffset);
    entries.push({
      id,
      family: "psid",
      ...written,
      provenance: constructed(
        "HVSC SID file format (PSID v1-v4 subset)",
        "b89a78d3c1d90d0b8c6b4cfd2001be026ad6c2c31b73cdbab857c627a60779f0",
      ),
      producer: null,
      producerVersion: null,
      settings: {},
      license,
      expected: {
        parse: "accept",
        selectors: {
          data: { type: "byte[]", length: data.length, sha256: sha256(data) },
          init_address: { type: "word", value: LOAD },
          play_address: { type: "word", value: LOAD + 3 },
        },
      },
      malformedOf: null,
      derivation: null,
    });
  }
}

const koalaCases = [
  {
    id: "koala-zero",
    bitmap: Buffer.alloc(8000),
    screen: Buffer.alloc(1000),
    color: Buffer.alloc(1000),
    background: 0,
  },
  {
    id: "koala-patterned",
    bitmap: patterned(8000, 3),
    screen: patterned(1000, 5),
    color: patterned(1000, 7),
    background: 6,
  },
  {
    id: "koala-color-high-nibble",
    bitmap: patterned(8000, 11),
    screen: patterned(1000, 13),
    color: Buffer.from(Array.from({ length: 1000 }, (_, index) => 0xf0 | (index & 0x0f))),
    background: 1,
  },
  {
    id: "koala-background-high-nibble",
    bitmap: patterned(8000, 17),
    screen: patterned(1000, 19),
    color: Buffer.alloc(1000),
    background: 0xab,
  },
];

for (const item of koalaCases) {
  const bytes = koala(item);
  const written = await write(`koala/${item.id}.kla`, bytes);
  entries.push({
    id: item.id,
    family: "koala",
    ...written,
    provenance: constructed(
      "Classic Koala Paint layout ($6000 load, 10,003 bytes)",
      sha256(Buffer.from("koala")),
    ),
    producer: null,
    producerVersion: null,
    settings: {},
    license,
    expected: {
      parse: "accept",
      selectors: {
        bitmap: { type: "byte[]", length: 8000, sha256: sha256(item.bitmap) },
        screen: { type: "byte[]", length: 1000, sha256: sha256(item.screen) },
        color_ram: { type: "byte[]", length: 1000, sha256: sha256(item.color) },
        background: { type: "byte", value: item.background },
      },
    },
    malformedOf: null,
    derivation: null,
  });
}

const spritepadFixture = spritepad();
const spritepadWritten = await write("spritepad/synthetic-basic.spd", spritepadFixture.bytes);
entries.push({
  id: "spritepad-synthetic-basic",
  family: "spritepad",
  ...spritepadWritten,
  provenance: constructed(
    "SpritePad Pro v5 structural subset (one sprite, no tiles)",
    sha256(Buffer.from("synthetic-basic-spd")),
  ),
  producer: null,
  producerVersion: null,
  settings: {},
  license,
  expected: {
    parse: "accept",
    selectors: {
      sprites: {
        type: "byte[]",
        length: 64,
        sha256: sha256(spritepadFixture.sprite),
      },
      count: { type: "word", value: 1 },
      sprite_attributes: {
        type: "byte[]",
        length: 1,
        sha256: sha256(Buffer.from([spritepadFixture.sprite[63]])),
      },
    },
  },
  malformedOf: null,
  derivation: null,
});

const charpadFixture = charpad();
const charpadWritten = await write("charpad/synthetic-basic.ctm", charpadFixture.bytes);
entries.push({
  id: "charpad-synthetic-basic",
  family: "charpad",
  ...charpadWritten,
  provenance: constructed(
    "CharPad C64 Pro v9 structural subset (two characters, one map cell)",
    sha256(Buffer.from("synthetic-basic-ctm")),
  ),
  producer: null,
  producerVersion: null,
  settings: {},
  license,
  expected: {
    parse: "accept",
    selectors: {
      charset: {
        type: "byte[]",
        length: 16,
        sha256: sha256(charpadFixture.charset),
      },
      map: { type: "byte[]", length: 1, sha256: sha256(Buffer.from([1])) },
      map_low: { type: "byte[]", length: 1, sha256: sha256(Buffer.from([1])) },
      map_high: { type: "byte[]", length: 1, sha256: sha256(Buffer.from([0])) },
      map_packed12: {
        type: "byte[]",
        length: 2,
        sha256: sha256(Buffer.from([1, 0])),
      },
      charset_count: { type: "word", value: 2 },
      map_width: { type: "word", value: 1 },
      map_height: { type: "word", value: 1 },
    },
  },
  malformedOf: null,
  derivation: null,
});

entries.sort((left, right) => (left.id < right.id ? -1 : left.id > right.id ? 1 : 0));
await writeFile(
  join(fixturesRoot, "manifest.json"),
  `${JSON.stringify({ schemaVersion: 1, fixtures: entries }, null, 2)}\n`,
);
console.log(`Wrote ${entries.length} fixtures.`);
