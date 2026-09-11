import React, { useEffect, useRef, useState } from 'react';
import PrinterView from './PrinterView.jsx';
import Settings from './Settings.jsx';
import Icon from './icons.jsx';
import {advanceProgress,layerCount} from './toolpath.js';

export default function App() {
  const [model,setModel]=useState('vase'),[color,setColor]=useState('#ff7847'),[height,setHeight]=useState(0.2);
  const [speed,setSpeed]=useState(60),[multiplier,setMultiplier]=useState(1),[progress,setProgress]=useState(0.42);
  const [running,setRunning]=useState(!window.matchMedia('(prefers-reduced-motion: reduce)').matches),[view,setView]=useState('perspective'),[help,setHelp]=useState(false);
  const helpDialog=useRef(null),helpButton=useRef(null);
  const layers=layerCount(height);
  useEffect(()=>{
    if(!running)return;
    let previous=performance.now();
    const id=setInterval(()=>{const now=performance.now(),delta=Math.min((now-previous)/1000,0.25);previous=now;setProgress(p=>advanceProgress(p,delta,speed,multiplier));},40);
    return ()=>clearInterval(id);
  },[running,speed,multiplier]);
  useEffect(()=>{if(progress>=1)setRunning(false);},[progress]);
  useEffect(()=>{if(help)helpDialog.current?.showModal();else if(helpDialog.current?.open)helpDialog.current.close();},[help]);
  function toggle(){if(progress===1){setProgress(0);setRunning(true);}else setRunning(v=>!v);}
  function reset(){setRunning(false);setProgress(0);}
  function changeModel(value){if(model===value)return;setModel(value);reset();}
  function changeHeight(value){setHeight(value);reset();}
  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="./" aria-label="FORMA Print Lab"><Icon name="logo" size={35}/><span>FORMA</span></a><span className="header-divider"/><nav aria-label="Main navigation"><button className={!help?'active':''} onClick={()=>setHelp(false)}>Print lab</button><button ref={helpButton} className={help?'active':''} onClick={()=>setHelp(true)}>How it works</button></nav><span className="simulation-tag"><i/>SIMULATION</span></header>
    <main className="studio"><div className="workspace"><PrinterView {...{model,layers,color,progress,running,view,setView}}/><div className="transport"><button className="transport-action" onClick={toggle} aria-label={running?'Pause simulation':'Play simulation'}><Icon name={running?'pause':'play'} size={18}/><span>{running?'Pause':'Play'}</span></button><button className="transport-action" aria-label="Reset print" onClick={reset}><Icon name="reset" size={18}/><span>Reset</span></button><div className="progress-control"><input type="range" aria-label="Print progress" min="0" max="1000" step="1" value={Math.round(progress*1000)} style={{'--fill':`${progress*100}%`}} onChange={e=>{setRunning(false);setProgress(Number(e.target.value)/1000);}}/></div><span className="layer-count">Layer <b>{Math.min(layers,Math.ceil(progress*layers))}</b><span> / </span>{layers}</span><strong className="percentage" aria-label="Completion">{Math.floor(progress*100)}<span>%</span></strong></div></div>
    <Settings {...{model,color,setColor,height,speed,setSpeed,multiplier,setMultiplier,running,progress}} onModel={changeModel} onHeight={changeHeight} onToggle={toggle}/></main>
    <footer className="footer"><div><span><b>ORBIT</b> Drag</span><i/><span><b>ZOOM</b> Scroll</span><i/><span><b>PAN</b> Shift + drag</span></div><a href="https://threejs.org/" target="_blank" rel="noreferrer">Three.js <span>/</span> WebGL <i/></a></footer>
    <dialog ref={helpDialog} className="help-dialog" onCancel={()=>setHelp(false)} onClose={()=>{setHelp(false);helpButton.current?.focus();}} onClick={e=>{if(e.target===e.currentTarget)setHelp(false);}}><button className="close-help" aria-label="Close instructions" onClick={()=>setHelp(false)}><Icon name="close"/></button><Icon name="layers" size={32}/><h2>From filament to form.</h2><p>A small window into additive manufacturing.</p><ol><li><b>Choose your form</b><span>Pick a spiral vase, cube, or twisted vessel. Changing the model or layer height resets the build.</span></li><li><b>Make it yours</b><span>Choose a filament color and layer height. All models use a continuous, hollow perimeter; finer layers reveal more detail.</span></li><li><b>Watch every layer</b><span>Start the print and follow the nozzle. Drag the timeline to inspect any stage, or orbit and zoom to see the exposed mechanics.</span></li></ol><div className="help-note">This is a visual simulation, not a slicer or printer controller. Motion is time-compressed: about 4 minutes at 1× and 60 mm/s. Temperature values are simulated targets.</div><button className="primary" onClick={()=>setHelp(false)}>Back to the workbench</button></dialog>
  </div>;
}
