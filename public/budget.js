(function(root){
  'use strict';
  const round=n=>Math.round((n+Number.EPSILON)*100)/100;
  function newPlan(){return {salary:0,revenue:0,company:0,tax:0,zus:830,vat:0,saving:0,fixed:Array(10).fill(0),weights:Array(10).fill(1),limits:Array(10).fill(0),autoBusiness:true,businessActive:true,accounting:360,office:50,vatRate:23,taxRate:12}}
  function normalizePlan(p){return p?{...newPlan(),...p,autoBusiness:p.autoBusiness===true}:newPlan()}
  function businessBreakdown(input){const p=normalizePlan(input);if(p.autoBusiness&&!p.businessActive)return {gross:0,net:0,vat:0,tax:0,zus:0,accounting:0,office:0,extra:0,costs:0,available:0};
    const net=p.autoBusiness?round(p.revenue/(1+p.vatRate/100)):round(p.revenue-p.vat),vat=p.autoBusiness?round(p.revenue-net):p.vat,tax=p.autoBusiness?round(net*p.taxRate/100):p.tax;
    const accounting=p.autoBusiness?p.accounting:0,office=p.autoBusiness?p.office:0,costs=round(p.zus+accounting+office+p.company);
    return {gross:p.revenue,net,vat,tax,zus:p.zus,accounting,office,extra:p.company,costs,available:round(net-tax-costs)};
  }
  const availableIncome=p=>round(p.salary+businessBreakdown(p).available);
  function categoryStatus(state,month,category,categories,added=0){const p=state.plans[month],i=categories.indexOf(category);if(!p||i<0)return null;
    const spent=round(state.transactions.filter(t=>t.kind==='expense'&&t.category===category&&t.date.slice(0,7)===month).reduce((s,t)=>s+t.amount,0)+added),limit=p.limits[i],remaining=round(limit-spent);
    return {category,spent,limit,remaining,over:remaining<0,exhausted:remaining===0};
  }
  root.Budget={round,newPlan,normalizePlan,businessBreakdown,availableIncome,categoryStatus};
})(globalThis);
