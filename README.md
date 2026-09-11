# FORMA — Print Lab

An interactive Three.js 3D printer simulator with exposed aluminum rails, lead screws, a gridded build plate, a moving hotend, and individually rendered filament layers.

## Run locally

Requires Node.js 22.12+ (verified with Node.js 24).

```sh
npm ci
npm run dev
```

Open the local URL shown in the terminal.

```sh
npm test
npm run build
npm run preview
```

## Controls

- Drag to orbit, scroll to zoom, Shift + drag or right-drag to pan.
- Use Perspective, Front, or Top to return to a fixed camera.
- Pause/resume the simulation or reset to an empty platform.
- Scrub the timeline to inspect any point in the build.
- Choose Spiral vase, Cube, or Twist; changing model or layer height resets the print.
- Change filament color, print speed, or simulation multiplier live.
- Reduced-motion preferences start the demo paused.

## Simulation scope

This is a visual, educational simulation with a basic contour slicer, not a production slicer or a hardware controller. Presets use continuous hollow perimeter extrusion. Imported meshes produce horizontal intersection contours; holes and separate islands remain separate, with non-extruding travel moves between them. No solid infill, support generation, mesh repair, or G-code export is implemented. Overhangs and floating parts are not physically validated.

Presets take approximately four minutes at 1× and 60 mm/s. Imported plans use path-length-based motion timing, compressed by 3× before the selected simulation multiplier. The motion estimate excludes heating, acceleration, retraction, cooling, and material extrusion dynamics. Temperature indicators show simulated target values.

## Import a model and generate a print flow

1. Select **Import model**, then choose a local **STL** (binary or ASCII) or **OBJ** mesh. Files stay in the browser; geometry is not uploaded. OBJ textures/material files are not loaded.
2. Check the preview, dimensions, and upright axis. STL defaults to Z up; OBJ defaults to Y up. Units are assumed to be millimeters. Models are centered, placed on the bed, and uniformly scaled down when needed to fit the simulation envelope (50 mm wide × 44 mm deep × 40 mm high).
3. Choose layer height, then select **Generate print flow**. A cancellable Web Worker computes actual triangle-plane intersections and closed contours.
4. Play, pause, reset, or scrub the generated flow using the existing transport. Changing layer height or upright axis invalidates the plan and requires regeneration.
5. **Download flow** saves a JSON file containing the model, scale, layer schedule, motion estimates, and ordered XYZ moves with explicit extrusion flags. Export coordinates use a bed-centered, Z-up millimeter system. This file is **not G-code**.

Import limits: 12 MB, 150,000 triangles, 400 layers, and 180,000 generated points. Flat/invalid meshes and open or branching slice contours return an error. Very thin details below the contour welding tolerance may need a simpler mesh. Use a dedicated slicer to prepare jobs for a physical printer.

The 3D scene is procedural geometry, not a static render. React manages the controls, while Three.js and OrbitControls render the mechanics and extrusion path. No backend or API key is required. Google Fonts is optional; system font fallbacks are provided.

## Implementation

- `src/printer.js`: scene, machine geometry, materials, lighting, camera and deposition mesh.
- `src/toolpath.js`: model perimeters and playback calculation.
- `src/modelImport.js`: STL/OBJ parsing, validation, orientation, and platform fitting.
- `src/slicer.js` / `src/slicer.worker.js`: contour slicing, travel moves, timing, and worker execution.
- `src/ImportPanel.jsx`: import, generation progress, and JSON flow export.
- `src/PrinterView.jsx`: WebGL lifecycle and camera controls.
- `src/Settings.jsx`: print settings.
- `src/App.jsx`: print state, transport controls and instructions.

Built with React, Vite, and Three.js. Reference: [Three.js documentation](https://threejs.org/docs/).
