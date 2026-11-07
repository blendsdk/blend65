# RD-06 Producer Evidence Handoff — SpritePad 3.80 / CharPad 3.88

> **Purpose**: take this file to the Windows machine that has SpritePad C64 Pro 3.80
> and CharPad C64 Pro 3.88. It lists exactly what to save, export, record and
> transfer back. The Linux build and CI never run these applications; they only
> consume the committed producer-saved bytes.
>
> **Authority**: RD-06 R6.1, R6.12 and R6.19 in
> `codeops/features/blend65-v4/requirements/RD-06-native-assets-compile-time-composition-and-resident-layout.md`.
> Do not substitute handmade, converted, re-saved or guessed files.

## What you need on Windows

- SpritePad C64 Pro **3.80** (exactly this version).
- CharPad C64 Pro **3.88** (exactly this version).
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

## Part B — CharPad C64 Pro 3.88 / CTM v9

Create or open the project, then save the following **producer-saved** files as
CTM v9. Use the exact names below; keep the producer's file extension (normally
`.ctm`). Do not edit the files after saving.

| File name | What it must contain |
|---|---|
| `CTM388-MIN-V9.ctm` | Smallest representative real project |
| `CTM388-ALL-V9.ctm` | Complete project with every component and selector surface you use |
| `CTM388-WIDE-V9.ctm` | Boundary/wide project: maximum practical dimensions, counts, indices or payloads |
| `CTM388-<display>-<color>-<tile-mode>-V9.ctm` | One project for every meaningful display × color × tile-mode combination |

For the combination files, use short names that state the three settings, for
example:

- `CTM388-multicolor-color-tile-V9.ctm`
- `CTM388-hires-mono-notile-V9.ctm`

The `provenance.txt` must list the exact display, color and tile-mode setting for
every combination file.

For each project also export the selected map/tile/charset components to an
`exports\` subfolder. Capture a screenshot of the CharPad Help/About window
showing **3.88** and put it in `version-evidence\`.

## Part C — Settings and provenance

Create one `provenance.txt` in each family folder. It must state, for every file:

- producer name and exact version (SpritePad 3.80 or CharPad 3.88);
- who saved the file and when;
- the machine/Windows version used;
- the project settings that affect the bytes (for SpritePad: sprite count,
  multicolor, overlay, tiles, attributes, tags, animation; for CharPad: display
  mode, color mode, tile mode, map dimensions, tile settings, export options);
- the exact save/export operation performed;
- whether the file is the original producer save (it must be).

## Part D — Retention approval

Add this statement to each `provenance.txt`, edited to match your situation:

> I approve retaining these SpritePad 3.80 / CharPad 3.88 producer-saved project
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
  charpad-3.88\
    CTM388-MIN-V9.ctm
    CTM388-ALL-V9.ctm
    CTM388-WIDE-V9.ctm
    CTM388-<display>-<color>-<tile-mode>-V9.ctm
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

## Part F — Transfer back

1. Zip the `rd06-evidence` folder.
2. Copy it to the Linux checkout or to `/tmp/opencode/rd06-evidence/`.
3. Tell the primary agent the exact path.

The Linux side will verify the SHA-256 values, producer versions, SPD v5/CTM v9
structure and exact end-of-file, then build the fixture manifest, independent
expected outputs, malformed/adjacent-version cases and the native tests.

## Minimum to start planning

One `MIN` project per family, plus its version screenshot and retention approval,
is enough to start the RD-06 fixture gate. The full `ALL`, `WIDE`, optional or
display × color × tile matrix must be complete before that family's decoder
implementation gate passes.

## Do not

- Do not hand-convert the files or create them with another tool.
- Do not use a comparative parser or a guessed schema.
- Do not run SpritePad or CharPad from the Linux build or CI.
- Do not relabel a different producer version as 3.80 or 3.88.
- Do not edit the producer-saved bytes after saving.
