import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import jpeg from 'jpeg-js';
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/display.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Uint8Array,Error});
const bytes=jpeg.encode({width:2,height:2,data:Buffer.alloc(16,255)},75).data;
test('preview removes EXIF and preserves image pixels',async()=>{
 const metadata=Buffer.from('Exif\0\0GPS-private-location');
 const segment=Buffer.concat([Buffer.from([255,225,0,metadata.length+2]),metadata]);
 const input=Buffer.concat([bytes.subarray(0,2),segment,bytes.subarray(2)]);
 const output=await exports.displayBytes(new File([input],'preview.jpg'));
 assert.equal(Buffer.from(output).includes(metadata),false);
 assert.deepEqual(jpeg.decode(Buffer.from(output)).data,jpeg.decode(bytes).data);
});
test('preview rejects truncated JPEG and oversized input',async()=>{
 await assert.rejects(exports.displayBytes(new File([bytes.subarray(0,-2)],'bad.jpg')));
 await assert.rejects(exports.displayBytes(new File([Buffer.alloc(3*1024*1024+1)],'large.jpg')));
});
test('hero validation rejects JPEG with dimensions but no image scan',async()=>{
 const sof=bytes.indexOf(Buffer.from([255,192]));
 const end=sof+2+bytes.readUInt16BE(sof+2);
 const noScan=Buffer.concat([bytes.subarray(0,end),Buffer.from([255,217])]);
 await assert.rejects(exports.validatedPreviewBytes(new File([noScan],'hero.jpg'),16*1024*1024,12_000_000,65535));
});
