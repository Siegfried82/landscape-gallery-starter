import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto} from 'node:crypto';
function load(path,dependencies={}){const exports={};vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>dependencies[id],Response,Request,Headers,URL,Date,Number,Math,Array,Uint8Array,TextEncoder,crypto:webcrypto});return exports;}
const visitors=load('lib/visitors.ts');
test('SQLite merges refreshes and simultaneous tabs; 30 minute inactivity starts one new visit',()=>{
 const script=`import sys,json,sqlite3
x=json.load(sys.stdin);db=sqlite3.connect(':memory:');db.executescript(x['migration'])
def visit(key,time):db.execute(x['sql'],(key,time,time))
visit('a',1000);visit('a',2000);visit('a',2000)
assert db.execute('SELECT id,visits,first_seen,last_seen FROM visitors').fetchone()==(1,1,1000,2000)
visit('b',3000)
assert db.execute("SELECT id FROM visitors WHERE browser_key='b'").fetchone()[0]==2
visit('a',1802000);visit('a',1802000)
assert db.execute("SELECT visits FROM visitors WHERE browser_key='a'").fetchone()[0]==2
visit('a',1801000)
assert db.execute("SELECT visits,last_seen FROM visitors WHERE browser_key='a'").fetchone()==(2,1802000)
visit('a',3601999)
assert db.execute("SELECT visits FROM visitors WHERE browser_key='a'").fetchone()[0]==2
visit('a',5401999)
assert db.execute("SELECT visits,first_seen FROM visitors WHERE browser_key='a'").fetchone()==(3,1000)
`;
 const result=spawnSync('python3',['-c',script],{input:JSON.stringify({sql:visitors.RECORD_VISIT_SQL,migration:readFileSync('drizzle/0009_visitors.sql','utf8')}),encoding:'utf8'});assert.equal(result.status,0,result.stderr);
});
test('visitor cookies validate UUIDs and reject malformed identities',()=>{
 assert.equal(visitors.visitorCookieValue('other=abc; gallery_visitor=123e4567-e89b-42d3-a456-426614174000'),'123e4567-e89b-42d3-a456-426614174000');
 for(const value of [null,'gallery_visitor=123','gallery_visitor=<script>','gallery_visitor=123e4567-e89b-12d3-a456-426614174000'])assert.equal(visitors.visitorCookieValue(value),null);
});
function publicRoute(owner=false){let reads=0,bound;
 const route=load('app/api/visits/route.ts',{'@/lib/photos':{storage:()=>{reads++;return {db:{prepare:()=>({bind:(...args)=>{bound=args;return {run:async()=>{}};}})}};}},'@/lib/owner':{AUTH_COOKIE_NAME:'gallery_admin_session',getOwner:async()=>owner?{}:null,sameOrigin:r=>r.headers.get('origin')===new URL(r.url).origin},'@/lib/visitors':visitors});
 return {route,reads:()=>reads,bound:()=>bound};
}
test('cross-origin visitor writes are denied; same-origin response hides identifiers and sets private cookie',async()=>{
 const s=publicRoute();const url='https://gallery.test/api/visits';
 assert.equal((await s.route.POST(new Request(url,{method:'POST',headers:{origin:'https://evil.test'}}))).status,403);assert.equal(s.reads(),0);
 const response=await s.route.POST(new Request(url,{method:'POST',headers:{origin:'https://gallery.test'}}));assert.equal(response.status,204);assert.equal(await response.text(),'');
 assert.match(response.headers.get('set-cookie'),/HttpOnly; SameSite=Lax; Max-Age=31536000; Secure/);
 assert.match(s.bound()[0],/^[0-9a-f]{64}$/);assert.equal(response.headers.get('cache-control'),'no-store');
});
test('returning browser keeps identity and authenticated owner visits are excluded',async()=>{
 const s=publicRoute();const request=new Request('https://gallery.test/api/visits',{method:'POST',headers:{origin:'https://gallery.test',cookie:'gallery_visitor=123e4567-e89b-42d3-a456-426614174000'}});
 const a=await s.route.POST(request);const first=s.bound()[0];const b=await s.route.POST(request);assert.equal(b.headers.get('set-cookie'),null);assert.equal(a.status,204);assert.equal(first,s.bound()[0]);
 const owner=publicRoute(true);assert.equal((await owner.route.POST(new Request(request.url,{method:'POST',headers:{origin:'https://gallery.test',cookie:'gallery_admin_session=valid'}}))).status,204);assert.equal(owner.reads(),0);
});
test('anonymous visitor statistics requests are denied before accessing any data',async()=>{
 let reads=0;const route=load('app/api/admin/visitors/route.ts',{'@/lib/owner':{getOwner:async()=>null},'@/lib/photos':{storage:()=>{reads++;throw Error('private');}}});
 const response=await route.GET(new Request('https://gallery.test/api/admin/visitors'));assert.equal(response.status,403);assert.equal(reads,0);
});
