import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
function load(publicImage){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('lib/public-original.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Error,Promise,FixedLengthStream:class extends TransformStream{constructor(){super();}},require:id=>id==='./public-image'?{publicImage}:{publicImageLength:async()=>11}});return exports.publicOriginal;}
test('prepare once, reuse native storage body, and invalidate when source changes',async()=>{
 let etag='a',runs=0;const objects=new Map();
 const bucket={head:async()=>({etag}),get:async key=>objects.get(key)||null,put:async(key,body)=>{const bytes=await new Response(body).arrayBuffer();objects.set(key,{body:bytes,size:bytes.byteLength});}};
 const prepare=load(async()=>{runs++;return new Response('safe pixels').body;});
 const first=await prepare(bucket,'photo','image/jpeg');assert.equal(first.size,11);
 assert.equal(await prepare(bucket,'photo','image/jpeg'),first);assert.equal(runs,1);
 etag='b';await prepare(bucket,'photo','image/jpeg');assert.equal(runs,2);
 assert.deepEqual([...objects.keys()],['public-original/v2/photo/a','public-original/v2/photo/b']);
});
test('missing or failed source never returns private original bytes',async()=>{
 const prepare=load(async()=>{throw Error('invalid image');});
 assert.equal(await prepare({head:async()=>null},'photo','image/jpeg'),null);
 let writes=0;await assert.rejects(prepare({head:async()=>({etag:'a'}),get:async()=>null,put:async()=>{writes++;}},'photo','image/jpeg'));
 assert.equal(writes,0);
});
test('HEAD prepares the same public original but cancels the download body',async()=>{
 let canceled=false;const route={};
 const code=ts.transpileModule(readFileSync('app/api/view/[id]/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const db={prepare:()=>({bind:()=>({first:async()=>({mime:'image/jpeg'})})})};
 vm.runInNewContext(code,{exports:route,Response,URL,String,console,require:id=>id.includes('public-original')?{publicOriginal:async()=>({size:123,body:new ReadableStream({cancel(){canceled=true;}})})}:{storage:()=>({db,bucket:{}})}});
 const response=await route.HEAD(new Request('https://gallery.test/api/view/photo',{method:'HEAD'}),{params:Promise.resolve({id:'photo'})});
 assert.equal(response.status,200);assert.equal(response.body,null);assert.equal(response.headers.get('Content-Length'),'123');assert.equal(canceled,true);
});
