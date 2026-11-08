# RD-06 Producer Evidence Handoff — SpritePad 3.80 / CharPad 3.80 / GoatTracker 2.77

> **2026-11-08 update:** the licensed applications, official SPD v5/CTM v9 manuals and real example
> files are now available at `/home/gevik/workdir/github/blend65.ri/apps`. No manual evidence
> collection is required for SpritePad or CharPad. The plan uses the vendor manuals as the schema
> authority and the selected real examples as local-only acceptance evidence; committed fixtures are
> synthetic. GoatTracker is moved to a follow-up feature and is not an RD-06 blocker. The sections
> below are retained as a checklist for a future version or a different host.

> **Purpose**: the original Windows checklist for SpritePad C64 Pro 3.80 and
> CharPad C64 Pro 3.80 evidence. It lists what to save, export, record and transfer.
> The Linux build and CI never run these applications; they consume only the
> selected real or synthetic fixture bytes.
>
> **Authority**: RD-06 R6.1, R6.12 and R6.19 in
> `codeops/features/blend65-v4/requirements/RD-06-native-assets-compile-time-composition-and-resident-layout.md`.
> Do not substitute handmade, converted, re-saved or guessed files.

## What you need on Windows

- SpritePad C64 Pro **3.80** (exactly this version).
- CharPad C64 Pro **3.80** (exactly this version).
- A folder to collect the evidence, for example `C:\rd06-evidence\`.
- A way to transfer the finished zip to the Linux checkout (shared folder, USB,
  network copy or `scp`).

If you have older or newer versions only, stop and report the version. A different
producer version does not satisfy the checkpoint and must not be relabelled.

## Part A — SpritePad C64 Pro 3.80 / SPD v5

Create or open the project, then save the following **producer-saved** files as
SPD v5. Use the exact names below; keep the producer's file extension (normally
`.spd`). Do not edit the files after saving.

| File name | What it must contain |
|---|---|
| `SPD380-MIN-V5.spd` | Smallest representative real project; at least one sprite, no optional components required |
| `SPD380-ALL-V5.spd` | Complete project with every component and selector surface you use |
| `SPD380-WIDE-V5.spd` | Boundary/wide project: maximum practical sprite count, indices, records, tags or dimensions |
| `SPD380-OPTIONALS-V5-tiles.spd` | Project with the tile layer present |
| `SPD380-OPTIONALS-V5-attributes.spd` | Project with per-sprite attributes present |
| `SPD380-OPTIONALS-V5-tags.spd` | Project with tags present |
| `SPD380-OPTIONALS-V5-overlays.spd` | Project with overlay distances present |
| `SPD380-OPTIONALS-V5-sprite-animation.spd` | Project with sprite-animation data present |
| `SPD380-OPTIONALS-V5-tile-animation.spd` | Project with tile-animation data present |

If one optional component is not supported or not used in a real project, omit
that file and say so in `provenance.txt`. Do not invent an empty project.

For each project also export the selected components (binary or ASM) to an
`exports\` subfolder. The exports are a cross-check, not the primary evidence.

Capture a screenshot of the SpritePad Help/About window showing **3.80** and put
it in `version-evidence\`.

## Part B — CharPad C64 Pro 3.80 / CTM v9

Create or open the project, then save the following **producer-saved** files as
CTM v9. Use the exact names below; keep the producer's file extension (normally
`.ctm`). Do not edit the files after saving.

| File name | What it must contain |
|---|---|
| `CTM380-MIN-V9.ctm` | Smallest representative real project |
| `CTM380-ALL-V9.ctm` | Complete project with every component and selector surface you use |
| `CTM380-WIDE-V9.ctm` | Boundary/wide project: maximum practical dimensions, counts, indices or payloads |
| `CTM380-<display>-<color>-<tile-mode>-V9.ctm` | One project for every meaningful display × color × tile-mode combination |

For the combination files, use short names that state the three settings, for
example:

- `CTM380-multicolor-color-tile-V9.ctm`
- `CTM380-hires-mono-notile-V9.ctm`

The `provenance.txt` must list the exact display, color and tile-mode setting for
every combination file.

For each project also export the selected map/tile/charset components to an
`exports\` subfolder. Capture a screenshot of the CharPad Help/About window
showing **3.80** and put it in `version-evidence\`.

## Part C — Settings and provenance

Create one `provenance.txt` in each family folder. It must state, for every file:

- producer name and exact version (SpritePad 3.80 or CharPad 3.80);
- who saved the file and when;
- the machine/Windows version used;
- the project settings that affect the bytes (for SpritePad: sprite count,
  multicolor, overlay, tiles, attributes, tags, animation; for CharPad: display
  mode, color mode, tile mode, map dimensions, tile settings, export options);
- the exact save/export operation performed;
- whether the file is the original producer save (it must be).

## Part D — Retention approval

Add this statement to each `provenance.txt`, edited to match your situation:

> I approve retaining these SpritePad 3.80 / CharPad 3.80 producer-saved project
> files, exports, settings and version evidence in the Blend65 repository as test
> fixtures. They may be redistributed with the repository. Any third-party
> graphics or music included are covered by: `<license or permission>`. Attribution:
> `<text>`.

If any file contains third-party content you cannot redistribute, do not commit
it. State the restriction and we will plan a local-only evidence path with a
committed manifest and hashes.

## Part E — Folder layout and hashes

Create this layout (the Linux side will place it under `test/rd06/fixtures/`):

```text
rd06-evidence\
  spritepad-3.80\
    SPD380-MIN-V5.spd
    SPD380-ALL-V5.spd
    SPD380-WIDE-V5.spd
    SPD380-OPTIONALS-V5-*.spd
    exports\
    version-evidence\
    provenance.txt
  charpad-3.80\
    CTM380-MIN-V9.ctm
    CTM380-ALL-V9.ctm
    CTM380-WIDE-V9.ctm
    CTM380-<display>-<color>-<tile-mode>-V9.ctm
    exports\
    version-evidence\
    provenance.txt
