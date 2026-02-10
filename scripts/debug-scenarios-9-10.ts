/**
 * Debug script to narrow down codegen failures in Scenarios 9 and 10.
 * Tests individual expressions to find the problematic pattern.
 */

import { Compiler } from '../packages/compiler/src/compiler.js';
import type { Blend65Config } from '../packages/compiler/src/config/types.js';

class TestCompiler extends Compiler {
  protected override loadLibrarySources() {
    return { success: true, sources: new Map<string, string>() };
  }
}

const config: Blend65Config = {
  compilerOptions: { target: 'c64', optimization: 'O0' },
};

function tryCompile(name: string, source: string): void {
  const compiler = new TestCompiler();
  const sources = new Map([['test.blend', source]]);
  const result = compiler.compileSource(sources, config);
  if (result.success) {
    console.log(`✅ ${name}`);
  } else {
    const errs = result.diagnostics
      .filter(d => d.severity === 'error')
      .map(d => d.message)
      .join('; ');
    console.log(`❌ ${name}: ${errs}`);
  }
}

// Test 1: Simple peek + bitwise AND (like peek(VIC_SCROLL) & $F8)
tryCompile('peek + AND', `
module T1;
const VIC_SCROLL: word = $D016;
export function main(): void {
    let current: byte = peek(VIC_SCROLL) & $F8;
    poke(VIC_SCROLL, current);
}
`);

// Test 2: OR with parameter AND constant (current | (offset & $07))
tryCompile('OR with param AND const', `
module T2;
const VIC_SCROLL: word = $D016;
function setScroll(offset: byte): void {
    let current: byte = peek(VIC_SCROLL) & $F8;
    poke(VIC_SCROLL, current | (offset & $07));
}
export function main(): void {
    setScroll(3);
}
`);

// Test 3: Shift left constant (data << 1)
tryCompile('shift left << 1', `
module T3;
export function main(): void {
    let data: byte = 42;
    data = data << 1;
    poke($D020, data);
}
`);

// Test 4: Shift right constant (data >> 7)
tryCompile('shift right >> 7', `
module T4;
export function main(): void {
    let data: byte = 42;
    data = data >> 7;
    poke($D020, data);
}
`);

// Test 5: Combined shift + OR rotate pattern
tryCompile('rotate (data << 1) | (data >> 7)', `
module T5;
export function main(): void {
    let data: byte = 42;
    data = (data << 1) | (data >> 7);
    poke($D020, data);
}
`);

// Test 6: Nested peek in poke value with AND + OR
tryCompile('poke(addr, (peek(addr) & mask) | val)', `
module T6;
const VIC_MEMCTL: word = $D018;
export function main(): void {
    poke(VIC_MEMCTL, (peek(VIC_MEMCTL) & $F0) | $0C);
}
`);

// Test 7: Word loop poke + peek (like memcopy — this works in scenarios 5-8)
tryCompile('word loop poke(CONST+i, peek(CONST+i))', `
module T7;
const SRC: word = $0401;
const DST: word = $0400;
export function main(): void {
    for (let pos: word = 0 to 959 step 1) {
        poke(DST + pos, peek(SRC + pos));
    }
}
`);

// Test 8: colOffset += 40 word compound assignment
tryCompile('word += 40', `
module T8;
const SCREEN_RAM: word = $0400;
export function main(): void {
    let colOffset: word = 39;
    for (let row: byte = 0 to 24 step 1) {
        poke(SCREEN_RAM + colOffset, row + 65);
        colOffset += 40;
    }
}
`);

// Test 9: Full Scenario 9 shiftScreenLeft only
tryCompile('shiftScreenLeft only', `
module T9;
const SCREEN_RAM: word = $0400;
const SCREEN_NEXT: word = $0401;
function shiftScreenLeft(): void {
    for (let pos: word = 0 to 959 step 1) {
        poke(SCREEN_RAM + pos, peek(SCREEN_NEXT + pos));
    }
}
export function main(): void {
    shiftScreenLeft();
}
`);

// Test 10: peek(CPU_PORT) & $FB pattern
tryCompile('peek($0001) & $FB', `
module T10;
const CPU_PORT: word = $0001;
export function main(): void {
    poke(CPU_PORT, peek(CPU_PORT) & $FB);
}
`);

// Test 11: poke value from peek + OR
tryCompile('poke(addr, peek(addr) | $04)', `
module T11;
const CPU_PORT: word = $0001;
export function main(): void {
    poke(CPU_PORT, peek(CPU_PORT) | $04);
}
`);
