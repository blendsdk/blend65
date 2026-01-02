/**
 * Module System AST Node Types for Blend65
 *
 * Defines AST nodes for Blend65's module system including:
 * - Module declarations
 * - Import/export declarations
 * - Target-specific module resolution
 * - Qualified names
 */

import { Blend65ASTNode } from './core.js';

/**
 * Qualified name for module references (e.g., Game.Main, Engine.Graphics)
 */
export interface QualifiedName extends Blend65ASTNode {
  type: 'QualifiedName';
  parts: string[];
}

/**
 * Module declaration
 * Example: module Game.Main
 */
export interface ModuleDeclaration extends Blend65ASTNode {
  type: 'ModuleDeclaration';
  name: QualifiedName;
}

/**
 * Import specifier for individual imports
 * Example: func, sprite as mySprite
 */
export interface ImportSpecifier extends Blend65ASTNode {
  type: 'ImportSpecifier';
  imported: string;           // Name being imported
  local: string | null;       // Local name (null if same as imported)
}

/**
 * Import declaration with target support
 * Examples:
 * - import func from Engine.Logic
 * - import sprite from c64:sprites
 * - import VIC_REG from target:hardware
 */
export interface ImportDeclaration extends Blend65ASTNode {
  type: 'ImportDeclaration';
  specifiers: ImportSpecifier[];
  source: QualifiedName | TargetModule;
}

/**
 * Target-specific module reference
 * Examples: c64:sprites, x16:vera, target:hardware
 */
export interface TargetModule extends Blend65ASTNode {
  type: 'TargetModule';
  target: string;             // Target name (c64, x16, target)
  module: string;             // Module name within target
}

/**
 * Export declaration
 * Example: export function calculateScore
 */
export interface ExportDeclaration extends Blend65ASTNode {
  type: 'ExportDeclaration';
  declaration: Blend65ASTNode;       // The declaration being exported
}

/**
 * Re-export declaration
 * Example: export func from Engine.Logic
 */
export interface ReexportDeclaration extends Blend65ASTNode {
  type: 'ReexportDeclaration';
  specifiers: ImportSpecifier[];
  source: QualifiedName | TargetModule;
}

// Type unions for module-related nodes
export type ModuleSystemNode =
  | ModuleDeclaration
  | ImportDeclaration
  | ExportDeclaration
  | ReexportDeclaration
  | ImportSpecifier
  | QualifiedName
  | TargetModule;
