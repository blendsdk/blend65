#!/usr/bin/env node

/**
 * Blend65 CLI Entry Point
 *
 * This is the executable entry point for the blend65 command.
 * It imports and runs the main CLI module.
 */

import { main } from '../dist/index.js';

main(process.argv.slice(2));