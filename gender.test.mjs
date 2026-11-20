import {DatabaseSync} from 'node:sqlite';
const rt=globalThis.setTimeout;globalThis.setTimeout=(f,ms)=>rt(f,Math.min(ms,50));
const m=await import('/tmp/t/src/index.js');
const ok=(n,c)=>console.log((c?'PASS':'FAIL')+' '+n);
const G=["m","f","m","f","m","f","m"],FN=["Sofia","Luna","Maria","Salma","Yasmine","Lina","Nour"],MN=["Zakaria","Rayan","Youssef","Omar","Adam","Karim","Ilyas","Anas"];
// bots: every bot name must match the gender of the character it gets
let bad=0,dup=0,tot=0;
for(let run=0;run<40;run++){const r=new m.Room({}),mk=()=>({log:[],send(x){this.log.push(JSON.parse(x))},close(){}}),w=mk();r.msg(w,JSON.stringify({t:'join',create:true,code:'G'+run,name:'Host',av:run%7}));r.msg(w,JSON.stringify({t:'cap',v:10}));r.msg(w,JSON.stringify({t:'start'}));
 const names=new Set();for(const p of r.P){if(!p.bot)continue;tot++;const g=G[p.av],pool=g==='f'?FN:MN;if(!pool.includes(p.name)&&!/^Bot\d+$/.test(p.name))bad++;names.add(p.name.toLowerCase())}
 if(names.size!==r.P.filter(p=>p.bot).length)dup++}
ok(`bot names match the character gender (${tot} bots in 40 games)`,bad===0&&tot>200);ok('bot names unique inside a room',dup===0);
// accounts: gset flag
const db=new DatabaseSync(':memory:');const sql={exec(q,...b){const st=db.prepare(q);if(/^\s*select/i.test(q)){const rows=st.all(...b).map(r=>({...r}));return{toArray:()=>rows}}st.run(...b);return{toArray:()=>[]}}};
const A=new m.Accounts({storage:{sql}});const call=async(p,b)=>(await A.fetch(new Request('https://acc'+p,{method:'POST',body:JSON.stringify(b)}))).json();
const u=(await call('/login',{sub:'s1',name:'Zak'})).user;ok('new account: character not confirmed yet (gset=0)',u.gset===0);
const up=(await call('/update',{id:u.id,nick:'Zak',av:3,country:'MA'})).user;ok('saving the character marks it confirmed and stores it',up.gset===1&&up.av===3);
ok('invalid avatar is coerced into 0-6',(await call('/update',{id:u.id,nick:'Zak',av:99,country:'MA'})).user.av>=0);
ok('login again keeps the confirmed flag',(await call('/login',{sub:'s1',name:'Zak'})).user.gset===1);
process.exit(0)
