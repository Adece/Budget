import {test} from 'node:test';
import assert from 'node:assert/strict';
import '../public/budget.js';
import {validate,blank,categories} from '../model.js';
const {newPlan,normalizePlan,businessBreakdown,availableIncome,categoryStatus}=globalThis.Budget;
test('monthly gross revenue deducts VAT, 12 percent reserve and fixed fees once',()=>{
 const p={...newPlan(),revenue:12300,salary:5000};
 const b=businessBreakdown(p);assert.equal(b.net,10000);assert.equal(b.vat,2300);assert.equal(b.tax,1200);assert.equal(b.costs,1240);assert.equal(b.available,7560);assert.equal(availableIncome(p),12560);
 const twoPayments=businessBreakdown({...p,revenue:6150+6150});assert.deepEqual(twoPayments,b);
});
test('costs do not reduce the 12 percent reserve base and zero VAT is supported',()=>{
 const p={...newPlan(),revenue:10000,vatRate:0,company:1000};const b=businessBreakdown(p);assert.equal(b.vat,0);assert.equal(b.tax,1200);assert.equal(b.available,6560);
});
test('zero revenue still has monthly fees; disabling business removes them',()=>{
 assert.equal(businessBreakdown(newPlan()).available,-1240);
 assert.equal(availableIncome({...newPlan(),businessActive:false,salary:5000}),5000);
});
test('legacy plans preserve previous manual calculations until changed',()=>{
 const old={salary:5000,revenue:12300,vat:2300,tax:1000,zus:830,company:410,saving:0,fixed:Array(10).fill(0),weights:Array(10).fill(1),limits:Array(10).fill(0)};
 assert.equal(normalizePlan(old).autoBusiness,false);assert.equal(availableIncome(old),12760);assert.equal(businessBreakdown(old).accounting,0);
});
test('warnings use only domestic expenses in the same month and category',()=>{
 const p=newPlan();p.limits[1]=100;const state={...blank(),plans:{'2026-11':p},transactions:[
 {kind:'expense',category:'Jedzenie',amount:80,date:'2026-11-22'},
 {kind:'expense',category:'Jedzenie',amount:50,date:'2026-10-22'},
 {kind:'company',category:'Jedzenie',amount:500,date:'2026-11-22'},
 {kind:'expense',category:'Transport',amount:20,date:'2026-11-22'}]};
 assert.equal(categoryStatus(state,'2026-11','Jedzenie',categories).remaining,20);
 const projection=categoryStatus(state,'2026-11','Jedzenie',categories,30);assert.equal(projection.remaining,-10);assert.equal(projection.over,true);
 assert.equal(categoryStatus(state,'2026-11','Jedzenie',categories,20).over,false);assert.equal(categoryStatus(state,'2026-11','Jedzenie',categories,20).exhausted,true);
 state.transactions=[];assert.equal(categoryStatus(state,'2026-11','Jedzenie',categories).remaining,100);
 assert.equal(categoryStatus(state,'2026-12','Jedzenie',categories),null);
});
test('zero category limit warns for any positive expense',()=>{
 const state={...blank(),plans:{'2026-11':newPlan()}};assert.equal(categoryStatus(state,'2026-11','Inne',categories,0.01).over,true);
});
test('server accepts new configuration, legacy backups and rejects invalid rates',()=>{
 const p=newPlan();assert.equal(validate({...blank(),plans:{'2026-11':p}}).plans['2026-11'].accounting,360);
 assert.throws(()=>validate({...blank(),plans:{'2026-11':{...p,vatRate:101}}}));assert.throws(()=>validate({...blank(),plans:{'2026-11':{...p,office:-1}}}));assert.throws(()=>validate({...blank(),plans:{'2026-11':{...p,autoBusiness:'true'}}}));
 const {accounting,office,vatRate,taxRate,autoBusiness,businessActive,...old}=p;assert.doesNotThrow(()=>validate({...blank(),plans:{'2026-11':old}}));
});
