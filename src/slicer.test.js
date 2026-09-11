import test from "node:test";
import assert from "node:assert/strict";
import { BoxGeometry, Mesh, Shape, Path, ExtrudeGeometry, Group } from "three";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { OBJExporter } from "three/addons/exporters/OBJExporter.js";
import {
  parseModel,
  fitModel,
  MAX_FILE_BYTES,
  WORLD_PER_MM,
} from "./modelImport.js";
import {
  sliceContours,
  generatePrintPlan,
  locateMove,
  currentPlanLayer,
} from "./slicer.js";
import { BED_Y } from "./toolpath.js";

const buffer = (text) => new TextEncoder().encode(text).buffer;
function cube(size = 10) {
  const geometry = new BoxGeometry(size, size, size);
  return new Mesh(geometry);
}
function fitted(mesh, binary = false) {
  mesh.updateMatrixWorld(true);
  const exported = new STLExporter().parse(mesh, { binary });
  return fitModel(
    parseModel("sample.stl", binary ? exported.buffer : buffer(exported)),
    "z",
  );
}

test("ASCII and binary STL preserve dimensions and rest on the platform", () => {
  for (const binary of [false, true]) {
    const asset = fitted(cube(), binary);
    assert.deepEqual(asset.dimensions, [10, 10, 10]);
    assert.equal(asset.triangles, 12);
    let min = Infinity;
    for (let i = 1; i < asset.positions.length; i += 3)
      min = Math.min(min, asset.positions[i]);
    assert.ok(Math.abs(min - BED_Y) < 1e-6);
  }
});
test("OBJ parsing keeps multiple meshes and orientation can change", () => {
  const group = new Group();
  group.add(cube(8));
  const other = cube(4);
  other.position.x = 20;
  group.add(other);
  group.updateMatrixWorld(true);
  const asset = parseModel("parts.obj", buffer(new OBJExporter().parse(group)));
  assert.equal(asset.triangles, 24);
  assert.equal(asset.upAxis, "y");
  assert.equal(fitModel(asset, "y").dimensions[0], 26);
  const asymmetric = new Mesh(new BoxGeometry(10, 20, 30));
  asymmetric.updateMatrixWorld(true);
  const rotated = parseModel(
    "axes.obj",
    buffer(new OBJExporter().parse(asymmetric)),
  );
  assert.deepEqual(fitModel(rotated, "y").dimensions, [10, 20, 30]);
  assert.deepEqual(fitModel(rotated, "z").dimensions, [10, 30, 20]);
});
test("oversize models scale uniformly and unprintable inputs give errors", () => {
  const asset = fitted(cube(100));
  assert.deepEqual(asset.dimensions, [40, 40, 40]);
  assert.equal(asset.scale, 0.4);
  assert.throws(() => parseModel("bad.stl", buffer("not a mesh")));
  assert.throws(
    () => parseModel("bad.txt", buffer("anything")),
    /Unsupported format/,
  );
  assert.throws(
    () => parseModel("huge.stl", new ArrayBuffer(MAX_FILE_BYTES + 1)),
    /12 MB/,
  );
  assert.throws(
    () =>
      fitModel(
        { positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 0, 1]) },
        "y",
      ),
    /flat/,
  );
});
test("cube slices form a closed square with the measured perimeter", () => {
  const asset = fitted(cube());
  const contours = sliceContours(asset.positions, BED_Y + 0.4);
  assert.equal(contours.length, 1);
  const contour = contours[0];
  assert.deepEqual(contour[0], contour.at(-1));
  let perimeter = 0;
  for (let i = 1; i < contour.length; i++)
    perimeter += Math.hypot(...contour[i].map((v, a) => v - contour[i - 1][a]));
  assert.ok(Math.abs(perimeter / WORLD_PER_MM - 40) < 0.001);
  const plan = generatePrintPlan(asset.positions, 0.2);
  assert.equal(plan.layerCount, 50);
  assert.equal(plan.contourCount, 50);
  assert.ok(Math.abs(plan.extrusionMM - 2000) < 0.1);
  assert.equal(plan.layerEnds.length, 50);
});
test("holes remain separate closed contours", () => {
  const shape = new Shape();
  shape.moveTo(-10, -10);
  shape.lineTo(10, -10);
  shape.lineTo(10, 10);
  shape.lineTo(-10, 10);
  shape.closePath();
  const hole = new Path();
  hole.moveTo(-4, -4);
  hole.lineTo(-4, 4);
  hole.lineTo(4, 4);
  hole.lineTo(4, -4);
  hole.closePath();
  shape.holes.push(hole);
  const asset = fitted(
    new Mesh(new ExtrudeGeometry(shape, { depth: 10, bevelEnabled: false })),
  );
  const contours = sliceContours(asset.positions, BED_Y + 0.4);
  assert.equal(contours.length, 2);
  const plan = generatePrintPlan(asset.positions, 0.2);
  assert.equal(plan.contourCount, 100);
  assert.ok(Math.abs(plan.extrusionMM - 5600) < 0.1);
});
test("separate islands never extrude across their gap", () => {
  const group = new Group(),
    left = cube(6),
    right = cube(6);
  left.position.x = -8;
  right.position.x = 8;
  group.add(left, right);
  const asset = fitted(group),
    plan = generatePrintPlan(asset.positions, 0.2);
  assert.equal(plan.contourCount, plan.layerCount * 2);
  let sawGapTravel = false;
  for (let i = 1; i < plan.times.length; i++) {
    assert.ok(plan.times[i] >= plan.times[i - 1]);
    const x = plan.points[i * 3] / WORLD_PER_MM;
    if (Math.abs(x) < 4.99) {
      assert.equal(plan.extruding[i], 0);
      sawGapTravel = true;
    }
    if (plan.extruding[i])
      assert.ok(
        Math.abs(plan.points[i * 3 + 1] - plan.points[(i - 1) * 3 + 1]) < 1e-6,
      );
  }
  assert.ok(sawGapTravel);
});
test("open mesh fails explicitly instead of inventing a closed path", () => {
  const asset = fitted(cube());
  assert.throws(
    () => generatePrintPlan(asset.positions.slice(18), 0.2),
    /contours|closed/,
  );
});
test("scrubbing and completion select the correct move and layer", () => {
  const plan = generatePrintPlan(fitted(cube()).positions, 0.2);
  assert.equal(currentPlanLayer(plan, 0), 0);
  assert.equal(currentPlanLayer(plan, 1), plan.layerCount);
  assert.equal(locateMove(plan.times, 0).index, 0);
  assert.equal(locateMove(plan.times, 1).index, plan.times.length - 1);
  const mid = locateMove(plan.times, 0.5);
  assert.ok(mid.index > 0 && mid.index < plan.times.length - 1);
  assert.ok(mid.alpha >= 0 && mid.alpha <= 1);
});
