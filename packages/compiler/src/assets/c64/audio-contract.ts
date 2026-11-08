/** One measured or unknown cost value without importing backend artifact types. */
export type AudioCostValue =
  | { readonly kind: "unknown" }
  | { readonly kind: "exact"; readonly value: number }
  | { readonly kind: "range"; readonly minimum: number; readonly maximum: number };

/** Closed code, data and cycle cost record for one player feature set. */
export interface AudioCostRecord {
  /** Exact or unknown player code size. */
  readonly codeBytes: AudioCostValue;
  /** Exact or unknown player data size. */
  readonly dataBytes: AudioCostValue;
  /** Exact or unknown per-tick cycle cost. */
  readonly cycles: AudioCostValue;
}

/** One writable or self-modifying byte interval relative to the player payload. */
export interface AudioByteRange {
  /** First payload-relative offset. */
  readonly start: number;
  /** One past the last payload-relative offset. */
  readonly end: number;
}

/** One MMIO address interval the player writes or reads. */
export interface AudioMmioRange {
  /** First hardware address. */
  readonly start: number;
  /** One past the last hardware address. */
  readonly end: number;
}

/** Exact hash-bound contract for one callable player family and feature set. */
export interface AudioPlayerContract {
  /** Producer family, version and content digest. */
  readonly identity: {
    readonly family: string;
    readonly version: string;
    readonly sha256: string;
  };
  /** Input asset digests this contract can drive. */
  readonly assetSha256: readonly string[];
  /** Whether the payload has a fixed load address. */
  readonly placement: "fixed" | "relocatable";
  /** Absolute entry addresses relative to the player payload. */
  readonly entries: {
    readonly init: number;
    readonly tick: number;
    readonly sfx?: number;
  };
  /** Payload-relative writable byte ranges. */
  readonly writableRanges: readonly AudioByteRange[];
  /** Payload-relative self-modifying byte ranges. */
  readonly selfModifyingRanges: readonly AudioByteRange[];
  /** Required memory-banking facts. */
  readonly banking: readonly string[];
  /** Register, flag and memory effects of one call. */
  readonly effects: {
    readonly registers: string;
    readonly flags: string;
    readonly decimal: "binary-required" | "preserved" | "cleared";
    readonly interruptState: "preserved" | "cleared" | "restored";
    readonly port01: "preserved" | "required-value";
    readonly stackBytes: number;
    readonly ramBytes: number;
    readonly zeroPageBytes: number;
    readonly mmioRanges: readonly AudioMmioRange[];
  };
  /** Selectable songs and their source-visible names. */
  readonly songs: {
    readonly count: number;
    readonly defaultSong: number;
    readonly names: readonly string[];
    readonly dynamicNumeric: boolean;
    readonly numericRange?: { readonly min: number; readonly max: number };
  };
  /** Effect inventory and arbitration rules owned by the player. */
  readonly effectsInventory: {
    readonly names: readonly string[];
    readonly priority: string;
    readonly replacement: string;
    readonly resume: string;
    readonly sameFrame: string;
  };
  /** Logical voice to channel-offset mapping. */
  readonly voices: readonly {
    readonly logical: 0 | 1 | 2;
    readonly channelOffset: 0 | 7 | 14;
  }[];
  /** Video standards the player supports. */
  readonly video: readonly ("PAL" | "NTSC")[];
  /** SID chips the player supports. */
  readonly sidChips: readonly { readonly address: number; readonly model: 6581 | 8580 }[];
  /** Required call cadence. */
  readonly cadence: string;
  /** Domains from which the player may be called. */
  readonly callDomains: readonly string[];
  /** Interrupt ownership obligation. */
  readonly interruptOwnership: string;
  /** CIA ownership obligation. */
  readonly ciaOwnership: string;
  /** SID filter ownership obligation. */
  readonly sidFilterOwnership: string;
  /** The player is never reentrant across concurrent domains. */
  readonly reentrant: false;
  /** Feature-dependent code and data sizes. */
  readonly featureSizes: readonly {
    readonly feature: string;
    readonly codeBytes: number;
    readonly dataBytes: number;
  }[];
  /** Exact resource and timing evidence. */
  readonly costs: AudioCostRecord;
}

