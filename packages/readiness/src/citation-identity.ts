import { compareStringTuples, equalStringTuples } from "./authority-order.js";
import type { ResolvedSourceFragment, SourceCitation } from "./model.js";

/** Returns the normalized structured identity of a source citation. */
export function citationTuple(citation: SourceCitation): readonly string[] {
  return [
    citation.path,
    ...citation.headingAncestry.map((part) => part.normalize("NFC")),
    citation.contentHash,
    citation.quote,
  ];
}

/** Returns the normalized structured citation identity of a resolved fragment. */
export function fragmentCitationTuple(fragment: ResolvedSourceFragment): readonly string[] {
  return [
    fragment.sourcePath,
    ...fragment.fragment.headingAncestry.map((part) => part.normalize("NFC")),
    fragment.fragment.contentHash,
    fragment.quote,
  ];
}

export function compareCitations(left: SourceCitation, right: SourceCitation): number {
  return compareStringTuples(citationTuple(left), citationTuple(right));
}

export function citationMatchesFragment(
  citation: SourceCitation,
  fragment: ResolvedSourceFragment,
): boolean {
  return equalStringTuples(citationTuple(citation), fragmentCitationTuple(fragment));
}
