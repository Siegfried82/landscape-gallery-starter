import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(fetch){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/viewer-download.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,fetch,Blob,DOMException});return exports.downloadViewerImage;}
test('current original downloads at high priority with progress and exact bytes',async()=>{
 let options;const read=load(async(url,init)=>{options=init;return new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([255,216]));c.enqueue(new Uint8Array([3,255,217]));c.close();}}),{headers:{'content-type':'image/jpeg'}});});
 const progress=[];const blob=await read('/api/view/id?v=2',new AbortController().signal,n=>progress.push(n));
 assert.equal(options.priority,'high');assert.equal(options.cache,'force-cache');assert.deepEqual(progress,[2,5]);assert.equal(blob.type,'image/jpeg');assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())],[255,216,3,255,217]);
});
test('navigation cancels and releases a partially downloaded original',async()=>{
 const controller=new AbortController();let cancelled=false;
 const read=load(async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2]));},cancel(){cancelled=true;}})));
 await assert.rejects(read('/api/view/id',controller.signal,()=>controller.abort()),{name:'AbortError'});assert.equal(cancelled,true);
});
test('HTTP and empty-body failures never produce an apparently ready image',async()=>{
 await assert.rejects(load(async()=>new Response('Not found',{status:404}))('/api/view/id',new AbortController().signal,()=>{}),/404/);
 await assert.rejects(load(async()=>new Response(''))('/api/view/id',new AbortController().signal,()=>{}),/Empty image/);
});
