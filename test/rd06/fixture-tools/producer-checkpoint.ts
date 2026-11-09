import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** One checked producer-evidence manifest shape. */
interface ProducerManifest {
  readonly schemaVersion: 1;
  readonly producerRoot: string;
  readonly retention: { readonly disposition: string };
  readonly manuals: readonly { readonly path: string; readonly sha256: string }[];
  readonly fixtures: readonly {
    readonly family: string;
    readonly path: string;
    readonly sha256: string;
    readonly producerVersion: string;
  }[];
}

/** Result of one producer checkpoint. */
export interface ProducerCheckpoint {
  /** Whether the licensed application folder is present on this host. */
  readonly available: boolean;
  /** Every deterministic violation; empty when the checkpoint passes. */
  readonly violations: readonly string[];
}

/** Hash one file without text decoding. */
function sha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

/** One checked public fixture manifest shape. */
interface PublicManifest {
  readonly fixtures: readonly {
    readonly family: string;
    readonly sha256: string;
    readonly provenance: { readonly kind: string };
    readonly producer: string | null;
    readonly producerVersion: string | null;
  }[];
}

/**
 * Validate the local producer-evidence checkpoint.
 *
 * The checkpoint is honest when the vendor applications are absent: it then
 * reports `available: false` and does not claim producer verification. Public
 * SPD/CTM fixtures are allowed only when they are constructed synthetic data,
 * never bytes copied from a licensed producer example.
 */
export function validateProducerCheckpoint(repository: string): ProducerCheckpoint {
  const manifestPath = join(repository, "test/rd06/fixtures/producer-evidence.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as ProducerManifest;
  const violations: string[] = [];
  if (manifest.schemaVersion !== 1) violations.push("producer manifest schema is not 1");
  if (manifest.retention.disposition !== "local-only") {
    violations.push("producer retention must stay local-only");
  }
  const publicPath = join(repository, "test/rd06/fixtures/manifest.json");
  if (existsSync(publicPath)) {
    const publicManifest = JSON.parse(readFileSync(publicPath, "utf8")) as PublicManifest;
    const producerHashes = new Set(manifest.fixtures.map(({ sha256: hash }) => hash));
    for (const entry of publicManifest.fixtures.filter(
      ({ family }) => family === "spritepad" || family === "charpad",
    )) {
      if (
        entry.provenance.kind !== "constructed" ||
        entry.producer !== null ||
        entry.producerVersion !== null
      ) {
        violations.push(
          `producer family '${entry.family}' must be synthetic under public fixtures`,
        );
      }
      if (producerHashes.has(entry.sha256)) {
        violations.push(`public fixture copies a local producer file: ${entry.family}`);
      }
    }
  }
  const available = existsSync(manifest.producerRoot);
  if (available) {
    for (const item of [...manifest.manuals, ...manifest.fixtures]) {
      const path = join(manifest.producerRoot, item.path);
      if (!existsSync(path)) {
        violations.push(`missing producer file: ${item.path}`);
      } else if (sha256(path) !== item.sha256) {
        violations.push(`producer hash mismatch: ${item.path}`);
      }
    }
    for (const fixture of manifest.fixtures) {
      if (fixture.producerVersion !== "3.80") {
        violations.push(`producer version must be 3.80: ${fixture.path}`);
      }
    }
  }
  return Object.freeze({ available, violations: Object.freeze(violations) });
}
