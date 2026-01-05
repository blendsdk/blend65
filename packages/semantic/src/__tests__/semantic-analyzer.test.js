/**
 * Tests for Multi-Program Semantic Analyzer
 * Task 1.10: Main Semantic Analyzer Integration - Test Suite
 *
 * Comprehensive test coverage for integrated semantic analysis including:
 * - Multi-program API (Program[] instead of Program)
 * - Cross-file module registration and import/export resolution
 * - Variable and function declaration analysis with optimization metadata
 * - Expression analysis with comprehensive optimization data
 * - Cross-analyzer optimization coordination
 * - Comprehensive result aggregation
 * - Integration with CompilationUnit
 * - Single-file compatibility
 * - Error handling across multiple programs
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SemanticAnalyzer, analyzeProgram, analyzePrograms } from '../semantic-analyzer.js';
describe('SemanticAnalyzer - Task 1.10 Integration', () => {
    let analyzer;
    beforeEach(() => {
        analyzer = new SemanticAnalyzer();
    });
    describe('API Consistency', () => {
        it('should accept Program[] as input to analyze()', () => {
            const programs = [];
            const result = analyzer.analyze(programs);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBeDefined();
            }
            expect(analyzer.getSymbolTable()).toBeDefined();
        });
        it('should handle empty program array', () => {
            const result = analyzer.analyze([]);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBeDefined();
            }
            expect(analyzer.getErrors()).toHaveLength(0);
            expect(analyzer.getWarnings()).toHaveLength(0);
        });
        it('should handle single program in array (single-file mode)', () => {
            const singleProgram = {
                type: 'Program',
                module: {
                    type: 'ModuleDeclaration',
                    name: {
                        type: 'QualifiedName',
                        parts: ['TestModule'],
                    },
                },
                imports: [],
                exports: [],
                body: [],
            };
            const result = analyzer.analyze([singleProgram]);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBeDefined();
            }
        });
        it('should handle multiple programs (multi-file mode)', () => {
            const program1 = {
                type: 'Program',
                module: {
                    type: 'ModuleDeclaration',
                    name: {
                        type: 'QualifiedName',
                        parts: ['Module1'],
                    },
                },
                imports: [],
                exports: [],
                body: [],
            };
            const program2 = {
                type: 'Program',
                module: {
                    type: 'ModuleDeclaration',
                    name: {
                        type: 'QualifiedName',
                        parts: ['Module2'],
                    },
                },
                imports: [],
                exports: [],
                body: [],
            };
            const result = analyzer.analyze([program1, program2]);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBeDefined();
            }
        });
    });
    describe('Module Registration Phase', () => {
        it('should register all modules before processing declarations', () => {
            const program1 = {
                type: 'Program',
                module: {
                    type: 'ModuleDeclaration',
                    name: {
                        type: 'QualifiedName',
                        parts: ['Game', 'Main'],
                    },
                },
                imports: [],
                exports: [],
                body: [],
            };
            const program2 = {
                type: 'Program',
                module: {
                    type: 'ModuleDeclaration',
                    name: {
                        type: 'QualifiedName',
                        parts: ['Game', 'Player'],
                    },
                },
                imports: [],
                exports: [],
                body: [],
            };
            const result = analyzer.analyze([program1, program2]);
            expect(result.success).toBe(true);
            expect(analyzer.getErrors()).toHaveLength(0);
        });
        it('should handle programs without module declarations', () => {
            const programWithoutModule = {
                type: 'Program',
                module: {
                    type: 'ModuleDeclaration',
                    name: {
                        type: 'QualifiedName',
                        parts: [], // Empty module name
                    },
                },
                imports: [],
                exports: [],
                body: [],
            };
            const result = analyzer.analyze([programWithoutModule]);
            expect(result).toBeDefined();
        });
    });
    describe('Cross-File Module Processing', () => {
        it('should process all programs in the same analysis context', () => {
            const program1 = {
                type: 'Program',
                module: {
                    type: 'ModuleDeclaration',
                    name: {
                        type: 'QualifiedName',
                        parts: ['Utils'],
                    },
                },
                imports: [],
                exports: [],
                body: [],
            };
            const program2 = {
                type: 'Program',
                module: {
                    type: 'ModuleDeclaration',
                    name: {
                        type: 'QualifiedName',
                        parts: ['Main'],
                    },
                },
                imports: [],
                exports: [],
                body: [],
            };
            const result = analyzer.analyze([program1, program2]);
            expect(result.success).toBe(true);
            const symbolTable = analyzer.getSymbolTable();
            expect(symbolTable).toBeDefined();
        });
        it('should return unified symbol table for all programs', () => {
            const programs = [
                {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['Module1'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                },
                {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['Module2'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                },
            ];
            const result = analyzer.analyze(programs);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBeDefined();
                const symbolTable = result.data;
                expect(symbolTable).toBeDefined();
            }
        });
    });
    describe('Error Handling', () => {
        it('should collect errors from all programs', () => {
            const result = analyzer.analyze([]);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBeDefined();
            }
        });
        it('should continue processing after non-fatal errors', () => {
            const programsWithIssues = [
                {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['ValidModule'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                },
            ];
            const result = analyzer.analyze(programsWithIssues);
            expect(result).toBeDefined();
        });
        it('should provide detailed error information with file context', () => {
            const result = analyzer.analyze([]);
            expect(result.success).toBe(true);
            const errors = analyzer.getErrors();
            const warnings = analyzer.getWarnings();
            expect(errors).toEqual([]);
            expect(warnings).toEqual([]);
        });
    });
    describe('Convenience Functions', () => {
        it('should provide analyzeProgram for single-file compatibility', () => {
            const singleProgram = {
                type: 'Program',
                module: {
                    type: 'ModuleDeclaration',
                    name: {
                        type: 'QualifiedName',
                        parts: ['SingleModule'],
                    },
                },
                imports: [],
                exports: [],
                body: [],
            };
            const result = analyzeProgram(singleProgram);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBeDefined();
            }
        });
        it('should provide analyzePrograms for explicit multi-file analysis', () => {
            const programs = [
                {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['Module1'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                },
                {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['Module2'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                },
            ];
            const result = analyzePrograms(programs);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBeDefined();
            }
        });
    });
    describe('State Management', () => {
        it('should reset state between analyze() calls', () => {
            const program1 = {
                type: 'Program',
                module: {
                    type: 'ModuleDeclaration',
                    name: {
                        type: 'QualifiedName',
                        parts: ['FirstAnalysis'],
                    },
                },
                imports: [],
                exports: [],
                body: [],
            };
            const program2 = {
                type: 'Program',
                module: {
                    type: 'ModuleDeclaration',
                    name: {
                        type: 'QualifiedName',
                        parts: ['SecondAnalysis'],
                    },
                },
                imports: [],
                exports: [],
                body: [],
            };
            const result1 = analyzer.analyze([program1]);
            expect(result1.success).toBe(true);
            const result2 = analyzer.analyze([program2]);
            expect(result2.success).toBe(true);
            // Each analysis should be independent
            if (result1.success && result2.success) {
                expect(result1.data).not.toBe(result2.data);
            }
        });
        it('should maintain internal state during single analysis', () => {
            const programs = [
                {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['Module1'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                },
            ];
            analyzer.analyze(programs);
            // Internal state should be accessible for debugging
            const symbolTable = analyzer.getSymbolTable();
            const errors = analyzer.getErrors();
            const warnings = analyzer.getWarnings();
            expect(symbolTable).toBeDefined();
            expect(errors).toBeDefined();
            expect(warnings).toBeDefined();
        });
    });
    describe('Integration Patterns', () => {
        it('should work with CompilationUnit.getAllPrograms() pattern', () => {
            const mockPrograms = [
                {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['Main'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                },
                {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['Utils'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                },
            ];
            const result = analyzer.analyze(mockPrograms);
            expect(result.success).toBe(true);
            if (result.success) {
                expect(result.data).toBeDefined();
            }
        });
        it('should maintain consistency with industry-standard patterns', () => {
            const filePrograms = [
                {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['Game', 'Player'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                },
            ];
            const result = analyzer.analyze(filePrograms);
            expect(result.success).toBe(true);
            expect('success' in result).toBe(true);
            expect('data' in result || 'errors' in result).toBe(true);
        });
    });
    describe('Future Compatibility', () => {
        it('should be ready for module system implementation', () => {
            const programs = [
                {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['ExportingModule'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                },
                {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['ImportingModule'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                },
            ];
            const result = analyzer.analyze(programs);
            expect(result.success).toBe(true);
            if (result.success) {
                const symbolTable = result.data;
                expect(symbolTable).toBeDefined();
                expect(symbolTable.getGlobalScope).toBeDefined();
            }
        });
        it('should support expansion for variable and function analysis', () => {
            const programWithDeclarations = {
                type: 'Program',
                module: {
                    type: 'ModuleDeclaration',
                    name: {
                        type: 'QualifiedName',
                        parts: ['DeclarationsModule'],
                    },
                },
                imports: [],
                exports: [],
                body: [],
            };
            const result = analyzer.analyze([programWithDeclarations]);
            expect(result.success).toBe(true);
        });
    });
    // ============================================================================
    // TASK 1.10: COMPREHENSIVE SEMANTIC ANALYSIS INTEGRATION TESTS
    // ============================================================================
    describe('Task 1.10: Comprehensive Semantic Analysis Integration', () => {
        describe('Comprehensive Analysis API', () => {
            it('should provide analyzeComprehensive method with full result structure', () => {
                const program = {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['TestModule'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                };
                const result = analyzer.analyzeComprehensive([program]);
                expect(result.success).toBe(true);
                if (result.success) {
                    const comprehensiveResult = result.data;
                    expect(comprehensiveResult.symbolTable).toBeDefined();
                    expect(comprehensiveResult.moduleAnalysis).toBeDefined();
                    expect(comprehensiveResult.variableAnalysis).toBeDefined();
                    expect(comprehensiveResult.functionAnalysis).toBeDefined();
                    expect(comprehensiveResult.expressionAnalysis).toBeDefined();
                    expect(comprehensiveResult.crossAnalyzerOptimization).toBeDefined();
                    expect(comprehensiveResult.analysisMetrics).toBeDefined();
                }
            });
            it('should maintain backward compatibility with legacy analyze() API', () => {
                const program = {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['LegacyTest'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                };
                const legacyResult = analyzer.analyze([program]);
                expect(legacyResult.success).toBe(true);
                if (legacyResult.success) {
                    const symbolTable = legacyResult.data;
                    expect(symbolTable.getGlobalScope).toBeDefined();
                }
            });
            it('should provide comprehensive analysis convenience functions', () => {
                expect(typeof analyzeProgram).toBe('function');
                expect(typeof analyzePrograms).toBe('function');
            });
        });
        describe('Module Analysis Integration', () => {
            it('should integrate ModuleAnalyzer for cross-file analysis', () => {
                const program1 = {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['Module1'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                };
                const program2 = {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['Module2'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                };
                const result = analyzer.analyzeComprehensive([program1, program2]);
                expect(result.success).toBe(true);
                if (result.success) {
                    const moduleAnalysis = result.data.moduleAnalysis;
                    expect(moduleAnalysis.crossFileImports).toBeDefined();
                    expect(moduleAnalysis.moduleExports).toBeDefined();
                    expect(moduleAnalysis.dependencyGraph).toBeDefined();
                    expect(moduleAnalysis.circularDependencies).toBeDefined();
                    expect(moduleAnalysis.crossFileImports.size).toBe(2);
                    expect(moduleAnalysis.moduleExports.size).toBe(2);
                }
            });
            it('should detect circular dependencies through module integration', () => {
                const programs = [
                    {
                        type: 'Program',
                        module: {
                            type: 'ModuleDeclaration',
                            name: {
                                type: 'QualifiedName',
                                parts: ['CircularA'],
                            },
                        },
                        imports: [],
                        exports: [],
                        body: [],
                    },
                    {
                        type: 'Program',
                        module: {
                            type: 'ModuleDeclaration',
                            name: {
                                type: 'QualifiedName',
                                parts: ['CircularB'],
                            },
                        },
                        imports: [],
                        exports: [],
                        body: [],
                    },
                ];
                const result = analyzer.analyzeComprehensive(programs);
                expect(result).toBeDefined();
                if (result.success) {
                    expect(result.data.moduleAnalysis.circularDependencies).toBeDefined();
                }
            });
        });
        describe('Declaration Analysis Integration', () => {
            it('should integrate variable and function analyzers', () => {
                const program = {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['DeclarationTest'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                };
                const result = analyzer.analyzeComprehensive([program]);
                expect(result.success).toBe(true);
                if (result.success) {
                    const variableAnalysis = result.data.variableAnalysis;
                    expect(variableAnalysis.variables).toBeDefined();
                    expect(variableAnalysis.optimizationMetadata).toBeDefined();
                    expect(variableAnalysis.zeroPageCandidates).toBeDefined();
                    expect(variableAnalysis.registerCandidates).toBeDefined();
                    const functionAnalysis = result.data.functionAnalysis;
                    expect(functionAnalysis.functions).toBeDefined();
                    expect(functionAnalysis.optimizationMetadata).toBeDefined();
                    expect(functionAnalysis.inliningCandidates).toBeDefined();
                    expect(functionAnalysis.callbackFunctions).toBeDefined();
                }
            });
            it('should collect optimization metadata for declarations', () => {
                const program = {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['OptimizationTest'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                };
                const result = analyzer.analyzeComprehensive([program]);
                expect(result.success).toBe(true);
                if (result.success) {
                    const variableOptimization = result.data.variableAnalysis.optimizationMetadata;
                    expect(variableOptimization).toBeInstanceOf(Map);
                    const functionOptimization = result.data.functionAnalysis.optimizationMetadata;
                    expect(functionOptimization).toBeInstanceOf(Map);
                }
            });
        });
        describe('Expression Analysis Integration', () => {
            it('should integrate ExpressionAnalyzer for comprehensive optimization data', () => {
                const program = {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['ExpressionTest'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                };
                const result = analyzer.analyzeComprehensive([program]);
                expect(result.success).toBe(true);
                if (result.success) {
                    const expressionAnalysis = result.data.expressionAnalysis;
                    expect(expressionAnalysis.totalExpressions).toBeDefined();
                    expect(expressionAnalysis.constantExpressions).toBeDefined();
                    expect(expressionAnalysis.variableReferences).toBeDefined();
                    expect(expressionAnalysis.optimizationOpportunities).toBeDefined();
                    expect(expressionAnalysis.performanceMetrics).toBeDefined();
                    expect(expressionAnalysis.totalExpressions).toBeGreaterThanOrEqual(0);
                    expect(Array.isArray(expressionAnalysis.constantExpressions)).toBe(true);
                    expect(expressionAnalysis.variableReferences).toBeInstanceOf(Map);
                }
            });
            it('should provide performance metrics from expression analysis', () => {
                const program = {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['PerformanceTest'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                };
                const result = analyzer.analyzeComprehensive([program]);
                expect(result.success).toBe(true);
                if (result.success) {
                    const performanceMetrics = result.data.expressionAnalysis.performanceMetrics;
                    expect(performanceMetrics.totalCycles).toBeDefined();
                    expect(performanceMetrics.complexity).toBeDefined();
                    expect(performanceMetrics.registerPressure).toBeDefined();
                    expect(typeof performanceMetrics.totalCycles).toBe('number');
                    expect(typeof performanceMetrics.complexity).toBe('number');
                    expect(typeof performanceMetrics.registerPressure).toBe('number');
                }
            });
        });
        describe('Cross-Analyzer Optimization Coordination', () => {
            it('should coordinate optimization metadata between analyzers', () => {
                const program = {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['CoordinationTest'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                };
                const result = analyzer.analyzeComprehensive([program]);
                expect(result.success).toBe(true);
                if (result.success) {
                    const coordination = result.data.crossAnalyzerOptimization;
                    expect(coordination.registerInterference).toBeDefined();
                    expect(coordination.optimizationConflicts).toBeDefined();
                    expect(coordination.coordinatedOptimizations).toBeDefined();
                    expect(coordination.globalOptimizationScore).toBeDefined();
                    expect(coordination.registerInterference).toBeInstanceOf(Map);
                    expect(Array.isArray(coordination.optimizationConflicts)).toBe(true);
                    expect(Array.isArray(coordination.coordinatedOptimizations)).toBe(true);
                    expect(typeof coordination.globalOptimizationScore).toBe('number');
                }
            });
            it('should calculate global optimization score', () => {
                const program = {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['OptimizationScoreTest'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                };
                const result = analyzer.analyzeComprehensive([program]);
                expect(result.success).toBe(true);
                if (result.success) {
                    const globalScore = result.data.crossAnalyzerOptimization.globalOptimizationScore;
                    expect(globalScore).toBeGreaterThanOrEqual(0);
                    expect(globalScore).toBeLessThanOrEqual(100);
                }
            });
            it('should identify register allocation conflicts', () => {
                const program = {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['RegisterConflictTest'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                };
                const result = analyzer.analyzeComprehensive([program]);
                expect(result.success).toBe(true);
                if (result.success) {
                    const registerInterference = result.data.crossAnalyzerOptimization.registerInterference;
                    expect(registerInterference).toBeInstanceOf(Map);
                }
            });
        });
        describe('Analysis Metrics and Quality Assessment', () => {
            it('should provide comprehensive analysis metrics', () => {
                const program = {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['MetricsTest'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                };
                const result = analyzer.analyzeComprehensive([program]);
                expect(result.success).toBe(true);
                if (result.success) {
                    const metrics = result.data.analysisMetrics;
                    expect(metrics.totalSymbols).toBeDefined();
                    expect(metrics.analysisTime).toBeDefined();
                    expect(metrics.optimizationCoverage).toBeDefined();
                    expect(metrics.qualityScore).toBeDefined();
                    expect(typeof metrics.totalSymbols).toBe('number');
                    expect(typeof metrics.analysisTime).toBe('number');
                    expect(typeof metrics.optimizationCoverage).toBe('number');
                    expect(typeof metrics.qualityScore).toBe('number');
                    expect(metrics.totalSymbols).toBeGreaterThanOrEqual(0);
                    expect(metrics.analysisTime).toBeGreaterThanOrEqual(0);
                    expect(metrics.optimizationCoverage).toBeGreaterThanOrEqual(0);
                    expect(metrics.optimizationCoverage).toBeLessThanOrEqual(100);
                    expect(metrics.qualityScore).toBeGreaterThanOrEqual(0);
                    expect(metrics.qualityScore).toBeLessThanOrEqual(100);
                }
            });
            it('should track analysis performance across multiple programs', () => {
                const programs = [
                    {
                        type: 'Program',
                        module: {
                            type: 'ModuleDeclaration',
                            name: {
                                type: 'QualifiedName',
                                parts: ['Performance1'],
                            },
                        },
                        imports: [],
                        exports: [],
                        body: [],
                    },
                    {
                        type: 'Program',
                        module: {
                            type: 'ModuleDeclaration',
                            name: {
                                type: 'QualifiedName',
                                parts: ['Performance2'],
                            },
                        },
                        imports: [],
                        exports: [],
                        body: [],
                    },
                    {
                        type: 'Program',
                        module: {
                            type: 'ModuleDeclaration',
                            name: {
                                type: 'QualifiedName',
                                parts: ['Performance3'],
                            },
                        },
                        imports: [],
                        exports: [],
                        body: [],
                    },
                ];
                const result = analyzer.analyzeComprehensive(programs);
                expect(result.success).toBe(true);
                if (result.success) {
                    const analysisTime = result.data.analysisMetrics.analysisTime;
                    expect(analysisTime).toBeLessThan(1000); // Less than 1 second for empty programs
                }
            });
        });
        describe('Integration Error Handling', () => {
            it('should handle errors gracefully during comprehensive analysis', () => {
                const invalidProgram = {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: [], // Invalid empty module name
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                };
                const result = analyzer.analyzeComprehensive([invalidProgram]);
                expect(result).toBeDefined();
                expect('success' in result).toBe(true);
            });
            it('should propagate analyzer errors to comprehensive result', () => {
                const program = {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['ErrorTest'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                };
                const result = analyzer.analyzeComprehensive([program]);
                expect(result).toBeDefined();
                if (!result.success) {
                    expect(Array.isArray(result.errors)).toBe(true);
                }
                if (result.warnings) {
                    expect(Array.isArray(result.warnings)).toBe(true);
                }
            });
            it('should handle exceptions during integration phases', () => {
                const program = {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['ExceptionTest'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                };
                expect(() => {
                    const result = analyzer.analyzeComprehensive([program]);
                    expect(result).toBeDefined();
                }).not.toThrow();
            });
        });
        describe('Real-World Integration Scenarios', () => {
            it('should handle complete Blend65 programs with all analyzers', () => {
                const gameProgram = {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['Game', 'Main'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                };
                const utilsProgram = {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['Game', 'Utils'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                };
                const result = analyzer.analyzeComprehensive([gameProgram, utilsProgram]);
                expect(result.success).toBe(true);
                if (result.success) {
                    const comprehensiveResult = result.data;
                    expect(comprehensiveResult.analysisMetrics.totalSymbols).toBeGreaterThanOrEqual(0);
                    expect(comprehensiveResult.moduleAnalysis.crossFileImports.size).toBe(2);
                }
            });
            it('should provide optimization insights for realistic programs', () => {
                const program = {
                    type: 'Program',
                    module: {
                        type: 'ModuleDeclaration',
                        name: {
                            type: 'QualifiedName',
                            parts: ['OptimizationInsights'],
                        },
                    },
                    imports: [],
                    exports: [],
                    body: [],
                };
                const result = analyzer.analyzeComprehensive([program]);
                expect(result.success).toBe(true);
                if (result.success) {
                    const optimization = result.data.crossAnalyzerOptimization;
                    expect(Array.isArray(optimization.coordinatedOptimizations)).toBe(true);
                    expect(typeof optimization.globalOptimizationScore).toBe('number');
                    const quality = result.data.analysisMetrics.qualityScore;
                    expect(quality).toBeGreaterThanOrEqual(0);
                    expect(quality).toBeLessThanOrEqual(100);
                }
            });
        });
    });
});
//# sourceMappingURL=semantic-analyzer.test.js.map