import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/viewer-zoom.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});
const {zoomAt}=exports;
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('off-centre zoom preserves the image point under the cursor, including after panning',()=>{
 for(const pose of [{scale:1,x:0,y:0},{scale:3,x:170,y:-80}]){
  const anchor={x:-250,y:110};
  for(const scale of [1.2,2,5,10]){
   const next=zoomAt(pose,scale,anchor);
   near((anchor.x-pose.x)/pose.scale,(anchor.x-next.x)/next.scale);
   near((anchor.y-pose.y)/pose.scale,(anchor.y-next.y)/next.scale);
  }
 }
});
test('zooming back returns to the previous pose without cumulative drift',()=>{
 const pose={scale:2,x:140,y:-60},anchor={x:300,y:-170};
 const back=zoomAt(zoomAt(pose,10,anchor),2,anchor);
 near(back.x,pose.x);near(back.y,pose.y);
});

test('wheel binds on stage mount, keeps the cursor anchor and detaches on close',()=>{
 const element=new EventTarget(),calls=[];
 const wheel=deltaY=>Object.assign(new Event('wheel',{cancelable:true}),{deltaY,clientX:320,clientY:180});
 const unbind=exports.bindViewerWheel(element,(delta,point)=>calls.push({delta,point}));
 const first=wheel(-100);element.dispatchEvent(first);
 assert.equal(first.defaultPrevented,true);
 assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{delta:.2,point:{x:320,y:180}}]);
 unbind();element.dispatchEvent(wheel(-100));assert.equal(calls.length,1);
 const closeAgain=exports.bindViewerWheel(element,(delta,point)=>calls.push({delta,point}));
 element.dispatchEvent(wheel(100));assert.equal(calls[1].delta,-.2);
 closeAgain();
});
