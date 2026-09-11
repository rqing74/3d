import { BED_Y } from "./toolpath.js";

const WORLD_PER_MM = 3.25 / 40;
const EPSILON = 1e-5;
const MAX_POINTS = 180000;

// Intersect actual triangles with a horizontal plane, then join their segments.
// Quantized endpoints weld the independent vertices typically found in STL files.
export function sliceContours(positions, y) {
  const nodes = new Map(),
    edges = [],
    seen = new Set();
  const key = (p) =>
    `${Math.round(p[0] / EPSILON)},${Math.round(p[2] / EPSILON)}`;
  for (let i = 0; i < positions.length; i += 9) {
    const hits = [];
    for (let edge = 0; edge < 3; edge++) {
      const a = i + edge * 3,
        b = i + ((edge + 1) % 3) * 3;
      const ay = positions[a + 1],
        by = positions[b + 1];
      if (!((ay <= y && by > y) || (by <= y && ay > y))) continue;
      const t = (y - ay) / (by - ay);
      hits.push([
        positions[a] + t * (positions[b] - positions[a]),
        y,
        positions[a + 2] + t * (positions[b + 2] - positions[a + 2]),
      ]);
    }
    if (hits.length !== 2) continue;
    const [a, b] = hits.map(key);
    if (a === b) continue;
    const edgeKey = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(edgeKey)) continue;
    seen.add(edgeKey);
    for (let j = 0; j < 2; j++) {
      const id = j ? b : a;
      if (!nodes.has(id)) nodes.set(id, { point: hits[j], edges: [] });
      nodes.get(id).edges.push(edges.length);
    }
    edges.push([a, b]);
  }
  if ([...nodes.values()].some((node) => node.edges.length !== 2)) {
    throw new Error(
      "Open or branching contours found. Repair the mesh to be watertight, then import it again.",
    );
  }
  const visited = new Set(),
    contours = [];
  for (let i = 0; i < edges.length; i++) {
    if (visited.has(i)) continue;
    const start = edges[i][0];
    const contour = [nodes.get(start).point];
    let current = start,
      edge = i;
    do {
      visited.add(edge);
      const [a, b] = edges[edge];
      current = a === current ? b : a;
      contour.push(nodes.get(current).point);
      if (current === start) break;
      edge = nodes.get(current).edges.find((n) => !visited.has(n));
      if (edge === undefined)
        throw new Error(
          "A contour could not be closed. Repair the model and retry.",
        );
    } while (contour.length <= edges.length + 1);
    if (contour.length >= 4) contours.push(contour);
  }
  return contours;
}

export function generatePrintPlan(
  positions,
  layerHeightMM,
  onProgress = () => {},
) {
  if (![0.12, 0.2, 0.28].includes(layerHeightMM))
    throw new Error("Unsupported layer height.");
  let top = BED_Y;
  for (let i = 1; i < positions.length; i += 3)
    top = Math.max(top, positions[i]);
  const step = layerHeightMM * WORLD_PER_MM;
  const layerCount = Math.ceil((top - BED_Y - 1e-6) / step);
  if (!layerCount || layerCount > 400)
    throw new Error("Model height is outside the simulation limits.");
  const points = [],
    extruding = [],
    times = [],
    layerEnds = [];
  let previous = null,
    seconds = 0,
    extrusionMM = 0,
    travelMM = 0,
    contourCount = 0,
    emptyLayers = 0;
  function moveTo(p, deposit) {
    if (!previous) {
      points.push(...p);
      extruding.push(0);
      times.push(0);
      previous = p;
      return;
    }
    const start = previous;
    const distance = Math.hypot(...p.map((n, a) => n - start[a]));
    const count = Math.max(1, Math.ceil(distance / 0.065));
    if (times.length + count > MAX_POINTS)
      throw new Error(
        "This model creates too many print moves. Simplify the mesh or use a thicker layer.",
      );
    const mm = distance / WORLD_PER_MM;
    if (deposit) extrusionMM += mm;
    else travelMM += mm;
    for (let j = 1; j <= count; j++) {
      points.push(...p.map((n, a) => start[a] + ((n - start[a]) * j) / count));
      extruding.push(deposit ? 1 : 0);
      seconds += mm / (deposit ? 60 : 180) / count;
      times.push(seconds);
    }
    previous = p;
  }
  for (let layer = 0; layer < layerCount; layer++) {
    const y = Math.min(BED_Y + (layer + 0.5) * step, top - step * 0.001);
    let contours;
    try {
      contours = sliceContours(positions, y);
    } catch (error) {
      throw new Error(`Layer ${layer + 1}: ${error.message}`);
    }
    if (!contours.length) emptyLayers++;
    contourCount += contours.length;
    for (const contour of contours) {
      // Lift before traversing an island or hole. These moves never extrude.
      const first = contour[0],
        safeY = y + 0.045;
      if (previous) moveTo([previous[0], safeY, previous[2]], false);
      moveTo([first[0], safeY, first[2]], false);
      moveTo(first, false);
      for (let i = 1; i < contour.length; i++) moveTo(contour[i], true);
    }
    layerEnds.push(seconds);
    onProgress((layer + 1) / layerCount);
  }
  if (!extrusionMM || points.length < 6)
    throw new Error("No printable contours were found in this model.");
  return {
    points: new Float32Array(points),
    extruding: new Uint8Array(extruding),
    times: new Float32Array(times),
    layerEnds,
    layerCount,
    contourCount,
    referenceSeconds: seconds,
    extrusionMM,
    travelMM,
    layerHeightMM,
    emptyLayers,
  };
}

export function locateMove(times, progress) {
  const target = Math.max(0, Math.min(1, progress)) * times[times.length - 1];
  let low = 0,
    high = times.length - 1;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (times[mid] <= target) low = mid;
    else high = mid - 1;
  }
  const next = Math.min(low + 1, times.length - 1);
  const span = times[next] - times[low];
  return { index: low, alpha: span > 0 ? (target - times[low]) / span : 0 };
}

export function currentPlanLayer(plan, progress) {
  if (progress <= 0) return 0;
  const seconds = progress * plan.referenceSeconds;
  const index = plan.layerEnds.findIndex((end) => end >= seconds);
  return index < 0 ? plan.layerCount : index + 1;
}
