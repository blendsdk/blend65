import type { PlacementConstraints } from "../frontend/semantic-types.js";
import type { TargetProfile } from "../target/profile.js";

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
    placement.region === null &&
    start >= profile.packager.residentStart &&
    end <= profile.packager.residentEnd
  );
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
      if (!matchingNmiLow || placement?.at != null) return null;
      start = nextStart(start + 0x100);
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
