/**
 * Main 6502 code generator for Blend65
 * Orchestrates the complete compilation from IL to 6502 assembly
 */
import { ILProgram } from '@blend65/il';
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
export declare class CodeGenerator {
    private platform;
    private mapper;
    private context;
    private options;
    private warnings;
    constructor(options: CodeGenOptions);
    /**
     * Generate 6502 assembly from IL program
     */
    generate(program: ILProgram): Promise<CodeGenResult>;
    /**
     * Generate assembly sections from IL program
     */
    private generateAssemblySections;
    /**
     * Generate header section with platform information
     */
    private generateHeaderSection;
    /**
     * Generate BASIC stub section
     */
    private generateBasicStubSection;
    /**
     * Generate global data section
     */
    private generateGlobalDataSection;
    /**
     * Generate module section
     */
    private generateModuleSection;
    /**
     * Generate code for a single function
     */
    private generateFunctionCode;
    /**
     * Generate platform cleanup section
     */
    private generateCleanupSection;
    /**
     * Combine assembly sections into final output
     */
    private combineAssemblySections;
    /**
     * Generate source map data
     */
    private generateSourceMap;
    /**
     * Create initial memory layout
     */
    private createInitialMemoryLayout;
    /**
     * Create initial compilation statistics
     */
    private createInitialStats;
    /**
     * Estimate code size from assembly
     */
    private estimateCodeSize;
    /**
     * Add warning to compilation warnings
     */
    private addWarning;
}
//# sourceMappingURL=code-generator.d.ts.map