# Project Setup: Monorepo Integration & Packaging

> **Document**: 03-project-setup.md
> **Parent**: [Index](00-index.md)
> **Status**: Complete

## Overview

The VS Code extension lives as `packages/vscode-blend65` within the existing Blend65 monorepo. It uses the `@blend65/compiler` package as a workspace dependency for its LSP server.

## Package Structure

```
packages/vscode-blend65/
├── package.json                    # Extension manifest + VS Code contributes
├── tsconfig.json                   # TypeScript config (client + server)
├── esbuild.config.mjs             # Bundle client + server separately
├── .vscodeignore                  # Exclude dev files from VSIX
├── language-configuration.json     # Bracket/comment/indent config
├── README.md                      # Marketplace README
├── CHANGELOG.md                   # Version history
├── LICENSE.md                     # License (Elastic-2.0)
├── icon.png                       # 128x128+ extension icon (TODO.md)
├── src/
│   ├── extension.ts               # Client entry — activates LSP client
│   ├── client.ts                  # LSP client setup (stdio transport)
│   └── server/
│       ├── server.ts              # LSP server entry — initialize, capabilities
│       ├── document-manager.ts    # Document lifecycle + analysis cache
│       ├── diagnostics.ts         # Compiler → LSP diagnostic mapping
│       ├── completion.ts          # Autocomplete provider
│       ├── hover.ts               # Hover info provider
│       ├── definition.ts          # Go-to-definition
│       ├── symbols.ts             # Document/workspace symbols
│       ├── signature-help.ts      # Parameter hints
│       ├── references.ts          # Find all references
│       ├── rename.ts              # Rename symbol
│       ├── formatting.ts          # Document formatter
│       ├── code-actions.ts        # Quick fixes
│       ├── semantic-tokens.ts     # Semantic highlighting
│       ├── folding.ts             # Code folding ranges
│       └── data/
│           ├── intrinsics.ts      # 10 intrinsic function definitions
│           ├── asm-functions.ts   # 151 asm_* function definitions
│           └── hardware.ts        # C64 hardware constant docs
├── syntaxes/
│   └── blend.tmLanguage.json      # TextMate grammar
└── snippets/
    └── blend.json                 # Code snippets
```

## package.json — Extension Manifest

### Key Fields

```jsonc
{
  "name": "vscode-blend65",
  "displayName": "Blend65 Programming Language",
  "description": "Syntax highlighting, IntelliSense, and diagnostics for the Blend65 6502 language",
  "version": "0.1.0",
  "publisher": "blend65",            // TODO: Set actual publisher ID (TODO.md)
  "license": "Elastic-2.0",
  "engines": { "vscode": "^1.85.0" },
  "categories": ["Programming Languages", "Linters", "Snippets"],
  "keywords": ["blend65", "6502", "c64", "commodore", "retro", "assembly"],
  "icon": "icon.png",
  "main": "./dist/extension.js",     // Client entry (bundled)
  "activationEvents": [],            // onLanguage is implicit via contributes.languages
}
```

### contributes Section

```jsonc
{
  "contributes": {
    "languages": [{
      "id": "blend",
      "aliases": ["Blend65", "blend65", "Blend"],
      "extensions": [".blend"],
      "configuration": "./language-configuration.json",
      "icon": { "light": "./icon.png", "dark": "./icon.png" }
    }],
    "grammars": [{
      "language": "blend",
      "scopeName": "source.blend",
      "path": "./syntaxes/blend.tmLanguage.json"
    }],
    "snippets": [{
      "language": "blend",
      "path": "./snippets/blend.json"
    }],
    "configuration": {
      "title": "Blend65",
      "properties": {
        "blend65.diagnostics.enable": {
          "type": "boolean",
          "default": true,
          "description": "Enable real-time diagnostics"
        },
        "blend65.diagnostics.onSave": {
          "type": "boolean",
          "default": true,
          "description": "Run full analysis on save"
        },
        "blend65.trace.server": {
          "type": "string",
          "enum": ["off", "messages", "verbose"],
          "default": "off",
          "description": "Trace LSP communication (for debugging)"
        }
      }
    }
  }
}
```

### Dependencies

```jsonc
{
  "dependencies": {
    "vscode-languageclient": "^9.0.1",     // LSP client
    "vscode-languageserver": "^9.0.1",      // LSP server
    "vscode-languageserver-textdocument": "^1.0.12"
  },
  "devDependencies": {
    "@types/vscode": "^1.85.0",             // VS Code API types
    "@blend65/compiler": "*",               // Workspace dependency
    "esbuild": "^0.24.0",                  // Bundler
    "typescript": "^5.9.3",
    "vitest": "4.0.18"
  }
}
```

**Note:** `@blend65/compiler` is a devDependency because it's bundled into the server at build time (not shipped separately).

### Scripts

```jsonc
{
  "scripts": {
    "build": "node esbuild.config.mjs",
    "watch": "node esbuild.config.mjs --watch",
    "clean": "rm -rf dist",
    "package": "vsce package --no-dependencies",
    "publish": "vsce publish --no-dependencies",
    "test": "vitest run",
    "type-check": "tsc --noEmit"
  }
}
```

## tsconfig.json

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": false,        // Not a library — no .d.ts needed
    "sourceMap": true            // For debugging
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Note:** TypeScript is used for type checking only — esbuild handles the actual bundling/transpilation.

## esbuild.config.mjs

