import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';
import { connectMachineClock } from '../src/machine-clock.js';

const bundle=readFileSync(new URL('../node_modules/@strudel/repl/dist/index.js',import.meta.url),'utf8');
const body=parse(bundle,{ecmaVersion:'latest'}).body[0].declarations[0].init.callee.body.body;
const boundary=body.find(n=>n.type==='VariableDeclaration' && n.declarations.some(d=>d.id.name==='mini$1'));
const context=vm.createContext({console:{log(){},warn(){}},performance,setTimeout,clearTimeout,setInterval,clearInterval});
const native=vm.runInContext(bundle.slice(0,boundary.end)+';return {...core,getTrigger};}({});strudel;',context);

test('actual Strudel clock gives original voices the same times, bar zero and changing tempo',async()=>{
  let seconds=0,tick,stops=0;const notes=[],pulses=[];
  const scheduler=new native.Cyclist({getTime:()=>seconds,setInterval:fn=>{tick=fn;return 1;},clearInterval:()=>{tick=null;},
    onTrigger:native.getTrigger({getTime:()=>seconds,defaultOutput:(hap,_deadline,_duration,cps,time)=>notes.push({step:Math.round(Number(hap.whole.begin)*16)%16,cps,time})})});
  const machine={tick:(time,step,cps)=>pulses.push({time,step,cps}),stop:()=>stops++};
  const connection=connectMachineClock(scheduler,native,machine);
  const score=native.pure({note:36}).fast(16);let input;
  score.shadowInput=t=>{input=t;};
  await scheduler.setPattern(score);scheduler.pattern.shadowInput(3);assert.equal(input,3);
  scheduler.setCps(128/240);await scheduler.start();
  for(let i=1;i<=45;i++){seconds=i/10;tick?.();}
  assert.ok(pulses.length>32);assert.equal(pulses[0].step,0);
  assert.deepEqual(pulses,notes,'silent machine pulse has precisely the same deadline as a Strudel onset');
  await scheduler.setPattern(scheduler.pattern); // A wrapped pattern must not double pulses.
  scheduler.setCps(90/240);
  for(let i=46;i<=80;i++){seconds=i/10;tick?.();}
  assert.deepEqual(pulses,notes);assert.ok(pulses.some(p=>p.cps===90/240));
  scheduler.stop();assert.equal(stops,1);const count=pulses.length;
  seconds=10;tick?.();assert.equal(pulses.length,count);
  connection.disconnect();assert.equal(scheduler.pattern,score);
  assert.equal(stops,2);
});

test('reevaluation keeps one clock layer and disconnect restores native scheduler hooks',async()=>{
  const scheduler={async setPattern(p){this.pattern=p;},onToggle(){}};
  const originalSet=scheduler.setPattern,originalToggle=scheduler.onToggle;
  const connection=connectMachineClock(scheduler,native,{tick(){},stop(){}});
  for(let i=0;i<5;i++) await scheduler.setPattern(native.pure({note:48}));
  const events=scheduler.pattern.queryArc(0,1);
  assert.equal(events.filter(h=>h.context.dominantTrigger).length,16);
  assert.equal(events.filter(h=>!h.context.dominantTrigger).length,1);
  connection.disconnect();connection.disconnect();
  assert.equal(scheduler.setPattern,originalSet);assert.equal(scheduler.onToggle,originalToggle);
});
