import test from 'node:test';
import assert from 'node:assert/strict';
import { SliderBridge, sliderDeclarations, sliderChange } from '../src/slider-bridge.js';

function setup() {
  const mirror={code:'// slider(99, 0, 100, 1) in metadata\nconst A = slider(0.5, 0, 1, 0.01)\nconst B = slider(700, 120, 4800, 10)\nconst C = slider(14, 1, 26, 1)\ns("sawtooth").gain(A).lpf(B).lpq(C)'};
  mirror.widgets=sliderDeclarations(mirror.code);
  mirror.editor={dispatch({changes:c}){mirror.code=mirror.code.slice(0,c.from)+c.insert+mirror.code.slice(c.to);}};
  const signals=new Map(),decorations=[];
  const bridge=new SliderBridge(()=>mirror,{
    setSignal:(id,value)=>signals.set(id,value),
    updateWidgets:(view,widgets)=>decorations.push(widgets),
  });
  bridge.capture();
  return {mirror,signals,decorations,bridge};
}

test('external faders work without any rendered inline slider and keep signal IDs across numeric length changes',()=>{
  const {mirror,signals,bridge}=setup();
  const original=sliderDeclarations(mirror.code);
  bridge.set('A',0,true); // -2 characters
  bridge.set('B',4800,true); // +1 character
  bridge.set('C',9,true); // -1 character
  bridge.set('A',.99,true);
  bridge.set('B',120,true);
  bridge.set('C',26,true);
  assert.deepEqual(sliderDeclarations(mirror.code).map(s=>Number(s.value)),[.99,120,26]);
  assert.deepEqual([...signals],[['slider_'+original[0].from,.99],['slider_'+original[1].from,120],['slider_'+original[2].from,26]]);
});

test('inline widgets remounted after scrolling keep the original live ID after previous edits',()=>{
  const {mirror,bridge,signals}=setup();
  const original=sliderDeclarations(mirror.code);
  bridge.set('A',0,true);
  const current=sliderDeclarations(mirror.code)[1];
  const native={from:current.from,originalFrom:current.from,originalValue:'700',value:'700'};
  bridge.decorateNative([native]);
  assert.equal(native.originalFrom,original[1].from);
  mirror.editor.dispatch({changes:{from:current.from,to:current.to,insert:'1800'}});
  bridge.nativeMessage('slider_'+native.originalFrom,1800);
  assert.equal(signals.get('slider_'+original[1].from),1800);
  assert.equal(Number(sliderDeclarations(mirror.code)[1].value),1800);
});

test('stopped edits change saved code without starting audio, and the next evaluation recaptures IDs',()=>{
  const {mirror,bridge,signals}=setup();
  bridge.set('A',0,false); bridge.set('B',1800,false);
  assert.equal(signals.size,0);
  mirror.widgets=sliderDeclarations(mirror.code); // compiler's next evaluation
  bridge.capture();
  bridge.set('C',25,true);
  assert.equal(signals.get('slider_'+mirror.widgets[2].from),25);
});

test('range clamping, quantization, and ambiguous or invalid faders cannot alter unrelated code',()=>{
  const {mirror,bridge}=setup();
  assert.equal(sliderChange(mirror.code,'A',9).value,1);
  assert.equal(sliderChange(mirror.code,'A',.254).value,.25);
  assert.equal(sliderChange(mirror.code,'B',123).value,120);
  const before=mirror.code;
  assert.throws(()=>bridge.set('A',NaN,true));
  assert.throws(()=>bridge.set('Missing',.5,true));
  assert.equal(mirror.code,before);
  assert.throws(()=>sliderChange(before+'\nconst A = slider(1, 0, 1, 0.1)','A',.3));
});

test('a custom score keeps non-slider visual decorations while its named fader still updates audio',()=>{
  const {mirror,bridge,signals,decorations}=setup();
  mirror.widgets=[...mirror.widgets,{type:'pianoroll',from:mirror.code.length-1,to:mirror.code.length}];
  bridge.capture();
  const id='slider_'+sliderDeclarations(mirror.code)[0].from;
  bridge.set('A',.3,true);
  assert.equal(signals.get(id),.3);
  assert.equal(decorations.length,0);
  assert.equal(mirror.widgets.at(-1).type,'pianoroll');
});
