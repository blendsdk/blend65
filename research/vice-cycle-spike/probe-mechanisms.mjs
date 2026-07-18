// AR #1 spike part 2 — test the two viable measurement mechanisms:
//  A) text remote-monitor stopwatch coexisting with the binary monitor
//  B) checkpoint aborting ADVANCE_INSTRUCTIONS early (enables chunked raster arithmetic)
import { spawn } from "node:child_process";
import net from "node:net";

const BPORT = 29331;
const TPORT = 29332;
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
let eventLog = [];

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
    if (frame.requestId === 0xffffffff) { eventLog.push(frame); continue; }
    const w = pending.get(frame.requestId);
    if (w) { pending.delete(frame.requestId); w(frame); }
  }
  acc = merged.slice(off);
}

let bsock;
function send(type, body, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    const { id, frame } = encodeCommand(type, body);
    pending.set(id, resolve);
    bsock.write(Buffer.from(frame));
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error(`timeout cmd 0x${type.toString(16)}`)); }
    }, timeoutMs);
  });
}

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

  // Let the C64 boot a little so the KERNAL IRQ is live.
  await send(0x71, new Uint8Array([0x00, 0xff, 0xff])); // advance 65535 instructions
  console.log("boot advance done");

  // ── TEST B: does a checkpoint abort ADVANCE_INSTRUCTIONS? ──
  // $EA31 = KERNAL IRQ handler tail — executes every frame while the IRQ runs.
  const cp = await send(0x12, new Uint8Array([0x31, 0xea, 0x31, 0xea, 0x01, 0x01, 0x04, 0x00]));
  console.log("checkpoint set at $EA31, err", cp.errorCode);
  eventLog = [];
  const before = await getRegs();
  // Advance 30000 instructions — far more than one frame (~4-6k instr). If the
  // checkpoint aborts the advance, we stop at PC=$EA31 (60977 dec).
  await send(0x71, new Uint8Array([0x00, 0x30, 0x75])); // 0x7530 = 30000
  const after = await getRegs();
  const hitEvents = eventLog.filter((f) => f.type === 0x11 && f.body[4] !== 0).length;
  console.log(`TEST B: before PC=${before.PC} LIN=${before.LIN} CYC=${before.CYC}`);
  console.log(`TEST B: after  PC=${after.PC} (0x${after.PC.toString(16)}) LIN=${after.LIN} CYC=${after.CYC} checkpointHits=${hitEvents}`);
  console.log(`TEST B verdict: ${after.PC === 0xea31 ? "CHECKPOINT ABORTS ADVANCE ✓" : "advance ran to completion (no abort) ✗"}`);

  // ── TEST A: text remote monitor while binary monitor holds the machine stopped ──
  const tsock = await connect(TPORT, 20).catch((e) => { console.log("TEST A: text connect FAILED:", e.message); return undefined; });
  if (tsock) {
    let ttext = "";
    tsock.on("data", (c) => { ttext += c.toString("latin1"); });
    const sendText = async (cmd, waitMs = 1200) => {
      ttext = "";
      tsock.write(cmd + "\n");
      await new Promise((r) => setTimeout(r, waitMs));
      return ttext.replace(/\r/g, "");
    };
    const r1 = await sendText("stopwatch reset");
    console.log("TEST A: 'stopwatch reset' →", JSON.stringify(r1.slice(0, 200)));
    // advance 1000 instructions via the BINARY monitor, then read stopwatch via TEXT
    const rb = await getRegs();
    await send(0x71, new Uint8Array([0x00, 0xe8, 0x03])); // 1000
    const ra = await getRegs();
    const r2 = await sendText("stopwatch");
    console.log("TEST A: 'stopwatch' after 1000 instr →", JSON.stringify(r2.slice(0, 200)));
    // raster arithmetic over the same window for comparison (PAL: 312 lines × 63 cyc)
    const rasterDelta = (ra.LIN * 63 + ra.CYC) - (rb.LIN * 63 + rb.CYC);
    console.log(`TEST A: raster delta over same window (no wrap correction): ${rasterDelta} (LIN ${rb.LIN}→${ra.LIN})`);
  }
} catch (e) {
  console.error("PROBE ERROR:", e.message);
} finally {
  try { bsock?.write(Buffer.from(encodeCommand(0xbb, new Uint8Array(0)).frame)); } catch {}
  setTimeout(() => { try { child.kill("SIGKILL"); } catch {}; process.exit(0); }, 1500);
}
