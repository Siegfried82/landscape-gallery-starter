import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
function compile(path,dependencies){
  const exports={};
  const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  vm.runInNewContext(js,{exports,require:id=>{if(!(id in dependencies))throw Error(id);return dependencies[id];},crypto:webcrypto,TextEncoder,TextDecoder,Uint8Array,btoa,atob,Response,Request,URL,Date});
  return exports;
}
const session=compile('lib/admin-session.ts',{});
const password='test123456';
const secret='test-only-signing-key-abcdefghijklmnopqrstuvwxyz';
test('signed sessions reject forgery, expiry, secret and password changes',async()=>{
  const now=Date.now();const token=await session.createSession(secret,password,now);
  assert.equal(await session.verifySession(token,secret,password,now),true);
  const payload=JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString());
  assert.equal('pw' in payload,false);
  assert.equal(await session.verifySession(token.slice(0,-5)+'abcde',secret,password,now),false);
  assert.equal(await session.verifySession(token,secret,password,now+session.SESSION_SECONDS*1000),false);
  assert.equal(await session.verifySession(token,secret+'changed',password,now),false);
  assert.equal(await session.verifySession(token,secret,password+'changed',now),false);
  assert.equal(await session.verifySession('auth_123_12',secret,password),false);
  assert.equal(await session.verifySession(token,'',password),false);
  assert.equal(await session.passwordMatches(password,password),true);
  assert.equal(await session.passwordMatches('wrong',password),false);
});
test('login is same-origin, rate limited, fail-closed and sets protected cookies',async()=>{
  let attempts=0,cookie='';const sessions=new Map();
  const env={ADMIN_PASSWORD:password,SESSION_SECRET:secret,DB:{prepare:sql=>({bind:(...args)=>({
   run:async()=>{if(sql.startsWith('INSERT INTO admin_sessions'))sessions.set(args[0],args[1]);if(sql==='DELETE FROM admin_sessions WHERE id=?')sessions.delete(args[0]);return {success:true};},
   first:async()=>sql.startsWith('SELECT id FROM admin_sessions')?(sessions.get(args[0])>args[1]?{id:args[0]}:null):{attempts:++attempts}
  })})}};
  const owner=compile('lib/owner.ts',{'next/headers':{cookies:async()=>({get:()=>cookie?{value:cookie}:undefined})},'cloudflare:workers':{env},'./admin-session':session});
  const route=compile('app/api/admin/login/route.ts',{'cloudflare:workers':{env},'@/lib/owner':owner,'@/lib/admin-session':session});
  const request=(body,origin='https://gallery.test')=>new Request('https://gallery.test/api/admin/login',{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});
  assert.equal(await owner.getOwner(),null);
  assert.equal((await route.POST(request({password},'https://evil.test'))).status,403);
  assert.equal((await route.POST(request({password},''))).status,403);
  assert.equal((await route.POST(request({password:'x'.repeat(5000)}))).status,413);
  assert.equal((await route.POST(request({password:'wrong'}))).status,401);
  const login=await route.POST(request({password}));assert.equal(login.status,200);
  const header=login.headers.get('set-cookie');assert.match(header,/HttpOnly/);assert.match(header,/SameSite=Strict/);assert.match(header,/Secure/);
  cookie=header.split(';')[0].split('=')[1];assert.equal((await owner.getOwner()).userId,'admin');
  assert.equal((await owner.getOwner(new Request('https://example.com/api/photos',{headers:{cookie:'gallery_admin_session='+cookie}}))).userId,'admin');
  assert.equal(await owner.getOwner(new Request('https://example.com/api/photos')),null);
  const stolen=cookie;
  const logout=request({logout:true});logout.headers.set('Cookie','gallery_admin_session='+cookie);
  assert.equal((await route.POST(logout)).status,200);
  assert.equal(await owner.getOwner(new Request('https://gallery.test',{headers:{Cookie:'gallery_admin_session='+stolen}})),null);
  cookie='forged';assert.equal(await owner.getOwner(),null);
  attempts=10;assert.equal((await route.POST(request({password}))).status,429);
  delete env.SESSION_SECRET;assert.equal(await owner.getOwner(),null);assert.equal((await route.POST(request({password}))).status,503);
  assert.match((await route.POST(request({logout:true}))).headers.get('set-cookie'),/Max-Age=0/);
});
