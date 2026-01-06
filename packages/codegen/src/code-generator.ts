/**
 * Main 6502 code generator for Blend65
 * Orchestrates the complete compilation from IL to 6502 assembly
 */

import { ILProgram, ILFunction } from '@blend65/il';
import { CommodorePlatform } from './platform/commodore-platform.js';
import { PlatformFactory } from './platform/platform-factory.js';
import { ILTo6502Mapper, CodeGenContext } from './instruction-mapping/il-to-6502-mapper.js';

export interface CodeGenOptions {
  /** Target platform (c64, vic20, c128, etc.) */
  target: string;

  /** Optimization level */
  optimization: 'O0' | 'O1' | 'O2' | 'O3';

  /** Output assembly file path */
  outputAsm?: string;

  /** Include debug information */
  debug: boolean;

  /** Generate source maps */
  sourceMaps: boolean;

  /** Generate auto-run BASIC stub */
  autoRun: boolean;

  /** Custom entry point address */
  entryPoint?: number;

  /** Preserve assembly output */
  preserveAsm: boolean;
}

export interface CodeGenResult {
  /** Generated assembly code */
  assembly: string;

  /** Generated labels and their addresses */
  labels: Map<string, number>;

  /** Memory layout information */
  memoryLayout: MemoryLayoutInfo;

  /** Compilation statistics */
  stats: CompilationStats;

  /** Source map data (if enabled) */
  sourceMap?: SourceMapData;

  /** Any warnings during compilation */
  warnings: CodeGenWarning[];
}

export interface MemoryLayoutInfo {
  /** Program start address */
  programStart: number;

  /** Program end address */
  programEnd: number;

  /** Zero page allocations */
  zeroPageUsage: Map<string, number>;

  /** Stack usage estimate */
  stackUsage: number;

  /** Total memory used */
  totalMemory: number;
}

export interface CompilationStats {
  /** Total instructions generated */
  instructionCount: number;

  /** Estimated cycle count */
  estimatedCycles: number;

  /** Functions compiled */
  functionsCompiled: number;

  /** Compilation time in milliseconds */
  compilationTime: number;

  /** Code size in bytes */
  codeSize: number;
}

export interface SourceMapData {
  /** Source line to assembly line mapping */
  lineMapping: Map<number, number[]>;

  /** Original source files */
  sources: string[];

  /** Source map version */
  version: number;
}

export interface CodeGenWarning {
  /** Warning type */
  type: 'performance' | 'memory' | 'compatibility' | 'optimization';

  /** Warning message */
  message: string;

  /** Source location (if available) */
  sourceLocation?: {
    line: number;
    column: number;
    file?: string;
  };

  /** Suggested fix */
  suggestion?: string;
}

/**
 * Main 6502 code generator
 * Converts Blend65 IL to optimized 6502 assembly for Commodore platforms
 */
export class CodeGenerator {
  private platform: CommodorePlatform;
  private mapper: ILTo6502Mapper;
  private context: CodeGenContext;
  private options: CodeGenOptions;
  private warnings: CodeGenWarning[] = [];

  constructor(options: CodeGenOptions) {
    this.options = options;

    // Create platform instance
    this.platform = PlatformFactory.create(options.target);

    // Initialize code generation context
    this.context = {
      platform: this.platform,
      registers: { a: true, x: true, y: true },
      stackDepth: 0,
      labelCounter: 1,
    };

    // Create IL to 6502 mapper
    this.mapper = new ILTo6502Mapper(this.context);
  }

