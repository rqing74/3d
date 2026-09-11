import React from "react";
import Icon from "./icons.jsx";
import ImportPanel from "./ImportPanel.jsx";

const colors = [
  ["#ff7847", "Ember orange"],
  ["#e8e1d2", "Porcelain"],
  ["#4eaeb4", "Lagoon"],
  ["#a58bc9", "Lilac"],
  ["#8d969e", "Graphite"],
];
function SectionTitle({ number, children }) {
  return (
    <h3>
      <span>{number}</span>
      {children}
    </h3>
  );
}

export default function Settings({
  model,
  onModel,
  color,
  setColor,
  height,
  onHeight,
  speed,
  setSpeed,
  multiplier,
  setMultiplier,
  running,
  progress,
  onToggle,
  importProps,
  canPrint,
}) {
  return (
    <aside className="settings" aria-label="Print settings">
      <div className="settings-heading">
        <h2>Print settings</h2>
        <Icon name="settings" size={21} />
      </div>
      <section className="setting-section model-section">
        <SectionTitle number="01">Model</SectionTitle>
        <div className="model-options">
          {[
            ["vase", "vase", "Spiral vase"],
            ["cube", "cube", "Cube"],
            ["twist", "twist", "Twist"],
          ].map(([id, icon, label]) => (
            <button
              key={id}
              aria-pressed={model === id}
              className={`model-option ${model === id ? "selected" : ""}`}
              onClick={() => onModel(id)}
            >
              <Icon name={icon} size={47} />
              <span>{label}</span>
            </button>
          ))}
        </div>
        <ImportPanel
          {...importProps}
          selected={model === "imported"}
          speed={speed}
          running={running}
          progress={progress}
        />
      </section>
      <section className="setting-section">
        <SectionTitle number="02">Material</SectionTitle>
        <div className="material-info">
          <span>
            PLA <span className="subtle">/ Matte</span>
          </span>
          <span className="mono">
            1.75 <small>mm</small>
          </span>
        </div>
        <div className="swatches" aria-label="Filament color">
          {colors.map(([hex, label]) => (
            <button
              key={hex}
              className={color === hex ? "selected" : ""}
              style={{ "--swatch": hex }}
              title={label}
              aria-label={label}
              aria-pressed={color === hex}
              onClick={() => setColor(hex)}
            >
              <span />
              {color === hex && <Icon name="check" size={15} />}
            </button>
          ))}
        </div>
      </section>
      <section className="setting-section parameters">
        <SectionTitle number="03">Parameters</SectionTitle>
        <div className="field-row">
          <label>
            Layer height
            <select
              aria-label="Layer height"
              value={height}
              onChange={(e) => onHeight(Number(e.target.value))}
            >
              <option value="0.12">0.12 mm</option>
              <option value="0.2">0.20 mm</option>
              <option value="0.28">0.28 mm</option>
            </select>
          </label>
          <label>
            Print structure
            <div className="static-field">
              {model === "imported"
                ? "Mesh perimeters"
                : model === "vase"
                  ? "Vase mode"
                  : "Hollow shell"}
              <Icon name="layers" size={15} />
            </div>
          </label>
        </div>
        <label className="range-label" htmlFor="print-speed">
          Print speed
          <span>
            <b>{speed}</b> mm/s
          </span>
        </label>
        <input
          id="print-speed"
          type="range"
          min="20"
          max="120"
          step="5"
          value={speed}
          style={{ "--fill": `${speed - 20}%` }}
          onChange={(e) => setSpeed(Number(e.target.value))}
        />
        <label className="simulation-label">Simulation speed</label>
        <div className="speed-options">
          {[1, 5, 10].map((v) => (
            <button
              key={v}
              className={multiplier === v ? "selected" : ""}
              aria-pressed={multiplier === v}
              onClick={() => setMultiplier(v)}
            >
              {v}×
            </button>
          ))}
        </div>
      </section>
      <div className="settings-bottom">
        <div
          className="temperatures"
          aria-label="Simulated target temperatures"
        >
          <div>
            <Icon name="temp" size={29} />
            <div>
              <span>Nozzle</span>
              <p>
                210 <small>°C</small>
              </p>
              <i style={{ "--fill": "78%" }} />
            </div>
          </div>
          <div>
            <Icon name="heat" size={29} />
            <div>
              <span>Build plate</span>
              <p>
                60 <small>°C</small>
              </p>
              <i style={{ "--fill": "53%" }} />
            </div>
          </div>
        </div>
        <button className="primary" onClick={onToggle} disabled={!canPrint}>
          <Icon
            name={running ? "pause" : progress === 1 ? "reset" : "play"}
            size={20}
          />
          {!canPrint
            ? "Generate flow to print"
            : running
              ? "Pause print"
              : progress === 1
                ? "Print again"
                : progress === 0
                  ? "Start print"
                  : "Resume print"}
        </button>
        <div className="system-status">
          <span>
            <i />
            All systems operational
          </span>
          <span>Local simulation</span>
        </div>
      </div>
    </aside>
  );
}
