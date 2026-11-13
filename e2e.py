import sys,json,time,urllib.request
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:8799';SCEN=sys.argv[1] if len(sys.argv)>1 else 'killer'
OBS="""(()=>{window.__mot={};window.__scene=[];const rec=(el)=>{const id=el.dataset.playerId;if(!id)return;const st=el.dataset.motionState||(el.classList.contains('dead')?'dead':'init');(window.__mot[id]=window.__mot[id]||[]);const a=window.__mot[id];if(a[a.length-1]!==st)a.push(st)};
new MutationObserver(ms=>{ms.forEach(m=>{const t=m.target;if(t.classList&&t.classList.contains('mafia-player'))rec(t);if(t.classList&&t.classList.contains('mafia-scene')){const c=[...t.classList].filter(x=>x!='mafia-scene').join('+');if(window.__scene[window.__scene.length-1]!==c)window.__scene.push(c)}});
 document.querySelectorAll('.mafia-player').forEach(rec)}).observe(document,{subtree:true,attributes:true,childList:true,attributeFilter:['class','data-motion-state']})})()"""
def get(path):return json.load(urllib.request.urlopen(BASE+path))
ok_all=[]
def ok(n,c):print(('PASS ' if c else 'FAIL ')+n);ok_all.append(c)
with sync_playwright() as p:
    b=p.chromium.launch();ctxs={};pgs={};frames={'A':[],'B':[]};errs=[]
    for k in 'AB':
        c=b.new_context(viewport={'width':390,'height':844},device_scale_factor=1);c.add_cookies([{'name':'uid','value':k,'url':BASE}]);c.add_init_script(OBS);pg=c.new_page()
        pg.on('pageerror',lambda e,k=k:errs.append(k+':'+str(e)))
        pg.on('websocket',lambda ws,k=k:ws.on('framereceived',lambda f,k=k:frames[k].append(f if isinstance(f,str) else f.get('payload','') if isinstance(f,dict) else str(f))))
        ctxs[k]=c;pgs[k]=pg;pg.goto(BASE+'/');pg.wait_for_function("document.querySelector('.hz')",timeout=15000)
    A,B=pgs['A'],pgs['B']
    A.evaluate("setup('create')");A.wait_for_function("NET.st&&NET.st.ph=='lobby'",timeout=10000);code=A.evaluate("NET.code")
    B.evaluate(f"netConn('{code}',0)");B.wait_for_function("NET.st&&NET.st.ph=='lobby'",timeout=10000)
    ok('two different accounts joined the same room (real WebSocket server)',A.evaluate("NET.st.players.filter(p=>!p.bot).length")==2)
    A.evaluate("netSend({t:'cap',v:%d})"%(10 if SCEN=='killer' else 7))
    if SCEN=='killer':
        for k,v in (('auto',False),('mafia',1),('godfather',0),('killer',1),('doctor',1),('detective',1),('bodyguard',0),('seer',0)):A.evaluate("netSend({t:'cfg',k:'%s',v:%s})"%(k,json.dumps(v)))
    A.wait_for_timeout(400)
    B.evaluate("netSend({t:'ready',v:true})");A.wait_for_function("NET.st.players.every(p=>p.host||p.ready)");A.evaluate("netSend({t:'start'})")
    A.wait_for_function("NET.st&&NET.st.ph=='role'",timeout=8000)
    if SCEN=='killer':get(f'/__roles?code={code}&A=killer&B=citizen')
    else:get(f'/__roles?code={code}&A=mafia&B=citizen')
    A.wait_for_function("NET.st&&NET.st.ph=='night'",timeout=15000);B.wait_for_function("NET.st&&NET.st.ph=='night'",timeout=15000)
    ida=A.evaluate("G.me.id");idb=B.evaluate("G.me.id");mates=A.evaluate("NET.st.mates")
    ok(f'A role is {SCEN} and B is citizen (server-side)',A.evaluate("G.me.role")==('killer' if SCEN=='killer' else 'mafia') and B.evaluate("G.me.role")=='citizen')
    A.wait_for_timeout(4200)   # let A's private wake-up play
    A.screenshot(path=f'/tmp/mw_local/{SCEN}_A_night.png');B.screenshot(path=f'/tmp/mw_local/{SCEN}_B_night.png')
    ma=A.evaluate("window.__mot");mb=B.evaluate("window.__mot")
    ok("A's own character wakes up and looks around during the night",'waking' in ma.get(ida,[]) and 'acting' in ma.get(ida,[]))
    others_a=[v for k,v in ma.items() if k!=ida and k not in (mates or [])]
    ok("on A's screen every other character (except A's known teammates) stays asleep",all(set(v)<= {'sleeping','init','dead'} for v in others_a))
    if SCEN!='killer':ok("Mafia teammates (already known to A) wake together on A's screen",bool(mates) and all('waking' in ma.get(m,[]) for m in mates))
    ok("on B's screen NOBODY wakes during the night (A's movement is invisible to B)",all(set(v)<= {'sleeping','init','dead'} for v in mb.values()) and 'waking' not in mb.get(ida,[]))
    alive=A.evaluate("G.P.filter(p=>p.a&&!p.me&&!(NET.st.mates||[]).includes(p.id)).map(p=>p.id)");victim=alive[0]
    A.evaluate(f"seat('{victim}')");A.wait_for_timeout(300)
    st=get(f'/__state?code={code}');ok("victim choice reached the server logic (not the animation)",st['act'].get(ida)==victim)
    A.wait_for_timeout(2200);ma=A.evaluate("window.__mot")
    ok("after choosing, A's character goes back to sleep",'returning' in ma.get(ida,[]) and A.evaluate(f"document.querySelector('[data-player-id=\"{ida}\"]').dataset.motionState")=='sleeping')
    ok("B still sees nothing move",B.evaluate("Object.values(window.__mot).every(v=>v.every(s=>['sleeping','init','dead'].includes(s)))"))
    A.wait_for_function("NET.st.ph=='day'",timeout=20000);B.wait_for_function("NET.st.ph=='day'",timeout=20000)
    A.wait_for_timeout(600);DS=lambda pg:pg.evaluate("[...document.querySelectorAll('.mafia-player.dead')].map(e=>e.dataset.playerId).sort().join()")
    dsA,dsB=DS(A),DS(B);dead_ids=[i for i,v in get(f'/__state?code={code}')['alive'].items() if not v]
    print('DEAD A:',dsA,'| B:',dsB,'| server:',sorted(dead_ids),'| ph A/B',A.evaluate('NET.st.ph'),B.evaluate('NET.st.ph'),'day',A.evaluate('NET.st.day'))
    ok('same dead set shown on both screens at dawn (and equals the server)',dsA==dsB==','.join(sorted(dead_ids)))
    A.wait_for_timeout(7000);B.wait_for_timeout(500)
    for k,pg in (('A',A),('B',B)):
        sc=pg.evaluate("window.__scene");ok(f'{k}: scene goes night -> dawn -> day',all(x in sc for x in ['night','dawn','day']) or ('dawn' in ' '.join(sc) and 'day' in ' '.join(sc)))
        s=pg.evaluate("[...document.querySelectorAll('.mafia-player')].map(e=>[e.dataset.motionState||'',e.classList.contains('dead')])")
        ok(f'{k}: after sunrise every living character is awake; the dead stay dead',all((st=='awake') for st,d in s if not d) and len(s)>=5)
    A.screenshot(path=f'/tmp/mw_local/{SCEN}_A_day.png');B.screenshot(path=f'/tmp/mw_local/{SCEN}_B_day.png')
    def leaks(k):
        n=0;total=0
        for f in frames[k]:
            try:d=json.loads(f)
            except Exception:continue
            if d.get('t')!='state' or d.get('ph')=='end':continue
            total+=1
            for q in d['players']:
                if q['id']!=d['you'] and q['alive'] and q.get('role'):n+=1
        return n,total
    for k in 'AB':
        n,tot=leaks(k);ok(f"{k}: in {tot} state messages no living player's secret role was ever sent (only own role)",n==0 and tot>3)
    fb=' '.join(frames['B']);ok("B's frames never contain other players' night picks",'"pick":"' not in fb.replace('"pick":null',''))
    print('page errors:',errs);b.close()
print('RESULT',sum(ok_all),'/',len(ok_all))