```

On Windows PowerShell, generate the hashes:

```powershell
Get-ChildItem -Recurse -File | Get-FileHash -Algorithm SHA256 |
  ForEach-Object { "$($_.Hash.ToLower())  $($_.Path)" } |
  Set-Content SHA256SUMS.txt
```

Keep the originals unchanged. Do not open and re-save them after hashing.

## Part G — GoatTracker 2.77 (callable-audio adapter evidence)

GoatTracker is a separate adapter family, not a native asset format. Provide:

| File | What it must contain |
|---|---|
| `GT277-MUSIC-ONLY-<name>.prg` | Exact exported player + tune with music only, no `-Dx` SFX |
| `GT277-SFX-<name>.prg` | Exact exported player + tune with the `-Dx` SFX feature enabled |
| `GT277-<name>.sng` | The exact source tune used for each export |
| `GT277-<name>.txt` | Export command, selected features, subtune/effect names, player/data load addresses |
| `version-evidence\` | Screenshot of the GoatTracker 2.77 about/version window |

Also record the exact archive name and SHA-256, every member hash used, the selected
export options, player entry addresses, writable/self-modifying/ZP/stack/RAM/MMIO
ranges, video/SID topology, cadence, IRQ/CIA ownership and every code/data cost.
The adapter cannot be qualified from a filename, a header alone or a different
GoatTracker release. Missing fields remain `Unknown`; they are not guessed.

## Part H — Owner and completion

For every family, name the person who supplied and approved the evidence, the date,
and the exact completion state in `provenance.txt`. The RD-06 gate is complete only
when the manifest entry, hashes, retention approval and expected selector outputs
all exist. The project owner supplies the producer/player evidence; the compiler
implementation owner creates the manifest, independent expected values and negative
derivations.

## Part F — Transfer back

1. Zip the `rd06-evidence` folder.
2. Copy it to the Linux checkout or to `/tmp/opencode/rd06-evidence/`.
3. Tell the primary agent the exact path.

The Linux side will verify the SHA-256 values, producer versions, SPD v5/CTM v9
structure and exact end-of-file, then build the fixture manifest, independent
expected outputs, malformed/adjacent-version cases and the native tests.

## Minimum to start fixture intake

One `MIN` project per family, plus its version screenshot and retention approval,
is enough to start fixture intake and record the manifest entry. It is **not** enough
to start decoder planning or implementation. The full `ALL`, `WIDE`, optional or
display × color × tile matrix must be complete before that family's decoder planning
and implementation gate passes (RD-06 AR-51).

## Do not

- Do not hand-convert the files or create them with another tool.
- Do not use a comparative parser or a guessed schema.
- Do not run SpritePad, CharPad or GoatTracker from the Linux build or CI.
- Do not relabel a different producer version as 3.80.
- Do not edit the producer-saved bytes after saving.