  /**
   * Generate 6502 assembly from IL program
   */
  async generate(program: ILProgram): Promise<CodeGenResult> {
    const startTime = Date.now();

    try {
      // Initialize result
      const result: CodeGenResult = {
        assembly: '',
        labels: new Map(),
        memoryLayout: this.createInitialMemoryLayout(),
        stats: this.createInitialStats(),
        warnings: this.warnings,
      };

      // Generate assembly sections
      const sections = await this.generateAssemblySections(program);

      // Combine all sections
      result.assembly = this.combineAssemblySections(sections);

      // Update compilation stats
      result.stats.compilationTime = Date.now() - startTime;
      result.stats.codeSize = this.estimateCodeSize(result.assembly);

      // Generate source map if requested
      if (this.options.sourceMaps) {
        result.sourceMap = this.generateSourceMap(sections);
      }

      return result;
    } catch (error) {
      throw new Error(
        `Code generation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Generate assembly sections from IL program
   */
  private async generateAssemblySections(program: ILProgram): Promise<AssemblySection[]> {
    const sections: AssemblySection[] = [];

    // Generate platform-specific header
    sections.push(this.generateHeaderSection(program));

    // Generate BASIC stub if requested
    if (this.options.autoRun) {
      sections.push(this.generateBasicStubSection());
    }

    // Generate global data section
    if (program.globalData.length > 0) {
      sections.push(this.generateGlobalDataSection(program));
    }

    // Generate code sections for each module
    for (const module of program.modules) {
      const moduleSection = await this.generateModuleSection(module);
      sections.push(moduleSection);
    }

    // Generate platform cleanup
    sections.push(this.generateCleanupSection());

    return sections;
  }

  /**
   * Generate header section with platform information
   */
  private generateHeaderSection(program: ILProgram): AssemblySection {
    const lines: string[] = [];

    // File header
    lines.push('; ============================================================================');
    lines.push(`; Blend65 Generated Assembly - ${program.name}`);
    lines.push(`; Target Platform: ${this.platform.displayName}`);
    lines.push(`; Generated: ${new Date().toISOString()}`);
    lines.push(`; Compiler: Blend65 v${program.sourceInfo.compilerVersion}`);
    lines.push('; ============================================================================');
    lines.push('');

    // Platform-specific settings
    lines.push(this.platform.generateComment('Platform Configuration'));
    lines.push(`; Processor: ${this.platform.specification.processor}`);
    lines.push(
      `; BASIC Start: $${this.platform.specification.basicStart.toString(16).toUpperCase()}`
    );
    lines.push(`; ML Start: $${this.platform.specification.mlStart.toString(16).toUpperCase()}`);
    lines.push('');

    // Assembly directives
    lines.push('!cpu 6502        ; Specify processor type');
    lines.push(`!to "${program.name.toLowerCase()}.prg",cbm  ; Output format`);
    lines.push('');

    return {
      name: 'header',
      lines,
      labels: new Map(),
      sourceLines: new Map(),
    };
  }

  /**
   * Generate BASIC stub section
   */
  private generateBasicStubSection(): AssemblySection {
    const entryPoint = this.options.entryPoint || this.platform.specification.mlStart;

    const stub = this.platform.generateBasicStub({
      entryPoint,
      autoRun: this.options.autoRun,
      preserveStub: true,
    });

    return {
      name: 'basic-stub',
      lines: stub.split('\n').filter(line => line.trim()),
      labels: new Map(),
      sourceLines: new Map(),
    };
  }

  /**
   * Generate global data section
   */
  private generateGlobalDataSection(program: ILProgram): AssemblySection {
    const lines: string[] = [];
    const labels = new Map<string, number>();

    lines.push('; Global Data Section');
    lines.push('');

    for (const data of program.globalData) {
      const qualifiedName = data.qualifiedName.join('_') + '_' + data.name;

      // Generate data declaration based on storage class
      if (data.storageClass) {
        lines.push(`; ${data.name}: ${data.storageClass} ${data.type.kind || 'unknown'}`);

        if (data.initialValue) {
          switch (data.storageClass) {
            case 'zp':
              lines.push(
                `${qualifiedName} = $${this.platform.allocateZeroPage(data.name).toString(16).toUpperCase()}`
              );
              break;
            case 'data':
              lines.push(`${qualifiedName}: !byte ${data.initialValue.value}`);
              break;
            case 'const':
              lines.push(`${qualifiedName} = ${data.initialValue.value}`);
              break;
          }
        } else {
          lines.push(`${qualifiedName}: !byte 0  ; Uninitialized`);
        }

        labels.set(qualifiedName, 0); // Address will be resolved later
      }

      lines.push('');
    }

    return {
      name: 'global-data',
      lines,
      labels,
      sourceLines: new Map(),
    };
  }

  /**
   * Generate module section
   */
  private async generateModuleSection(module: any): Promise<AssemblySection> {
    const lines: string[] = [];
    const labels = new Map<string, number>();
    const sourceLines = new Map<number, number>();

    lines.push(`; Module: ${module.qualifiedName.join('.')}`);
    lines.push('');

    // Generate functions
    for (const func of module.functions) {
      const functionSection = await this.generateFunctionCode(func);
      lines.push(...functionSection.lines);

      // Merge labels
      for (const [label, addr] of functionSection.labels) {
        labels.set(label, addr);
      }

      // Merge source lines
      for (const [sourceLine, asmLine] of functionSection.sourceLines) {
        sourceLines.set(sourceLine, asmLine + lines.length);
      }
    }

    return {
      name: `module-${module.qualifiedName.join('-')}`,
      lines,
      labels,
      sourceLines,
    };
  }

  /**
   * Generate code for a single function
   */
  private async generateFunctionCode(func: ILFunction): Promise<AssemblySection> {
    const lines: string[] = [];
    const labels = new Map<string, number>();
    const sourceLines = new Map<number, number>();

    // Function header
    lines.push(`; Function: ${func.name}`);
    lines.push(`; Qualified: ${func.qualifiedName.join('.')}`);
    lines.push(`; Parameters: ${func.parameters.length}`);
    lines.push(`; Return Type: ${func.returnType.kind || 'unknown'}`);
    lines.push('');

    // Function label
    const functionLabel = func.qualifiedName.join('_');
    lines.push(`${functionLabel}:`);
    labels.set(functionLabel, lines.length - 1);

    // Function prologue
    if (func.localVariables.length > 0) {
      lines.push('    ; Function prologue');
      // TODO: Generate actual prologue based on local variables
    }

    // Generate instructions
    this.context.currentFunction = func.name;

    for (let i = 0; i < func.instructions.length; i++) {
      const instruction = func.instructions[i];
      const mappingResult = this.mapper.mapInstruction(instruction);

      // Add source line mapping
      if (instruction.sourceLocation) {
        sourceLines.set(instruction.sourceLocation.line, lines.length);
      }

      // Add generated assembly
      for (const asmLine of mappingResult.assembly) {
        lines.push(`    ${asmLine}`);
      }

      // Add generated labels
      for (const label of mappingResult.labels) {
        labels.set(label, lines.length);
      }

      // Update register state
      // TODO: Track register usage for optimization

      // Update stack depth
      this.context.stackDepth += mappingResult.stackChange;
    }

    // Function epilogue
    if (func.localVariables.length > 0) {
      lines.push('    ; Function epilogue');
      // TODO: Generate actual epilogue based on local variables
    }

    lines.push('');

    return {
      name: `function-${func.name}`,
      lines,
      labels,
      sourceLines,
    };
  }

  /**
   * Generate platform cleanup section
   */
  private generateCleanupSection(): AssemblySection {
    const lines: string[] = [];

    lines.push('; Platform Cleanup');
    lines.push(this.platform.generateCleanup());
    lines.push('');

    return {
      name: 'cleanup',
      lines: lines.filter(line => line.trim()),
      labels: new Map(),
      sourceLines: new Map(),
    };
  }

  /**
   * Combine assembly sections into final output
   */
  private combineAssemblySections(sections: AssemblySection[]): string {
    const allLines: string[] = [];

    for (const section of sections) {
      if (section.lines.length > 0) {
        allLines.push(...section.lines);
      }
    }

    return allLines.join('\n');
  }

  /**
   * Generate source map data
   */
  private generateSourceMap(sections: AssemblySection[]): SourceMapData {
    const lineMapping = new Map<number, number[]>();

    // Combine source line mappings from all sections
    let asmLineOffset = 0;
    for (const section of sections) {
      for (const [sourceLine, asmLine] of section.sourceLines) {
        const adjustedAsmLine = asmLine + asmLineOffset;
        if (!lineMapping.has(sourceLine)) {
          lineMapping.set(sourceLine, []);
        }
        lineMapping.get(sourceLine)!.push(adjustedAsmLine);
      }
      asmLineOffset += section.lines.length;
    }

    return {
      lineMapping,
      sources: [], // TODO: Extract from IL program
      version: 1,
    };
  }

  /**
   * Create initial memory layout
   */
  private createInitialMemoryLayout(): MemoryLayoutInfo {
    return {
      programStart: this.platform.specification.mlStart,
      programEnd: 0, // Will be calculated
      zeroPageUsage: new Map(),
      stackUsage: 0,
      totalMemory: 0,
    };
  }

  /**
   * Create initial compilation statistics
   */
  private createInitialStats(): CompilationStats {
    return {
      instructionCount: 0,
      estimatedCycles: 0,
      functionsCompiled: 0,
      compilationTime: 0,
      codeSize: 0,
    };
  }

  /**
   * Estimate code size from assembly
   */
  private estimateCodeSize(assembly: string): number {
    // Simple estimation based on line count
    // TODO: Implement proper size calculation
    const lines = assembly.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith(';') && !trimmed.endsWith(':');
    });

    return lines.length * 2; // Rough estimate: 2 bytes per instruction
  }

}

/**
 * Assembly section representation
 */
interface AssemblySection {
  name: string;
  lines: string[];
  labels: Map<string, number>;
  sourceLines: Map<number, number>;
}
