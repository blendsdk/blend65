// Challenger probe for measureCycles option (a) — text-monitor stopwatch.
// Tests:
//  T1  binary-socket event traffic DURING text-monitor commands (spurious STOPPED/RESUMED?)
//  T2  text-socket async pollution at checkpoint stops (break banner / prompt noise)
//  T3  stale-STOPPED race: arm a waiter after text interaction, send nothing — does anything arrive?
//  T4  reset-anchored determinism: window(arrival1→2) and (2→3) after hard reset, twice in-process
//  T5  text command while RUNNING: does it halt the machine? binary events? recoverable via binary EXIT?
// Run twice (different ports) to compare T4 across processes.
import { spawn } from "node:child_process";
import net from "node:net";

const BPORT = Number(process.argv[2] ?? 29351);
const TPORT = BPORT + 1;
const EXE = process.env.HOME + "/.local/bin/x64sc";
const CMD_HEADER = 11;
const RESP_HEADER = 12;
let nextId = 1;
const t0 = Date.now();
const log = (...a) => console.log(`[${String(Date.now() - t0).padStart(6)}ms]`, ...a);

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
let hitSinceArm = false;
let eventLogEnabled = true;
const eventLog = []; // { t, kind }

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
      const name = { 0x11: "CHECKPOINT_INFO", 0x61: "JAM", 0x62: "STOPPED", 0x63: "RESUMED" }[frame.type] ?? `evt0x${frame.type.toString(16)}`;
      if (eventLogEnabled) eventLog.push({ t: Date.now() - t0, kind: name, hit: frame.type === 0x11 ? frame.body[4] : undefined });
      if (frame.type === 0x11 && frame.body[4] !== 0) hitSinceArm = true;
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
const exit = () => bsock.write(Buffer.from(encodeCommand(0xaa, new Uint8Array(0)).frame));
const awaitStop = (ms = 20000) =>
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
  const tchunks = []; // { t, s }
  tsock.on("data", (c) => { const s = c.toString("latin1"); ttext += s; tchunks.push({ t: Date.now() - t0, s }); });

  const sendText = async (cmd, waitMs = 700) => {
    const mark = ttext.length;
    tsock.write(cmd + "\n");
    await new Promise((r) => setTimeout(r, waitMs));
    return ttext.slice(mark).replace(/\r/g, "");
  };

  // Banner check on connect (500ms, machine running).
  await new Promise((r) => setTimeout(r, 500));
  log("T2 banner on text connect:", JSON.stringify(ttext));

  // Set checkpoint at $EA31 (this stops the machine), then HARD RESET for a deterministic anchor.
  const cpResp = await send(0x12, new Uint8Array([0x31, 0xea, 0x31, 0xea, 0x01, 0x01, 0x04, 0x00]));
  const cpNum = cpResp.body[0] | (cpResp.body[1] << 8) | (cpResp.body[2] << 16) | (cpResp.body[3] << 24);
  log(`checkpoint #${cpNum} set at $ea31`);

  async function measureTriplet(label) {
    await send(0xcc, new Uint8Array([0x01])); // hard reset
    hitSinceArm = false;
    const p1 = awaitStop();
    exit(); // in case reset left us stopped
    await p1; // arrival 1 (deterministic index from reset)
    const regs1 = await getRegs();
    await new Promise((r) => setTimeout(r, 200)); // let any async text output land
    const textAtStop = ttext.length;
    // T1: capture binary events during the text command
    const evtMark = eventLog.length;
    const r1 = await sendText("stopwatch reset");
    log(`T1 [${label}] binary events during 'stopwatch reset':`, JSON.stringify(eventLog.slice(evtMark)));
    log(`T2 [${label}] text reply to 'stopwatch reset':`, JSON.stringify(r1));
    // T3: stale-STOPPED race — arm a waiter, send NOTHING for 600ms.
    let stale = false;
    const staleWaiter = new Promise((resolve) => {
      stopWaiter = () => { stale = true; resolve(); };
      setTimeout(() => { if (stopWaiter) { stopWaiter = null; } resolve(); }, 600);
    });
    await staleWaiter;
    log(`T3 [${label}] stale STOPPED after text cmd (no EXIT sent): ${stale ? "YES — RACE CONFIRMED" : "none (clean)"}`);
    // window 1→2
    hitSinceArm = false;
    const p2 = awaitStop(); exit(); await p2;
    const evtMark2 = eventLog.length;
    const r2 = await sendText("stopwatch");
    log(`T1 [${label}] binary events during 'stopwatch':`, JSON.stringify(eventLog.slice(evtMark2)));
    const w12 = parseInt(r2.match(/Stopwatch:\s*(\d+)/)?.[1] ?? "-1", 10);
    log(`T2 [${label}] raw 'stopwatch' reply:`, JSON.stringify(r2));
    // window 2→3
    await sendText("stopwatch reset");
    hitSinceArm = false;
    const p3 = awaitStop(); exit(); await p3;
    const r3 = await sendText("stopwatch");
    const w23 = parseInt(r3.match(/Stopwatch:\s*(\d+)/)?.[1] ?? "-1", 10);
    log(`T4 [${label}] arrival1 PC=0x${regs1.PC.toString(16)} LIN=${regs1.LIN} CYC=${regs1.CYC}  W12=${w12}  W23=${w23}`);
    return { w12, w23, lin1: regs1.LIN, cyc1: regs1.CYC };
  }

  const a = await measureTriplet("run A");
  const b = await measureTriplet("run B");
  log(`T4 in-process reset determinism: W12 ${a.w12} vs ${b.w12} ${a.w12 === b.w12 ? "EQUAL ✓" : "DIFFER ✗"}; W23 ${a.w23} vs ${b.w23} ${a.w23 === b.w23 ? "EQUAL ✓" : "DIFFER ✗"}`);
  console.log(`DETERMINISM_KEY ${a.w12} ${a.w23} ${b.w12} ${b.w23}`);

  // ── T5: text command while RUNNING ──
  await send(0x13, new Uint8Array([cpNum & 0xff, (cpNum >> 8) & 0xff, (cpNum >> 16) & 0xff, (cpNum >> 24) & 0xff])); // delete checkpoint
  exit(); // free-run
  await new Promise((r) => setTimeout(r, 400));
  const evtMark3 = eventLog.length;
  const tMark = ttext.length;
  tsock.write("stopwatch\n");
  await new Promise((r) => setTimeout(r, 900));
  const runningReply = ttext.slice(tMark).replace(/\r/g, "");
  log("T5 text 'stopwatch' WHILE RUNNING → reply:", JSON.stringify(runningReply));
  log("T5 binary events during it:", JSON.stringify(eventLog.slice(evtMark3)));
  // Is the machine now stopped? Read stopwatch twice via text 500ms apart WITHOUT resuming.
  const v1 = parseInt((await sendText("stopwatch")).match(/Stopwatch:\s*(\d+)/)?.[1] ?? "-1", 10);
  await new Promise((r) => setTimeout(r, 500));
  const v2 = parseInt((await sendText("stopwatch")).match(/Stopwatch:\s*(\d+)/)?.[1] ?? "-1", 10);
  log(`T5 stopwatch frozen check: ${v1} then ${v2} → machine is ${v1 === v2 ? "STOPPED (text cmd halted it)" : "RUNNING"}`);
  // Recovery: binary EXIT, then confirm the clock advances again.
  const evtMark4 = eventLog.length;
  exit();
  await new Promise((r) => setTimeout(r, 500));
  const v3 = parseInt((await sendText("stopwatch")).match(/Stopwatch:\s*(\d+)/)?.[1] ?? "-1", 10);
  log(`T5 after binary EXIT: stopwatch=${v3} → ${v3 > v2 ? "RESUMED via binary EXIT ✓ (recoverable)" : "STILL STOPPED ✗"}`);
  log("T5 binary events around recovery:", JSON.stringify(eventLog.slice(evtMark4)));
} catch (e) {
  console.error("PROBE ERROR:", e.message);
} finally {
  try { bsock?.write(Buffer.from(encodeCommand(0xbb, new Uint8Array(0)).frame)); } catch {}
  setTimeout(() => { try { child.kill("SIGKILL"); } catch {}; process.exit(0); }, 1500);
}
