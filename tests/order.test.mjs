import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
test('ordering requires owner, rejects duplicates/stale lists, and saves atomically',async()=>{
 let owner=true,writes=[];const exports={};
 const db={prepare:sql=>({all:async()=>({results:[{id:'a',featured_position:3},{id:'b',featured_position:7}]}),bind:(...args)=>({sql,args})}),batch:async statements=>{writes=statements;}};
 const deps={'@/lib/owner':{sameOrigin:r=>r.headers.get('origin')===new URL(r.url).origin,getOwner:async()=>owner?{}:null},'@/lib/photos':{storage:()=>({db})}};
 vm.runInNewContext(ts.transpileModule(readFileSync('app/api/order/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:id=>deps[id],Request,Response,URL});
 const request=ids=>new Request('https://example.com/api/order',{method:'POST',headers:{origin:'https://example.com','Content-Type':'application/json'},body:JSON.stringify({ids})});
 owner=false;assert.equal((await exports.POST(request(['b','a']))).status,403);owner=true;
 assert.equal((await exports.POST(request(['a','a']))).status,400);
 assert.equal((await exports.POST(request(['a']))).status,409);assert.equal(writes.length,0);
 assert.equal((await exports.POST(request(['b','a']))).status,200);
 assert.equal(writes.length,2);assert.equal(writes[0].args[1],'b');assert.equal(writes[0].args[0],0);
 const flags=new Request('https://example.com/api/order',{method:'POST',headers:{origin:'https://example.com','Content-Type':'application/json'},body:JSON.stringify({ids:['b','a'],flag:'featured',enabled:true})});
 assert.equal((await exports.POST(flags)).status,200);assert.equal(writes[0].args[0],8);assert.equal(writes[0].args[1],'b');assert.equal(writes[1].args[0],9);
 const curated=new Request('https://example.com/api/order',{method:'POST',headers:{origin:'https://example.com','Content-Type':'application/json'},body:JSON.stringify({ids:['a','b'],flag:'curated',enabled:true})});
 assert.equal((await exports.POST(curated)).status,200);assert.equal(writes[0].sql,'UPDATE photos SET curated=? WHERE id=?');assert.equal(writes[0].args[0],1);

});
