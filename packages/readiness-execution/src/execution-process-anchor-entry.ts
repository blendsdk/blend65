import { createReadStream, createWriteStream } from "node:fs";

import { runExecutionProcessAnchorV1 } from "./execution-process-kernel.js";
import {
  createExecutionRawControlTransportV1,
  defaultExecutionProcessAnchorHostV1,
} from "./execution-process-linux-host.js";

const input = createReadStream("/dev/null", { fd: 3, autoClose: false });
const output = createWriteStream("/dev/null", { fd: 4, autoClose: false });
const control = createExecutionRawControlTransportV1(input, output);
const cancellation = Object.freeze({
  signal: new AbortController().signal,
  deadlineMonotonicMs: Number.MAX_SAFE_INTEGER,
});

process.on("SIGTERM", () => undefined);

const result = await runExecutionProcessAnchorV1(
  defaultExecutionProcessAnchorHostV1,
  Object.freeze({
    ...control,
    onStdout(bytes: Uint8Array): void {
      process.stdout.write(bytes);
    },
    onStderr(bytes: Uint8Array): void {
      process.stderr.write(bytes);
    },
  }),
  cancellation,
);
process.exitCode = result.ok ? 0 : 1;
