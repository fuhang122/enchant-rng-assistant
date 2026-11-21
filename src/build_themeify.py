import re, os
SRC = os.path.dirname(os.path.abspath(__file__))
B = SRC + os.sep
ROOT = {
 'bg':'#101319','card':'#171b23','card2':'#131722','input':'#0e1117','line':'#232835','line2':'#2a3140',
 'btn':'#1e2430','btn2':'#12161d','chip':'#1f2632','chipline':'#2c3546','sel':'#141c30',
 'fg':'#e7ecf3','fgB':'#dbe3ef','fgC':'#dfe7f2','fg2':'#c8d2e0','fg2b':'#cfd8e6',
 'mute':'#a9b4c4','mute2':'#98a3b4','mute3':'#9aa5b6','mute4':'#8f9aab',
 'dim':'#7d8798','dimmer':'#6b7585','accent':'#2a5cf4','accent2':'#5c8bff','accent3':'#3d78ff',
 'ok':'#59d0a4','okfg':'#7fe3b0','okline':'#1f5c42','okbg':'#123024',
 'bad':'#e0555f','bad2':'#ff8b96','badline':'#4a2a30','badline2':'#5c232c','badbg':'#33171c',
 'warn':'#e0a355','code':'#8fd6ff','cardline':'#262d3a','rowline':'#1d2330','cardB':'#1b2029',
}
# 具体色值 -> 变量名
HEXMAP = {
 '#101319':'bg','#171b23':'card','#131722':'card','#0e1117':'card2','#232835':'line','#2a3140':'card',
}
MAP = {
 '#101319':'--bg','#171b23':'--card','#131722':'--card2','#0e1117':'--input','#232835':'--line','#2a3140':'--line2',
 '#262d3a':'--line2','#1d2330':'--line','#1e2430':'--btn','#12161d':'--btn','#1f2632':'--chip','#2c3546':'--chipline',
 '#1b2029':'--card','#141c30':'--sel',
 '#e7ecf3':'--fg','#dbe3ef':'--fg','#dfe7f2':'--fg','#cfd8e6':'--fg2','#c8d2e0':'--fg2',
 '#a9b4c4':'--mute','#98a3b4':'--mute','#9aa5b6':'--mute','#8f9aab':'--mute','#7d8798':'--dim','#6b7585':'--dimmer',
 '#2a5cf4':'--accent','#5c8bff':'--accent','#3d78ff':'--accent','#8fd6ff':'--accent',
 '#59d0a4':'--ok','#7fe3b0':'--okfg','#1f5c42':'--okline','#123024':'--okbg',
 '#e0555f':'--bad','#ff8b96':'--bad','#4a2a30':'--badline','#5c232c':'--badline','#33171c':'--badbg',
 '#e0a355':'--warn',
}
VARS = """:root{--bg:#101319;--card:#171b23;--card2:#131722;--input:#0e1117;--line:#232835;--line2:#2a3140;--btn:#1e2430;--chip:#1f2632;--chipline:#2c3546;--sel:#141c30;--fg:#e7ecf3;--fg2:#c8d2e0;--mute:#98a3b4;--dim:#7d8798;--dimmer:#6b7585;--accent:#2a5cf4;--accentfg:#fff;--ok:#59d0a4;--okfg:#7fe3b0;--okline:#1f5c42;--okbg:#123024;--bad:#ff8b96;--badline:#5c232c;--badbg:#33171c;--warn:#e0a355}
:root[data-theme="light"]{--bg:#f3f5fa;--card:#ffffff;--card2:#f7f9fd;--input:#eef1f7;--line:#e3e8f0;--line2:#d7dde8;--btn:#eef1f7;--chip:#f1f4f9;--chipline:#dde3ec;--sel:#e9f0ff;--fg:#151a22;--fg2:#3d4756;--mute:#5f6a7a;--dim:#7a8494;--dimmer:#8c94a2;--accent:#2a5cf4;--accentfg:#fff;--ok:#12a06a;--okfg:#0a7a4d;--okline:#9fd8c2;--okbg:#e9f7f0;--bad:#d8303f;--badline:#e8b6bd;--badbg:#fdeef0;--warn:#9a6100}
"""
THEME_JS = """<script>(function(){
var t=null;
try{ var m=/[?&#]theme=(light|dark|auto)/.exec(location.search+location.hash); if(m) t=m[1]; }catch(e){}
if(!t){ try{ var s=JSON.parse(localStorage.getItem('mcrng.wizard.v1')||'{}'); if(s&&(s.theme==='light'||s.theme==='dark')) t=s.theme; }catch(e){} }
if(!t) t='auto';
var mq=window.matchMedia?window.matchMedia('(prefers-color-scheme: light)'):null;
function cur(){ return t==='auto'?((mq&&mq.matches)?'light':'dark'):t; }
function ap(){
  var c=cur();
  document.documentElement.setAttribute('data-theme', c);
  try{ if(window.AndroidHost&&AndroidHost.setTheme) AndroidHost.setTheme(c==='light'); }catch(e){}
}
ap(); if(mq&&mq.addEventListener) mq.addEventListener('change',function(){ if(t==='auto') ap(); });
try{ if(window.AndroidHost&&AndroidHost.ready) AndroidHost.ready(); }catch(e){}
})();</script>
"""

def themeify(html):
    # 1) 颜色 -> var()
    def rep(m):
        h = m.group(0).lower()
        return ('var(%s)' % MAP[h]) if h in MAP else m.group(0)
    html = re.sub(r'#[0-9a-fA-F]{6}\b', rep, html)
    # 2) 修回 meta
    html = html.replace('content="var(--bg)"', 'content="#101319"')
    # 3) 注入变量与主题脚本
    html = html.replace('<style>', '<style>\n' + VARS, 1)
    if '</head>' in html:
        html = html.replace('</head>', THEME_JS + '</head>', 1)
    else:
        html = re.sub(r'<body[^>]*>', lambda m: THEME_JS + m.group(0), html, count=1)
    # 4) 防止 var(--accentfg) 之类在非 CSS 处的坏值
    return html

if __name__ == '__main__':
    pass