The extension requires **two separate bundles** — one for the client (runs in VS Code's extension host) and one for the server (runs as a child process via stdio).

```javascript
import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

/** Shared build options */
const shared = {
  bundle: true,
  format: 'cjs',           // VS Code extensions must be CommonJS
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  minify: false,            // Keep readable for debugging
  logLevel: 'info',
};

/** Client bundle — runs in VS Code extension host */
const clientBuild = {
  ...shared,
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  external: ['vscode'],     // VS Code API is provided by the host
};

/** Server bundle — runs as standalone Node.js process */
const serverBuild = {
  ...shared,
  entryPoints: ['src/server/server.ts'],
  outfile: 'dist/server.js',
  // No externals — everything bundled (including @blend65/compiler)
};

if (isWatch) {
  const ctx1 = await esbuild.context(clientBuild);
  const ctx2 = await esbuild.context(serverBuild);
  await ctx1.watch();
  await ctx2.watch();
} else {
  await esbuild.build(clientBuild);
  await esbuild.build(serverBuild);
}
```

**Key decisions:**
- **CJS format** — VS Code requires CommonJS for extensions
- **Two entry points** — client and server are separate processes
- **`vscode` external** — only in client (provided by VS Code host)
- **Compiler bundled into server** — `@blend65/compiler` is included in the server bundle so no workspace dependency needed at runtime

## .vscodeignore

```
.vscode/**
src/**
node_modules/**
.gitignore
tsconfig.json
esbuild.config.mjs
**/*.ts
**/*.map
```

**Included in VSIX:**
- `dist/extension.js` — bundled client
- `dist/server.js` — bundled server
- `syntaxes/blend.tmLanguage.json` — TextMate grammar
- `language-configuration.json` — language config
- `snippets/blend.json` — code snippets
- `icon.png` — extension icon
- `README.md` — marketplace page
- `CHANGELOG.md` — version history
- `LICENSE.md` — license
- `package.json` — extension manifest

## language-configuration.json

```jsonc
{
  "comments": {
    "lineComment": "//",
    "blockComment": ["/*", "*/"]
  },
  "brackets": [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"]
  ],
  "autoClosingPairs": [
    { "open": "{", "close": "}" },
    { "open": "[", "close": "]" },
    { "open": "(", "close": ")" },
    { "open": "'", "close": "'", "notIn": ["string", "comment"] },
    { "open": "\"", "close": "\"", "notIn": ["string", "comment"] },
    { "open": "/*", "close": " */", "notIn": ["string"] }
  ],
  "surroundingPairs": [
    ["{", "}"],
    ["[", "]"],
    ["(", ")"],
    ["'", "'"],
    ["\"", "\""]
  ],
  "folding": {
    "markers": {
      "start": "^\\s*//\\s*#?region\\b",
      "end": "^\\s*//\\s*#?endregion\\b"
    }
  },
  "indentationRules": {
    "increaseIndentPattern": "^.*\\{[^}\"']*$|^.*\\([^)\"']*$",
    "decreaseIndentPattern": "^\\s*(\\}|\\))"
  },
  "wordPattern": "[a-zA-Z_][a-zA-Z0-9_]*|@[a-z]+|\\$[0-9A-Fa-f]+|0x[0-9A-Fa-f]+|0b[01]+"
}
```

**Key features:**
- `//` line comments and `/* */` block comments
- Standard bracket matching and auto-close
- Indentation rules for `{` and `}`
- `wordPattern` includes `@zp`, `@ram`, `@data`, `$hex`, `0xhex`, `0bbinary` patterns
- Region folding markers (`// #region` / `// #endregion`)

## Monorepo Integration

### Root package.json Changes

The `packages/vscode-blend65` folder is automatically included by the existing workspace glob:

```jsonc
{
  "workspaces": [
    "packages/*",       // ← Already covers packages/vscode-blend65
    "packages/*/*"
  ]
}
```

No root `package.json` changes needed.

### turbo.json Changes

Add extension-specific tasks:

```jsonc
{
  "tasks": {
    // ... existing tasks ...
    "package": {
      "dependsOn": ["build"],
      "outputs": ["*.vsix"]
    }
  }
}
```

The existing `build`, `test`, `clean` tasks already work for the extension since it follows the same script naming conventions.

## Extension Activation Flow

```
1. User opens .blend file
2. VS Code activates extension (contributes.languages match)
3. extension.ts → activate() runs
4. Creates LanguageClient with stdio transport
5. Spawns server.ts as child process
6. Client/server perform LSP initialize handshake
7. Server declares capabilities (completion, hover, diagnostics, etc.)
8. Client forwards document events to server
9. Server runs compiler pipeline on document text
10. Server pushes diagnostics back to client
11. User triggers completion/hover → client forwards → server responds
```

## Build & Development Workflow

```bash
# Development (auto-rebuild on change)
cd packages/vscode-blend65
yarn watch

# Then press F5 in VS Code to launch Extension Development Host

# Production build
yarn build

# Package VSIX
yarn package

# Publish
yarn publish
```

## Error Handling

- **Bundling errors** — esbuild reports at build time; TypeScript `--noEmit` for type checking
- **Runtime errors** — LSP server crashes are caught by client, auto-restarts
- **Compiler errors** — wrapped in try/catch, converted to LSP diagnostics
- **Missing compiler** — if `@blend65/compiler` fails to resolve, server logs error and provides degraded mode (syntax highlighting only, no diagnostics)
