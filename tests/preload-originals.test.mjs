import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(fetch){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/preload-originals.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,fetch,Set,encodeURIComponent});return exports.preloadOriginals;}
test('opening the viewer pauses new preloads without cancelling shared in-flight transfers',async()=>{
 const calls=[],streams=[];const controller=new AbortController(),completed=new Set();
 const preload=load(async(url,options)=>{calls.push({url,options});return new Response(new ReadableStream({start(stream){streams.push(stream);}}));});
 const pending=preload(['one','two','three'],completed,controller.signal);
 await Promise.resolve();controller.abort();
 for(const stream of streams){stream.enqueue(new Uint8Array([1,2,3]));stream.close();}
 await pending;assert.equal(calls.length,2);assert.ok(calls.every(call=>call.options.signal===undefined));assert.deepEqual([...completed].sort(),['one','two']);
});
test('an interrupted response is never marked as a finished preload',async()=>{
 const preload=load(async()=>new Response(new ReadableStream({start(stream){stream.error(new Error('Incomplete transfer'));}})));
 const completed=new Set();await preload(['one'],completed,new AbortController().signal);assert.equal(completed.size,0);
});
