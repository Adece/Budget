import {database} from './database.js';
import {createApp} from './server-core.js';
if(!process.env.DATABASE_URL||!process.env.APP_PASSWORD||process.env.APP_PASSWORD.length<16){console.error('Set DATABASE_URL and APP_PASSWORD (at least 16 characters).');process.exit(1)}
const db=await database(process.env.DATABASE_URL);
const app=await createApp({db,password:process.env.APP_PASSWORD,production:process.env.NODE_ENV==='production'});
app.listen(Number(process.env.PORT)||3000,'0.0.0.0',()=>console.log('Budget server ready.'));
async function stop(){app.close(async()=>{await db.close();process.exit(0)});setTimeout(()=>process.exit(1),10000).unref()}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
