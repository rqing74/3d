import { generatePrintPlan } from "./slicer.js";

self.onmessage = ({ data }) => {
  try {
    let last = -1;
    const plan = generatePrintPlan(
      data.positions,
      data.layerHeight,
      (progress) => {
        const percent = Math.floor(progress * 100);
        if (percent !== last) {
          self.postMessage({ type: "progress", progress });
          last = percent;
        }
      },
    );
    self.postMessage({ type: "complete", plan }, [
      plan.points.buffer,
      plan.extruding.buffer,
      plan.times.buffer,
    ]);
  } catch (error) {
    self.postMessage({ type: "error", message: error.message });
  }
};
