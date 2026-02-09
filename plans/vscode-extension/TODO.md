# TODO - Pending Items for VS Code Extension

> **Last Updated**: 2025-02-09

## Blocking Items (Must Resolve Before Marketplace Publish)

- [ ] **Publisher ID**: Create a VS Code Marketplace publisher account at https://marketplace.visualstudio.com/manage
  - Required for `vsce publish`
  - Update `package.json` → `publisher` field once created
  - Personal Access Token needed from Azure DevOps

- [ ] **Extension Icon**: Create a 128x128px (minimum) PNG icon
  - Should represent Blend65 / C64 / 6502 theme
  - Place at `packages/vscode-blend65/icon.png`
  - Update `package.json` → `icon` field
  - Consider: retro C64 pixel art style, "B65" logo, or chip/hardware motif

## Non-Blocking Items (Can Resolve During Development)

- [ ] **Gallery Banner**: Optional banner for marketplace page
  - Recommended: 1280x640px or similar
  - Configure in `package.json` → `galleryBanner`

- [ ] **Extension Description**: Write a compelling 1-2 sentence description
  - Current placeholder: "Full language support for Blend65 — a TypeScript-like language for Commodore 64 development"

- [ ] **Keywords**: Finalize marketplace keywords
  - Candidates: `blend65`, `commodore 64`, `c64`, `6502`, `retro`, `assembly`, `game development`

- [ ] **License Decision**: Confirm license for the extension
  - Same as main repo (check LICENSE.md)?
  - Or separate license for the extension?

- [ ] **Screenshots**: Create marketplace screenshots showing:
  - Syntax highlighting
  - IntelliSense autocomplete
  - Hover documentation
  - Error diagnostics
  - Outline view

## Notes

- Publisher ID and icon are **required** before Phase 9 (Marketplace Publishing)
- All other items can be completed in parallel with development
- Screenshots should be captured after Phase 4 (IntelliSense) is complete
