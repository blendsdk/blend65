/**
 * Entry point for the Blend parser surface area.
 * Re-exporting from this module grants consumers access to AST types,
 * diagnostic helpers, node factories, and source span utilities while
 * keeping imports ergonomic.
 */
export * from './ast.js';
export * from './diagnostics.js';
export * from './factory.js';
export * from './source.js';
