/* ===== STAGE 2: full-screen lobby art + day/night table scene with animated sunrise/sunset ===== */
Object.assign(T.ar,{boy:"ولد",girl:"بنت",pickch:"اختر شخصيتك",chnote:"الشخصية تظهر على الطاولة أمام الجميع.",vtitle:"التصويت",tleft:"الوقت",pickv:"اختر من تشكّ فيه",lng:"اللغة",myrole:"بطاقتي",leaveq:"هل تريد مغادرة الغرفة؟",mtl:"تتجدد المهام بعد"});
Object.assign(T.en,{boy:"Boy",girl:"Girl",pickch:"Choose your character",chnote:"Your character is shown at the table to everyone.",vtitle:"Voting",tleft:"Time left",pickv:"Pick who you suspect",lng:"Language",myrole:"My card",leaveq:"Leave the room?",mtl:"Missions reset in"});
const AW=941,AH=1672,AV="?v=2",AV3="?v=3",pxy=(x,y)=>`left:${(x/AW*100).toFixed(2)}%;top:${(y/AH*100).toFixed(2)}%`,rct=(x,y,w,h)=>pxy(x,y)+`;width:${(w/AW*100).toFixed(2)}%;height:${(h/AH*100).toFixed(2)}%`;
const hz=(x,y,w,h,f)=>`<button class="hz" style="${rct(x,y,w,h)}" onclick="${f}"></button>`;
/* hit box x,y,w,h and name-chip centre for each character seated at the table (same cast in the day and night art) */
const SEAT=[[30,1040,370,360,200,1345],[0,735,215,390,150,1050],[120,625,210,240,225,890],[350,610,240,230,470,865],[600,620,250,250,735,895],[745,765,196,385,790,1075],[520,1070,421,360,730,1375]];
AVN.forEach((n,k)=>{IMG["f_"+n]="/img/cf"+k+".webp"+AV3}); /* every avatar in the UI now shows the new characters */
const faceOf=a=>IMG["f_"+AVN[a||0]];
/* seat rectangles (art coordinates) where each table character stands; same slot order as SEAT */
const CHR=[[10,1070,390,330],[0,815,195,255],[125,600,215,255],[362,590,215,255],[600,600,215,255],[746,815,195,255],[540,1070,401,330]]; /* laid out so no two characters overlap */
/* soft dark veils sit BEHIND each character and tone down the figure painted in the background art */
const VB=[[0,1030,430,420],[0,720,235,400],[112,602,236,270],[350,592,244,262],[598,602,236,270],[720,755,221,400],[500,1050,441,420]];
const VEILS=`<div class="veils">${VB.map(([x,y,w,h])=>`<i style="${rct(x,y,w,h)}"></i>`).join("")}</div>`;
const chOrder=()=>{const L=G.P,mi=Math.max(0,L.findIndex(p=>p.me));return L.map((_,i)=>L[(mi+i)%L.length]).slice(0,CHR.length)};
const chEl=(p,i,look)=>`<div class="mafia-player ${!p.a?"dead":look=="day"?"awake":"sleeping"}" data-player-id="${p.id}" style="${rct(...CHR[i])}"><img src="/img/ch${(p.av||0)%7}.webp${AV3}" alt="" decoding="async"></div>`;
function charsHTML(look){return chOrder().map((p,i)=>chEl(p,i,look)).join("")}
function charsSync(){const c=$("#chars");if(!c)return;const o=chOrder(),look=c.classList.contains("night")?"night":"day";o.forEach((p,i)=>{let e=c.querySelector(`[data-player-id="${CSS.escape(String(p.id))}"]`);if(!e){c.insertAdjacentHTML("beforeend",chEl(p,i,look));e=c.lastElementChild;if(c.dataset.ready){e.classList.add("entering");setTimeout(()=>e.classList.remove("entering"),900)}}e.classList.remove("leaving");e.style.cssText=rct(...CHR[i]);e.classList.toggle("dead",!p.a)});[...c.children].forEach(e=>{if(!o.some(p=>String(p.id)===e.dataset.playerId)&&!e.classList.contains("leaving")){e.classList.add("leaving");setTimeout(()=>{if(e.classList.contains("leaving"))e.remove()},650)}});c.dataset.ready=1}
/* PRIVATE night motion: only the acting player (and, for the Mafia, the teammates they already know) wake on THIS device. Nothing about who acts is ever sent over the network. */
function nightDrive(){const me=G.me;if(S.scr!="night"||!me||!me.a||!ACT[me.role]||G.pick!=null)return;const key="n"+G.d;if(NET.mw===key)return;NET.mw=key;const ids=[me.id,...(NET.st.mates||[])];NET.mwIds=ids;ids.forEach((id,i)=>setTimeout(async()=>{if(NET.mw!==key)return;await MafiaMotion.wakePlayer(id);if(NET.mw===key)MafiaMotion.startAction(id)},1200+i*350))}
function retireNight(){const ids=NET.mwIds;if(!ids)return;NET.mwIds=null;ids.forEach(id=>MafiaMotion.returnToSleep(id))}
function profHUD(rect){const a=NET.acct||{},lv=a.lvl||1,b=lvB(lv),n=lvN(lv),xp=a.xp||0,pct=Math.max(0,Math.min(100,Math.round((xp-b)/(n-b)*100)));
return `<div class="gp prof" style="${rect}"><div class="av2"><img src="${faceOf(NET.av)}" alt=""></div><div class="grow"><b class="pn">${esc(NET.nick||"Zakaria")} ${a.country?flag(a.country):"👑"}</b><div class="lv">⭐ Lv.${lv}</div><div class="xpb"><i style="width:${pct}%"></i><span dir="ltr">${xp-b} / ${n-b}</span></div></div></div>`}
function curHUD(){const a=NET.acct||{};return `<div class="gp cur2" style="${rct(452,26,300,84)}">⭐ ${a.xp||0}</div><div class="gp cur2" style="${rct(758,26,0,0)}"></div><div class="gp cur2 w2" style="${rct(452,26,0,0)}"></div>`}
function stg(look,inner,cls,chars){return `<div class="stg ${cls||""} ${look=="day"?"d":""}" id="stg"><div class="sk sn"></div><div class="sk sd"></div><div class="art"><div class="bgw"><img class="bg n" src="/img/night.webp${AV}" alt=""><img class="bg d" src="/img/day.webp${AV}" alt=""></div>${chars?VEILS:""}${chars||""}<div class="mist"></div><div class="cel"><img class="moon" src="/img/moon.webp${AV}" alt=""><div class="sun"></div></div><div class="dawn"></div>${inner}</div></div>`}
/* ---------- LOBBY ---------- */
function mtLeft(){const d=new Date(),n=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth(),d.getUTCDate()+1)),s=Math.floor((n-d)/1000),f=x=>String(x).padStart(2,"0");return f(Math.floor(s/3600))+":"+f(Math.floor(s%3600/60))+":"+f(s%60)}
V.lobby=()=>{const a=NET.acct||{};
return `<div class="stg lob" id="stg"><div class="sk sn"></div><div class="art"><div class="bgw"><img class="bg" src="/img/lobby.webp${AV}" alt=""></div>
${profHUD(rct(12,12,436,214))}<div class="gp cur2" style="${rct(450,20,298,96)}">⭐ ${a.xp||0}</div><div class="gp cur2" style="${rct(752,20,94,96)}">🏆 ${a.wins||0}</div>
<div class="gp mt" style="${rct(30,372,152,46)}"><b id="mt">${mtLeft()}</b></div>
<button class="gp fr" style="${rct(24,868,138,70)}" onclick="NET.acct?go('friends'):toast(t('needacct'))">👥 ${t("friends")}</button>
${hz(848,28,82,82,"sets()")}${hz(650,165,270,260,"setup('join')")}${hz(170,1005,600,170,"sfx('tap');setup('create')")}${hz(255,1190,430,105,"sfx('tap');setup('create')")}
${hz(22,250,160,170,"NET.acct?go('prof'):toast(t('needacct'))")}${hz(22,435,155,140,"go('rank')")}${hz(22,575,150,125,"toast(t('soon'))")}${hz(22,720,150,125,"toast(t('soon'))")}
${hz(10,1500,172,150,"toast(t('soon'))")}${hz(190,1500,180,150,"rolesM()")}${hz(380,1480,185,170,"go('prof')")}${hz(580,1500,170,150,"toast(t('soon'))")}${hz(765,1500,170,150,"NET.acct?(confirm(t('signout')+'?')&&outA()):0")}
</div></div>`};
B.lobby=()=>{TM.push(setInterval(()=>{const e=$("#mt");if(e)e.textContent=mtLeft()},1000))};
/* ---------- GAME TABLE ---------- */
const spkOn=id=>NET.spk&&NET.spk[id]&&Date.now()-NET.spk[id]<3500;
function seatsHTML(){const L=G.P,mi=Math.max(0,L.findIndex(p=>p.me)),ord=L.map((_,i)=>L[(mi+i)%L.length]),night=S.scr=="night",vote=S.scr=="day"&&G.ph=="v";
const tgs=new Set(night&&G.me.a&&ACT[G.me.role]?tgt().map(p=>p.id):vote&&G.me.a?alive().filter(p=>!p.me).map(p=>p.id):[]),sel=night?G.pick:vote?G.vote:null;let h="";
const chip=(p,st,i)=>`<div class="nm${p.me?" me":""}${!p.a?" x":""}${spkOn(p.id)?" sp":""}${p.conn?"":" off"}" style="${st};--i:${i}"><i><img src="${faceOf(p.av)}" alt=""></i><b>${flag(p.c)}${p.n}</b>${p.bot?"<em>🤖</em>":""}${night&&p.a&&!p.me?"<em>💤</em>":""}${S.scr=="wait"?`<em>${p.host?"👑":p.ready?"✅":"⏳"}</em>`:""}${spkOn(p.id)?"<u><s></s><s></s><s></s></u>":""}</div>`;
const vb={};Object.entries(G.votes||{}).forEach(([v,tg])=>{(vb[tg]=vb[tg]||[]).push(v)});
const badge=(p,x,y,w)=>{const vs=vb[p.id];if(!vs||!vs.length||!(S.scr=="day"&&(G.ph=="v"||G.ph=="e")))return"";return `<div class="vb${vs.length>3?" many":""}" style="${pxy(x+w/2,y)}"><b>🗳 ${vs.length}</b><span>${vs.slice(0,4).map(id=>{const q=G.P.find(z=>z.id==id);return q?`<em><img src="${faceOf(q.av)}" alt="">${q.n}</em>`:""}).join("")}${vs.length>4?`<em>+${vs.length-4}</em>`:""}</span></div>`};
SEAT.forEach(([x,y,w,hh,cx,cy],i)=>{const p=ord[i];if(!p){h+=`<div class="ht em" style="${rct(x,y,w,hh)}"><span>＋</span></div>`;return}
h+=`<button class="ht${!p.a?" dd":""}${tgs.has(p.id)?" tg":""}${p.id===sel?" sl":""}" style="${rct(x,y,w,hh)}" onclick="seat('${p.id}')">${!p.a?"<span>✝</span>":""}</button>`+chip(p,pxy(cx,cy),i)+badge(p,x,y,w)});
const extra=ord.slice(SEAT.length);if(extra.length)h+=`<div class="bench" style="${rct(250,1296,440,34)}">${extra.map(p=>`<button class="bn2${p.id===sel?" sl":""}${!p.a?" x":""}" onclick="seat('${p.id}')"><img src="${faceOf(p.av)}" alt="">${p.n}${vb[p.id]?` 🗳${vb[p.id].length}`:""}</button>`).join("")}</div>`;return h}
function hudGame(){const me=G.me,night=S.scr=="night",ph=G.ph,act=ACT[me.role],al=G.P.filter(p=>p.a).length;
const title=night?t("night")+" "+G.d:ph=="v"?t("vtitle"):ph=="e"?t("elim"):t("day")+" "+G.d,sub=night?(me.a?(act?t(act):t("sleep")):t("out")):ph=="a"?t("disc"):ph=="v"?(me.a?t("pickv"):t("out")):"";
return profHUD(rct(14,14,372,150))+`<div class="gp cur2" style="${rct(358,16,290,96)}">⭐ ${(NET.acct||{}).xp||0}</div><div class="gp cur2" style="${rct(652,16,194,96)}">🏆 ${(NET.acct||{}).wins||0}</div>${hz(848,28,82,82,"sets()")}
<div class="gp ph" style="${rct(18,166,350,122)}"><span class="ic2">${night?"🌙":"☀️"}</span><div class="grow"><b>${title}</b><small>${sub}</small></div></div>
<div class="gp tm" style="${rct(700,160,226,118)}"><span class="ic2">⌛</span><div class="grow"><small>${t("tleft")}</small><b id="tm" class="big2"></b></div></div>
<button class="gp chb" style="${rct(16,1392,546,98)}" onclick="chatOpen()">💬 <span>${t("typ")}</span></button>
${!night&&ph=="a"&&me.a?`<button class="gp skp" style="${rct(568,1398,128,88)}" onclick="netSend({t:'skip'});sfx('tap')">⏭ ${(NET.st&&NET.st.sk)||0}</button>`:""}
<div class="gp cnt" style="${rct(704,1398,216,88)}">👥 ${al}/${G.P.length}</div>
<div class="gp nav2" style="${rct(6,1488,929,166)}"><button onclick="showRole()">🎴<small>${t("myrole")}</small></button><button onclick="chatOpen()">💬<small>${t("chat")}</small></button><button onclick="mute()">🔊<small>${t("mute")}</small></button><button onclick="if(confirm(t('leaveq')))netLeave()">🚪<small>${t("leave")}</small></button></div>`}
function annHTML(){const s=NET.st;if(!s)return"";let h="";
if(S.scr=="night"){const i=s.insp;if(i)h=`<b>${i.role?"🔮 "+rn(i.role):i.m?"🔴 "+t("isM"):"🟢 "+t("notM")}</b>`}
else if(G.ph=="a")h=G.dead.length?G.dead.map(p=>`<b>${p.n} ${t("found")}</b><br>${t("wasA")} ${RO[p.role][0]} ${rn(p.role)}`).join("<hr>"):`<b>${t("nobody")}</b>`;
else if(G.ph=="e"){const e=G.el;h=e?`<b>${e.n} ${t("elim")}</b><br>${t("wasA")} ${RO[e.role][0]} ${rn(e.role)}`:`<b>${t("noelim")}</b>`}
return h?`<div class="ann${G.ph=="a"&&S.scr=="day"?" fade":""}" style="${rct(120,360,700,170)}">${h}</div>`:""}
function showRole(){const r=G.me.role;modal(`<div class="c"><img class="ra rc" style="max-width:240px;margin:auto" src="${IMG[r]}" alt="${rn(r)}"><p>${t("d_"+r)}</p></div>`)}
const lookOf=()=>S.scr=="night"||S.scr=="reveal"?"night":"day";
function gameStage(){const look=lookOf(),from=NET.look||look;return stg(from,`<div id="seats">${seatsHTML()}</div><div id="hud">${hudGame()}</div><div id="ann">${annHTML()}</div>`,"game",`<div class="mafia-scene ${from=="day"?"day":"night"}" id="chars">${charsHTML(from)}</div>`)}
V.night=()=>gameStage();V.day=()=>gameStage();
function fillTm(){const e=$("#tm");if(!e||!NET.st)return;const r=Math.max(0,Math.ceil((NET.st.dl-(Date.now()+NET.off))/1000));e.textContent=r>=60?Math.floor(r/60)+":"+String(r%60).padStart(2,"0"):r}
function stageRefresh(){const a=$("#seats"),h=$("#hud"),n=$("#ann");if(!a)return;a.innerHTML=seatsHTML();h.innerHTML=hudGame();n.innerHTML=annHTML();fillTm();charsSync();nightDrive()}
function lookTo(look){const s=$("#stg");NET.look=look;if(!s)return;const to=look=="day";if(s.classList.contains("d")===to)return;s.classList.remove("sw","du","wk");void s.offsetWidth;s.classList.toggle("d",to);s.classList.add(to?"sw":"du");if(to){s.classList.add("wk");NET.mw=null;NET.mwIds=null;MafiaMotion.sunrise()}else{setTimeout(()=>MafiaMotion.sleepAll(),1500)}setTimeout(()=>s&&s.classList.remove("sw","du","wk"),5200)}
B.night=()=>{tick();requestAnimationFrame(()=>requestAnimationFrame(()=>lookTo(lookOf())));setTimeout(nightDrive,300)};B.day=B.night;
function refreshSeats(){const a=$("#seats");if(a)a.innerHTML=seatsHTML();const n=$("#ann");if(n)n.innerHTML=annHTML()}
function pk(id){if(!tgt().some(q=>q.id==id))return;G.pick=id;netSend({t:"act",target:id});sfx("tap");refreshSeats();retireNight()}
function seat(id){if(S.scr=="night")pk(id);else if(S.scr=="day"&&G.ph=="v"&&G.me.a){const p=G.P.find(q=>q.id==id);if(p&&p.a&&!p.me){G.vote=id;netSend({t:"vote",target:id});sfx("vote");refreshSeats()}}}
/* splash uses the night scene */
V.splash=()=>`<div class="sp" style="background-image:url(/img/night.webp${AV});filter:blur(5px) brightness(.7)"></div><div class="mid sm"><div class="crown">${CR}</div><div class="logo">MAFIA<br>WORLD</div><div class="c" style="opacity:.85;letter-spacing:2px">Play • Strategize • Win</div><div class="bar"><i></i></div><small>${t("loading")}</small></div>`;
/* ---------- WAITING ROOM on the table: a character appears for each player who joins and leaves with them ---------- */
function hudWait(){const d=NET.st;if(!d)return"";const me=d.players.find(p=>p.id==d.you)||{},host=d.host==d.you,n=d.players.length,a=NET.acct||{};
return profHUD(rct(14,14,372,150))+`<div class="gp cur2" style="${rct(358,16,290,96)}">⭐ ${a.xp||0}</div><div class="gp cur2" style="${rct(652,16,194,96)}">🏆 ${a.wins||0}</div>${hz(848,28,82,82,"sets()")}
<button class="gp ph" style="${rct(18,166,350,122)}" onclick="inv()"><span class="ic2">🚪</span><div class="grow"><b>${t("wr")}</b><small dir="ltr" style="font-size:3.6cqw">${esc(S.code||NET.code)}  ⧉</small></div></button>
<div class="gp tm" style="${rct(700,160,226,118)}"><span class="ic2">👥</span><div class="grow"><small>${t("players2")}</small><b class="big2">${n}/${d.cap}</b></div></div>
<button class="gp chb" style="${rct(16,1392,546,98)}" onclick="chatOpen()">💬 <span>${t("typ")}</span></button>
<div class="gp cnt" style="${rct(704,1398,216,88)}">👥 ${n}/${d.cap}</div>
<div class="gp nav2" style="${rct(6,1488,929,166)}"><button onclick="inv(1)">📤<small>${t("share")}</small></button><button onclick="roomSettings()">⚙️<small>${t("sets")}</small></button><button onclick="${host?"netSend({t:'start'})":"netSend({t:'ready',v:"+(!me.ready)+"})"}" style="color:#7dffa0">${host?"▶":me.ready?"✖":"✅"}<small>${host?t("start"):me.ready?t("notReady"):t("ready")}</small></button><button onclick="if(confirm(t('leaveq')))netLeave()">🚪<small>${t("leave")}</small></button></div>`}
V.wait=()=>{NET.look="day";return stg("day",`<div id="seats">${seatsHTML()}</div><div id="hud">${hudWait()}</div>`,"game wait",`<div class="mafia-scene day" id="chars">${charsHTML("day")}</div>`)};
function waitRefresh(){const a=$("#seats"),h=$("#hud");if(!a)return;a.innerHTML=seatsHTML();h.innerHTML=hudWait();charsSync()}
function roomSettings(){modal('<div id="w"></div>');wUpdOld()}
function wUpd(){waitRefresh();wUpdOld()}
B.wait=()=>{wUpd()};
const _go2=go;go=function(n){_go2(n);document.body.classList.toggle("stgon",["lobby","night","day","wait"].includes(n))};

