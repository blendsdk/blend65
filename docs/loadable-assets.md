# Loadable Assets and D64 Delivery

This page describes the first qualified disk-delivery profile,
`c64-pal-d64-kernal-6581`, and its trusted-media boundary.

## What the compiler delivers

A `loadable const` is an exact typed value that is packaged outside the resident PRG. The compiler
writes one standard 35-track D64 containing:

- the BASIC-startable boot PRG as the first directory entry;
- one uncompressed PRG component for each reachable load unit.

`c64.loader.load(unit, destination)` transfers one unit into a mutable fixed destination and returns
`boolean`. The destination must have exactly the unit's logical type and size. The compiler proves
the destination interval and does not copy the bytes through a staging buffer.

## Trusted media only (HLE-010)

The stock KERNAL `LOAD` routine has no maximum-length parameter. It writes each received byte before
the wrapper can inspect the returned end address. The compiler-produced D64 and its unit hashes are
the trusted deployable artifact.

If a unit file is replaced by a readable, longer file on altered media, the KERNAL may overwrite
memory past the declared destination before `load()` returns `false`. The first loader does not
claim containment for corrupted, hostile, or independently mutable media. It adds no checksum,
staging copy, custom bounded transport, or fastloader. A later qualified loader can change that
boundary.

## Quiescence

`load()` is synchronous and mainline-only. Before the call, stop or restore every user IRQ/NMI route
and every asynchronous audio/player route. The stock KERNAL service route stays active. The compiler
rejects a call while a recognized user route is still active. Mainline audio ticks cannot run during
the blocking call and need no separate stop.

The loader does not silently pause, restart, or reconstruct callbacks, music, effects, frame
counters, or gameplay state. It makes no raster, frame, or audio cadence promise. The loading screen,
fade, silence, retry, abort, and post-load restoration policy belong to the application.

## Failure recovery

On `false`, the captured destination range is indeterminate and cannot be read until it is fully
reassigned or a later load succeeds. The application owns retry, error display, menu return, or
termination. The compiler supplies no modal UI, retry loop, disk prompt, or error text.

## Product boundary

The compiler and toolchain deliver typed load units, the KERNAL transport, the D64, and their
evidence. They do not provide a game engine, renderer, scene system, asset manager, loading screen,
scheduler, or gameplay library.
