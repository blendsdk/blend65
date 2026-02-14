/**
 * Debug script: Trace dataLabel propagation through EACH pipeline phase.
 * Check if the optimizer strips the dataLabel/indexedByY.
 */

import { Compiler } from '../packages/compiler/src/compiler.js';

const compiler = new Compiler();
const sources = new Map<string, string>();
sources.set('examples/balloon-sprite/main.blend', 
  `module BalloonSprite;
const SPRITE_DATA_ADDR: word = $2000;

@data const balloonData: byte[] = [
    $00, $3C, $00,
    $00, $FF, $00,
    $01, $FF, $80
];

export function main(): void {
    copySpriteData();
}

function copySpriteData(): void {
    for (let i: byte = 0 to 2) {
        let b: byte = balloonData[i];
        poke(SPRITE_DATA_ADDR + i, b);
    }
}
`);

const config = {
  compilerOptions: {
    target: 'c64' as const,
    optimization: 'O0',
    libraries: [],
  },
  files: [],
};

function inspectILProgram(label: string, ilProgram: any) {
  console.log(`\n=== ${label} ===`);
  for (const func of ilProgram.functions || []) {
    for (const instr of func.instructions || []) {
      if (instr.operands) {
        for (const op of instr.operands) {
          if (op.kind === 'slot' && (op.slot.name.includes('balloon') || op.slot.dataLabel)) {
            console.log(`  ${func.name}: opcode=${instr.opcode}, slot.name=${op.slot.name}, slot.address=${op.slot.address}, slot.dataLabel=${op.slot.dataLabel}, indexedByY=${op.indexedByY}, allKeys=${Object.keys(op).join(',')}, slotKeys=${Object.keys(op.slot).join(',')}`);
          }
        }
      }
    }
  }
}

// Stop after IL phase
const ilResult = compiler.compileSource(sources, config, 'il');
if (ilResult.phases.il) {
  inspectILProgram('After IL Phase', ilResult.phases.il.data);
}

// Stop after optimize phase
const optResult = compiler.compileSource(sources, config, 'optimize');
if (optResult.phases.optimize) {
  inspectILProgram('After Optimize Phase', optResult.phases.optimize.data);
}

// Full compile - check ASM
const fullResult = compiler.compileSource(sources, config);
if (fullResult.output) {
  const asm = fullResult.output.assembly;
  console.log('\n=== copySpriteData ASM ===');
  const lines = asm.split('\n');
  let inFunc = false;
  for (const line of lines) {
    if (line.includes('copySpriteData:')) inFunc = true;
    if (inFunc) {
      console.log(line);
      if (line.includes('RTS')) break;
    }
  }
}
