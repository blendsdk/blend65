/**
 * Debug script to compile border-cycle example and inspect output.
 * Tests: BASIC stub, startup code, barrier(), const skipping, for-loops.
 */

import { Compiler } from '../packages/compiler/dist/index.js';
import * as fs from 'fs';

const source = fs.readFileSync('examples/border-cycle/main.blend', 'utf-8');
console.log('=== Source ===');
console.log(source);
console.log();

const compiler = new Compiler();
const result = compiler.compile({
  files: ['examples/border-cycle/main.blend'],
  config: {
    target: 'c64',
    compilerOptions: {
      optimization: 'O1',
      outputFormat: 'asm',
    },
  },
});

console.log('=== Compilation Result ===');
console.log('Success:', result.success);

if (result.diagnostics && result.diagnostics.length > 0) {
  console.log('\nDiagnostics:');
  for (const d of result.diagnostics) {
    console.log(`  [${d.severity}] ${d.message}`);
    if (d.location) {
      console.log(`    at line ${d.location.line}, col ${d.location.column}`);
    }
  }
}

if (result.output?.assembly) {
  console.log('\n=== Generated Assembly ===');
  console.log(result.output.assembly);

  // Write to build/main.asm
  fs.mkdirSync('build', { recursive: true });
  fs.writeFileSync('build/main.asm', result.output.assembly);
  console.log('\nWritten to build/main.asm');
} else {
  console.log('\nNo assembly output generated!');
}
