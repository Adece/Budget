import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {blank} from '../model.js';
const code=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
function context(fetch){const elements={};const el=()=>({value:'2026-11',style:{},innerHTML:'',addEventListener(){}});const alerts=[];const c={document:{body:{inert:false},querySelector:s=>elements[s]??=el(),querySelectorAll:()=>[],addEventListener(){}},fetch,AbortSignal,structuredClone,Intl,Date,setTimeout,alert:s=>alerts.push(s),location:{assign(){}},console};vm.createContext(c);return {c,elements,alerts}}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('client loads server data and writes with the current revision',async()=>{
 const calls=[];const {c}=context(async(path,opts)=>{calls.push({path,opts});return {ok:true,status:200,json:async()=>opts.method?{revision:3}:{state:blank(),revision:2}}});
 vm.runInContext(code,c);await flush();assert.equal(vm.runInContext('revision',c),2);assert.equal(vm.runInContext('blocked',c),false);
 assert.equal(await vm.runInContext('save()',c),true);assert.equal(JSON.parse(calls[1].opts.body).revision,2);assert.equal(vm.runInContext('revision',c),3);assert.equal(c.document.body.inert,false);
});
test('client refuses further saves after an ambiguous network failure',async()=>{
 let writes=0;const {c,alerts}=context(async(path,opts)=>{if(opts.method){writes++;throw Error('Network error')}return {ok:true,status:200,json:async()=>({state:blank(),revision:2})}});
 vm.runInContext(code,c);await flush();assert.equal(await vm.runInContext('save()',c),false);assert.equal(await vm.runInContext('save()',c),false);assert.equal(writes,1);assert.equal(vm.runInContext('blocked',c),true);assert.equal(alerts.length,2);
});
test('failed initial load never enables saving an empty budget',async()=>{
 const {c}=context(async()=>{throw Error('Network error')});vm.runInContext(code,c);await flush();assert.equal(vm.runInContext('blocked',c),true);assert.equal(await vm.runInContext('save()',c),false);
});
