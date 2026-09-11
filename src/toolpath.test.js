import test from "node:test";
import assert from "node:assert/strict";
import {
  createToolpath,
  layerCount,
  advanceProgress,
  BED_Y,
  WORLD_HEIGHT,
} from "./toolpath.js";

for (const model of ["vase", "cube", "twist"]) {
  test(`${model}: deposition stays inside the bed and rises continuously`, () => {
    const points = createToolpath(model, 200);
    for (let i = 0; i < points.length; i++) {
      const [x, y, z] = points[i];
      assert.ok(Number.isFinite(x + y + z));
      assert.ok(Math.abs(x) < 2.4 && Math.abs(z) < 2.05);
      assert.ok(y >= BED_Y && y <= BED_Y + WORLD_HEIGHT + 0.02);
      if (i > 0) {
        const p = points[i - 1];
        assert.ok(y >= p[1]);
        assert.ok(
          Math.hypot(x - p[0], y - p[1], z - p[2]) < 0.12,
          "No disconnected extrusion between layers",
        );
      }
    }
  });
}
test("layer settings produce the expected count", () => {
  assert.equal(layerCount(0.2), 200);
  assert.equal(layerCount(0.12), 333);
  assert.equal(layerCount(0.28), 143);
});
test("cube has equal width, depth, and height", () => {
  const points = createToolpath("cube", 200);
  const xs = points.map((p) => p[0]),
    zs = points.map((p) => p[2]);
  assert.equal(Math.max(...xs) - Math.min(...xs), WORLD_HEIGHT);
  assert.equal(Math.max(...zs) - Math.min(...zs), WORLD_HEIGHT);
});
test("playback speed scales and stops exactly at completion", () => {
  assert.equal(advanceProgress(0, 240, 60, 1), 1);
  assert.equal(advanceProgress(0, 24, 60, 10), 1);
  assert.equal(advanceProgress(0, 120, 120, 1), 1);
  assert.equal(advanceProgress(0.999, 1, 60, 10), 1);
  assert.equal(advanceProgress(0.42, 0, 60, 1), 0.42);
  assert.equal(advanceProgress(0.42, -1, 60, 1), 0.42);
});
