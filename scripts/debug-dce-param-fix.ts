/**
 * Debug script: Verify DCE parameter store fix for spinning-line.
 *
 * Compiles spinning-line at O1 and checks that parameter stores
 * (STA $02 for getSpriteFrame's spriteAddr parameter) are preserved.
 */
import { Compiler } from '../packages/compiler/dist/index.js';

const levels = ['O0', 'O1', 'Os', 'Oz'] as const;

console.log('=== DCE Parameter Store Fix Verification ===\n');

for (const level of levels) {
  const compiler = new Compiler();
  const result = compiler.compile({
    files: ['examples/spinning-line/main.blend'],
    config: {
      target: 'c64',
      compilerOptions: {
        optimization: level,
        outputFormat: 'asm',
      },
    },
  });

  if (!result.success) {
    console.log(`${level}: ❌ Compilation failed`);
    if (result.diagnostics) {
      for (const d of result.diagnostics) {
        console.log(`  [${d.severity}] ${d.message}`);
      }
    }
    continue;
  }

  const asm = (result.output as any)?.assembly || '';
  const lines = asm.split('\n');

  // Check for STA $02 (param store for spriteAddr low byte)
  const hasSTA02 = asm.includes('STA $02');
  const hasSTA07 = asm.includes('STA $07');
  const hasParamStore = hasSTA02 || hasSTA07;

  // Check for JMP-to-next pattern
  let jmpToNextCount = 0;
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i].trim();
    const nextLine = lines[i + 1].trim();
    const jmpMatch = line.match(/^JMP\s+(\S+)/);
    if (jmpMatch) {
      const target = jmpMatch[1];
      if (nextLine === target || nextLine === target + ':') {
        jmpToNextCount++;
      }
    }
  }

  // Check for store/reload patterns
  let storeReloadCount = 0;
  for (let i = 0; i < lines.length - 3; i++) {
    const l0 = lines[i].trim();
    const l1 = lines[i + 1].trim();
    const l2 = lines[i + 2].trim();
    const l3 = lines[i + 3].trim();
    const staMatch = l0.match(/^STA\s+(\$\w+)/);
    const stxMatch = l1.match(/^STX\s+(\$\w+)/);
    const ldaMatch = l2.match(/^LDA\s+(\$\w+)/);
    const ldxMatch = l3.match(/^LDX\s+(\$\w+)/);
    if (staMatch && stxMatch && ldaMatch && ldxMatch) {
      if (staMatch[1] === ldaMatch[1] && stxMatch[1] === ldxMatch[1]) {
        storeReloadCount++;
      }
    }
  }

  console.log(`${level}: ${lines.length} lines | param stores: ${hasParamStore ? '✅' : '❌'} | JMP-to-next: ${jmpToNextCount === 0 ? '✅ 0' : `❌ ${jmpToNextCount}`} | store/reload: ${storeReloadCount === 0 ? '✅ 0' : `⚠️ ${storeReloadCount}`}`);
}

console.log('\nDone.');
