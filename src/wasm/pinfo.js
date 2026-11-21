// 每个书架数单独能提供多少信息：p = 随机种子也满足这条观测的概率
const fs=require('fs'),path=require('path');
const M=require('../build/core.js');
(async()=>{
  const ex=(await WebAssembly.instantiate(fs.readFileSync(path.join(__dirname,'scan2.wasm')),{})).instance.exports;
  const W=1<<28;                       // 采样窗口
  const rows=[];
  for(let b=0;b<=15;b++){
    // 用固定种子产生一条观测，再统计随机空间里有多少也满足
    const seed=987654321;
    const lv=M.levels(seed,b);
    const p=ex.raw_ptr()>>2, m=new Uint32Array(ex.memory.buffer);
    m[p]=b;m[p+1]=lv[0];m[p+2]=lv[1];m[p+3]=lv[2];
    ex.prepare(1);
    let cnt=0;
    for(let c=0;c<W;c+=1<<24) cnt+=ex.scan(c,Math.min(1<<24,W-c),0);
    const phat=cnt/W;
    const bits=phat>0? -Math.log2(phat): 30;
    rows.push({b,cnt,bits:bits.toFixed(2),exp:Math.round(2**32*phat)});
  }
  rows.sort((a,b)=>b.bits-a.bits);
  rows.forEach(r=>console.log('书架'+String(r.b).padStart(2)+'  信息 '+r.bits+' 位  期望候选 '+r.exp));
})();
