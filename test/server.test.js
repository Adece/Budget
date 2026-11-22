import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server-core.js';
import {blank,validate} from '../model.js';
import {Readable} from 'node:stream';
let app,url,cookie='',attempts=0,revision=0,state=blank();const sessions=new Set();
const db={health:async()=>{},load:async()=>({revision,state:structuredClone(state)}),save:async(s,r)=>{if(r!==revision)return null;state=structuredClone(s);return ++revision},loginAllowed:async()=>++attempts<=15,sessionCreate:async h=>sessions.add(h),sessionValid:async h=>sessions.has(h),sessionDelete:async h=>sessions.delete(h)};
// Exercise the real HTTP request handler without opening sockets, so these tests
// also run in restricted environments. Real Postgres/browser QA is separate.
const request=(path,method='GET',data,session=cookie,extra={})=>new Promise((resolve,reject)=>{
 const req=Readable.from(data===undefined?[]:[Buffer.from(JSON.stringify(data))]);req.url=path;req.method=method;
 req.headers=Object.fromEntries(Object.entries({'content-type':'application/json','x-budget-request':'1',host:'localhost',...(session?{cookie:session}:{}),...extra}).map(([k,v])=>[k.toLowerCase(),v]));
 const headers=new Map();let status=200;
 const res={headersSent:false,setHeader:(k,v)=>headers.set(k.toLowerCase(),v),writeHead:(s,h={})=>{status=s;res.headersSent=true;for(const [k,v]of Object.entries(h))headers.set(k.toLowerCase(),v)},end:body=>resolve({status,headers:{get:k=>headers.get(k.toLowerCase())},json:async()=>JSON.parse(String(body)),text:async()=>String(body)})};
 Promise.resolve(app.listeners('request')[0](req,res)).catch(reject);
});
before(async()=>{app=await createApp({db,password:'a-test-password-at-least-16-characters',production:false})});
after(()=>app.close());
test('database health and authentication gate',async()=>{
 assert.equal((await request('/health')).status,200);
 assert.equal((await request('/api/state')).status,401);
 const r=await request('/');assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/login');
 assert.equal((await request('/api/login','POST',{password:'wrong'})).status,401);
});
test('login, cookie flags, CSP and no cache',async()=>{
 const r=await request('/api/login','POST',{password:'a-test-password-at-least-16-characters'});assert.equal(r.status,200);
 const set=r.headers.get('set-cookie');assert.match(set,/HttpOnly/);assert.match(set,/SameSite=Strict/);cookie=set.split(';')[0];
 const page=await request('/');assert.equal(page.status,200);assert.equal(page.headers.get('cache-control'),'no-store');assert.match(page.headers.get('content-security-policy'),/frame-ancestors 'none'/);
});
test('persisted state survives reload and concurrent stale write is rejected',async()=>{
 const old=await (await request('/api/state')).json();const changed=blank();changed.transactions.push({id:'test-1',date:'2026-11-22',amount:51.25,kind:'expense',category:'Jedzenie',note:'Test'});
 const saved=await request('/api/state','PUT',{state:changed,revision:old.revision});assert.equal(saved.status,200);
 const loaded=await (await request('/api/state')).json();assert.equal(loaded.state.transactions[0].amount,51.25);
 assert.equal((await request('/api/state','PUT',{state:blank(),revision:old.revision})).status,409);
 assert.equal((await (await request('/api/state')).json()).state.transactions.length,1);
});
test('server validation and request origin checks prevent malformed writes',async()=>{
 const data={state:{...blank(),transactions:[{amount:-1}]},revision};
 assert.equal((await request('/api/state','PUT',data)).status,400);
 assert.equal((await request('/api/state','PUT',{state:blank(),revision},cookie,{'X-Budget-Request':''})).status,403);
 assert.equal((await request('/api/state','PUT',{state:blank(),revision},cookie,{Origin:'https://untrusted.example'})).status,403);
 assert.equal(state.transactions.length,1);
});
test('logout invalidates session on the server',async()=>{
 assert.equal((await request('/api/logout','POST',{})).status,200);
 assert.equal((await request('/api/state')).status,401);
});
test('invalid dates and duplicate identifiers are rejected on imports',()=>{
 const t={id:'a',date:'2026-02-30',amount:10,kind:'expense',category:'Jedzenie',note:''};assert.throws(()=>validate({...blank(),transactions:[t]}));t.date='2026-11-22';assert.throws(()=>validate({...blank(),transactions:[t,t]}));
});
test('login is rate limited',async()=>{
 attempts=15;assert.equal((await request('/api/login','POST',{password:'wrong'})).status,429);
});
