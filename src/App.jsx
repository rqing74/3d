import React, { useEffect, useRef, useState } from "react";
import PrinterView from "./PrinterView.jsx";
import Settings from "./Settings.jsx";
import Icon from "./icons.jsx";
import { advanceProgress, layerCount } from "./toolpath.js";
import { parseModel, fitModel, MAX_FILE_BYTES } from "./modelImport.js";
import { currentPlanLayer } from "./slicer.js";

export default function App() {
  const [model, setModel] = useState("vase"),
    [color, setColor] = useState("#ff7847"),
    [height, setHeight] = useState(0.2);
  const [speed, setSpeed] = useState(60),
    [multiplier, setMultiplier] = useState(1),
    [progress, setProgress] = useState(0.42);
  const [running, setRunning] = useState(
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [view, setView] = useState("perspective"),
    [help, setHelp] = useState(false);
  const helpDialog = useRef(null),
    helpButton = useRef(null);
  const [source, setSource] = useState(null),
    [asset, setAsset] = useState(null),
    [upAxis, setUpAxis] = useState("z"),
    [plan, setPlan] = useState(null),
    [loading, setLoading] = useState(false),
    [busy, setBusy] = useState(false),
    [sliceProgress, setSliceProgress] = useState(0),
    [importError, setImportError] = useState("");
  const worker = useRef(null),
    importRequest = useRef(0);
  const activePlan = model === "imported" ? plan : null;
  const canPrint = model !== "imported" || Boolean(plan);
  const layers =
    model === "imported" ? (plan?.layerCount ?? 0) : layerCount(height);
  const currentLayer = activePlan
    ? currentPlanLayer(activePlan, progress)
    : Math.min(layers, Math.ceil(progress * layers));
  useEffect(
    () => () => {
      worker.current?.terminate();
      importRequest.current++;
    },
    [],
  );
  function cancelSlicing() {
    worker.current?.terminate();
    worker.current = null;
    setBusy(false);
    setSliceProgress(0);
  }
  async function importFile(file) {
    const request = ++importRequest.current;
    cancelSlicing();
    setLoading(true);
    setImportError("");
    try {
      if (file.size > MAX_FILE_BYTES)
        throw new Error("Choose a model smaller than 12 MB.");
      const buffer = await file.arrayBuffer();
      if (request !== importRequest.current) return;
      const parsed = parseModel(file.name, buffer);
      const fitted = fitModel(parsed, parsed.upAxis);
      setSource(parsed);
      setAsset(fitted);
      setUpAxis(parsed.upAxis);
      setPlan(null);
      setModel("imported");
      reset();
    } catch (error) {
      if (request === importRequest.current)
        setImportError(error.message || "The model could not be read.");
    } finally {
      if (request === importRequest.current) setLoading(false);
    }
  }
  function changeAxis(axis) {
    try {
      const fitted = fitModel(source, axis);
      cancelSlicing();
      setAsset(fitted);
      setUpAxis(axis);
      setPlan(null);
      setImportError("");
      reset();
    } catch (error) {
      setImportError(error.message);
    }
  }
  function generateFlow() {
    if (!asset || model !== "imported") return;
    cancelSlicing();
    reset();
    setPlan(null);
    setImportError("");
    setBusy(true);
    try {
      const job = new Worker(new URL("./slicer.worker.js", import.meta.url), {
        type: "module",
      });
      worker.current = job;
      job.onmessage = ({ data }) => {
        if (worker.current !== job) return;
        if (data.type === "progress") setSliceProgress(data.progress);
        else {
          if (data.type === "complete") setPlan(data.plan);
          else setImportError(data.message);
          job.terminate();
          worker.current = null;
          setBusy(false);
        }
      };
      job.onerror = () => {
        if (worker.current === job) {
          cancelSlicing();
          setImportError("Slicing failed. Try a smaller or repaired model.");
        }
      };
      job.postMessage({ positions: asset.positions, layerHeight: height });
    } catch (error) {
      cancelSlicing();
      setImportError(error.message);
    }
  }
  useEffect(() => {
    if (!running) return;
    let previous = performance.now();
    const id = setInterval(() => {
      const now = performance.now(),
        delta = Math.min((now - previous) / 1000, 0.25);
      previous = now;
      setProgress((p) =>
        activePlan
          ? Math.min(
              1,
              p +
                (delta * 3 * (speed / 60) * multiplier) /
                  activePlan.referenceSeconds,
            )
          : advanceProgress(p, delta, speed, multiplier),
      );
    }, 40);
    return () => clearInterval(id);
  }, [running, speed, multiplier, activePlan]);
  useEffect(() => {
    if (progress >= 1) setRunning(false);
  }, [progress]);
  useEffect(() => {
    if (help) helpDialog.current?.showModal();
    else if (helpDialog.current?.open) helpDialog.current.close();
  }, [help]);
  function toggle() {
    if (!canPrint) return;
    if (progress === 1) {
      setProgress(0);
      setRunning(true);
    } else setRunning((v) => !v);
  }
  function reset() {
    setRunning(false);
    setProgress(0);
  }
  function changeModel(value) {
    if (model === value) return;
    importRequest.current++;
    setLoading(false);
    cancelSlicing();
    setImportError("");
    setModel(value);
    reset();
  }
  function changeHeight(value) {
    cancelSlicing();
    setPlan(null);
    setImportError("");
    setHeight(value);
    reset();
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="./" aria-label="FORMA Print Lab">
          <Icon name="logo" size={35} />
          <span>FORMA</span>
        </a>
        <span className="header-divider" />
        <nav aria-label="Main navigation">
          <button
            className={!help ? "active" : ""}
            onClick={() => setHelp(false)}
          >
            Print lab
          </button>
          <button
            ref={helpButton}
            className={help ? "active" : ""}
            onClick={() => setHelp(true)}
          >
            How it works
          </button>
        </nav>
        <span className="simulation-tag">
          <i />
          SIMULATION
        </span>
      </header>
      <main className="studio">
        <div className="workspace">
          <PrinterView
            {...{
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
            }}
          />
          <div className="transport">
            <button
              className="transport-action"
              onClick={toggle}
              disabled={!canPrint}
              aria-label={running ? "Pause simulation" : "Play simulation"}
            >
              <Icon name={running ? "pause" : "play"} size={18} />
              <span>{running ? "Pause" : "Play"}</span>
            </button>
            <button
              className="transport-action"
              aria-label="Reset print"
              onClick={reset}
            >
              <Icon name="reset" size={18} />
              <span>Reset</span>
            </button>
            <div className="progress-control">
              <input
                type="range"
                disabled={!canPrint}
                aria-label="Print progress"
                min="0"
                max="1000"
                step="1"
                value={Math.round(progress * 1000)}
                style={{ "--fill": `${progress * 100}%` }}
                onChange={(e) => {
                  setRunning(false);
                  setProgress(Number(e.target.value) / 1000);
                }}
              />
            </div>
            <span className="layer-count">
              Layer <b>{currentLayer}</b>
              <span> / </span>
              {layers}
            </span>
            <strong className="percentage" aria-label="Completion">
              {Math.floor(progress * 100)}
              <span>%</span>
            </strong>
          </div>
        </div>
        <Settings
          canPrint={canPrint}
          importProps={{
            asset,
            plan,
            busy,
            loading,
            sliceProgress,
            error: importError,
            upAxis,
            onAxis: changeAxis,
            onFile: importFile,
            onSelect: () => changeModel("imported"),
            onGenerate: generateFlow,
            onCancel: cancelSlicing,
          }}
          {...{
            model,
            color,
            setColor,
            height,
            speed,
            setSpeed,
            multiplier,
            setMultiplier,
            running,
            progress,
          }}
          onModel={changeModel}
          onHeight={changeHeight}
          onToggle={toggle}
        />
      </main>
      <footer className="footer">
        <div>
          <span>
            <b>ORBIT</b> Drag
          </span>
          <i />
          <span>
            <b>ZOOM</b> Scroll
          </span>
          <i />
          <span>
            <b>PAN</b> Shift + drag
          </span>
        </div>
        <a href="https://threejs.org/" target="_blank" rel="noreferrer">
          Three.js <span>/</span> WebGL <i />
        </a>
      </footer>
      <dialog
        ref={helpDialog}
        className="help-dialog"
        onCancel={() => setHelp(false)}
        onClose={() => {
          setHelp(false);
          helpButton.current?.focus();
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) setHelp(false);
        }}
      >
        <button
          className="close-help"
          aria-label="Close instructions"
          onClick={() => setHelp(false)}
        >
          <Icon name="close" />
        </button>
        <Icon name="layers" size={32} />
        <h2>From filament to form.</h2>
        <p>A small window into additive manufacturing.</p>
        <ol>
          <li>
            <b>Choose your form</b>
            <span>
              Pick a preset or import a local STL / OBJ mesh (up to 12 MB and
              150,000 triangles). Check the upright axis, then generate a print
              flow. Changing the model or layer height resets the build.
            </span>
          </li>
          <li>
            <b>Make it yours</b>
            <span>
              Choose a filament color and layer height. Imported models are
              sliced into actual mesh contours, with separate travel moves.
              Changing layer height or orientation requires regenerating the
              flow. Download the generated moves as JSON.
            </span>
          </li>
          <li>
            <b>Watch every layer</b>
            <span>
              Start the print and follow the nozzle. Drag the timeline to
              inspect any stage, or orbit and zoom to see the exposed mechanics.
            </span>
          </li>
        </ol>
        <div className="help-note">
          This is a visual simulation, not a slicer or printer controller.
          Presets take about 4 minutes at 1× and 60 mm/s; imported motion runs
          at 3× real time before the selected multiplier. Import units are
          assumed to be mm. No infill, support generation, or G-code is
          included. Temperature values are simulated targets. Imported files
          stay in your browser.
        </div>
        <button className="primary" onClick={() => setHelp(false)}>
          Back to the workbench
        </button>
      </dialog>
    </div>
  );
}
