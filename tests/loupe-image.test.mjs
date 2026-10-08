import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/loupe-image.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,URL});
const ready=exports.isLoupeImageReady;
const base='https://gallery.example/';
const image=src=>({complete:true,naturalWidth:6000,src:base.slice(0,-1)+src});
test('loupe accepts the versioned original and its exact retry URL',()=>{
 assert.equal(ready(image('/api/view/photo?v=2'),'/api/view/photo?v=2',base),true);
 assert.equal(ready(image('/api/view/photo?v=2&retry=1'),'/api/view/photo?v=2&retry=1',base),true);
});
test('loupe rejects stale images, previews and unfinished originals',()=>{
 assert.equal(ready(image('/api/view/previous?v=2'),'/api/view/photo?v=2',base),false);
 assert.equal(ready(image('/api/image/photo'),'/api/view/photo?v=2',base),false);
 assert.equal(ready(image('/api/view/photo?v=2'),'/api/view/photo?v=2&retry=1',base),false);
 assert.equal(ready({...image('/api/view/photo?v=2'),complete:false},'/api/view/photo?v=2',base),false);
 assert.equal(ready({...image('/api/view/photo?v=2'),naturalWidth:0},'/api/view/photo?v=2',base),false);
});
test('loupe uses currentSrc when the browser reports a selected image source',()=>{
 assert.equal(ready({...image('/api/view/stale?v=2'),currentSrc:base+'api/view/photo?v=2'},'/api/view/photo?v=2',base),true);
});
