// Cross-process determinism probe for measureCycles option (a).
// Builds a PRG: BASIC stub SYS 2064; $0810 (from-label, hit once at RUN) →
// ~327k-cycle busy loop spanning ~20 KERNAL IRQs → $081A (to-label).
// Flow per fresh process: connect → set checkpoints (stops machine early in boot,
// BEFORE autostart reaches the program) → resume → stop@0810 → stopwatch reset →
// resume → stop@081A → stopwatch. Prints W. Runs the whole thing TWICE in fresh
// processes and compares. Requirement under test: deterministic across runs.
import { spawn } from "node:child_process";
import net from "node:net";
import fs from "node:fs";

const EXE = process.env.HOME + "/.local/bin/x64sc";
const SCRATCH = "/tmp/claude-1000/-home-gevik-workdir-github-blend65-ri-blend65-asm-parity/825bf4bb-a76e-4377-973b-ab5d10f602b5/scratchpad";
const PRG = `${SCRATCH}/det-test.prg`;

// $0801 BASIC stub: 10 SYS2064  → then code at $0810.
const prg = Buffer.from([
  0x01, 0x08,             // load address $0801
  0x0c, 0x08, 0x0a, 0x00, // next line $080c, line 10
  0x9e, 0x32, 0x30, 0x36, 0x34, 0x00, // SYS 2064
  0x00, 0x00,             // end of program
  0x00,                   // pad → code starts at $0810
  // $0810:
  0xa2, 0x00,             // LDX #$00
  0xa0, 0x00,             // LDY #$00
  // $0814 loop:
  0x88,                   // DEY
  0xd0, 0xfd,             // BNE $0814
  0xca,                   // DEX
  0xd0, 0xfa,             // BNE $0814
  // $081A:
  0xee, 0x20, 0xd0,       // INC $d020
  0x4c, 0x1a, 0x08,       // JMP $081a
]);
fs.writeFileSync(PRG, prg);

const CMD_HEADER = 11, RESP_HEADER = 12;

