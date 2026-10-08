import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

function motion(document,reduced=false){
 const exports={};
 const js=ts.transpileModule(fs.readFileSync('lib/gallery-motion.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{exports,document,window:{matchMedia:()=>({matches:reduced})},require:()=>({flushSync:fn=>fn()})});
 return exports.galleryTransition;
}
test('unsupported browsers and reduced motion still commit changes',()=>{
 let updates=0;
 motion({})(()=>updates++);
 motion({startViewTransition:()=>{throw Error('must not animate');}},true)(()=>updates++);
 assert.equal(updates,2);
});
test('opening and closing the lightbox commits immediately without thumbnail snapshots',()=>{
 let open=false,updates=0;
 const transition=motion({startViewTransition:()=>{throw Error('must not snapshot thumbnails');}});
 transition(()=>{open=true;updates++;},'one');
 assert.equal(open,true);
 transition(()=>{open=false;updates++;},'one');
 assert.equal(open,false);assert.equal(updates,2);
});
test('layout changes move photos in 300 ms without whole-page view transitions',()=>{
 let box={left:10,top:20,width:100,height:60},frames,options,updated=0;
 const node={dataset:{galleryPhoto:'one'},getBoundingClientRect:()=>box,animate:(f,o)=>{frames=f;options=o;return {finished:Promise.resolve(),cancel(){}};}};
 const document={querySelectorAll:()=>[node],startViewTransition:()=>{throw Error('must not snapshot the page');}};
 motion(document)(()=>{updated++;box={left:40,top:80,width:200,height:120};});
 assert.equal(updated,1);assert.equal(options.duration,300);
 assert.equal(frames[0].transform,'translate(-30px,-60px) scale(0.5,0.5)');
 assert.equal(frames[1].transform,'none');
});
