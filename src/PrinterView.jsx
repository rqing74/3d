import React, { useEffect, useRef, useState } from "react";
import { createPrinter } from "./printer.js";
import Icon from "./icons.jsx";

export default function PrinterView({
  model,
  layers,
  color,
  progress,
  running,
  view,
  setView,
  asset,
  plan,
  busy,
}) {
  const mount = useRef(null),
    engine = useRef(null),
    latest = useRef({ progress, color, running });
  const [error, setError] = useState("");
  latest.current = { progress, color, running };
  useEffect(() => {
    const printer = createPrinter(mount.current, setError);
    engine.current = printer;
    if (!printer) return;
    let frame;
    function animate(now) {
      const s = latest.current;
      printer.update(s.progress, s.color, s.running, now);
      printer.render();
      frame = requestAnimationFrame(animate);
    }
    frame = requestAnimationFrame(animate);
    return () => {
      cancelAnimationFrame(frame);
      printer.dispose();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    engine.current?.rebuild(
      model,
      layers,
      model === "imported" ? asset : null,
      model === "imported" ? plan : null,
    );
  }, [model, layers, asset, plan]);
  useEffect(() => {
    engine.current?.view(view);
  }, [view]);
  const status = error
    ? "View unavailable"
    : model === "imported" && !plan
      ? busy
        ? "Slicing model…"
        : "Model preview"
      : progress === 1
        ? "Print complete"
        : running
          ? "Printing"
          : progress === 0
            ? "Ready to print"
            : "Paused";
  return (
    <section className="viewport" aria-label="3D workspace">
      <div className="scene" ref={mount} />
      <div className="scene-title">
        <h1>Make something.</h1>
        <p>One layer at a time.</p>
      </div>
      <div
        className={`print-status ${running ? "active" : ""}`}
        aria-live="polite"
      >
        <span />
        {status}
      </div>
      {error && (
        <div className="scene-error" role="alert">
          {error}
        </div>
      )}
      <div className="view-controls" aria-label="Camera view">
        {[
          ["perspective", "cube", "Perspective"],
          ["front", "front", "Front"],
          ["top", "layers", "Top"],
        ].map(([id, icon, title]) => (
          <button
            key={id}
            className={view === id ? "selected" : ""}
            aria-pressed={view === id}
            onClick={() => {
              engine.current?.view(id);
              setView(id);
            }}
          >
            <Icon name={icon} size={17} />
            <span>{title}</span>
          </button>
        ))}
      </div>
      <div className="axis" aria-hidden="true">
        <svg viewBox="0 0 80 80">
          <path d="M36 52V15" stroke="#70bf84" />
          <path d="m36 52 29 15" stroke="#e17464" />
          <path d="m36 52-27 14" stroke="#6ca4e0" />
          <path d="m36 14-3 7h6Z" fill="#70bf84" />
          <path d="m66 68-5-6-3 5Z" fill="#e17464" />
          <text x="31" y="11" fill="#acdbb7">
            Y
          </text>
          <text x="66" y="77" fill="#e99283">
            X
          </text>
          <text x="0" y="76" fill="#8db9ec">
            Z
          </text>
        </svg>
      </div>
    </section>
  );
}
