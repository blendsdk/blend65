import { Compiler } from '../packages/compiler/dist/index.js';

const compiler = new Compiler();

try {
  const result = compiler.compile({
    files: ['examples/test-suite/04-control-flow/main.blend'],
    config: {
      target: 'c64',
      compilerOptions: {
        optimization: 'O0',
        outputFormat: 'asm',
      },
    },
  });

  if (result.diagnostics && result.diagnostics.length > 0) {
    console.log(`Diagnostics (${result.diagnostics.length}):`);
    for (const d of result.diagnostics.slice(0, 20)) {
      console.log(`  ${d.severity}: ${d.message} (line ${d.location?.line}, col ${d.location?.column})`);
    }
    if (result.diagnostics.length > 20) {
      console.log(`  ... and ${result.diagnostics.length - 20} more`);
    }
  }
  if (result.output) {
    console.log('Compilation succeeded, output length:', result.output.length);
  } else {
    console.log('Compilation failed - no output');
  }
} catch (err: any) {
  console.error('Error:', err.message);
}
