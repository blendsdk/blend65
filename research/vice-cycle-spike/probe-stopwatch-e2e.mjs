// AR #1 spike part 3 — end-to-end measureCycles dry run via the stopwatch:
//   checkpoint at $EA31 (KERNAL IRQ, once per PAL frame) as from==to label.
//   Expected between consecutive arrivals: exactly 19656 cycles (312 lines x 63).
// Also: does a checkpoint abort a long ADVANCE_INSTRUCTIONS (awaiting STOPPED properly)?
import { spawn } from "node:child_process";
import net from "node:net";

const BPORT = 29341;
const TPORT = 29342;
const EXE = process.env.HOME + "/.local/bin/x64sc";
const CMD_HEADER = 11;
const RESP_HEADER = 12;
let nextId = 1;

function encodeCommand(type, body) {
  const id = nextId++;
  const frame = new Uint8Array(CMD_HEADER + body.length);
  const dv = new DataView(frame.buffer);
  frame[0] = 0x02; frame[1] = 0x02;
  dv.setUint32(2, body.length, true);
  dv.setUint32(6, id, true);
  frame[10] = type;
  frame.set(body, CMD_HEADER);
  return { id, frame };
}

let acc = new Uint8Array(0);
const pending = new Map();
let stopWaiter = null;
let hitCount = 0;

function onData(chunk) {
  const merged = new Uint8Array(acc.length + chunk.length);
  merged.set(acc, 0); merged.set(chunk, acc.length);
  let off = 0;
  const dv = new DataView(merged.buffer);
  while (merged.length - off >= RESP_HEADER) {
    if (merged[off] !== 0x02) { off += 1; continue; }
    const bodyLen = dv.getUint32(off + 2, true);
    if (merged.length - off < RESP_HEADER + bodyLen) break;
    const frame = {
      type: merged[off + 6], errorCode: merged[off + 7],
      requestId: dv.getUint32(off + 8, true),
      body: merged.slice(off + RESP_HEADER, off + RESP_HEADER + bodyLen),
    };
    off += RESP_HEADER + bodyLen;
    if (frame.requestId === 0xffffffff) {
      if (frame.type === 0x11 && frame.body[4] !== 0) hitCount++;
      if (frame.type === 0x62 && stopWaiter) { const w = stopWaiter; stopWaiter = null; w(); }
      continue;
    }
    const w = pending.get(frame.requestId);
    if (w) { pending.delete(frame.requestId); w(frame); }
  }
  acc = merged.slice(off);
}

let bsock;
function send(type, body, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const { id, frame } = encodeCommand(type, body);
    pending.set(id, resolve);
    bsock.write(Buffer.from(frame));
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error(`timeout cmd 0x${type.toString(16)}`)); }
    }, timeoutMs);
  });
}

const awaitStop = (ms = 15000) =>
  new Promise((resolve, reject) => {
    stopWaiter = resolve;
    setTimeout(() => { if (stopWaiter) { stopWaiter = null; reject(new Error("no STOPPED event")); } }, ms);
  });

