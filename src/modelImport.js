import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { BED_Y, WORLD_HEIGHT, MODEL_HEIGHT_MM } from "./toolpath.js";

export const MAX_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_TRIANGLES = 150000;
export const WORLD_PER_MM = WORLD_HEIGHT / MODEL_HEIGHT_MM;

export function parseModel(name, buffer) {
  if (!buffer.byteLength || buffer.byteLength > MAX_FILE_BYTES) {
    throw new Error("Choose a non-empty model smaller than 12 MB.");
  }
  const extension = name.split(".").pop().toLowerCase();
  let positions;
  if (extension === "stl") {
    let geometry;
    try {
      geometry = new STLLoader().parse(buffer);
    } catch {
      throw new Error(
        "This STL file could not be read. Re-export a valid binary or ASCII STL and try again.",
      );
    }
    positions = geometry.getAttribute("position")?.array.slice();
    geometry.dispose();
  } else if (extension === "obj") {
    const object = new OBJLoader().parse(new TextDecoder().decode(buffer));
    const parts = [];
    let length = 0;
    object.updateMatrixWorld(true);
    try {
      object.traverse((child) => {
        if (!child.isMesh) return;
        const geometry = child.geometry.index
          ? child.geometry.toNonIndexed()
          : child.geometry.clone();
        geometry.applyMatrix4(child.matrixWorld);
        const values = geometry.getAttribute("position").array;
        parts.push(values.slice());
        length += values.length;
        geometry.dispose();
        if (length / 9 > MAX_TRIANGLES)
          throw new Error(
            "Model exceeds 150,000 triangles. Simplify it before importing.",
          );
      });
      positions = new Float32Array(length);
      let offset = 0;
      for (const part of parts) {
        positions.set(part, offset);
        offset += part.length;
      }
    } finally {
      object.traverse((child) => {
        child.geometry?.dispose();
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        materials.forEach((material) => material?.dispose());
      });
    }
  } else {
    throw new Error("Unsupported format. Choose an STL or OBJ file.");
  }
  if (
    !positions?.length ||
    positions.length % 9 ||
    positions.length / 9 > MAX_TRIANGLES
  ) {
    throw new Error("Model must contain 1–150,000 triangles.");
  }
  if (!positions.every(Number.isFinite))
    throw new Error("Model contains invalid vertex coordinates.");
  return {
    name,
    positions,
    triangles: positions.length / 9,
    upAxis: extension === "stl" ? "z" : "y",
  };
}

export function fitModel(asset, upAxis) {
  const positions = new Float32Array(asset.positions.length);
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < positions.length; i += 3) {
    const p =
      upAxis === "z"
        ? [asset.positions[i], asset.positions[i + 2], -asset.positions[i + 1]]
        : [asset.positions[i], asset.positions[i + 1], asset.positions[i + 2]];
    for (let a = 0; a < 3; a++) {
      positions[i + a] = p[a];
      min[a] = Math.min(min[a], p[a]);
      max[a] = Math.max(max[a], p[a]);
    }
  }
  const dimensions = max.map((n, i) => n - min[i]);
  if (dimensions.some((n) => !Number.isFinite(n) || n < 0.00001))
    throw new Error("The model is flat or has no printable volume.");
  const scale = Math.min(
    1,
    50 / dimensions[0],
    40 / dimensions[1],
    44 / dimensions[2],
  );
  if (dimensions[1] * scale < 0.12)
    throw new Error(
      "The model is too small. Export it in millimeters with at least 0.12 mm height.",
    );
  const center = [(min[0] + max[0]) / 2, min[1], (min[2] + max[2]) / 2];
  for (let i = 0; i < positions.length; i += 3) {
    for (let a = 0; a < 3; a++)
      positions[i + a] =
        (positions[i + a] - center[a]) * scale * WORLD_PER_MM +
        (a === 1 ? BED_Y : 0);
  }
  return {
    name: asset.name,
    positions,
    triangles: asset.triangles,
    scale,
    dimensions: dimensions.map((n) => n * scale),
    upAxis,
  };
}
