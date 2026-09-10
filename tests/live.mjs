import assert from 'node:assert/strict';
import {PARTS,blankBuild} from '../src/game.js';
const base=process.env.TEST_API||'http://127.0.0.1:8788';
async function request(path,body,token){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();return {status:r.status,...d};}
const h=await request('/rooms',{});assert.ok(h.token,JSON.stringify(h));const code=h.snapshot.code;
const join=(name,invite)=>request('/rooms/'+code+'/join',{name,...(invite?{invite}:{})});
const cs=await Promise.all([join('Customer A'),join('Customer B')]);assert.ok(cs.every(x=>x.token));
const snap=async p=>(await request('/rooms/'+code+'/snapshot',null,p.token)).snapshot;
async function act(p,type,payload={},clientActionId=crypto.randomUUID()){for(let i=0;i<20;i++){const s=await snap(p),r=await request('/rooms/'+code+'/actions',{type,payload,clientActionId,expectedRevision:s.revision},p.token);if(r.status===409)continue;return r;}throw Error('Too many conflicts');}
const controller=new AbortController();const response=await fetch(base+'/rooms/'+code+'/events',{headers:{Authorization:'Bearer '+cs[1].token},signal:controller.signal});let received=[];const reading=(async()=>{const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='';try{while(true){const {done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});let at;while((at=buffer.indexOf('\n\n'))!==-1){const packet=buffer.slice(0,at);buffer=buffer.slice(at+2);const line=packet.split('\n').find(l=>l.startsWith('data: '));if(line)received.push(JSON.parse(line.slice(6)).snapshot);}}}catch(e){if(e.name!=='AbortError')throw e;}})();
const begin=Date.now();await act(h,'NEXT');await new Promise(r=>setTimeout(r,150));assert.equal(received.at(-1).phase,'reaction');console.log('Local action-to-observer <=',Date.now()-begin,'ms');
assert.equal((await act(cs[0],'NEXT')).status,400);
await act(h,'NEXT',{force:true});const ss=[];for(let i=0;i<3;i++)ss.push(await join('Seller '+i,h.invites[i]));assert.ok(ss.every(x=>x.token));assert.equal((await join('Stolen',h.invites[0])).status,400);
let v=await snap(ss[0]);assert.ok(!v.insights&&!v.roster);assert.ok(!JSON.stringify(v).includes('Customer A'));
const offers=PARTS.filter(p=>p.tier===1).map(p=>({part:p.id,price:p.cost+20,stock:1}));for(const s of ss)assert.equal((await act(s,'SAVE_SHOP',{offers})).status,200);
const ready=await snap(h);assert.equal(ready.counts.shopsReady,3);await act(h,'NEXT');
const lines=offers.map(o=>({seller:ss[0].snapshot.me.id,part:o.part}));const bought=await Promise.all(cs.map(p=>act(p,'BUY',{lines})));assert.equal(bought.filter(x=>x.status===200).length,1);assert.equal(bought.filter(x=>x.status===400).length,1);const winner=cs[bought.findIndex(x=>x.status===200)],loser=cs[bought.findIndex(x=>x.status===400)];
const id=crypto.randomUUID();assert.equal((await act(loser,'PASS',{},id)).status,200);assert.equal((await act(loser,'PASS',{},id)).duplicate,true);assert.equal((await snap(winner)).order.total,360);
await act(h,'NEXT');await act(h,'NEXT');assert.equal((await snap(ss[0])).insights.count,2);assert.equal((await snap(winner)).me.budget,600);assert.equal((await snap(winner)).me.done,false);
for(const s of ss)await act(s,'SAVE_SHOP',{offers});await act(h,'NEXT');for(const p of cs)await act(p,'PASS');await act(h,'NEXT');assert.equal((await snap(h)).phase,'final');await act(h,'PLAY_AGAIN');assert.equal((await snap(h)).phase,'lobby');controller.abort();await reading;console.log('PASS durable room join, roles, redaction, live propagation, concurrent stock, idempotency, both rounds and replay');