/* ---------- CHARACTER PICKER: choose boy or girl first, then only characters of that gender are offered ---------- */
const CHG=["m","f","m","f","m","f","m"];
function charPicker(){const g=CHG[NET.av||0];return `<div id="cpk"><div class="g2" style="margin:8px 0"><button class="btn ${g=="m"?"":"o"}" onclick="cpg('m')">♂ ${t("boy")}</button><button class="btn ${g=="f"?"":"o"}" onclick="cpg('f')">♀ ${t("girl")}</button></div><div class="mini" id="avs" style="margin:8px 0">${[0,1,2,3,4,5,6].filter(i=>CHG[i]==g).map(i=>`<div class="mc ${i==NET.av?"sel":""}" data-i="${i}" onclick="pa(${i})"><img class="ra" style="height:92px;object-fit:cover;object-position:top" src="/img/cf${i}.webp${AV3}" alt=""></div>`).join("")}</div><small>${t("chnote")}</small></div>`}
function cpg(g){if(CHG[NET.av||0]!=g)NET.av=CHG.indexOf(g);$("#cpk").outerHTML=charPicker()}
function pa(i){NET.av=i;document.querySelectorAll("#avs .mc").forEach(e=>e.classList.toggle("sel",+e.dataset.i===i))}
function setup(mode,code){if(NET.acct)return setupA(mode,code);modal(`<h2>${t("nick")}</h2><input class="ct" id="nn" type="text" maxlength="14" value="${esc(NET.nick)}" style="margin:8px 0">${mode=="join"?`<b>${t("code")}</b><input id="jc" type="text" maxlength="6" value="${esc(code||"")}" style="margin:8px 0">`:""}<b>${t("pickch")}</b>${charPicker()}<button class="btn big" style="width:100%" onclick="go2()">${mode=="join"?t("join2"):t("create2")}</button>`)}
function acctM(){if(!NET.acct)return;const u=NET.acct,opts=CC.map(c=>[c,cname(c)]).sort((a,b)=>a[1].localeCompare(b[1],S.lang)).map(([c,n])=>`<option value="${c}" ${c==u.country?"selected":""}>${flag(c)}${n}</option>`).join("");NET.av=u.av;
modal(`<h2>${t("acct")}</h2><b>${t("nick")}</b><input class="ct" id="an" type="text" maxlength="14" value="${esc(u.nick)}" style="margin:8px 0;width:100%"><b>${t("country")}</b><select id="ac" style="width:100%;padding:10px;margin:8px 0;border-radius:10px;background:#0008;color:var(--g2);border:1px solid var(--g)"><option value="">${t("pickc")}</option>${opts}</select><b>${t("pickch")}</b>${charPicker()}<button class="btn big" style="width:100%" onclick="saveA()">${t("save")}</button><div class="g2" style="margin-top:10px"><button class="btn o" onclick="outA()">${t("signout")}</button><button class="btn o" onclick="delA()">${t("delacct")}</button></div>`)}
/* first sign-in: the player must confirm a character before playing, so the face always matches the player */
function firstRun(){if(!NET.acct)return;if(!NET.acct.gset){NET.av=NET.acct.av;acctM();const o=$(".ov");if(o){o.onclick=null;o.classList.add("must")}}else if(!NET.acct.country)acctM()}
