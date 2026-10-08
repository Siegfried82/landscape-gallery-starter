import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/viewer-image.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports});
const image=decode=>({decode,complete:true,naturalWidth:6000,naturalHeight:4000,isConnected:true});
test('a loaded original is not shown until decoding completes',async()=>{
 let finish;let settled=false;
 const pending=exports.decodeViewerImage(image(()=>new Promise(resolve=>{finish=resolve;}))).then(result=>{settled=true;return result;});
 await Promise.resolve();assert.equal(settled,false);
 finish();assert.equal(await pending,true);
});
test('decode failure keeps the preview instead of declaring the original ready',async()=>{
 assert.equal(await exports.decodeViewerImage(image(async()=>{throw new Error('decode failed');})),false);
});
test('an original removed during decoding cannot update a new viewer',async()=>{
 let finish;const original=image(()=>new Promise(resolve=>{finish=resolve;}));
 const pending=exports.decodeViewerImage(original);original.isConnected=false;finish();
 assert.equal(await pending,false);
});
