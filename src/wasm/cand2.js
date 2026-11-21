const fs=require('fs'),path=require('path');
const M=require('/root/workspace/mcrng/build/core.js');
(async()=>{
  const ex=(await WebAssembly.instantiate(fs.readFileSync(path.join(__dirname,'scan2.wasm')),{})).instance.exports;
  const plans={ 'A 每次-3/-4: [15,13,10,6,3,0]':[15,13,10,6,3,0],
                'B 每次-1: [15,14,13,12,11,10]':[15,14,13,12,11,10],
                'C 每次-1 低端: [8,7,6,5,4,3]':[8,7,6,5,4,3] };
  const seeds=[123456789, 305419896, 2147483647, 3333333333];
  for(const [name,SHELF] of Object.entries(plans)){
    let worst=0;
    for(const seed of seeds){
      const obs=SHELF.map(b=>({b,levels:M.levels(seed>>>0,b)}));
      const p=ex.raw_ptr()>>2, m=new Uint32Array(ex.memory.buffer);
      obs.forEach((o,i)=>{m[p+i*5]=o.b;m[p+i*5+1]=o.levels[0];m[p+i*5+2]=o.levels[1];m[p+i*5+3]=o.levels[2];});
      ex.prepare(obs.length);
      const out=[];
      for(let c=0;c<256;c++){ const n=ex.scan(c*16777216,16777216,0);
        if(n){const a=new Uint32Array(ex.memory.buffer,ex.out_ptr(),n);for(let k=0;k<n;k++)out.push(a[k]);} }
      const hit=out.includes(seed>>>0);
      worst=Math.max(worst,out.length);
      console.log(name,'| seed',seed,'| 候选',out.length,'| 含真种子',hit);
    }
  }
})();
