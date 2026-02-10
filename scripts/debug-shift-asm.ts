/**
 * Debug: Check what assembly the compiler generates for constant shifts.
 */
import { Compiler } from '../packages/compiler/src/compiler.js';
import type { Blend65Config } from '../packages/compiler/src/config/types.js';

class TC extends Compiler {
  protected override loadLibrarySources() {
    return { success: true, sources: new Map<string, string>() };
  }
}

const cfg: Blend65Config = { compilerOptions: { target: 'c64', optimization: 'O0' } };

const src = `
module T;
export function main(): void {
    let data: byte = 42;
    let hi: byte = data << 1;
    let lo: byte = data >> 7;
    poke($D020, hi);
    poke($D021, lo);
}
`;

const r = new TC().compileSource(new Map([['t.blend', src]]), cfg);
if (r.success) {
  console.log('Assembly:\n' + r.output!.assembly!);
} else {
  console.log('FAILED:', r.diagnostics.filter(d => d.severity === 'error').map(d => d.message));
}
