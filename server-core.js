import http from 'node:http';
import {randomBytes,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {readFile} from 'node:fs/promises';
import {validate} from './model.js';
const derive=promisify(scrypt), hash=s=>createHash('sha256').update(s).digest('hex');
const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body))};
async function body(req){let chunks=[],size=0;for await(const c of req){size+=c.length;if(size>5*1024*1024)throw Object.assign(Error('Dane przekraczają limit 5 MB.'),{status:413});chunks.push(c)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw Object.assign(Error('Nieprawidłowy JSON.'),{status:400})}}
export async function createApp({db,password,production=true}){
  const salt=randomBytes(16),expected=await derive(password,salt,64);
  const files=new Map();for(const [route,file,type]of [['/','index.html','text/html'],['/login','login.html','text/html'],['/app.js','app.js','text/javascript'],['/login.js','login.js','text/javascript'],['/style.css','style.css','text/css']])files.set(route,{data:await readFile(new URL('./public/'+file,import.meta.url)),type:type+'; charset=utf-8'});
  const cookie=(token,maxAge=604800)=>`budget_session=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${production?'; Secure':''}`;
  return http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');
    try{
      const route=new URL(req.url,'http://localhost').pathname;
      if(route==='/health'&&req.method==='GET'){await db.health();return json(res,200,{ok:true})}
      if(!['GET','POST','PUT'].includes(req.method))return json(res,405,{error:'Niedozwolona metoda.'});
      if(['POST','PUT'].includes(req.method)){
        if(req.headers['x-budget-request']!=='1'||!req.headers['content-type']?.startsWith('application/json'))return json(res,403,{error:'Nieprawidłowe żądanie.'});
        if(req.headers.origin){const origin=new URL(req.headers.origin);if(origin.host!==req.headers.host||origin.protocol!==(production?'https:':'http:'))return json(res,403,{error:'Nieprawidłowe źródło żądania.'})}
      }
      const token=/(?:^|;\s*)budget_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];
      if(route==='/api/login'&&req.method==='POST'){
        if(!await db.loginAllowed())return json(res,429,{error:'Za dużo prób. Spróbuj za minutę.'});
        const data=await body(req);if(typeof data.password!=='string'||data.password.length>1000)return json(res,400,{error:'Nieprawidłowe hasło.'});
        if(!timingSafeEqual(await derive(data.password,salt,64),expected))return json(res,401,{error:'Nieprawidłowe hasło.'});
        if(token)await db.sessionDelete(hash(token));
        const session=randomBytes(32).toString('hex');await db.sessionCreate(hash(session),new Date(Date.now()+604800000));res.setHeader('Set-Cookie',cookie(session));return json(res,200,{ok:true});
      }
      const publicFile=['/login','/login.js','/style.css'].includes(route);
      if(publicFile&&req.method==='GET'){const f=files.get(route);res.writeHead(200,{'Content-Type':f.type});return res.end(f.data)}
      if(!token||!await db.sessionValid(hash(token))){if(route.startsWith('/api/'))return json(res,401,{error:'Zaloguj się ponownie.'});res.writeHead(302,{Location:'/login'});return res.end()}
      if(route==='/api/logout'&&req.method==='POST'){await db.sessionDelete(hash(token));res.setHeader('Set-Cookie',cookie('',0));return json(res,200,{ok:true})}
      if(route==='/api/state'&&req.method==='GET')return json(res,200,await db.load());
      if(route==='/api/state'&&req.method==='PUT'){
        const data=await body(req);if(!Number.isInteger(data.revision)||data.revision<0)return json(res,400,{error:'Nieprawidłowa wersja danych.'});
        let state;try{state=validate(data.state)}catch(e){return json(res,400,{error:e.message})}
        const revision=await db.save(state,data.revision);if(revision===null)return json(res,409,{error:'Dane zmieniły się w innej karcie lub na innym urządzeniu. Odśwież aplikację przed ponownym wprowadzeniem zmiany.'});return json(res,200,{revision});
      }
      if(req.method==='GET'&&files.has(route)){const f=files.get(route);res.writeHead(200,{'Content-Type':f.type});return res.end(f.data)}
      return json(res,404,{error:'Nie znaleziono.'});
    }catch(e){if(!res.headersSent)json(res,e.status||503,{error:e.status?e.message:'Nie udało się połączyć z bazą. Spróbuj ponownie.'});else res.end()}
  });
}
