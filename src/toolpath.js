export const MODEL_HEIGHT_MM = 40;
export const WORLD_HEIGHT = 3.25;
export const BED_Y = 1.04;
export const STEPS = 128;

export function layerCount(height) {
  return Math.round(MODEL_HEIGHT_MM / height);
}

// One continuous perimeter per layer; the final point of a layer meets the next.
export function perimeterPoint(model, t, angle) {
  let x, z;
  if (model === "cube") {
    const a = ((((angle / (Math.PI * 2)) % 1) + 1) % 1) * 4;
    const side = Math.floor(a),
      f = a - side;
    const r = WORLD_HEIGHT / 2;
    [x, z] = [
      [-r + 2 * r * f, -r],
      [r, -r + 2 * r * f],
      [r - 2 * r * f, r],
      [-r, r - 2 * r * f],
    ][side];
  } else if (model === "twist") {
    const radius = 0.86 + 0.11 * Math.cos(4 * angle);
    const a = angle + t * Math.PI * 0.85;
    x = Math.cos(a) * radius;
    z = Math.sin(a) * radius;
  } else {
    const belly =
      0.72 + 0.34 * Math.sin(t * Math.PI * 1.65) + 0.2 * Math.pow(t, 8);
    const r = belly + 0.065 * Math.sin(angle * 12 - t * 10);
    x = Math.cos(angle) * r;
    z = Math.sin(angle) * r;
  }
  return [x, BED_Y + t * WORLD_HEIGHT + 0.014, z];
}

export function createToolpath(model, layers) {
  const points = [];
  for (let i = 0; i <= layers * STEPS; i++) {
    points.push(
      perimeterPoint(model, i / (layers * STEPS), (i / STEPS) * Math.PI * 2),
    );
  }
  return points;
}

export function advanceProgress(progress, delta, printSpeed, simulationSpeed) {
  // Educational time compression: a full print takes four minutes at 1x / 60 mm/s.
  return Math.min(
    1,
    progress + (Math.max(0, delta) / 240) * (printSpeed / 60) * simulationSpeed,
  );
}