/** One source-level callable-audio operation. */
export interface AudioOperationRequest {
  /** Operation family. */
  readonly operation: "init" | "tick" | "sfx";
  /** Zero-based numeric song or named song, when the operation selects one. */
  readonly song?: number | string;
  /** Named cue, when the player exposes named effects. */
  readonly cue?: string;
  /** Logical voice, when the operation targets one. */
  readonly voice?: 0 | 1 | 2;
}

/** One proof without a diagnostic location; the caller attaches the source span. */
export interface AudioOperationFailure {
  /** Stable diagnostic code. */
  readonly code: "E10257";
  /** Complete message naming every available form. */
  readonly message: string;
}

/** Baseline contract inventory. No player adapter is registered in this release. */
export const AUDIO_PLAYER_CONTRACTS: ReadonlyMap<string, AudioPlayerContract> = new Map<
  string,
  AudioPlayerContract
>();

/** Find the first contract bound to one exact input asset digest. */
export function findAudioPlayerContract(
  assetSha256: string,
  contracts: ReadonlyMap<string, AudioPlayerContract> = AUDIO_PLAYER_CONTRACTS,
): AudioPlayerContract | null {
  for (const contract of contracts.values()) {
    if (contract.assetSha256.includes(assetSha256)) return contract;
  }
  return null;
}

/** Validate one requested operation against one exact contract. */
export function validateAudioOperation(
  contract: AudioPlayerContract,
  request: AudioOperationRequest,
): AudioOperationFailure | null {
  const operationAvailable =
    (request.operation === "tick" && contract.entries.tick !== undefined) ||
    (request.operation === "init" && contract.entries.init !== undefined) ||
    (request.operation === "sfx" && contract.entries.sfx !== undefined);
  const cues = contract.effectsInventory.names;
  const voices = contract.voices.map(({ logical }) => logical);
  if (!operationAvailable) {
    return Object.freeze({
      code: "E10257",
      message: `Player '${contract.identity.family}' ${contract.identity.version} does not provide '${request.operation}()' — available operations are: ${[
        "init",
        "tick",
        ...(contract.entries.sfx === undefined ? [] : ["sfx"]),
      ]
        .map((name) => `'${name}'`)
        .join(", ")}`,
    });
  }
  if (request.song !== undefined) {
    if (typeof request.song === "string") {
      if (!contract.songs.names.includes(request.song)) {
        return Object.freeze({
          code: "E10257",
          message: `Player '${contract.identity.family}' ${contract.identity.version} has no named song '${request.song}' — available names are: ${contract.songs.names.map((name) => `'${name}'`).join(", ")}`,
        });
      }
    } else if (
      !contract.songs.dynamicNumeric ||
      contract.songs.numericRange === undefined ||
      request.song < contract.songs.numericRange.min ||
      request.song > contract.songs.numericRange.max
    ) {
      const range = contract.songs.numericRange;
      return Object.freeze({
        code: "E10257",
        message: `Player '${contract.identity.family}' ${contract.identity.version} does not accept numeric song ${request.song} — ${contract.songs.dynamicNumeric && range !== undefined ? `the accepted range is ${range.min}..${range.max}` : "use a named song"}`,
      });
    }
  }
  if (request.cue !== undefined && !cues.includes(request.cue)) {
    return Object.freeze({
      code: "E10257",
      message: `Player '${contract.identity.family}' ${contract.identity.version} has no cue '${request.cue}' — available cues are: ${cues.map((name) => `'${name}'`).join(", ")}`,
    });
  }
  if (request.voice !== undefined && !voices.includes(request.voice)) {
    return Object.freeze({
      code: "E10257",
      message: `Player '${contract.identity.family}' ${contract.identity.version} has no logical voice ${request.voice} — available voices are: ${voices.map((voice) => String(voice)).join(", ")}`,
    });
  }
  return null;
}

/** Describe one operation reachable from two concurrent call domains. */
export interface AudioDomainOverlap {
  /** First reachable domain. */
  readonly first: string;
  /** Second, distinct reachable domain. */
  readonly second: string;
}

/**
 * Return the first pair of distinct domains that can reach one non-reentrant
 * operation, or null when every operation is confined to one domain.
 */
export function audioDomainOverlap(
  domains: readonly (readonly string[])[],
): AudioDomainOverlap | null {
  for (const reachable of domains) {
    const unique = [...new Set(reachable)];
    if (unique.length >= 2) {
      return Object.freeze({ first: unique[0]!, second: unique[1]! });
    }
  }
  return null;
}
