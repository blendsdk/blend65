// Measure the effective warp multiplier and verify "stopwatch" (no reset) = absolute clock.
import { spawn } from "node:child_process";
import net from "node:net";

const BPORT = 29381, TPORT = 29382;
const EXE = process.env.HOME + "/.local/bin/x64sc";
const CMD_HEADER = 11, RESP_HEADER = 12;
let nextId = 1, acc = new Uint8Array(0), stopWaiter = null;
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
let bsock;
const onData = (chunk) => {
  const m = new Uint8Array(acc.length + chunk.length);
  m.set(acc, 0); m.set(chunk, acc.length);
  let off = 0; const dv = new DataView(m.buffer);
  while (m.length - off >= RESP_HEADER) {
    if (m[off] !== 2) { off += 1; continue; }
    const bl = dv.getUint32(off + 2, true);
    if (m.length - off < RESP_HEADER + bl) break;
    const fr = { type: m[off + 6], reqId: dv.getUint32(off + 8, true) };
    off += RESP_HEADER + bl;
    if (fr.reqId === 0xffffffff) {
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
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error("timeout")); } }, 10000);
});
const connect = (port) => new Promise((res, rej) => {
  let n = 0;
  const att = () => {
    const s = net.connect(port, "127.0.0.1");
    s.once("connect", () => res(s));
    s.once("error", () => { s.destroy(); if (++n >= 120) rej(new Error("connect")); else setTimeout(att, 100); });
  };
  att();
});

const child = spawn(EXE, [
  "-binarymonitor", "-binarymonitoraddress", `127.0.0.1:${BPORT}`,
  "-remotemonitor", "-remotemonitoraddress", `127.0.0.1:${TPORT}`,
  "+sound", "-warp", "-console", "-silent",
], { stdio: ["ignore", "ignore", "ignore"] });

try {
  bsock = await connect(BPORT);
  bsock.on("data", onData);
  const tsock = await connect(TPORT);
  let ttext = "";
  tsock.on("data", (c) => { ttext += c.toString("latin1"); });
  const readAbs = async () => {
    const mark = ttext.length;
    tsock.write("stopwatch\n");
    await new Promise((r) => setTimeout(r, 400));
    return parseInt(ttext.slice(mark).match(/Stopwatch:\s*(\d+)/)?.[1] ?? "-1", 10);
  };
  // machine runs from launch; sample absolute clock at two wall points
  await new Promise((r) => setTimeout(r, 1500));
  const t1 = Date.now(); const c1 = await readAbs(); // stops the machine
  bsock.write(Buffer.from(enc(0xaa, new Uint8Array(0)))); // resume
  await new Promise((r) => setTimeout(r, 3000));
  const t2 = Date.now(); const c2 = await readAbs();
  const dc = c2 - c1, dt = (t2 - t1) / 1000;
  console.log(`abs clock @${t1 % 100000}: ${c1}  @${t2 % 100000}: ${c2}`);
  console.log(`Δcycles=${dc} over ${dt.toFixed(2)}s wall → ${(dc / dt / 985248).toFixed(1)}x realtime (PAL 985248 Hz)`);
} catch (e) {
  console.error("PROBE ERROR:", e.message);
} finally {
  try { bsock?.write(Buffer.from(enc(0xbb, new Uint8Array(0)))); } catch {}
  setTimeout(() => { try { child.kill("SIGKILL"); } catch {}; process.exit(0); }, 1200);
}
