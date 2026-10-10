import { describe, expect, it } from "vitest";
import {
  libraryEntry,
  sourceLibraryProfiles,
  withLibraryBuild,
  withLibraryVice,
} from "./source-library-fixture.js";

/** Ordinary source keeps signedness, ordinal width, element stride and loaded values. */
const SOURCE = `module Game;
const CIA1_PA: word = $DC00;
const CIA1_PB: word = $DC01;
const BYTE_INPUT: word = $3004;
const CALL_INPUT: word = $3005;
place(at: $3000) let signedIndex: sword;
place(at: $3002) let wideIndex: word;
place(at: $30FC) let data: byte[300];
place(at: $34FC) let words: word[8];
place(at: $3600) let borrowed: byte[8];
place(at: $3700) let output: word[6];
function armed(): void { asm_nop(); }
function observed(): void { asm_nop(); }
function clobber(): word {
  poke(CIA1_PA, $FD);
  return peekw(CALL_INPUT);
}
function retain(rows: const byte[8], index: word): void {
  let saved: byte = rows[index];
  output[4] = saved;
  poke(CIA1_PA, $FE);
  let unrelated: byte = peek(CIA1_PB);
  let changed: word = clobber();
  output[5] = saved;
}
function main(): void {
  asm_sei(); armed();
  output[0] = data[signedIndex];
  output[1] = data[wideIndex];
  output[2] = data[peek(BYTE_INPUT) + 10];
  output[3] = words[7 + peek($3007)];
  retain(borrowed, peekw($3008));
  observed();
}`;

/** Decode the typed observation words in the specified little-endian byte order. */
function observationWords(bytes: Uint8Array): number[] {
  expect(bytes.length).toBe(12);
  return Array.from({ length: 6 }, (_, index) => bytes[index * 2]! | (bytes[index * 2 + 1]! << 8));
}

describe.sequential("unchecked array indexing guards", () => {
  for (const profile of sourceLibraryProfiles) {
    // Full ordinals and strides survive lowering; a shared loaded byte survives later effects.
    it(`should retain signed and widened ordinals, word stride and a borrowed value on ${profile}`, async () => {
      await withLibraryBuild(SOURCE, "module Extra;", profile, async (artifacts, built) => {
        await withLibraryVice(built, artifacts, profile, async (monitor, stopAt) => {
          await stopAt(libraryEntry(artifacts, "src/game.blend::Game.armed"));
          // Inputs are installed after startup and remain runtime reads in ordinary source.
          const inputs = Uint8Array.of(0xff, 0xff, 9, 1, 0xff, 0x69, 0x96, 0, 7, 0);
          await monitor.writeMemory(0x3000, inputs);
          const bytes = new Uint8Array(300).fill(0xe1);
          bytes[265] = 0xb7;
          await monitor.writeMemory(0x30fc, bytes);
          await monitor.writeMemory(0x30fb, Uint8Array.of(0x62));
          const words = new Uint8Array(16).fill(0x11);
          words.set([0xcd, 0xab], 14);
          await monitor.writeMemory(0x34fc, words);
          const rows = Uint8Array.of(0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xcc, 0xa5);
          await monitor.writeMemory(0x3600, rows);
          await monitor.writeMemory(0x3700, new Uint8Array(12).fill(0xcc));
          await monitor.takeCheckpointHits();
          const indexedRead = await monitor.setAccessTracepoint(0x3607, "load");
          const paWrite = await monitor.setAccessTracepoint(0xdc00, "store");
          const pbRead = await monitor.setAccessTracepoint(0xdc01, "load");
          const sourceWrites: number[] = [];
          for (let address = 0x3600; address < 0x3608; address += 1) {
            sourceWrites.push(await monitor.setAccessTracepoint(address, "store"));
          }
          await stopAt(libraryEntry(artifacts, "src/game.blend::Game.observed"));
          const result = observationWords(await monitor.readMemory(0x3700, 0x370b));
          // Signed -1 selects $30FB, rather than the zero-extended $31FB.
          expect(result[0], "signed ordinal is sign-extended").toBe(0x62);
          // Both word 265 and byte 255 + 10 select $3205, rather than ordinal 9.
          expect(result.slice(1, 3), "ordinal context widens before arithmetic").toEqual([
            0xb7, 0xb7,
          ]);
          // Seven complete two-byte elements cross the page to $350A/$350B.
          expect(result[3], "word element stride and page carry").toBe(0xabcd);
          expect(
            result.slice(4),
            "original byte survives a volatile read and clobbering call",
          ).toEqual([0xa5, 0xa5]);
          const hits = await monitor.takeCheckpointHits();
          const observedEvents = [indexedRead, paWrite, pbRead, ...sourceWrites];
          expect(hits.filter((id) => observedEvents.includes(id))).toEqual([
            indexedRead,
            paWrite,
            pbRead,
            paWrite,
          ]);
          expect(await monitor.readMemory(0x3000, 0x3009)).toEqual(inputs);
          expect(await monitor.readMemory(0x3600, 0x3607)).toEqual(rows);
          expect(await monitor.readMemory(0x30fc, 0x3227)).toEqual(bytes);
          expect((await monitor.readMemory(0x30fb, 0x30fb))[0]).toBe(0x62);
          expect(await monitor.readMemory(0x34fc, 0x350b)).toEqual(words);
          expect((await monitor.readCpuRegisters()).p & 0x04).toBe(0x04);
        });
      });
    }, 120_000);
  }
});
