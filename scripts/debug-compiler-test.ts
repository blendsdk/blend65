/**
 * Debug: find which phase fails in the pipeline
 */
import { Compiler, formatDiagnostics } from '../packages/compiler-v2/src/compiler.js';
import type { Blend65Config } from '../packages/compiler-v2/src/config/types.js';
import type { CompilationResult } from '../packages/compiler-v2/src/pipeline/types.js';

// TestCompiler that skips library loading
class TestCompiler extends Compiler {
  protected override loadLibrarySources(): { success: boolean; sources: Map<string, string> } {
    return { success: true, sources: new Map() };
  }
}

const compiler = new TestCompiler();
const config: Blend65Config = {
  compilerOptions: { target: 'c64', optimization: 'O0' },
};
const sources = new Map([['main.blend', 'let x: byte = 42;']]);

// Test each stopAfterPhase
const phases = ['parse', 'semantic', 'frame', 'il', 'optimize', 'codegen', 'asmOpt', 'emit'] as const;

for (const phase of phases) {
  const result = compiler.compileSource(sources, config, phase);
  const errors = result.diagnostics.filter(d => d.severity === 'error');
  console.log(`${phase}: success=${result.success}, errors=${errors.length}, diags=${result.diagnostics.length}`);
  if (errors.length > 0) {
    console.log('  First error:', errors[0].message);
    console.log('  Source:', errors[0].location?.source);
    break;
  }
}

// Also test the full pipeline
const full = compiler.compileSource(sources, config);
console.log(`\nfull: success=${full.success}, errors=${full.diagnostics.filter(d => d.severity === 'error').length}`);
console.log('phases reached:', Object.keys(full.phases).filter(k => (full.phases as any)[k]));
if (!full.success && full.diagnostics.length > 0) {
  const errors = full.diagnostics.filter(d => d.severity === 'error');
  errors.forEach(e => console.log('  ERROR:', e.message));
}

// Check Program API for source file
const parseResult = compiler.compileSource(sources, config, 'parse');
const program = parseResult.phases.parse!.data[0];
console.log('\nProgram properties:', Object.getOwnPropertyNames(Object.getPrototypeOf(program)));
console.log('Program source:', (program as any).sourceFile ?? (program as any).source ?? (program as any).filename);
