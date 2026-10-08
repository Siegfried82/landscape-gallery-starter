import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
const exports={};vm.runInNewContext(ts.transpileModule(readFileSync('lib/selection-order.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports});
test('group drag follows click order, not original display order',()=>{
 assert.equal(JSON.stringify(exports.moveSelection(['a','b','c','d','e'],['d','b'],'b','a')),JSON.stringify(['d','b','a','c','e']));
 assert.equal(JSON.stringify(exports.moveSelection(['a','b','c','d'],['c','a'],'a','d')),JSON.stringify(['b','c','a','d']));
});
test('drop on own group is ignored; unselected drag moves only dragged photo',()=>{
 assert.equal(JSON.stringify(exports.moveSelection(['a','b','c'],['b','a'],'a','b')),JSON.stringify(['a','b','c']));
 assert.equal(JSON.stringify(exports.moveSelection(['a','b','c'],['a'],'c','b')),JSON.stringify(['a','c','b']));
});
