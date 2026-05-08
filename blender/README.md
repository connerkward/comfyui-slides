# Chase Scene — Blender → Img2Vid Conditioning

Color-coded police-chase scene built in Blender for use as structural / control input to a video diffusion model. Vehicles ride distinct flat hues so the AI can track identity frame-to-frame; lamp posts give motion parallax; bright headlight/taillight bars indicate facing direction.

## Files

- `chase_scene.blend` — the scene (Blender 5.1, Eevee).
- `renders/chase_first.png` — first-frame still (1280×720).
- `renders/chase_last.png`  — last-frame still.
- The encoded `chase_animation.mp4` is rendered to `~/Desktop/chase_render/`.

## Scene layout

Forward direction is **−Y**. Lead car at world origin; pursuit cars trail behind; helicopters fly overhead-and-behind, off-axis to either side.

| Object | Color | Position (x, y, z) | Role |
|---|---|---|---|
| `PoliceCar_A` | 🔵 BLUE  | (0, 0, ground) | lead — fugitive |
| `PoliceCar_B` | 🔴 RED   | (−10, 22, ground) | pursuit, left |
| `PoliceCar_C` | 🟢 GREEN | (10, 32, ground) | pursuit, right |
| `Helicopter_A` | 🟡 YELLOW | (−7, 18, 32) | air unit, over-left |
| `Helicopter_B` | 🟣 PURPLE | (6, 34, 38) | air unit, over-right, higher |

## Direction indicators (front vs back)

- **Cars** — bright **white** emissive bar across the front grill, dim **red** bar across the rear.
- **Helicopters** — emissive **cyan** nose tip + emissive cyan cockpit (`vidrio` mesh); red strobe at tail.
- All indicators are parented to their vehicle empty with `matrix_parent_inverse.identity()` so they lock to the empty's transform — re-positioning the empty does not desync the children. (An earlier bug used a stale parent-inverse and the bars drifted off-vehicle.)

## Helicopter attitude

Helis are pitched **−10°** (nose down) and banked **±5°** (opposite roll for each) so they read as actually flying forward, not just translating. Held static (no wobble) — at 100 km/h cruise, real helicopters hold attitude.

Combined with the per-vehicle color, the diffusion model has an unambiguous mapping from pixel value → object identity → facing direction.

## Motion reference

84 lamp posts spaced every 18 units along Y from y=−280 to y=+80, both sides at x=±14, with bright yellow emissive heads. They're stationary in world space, so they whip past the camera and the chase at the chase's full ground speed — instant visual cue that the world is moving fast.

## Animation

- Frame range **1–120** at **30 fps** (4-second clip).
- **Scale**: car ≈ 5 m long modelled at ≈ 10 units → **1 unit ≈ 0.5 m**.
- **Chase speed**: −240 units in Y over the clip = **60 u/s ≈ 30 m/s ≈ 108 km/h** — real highway-pursuit pace. LINEAR interpolation, constant velocity (real chase footage shows cars driving straight, not weaving).
- **Helicopter attitude**: held static at pitch −10° (nose-down forward flight), bank ±5° (opposite roll between A and B). No wobble — at cruise speed real helicopters hold attitude.
- **Rotors**: main rotor 27 revolutions per clip ≈ **405 rpm**; tail rotor 120 revolutions per clip ≈ **1800 rpm** — actual operational speeds.
- **Camera**: 2 LINEAR keyframes from `(0, 90, 55)` → `(0, 90 − 0.85·240, 55) = (0, −114, 55)`. Camera tracks at 85 % of chase speed, so chase pulls ~36 units ahead through the clip and the world (lamp posts, road) streams past the camera at high speed. Track-To on the lead car keeps the framing locked. Lens 35 mm, clip_end 50000.

## World / lighting

- **Sky**: Blender `MULTIPLE_SCATTERING` atmospheric sky (the renamed Nishita), sun elevation 30°, aerosol density 2.5 → soft horizon haze, no hard horizon edge.
- **Sun**: real Sun light aligned with the sky's sun direction → vehicles cast real shadows on the road.
- **Road**: Principled BSDF, dark asphalt; painted yellow center lines + white edge lines.
- **Camera clip range**: clip_start 0.1, clip_end 50000 (default 100 was clipping the road into a fake horizon; this is the original "fucked up sky" fix).

