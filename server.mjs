// LOCAL TEST SERVER ONLY: serves the page and runs the real Room game logic over real WebSockets.
import http from 'node:http';import crypto from 'node:crypto';import fs from 'node:fs';
const rt=globalThis.setTimeout;globalThis.setTimeout=(f,ms,...a)=>rt(f,ms>1000?ms/4:ms,...a); // phases 4x faster for testing
const {Room}=await import('./src/index.js');
const assets=(await import('./src/assets.js')).default;
const ACC={A:{uid:'uA',nick:'Ann',av:0,country:'MA'},B:{uid:'uB',nick:'Bob',av:2,country:'ES'}};
const rooms=new Map();const room=c=>{if(!rooms.has(c))rooms.set(c,new Room({},undefined));return rooms.get(c)};
const who=req=>ACC[(/(?:^|; )uid=([AB])/.exec(req.headers.cookie||'')||[])[1]];
const J=(res,o,s=200)=>{res.writeHead(s,{'content-type':'application/json'});res.end(JSON.stringify(o))};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://x'),p=u.pathname;
 if(p==='/'){res.writeHead(200,{'content-type':'text/html; charset=utf-8'});return res.end(fs.readFileSync('/home/claude/mw/public/index.html'))}
 let m=p.match(/^\/img\/([a-z0-9_]+)\.webp$/);if(m&&assets[m[1]]){res.writeHead(200,{'content-type':'image/webp','cache-control':'no-store'});return res.end(Buffer.from(assets[m[1]],'base64'))}
 if(p==='/api/config')return J(res,{cid:'x'});
 if(p==='/api/me'){const a=who(req);return a?J(res,{user:{id:a.uid,nick:a.nick,av:a.av,country:a.country,code:'CODE'+a.uid,xp:0,lvl:1,games:0,wins:0}}):J(res,{e:'auth'},401)}
 if(p.startsWith('/api/'))return J(res,{ok:1,user:{},missions:[],players:[],countries:[],friends:[],incoming:[],outgoing:[]});
 if(p==='/__roles'){const r=room(u.searchParams.get('code')),set=(uid,role)=>{const x=r.P.find(q=>q.uid===uid);if(!x)return;const o=r.P.find(q=>q.role===role&&q!==x);if(o)o.role=x.role;x.role=role};
   set('uA',u.searchParams.get('A'));if(u.searchParams.get('B'))set('uB',u.searchParams.get('B'));r.push();return J(res,{ok:1})}
 if(p==='/__state'){const r=room(u.searchParams.get('code'));return J(res,{ph:r.ph,day:r.day,act:r.act,roles:Object.fromEntries(r.P.map(q=>[q.id,q.role])),alive:Object.fromEntries(r.P.map(q=>[q.id,q.alive])),dead:r.dead})}
 res.writeHead(404);res.end()});
const frame=s=>{const b=Buffer.from(s),n=b.length;const h=n<126?Buffer.from([0x81,n]):n<65536?Buffer.from([0x81,126,n>>8,n&255]):(()=>{const x=Buffer.alloc(10);x[0]=0x81;x[1]=127;x.writeBigUInt64BE(BigInt(n),2);return x})();return Buffer.concat([h,b])};
server.on('upgrade',(req,socket)=>{const m=req.url.match(/^\/ws\/([A-Za-z0-9]{4,6})$/),a=who(req);if(!m||!a){socket.destroy();return}
 const key=req.headers['sec-websocket-key'];socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: '+crypto.createHash('sha1').update(key+'258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')+'\r\n\r\n');
 const r=room(m[1].toUpperCase()),ws={acct:{...a},send:s=>{try{socket.write(frame(s))}catch(e){}},close:()=>socket.end()};let buf=Buffer.alloc(0);
 socket.on('data',d=>{buf=Buffer.concat([buf,d]);for(;;){if(buf.length<2)return;let len=buf[1]&127,off=2;if(len===126){if(buf.length<4)return;len=buf.readUInt16BE(2);off=4}else if(len===127){if(buf.length<10)return;len=Number(buf.readBigUInt64BE(2));off=10}
   const masked=buf[1]&128;if(buf.length<off+(masked?4:0)+len)return;const mk=masked?buf.subarray(off,off+4):null;off+=masked?4:0;const pl=Buffer.from(buf.subarray(off,off+len));if(mk)for(let i=0;i<len;i++)pl[i]^=mk[i%4];
   const op=buf[0]&15;buf=buf.subarray(off+len);if(op===8){socket.end();return}if(op===1)try{r.msg(ws,pl.toString())}catch(e){}}});
 socket.on('close',()=>r.drop(ws));socket.on('error',()=>{})});
server.listen(8799,'127.0.0.1',()=>console.log('local server on 8799'));
