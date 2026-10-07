import { describe, it } from "vitest";
import {
  CIA2_PROFILES,
  cia2Lease,
  cia2Source,
  expectCia2Accepted,
  expectCia2Rejected,
} from "./cia2-fixture.js";

/** A reusable byte parameter carries the caller's actual mask to the device operation. */
const clearHelper = `
function clear(mask: byte): void {
  disableInterruptSources(mask);
}`;

describe.each(CIA2_PROFILES)("CIA2 reusable ownership on %s", (target) => {
  it("accepts balanced successor installation inside an exclusive handler", async () => {
    const source = cia2Lease("", "setNMIExclusive(&successor); restoreNMI();");
    await expectCia2Accepted(source, target);
  });

  it("accepts a full mask clear passed to an ordinary helper", async () => {
    const source = cia2Lease("clear($1F); enableInterruptSources($01);", "", clearHelper);
    await expectCia2Accepted(source, target);
  });

  it("accepts a full mask clear passed through a transitive ordinary wrapper", async () => {
    const source = cia2Lease(
      "forward($1F); enableInterruptSources($01);",
      "",
      `${clearHelper}
function forward(mask: byte): void {
  clear(mask);
}`,
    );
    await expectCia2Accepted(source, target);
  });

  it("rejects a partial helper clear as proof of the complete interrupt mask", async () => {
    const source = cia2Lease("clear($01); enableInterruptSources($01);", "", clearHelper);
    await expectCia2Rejected(source, target, "E10278");
  });

  it("rejects an unknown helper clear as proof of the complete interrupt mask", async () => {
    const source = cia2Lease("clear(peek($0400)); enableInterruptSources($01);", "", clearHelper);
    await expectCia2Rejected(source, target, "E10278");
  });

  it("reports unresolved chained versus typed final ownership at the common restore", async () => {
    const source = cia2Source(`
if (peek($0400) != 0) {
  setNMI(&handler);
} else {
  setNMIExclusive(&handler);
  disableInterruptSources($1F);
}
restoreNMI();`);
    await expectCia2Rejected(
      source,
      target,
      "E10278",
      /^Interrupt ownership for sink '[^']+' is invalid at 'c64\.system\.restoreNMI' — .+$/,
    );
  });
});
