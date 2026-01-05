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
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
// ============================================================================
// CONSTANTS
// ============================================================================
/** Root directory of the monorepo */
const ROOT = process.cwd();
/** Directories to search for packages (can be extended for apps, tools, etc.) */
const PACKAGES_DIRS = ['packages'];
/** All dependency fields to check when building dependency graph */
const DEP_FIELDS = [
    'dependencies',
    'devDependencies',
    'peerDependencies',
    'optionalDependencies',
];
// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================
/**
 * Reads and parses a JSON file
 * @param p - Path to the JSON file
 * @returns Parsed JSON object
 */
function readJSON(p) {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}
/**
 * Writes an object to a JSON file with proper formatting
 * @param p - Path to write the JSON file
 * @param obj - Object to serialize to JSON
 */
function writeJSON(p, obj) {
    fs.writeFileSync(p, JSON.stringify(obj, null, 2) + '\n');
}
/**
 * Checks if a file or directory exists
 * @param p - Path to check
 * @returns True if path exists, false otherwise
 */
function exists(p) {
    try {
        fs.accessSync(p);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Recursively finds all directories containing package.json files
 * @returns Array of absolute paths to package directories
 */
function findPackageDirs() {
    const dirs = [];
    /**
     * Recursively searches a directory for package.json files
     * @param dirPath - Directory path to search
     */
    function searchRecursively(dirPath) {
        if (!exists(dirPath))
            return;
        for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
            if (entry.isDirectory() && entry.name !== 'node_modules') {
                const entryPath = path.join(dirPath, entry.name);
                const pkgPath = path.join(entryPath, 'package.json');
                // If this directory has a package.json, it's a package
                if (exists(pkgPath)) {
                    dirs.push(entryPath);
                }
                // Continue searching recursively in subdirectories
                searchRecursively(entryPath);
            }
        }
    }
    // Search all configured package directories
    for (const base of PACKAGES_DIRS) {
        const basePath = path.join(ROOT, base);
        searchRecursively(basePath);
    }
    return dirs;
}
/**
 * Bumps a semantic version according to the specified type
 * @param v - Current version string (e.g., "1.2.3")
 * @param type - Type of bump (patch, minor, major)
 * @returns New version string
 * @throws Error if version is not valid semver
 */
function semverBump(v, type) {
    const m = v.match(/^(\d+)\.(\d+)\.(\d+)(-.+)?$/);
    if (!m)
        throw new Error(`Not a semver version: ${v}`);
    const [, MA, MI, PA] = m;
    let major = +MA;
    let minor = +MI;
    let patch = +PA;
    // Apply version bump rules
    if (type === 'major') {
        major += 1;
        minor = 0;
        patch = 0;
    }
    else if (type === 'minor') {
        minor += 1;
        patch = 0;
    }
    else if (type === 'patch') {
        patch += 1;
    }
    else {
        throw new Error(`Unknown bump type: ${type}`);
    }
    return `${major}.${minor}.${patch}`;
}
/**
 * Preserves the version range operator when updating dependency versions
 * @param oldRange - Original version range (e.g., "^1.2.3", "~1.2.3")
 * @param newVersion - New version to apply
 * @returns New version range with preserved operator
 */
function preserveOperator(oldRange, newVersion) {
    if (oldRange.startsWith('^'))
        return `^${newVersion}`;
    if (oldRange.startsWith('~'))
        return `~${newVersion}`;
    if (oldRange.startsWith('>='))
        return `>=${newVersion}`;
    if (oldRange.startsWith('='))
        return `=${newVersion}`;
    // For exact versions, wildcards, or other formats, use exact version
    return newVersion;
}
/**
 * Performs topological sorting on packages based on their dependencies
 * Uses Kahn's algorithm to ensure dependencies are published before dependents
 * @param pkgs - Array of workspace packages
 * @param graph - Dependency graph (package -> dependents)
 * @returns Array of package names in dependency order
 * @throws Error if circular dependencies are detected
 */
function topoSort(pkgs, graph) {
    // Initialize in-degree count for each package
    const inDeg = new Map(pkgs.map(p => [p.name, 0]));
    // Calculate in-degrees (number of dependencies for each package)
    for (const [, vs] of graph.entries()) {
        for (const v of vs) {
            inDeg.set(v, (inDeg.get(v) || 0) + 1);
        }
    }
    // Start with packages that have no dependencies
    const q = [...pkgs.map(p => p.name).filter(n => (inDeg.get(n) || 0) === 0)];
    const out = [];
    // Process packages in dependency order
    while (q.length) {
        const n = q.shift();
        out.push(n);
        // Update in-degrees for dependents
        for (const v of graph.get(n) || []) {
            const currentDeg = inDeg.get(v) - 1;
            inDeg.set(v, currentDeg);
            if (currentDeg === 0)
                q.push(v);
        }
    }
    // Check for circular dependencies
    if (out.length !== pkgs.length) {
        throw new Error('Cycle detected in local dependency graph.');
    }
    return out;
}
// ============================================================================
// CORE WORKSPACE FUNCTIONS
// ============================================================================
/**
 * Builds complete workspace information including packages and dependency graph
 * @returns WorkspaceInfo containing packages, lookup map, and dependency graph
 */
function buildWorkspace() {
    const dirs = findPackageDirs();
    const packages = dirs.map(dir => {
        const pkg = readJSON(path.join(dir, 'package.json'));
        return {
            dir,
            pkgPath: path.join(dir, 'package.json'),
            name: pkg.name,
            version: pkg.version,
            data: pkg,
        };
    });
    const byName = new Map(packages.map(p => [p.name, p]));
    // Build dependency graph: package -> dependents (for topological sorting)
    const graph = new Map();
    for (const p of packages)
        graph.set(p.name, []);
    // Analyze all dependency fields to build the graph
    for (const p of packages) {
        for (const field of DEP_FIELDS) {
            const deps = p.data[field] || {};
            for (const depName of Object.keys(deps)) {
                if (byName.has(depName)) {
                    // Add edge: dependency -> dependent
                    graph.get(depName).push(p.name);
                }
            }
        }
    }
    return { packages, byName, graph };
}
/**
 * Ensures all packages have the same version (lockstep requirement)
 * @param packages - Array of workspace packages
 * @returns The common version string
 * @throws Error if packages have different versions
 */
function ensureAllSameVersion(packages) {
    const set = new Set(packages.map(p => p.version));
    if (set.size !== 1) {
        const debug = packages.map(p => `${p.name}@${p.version}`).join(', ');
        throw new Error(`Lockstep requires all packages have the same version. Found: ${[...set].join(', ')} {${debug}} `);
    }
    return [...set][0];
}
/**
 * Executes a git command and returns the output
 * @param cmd - Git command to execute (without 'git' prefix)
 * @returns Command output as trimmed string
 */
function git(cmd) {
    return execSync(`git ${cmd}`, { stdio: 'pipe' }).toString().trim();
}
/**
 * Checks if there are changes since the last git tag
 * @returns True if there are changes, false otherwise
 */
function changedSinceLastTag() {
    let lastTag = '';
    try {
        lastTag = git('describe --tags --abbrev=0');
    }
    catch {
        // No tags exist, assume changes
        return true;
    }
    const diff = execSync(`git diff --name-only ${lastTag}..HEAD`, { stdio: 'pipe' }).toString();
    return diff.split('\n').some(Boolean);
}
// ============================================================================
// AUTOMATIC VERSION DETECTION
// ============================================================================
/**
 * Analyzes conventional commit messages to determine the appropriate version bump type
 * @returns The determined version bump type, defaults to 'patch' if uncertain
 */
function determineVersionType() {
    let lastTag = '';
    try {
        lastTag = git('describe --tags --abbrev=0');
    }
    catch {
        // No tags exist, default to patch
        console.log('No previous tags found, defaulting to patch version bump');
        return 'patch';
    }
    // Get commit messages since last tag
    let commits;
    try {
        commits = git(`log ${lastTag}..HEAD --pretty=format:"%s"`);
    }
    catch {
        console.log('Unable to get commit history, defaulting to patch version bump');
        return 'patch';
    }
    if (!commits.trim()) {
        console.log('No commits since last tag, defaulting to patch version bump');
        return 'patch';
    }
    const commitLines = commits.split('\n').filter(line => line.trim());
    console.log(`Analyzing ${commitLines.length} commits since ${lastTag}:`);
    let hasBreaking = false;
    let hasFeature = false;
    let hasFix = false;
    for (const commit of commitLines) {
        console.log(`  - ${commit}`);
        // Check for breaking changes
        if (commit.includes('BREAKING CHANGE') || commit.includes('!:')) {
            hasBreaking = true;
            continue;
        }
        // Check for features
        if (commit.match(/^feat(\(.+\))?:/)) {
            hasFeature = true;
            continue;
        }
        // Check for fixes and other patch-level changes
        if (commit.match(/^(fix|docs|style|refactor|test|chore)(\(.+\))?:/)) {
            hasFix = true;
            continue;
        }
    }
    // Determine version bump based on conventional commit analysis
    if (hasBreaking) {
        console.log('🔥 Breaking changes detected → major version bump');
        return 'major';
    }
    else if (hasFeature) {
        console.log('✨ New features detected → minor version bump');
        return 'minor';
    }
    else if (hasFix) {
        console.log('🐛 Fixes or maintenance detected → patch version bump');
        return 'patch';
    }
    else {
        console.log('📝 No conventional commits found → defaulting to patch version bump');
        return 'patch';
    }
}
// ============================================================================
// MAIN COMMAND FUNCTIONS
// ============================================================================
/**
 * Bumps versions of all packages in lockstep and optionally commits/tags
 * @param type - Type of version bump (patch, minor, major, auto)
 * @param skipCi - Whether to add [skip ci] to commit message
 * @param noGitCommit - Whether to skip git operations entirely
 */
function versionAll(type, skipCi = false, noGitCommit = false) {
    // If auto is specified, determine the actual version type
    const actualType = type === 'auto' ? determineVersionType() : type;
    // Print the determined version type prominently when using auto
    if (type === 'auto') {
        console.log(`\n🎯 Automatic version detection determined: ${actualType.toUpperCase()}`);
        console.log(`────────────────────────────────────────────────────────────\n`);
    }
    const { packages } = buildWorkspace();
    // Ensure all packages have the same current version
    const current = ensureAllSameVersion(packages);
    const next = semverBump(current, actualType);
    // Create set for quick internal package lookup
    const internalNames = new Set(packages.map(p => p.name));
    // Update version in all packages and their internal dependencies
    for (const p of packages) {
        const pkg = p.data;
        pkg.version = next;
        // Update internal dependency versions
        for (const field of DEP_FIELDS) {
            const deps = pkg[field];
            if (!deps)
                continue;
            for (const [dep, range] of Object.entries(deps)) {
                if (!internalNames.has(dep))
                    continue;
                if (typeof range !== 'string')
                    continue;
                // Update internal dependency version while preserving range operator
                deps[dep] = preserveOperator(range, next);
            }
        }
        writeJSON(p.pkgPath, pkg);
        console.log(`✔ ${p.name} -> ${next}`);
    }
    // Update root package.json version if it exists
    const rootPkgPath = path.join(ROOT, 'package.json');
    if (exists(rootPkgPath)) {
        const rootPkg = readJSON(rootPkgPath);
        if (rootPkg.version) {
            rootPkg.version = next;
            writeJSON(rootPkgPath, rootPkg);
            console.log(`✔ root -> ${next}`);
        }
    }
    // Perform git operations unless explicitly skipped
    if (!noGitCommit) {
        execSync(`git add .`, { stdio: 'inherit' });
        const commitMessage = `chore(release): v${next}${skipCi ? ' [skip ci]' : ''}`;
        execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
        execSync(`git tag v${next}`, { stdio: 'inherit' });
        console.log(`\nAll packages bumped to v${next} and tagged.`);
    }
    else {
        console.log(`\nAll packages bumped to v${next}. Git commit and tag skipped.`);
    }
}
/**
 * Publishes all packages in dependency order with branch-prefixed dist-tags
 * @param options - Publishing options including access, dry run, tag, and git push
 */
function publishAll({ access = 'public', dry = false, tag, gitPush = false, }) {
    if (!tag) {
        throw new Error('--tag parameter is required for publish command');
    }
    const { packages, graph } = buildWorkspace();
    const order = topoSort(packages, graph); // Ensure dependencies publish first
    console.log('Publish order:', order.join(' -> '));
    // Create branch-prefixed dist-tag (except for 'latest')
    const currentBranch = git('rev-parse --abbrev-ref HEAD');
    const finalTag = tag === 'latest' ? 'latest' : `${currentBranch}-${tag}`;
    console.log(`Publishing with dist-tag: ${finalTag}`);
    if (tag !== 'latest') {
        console.log(`Branch: ${currentBranch}, Original tag: ${tag}`);
    }
    // Auto-detect package manager
    const pm = process.env.PM || detectPM();
    console.log(`Using package manager: ${pm}`);
    // Publish each package in dependency order
    for (const name of order) {
        const p = packages.find(x => x.name === name);
        if (!p) {
            throw new Error(`Package ${name} not found in workspace`);
        }
        // Build publish command arguments
        const args = [];
        args.push('--access', access);
        args.push('--tag', finalTag);
        // Generate appropriate publish command for package manager
        let cmd;
        if (pm === 'pnpm') {
            cmd = `pnpm publish ${args.join(' ')} ${dry ? '--dry-run' : ''}`;
        }
        else if (pm === 'yarn') {
            // Yarn uses npm publish under the hood
            cmd = `npm publish ${args.join(' ')} ${dry ? '--dry-run' : ''}`;
        }
        else {
            // Default to npm
            cmd = `npm publish ${args.join(' ')} ${dry ? '--dry-run' : ''}`;
        }
        execSync(cmd, { cwd: p.dir, stdio: 'inherit' });
    }
    // Push git changes and tags if requested (and not in dry run)
    if (gitPush && !dry) {
        console.log('\nPushing git changes and tags...');
        execSync('git push --follow-tags', { stdio: 'inherit' });
        console.log('✔ Git changes and tags pushed to remote');
    }
}
/**
 * Detects the package manager being used in the project
 * @returns Detected package manager (npm, yarn, or pnpm)
 */
function detectPM() {
    if (exists(path.join(ROOT, 'pnpm-lock.yaml')))
        return 'pnpm';
    if (exists(path.join(ROOT, 'yarn.lock')))
        return 'yarn';
    if (exists(path.join(ROOT, 'package-lock.json')))
        return 'npm';
    return 'npm'; // Default fallback
}
// ============================================================================
// CLI PARSING AND MAIN FUNCTION
// ============================================================================
/**
 * Parses command line arguments into a key-value object
 * @param args - Array of command line arguments
 * @returns Parsed options object
 */
function parseCliOptions(args) {
    return Object.fromEntries(args.reduce((acc, x, i, arr) => {
        if (x.startsWith('--')) {
            const key = x.replace(/^--/, '');
            const nextArg = arr[i + 1];
            const value = nextArg && !nextArg.startsWith('--') ? nextArg : true;
            acc.push([key, value]);
        }
        return acc;
    }, []));
}
/**
 * Main CLI entry point - handles command routing and argument parsing
 */
function main() {
    const [, , cmd, ...rest] = process.argv;
    const opts = parseCliOptions(rest);
    if (cmd === 'version') {
        // Handle version command
        const type = String(opts.type || 'patch');
        if (!['patch', 'minor', 'major', 'auto'].includes(type)) {
            throw new Error(`--type must be patch|minor|major|auto`);
        }
        // Skip version bump if no changes since last tag
        if (!changedSinceLastTag()) {
            console.log('No changes since last tag; skipping version bump.');
            process.exit(0);
        }
        const skipCi = Boolean(opts.ci);
        const noGitCommit = Boolean(opts['no-git-commit']);
        versionAll(type, skipCi, noGitCommit);
    }
    else if (cmd === 'publish') {
        // Handle publish command
        const access = opts.access === true ? 'public' : String(opts.access || 'public');
        const dry = Boolean(opts.dry);
        const tag = opts.tag === true ? '' : String(opts.tag || '');
        const gitPush = Boolean(opts['git-push']);
        if (!tag) {
            throw new Error('--tag parameter is required for publish command');
        }
        publishAll({ access, dry, tag, gitPush });
    }
    else {
        // Show help text
        console.log(`Commands:
  version --type patch|minor|major|auto [--ci] [--no-git-commit]
  publish --tag <dist-tag> [--access <access>] [--dry] [--git-push]

Examples:
  version --type patch                      # Bump patch version
  version --type minor --ci                 # Bump minor version with [skip ci] in commit message
  version --type major --no-git-commit      # Bump major version without git commit/tag
  version --type auto                       # Automatically determine version from conventional commits
  version --type auto --ci                  # Auto version with [skip ci] in commit message
  version --type patch --ci --no-git-commit # Bump patch, skip CI and git operations
  publish --tag latest                      # Publishes as 'latest' (no branch prefix, access=public)
  publish --tag alpha                       # Publishes as 'v4-alpha' (if on v4 branch, access=public)
  publish --tag beta --dry                  # Dry run as 'v4-beta' (access=public)
  publish --tag latest --access restricted  # Publishes as 'latest' with restricted access
  publish --tag alpha --git-push            # Publishes as 'v4-alpha' and pushes git changes/tags

Notes:
  --access defaults to 'public'. Only specify --access if you need a different value.
  --ci adds '[skip ci]' to the commit message to prevent CI loops.
  --no-git-commit skips git add, commit, and tag operations in version command.
  --git-push automatically pushes git changes and tags after successful publish.
  --type auto analyzes conventional commits: feat: → minor, fix:/docs:/etc → patch, BREAKING CHANGE → major.
  `);
    }
}
// ============================================================================
// CLI EXECUTION
// ============================================================================
/**
 * Execute the CLI when this file is run directly
 * Uses ES modules import.meta.url to detect direct execution
 */
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
//# sourceMappingURL=lockstep.js.map