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

Helis are pitched **−8°** (nose down) and banked **±6°** (opposite roll for each) so they read as actually flying forward, not just translating in space. This is set on the empty, so the rotor spin animation on the children inherits the orientation.

Combined with the per-vehicle color, the diffusion model has an unambiguous mapping from pixel value → object identity → facing direction.

## Motion reference

48 lamp posts spaced every 24 units along Y, both sides at x=±14, with bright yellow emissive heads. They're stationary in world space, so they scroll past the camera and the chase, giving clear parallax cues.

## Animation

- Frame range **1–120** at **30 fps** (4-second clip).
- All five vehicles drive **−Y** at constant velocity (LINEAR), 55 units total over the clip.
- Helicopter rotors (`helice 1` main, `helice 2` tail) spin LINEAR over the clip.
- Camera animation: **2 keyframes, single-axis straight line**. Start `(0, 90, 55)` → end `(0, 60, 55)`. Drone moves slower than the chase (30 vs 55 units), so chase pulls visibly forward in frame and the road streams under the camera. Track-To constraint locked on the lead car keeps framing stable. Lens 35 mm.

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
