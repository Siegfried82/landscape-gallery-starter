import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';

function protection({authenticated=false,db}={}){
 const exports={};let authCalls=0;
 const dependencies={
  'cloudflare:workers':{env:{DB:db}},
  './owner':{getOwner:async()=>{authCalls++;return authenticated?{userId:'admin'}:null;},sameOrigin:r=>r.headers.get('origin')===new URL(r.url).origin},
 };
 vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/admin-protection.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>dependencies[id],Request,Response,URL,crypto:webcrypto,console:{error:()=>{}}});
 return {...exports,authCalls:()=>authCalls};
}
function request(path,method='GET',headers={}){return new Request('https://gallery.test'+path,{method,headers});}
test('public large images and preloads never require admin authentication',async()=>{
 const p=protection();
 for(const path of ['/','/api/photos','/api/view/photo','/api/original/photo','/api/image/photo','/api/hero/photo']){
  assert.equal(await p.protectAdminRequest(request(path)),null);
 }
 assert.equal(p.authCalls(),0);
});
test('every mutation and the private original require authentication',async()=>{
 const p=protection();
 for(const [path,method] of [['/api/photos','POST'],['/api/photos/id','DELETE'],['/api/photos/id','PATCH'],['/api/uploads','POST'],['/api/uploads/id','PUT'],['/api/uploads/id','DELETE'],['/api/display/id','POST'],['/api/order','POST'],['/api/series','PATCH'],['/api/future-admin-route','POST'],['/api/admin/original/id','GET']]){
  assert.equal((await p.protectAdminRequest(request(path,method,{Origin:'https://gallery.test'}))).status,403,path);
 }
});
test('a valid admin session cannot authorize cross-origin or missing-origin writes',async()=>{
 const p=protection({authenticated:true});
 for(const headers of [{},{Origin:'https://evil.test'},{Origin:'https://gallery.test','Sec-Fetch-Site':'cross-site'}])assert.equal((await p.protectAdminRequest(request('/api/photos/id','DELETE',headers))).status,403);
 assert.equal(await p.protectAdminRequest(request('/api/photos/id','DELETE',{Origin:'https://gallery.test'})),null);
 assert.equal(await p.protectAdminRequest(request('/api/admin/original/id')),null);
});
test('login remains available with same-origin protection',async()=>{
 const p=protection();
 assert.equal(await p.protectAdminRequest(request('/api/admin/login','POST',{Origin:'https://gallery.test'})),null);
 assert.equal((await p.protectAdminRequest(request('/api/admin/login','POST',{Origin:'https://evil.test'}))).status,403);
 assert.equal(p.authCalls(),0);
});
test('audit stores completed operations without secrets and excludes reads, chunks, failures and anonymous logout',async()=>{
 const batches=[];
 const db={prepare:sql=>({bind:(...args)=>({sql,args})}),batch:async statements=>batches.push(statements)};
 const p=protection({db});
 const r=request('/api/photos/id?password=secret','PATCH',{Cookie:'sensitive-cookie',Origin:'https://gallery.test'});
 await p.recordAdminAction(r,new Response('ok'));
 assert.equal(batches.length,1);
 assert.deepEqual(Array.from(batches[0][1].args).slice(2),['PATCH','/api/photos/id',200]);
 assert.equal(JSON.stringify(batches).includes('secret'),false);
 assert.equal(JSON.stringify(batches).includes('sensitive-cookie'),false);
 for(const [r,res] of [[request('/api/view/id'),new Response('ok')],[request('/api/uploads/id','PUT'),new Response('ok')],[request('/api/photos','POST'),new Response('Forbidden',{status:403})],[request('/api/admin/login','POST'),new Response('ok',{headers:{'Set-Cookie':'session=; Max-Age=0'}})]])await p.recordAdminAction(r,res);
 assert.equal(batches.length,1);
 await protection({db:{batch:async()=>{throw Error('DB unavailable');},prepare:db.prepare}}).recordAdminAction(r,new Response('ok'));
});
