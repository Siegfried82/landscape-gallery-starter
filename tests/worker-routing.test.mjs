import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};
vm.runInNewContext(ts.transpileModule(readFileSync('worker/index.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,{exports,require:id=>id==='../lib/admin-protection'?{protectAdminRequest:async()=>null,recordAdminAction:async()=>{}}:{__esModule:true,default:{fetch:()=>new Response('fallback')}},Request,Response,Headers,ReadableStream,URL});
test('unknown API paths including inherited object properties return 404',async()=>{
 for(const path of ['/api/unknown','/api/toString','/api/constructor','/api/__proto__']){
  const response=await exports.default.fetch(new Request('https://example.com'+path),{},{});
  assert.equal(response.status,404,path);
 }
});
test('homepage uses static assets while build can render without an asset binding',async()=>{
 const response=await exports.default.fetch(new Request('https://example.com/'),{ASSETS:{fetch:r=>{assert.equal(new URL(r.url).pathname,'/index.html');return new Response('static');}}},{});
 assert.equal(await response.text(),'static');
});

test('responses prevent framing and MIME sniffing',async()=>{
 const response=await exports.default.fetch(new Request('https://example.com/'),{},{});
 assert.equal(response.headers.get('X-Frame-Options'),'DENY');
 assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
 assert.match(response.headers.get('Content-Security-Policy'),/frame-ancestors 'none'/);
});

test('oversized declared upload is rejected before API handling',async()=>{
 const response=await exports.default.fetch(new Request('https://example.com/api/photos',{method:'POST',headers:{'Content-Length':String(49*1024*1024)},body:'x'}),{},{});
 assert.equal(response.status,413);
});
