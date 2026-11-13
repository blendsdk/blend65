import { availableParallelism } from "node:os";

/**
 * Bound host-test concurrency for both local machines and small CI runners.
 * VICE is never included here; it always runs with one worker.
 */
const override = Number.parseInt(process.env.BLEND65_TEST_WORKERS ?? "", 10);
export const hostWorkers =
  Number.isInteger(override) && override > 0
    ? override
    : Math.max(1, Math.min(4, availableParallelism()));
