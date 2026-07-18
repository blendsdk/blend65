// AR #1 spike — probe VICE 3.10 binary monitor for a cycle counter.
// Framing copied from packages/test-harness/src/emulator/vice/protocol.ts.
import { spawn } from "node:child_process";
import net from "node:net";

const PORT = 29321;
const EXE = process.env.HOME + "/.local/bin/x64sc";

const CMD_HEADER = 11;
const RESP_HEADER = 12;
let nextId = 1;

function encodeCommand(type, body) {
  const id = nextId++;
  const frame = new Uint8Array(CMD_HEADER + body.length);
  const dv = new DataView(frame.buffer);
  frame[0] = 0x02;
  frame[1] = 0x02;
  dv.setUint32(2, body.length, true);
  dv.setUint32(6, id, true);
  frame[10] = type;
  frame.set(body, CMD_HEADER);
  return { id, frame };
}

let acc = new Uint8Array(0);
const pending = new Map();
const events = [];

function onData(chunk) {
  const merged = new Uint8Array(acc.length + chunk.length);
  merged.set(acc, 0);
  merged.set(chunk, acc.length);
  let off = 0;
  const dv = new DataView(merged.buffer);
  while (merged.length - off >= RESP_HEADER) {
    if (merged[off] !== 0x02) { off += 1; continue; }
    const bodyLen = dv.getUint32(off + 2, true);
    if (merged.length - off < RESP_HEADER + bodyLen) break;
    const frame = {
      type: merged[off + 6],
      errorCode: merged[off + 7],
      requestId: dv.getUint32(off + 8, true),
      body: merged.slice(off + RESP_HEADER, off + RESP_HEADER + bodyLen),
    };
    off += RESP_HEADER + bodyLen;
    if (frame.requestId === 0xffffffff) { events.push(frame); continue; }
    const w = pending.get(frame.requestId);
    if (w) { pending.delete(frame.requestId); w(frame); }
  }
  acc = merged.slice(off);
}

let socket;
function send(type, body) {
  return new Promise((resolve, reject) => {
    const { id, frame } = encodeCommand(type, body);
    pending.set(id, resolve);
    socket.write(Buffer.from(frame));
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error(`timeout on cmd 0x${type.toString(16)}`)); }
    }, 5000);
  });
}

function connect(port, attempts = 60) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const attempt = () => {
      const s = net.connect(port, "127.0.0.1");
      s.once("connect", () => resolve(s));
      s.once("error", () => {
        s.destroy();
        if (++n >= attempts) reject(new Error("connect failed"));
        else setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join(" ");

const child = spawn(EXE, ["-binarymonitor", "-binarymonitoraddress", `127.0.0.1:${PORT}`, "+sound", "-warp", "-console", "-silent"], { stdio: ["ignore", "ignore", "ignore"] });
try {
  socket = await connect(PORT);
  socket.on("data", onData);

  // ── VICE_INFO (0x85): confirm exact version ──
  const info = await send(0x85, new Uint8Array(0));
  const mLen = info.body[0];
  const main = [...info.body.slice(1, 1 + mLen)].join(".");
  console.log(`VICE_INFO: version ${main}  (raw: ${hex(info.body)})`);

  // ── REGISTERS_AVAILABLE (0x83, memspace 0): dump every register, id + bit size + name ──
  const avail = await send(0x83, new Uint8Array([0x00]));
  const count = avail.body[0] | (avail.body[1] << 8);
  console.log(`\nREGISTERS_AVAILABLE: ${count} registers`);
  let o = 2;
  for (let i = 0; i < count; i++) {
    const itemSize = avail.body[o];
    const id = avail.body[o + 1];
    const bits = avail.body[o + 2];
    const nameLen = avail.body[o + 3];
    const name = String.fromCharCode(...avail.body.slice(o + 4, o + 4 + nameLen));
    console.log(`  id=${String(id).padStart(3)} bits=${String(bits).padStart(2)} name=${name}`);
    o += 1 + itemSize;
  }

  // ── REGISTERS_GET (0x31): raw dump — item sizes reveal any >16-bit values ──
  async function dumpRegs(label) {
    const regs = await send(0x31, new Uint8Array([0x00]));
    const n = regs.body[0] | (regs.body[1] << 8);
    let p = 2;
    const out = [];
    for (let i = 0; i < n; i++) {
      const itemSize = regs.body[p];
      const id = regs.body[p + 1];
      const valueBytes = regs.body.slice(p + 2, p + 1 + itemSize);
      let v = 0n;
      for (let k = valueBytes.length - 1; k >= 0; k--) v = (v << 8n) | BigInt(valueBytes[k]);
      out.push({ id, itemSize, value: v });
      p += 1 + itemSize;
    }
    console.log(`\n${label}: ${out.map((r) => `id${r.id}(sz${r.itemSize})=${r.value}`).join(" ")}`);
    return out;
  }

  await dumpRegs("REGISTERS_GET #1");
  // Advance 100 instructions, read again — see which ids move and by how much.
  await send(0x71, new Uint8Array([0x00, 100 & 0xff, 0])); // ADVANCE_INSTRUCTIONS x100
  await dumpRegs("REGISTERS_GET #2 (after 100 instr)");
  await send(0x71, new Uint8Array([0x00, 100 & 0xff, 0]));
  await dumpRegs("REGISTERS_GET #3 (after 200 instr)");
} catch (e) {
  console.error("PROBE ERROR:", e.message);
} finally {
  try { socket?.write(Buffer.from(encodeCommand(0xbb, new Uint8Array(0)).frame)); } catch {}
  setTimeout(() => { try { child.kill("SIGKILL"); } catch {}; process.exit(0); }, 1500);
}
