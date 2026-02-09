# Marketplace & Publishing

> **Document**: 10-marketplace.md
> **Parent**: [Index](00-index.md)
> **Status**: Complete
> **Priority**: Phase 9 (Final)

## Overview

Publishing the Blend65 VS Code extension to the Visual Studio Marketplace makes it discoverable and installable for all VS Code users. This is the final phase after all features are implemented and tested.

## Prerequisites

### Publisher Account

1. Create a **Visual Studio Marketplace publisher** at https://marketplace.visualstudio.com/manage
2. Publisher ID: `blend65` (or `blendsdk`)
3. Requires a Microsoft account linked to an Azure DevOps organization
4. Generate a Personal Access Token (PAT) with "Marketplace: Manage" scope

### vsce CLI Tool

```bash
yarn global add @vscode/vsce
# or use npx
npx @vscode/vsce package
```

## Extension Metadata

### README.md (Marketplace Page)

The `README.md` in `packages/vscode-blend65/` becomes the marketplace page. Must include:

1. **Hero banner** — Screenshot of Blend65 syntax highlighting
2. **Feature list** with screenshots:
   - Syntax highlighting (colorful code)
   - IntelliSense autocomplete (dropdown menu)
   - Hover info (tooltip with docs)
   - Error diagnostics (red squiggles)
   - Outline view (sidebar symbols)
3. **Quick start** — Install + open `.blend` file
4. **Feature matrix** — table of all features
5. **Configuration** — settings reference
6. **Changelog** link
7. **License** info

### CHANGELOG.md

Follow [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

## [0.1.0] - 2026-XX-XX

### Added
- Syntax highlighting for all Blend65 constructs
- IntelliSense autocomplete for keywords, types, symbols
- Hover documentation for intrinsics and asm_* functions
- Real-time diagnostics (lexer, parser, semantic)
- Go-to-definition for variables, functions, types
- Document outline (symbol tree)
- Code snippets (25+)
- Signature help for function calls
- Find references and rename symbol
```

### Icon

- **Size:** 128×128 pixels minimum, 256×256 recommended
- **Format:** PNG
- **Design:** Blend65 logo on transparent or solid background
- **Placeholder:** Use a simple "B65" text icon until proper design is available

## Package & Publish Commands

```bash
# Build the extension
cd packages/vscode-blend65
yarn build

# Package into .vsix file
npx @vscode/vsce package --no-dependencies

# Test locally by installing the .vsix
# (In VS Code: Extensions → ... → Install from VSIX)

# Publish to marketplace
npx @vscode/vsce publish --no-dependencies

# Publish specific version
npx @vscode/vsce publish 0.1.0 --no-dependencies
```

### `--no-dependencies` Flag

Critical: Use `--no-dependencies` because:
- The extension is fully bundled (esbuild produces self-contained `dist/extension.js` and `dist/server.js`)
- No `node_modules` need to be included in the VSIX
- Results in a much smaller package (< 1MB vs 50MB+)

## Quality Checklist Before Publishing

- [ ] Extension installs cleanly from VSIX
- [ ] Syntax highlighting works on all example files
- [ ] IntelliSense provides completions
- [ ] Diagnostics show for real errors
- [ ] No false positive diagnostics on valid code
- [ ] All snippets work correctly
- [ ] Extension doesn't crash or hang
- [ ] README has screenshots
- [ ] CHANGELOG is up to date
- [ ] Icon displays correctly
- [ ] License is included

## Category Tags

```json
{
  "categories": ["Programming Languages", "Linters", "Snippets"],
  "keywords": ["blend65", "6502", "c64", "commodore", "retro", "assembly", "game-development"]
}
```
