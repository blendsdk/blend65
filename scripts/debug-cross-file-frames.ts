/**
 * Debug script: Verify cross-file frame allocation fix.
 *
 * Tests that functions defined in separate modules both
 * receive frame allocations (previously only primary module
 * functions got frames).
 */

import { Compiler } from '../packages/compiler/src/compiler.js';
import type { Blend65Config } from '../packages/compiler/src/config/types.js';

// E2E compiler that skips library loading
class TestCompiler extends Compiler {
  protected override loadLibrarySources() {
    return { success: true, sources: new Map<string, string>() };
  }
}

const config: Blend65Config = {
  compilerOptions: {
    target: 'c64',
    optimization: 'O0',
  },
};

// Test 1: Functions in separate files WITH explicit module declarations
console.log('=== Test 1: Functions across multiple files (explicit modules) ===');
const sources1 = new Map<string, string>();
sources1.set('utils.blend', `
  module Utils;
  export function double(x: byte): byte {
    return x + x;
  }
`);
sources1.set('main.blend', `
  module Main;
  export function getMax(): byte {
    return 255;
  }
`);

const compiler1 = new TestCompiler();

// Stop after semantic to check modules
const semResult = compiler1.compileSource(sources1, config, 'semantic');
console.log('Semantic phase success:', semResult.success);
if (semResult.phases.semantic) {
  const semData = semResult.phases.semantic.data as any;
  if (semData?.modules) {
    console.log('Semantic modules:', [...semData.modules.keys()]);
    for (const [name, mod] of semData.modules) {
      const ast = (mod as any).ast;
      const decls = ast?.getDeclarations?.() ?? [];
      console.log(`  Module "${name}": ${decls.length} declarations`);
      for (const d of decls) {
        console.log(`    - ${d.constructor.name}: ${d.getName?.()}`);
      }
    }
  }
  console.log('Compilation order:', semData?.compilationOrder);
}

// Stop after frame phase to check frameMap
const compiler1c = new TestCompiler();
const frameOnlyResult = compiler1c.compileSource(sources1, config, 'frame');
console.log('\nFrame phase success:', frameOnlyResult.success);
if (frameOnlyResult.phases.frame) {
  const frameMap = (frameOnlyResult.phases.frame.data as any)?.frameMap;
  if (frameMap) {
    console.log('Frame map keys:', [...frameMap.keys()]);
    console.log('Frame map size:', frameMap.size);
  } else {
    console.log('No frameMap in frame result');
  }
  console.log('Frame phase diagnostics:');
  for (const d of frameOnlyResult.phases.frame.diagnostics) {
    console.log(`  [${d.severity}] ${d.message}`);
  }
}

// Now full compile
const compiler1b = new TestCompiler();
const result1 = compiler1b.compileSource(sources1, config);

console.log('\nFull compile Success:', result1.success);
if (!result1.success) {
  console.log('Errors:');
  for (const d of result1.diagnostics) {
    console.log(`  [${d.severity}] ${d.message} @ ${d.location.source}`);
  }
} else {
  console.log('Assembly output length:', result1.output?.assembly?.length);
  const asm = result1.output?.assembly ?? '';
  console.log('Contains "double":', asm.includes('double'));
  console.log('Contains "getMax":', asm.includes('getMax'));
  console.log('Contains "RTS":', asm.includes('RTS'));
}

// Test 2: Combined assembly from separate files
console.log('\n=== Test 2: Assembly contains both function labels ===');
const sources2 = new Map<string, string>();
sources2.set('math.blend', `
  export function add(a: byte, b: byte): byte {
    return a + b;
  }
`);
sources2.set('app.blend', `
  export function init(): byte {
    return 0;
  }
`);

const compiler2 = new TestCompiler();
const result2 = compiler2.compileSource(sources2, config);

console.log('Success:', result2.success);
if (!result2.success) {
  console.log('Errors:');
  for (const d of result2.diagnostics) {
    console.log(`  [${d.severity}] ${d.message} @ ${d.location.source}`);
  }
} else {
  const asm = result2.output?.assembly ?? '';
  console.log('Contains "add":', asm.includes('add'));
  console.log('Contains "init":', asm.includes('init'));
  // Print first 40 lines of assembly
  const lines = asm.split('\n').slice(0, 40);
  console.log('\nAssembly (first 40 lines):');
  for (const line of lines) {
    console.log('  ', line);
  }
}
