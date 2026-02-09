/**
 * Quick validation: Do peek/poke intrinsics with constant addresses
 * now work through the full pipeline?
 */

import { Compiler } from '../packages/compiler/src/compiler.js';

class TestCompiler extends Compiler {
  protected override loadLibrarySources() {
    return { success: true, sources: new Map<string, string>() };
  }
}

const config = { compilerOptions: { target: 'c64' as const, optimization: 'O0' as const } };

const testCases = [
  { name: 'poke($D020, 14)', source: `module T; function main(): void { poke($D020, 14); }` },
  { name: 'peek($D020)', source: `module T; function main(): void { let v: byte = peek($D020); }` },
  { name: 'peekw($00FB)', source: `module T; function main(): void { let v: word = peekw($00FB); }` },
  { name: 'pokew($00FB, $1234)', source: `module T; function main(): void { pokew($00FB, $1234); }` },
  { name: 'volatile_read($DC0D)', source: `module T; function main(): void { let v: byte = volatile_read($DC0D); }` },
  { name: 'x << 3 (shift left)', source: `module T; function main(): void { let x: byte = 1; let y: byte = x << 3; }` },
  { name: 'x >> 2 (shift right)', source: `module T; function main(): void { let x: byte = $FF; let y: byte = x >> 2; }` },
  { name: '3-var: a + b - c', source: `module T; function main(): void { let a: byte = 10; let b: byte = 5; let c: byte = 3; let r: byte = a + b - c; }` },
];

for (const tc of testCases) {
  const compiler = new TestCompiler();
  const sources = new Map([['test.blend', tc.source]]);
  try {
    const result = compiler.compileSource(sources, config);
    if (result.success) {
      console.log(`✅ ${tc.name} — SUCCESS`);
    } else {
      const errors = result.diagnostics.filter(d => d.severity === 'error').map(d => d.message);
      console.log(`❌ ${tc.name} — FAILED: ${errors.join('; ')}`);
    }
  } catch (err: any) {
    console.log(`❌ ${tc.name} — EXCEPTION: ${err.message}`);
  }
}
