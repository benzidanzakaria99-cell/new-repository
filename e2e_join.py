import json,urllib.request
from playwright.sync_api import sync_playwright
BASE='http://127.0.0.1:8799'
def get(p):return json.load(urllib.request.urlopen(BASE+p))
res=[]
def ok(n,c):print(('PASS ' if c else 'FAIL ')+n);res.append(c)
with sync_playwright() as p:
    b=p.chromium.launch();pgs={};errs=[]
    for k in 'AB':
        c=b.new_context(viewport={'width':390,'height':844});c.add_cookies([{'name':'uid','value':k,'url':BASE}]);pg=c.new_page();pg.on('pageerror',lambda e,k=k:errs.append(k+':'+str(e)));pgs[k]=pg;pg.goto(BASE+'/');pg.wait_for_function("document.querySelector('.hz')",timeout=15000)
    A,B=pgs['A'],pgs['B']
    chars=lambda pg:pg.evaluate("[...document.querySelectorAll('.mafia-player:not(.leaving)')].map(e=>e.dataset.playerId).sort()")
    A.evaluate("setup('create')");A.wait_for_function("NET.st&&NET.st.ph=='lobby'",timeout=10000);code=A.evaluate("NET.code");A.wait_for_timeout(500)
    ok('host alone: 1 character at the table',len(chars(A))==1)
    B.evaluate(f"netConn('{code}',0)");B.wait_for_function("NET.st&&NET.st.ph=='lobby'",timeout=10000);A.wait_for_timeout(1200)
    ok('real player joins: both screens now show 2 characters',len(chars(A))==2 and len(chars(B))==2)
    ok('each character is bound to the real player id from the server',chars(A)==sorted(p['id'] for p in A.evaluate("NET.st.players")))
    ok('both screens show the same characters',chars(A)==chars(B))
    B.evaluate("netLeave()");A.wait_for_timeout(1500)
    ok('player leaves: the host sees the character disappear (1 left)',len(chars(A))==1 and A.evaluate("document.querySelectorAll('.mafia-player').length")==1)
    B.evaluate(f"netConn('{code}',0)");B.wait_for_function("NET.st&&NET.st.ph=='lobby'",timeout=10000);A.wait_for_timeout(1200)
    ok('player returns: character appears again',len(chars(A))==2)
    A.evaluate("netSend({t:'cap',v:9})");B.evaluate("netSend({t:'ready',v:true})");A.wait_for_timeout(500);A.evaluate("netSend({t:'start'})")
    A.wait_for_function("NET.st&&NET.st.ph=='night'",timeout=20000);A.wait_for_timeout(1500)
    ok('game start fills seats with bots: 7 characters on the table + 2 on the bench strip (9 players)',len(chars(A))==7 and A.evaluate("document.querySelectorAll('.bn2').length")==2)
    print('page errors:',errs);b.close()
print('RESULT',sum(res),'/',len(res))
