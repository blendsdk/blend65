import type { ExecutionTierV1 } from "@blend65/readiness";

import type { ExecutionRouteRequestV1 } from "./execution-route-adapters.js";

const AUTHORIZED_ROUTE_REQUESTS = new WeakSet<object>();
const SOURCE_ROUTE_REQUESTS = new WeakMap<object, ExecutionRouteRequestV1[]>();

/** Retains constructor authority and, when present, the exact live source capability. */
export function registerExecutionRouteRequestV1(value: ExecutionRouteRequestV1): void {
  AUTHORIZED_ROUTE_REQUESTS.add(value);
  const source =
    value.kind === "valid-envelope" || value.kind === undefined
      ? value.executionCase
      : value.kind === "invalid-diagnostic"
        ? value.diagnosticCase
        : value.kind === "raw-malformed"
          ? value.malformedCase
          : undefined;
  if (source === undefined) return;
  const routes = SOURCE_ROUTE_REQUESTS.get(source) ?? [];
  routes.push(value);
  SOURCE_ROUTE_REQUESTS.set(source, routes);
}

/** Reports whether a route request came from a closed package constructor. */
export function isGenuineExecutionRouteRequestV1(value: unknown): value is ExecutionRouteRequestV1 {
  return typeof value === "object" && value !== null && AUTHORIZED_ROUTE_REQUESTS.has(value);
}

/** Finds the exact genuine route previously bound to one live source authority. */
export function getExecutionRouteRequestForSourceAuthorityV1(
  authority: object,
  terminalTier: ExecutionTierV1,
  obligation: string,
): ExecutionRouteRequestV1 | undefined {
  return SOURCE_ROUTE_REQUESTS.get(authority)?.find(
    (request) =>
      request.kind !== "reduction-candidate-internal" &&
      request.route.terminalTier === terminalTier &&
      request.route.obligation === obligation,
  );
}
