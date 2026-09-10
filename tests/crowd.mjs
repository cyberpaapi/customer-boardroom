import assert from 'node:assert/strict';
const base=process.env.TEST_API||'http://127.0.0.1:8788';
async function req(path,body,token){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:r.status,...await r.json()};}
const h=await req('/rooms',{});assert.ok(h.token);const code=h.snapshot.code;const start=Date.now();
const players=await Promise.all(Array.from({length:45},(_,i)=>req('/rooms/'+code+'/join',{name:'Crowd '+i})));
assert.ok(players.every(p=>p.token),JSON.stringify(players.filter(p=>!p.token)));const snap=(await req('/rooms/'+code+'/snapshot',null,h.token)).snapshot;
assert.equal(snap.counts.customers,45);assert.equal(new Set(players.map(p=>p.id)).size,45);
await req('/rooms/'+code+'/actions',{type:'FORCE_END',payload:{},expectedRevision:snap.revision,clientActionId:crypto.randomUUID()},h.token);
console.log('PASS: 45 concurrent joins, 45 distinct seats, no class-size cap. Duration',Date.now()-start,'ms');
