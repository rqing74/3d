import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { BED_Y, WORLD_HEIGHT, createToolpath } from "./toolpath.js";
import { locateMove } from "./slicer.js";

export function createPrinter(container, onError) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#202427");
  scene.fog = new THREE.Fog("#202427", 22, 50);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch {
    onError(
      "WebGL is unavailable. Please enable hardware acceleration and reload.",
    );
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute(
    "aria-label",
    "Interactive 3D printer. Drag to orbit, scroll to zoom, shift-drag to pan.",
  );
  renderer.domElement.addEventListener("webglcontextlost", onContextLost);
  function onContextLost(event) {
    event.preventDefault();
    onError("The 3D view was interrupted. Reload to reconnect WebGL.");
  }
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.05);
  scene.environment = environment.texture;
  room.dispose();
  pmrem.dispose();
  scene.environmentIntensity = 0.5;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 8;
  controls.maxDistance = 25;
  controls.maxPolarAngle = Math.PI / 2 + 0.02;
  controls.target.set(0, 3.15, 0);
  const mats = {
    frame: new THREE.MeshStandardMaterial({
      color: "#33373a",
      metalness: 0.82,
      roughness: 0.31,
    }),
    edge: new THREE.MeshStandardMaterial({
      color: "#777e83",
      metalness: 0.85,
      roughness: 0.25,
    }),
    black: new THREE.MeshStandardMaterial({
      color: "#111517",
      metalness: 0.45,
      roughness: 0.48,
    }),
    silver: new THREE.MeshStandardMaterial({
      color: "#cad3db",
      metalness: 0.96,
      roughness: 0.19,
    }),
    bed: new THREE.MeshStandardMaterial({
      color: "#242b30",
      metalness: 0.55,
      roughness: 0.56,
    }),
    orange: new THREE.MeshStandardMaterial({
      color: "#fa672e",
      metalness: 0.3,
      roughness: 0.36,
    }),
    filament: new THREE.MeshStandardMaterial({
      color: "#ff7847",
      metalness: 0.05,
      roughness: 0.48,
    }),
    brass: new THREE.MeshStandardMaterial({
      color: "#d7a866",
      metalness: 0.8,
      roughness: 0.28,
    }),
    led: new THREE.MeshStandardMaterial({
      color: "#dff7ff",
      emissive: "#dff7ff",
      emissiveIntensity: 3,
    }),
  };
  const machine = new THREE.Group();
  scene.add(machine);
  machine.scale.x = 1.08;
  function mesh(geometry, material, position, parent = machine) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(...position);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function box(
    w,
    h,
    d,
    x,
    y,
    z,
    mat = mats.frame,
    parent = machine,
    r = 0.025,
  ) {
    return mesh(new RoundedBoxGeometry(w, h, d, 1, r), mat, [x, y, z], parent);
  }
  function rod(
    radius,
    length,
    x,
    y,
    z,
    mat = mats.silver,
    axis = "y",
    parent = machine,
  ) {
    const m = mesh(
      new THREE.CylinderGeometry(radius, radius, length, 16),
      mat,
      [x, y, z],
      parent,
    );
    if (axis === "x") m.rotation.z = Math.PI / 2;
    if (axis === "z") m.rotation.x = Math.PI / 2;
    return m;
  }
  function bolt(x, y, z, parent = machine) {
    rod(0.052, 0.026, x, y, z, mats.silver, "z", parent);
    rod(0.021, 0.03, x, y, z + 0.015, mats.black, "z", parent);
  }
  function extrusion(length, x, y, z, axis = "y", parent = machine) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    box(0.29, length, 0.29, 0, 0, 0, mats.frame, g, 0.014);
    for (const n of [-1, 1]) {
      box(0.055, length - 0.04, 0.01, 0, 0, n * 0.149, mats.black, g, 0.001);
      box(0.01, length - 0.04, 0.055, n * 0.149, 0, 0, mats.black, g, 0.001);
      for (const v of [-1, 1])
        box(0.016, length, 0.018, v * 0.118, 0, n * 0.145, mats.edge, g, 0.002);
    }
    if (axis === "x") g.rotation.z = Math.PI / 2;
    if (axis === "z") g.rotation.x = Math.PI / 2;
    return g;
  }
  // Open aluminum chassis: grooves, corner plates, visible fasteners and feet.
  for (const x of [-2.85, 2.85])
    for (const z of [-2.2, 2.2]) {
      extrusion(5.2, x, 3.05, z);
      rod(0.26, 0.14, x, 0.13, z, mats.silver);
      rod(0.23, 0.12, x, 0.24, z, mats.black);
      box(0.48, 0.7, 0.12, x, 0.68, z + 0.18, mats.black);
      box(0.48, 0.46, 0.12, x, 5.46, z + 0.18, mats.black);
      for (const y of [0.46, 0.86, 5.32, 5.6]) bolt(x, y, z + 0.26);
    }
  for (const y of [0.43, 5.62]) {
    for (const z of [-2.2, 2.2]) extrusion(5.7, 0, y, z, "x");
    for (const x of [-2.85, 2.85]) extrusion(4.4, x, y, 0, "z");
  }
  for (const x of [-2.53, 2.53]) {
    rod(0.055, 4.75, x, 3.05, -1.98);
    const pts = [];
    for (let i = 0; i <= 1900; i++) {
      const t = i / 1900;
      pts.push(
        new THREE.Vector3(
          x + Math.cos(t * Math.PI * 190) * 0.071,
          0.68 + t * 4.7,
          -1.98 + Math.sin(t * Math.PI * 190) * 0.071,
        ),
      );
    }
    mesh(
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(pts),
        1900,
        0.014,
        4,
        false,
      ),
      mats.silver,
      [0, 0, 0],
    );
    box(0.46, 0.5, 0.47, x, 0.74, -1.98, mats.black);
    rod(0.12, 0.21, x, 1.05, -1.98, mats.silver);
    rod(0.065, 4.7, x, 3.05, 1.97);
  }
  // Bed carriage, leveling springs, metal substrate and engraved 10 mm grid.
  for (const x of [-1.8, 1.8]) {
    extrusion(4.5, x, 0.56, 0, "z");
    rod(0.075, 4.4, x, 0.76, 0, mats.silver, "z");
    for (const z of [-1.7, 1.7]) {
      rod(0.15, 0.2, x, 0.86, z, mats.brass);
      for (let i = 0; i < 5; i++)
        rod(0.16, 0.018, x, 0.77 + i * 0.042, z, mats.silver);
      rod(0.21, 0.075, x, 0.7, z, mats.black);
    }
  }
  box(4.95, 0.09, 4.28, 0, 0.96, 0, mats.silver);
  box(4.87, 0.04, 4.2, 0, 1.025, 0, mats.bed, machine, 0.04);
  const gridVerts = [];
  for (let i = -10; i <= 10; i++) {
    const n = i * 0.2;
    gridVerts.push(-2.4, BED_Y + 0.009, n, 2.4, BED_Y + 0.009, n);
  }
  for (let i = -12; i <= 12; i++) {
    const n = i * 0.2;
    gridVerts.push(n, BED_Y + 0.009, -2.05, n, BED_Y + 0.009, 2.05);
  }
  const gridGeo = new THREE.BufferGeometry();
  gridGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(gridVerts, 3),
  );
  machine.add(
    new THREE.LineSegments(
      gridGeo,
      new THREE.LineBasicMaterial({
        color: "#91a0a9",
        transparent: true,
        opacity: 0.36,
      }),
    ),
  );
  for (const x of [-2.25, 2.25])
    for (const z of [-1.9, 1.9]) {
      rod(0.1, 0.012, x, 1.061, z, mats.silver);
      rod(0.04, 0.014, x, 1.07, z, mats.black);
    }
  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = 1024;
  labelCanvas.height = 128;
  const ctx = labelCanvas.getContext("2d");
  ctx.fillStyle = "#a9b5bb";
  ctx.font = "500 56px monospace";
  ctx.fillText("F O R M A   /   PRINT LAB", 32, 86);
  const labelTexture = new THREE.CanvasTexture(labelCanvas);
  const label = mesh(
    new THREE.PlaneGeometry(2.1, 0.26),
    new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true }),
    [0, 0.45, 2.36],
  );
  label.castShadow = false;
  // Moving Z gantry; both Y carriages follow the deposition point.
  const stage = new THREE.Group();
  machine.add(stage);
  for (const x of [-2.62, 2.62]) {
    rod(0.052, 4.16, x, 0.14, 0, mats.silver, "z", stage);
    box(0.085, 0.11, 4.1, x, -0.05, 0, mats.frame, stage);
    for (const z of [-1.98, 1.98]) {
      box(0.34, 0.43, 0.28, x, 0.14, z, mats.black, stage);
      bolt(x, 0.14, z + 0.16, stage);
    }
  }
  const gantry = new THREE.Group();
  machine.add(gantry);
  for (const x of [-2.62, 2.62]) {
    box(0.37, 0.9, 0.42, x, 0.16, 0, mats.black, gantry);
    box(0.46, 0.58, 0.08, x, 0.16, 0.24, mats.edge, gantry);
    for (const y of [-0.04, 0.36]) bolt(x, y, 0.3, gantry);
  }
  for (const y of [0.0, 0.43])
    rod(0.055, 5.3, 0, y, 0, mats.silver, "x", gantry);
  box(5.2, 0.07, 0.07, 0, 0.65, -0.09, mats.black, gantry);
  // Belts along the depth of the chassis.
  for (const x of [-2.61, 2.61]) box(0.045, 0.055, 4.1, x, 5.43, 0, mats.black);
  const head = new THREE.Group();
  gantry.add(head);
  box(0.7, 0.87, 0.56, 0, 0.23, 0.24, mats.orange, head, 0.055);
  box(0.6, 0.39, 0.11, 0, -0.04, 0.57, mats.black, head);
  rod(0.17, 0.1, 0, -0.04, 0.65, mats.frame, "z", head);
  rod(0.066, 0.11, 0, -0.04, 0.7, mats.silver, "z", head);
  const fan = new THREE.Group();
  fan.position.set(0, -0.04, 0.715);
  head.add(fan);
  for (let i = 0; i < 7; i++) {
    const blade = box(0.08, 0.145, 0.016, 0, 0.09, 0, mats.edge, fan, 0.012);
    blade.rotation.z = (i * Math.PI * 2) / 7;
    blade.position.set(
      Math.sin((i * Math.PI * 2) / 7) * 0.09,
      Math.cos((i * Math.PI * 2) / 7) * 0.09,
      0,
    );
  }
  for (const x of [-0.24, 0.24])
    for (const y of [-0.15, 0.08]) bolt(x, y, 0.64, head);
  box(0.25, 0.17, 0.24, 0, -0.34, 0.24, mats.silver, head);
  const nozzle = mesh(
    new THREE.CylinderGeometry(0.08, 0.013, 0.16, 12),
    mats.brass,
    [0, -0.49, 0.24],
    head,
  );
  box(0.36, 0.034, 0.034, 0, 0.58, 0.535, mats.led, head);
  for (const x of [-0.25, 0.25]) bolt(x, 0.49, 0.54, head);
  const hotLight = new THREE.PointLight("#ff854c", 0.4, 1.1);
  hotLight.position.set(0, -0.6, 0.24);
  head.add(hotLight);
  // Filament reel: axle, two flanges, spokes, and actual wound strands.
  const spool = new THREE.Group();
  spool.position.set(-0.95, 6.64, -0.65);
  machine.add(spool);
  box(0.19, 0.85, 0.8, -0.95, 6.01, -0.65, mats.black);
  rod(0.14, 1.35, 0, 0, 0, mats.silver, "x", spool);
  for (const x of [-0.43, 0.43]) {
    const ring = mesh(
      new THREE.TorusGeometry(0.94, 0.065, 8, 64),
      mats.black,
      [x, 0, 0],
      spool,
    );
    ring.rotation.y = Math.PI / 2;
    rod(0.27, 0.09, x, 0, 0, mats.black, "x", spool);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      const spoke = box(
        0.055,
        0.69,
        0.115,
        x,
        Math.cos(a) * 0.53,
        Math.sin(a) * 0.53,
        mats.black,
        spool,
      );
      spoke.rotation.x = a;
    }
  }
  rod(0.85, 0.74, 0, 0, 0, mats.filament, "x", spool);
  for (let i = 0; i < 43; i++) {
    const ring = mesh(
      new THREE.TorusGeometry(0.85, 0.01, 4, 64),
      mats.filament,
      [-0.36 + i * 0.017, 0, 0],
      spool,
    );
    ring.rotation.y = Math.PI / 2;
  }
  let feedMesh,
    cableMesh,
    printMesh,
    points = [],
    layers = 200,
    lastColor;
  let previewMesh,
    activePlan = null,
    importedPreview = false,
    indexCounts = [];
  const previewMaterial = new THREE.MeshStandardMaterial({
    color: "#94aeb9",
    roughness: 0.5,
    metalness: 0.2,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  function updateFeed(p) {
    const end = new THREE.Vector3(p.x, p.y + 1.17, p.z);
    const feedCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-0.85, 7.46, -0.65),
      new THREE.Vector3(0.3, 7.9, -0.35),
      new THREE.Vector3(end.x, 6.4, end.z),
      end,
    );
    const feedGeo = new THREE.TubeGeometry(feedCurve, 40, 0.017, 6, false);
    if (feedMesh) {
      feedMesh.geometry.dispose();
      feedMesh.geometry = feedGeo;
    } else feedMesh = mesh(feedGeo, mats.filament, [0, 0, 0]);
    const cableCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(2.6, 5.55, -1.9),
      new THREE.Vector3(2.6, 6.0, -1.9),
      new THREE.Vector3(end.x, 6.2, end.z - 0.28),
      new THREE.Vector3(end.x, end.y - 0.05, end.z - 0.28),
    );
    const cableGeo = new THREE.TubeGeometry(cableCurve, 40, 0.072, 8, false);
    if (cableMesh) {
      cableMesh.geometry.dispose();
      cableMesh.geometry = cableGeo;
    } else cableMesh = mesh(cableGeo, mats.black, [0, 0, 0]);
  }
  function rebuild(model, count, asset = null, plan = null) {
    lastFeedProgress = -1;
    lastFeed = 0;
    layers = count;
    activePlan = plan;
    importedPreview = Boolean(asset);
    if (asset) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(asset.positions, 3),
      );
      geometry.computeVertexNormals();
      if (previewMesh) {
        previewMesh.geometry.dispose();
        previewMesh.geometry = geometry;
      } else previewMesh = mesh(geometry, previewMaterial, [0, 0, 0]);
      previewMesh.castShadow = false;
      previewMaterial.opacity = plan ? 0.18 : 0.6;
    }
    if (previewMesh) previewMesh.visible = Boolean(asset);
    points = plan
      ? Array.from({ length: plan.times.length }, (_, i) =>
          Array.from(plan.points.subarray(i * 3, i * 3 + 3)),
        )
      : asset
        ? [
            [2.1, BED_Y + asset.dimensions[1] * WORLD_HEIGHT / 40 + 0.14, 1.6],
            [2.1, BED_Y + asset.dimensions[1] * WORLD_HEIGHT / 40 + 0.14, 1.6],
          ]
        : createToolpath(model, layers);
    const radius =
      (plan
        ? (plan.layerHeightMM * WORLD_HEIGHT) / 40
        : WORLD_HEIGHT / Math.max(1, layers)) * 0.53;
    const positions = new Float32Array(points.length * 6 * 3),
      normals = new Float32Array(positions.length);
    const indices = new Uint32Array((points.length - 1) * 36);
    indexCounts = new Uint32Array(points.length);
    let written = 0;
    for (let i = 0; i < points.length; i++) {
      const p = points[i],
        prev = points[Math.max(0, i - 1)],
        next = points[Math.min(points.length - 1, i + 1)];
      const dx = next[0] - prev[0],
        dz = next[2] - prev[2],
        len = Math.hypot(dx, dz) || 1;
      for (let j = 0; j < 6; j++) {
        const a = (j / 6) * Math.PI * 2,
          c = Math.cos(a),
          s = Math.sin(a),
          k = (i * 6 + j) * 3;
        normals.set([(dz / len) * c, s, (-dx / len) * c], k);
        positions.set(
          [
            p[0] + (dz / len) * c * radius,
            p[1] + s * radius,
            p[2] - (dx / len) * c * radius,
          ],
          k,
        );
        if (i < points.length - 1 && (!plan || plan.extruding[i + 1])) {
          const v = i * 6 + j,
            n = i * 6 + ((j + 1) % 6);
          indices.set([v, n, v + 6, n, n + 6, v + 6], written);
          written += 6;
        }
      }
      if (i < points.length - 1) indexCounts[i + 1] = written;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
    geo.setIndex(new THREE.BufferAttribute(indices.subarray(0, written), 1));
    geo.computeBoundingSphere();
    if (printMesh) {
      printMesh.geometry.dispose();
      printMesh.geometry = geo;
    } else printMesh = mesh(geo, mats.filament, [0, 0, 0]);
    printMesh.receiveShadow = false;
  }
  let lastFeed = 0,
    lastFeedProgress = -1;
  function update(progress, color, running, now = performance.now()) {
    if (color !== lastColor) {
      mats.filament.color.set(color).multiplyScalar(0.66);
      lastColor = color;
    }
    const move = activePlan
      ? locateMove(activePlan.times, progress)
      : { index: Math.floor(progress * (points.length - 1)), alpha: 0 };
    const index = Math.min(points.length - 1, move.index);
    const p = new THREE.Vector3(...points[Math.max(0, index)]);
    if (activePlan && move.alpha > 0)
      p.lerp(
        new THREE.Vector3(...points[Math.min(index + 1, points.length - 1)]),
        move.alpha,
      );
    printMesh.geometry.setDrawRange(
      0,
      importedPreview && !activePlan ? 0 : indexCounts[index],
    );
    if (previewMesh)
      previewMesh.visible = importedPreview && (!activePlan || progress === 0);
    gantry.position.set(0, p.y + 0.57, p.z - 0.24);
    head.position.x = p.x;
    stage.position.y = p.y + 0.57;
    if (progress !== lastFeedProgress && now - lastFeed > 80) {
      updateFeed(p);
      lastFeed = now;
      lastFeedProgress = progress;
    }
    if (running) {
      fan.rotation.z += 0.2;
      spool.rotation.x = -progress * 8;
    }
  }
  const key = new THREE.DirectionalLight("#f2f5ff", 3.2);
  key.position.set(-5, 11, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 10;
  key.shadow.camera.bottom = -7;
  key.shadow.normalBias = 0.025;
  key.shadow.bias = -0.0002;
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight("#d8e8ff", 2.6);
  rim.position.set(5, 7, -4);
  scene.add(rim);
  const fill = new THREE.DirectionalLight("#ffe2ca", 0.8);
  fill.position.set(0, 4, 8);
  scene.add(fill);
  scene.add(new THREE.HemisphereLight("#c5d9e7", "#202327", 1));
  const floor = mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.MeshStandardMaterial({
      color: "#111618",
      roughness: 0.92,
      metalness: 0.08,
    }),
    [0, 0.03, 0],
    scene,
  );
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;
  let activeView = "perspective";
  function view(name) {
    activeView = name;
    controls.reset();
    controls.target.set(0, 3.5, 0);
    if (name === "front") camera.position.set(0, 4.1, 17.8);
    else if (name === "top") {
      camera.position.set(0, 20, 0.01);
      controls.target.set(0, 1, 0);
    } else camera.position.set(6.95, 6.65, 14.3);
    const fit = Math.max(1, 1.12 / camera.aspect);
    camera.position
      .sub(controls.target)
      .multiplyScalar(fit)
      .add(controls.target);
    controls.update();
  }
  function resize() {
    const { width, height } = container.getBoundingClientRect();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    view(activeView);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();
  view("perspective");
  rebuild("vase", 200);
  update(0.42, "#ff7847", false);
  return {
    rebuild,
    update,
    view,
    render() {
      controls.update();
      renderer.render(scene, camera);
    },
    dispose() {
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener(
        "webglcontextlost",
        onContextLost,
      );
      const geometries = new Set(),
        materials = new Set();
      scene.traverse((o) => {
        if (o.geometry) geometries.add(o.geometry);
        if (o.material) materials.add(o.material);
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      previewMaterial.dispose();
      labelTexture.dispose();
      environment.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
