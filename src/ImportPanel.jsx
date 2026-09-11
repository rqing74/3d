import React, { useRef } from "react";
import Icon from "./icons.jsx";
import { BED_Y } from "./toolpath.js";
import { WORLD_PER_MM } from "./modelImport.js";

export default function ImportPanel({
  asset,
  selected,
  plan,
  busy,
  loading,
  sliceProgress,
  error,
  upAxis,
  onAxis,
  onFile,
  onSelect,
  onGenerate,
  onCancel,
  speed,
  running,
  progress,
}) {
  const input = useRef(null);
  function downloadFlow() {
    const moves = [];
    for (let i = 0; i < plan.times.length; i++) {
      moves.push({
        x: +(plan.points[i * 3] / WORLD_PER_MM).toFixed(3),
        y: +(plan.points[i * 3 + 2] / WORLD_PER_MM).toFixed(3),
        z: +((plan.points[i * 3 + 1] - BED_Y) / WORLD_PER_MM).toFixed(3),
        extrude: Boolean(plan.extruding[i]),
        seconds: +((plan.times[i] * 60) / speed).toFixed(3),
      });
    }
    const data = {
      format: "FORMA visual print flow v1",
      model: asset.name,
      units: "mm",
      origin: "bed center, Z up",
      note: "Simulation only. Perimeter paths without supports, infill, heating, or machine commands. Not G-code.",
      scale: asset.scale,
      fittedSizeMM: {
        width: asset.dimensions[0],
        depth: asset.dimensions[2],
        height: asset.dimensions[1],
      },
      layerHeightMM: plan.layerHeightMM,
      layerCount: plan.layerCount,
      printSpeedMMs: speed,
      estimatedMotionSeconds: (plan.referenceSeconds * 60) / speed,
      layers: plan.layerEnds.map((seconds, index) => ({
        layer: index + 1,
        endSeconds: +((seconds * 60) / speed).toFixed(3),
      })),
      moves,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(data)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${asset.name.replace(/\.[^.]+$/, "")}-print-flow.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  const seconds = plan ? Math.ceil((plan.referenceSeconds * 60) / speed) : 0;
  return (
    <div className="model-import">
      <input
        ref={input}
        className="file-input"
        type="file"
        accept=".stl,.obj"
        aria-label="Import STL or OBJ model"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = "";
        }}
      />
      <button
        className="import-button"
        disabled={loading}
        onClick={() => input.current.click()}
      >
        <Icon name="upload" size={17} />
        {loading ? "Reading model…" : "Import model"}
        <span>STL / OBJ</span>
      </button>
      {error && (
        <p className="import-error" role="alert">
          {error}
        </p>
      )}
      {asset && !selected && (
        <button className="return-import" onClick={onSelect}>
          Use {asset.name}
        </button>
      )}
      {asset && selected && (
        <div className="import-card">
          <div className="import-filename">
            <Icon name="cube" size={17} />
            <b title={asset.name}>{asset.name}</b>
            <span>{asset.triangles.toLocaleString()} faces</span>
          </div>
          <div className="import-meta">
            {asset.dimensions.map((n) => n.toFixed(1)).join(" × ")} mm{" "}
            <span>W × H × D</span>
          </div>
          <label className="import-axis">
            Upright axis
            <select
              aria-label="Model upright axis"
              value={upAxis}
              onChange={(e) => onAxis(e.target.value)}
            >
              <option value="z">Z up (STL)</option>
              <option value="y">Y up (OBJ)</option>
            </select>
          </label>
          <p className="import-note">
            Units assumed mm ·{" "}
            {asset.scale < 0.999
              ? `Scaled to ${(asset.scale * 100).toFixed(1)}% to fit`
              : "Centered on platform"}
          </p>
          <div className="flow-steps" aria-label="Print workflow">
            <span className="done">1 Import</span>
            <span className={plan ? "done" : busy ? "current" : ""}>
              2 Slice
            </span>
            <span
              className={progress === 1 ? "done" : running ? "current" : ""}
            >
              3 Print
            </span>
          </div>
          {busy ? (
            <>
              <progress
                aria-label="Slicing progress"
                value={sliceProgress}
                max="1"
              />
              <button className="generate-button" onClick={onCancel}>
                Cancel slicing · {Math.round(sliceProgress * 100)}%
              </button>
            </>
          ) : (
            <button className="generate-button" onClick={onGenerate}>
              <Icon name="layers" size={16} />
              {plan ? "Regenerate print flow" : "Generate print flow"}
            </button>
          )}
          {plan && (
            <div className="flow-summary" role="status">
              <div>
                <b>{plan.layerCount}</b> layers · <b>{plan.contourCount}</b>{" "}
                contours
              </div>
              <div>
                Motion estimate{" "}
                <b>
                  {Math.floor(seconds / 60)}m {seconds % 60}s
                </b>
              </div>
              <button onClick={downloadFlow}>
                Download flow <span>JSON</span>
              </button>
            </div>
          )}
          <p className="import-note">
            Perimeters only · no infill or supports.
            {plan?.emptyLayers > 0 &&
              ` ${plan.emptyLayers} empty layers; floating parts may need supports.`}
          </p>
        </div>
      )}
    </div>
  );
}