async function runOnce(bport) {
  const tport = bport + 1;
  let nextId = 1, acc = new Uint8Array(0), stopWaiter = null, hitSinceArm = false;
  const pending = new Map();
  const enc = (type, body) => {
    const id = nextId++;
    const f = new Uint8Array(CMD_HEADER + body.length);
    const dv = new DataView(f.buffer);
    f[0] = 2; f[1] = 2;
    dv.setUint32(2, body.length, true); dv.setUint32(6, id, true);
    f[10] = type; f.set(body, CMD_HEADER);
    return f;
  };
  const child = spawn(EXE, [
    "-binarymonitor", "-binarymonitoraddress", `127.0.0.1:${bport}`,
    "-remotemonitor", "-remotemonitoraddress", `127.0.0.1:${tport}`,
    "+sound", "-warp", "-console", "-silent",
    "-autostart", PRG,
  ], { stdio: ["ignore", "ignore", "ignore"] });
  let bsock;
  const onData = (chunk) => {
    const m = new Uint8Array(acc.length + chunk.length);
    m.set(acc, 0); m.set(chunk, acc.length);
    let off = 0; const dv = new DataView(m.buffer);
    while (m.length - off >= RESP_HEADER) {
      if (m[off] !== 2) { off += 1; continue; }
      const bl = dv.getUint32(off + 2, true);
      if (m.length - off < RESP_HEADER + bl) break;
      const fr = { type: m[off + 6], err: m[off + 7], reqId: dv.getUint32(off + 8, true), body: m.slice(off + RESP_HEADER, off + RESP_HEADER + bl) };
      off += RESP_HEADER + bl;
      if (fr.reqId === 0xffffffff) {
        if (fr.type === 0x11 && fr.body[4] !== 0) hitSinceArm = true;
        if (fr.type === 0x62 && stopWaiter) { const w = stopWaiter; stopWaiter = null; w(); }
        continue;
      }
      const w = pending.get(fr.reqId);
      if (w) { pending.delete(fr.reqId); w(fr); }
    }
    acc = m.slice(off);
  };
  const send = (type, body) => new Promise((res, rej) => {
    const f = enc(type, body);
    const id = new DataView(f.buffer).getUint32(6, true);
    pending.set(id, res);
    bsock.write(Buffer.from(f));
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error(`timeout 0x${type.toString(16)}`)); } }, 15000);
  });
  const exit = () => bsock.write(Buffer.from(enc(0xaa, new Uint8Array(0))));
  const awaitStop = (ms = 45000) => new Promise((res, rej) => {
    stopWaiter = res;
    setTimeout(() => { if (stopWaiter) { stopWaiter = null; rej(new Error("no STOPPED")); } }, ms);
  });
  const connect = (port, attempts = 120) => new Promise((res, rej) => {
    let n = 0;
    const att = () => {
      const s = net.connect(port, "127.0.0.1");
      s.once("connect", () => res(s));
      s.once("error", () => { s.destroy(); if (++n >= attempts) rej(new Error(`connect ${port}`)); else setTimeout(att, 100); });
    };
    att();
  });
  const getPC = async () => {
    const r = await send(0x31, new Uint8Array([0]));
    const n = r.body[0] | (r.body[1] << 8);
    let p = 2;
    for (let i = 0; i < n; i++) {
      const sz = r.body[p], id = r.body[p + 1];
      if (id === 3) return r.body[p + 2] | (r.body[p + 3] << 8);
      p += 1 + sz;
    }
    return -1;
  };
  try {
    bsock = await connect(bport);
    bsock.on("data", onData);
    // Setup while the machine is barely into boot: both checkpoints. First command stops the machine.
    await send(0x12, new Uint8Array([0x10, 0x08, 0x10, 0x08, 1, 1, 4, 0])); // $0810
    await send(0x12, new Uint8Array([0x1a, 0x08, 0x1a, 0x08, 1, 1, 4, 0])); // $081a
    const pcAtSetup = await getPC();
    const tsock = await connect(tport, 30);
    let ttext = "";
    tsock.on("data", (c) => { ttext += c.toString("latin1"); });
    const sendText = async (cmd, waitMs = 600) => {
      const mark = ttext.length;
      tsock.write(cmd + "\n");
      await new Promise((r) => setTimeout(r, waitMs));
      return ttext.slice(mark).replace(/\r/g, "");
    };
    // Resume through boot+autostart to the from-label.
    hitSinceArm = false;
    let p = awaitStop(); exit(); await p;
    const pcFrom = await getPC();
    const rst = await sendText("stopwatch reset");
    // from → to
    hitSinceArm = false;
    p = awaitStop(); exit(); await p;
    const pcTo = await getPC();
    const rd = await sendText("stopwatch");
    const w = parseInt(rd.match(/Stopwatch:\s*(\d+)/)?.[1] ?? "-1", 10);
    return { pcAtSetup, pcFrom, pcTo, w, resetOk: /Stopwatch reset to 0\./.test(rst) };
  } finally {
    try { bsock?.write(Buffer.from(enc(0xbb, new Uint8Array(0)))); } catch {}
    setTimeout(() => { try { child.kill("SIGKILL"); } catch {} }, 1200);
  }
}

const r1 = await runOnce(29361);
console.log(`process 1: setupPC=0x${r1.pcAtSetup.toString(16)} from=0x${r1.pcFrom.toString(16)} to=0x${r1.pcTo.toString(16)} resetOk=${r1.resetOk} W=${r1.w}`);
const r2 = await runOnce(29365);
console.log(`process 2: setupPC=0x${r2.pcAtSetup.toString(16)} from=0x${r2.pcFrom.toString(16)} to=0x${r2.pcTo.toString(16)} resetOk=${r2.resetOk} W=${r2.w}`);
console.log(`CROSS-PROCESS DETERMINISM: ${r1.w} vs ${r2.w} → ${r1.w === r2.w && r1.w > 0 ? "EQUAL ✓" : "DIFFER ✗"}`);
console.log(`(expected ballpark: 256*256*~5 ≈ 327k + ~20 IRQ handlers ≈ 330-350k)`);
setTimeout(() => process.exit(0), 1500);
