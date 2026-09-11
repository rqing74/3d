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

This is a visual, educational simulation, not a slicer or a hardware controller. All three models use continuous hollow perimeter extrusion; no solid infill or G-code export is implemented. A full print takes approximately four minutes at 1× and 60 mm/s. Temperature indicators show simulated target values.

The 3D scene is procedural geometry, not a static render. React manages the controls, while Three.js and OrbitControls render the mechanics and extrusion path. No backend or API key is required. Google Fonts is optional; system font fallbacks are provided.

## Implementation

- `src/printer.js`: scene, machine geometry, materials, lighting, camera and deposition mesh.
- `src/toolpath.js`: model perimeters and playback calculation.
- `src/PrinterView.jsx`: WebGL lifecycle and camera controls.
- `src/Settings.jsx`: print settings.
- `src/App.jsx`: print state, transport controls and instructions.

Built with React, Vite, and Three.js. Reference: [Three.js documentation](https://threejs.org/docs/).
