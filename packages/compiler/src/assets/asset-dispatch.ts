import { escapeDiagnosticText, projectDiagnostic } from "../project/diagnostics.js";
import { nativeAssetId } from "./asset-identity.js";
import { selectedValueSha256 } from "./asset-handler.js";
import type {
  AssetHandler,
  AssetHandlerFailure,
  AssetHandlerOutput,
  AssetHandlerRequest,
} from "./asset-handler.js";

/** Maximum accepted selected-output extent for one native or raw asset. */
export const MAX_ASSET_OUTPUT_BYTES = 0xffff;

/** Return the lowercase extension of a project-relative spelling including its dot. */
export function canonicalAssetExtension(path: string): string {
  const base = path.slice(path.lastIndexOf("/") + 1);
  const dot = base.lastIndexOf(".");
  return dot <= 0 ? "" : base.slice(dot).toLowerCase();
}

/** Find the handler registered for one canonical extension, if any. */
export function findAssetHandler(
  handlers: ReadonlyMap<string, AssetHandler>,
  path: string,
): AssetHandler | null {
  const extension = canonicalAssetExtension(path);
  if (extension === "") return null;
  for (const handler of handlers.values()) {
    if (handler.extensions.includes(extension)) return handler;
  }
  return null;
}

/** Build the closed failure helper shared by every native handler. */
function failure(
  code: string,
  message: string,
  span: AssetHandlerRequest["span"],
): AssetHandlerFailure {
  return Object.freeze({
    kind: "failure",
    diagnostic: projectDiagnostic(code, message, span),
  });
}

/** List available selector names in deterministic inventory order for diagnostics. */
function selectorNames(output: AssetHandlerOutput): string {
  return output.selectors
    .filter(({ available }) => available)
    .map(({ name }) => `'${name}'`)
    .join(", ");
}

/**
 * Resolve one literal request through the selected profile's closed handler map.
 *
 * The function is pure: it never reads a file. It fails closed for reserved
 * extensions, missing defaults, unknown selectors, native loadable declarations
 * and oversized selected outputs. A handler that returns a partial or malformed
 * output is rejected as a structural failure rather than trusted.
 */
export function dispatchAsset(
  request: AssetHandlerRequest,
  handlers: ReadonlyMap<string, AssetHandler>,
  reservedExtensions: ReadonlySet<string>,
): AssetHandlerOutput | AssetHandlerFailure {
  const extension = canonicalAssetExtension(request.literalPath);
  const handler = findAssetHandler(handlers, request.literalPath);
  if (request.owner === "loadable") {
    return failure(
      "E10204",
      `Native asset '${escapeDiagnosticText(request.literalPath)}' cannot initialize a loadable const — loadable delivery of native assets is not supported; declare an ordinary resident const instead`,
      request.span,
    );
  }
  if (handler === null) {
    if (reservedExtensions.has(extension)) {
      return failure(
        "E10204",
        `Native asset format '${escapeDiagnosticText(extension)}' is reserved but no handler is registered for it`,
        request.span,
      );
    }
    return failure(
      "E10137",
      `No format handler is registered for extension '${escapeDiagnosticText(extension)}'`,
      request.span,
    );
  }
  const selector = request.selector ?? handler.defaultSelector;
  const result = handler.parse(Object.freeze({ ...request, selector }));
  if (result.kind === "failure") return result;
  if (
    result.handlerKey !== handler.key ||
    result.handlerVersion !== handler.version ||
    result.resolvedSelector.length === 0 ||
    result.representation.length === 0 ||
    (selector !== null && result.resolvedSelector !== selector) ||
    selectedValueSha256(result.value) !== result.outputSha256 ||
    nativeAssetId(
      {
        handlerKey: result.handlerKey,
        handlerVersion: result.handlerVersion,
        selector: result.resolvedSelector,
        representation: result.representation,
        inputSha256: request.inputSha256,
        outputSha256: result.outputSha256,
        selectors: result.selectors,
      },
      request.resolvedPath,
    ) !== result.value.assetId
  ) {
    return failure(
      "E10204",
      `Handler '${escapeDiagnosticText(handler.key)}' returned an inconsistent result for '${escapeDiagnosticText(request.literalPath)}'`,
      request.span,
    );
  }
  const selected = result.selectors.find(({ name }) => name === result.resolvedSelector);
  if (selected === undefined || !selected.available) {
    return failure(
      "E10133",
      `Selector '${escapeDiagnosticText(result.resolvedSelector)}' is unavailable for '${escapeDiagnosticText(request.literalPath)}' — choose one of: ${selectorNames(result)}`,
      request.span,
    );
  }
  if (result.value.kind === "embedded" && result.value.bytes.length > MAX_ASSET_OUTPUT_BYTES) {
    return failure(
      "E10265",
      `Selected output '${escapeDiagnosticText(result.resolvedSelector)}' of '${escapeDiagnosticText(request.literalPath)}' is ${result.value.bytes.length} bytes — an embedded array is limited to ${MAX_ASSET_OUTPUT_BYTES} bytes`,
      request.span,
    );
  }
  return result;
}
