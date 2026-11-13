
import re
net=open('/home/claude/mw/public/net.source.js',encoding='utf-8').read()
i=net.index('/* MAFIA WORLD - Character Motion Controller') if '/* MAFIA WORLD - Character Motion Controller' in net else net.index('/* ===== STAGE 2');net=net[:i]+open('/home/claude/mw/motion.js',encoding='utf-8').read()+'\n'+open('/home/claude/mw/stage.js',encoding='utf-8').read()+'\ngo("splash");\n'
open('/home/claude/mw/public/net.source.js','w',encoding='utf-8').write(net)
s=open('/home/claude/mw/public/index.html',encoding='utf-8').read()
a=s.rfind('<script>\n');b=s.rfind('</script></body>');s=s[:a]+'<script>\n'+net+s[b:]
css=open('/home/claude/mw/stage.css',encoding='utf-8').read()+'\n'+open('/home/claude/mw/motion.css',encoding='utf-8').read()
if '/*STG*/' in s: s=re.sub(r'/\*STG\*/.*?/\*ENDSTG\*/','',s,flags=re.S)
s=s.replace('</style>','/*STG*/\n'+css+'\n/*ENDSTG*/\n</style>') if '.stg{position' not in s else re.sub(r'\.stg\{position:absolute;inset:0;overflow:hidden.*?(?=</style>)','/*STG*/\n'+css+'\n/*ENDSTG*/\n',s,flags=re.S)
open('/home/claude/mw/public/index.html','w',encoding='utf-8').write(s)
m=re.findall(r'<script>(.*?)</script>',s,re.S);open('/tmp/c1.cjs','w').write(m[0]);open('/tmp/c2.cjs','w').write(m[1]);print('page',len(s)//1024,'KB')
