import base64,json,io,os
import numpy as np
from PIL import Image
U='/mnt/user-data/uploads/'
out={}
def enc(im,q,name):
    b=io.BytesIO();im.save(b,'WEBP',quality=q,method=6);out[name]=base64.b64encode(b.getvalue()).decode();print(name,im.size,len(b.getvalue())//1024,'KB')
for n,f in [('lobby','1000044493.png'),('day','1000044495.png'),('night','1000044496.png')]:
    enc(Image.open(U+f).convert('RGB'),72,n)
nt=Image.open(U+'1000044496.png').convert('RGB');cx,cy,r=473,175,50;R=r+4
sp=nt.crop((cx-R,cy-R,cx+R,cy+R)).convert('RGBA');yy,xx=np.mgrid[0:2*R,0:2*R];d=np.sqrt((xx-R)**2+(yy-R)**2)
sp.putalpha(Image.fromarray((np.clip((r+1-d)/3,0,1)*255).astype('uint8')));enc(sp,92,'moon')
for k in ["godfather","detective","seer","doctor","citizen","bodyguard","killer"]:
    enc(Image.open(f'/home/claude/cards/{k}.webp'),80,k)
for k in range(7):
    c=Image.open(f'/home/claude/chars/ch{k}_full.png');w=300;c=c.resize((w,int(c.height*w/c.width)),Image.LANCZOS);enc(c,82,f'ch{k}')
    enc(Image.open(f'/home/claude/chars/cf{k}.png'),84,f'cf{k}')
open('/home/claude/mw/src/assets.js','w').write('// Artwork (WebP) as base64. Served by the Worker at /img/<name>.webp\nexport default '+json.dumps(out)+';\n')
print('assets.js',os.path.getsize('/home/claude/mw/src/assets.js')//1024,'KB')
