import type { PlacementConstraints } from "../frontend/semantic-types.js";
import type { TargetProfile } from "../target/profile.js";
import type { VicFetchDemand } from "../target/vic-fetch.js";

/** Stock 901227-03 NMINV starts at $FE47; every cooperative published entry shares its low byte. */
const NMI_PUBLICATION_LOW_BYTE = 0x47;

/** Round one address upward to a power-of-two boundary. */
export function align(address: number, alignment: number): number {
  return Math.ceil(address / alignment) * alignment;
}

/** Check the whole object against the source's exact address, alignment, and window. */
export function satisfiesSourcePlacement(
  start: number,
  bytes: number,
  placement: PlacementConstraints | undefined,
  profile: TargetProfile,
): boolean {
  if (placement === undefined) return true;
  const end = start + bytes - 1;
  return (
    bytes > 0 &&
    (placement.at === null || start === placement.at) &&
    start % placement.align === 0 &&
    (placement.noCross === null ||
      Math.floor(start / placement.noCross) === Math.floor(end / placement.noCross)) &&
    (placement.region === null ||
      ((placement.region === "c64.vic.bank0" || placement.region === "c64.vic.bank0-ram") &&
        start >= profile.machine.vicBankStart &&
        end <= profile.machine.vicBankEnd)) &&
    (placement.region !== "c64.vic.bank0-ram" ||
      end < profile.machine.characterRomStart ||
      start > profile.machine.characterRomEnd) &&
    start >= profile.packager.residentStart &&
    end <= profile.packager.residentEnd
  );
}

/**
 * Check that every byte the video chip fetches from one object is reachable at a
 * candidate first-byte address.
 *
 * Each fetched run has to lie inside the chip's bank and outside the window
 * where it reads character ROM instead of the RAM underneath. The bytes between
 * and after those runs are ordinary storage: they may sit under that window or
 * past the end of the bank, because nothing fetches them. This is the whole
 * difference between an inferred demand and a region the author wrote, which
 * constrains the object from first byte to last.
 *
 * @param start Candidate first-byte address of the whole object.
 * @param demand Fetched runs inferred for this object, or undefined when none.
 * @param profile Selected profile supplying the bank and character-ROM window.
 * @returns Whether every fetched run is reachable with the object at `start`.
 * @example satisfiesVicFetch(0x1000, { ranges: [{ offset: 4096, bytes: 64 }], span }, profile)
 */
export function satisfiesVicFetch(
  start: number,
  demand: VicFetchDemand | undefined,
  profile: TargetProfile,
): boolean {
  if (demand === undefined) return true;
  return demand.ranges.every((range) => {
    const first = start + range.offset;
    const last = first + range.bytes - 1;
    return (
      first >= profile.machine.vicBankStart &&
      last <= profile.machine.vicBankEnd &&
      (last < profile.machine.characterRomStart || first > profile.machine.characterRomEnd)
    );
  });
}

/**
 * Lowest first-byte address above a rejected candidate that could move a hidden
 * fetched run clear of the character-ROM window.
 *
 * The step is measured from the run that failed rather than from the object, so
 * an object addressed at a large offset moves by exactly what that offset needs
 * — an object whose fetched bytes sit 4 KiB inside it has to start 4 KiB
 * *before* the window ends in order to fetch past it. Alignment is reapplied by
 * the caller, which also rechecks every other constraint: clearing the window is
 * necessary, never sufficient.
 *
 * @param start Rejected candidate first-byte address.
 * @param demand Fetched runs inferred for this object, or undefined when none.
 * @param profile Selected profile supplying the character-ROM window.
 * @returns The next candidate worth testing, or null when none is implied.
 * @example nextVicFetchStart(0x0a80, { ranges: [{ offset: 0, bytes: 64 }], span }, profile)
 */
export function nextVicFetchStart(
  start: number,
  demand: VicFetchDemand | undefined,
  profile: TargetProfile,
): number | null {
  if (demand === undefined) return null;
  const candidates = demand.ranges
    .filter((range) => {
      const first = start + range.offset;
      const last = first + range.bytes - 1;
      return last >= profile.machine.characterRomStart && first <= profile.machine.characterRomEnd;
    })
    .map((range) => profile.machine.characterRomEnd + 1 - range.offset);
  return candidates.length === 0 ? null : Math.max(...candidates);
}

/** Select the next legal automatic address, or preserve an explicit first byte exactly. */
export function sourceDataStart(
  cursor: number,
  bytes: number,
  alignment: number,
  placement: PlacementConstraints | undefined,
): number | null {
  if (placement?.at !== undefined && placement.at !== null) return placement.at;
  const requiredAlignment = Math.max(alignment, placement?.align ?? 1);
  let start = align(cursor, requiredAlignment);
  const window = placement?.noCross;
  if (window !== undefined && window !== null) {
    if (bytes > window) return null;
    if (Math.floor(start / window) !== Math.floor((start + bytes - 1) / window)) {
      start = align(Math.ceil((start + 1) / window) * window, requiredAlignment);
    }
  }
  return start;
}

/** Find a legal first-fit address without treating declaration order as physical order. */
export function freeSourceStart(
  cursor: number,
  bytes: number,
  alignment: number,
  placement: PlacementConstraints | undefined,
  occupied: readonly { readonly start: number; readonly end: number }[],
  profile: TargetProfile,
  matchingNmiLow = false,
  fetch?: VicFetchDemand,
): number | null {
  if (matchingNmiLow && (placement?.align ?? alignment) > 1) return null;
  const nextStart = (from: number): number | null => {
    const candidate = sourceDataStart(from, bytes, alignment, placement);
    if (candidate === null || !matchingNmiLow) return candidate;
    if (placement?.at != null)
      return (candidate & 0xff) === NMI_PUBLICATION_LOW_BYTE ? candidate : null;
    return candidate + ((NMI_PUBLICATION_LOW_BYTE - (candidate & 0xff) + 0x100) % 0x100);
  };
  let start = nextStart(cursor);
  while (start !== null && start + bytes - 1 <= profile.packager.residentEnd) {
    if (start < profile.packager.residentStart) return null;
    if (!satisfiesSourcePlacement(start, bytes, placement, profile)) {
      if (
        placement?.region === "c64.vic.bank0-ram" &&
        placement.at === null &&
        start <= profile.machine.characterRomEnd &&
        start + bytes - 1 >= profile.machine.characterRomStart
      ) {
        start = nextStart(profile.machine.characterRomEnd + 1);
        continue;
      }
      if (!matchingNmiLow || placement?.at != null) return null;
      start = nextStart(start + 0x100);
      continue;
    }
    // The object may legally sit anywhere resident; only the runs the chip
    // fetches have to be reachable, and an address that hides one of them is
    // moved by what that run needs rather than by the object's own size.
    if (!satisfiesVicFetch(start, fetch, profile)) {
      if (placement?.at != null) return null;
      const cleared = nextVicFetchStart(start, fetch, profile);
      if (cleared === null) return null;
      start = nextStart(cleared);
      continue;
    }
    const crossing = occupied.find((interval) =>
      overlaps(start!, start! + bytes - 1, interval.start, interval.end),
    );
    if (crossing === undefined) return start;
    if (placement?.at != null) return null;
    start = nextStart(crossing.end + 1);
  }
  return null;
}

/** Check overlap of two inclusive intervals. */
export function overlaps(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number,
): boolean {
  return leftStart <= rightEnd && rightStart <= leftEnd;
}
