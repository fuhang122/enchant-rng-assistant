import sys, re, os
SRC = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SRC)
from build_themeify import themeify
B = SRC + os.sep; BB = B + 'build' + os.sep; W = B + 'wiz' + os.sep

# 1) 数据 → core.js
data=open(BB+'data.json').read()
core=open(BB+'core_src.js').read().replace('__DATA__', data)
open(BB+'core.js','w').write(core)

# 2) 向导版
import base64
wb64 = base64.b64encode(open(B+'wasm/scan2.wasm','rb').read()).decode()
head = open(W+'head.html').read()
if 'id="wasmbin"' not in head:
    head = head.replace('<script id="engine"',
        '<script id="wasmbin" type="text/plain">' + wb64 + '</script>\n<script id="engine"')
if '/*PICKCSS*/' not in head: print('!! 缺 PICKCSS 占位')
head = head.replace('/*PICKCSS*/', open(W+'pick.css').read())
wiz = head + core + '\n</script>\n<script>\n' + open(W+'pick.js').read() + '\n' + open(W+'tail.js').read() + '\n</script>\n</body>\n</html>\n'
open(W+'wizard.html','w').write(wiz)

# 3) 标签版：head.html + 教程 pane → head2；再拼引擎与脚本，最后主题化
head_tab=open(BB+'head.html').read()
tut=open(BB+'tut_body.html').read()
start=tut.index('</header>')+len('</header>')
end=tut.rindex('</div>\n</div>\n</body>')
body=tut[start:end]
body=re.sub(r'<div class="toc">[\s\S]*?</div>\s*</div>', '</div>', body, count=1).strip()
o,c=body.count('<div'),body.count('</div>')
body += '</div>'*(o-c)
head2=head_tab.replace('<button data-tab="help">说明</button>',
                       '<button data-tab="help">说明</button>\n  <button data-tab="tut">教程</button>')
head2=head2.replace('.tabs button{flex:1;padding:10px 0;','.tabs button{flex:1;padding:10px 0;white-space:nowrap;font-size:13.5px;')
head2=head2.replace('</style>','''.tagok{display:inline-block;background:#123024;border:1px solid #1f5c42;color:#7fe3b0;border-radius:6px;font-size:11px;padding:1px 6px;vertical-align:1px}
.tagbad{display:inline-block;background:#33171c;border:1px solid #5c232c;color:#ff8b96;border-radius:6px;font-size:11px;padding:1px 6px;vertical-align:1px}
b.hl{color:#7fe3b0}
.card ol{margin:6px 0 6px 18px;padding:0;color:#a9b4c4;font-size:13.5px;line-height:1.65}
.card ol li{margin:4px 0}
</style>''')
head2=head2.replace('</main>', '\n<section id="p-tut" class="pane">\n'+body+'\n</section>\n</main>')
open(BB+'head2.html','w').write(head2)
head2 = head2.replace('</style>', open(W+'pick.css').read() + '\n' + open(W+'backbtn.css').read() + '\n</style>', 1)
app = head2 + core + '\n</script>\n<script>\n' + open(W+'pick.js').read() + '\n' + open(BB+'tail.js').read() + '\n' + open(W+'backbtn.js').read() + '\n</script>\n</body>\n</html>\n'
open(BB+'app.html','w').write(app)
open(BB+'app_themed.html','w').write(themeify(app))

# 4) 教程
css=open(BB+'tut_css.txt').read()
css=css.replace('padding:0 12px calc(40px + var(--sab,0px))',
                'padding:calc(52px + var(--sat,0px)) 12px calc(40px + var(--sab,0px))')
tutdoc=tut.replace('__CSS__', css + '\n' + open(W+'backbtn.css').read())
tutdoc=tutdoc.replace('</body>', '<script>\n' + open(W+'backbtn.js').read() + '\n</script>\n</body>')
open(BB+'tutorial.html','w').write(tutdoc)
open(BB+'tutorial_themed.html','w').write(themeify(tutdoc))

# 5) 输出
open('/sdcard/Download/DSH-Go/附魔台RNG向导.html','w').write(wiz)
open('/sdcard/Download/DSH-Go/附魔台RNG助手.html','w').write(themeify(app))
open('/sdcard/Download/DSH-Go/附魔台RNG教程.html','w').write(
    themeify(tutdoc).replace('href="附魔台RNG助手.html"','href="附魔台RNG向导.html"'))
print('rebuilt:', len(wiz), len(app), len(tutdoc))
