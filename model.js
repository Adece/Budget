export const categories=['Mieszkanie','Jedzenie','Transport','Zdrowie','Koty','Subskrypcje','Rozrywka','Zakupy','Podróże','Inne'];
export const blank=()=>({version:1,plans:{},transactions:[],snapshots:[]});
const numeric=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1e12;
const text=s=>typeof s==='string'&&s.length<=500;
const date=s=>typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
const unique=a=>new Set(a.map(x=>x.id)).size===a.length;
export function validate(s){
  if(!s||s.version!==1||!s.plans||typeof s.plans!=='object'||Array.isArray(s.plans)||!Array.isArray(s.transactions)||!Array.isArray(s.snapshots)||s.transactions.length>100000||s.snapshots.length>10000)throw Error('Nieprawidłowy format danych.');
  for(const [m,p]of Object.entries(s.plans)){
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)||!p||!['salary','revenue','company','tax','zus','vat','saving'].every(k=>numeric(p[k]))||!['fixed','weights','limits'].every(k=>Array.isArray(p[k])&&p[k].length===categories.length&&p[k].every(numeric)))throw Error('Nieprawidłowy plan miesiąca.');
  }
  for(const t of s.transactions)if(!t||!date(t.date)||!numeric(t.amount)||t.amount<=0||!['expense','salary','revenue','company','tax','zus','vat','transfer'].includes(t.kind)||!text(t.id)||!t.id||!text(t.note)||!categories.includes(t.category))throw Error('Nieprawidłowa transakcja.');
  for(const w of s.snapshots)if(!w||!date(w.date)||!['cash','invest','goods','debt','contributions'].every(k=>numeric(w[k]))||!text(w.id)||!w.id)throw Error('Nieprawidłowy stan majątku.');
  if(!unique(s.transactions)||!unique(s.snapshots)||new Set(s.snapshots.map(s=>s.date)).size!==s.snapshots.length)throw Error('Powtórzone wpisy.');
  return {version:1,plans:s.plans,transactions:s.transactions,snapshots:s.snapshots};
}
