/**
 * Debug script: Investigate why long-branch-expansion pass
 * didn't expand the BCS .endfor12 branch in armenian-charset at O2.
 */
import { Compiler } from '../packages/compiler/src/compiler.js';
import { isInstructionElement, isLabelElement, isDirectiveElement, isDataElement } from '../packages/compiler/src/codegen/asm-il/types.js';

const entryFile = 'examples/armenian-charset/main.blend';

// Compile at O2
const compiler = new Compiler({
  entryFile,
  outputFile: '/dev/null',
  optimizationLevel: 'O2',
});

const result = compiler.compile();

if (!result.success) {
  console.error('Compilation failed:', result.errors);
  process.exit(1);
}

// Access the ASM-IL program (after optimization)
const program = (compiler as any).asmILProgram;

if (!program) {
  console.error('No ASM-IL program found. Checking compiler internals...');
  // Try to find the program in the result
  console.log('Result keys:', Object.keys(result));
  process.exit(1);
}

console.log('=== ASM-IL Program Sections ===');
console.log(`Module: ${program.moduleName}`);
console.log(`Sections: ${program.sections.length}`);

for (const section of program.sections) {
  console.log(`\n--- Section: ${section.name} (${section.elements.length} elements) ---`);

  // Find all BCS instructions and .endfor12 label
  let hasBCS = false;
  let hasEndfor12 = false;

  for (let i = 0; i < section.elements.length; i++) {
    const el = section.elements[i];

    if (isInstructionElement(el)) {
      if (el.instruction.mnemonic === 'BCS' && el.instruction.labelOperand?.includes('endfor12')) {
        console.log(`  [${i}] BCS ${el.instruction.labelOperand} (mode: ${el.instruction.mode}, labelOperand: ${el.instruction.labelOperand})`);
        hasBCS = true;
      }
    }

    if (isLabelElement(el)) {
      if (el.label.name.includes('endfor12')) {
        console.log(`  [${i}] LABEL: ${el.label.name}`);
        hasEndfor12 = true;
      }
    }
  }

  if (hasBCS || hasEndfor12) {
    console.log(`  → BCS endfor12 found: ${hasBCS}`);
    console.log(`  → .endfor12 label found: ${hasEndfor12}`);

    if (hasBCS && !hasEndfor12) {
      console.log(`  ⚠️ BCS and target are in DIFFERENT sections!`);
    }

    // Count element kinds in this section
    let instCount = 0, labelCount = 0, dirCount = 0, dataCount = 0, commentCount = 0, blankCount = 0;
    for (const el of section.elements) {
      if (el.kind === 'instruction') instCount++;
      else if (el.kind === 'label') labelCount++;
      else if (el.kind === 'directive') dirCount++;
      else if (el.kind === 'data') dataCount++;
      else if (el.kind === 'comment') commentCount++;
      else if (el.kind === 'blank') blankCount++;
    }
    console.log(`  Element counts: instructions=${instCount}, labels=${labelCount}, directives=${dirCount}, data=${dataCount}, comments=${commentCount}, blanks=${blankCount}`);
  }
}