function connect(port, attempts = 80) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const attempt = () => {
      const s = net.connect(port, "127.0.0.1");
      s.once("connect", () => resolve(s));
      s.once("error", () => {
        s.destroy();
        if (++n >= attempts) reject(new Error(`connect ${port} failed`));
        else setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

async function getRegs() {
  const r = await send(0x31, new Uint8Array([0x00]));
  const n = r.body[0] | (r.body[1] << 8);
  let p = 2; const m = {};
  const names = { 3: "PC", 0: "A", 1: "X", 2: "Y", 4: "SP", 5: "FL", 53: "LIN", 54: "CYC" };
  for (let i = 0; i < n; i++) {
    const sz = r.body[p]; const id = r.body[p + 1];
    m[names[id] ?? `r${id}`] = r.body[p + 2] | (r.body[p + 3] << 8);
    p += 1 + sz;
  }
  return m;
}

const child = spawn(EXE, [
  "-binarymonitor", "-binarymonitoraddress", `127.0.0.1:${BPORT}`,
  "-remotemonitor", "-remotemonitoraddress", `127.0.0.1:${TPORT}`,
  "+sound", "-warp", "-console", "-silent",
], { stdio: ["ignore", "ignore", "ignore"] });

try {
  bsock = await connect(BPORT);
  bsock.on("data", onData);
  const tsock = await connect(TPORT, 20);
  let ttext = "";
  tsock.on("data", (c) => { ttext += c.toString("latin1"); });
  const sendText = async (cmd, waitMs = 900) => {
    ttext = "";
    tsock.write(cmd + "\n");
    await new Promise((r) => setTimeout(r, waitMs));
    return ttext.replace(/\r/g, "");
  };

  // Boot to READY: free-run under warp for 4 wall seconds, then stop.
  bsock.write(Buffer.from(encodeCommand(0xaa, new Uint8Array(0)).frame)); // EXIT (resume)
  await new Promise((r) => setTimeout(r, 4000));
  let regs = await getRegs(); // any command stops the machine
  console.log(`after boot: PC=0x${regs.PC.toString(16)} LIN=${regs.LIN} CYC=${regs.CYC}`);

  // Checkpoint at $EA31 (fires every frame once KERNAL IRQ is live).
  await send(0x12, new Uint8Array([0x31, 0xea, 0x31, 0xea, 0x01, 0x01, 0x04, 0x00]));

  // ── Arrival 1 at $EA31 ──
  bsock.write(Buffer.from(encodeCommand(0xaa, new Uint8Array(0)).frame));
  await awaitStop();
  regs = await getRegs();
  console.log(`arrival 1: PC=0x${regs.PC.toString(16)} LIN=${regs.LIN} CYC=${regs.CYC} hits=${hitCount}`);
  const r1 = await sendText("stopwatch reset");
  console.log("stopwatch reset →", JSON.stringify(r1.trim().split("\n")[0]));
  const rasterAt1 = regs.LIN * 63 + regs.CYC;

  // ── Arrival 2 at $EA31: measure exactly one PAL frame ──
  bsock.write(Buffer.from(encodeCommand(0xaa, new Uint8Array(0)).frame));
  await awaitStop();
  regs = await getRegs();
  const r2 = await sendText("stopwatch");
  const measured = parseInt(r2.match(/Stopwatch:\s*(\d+)/)?.[1] ?? "-1", 10);
  console.log(`arrival 2: PC=0x${regs.PC.toString(16)} LIN=${regs.LIN} CYC=${regs.CYC} hits=${hitCount}`);
  console.log(`ONE-FRAME MEASUREMENT: stopwatch=${measured}  expected=19656  ${measured === 19656 ? "EXACT ✓" : "(diff " + (measured - 19656) + ")"}`);
  console.log(`raster consistency: at1=${rasterAt1} at2=${regs.LIN * 63 + regs.CYC} (equal positions expected for a full frame)`);

  // ── Repeat once more for determinism/repeatability ──
  await sendText("stopwatch reset");
  bsock.write(Buffer.from(encodeCommand(0xaa, new Uint8Array(0)).frame));
  await awaitStop();
  const r3 = await sendText("stopwatch");
  const measured2 = parseInt(r3.match(/Stopwatch:\s*(\d+)/)?.[1] ?? "-1", 10);
  console.log(`frame 2 measurement: ${measured2} ${measured2 === 19656 ? "EXACT ✓" : "(diff " + (measured2 - 19656) + ")"}`);

  // ── TEST B redo: does the $EA31 checkpoint abort a long advance? ──
  hitCount = 0;
  const pcBefore = (await getRegs()).PC;
  await send(0x71, new Uint8Array([0x00, 0x30, 0x75])); // ADVANCE 30000 — response is immediate
  await awaitStop(20000); // wait for the STOPPED that ends the stepping
  const after = await getRegs();
  console.log(`TEST B redo: from PC=0x${pcBefore.toString(16)} → PC=0x${after.PC.toString(16)} hits=${hitCount}`);
  console.log(`TEST B verdict: ${after.PC === 0xea31 && hitCount > 0 ? "checkpoint ABORTS advance ✓" : "advance completes; checkpoint does not abort (or hits without stopping)"}`);
} catch (e) {
  console.error("PROBE ERROR:", e.message);
} finally {
  try { bsock?.write(Buffer.from(encodeCommand(0xbb, new Uint8Array(0)).frame)); } catch {}
  setTimeout(() => { try { child.kill("SIGKILL"); } catch {}; process.exit(0); }, 1500);
}
