# RD-07 D64 Allocation-Policy Measurement

> **Scope**: Representative multi-block KERNAL load used to accept
> `cbm-dos-1541-interleave-v1`.
> **Date**: 2026-11-10
> **Status**: Recorded — `VICE-verified / hardware-unverified`

## Fixture

| Item | Value |
| --- | --- |
| Project | `bench` (`c64-pal-d64-kernal-6581`) |
| Unit | `loadable const BIG: byte[5000] = embed("big.bin")`, 5,000 logical bytes |
| Destination | `let dest: byte[5000]` (one module object) |
| D64 | `bench.d64`, 174,848 bytes, SHA-256 `5f49752a1dccabfd8411c0ae37075946b5c70570b786ba475c73ff1a8da43cdb` |
| Boot | 4 blocks |
| Unit | **20 data blocks** (5,002 on-disk bytes including the 2-byte header) |
| Allocation policy | `cbm-dos-1541-interleave-v1` (file interleave 10, directory interleave 3) |
| Free blocks after build | 640 |

The fixture is synthetic and local-only; it is not committed as a product example.

## Instrumentation

The program reads the KERNAL jiffy clock (`peekw($00A0)`) immediately before and after
`c64.loader.load(BIG, dest)`. The stock KERNAL IRQ stays active (quiescence requires only user
routes restored), so the clock advances during the blocking load. The low 16 bits wrap only after
about 18 minutes.

```blend
function main(): void {
    before = peekw($00A0);
    if (c64.loader.load(BIG, dest)) { ok = 1; }
    after = peekw($00A0);
}
```

## Observation

| Run | VICE wall window | `before` | `after` | Delta | `ok` | Payload check |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 15 s | 0 | 512 | 512 jiffies | 1 | first `[0,1,2,3]`, last `[132,133,134,135]` |
| 2 | 30 s | 0 | 512 | 512 jiffies | 1 | first `[0,1,2,3]`, last `[132,133,134,135]` |

- **Emulated load duration**: 512 jiffies at the PAL 60 Hz tick = **8.53 s** from program start to
  the store after the load.
- The 5,000-byte payload was complete: bytes 0–3 and 4,996–4,999 match the synthetic pattern
  (`i & 0xFF`), so no staging or truncation occurred.
- One additional run read the fixture mid-load at a 15 s wall window (`after = 0`, `dest` partially
  written), which is why the recorded runs use 30 s. This is a host-scheduling/warp observation,
  not a policy failure.

## Environment

| Item | Value |
| --- | --- |
| Emulator | VICE 3.10 `x64sc` (pinned) |
| Machine | `c64-pal-kernal-901227-03-6581` |
| KERNAL | 901227-03 |
| Mode | `+warp`, `-autostart`, binary monitor |
| Host | Linux, Node 22 (host timing not used as the measurement) |

## Decision

`cbm-dos-1541-interleave-v1` remains the policy. The standard 1541 order loads a 20-block unit
correctly and deterministically. No sequential-order comparison was made because no real workload
has shown a material penalty; a physical 1541 measurement remains RD-10-owned. Changing the policy
would be an observable format change and is out of scope.
