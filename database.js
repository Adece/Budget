import pg from 'pg';
import {blank} from './model.js';
export async function database(url){
  const pool=new pg.Pool({connectionString:url,max:5,connectionTimeoutMillis:10000,idleTimeoutMillis:30000});
  pool.on('error',()=>console.error('Database connection interrupted.'));
  await pool.query(`CREATE TABLE IF NOT EXISTS budget_state (id integer PRIMARY KEY CHECK(id=1),revision integer NOT NULL DEFAULT 0,data jsonb NOT NULL);
    CREATE TABLE IF NOT EXISTS budget_sessions (token_hash text PRIMARY KEY,expires_at timestamptz NOT NULL);
    CREATE TABLE IF NOT EXISTS budget_login_limits (minute bigint PRIMARY KEY,attempts integer NOT NULL);`);
  await pool.query('INSERT INTO budget_state(id,data) VALUES(1,$1) ON CONFLICT(id) DO NOTHING',[JSON.stringify(blank())]);
  return {
    async health(){await pool.query('SELECT 1')},
    async load(){const {rows}=await pool.query('SELECT revision,data AS state FROM budget_state WHERE id=1');return rows[0]},
    async save(state,revision){const {rows}=await pool.query('UPDATE budget_state SET data=$1,revision=revision+1 WHERE id=1 AND revision=$2 RETURNING revision',[JSON.stringify(state),revision]);return rows[0]?.revision??null},
    async loginAllowed(){const minute=Math.floor(Date.now()/60000);const {rows}=await pool.query('INSERT INTO budget_login_limits(minute,attempts) VALUES($1,1) ON CONFLICT(minute) DO UPDATE SET attempts=budget_login_limits.attempts+1 RETURNING attempts',[minute]);await pool.query('DELETE FROM budget_login_limits WHERE minute<$1',[minute-10]);return rows[0].attempts<=15},
    async sessionCreate(hash,expires){await pool.query('DELETE FROM budget_sessions WHERE expires_at<NOW()');await pool.query('INSERT INTO budget_sessions(token_hash,expires_at) VALUES($1,$2)',[hash,expires])},
    async sessionValid(hash){const {rowCount}=await pool.query('SELECT 1 FROM budget_sessions WHERE token_hash=$1 AND expires_at>NOW()',[hash]);return rowCount===1},
    async sessionDelete(hash){await pool.query('DELETE FROM budget_sessions WHERE token_hash=$1',[hash])},
    close:()=>pool.end()
  };
}
