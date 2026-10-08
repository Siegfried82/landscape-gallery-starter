import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import jpeg from 'jpeg-js';
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync('lib/public-image.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Uint8Array,DataView,TextDecoder,ReadableStream,Set,Error});
function bucket(bytes,chunkSize=3){return {get:async(_id,options)=>{
 const b=options?.range?bytes.subarray(options.range.offset,options.range.offset+options.range.length):bytes;let offset=0;
 return {arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),body:new ReadableStream({pull(controller){if(offset>=b.length){controller.close();return;}const end=Math.min(offset+chunkSize,b.length);controller.enqueue(b.subarray(offset,end));offset=end;}})};
}};}
async function clean(bytes,mime,chunkSize){return Buffer.from(await new Response(await exports.publicImage(bucket(bytes,chunkSize),'id',mime)).arrayBuffer());}
const segment=(marker,value)=>{const length=Buffer.alloc(2);length.writeUInt16BE(value.length+2);return Buffer.concat([Buffer.from([255,marker]),length,value]);};
test('JPEG removes EXIF, GPS, XMP, IPTC and comments before and after scans without changing pixels',async()=>{
 const original=jpeg.encode({width:2,height:2,data:Buffer.alloc(16,255)},75).data;
 const privateTag=Buffer.from('Exif\0\0GPS-location-camera-serial');
 const input=Buffer.concat([original.subarray(0,2),segment(225,privateTag),segment(237,Buffer.from('IPTC-owner')),segment(254,Buffer.from('private-comment')),original.subarray(2,-2),segment(225,Buffer.from('XMP-private')),original.subarray(-2)]);
 for(const size of [1,3,65536]){const output=await clean(input,'image/jpeg',size);assert.equal(output.includes(privateTag),false);assert.equal(output.includes(Buffer.from('private')),false);assert.equal(output.includes(Buffer.from('IPTC-owner')),false);assert.deepEqual(jpeg.decode(output).data,jpeg.decode(original).data);}
});
function pngChunk(type,data){const length=Buffer.alloc(4);length.writeUInt32BE(data.length);return Buffer.concat([length,Buffer.from(type),data,Buffer.alloc(4)]);}
test('PNG drops EXIF and all text chunks, retaining pixel and transparency chunks byte-for-byte',async()=>{
 const signature=Buffer.from([137,80,78,71,13,10,26,10]);const header=pngChunk('IHDR',Buffer.alloc(13));const pixels=pngChunk('IDAT',Buffer.from([1,2,3,4]));const alpha=pngChunk('tRNS',Buffer.from([2]));const end=pngChunk('IEND',Buffer.alloc(0));
 const input=Buffer.concat([signature,header,pngChunk('eXIf',Buffer.from('GPS')),pngChunk('iTXt',Buffer.from('owner')),alpha,pixels,end]);
 assert.deepEqual(await clean(input,'image/png',1),Buffer.concat([signature,header,alpha,pixels,end]));
});
function webpChunk(type,data){const length=Buffer.alloc(4);length.writeUInt32LE(data.length);return Buffer.concat([Buffer.from(type),length,data,...(data.length%2?[Buffer.alloc(1)]:[])]);}
test('WebP strips EXIF/XMP, corrects RIFF length and metadata flags, preserving image chunks',async()=>{
 const vp8x=webpChunk('VP8X',Buffer.from([0x0c,0,0,0,0,0,0,0,0,0]));const pixels=webpChunk('VP8 ',Buffer.from([1,2,3]));const chunks=Buffer.concat([vp8x,webpChunk('EXIF',Buffer.from('GPS')),pixels,webpChunk('XMP ',Buffer.from('owner'))]);const header=Buffer.from('RIFF0000WEBP');header.writeUInt32LE(chunks.length+4,4);
 const output=await clean(Buffer.concat([header,chunks]),'image/webp',1);const expected=Buffer.concat([header,vp8x,pixels]);expected.writeUInt32LE(expected.length-8,4);expected[20]=0;assert.deepEqual(output,expected);
});
test('invalid and truncated images fail without returning unsanitized bytes',async()=>{
 await assert.rejects(clean(Buffer.from('Exif-private'),'image/jpeg',1));
 await assert.rejects(clean(Buffer.from([255,216,255,225,0,16,1]),'image/jpeg',1));
 await assert.rejects(exports.publicImage(bucket(Buffer.from('private')),'id','application/octet-stream'));
});
test('private originals reject anonymous requests before accessing storage',async()=>{
 const route={};let reads=0;
 const js=ts.transpileModule(readFileSync('app/api/admin/original/[id]/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(js,{exports:route,Response,require:id=>id==='@/lib/owner'?{getOwner:async()=>null}:{storage:()=>{reads++;throw Error('Must not read private storage');}}});
 const response=await route.GET(new Request('https://gallery.test/api/admin/original/id'),{params:Promise.resolve({id:'id'})});
 assert.equal(response.status,403);assert.equal(reads,0);
});
test('large JPEG scans retain all escaped pixel bytes and use bounded transport blocks',async()=>{
 const pixels=Buffer.alloc(4*1024*1024,83);
 for(let i=13;i<pixels.length-2;i+=101){pixels[i]=255;pixels[i+1]=0;}
 const input=Buffer.concat([Buffer.from([255,216]),segment(218,Buffer.from([1,1,0,0,63,0])),pixels,Buffer.from([255,217])]);
 const stream=await exports.publicImage(bucket(input,65536),'id','image/jpeg');
 const reader=stream.getReader(),chunks=[];
 while(true){const r=await reader.read();if(r.done)break;assert.ok(r.value.length<=65536);chunks.push(r.value);}
 assert.ok(chunks.length<70,'a multi-megabyte photo must not emit a chunk for every escaped byte');
 assert.deepEqual(Buffer.concat(chunks),input);
 for(const size of [1,2,3]){
  const scan=Buffer.from([2,255,0,3,255,208,4,255,255,209,5]);
  const tiny=Buffer.concat([Buffer.from([255,216]),segment(218,Buffer.from([1])),scan,Buffer.from([255,217])]);
  assert.deepEqual(await clean(tiny,'image/jpeg',size),Buffer.concat([Buffer.from([255,216]),segment(218,Buffer.from([1])),Buffer.from([2,255,0,3,255,208,4,255,209,5]),Buffer.from([255,217])]));
 }
});