## Suggested video-gen prompt

> *"A blue sedan being pursued by a red car on the left and a green car on the right, with a yellow helicopter and a purple helicopter overhead, racing forward down a dark asphalt highway lined with glowing yellow lamp posts on both sides. White headlights at the front and red taillights at the back of each car. Drone shot from behind, hazy daytime sky, real-time motion."*

The color labels (`blue`, `red`, `green`, `yellow`, `purple`) map 1-to-1 to scene objects so the model can track each one through the clip.

## Re-rendering

In Blender, with `chase_scene.blend` open:
1. **Stills**: `Render → Render Image` (F12) at frame 1 and 120.
2. **Animation as PNG sequence**: set output path to `~/Desktop/chase_render/frames/frame_`, then `Render → Render Animation` (Ctrl+F12).
3. **Encode MP4** (Blender 5.x dropped the FFmpeg in-render path):
   ```bash
   ffmpeg -y -framerate 30 \
     -i ~/Desktop/chase_render/frames/frame_%04d.png \
     -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
     ~/Desktop/chase_render/chase_animation.mp4
   ```

## Setup notes — Blender MCP (used to drive this scene from Claude Code)

- Repo: `https://projects.blender.org/lab/blender_mcp.git` (official Blender Lab MCP).
- Install the server for Claude Code:
  ```bash
  brew install uv
  claude mcp add --scope user blender -- \
    uvx --from "git+https://projects.blender.org/lab/blender_mcp.git#subdirectory=mcp" blender-mcp
  ```
- Install the add-on in Blender via the Blender Lab extensions repository at `https://lab.blender.org/`, enable it, and confirm the TCP socket is up on `127.0.0.1:9876`.
- Restart the Claude Code session after enabling the add-on so the `mcp__blender__*` tool schemas load.

## Source models

Both GLBs are imported from a sibling repo (not vendored here):

- `~/dev/v2v-slides/public/helicopter.glb`
- `~/dev/v2v-slides/public/police-car.glb`

If you re-build the scene from scratch, those paths are hardcoded in the import step.

## Gotchas worth remembering

- **Indicator parenting**: always set `child.matrix_parent_inverse.identity()` immediately after `child.parent = empty`, then assign `child.location = local_offset`. If you instead use the standard `inv(empty.matrix_world)` pattern, the parent-inverse encodes the empty's transform *at parent-time*; later repositioning of the empty leaves the children at a stale relative offset and they visibly detach from the body.
- **Camera clip range**: Blender's default `clip_end` is 100 (and someone — possibly the official Blender add-on default — sets it on import). Long ground planes get sliced into a fake horizon line at the clip distance. Bump to `50000` whenever working with a long road.
- **Sky type rename in Blender 5.x**: `NISHITA` was renamed to `MULTIPLE_SCATTERING`; `dust_density` → `aerosol_density`. Old code copied from 4.x docs will throw.
- **No FFmpeg in `image_settings.file_format` in Blender 5.x**: render PNG sequence and stitch with system `ffmpeg` (snippet above). The `Render Animation` button used to write MP4 directly; no longer.

## Build history

This scene was built iteratively via the Blender MCP. Notable inflection points if you `git log blender/`:

1. Initial import of GLBs and naive grouping (children offset from empties because `matrix_world` was read before the depsgraph updated).
2. Rebuilt grouping with `view_layer.update()` between location-set and matrix read.
3. Multiple iterations on color coding (5 distinct hues → grouped (3-color) → back to 5 distinct).
4. Camera move iterated from a 5-key arc → side pan → pure-Y straight line drone follow.
5. World shader iterated from flat emission → vertical gradient → distance-faded ground → finally `MULTIPLE_SCATTERING` atmospheric sky with proper sun.
6. Indicator drift bug found and fixed by switching to `matrix_parent_inverse.identity()`.
7. **Final**: full nuke and rebuild at realistic 108 km/h chase speed with proper rotor RPMs and static heli attitude.
