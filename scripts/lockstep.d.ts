/**
 * Lockstep Release Tool
 *
 * A comprehensive monorepo package management tool that maintains synchronized versions
 * across all packages (lockstep versioning) and provides flexible CI/CD integration.
 *
 * Features:
 * - Lockstep versioning: All packages maintain the same version
 * - Dependency-aware publishing: Uses topological sorting
 * - Branch-based dist-tags: Automatic prefixing based on git branch
 * - CI integration: Skip CI loops and flexible git operations
 * - Package manager detection: Works with npm/yarn/pnpm
 *
 * Usage:
 *   yarn tsx scripts/lockstep.ts version --type patch|minor|major|auto [--ci] [--no-git-commit]
 *   yarn tsx scripts/lockstep.ts publish --tag <dist-tag> [--access <access>] [--dry] [--git-push]
 *
 * @author BlendSDK Team
 * @version 4.0.15
 */
export {};
//# sourceMappingURL=lockstep.d.ts.map