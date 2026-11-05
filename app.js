(async function(){
const $=s=>document.querySelector(s);
const STATUS={
  en_cours:{m:'En cours',a:'En cours',c:'#3d7fd6'},
  termine:{m:'Terminé',a:'Terminé',c:'#3f9d6e'},
  pause:{m:'En pause',a:'En pause',c:'#c9902a'},
  a_lire:{m:'À lire',a:'À voir',c:'#8a8fa3'},
  abandonne:{m:'Abandonné',a:'Abandonné',c:'#b8524a'}
};
const ORDER=Object.keys(STATUS);
const EPS=12, GHOST_CAP=80, KEY='hondana.v1';
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const uid=()=>Math.random().toString(36).slice(2,10);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- données ---------- */
const mk=(title,done,total,status,score)=>({id:uid(),title,done,total,status,score,example:true});
const EXAMPLE={
  manga:[mk('One Piece',105,0,'en_cours',9),mk('Berserk',41,0,'en_cours',10),mk('Frieren',13,0,'en_cours',9),
    mk('Vinland Saga',14,14,'termine',9),mk('Chainsaw Man',12,0,'en_cours',8),mk('Spy x Family',5,0,'pause',7),
    mk('Death Note',12,12,'termine',8),mk('Monster',7,18,'en_cours',9),mk('Fullmetal Alchemist',27,27,'termine',10),mk('Blue Period',0,0,'a_lire',0)],
  anime:[mk('Frieren',28,28,'termine',10),mk('Cowboy Bebop',26,26,'termine',9),{...mk("L'Attaque des Titans",87,87,'termine',9),q:'Shingeki no Kyojin'},
    mk('Jujutsu Kaisen',24,47,'en_cours',8),mk('Mob Psycho 100',37,37,'termine',9),mk('Dandadan',12,24,'en_cours',8),mk('Monster',0,74,'a_lire',0)]
};
function load(){try{const r=localStorage.getItem(KEY);if(r){const d=JSON.parse(r);if(d&&Array.isArray(d.manga)&&Array.isArray(d.anime))return d;}}catch(e){}return null}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){toast("Ta bibliothèque n'a pas pu être enregistrée dans ce navigateur.")}}
const state=load()||JSON.parse(JSON.stringify(EXAMPLE));
for(const k of ['manga','anime'])state[k]=state[k].filter(s=>s&&typeof s.title==='string'&&s.title.trim()).map(s=>({...s,done:clamp(+s.done||0,0,3000),total:clamp(+s.total||0,0,3000),score:clamp(+s.score||0,0,10),status:STATUS[s.status]?s.status:'en_cours',id:s.id||uid()}));
let tab='manga', sortBy='titre';

/* ---------- couleurs ---------- */
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function rng(seed){let s=seed%2147483647||1;return()=>((s=s*16807%2147483647)-1)/2147483646}
function palette(title,hex){
  const h=hash(title.toLowerCase());
  const c=hex&&/^#[0-9a-f]{6}$/i.test(hex)?new THREE.Color(hex):new THREE.Color().setHSL((h%360)/360,.42+((h>>9)%24)/100,.36+((h>>15)%18)/100);
  if(hex){const k=c.getHSL({});c.setHSL(k.h,Math.min(k.s,.75),clamp(k.l,.22,.62))}
  const lum=.2126*c.r+.7152*c.g+.0722*c.b;
  return {css:'#'+c.getHexString(),hsl:c.getHSL({}),three:c.clone().convertSRGBToLinear(),text:lum>.52?'#141a2e':'#ffffff'};
}
const shade=(pal,l,ds=0)=>'#'+new THREE.Color().setHSL(pal.hsl.h,clamp(pal.hsl.s+ds,0,1),l).getHexString();
// trois familles de tranches, comme en rayon : sombre à liseré, couleur pleine, claire à bandeau
function template(s,pal){
  const t=hash(s.title.toLowerCase()+'·')%3;
  if(t===0)return{kind:'dark',bg:'#17181d',title:shade(pal,.7,.1),box:shade(pal,.6,.1),digit:'#111217',accent:shade(pal,.55,.1)};
  if(t===1)return{kind:'full',bg:pal.css,title:pal.text,box:pal.text,digit:pal.css,accent:pal.text};
  return{kind:'band',bg:'#ebe7de',title:shade(pal,.27,.05),box:pal.css,digit:'#ffffff',accent:pal.css};
}
const lin=hex=>new THREE.Color(hex).convertSRGBToLinear();
function styleFor(s){
  const img=s.al&&s.al.cover?coverImg(s.al.cover):null;
  const pal=palette(s.title,s.al&&s.al.color);
  if(img)return{pal,tpl:{kind:'art',img,bg:pal.css,title:pal.text,box:pal.text,digit:pal.css,accent:pal.text}};
  return{pal,tpl:template(s,pal)};
}

/* ---------- moteur ---------- */
const canvas=$('#c'), stage=$('#stage');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
renderer.outputEncoding=THREE.sRGBEncoding;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();$('#lost').hidden=false});
const ANISO=Math.min(8,renderer.capabilities.getMaxAnisotropy());
const scene=new THREE.Scene();
scene.background=lin('#0b0c10');
scene.fog=new THREE.Fog(0x0b0c10,14,40);
const camera=new THREE.PerspectiveCamera(40,1,.1,200);

// environnement pour les reflets : pièce sombre avec quelques bandes lumineuses
(function(){
  const env=new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(30,14,30),new THREE.MeshBasicMaterial({color:0x07080a,side:THREE.BackSide})));
  const strip=(w,h,x,y,z,ry,rx,v)=>{const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({color:new THREE.Color(v,v,v*1.08),side:THREE.DoubleSide}));m.position.set(x,y,z);m.rotation.set(rx||0,ry||0,0);env.add(m)};
  strip(16,.35,0,6.5,4,0,Math.PI/2,7);strip(16,.25,0,6.5,-2,0,Math.PI/2,4);
  strip(.4,8,-12,2,6,Math.PI/2.4,0,3);strip(.4,8,12,2,6,-Math.PI/2.4,0,2);
  strip(10,3,0,2,14,Math.PI,0,.6);
  const pm=new THREE.PMREMGenerator(renderer);scene.environment=pm.fromScene(env,.03).texture;pm.dispose();
})();

scene.add(new THREE.HemisphereLight(0x8a96b8,0x050507,.35));
const key=new THREE.DirectionalLight(0xe4ecff,.85);
key.castShadow=true;key.shadow.mapSize.set(innerWidth<=720?1536:2048,innerWidth<=720?1536:2048);
key.shadow.bias=-.0012;key.shadow.normalBias=.05;key.shadow.radius=3;
scene.add(key);scene.add(key.target);

const TYPE={
  manga:{w:.15,h:1.75,d:1.13,cw:48,bh:46,rough:.55,verb:'lus'},
  anime:{w:.26,h:1.7,d:1.32,cw:80,bh:54,rough:.22,verb:'vus'}
};
const ROWS=4, ROW_H=2.18, PLANK=.08;

/* ---------- éclairage LED (sous chaque planche) + numéros peints par le shader ---------- */
const LED={uLed:{value:new THREE.Color(.95,1.02,1.15)},uRowH:{value:ROW_H},uBase:{value:PLANK},uTopY:{value:9}};
const LED_V=`#include <begin_vertex>
{vec4 lw=vec4(transformed,1.0);
#ifdef USE_INSTANCING
lw=instanceMatrix*lw;
#endif
lw=modelMatrix*lw;vLedY=lw.y;vLedN=normalize(mat3(modelMatrix)*objectNormal);}`;
const LED_F=`#include <emissivemap_fragment>
{float t=mod(vLedY-uBase,uRowH);float dist=max(uRowH-uBase-t,0.0);
float g=exp(-dist*2.3)*0.9+0.035;if(vLedY>uTopY||vLedY<0.0)g=0.0;
float f=clamp(dot(normalize(vLedN),normalize(vec3(0.0,0.6,1.0))),0.0,1.0)*0.8+0.2;
totalEmissiveRadiance+=diffuseColor.rgb*uLed*g*f;}`;
const NUM_F=`#include <map_fragment>
{vec2 uvb=vUv;
if(vNum>0.5&&uvb.x>uBox.x&&uvb.x<uBox.y&&uvb.y>uBox.z&&uvb.y<uBox.w){
float n=floor(vNum+0.5);float nd=n>=1000.0?4.0:(n>=100.0?3.0:(n>=10.0?2.0:1.0));
vec2 l=vec2((uvb.x-uBox.x)/(uBox.y-uBox.x),(uvb.y-uBox.z)/(uBox.w-uBox.z));
float cell=1.0/max(nd,2.0);float lx=(l.x-(0.5-nd*cell*0.5))/cell;
if(lx>=0.0&&lx<nd){float di=floor(lx);float p=nd-1.0-di;
float dv=p<0.5?1.0:(p<1.5?10.0:(p<2.5?100.0:1000.0));float d=mod(floor(n/dv),10.0);
float gy=(l.y-0.5)/0.66+0.5;
if(gy>0.0&&gy<1.0){vec4 t=texture2D(uDigits,vec2((d+fract(lx))/10.0,gy));diffuseColor.rgb=mix(diffuseColor.rgb,uDigitColor,t.a);}}}}`;
let digitTex=null;
function digits(){if(digitTex)return digitTex;const c=document.createElement('canvas');c.width=320;c.height=48;const x=c.getContext('2d');
  x.fillStyle='#fff';x.font='500 40px "IBM Plex Mono",ui-monospace,monospace';x.textAlign='center';x.textBaseline='middle';
  for(let i=0;i<10;i++)x.fillText(String(i),i*32+16,26);digitTex=new THREE.CanvasTexture(c);digitTex.generateMipmaps=false;digitTex.minFilter=THREE.LinearFilter;return digitTex}
// num : {box:Vector4,color:Color} pour peindre le numéro du tome
function mat(params,opt={}){
  const m=new THREE.MeshStandardMaterial(params);
  if(opt.ghost){m.transparent=true;m.opacity=opt.opacity??.06;m.depthWrite=false}
  const led=opt.led!==false,num=opt.num;
  if(!led&&!num)return m;
  m.onBeforeCompile=sh=>{
    let vh='',fh='';
    if(led){Object.assign(sh.uniforms,LED);vh+='varying float vLedY;varying vec3 vLedN;\n';fh+='uniform vec3 uLed;uniform float uRowH;uniform float uBase;uniform float uTopY;varying float vLedY;varying vec3 vLedN;\n';
      sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>',LED_V);sh.fragmentShader=sh.fragmentShader.replace('#include <emissivemap_fragment>',LED_F)}
    if(num){sh.uniforms.uDigits={value:digits()};sh.uniforms.uDigitColor={value:num.color};sh.uniforms.uBox={value:num.box};
      vh+='attribute float aNum;varying float vNum;\n';fh+='uniform sampler2D uDigits;uniform vec3 uDigitColor;uniform vec4 uBox;varying float vNum;\n';
      sh.vertexShader=sh.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvNum=aNum;');
      sh.fragmentShader=sh.fragmentShader.replace('#include <map_fragment>',NUM_F)}
    sh.vertexShader=vh+sh.vertexShader;sh.fragmentShader=fh+sh.fragmentShader;
  };
  m.customProgramCacheKey=()=>'h-'+(led?'l':'')+(num?'n':'');
  return m;
}

/* ---------- géométries ---------- */
function mergedBox(w,h,d){
  const g=new THREE.BoxGeometry(w,h,d),idx=g.index.array,gr=g.groups.map(x=>({...x}));
  const order=[[0,1,5],[2,3],[4]],out=[];let start=0;g.clearGroups();
  order.forEach((faces,mi)=>{let cnt=0;faces.forEach(f=>{for(let i=0;i<gr[f].count;i++)out.push(idx[gr[f].start+i]);cnt+=gr[f].count});g.addGroup(start,cnt,mi);start+=cnt});
  g.setIndex(out);g.computeBoundingSphere();return g;
}
const boxGeo={},mergedGeo={};
for(const k in TYPE){boxGeo[k]=new THREE.BoxGeometry(TYPE[k].w,TYPE[k].h,TYPE[k].d);mergedGeo[k]=mergedBox(TYPE[k].w,TYPE[k].h,TYPE[k].d)}
function instGeo(base,nums){
  const g=new THREE.BufferGeometry();
  for(const n in base.attributes)g.setAttribute(n,base.attributes[n]);
  g.setIndex(base.index);base.groups.forEach(x=>g.addGroup(x.start,x.count,x.materialIndex));
  g.setAttribute('aNum',new THREE.InstancedBufferAttribute(new Float32Array(nums),1));return g;
}

/* ---------- textures ---------- */
function tex(c,srgb=true){const t=new THREE.CanvasTexture(c);if(srgb)t.encoding=THREE.sRGBEncoding;t.anisotropy=ANISO;return t}
function canvas2d(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return[c,c.getContext('2d')]}
function rr(x,X,Y,W,H,r){x.beginPath();x.moveTo(X+r,Y);x.arcTo(X+W,Y,X+W,Y+H,r);x.arcTo(X+W,Y+H,X,Y+H,r);x.arcTo(X,Y+H,X,Y,r);x.arcTo(X,Y,X+W,Y,r);x.closePath()}
function grain(x,w,h,n,a){const r=rng(w*h+n);for(let i=0;i<n;i++){x.fillStyle=r()<.5?`rgba(0,0,0,${a})`:`rgba(255,255,255,${a*.8})`;x.fillRect(r()*w,r()*h,1+r()*1.5,1)}}
// tranche de pages vue du dessus : fines lignes parallèles
const pagesTex={manga:(()=>{const[c,x]=canvas2d(64,128);x.fillStyle='#e6dfcf';x.fillRect(0,0,64,128);const r=rng(7);
  for(let i=0;i<64;i+=1.3){x.fillStyle=`rgba(90,70,40,${.04+r()*.1})`;x.fillRect(i,0,.7,128)}
  const g=x.createLinearGradient(0,0,0,128);g.addColorStop(0,'rgba(0,0,0,.0)');g.addColorStop(.92,'rgba(0,0,0,.0)');g.addColorStop(1,'rgba(0,0,0,.18)');x.fillStyle=g;x.fillRect(0,0,64,128);return tex(c)})(),
  anime:(()=>{const[c,x]=canvas2d(64,128);x.fillStyle='#1c1e24';x.fillRect(0,0,64,128);x.fillStyle='rgba(255,255,255,.08)';x.fillRect(0,0,4,128);x.fillRect(60,0,4,128);return tex(c)})()};
const PAGES={},PAGES_G={};
for(const k in TYPE){PAGES[k]=mat({color:0xffffff,map:pagesTex[k],roughness:k==='anime'?.3:.9});PAGES_G[k]=mat({color:0xffffff,map:pagesTex[k],roughness:.9},{ghost:true})}

function spineTexture(s,pal,tpl,num){
  const T=TYPE[tab],w=T.cw,h=512,[c,x]=canvas2d(w,h);
  x.fillStyle=tpl.bg;x.fillRect(0,0,w,h);
  let titleY=64;
  if(tpl.kind==='art'){
    const img=tpl.img,artH=Math.round(h*.42);
    const cropH=img.naturalHeight*.6,cropW=Math.min(img.naturalWidth,cropH*(w/artH));
    try{x.drawImage(img,(img.naturalWidth-cropW)/2,img.naturalHeight*.05,cropW,cropH,0,0,w,artH)}catch(e){}
    const f=x.createLinearGradient(0,artH-60,0,artH);f.addColorStop(0,pal.css+'00');f.addColorStop(1,pal.css);x.fillStyle=f;x.fillRect(0,artH-60,w,60);
    titleY=artH+16;
  }
  else if(tpl.kind==='dark'){x.fillStyle=tpl.accent;x.fillRect(0,0,w,12);x.fillRect(Math.round(w*.12),12,Math.max(2,Math.round(w*.06)),h-24);x.fillRect(0,h-6,w,6)}
  else if(tpl.kind==='full'){x.globalAlpha=.55;x.fillStyle=tpl.accent;x.fillRect(4,16,w-8,2);x.fillRect(4,21,w-8,1);x.fillRect(4,h-T.bh-28,w-8,1);x.globalAlpha=1}
  else{const bh=Math.round(h*.3);x.fillStyle=pal.css;x.fillRect(0,0,w,bh);
    x.save();x.beginPath();x.rect(0,0,w,bh);x.clip();x.strokeStyle='rgba(255,255,255,.16)';x.lineWidth=3;
    for(let i=-w;i<bh+w;i+=9){x.beginPath();x.moveTo(0,i);x.lineTo(w,i-w*.7);x.stroke()}x.restore();
    x.fillStyle='rgba(0,0,0,.25)';x.fillRect(0,bh,w,2);titleY=bh+16}
  // pastille de statut, comme une étiquette de bibliothèque
  const sy=tpl.kind==='band'?Math.round(h*.3)-22:tpl.kind==='art'?22:44,sr=Math.min(w*.24,tpl.kind==='art'?9:12);
  x.beginPath();x.arc(w/2,sy,sr,0,7);x.fillStyle=STATUS[s.status].c;x.fill();x.lineWidth=2;x.strokeStyle='rgba(255,255,255,.85)';x.stroke();
  if(tpl.kind!=='band'&&tpl.kind!=='art')titleY=sy+sr+12;
  const avail=h-T.bh-56-titleY;let fs=tab==='anime'?34:27;const F=n=>`700 ${n}px "Zen Kaku Gothic New",system-ui,sans-serif`;x.font=F(fs);
  while(x.measureText(s.title).width>avail&&fs>11){fs--;x.font=F(fs)}
  x.save();x.translate(w/2+(tpl.kind==='dark'?w*.06:0),titleY);x.rotate(Math.PI/2);x.fillStyle=tpl.title;x.textBaseline='middle';x.fillText(s.title,0,0);x.restore();
  // emblème d'éditeur fictif
  const ey=h-T.bh-34;x.fillStyle=tpl.title;x.globalAlpha=.7;x.beginPath();x.moveTo(w/2,ey-7);x.lineTo(w/2+6,ey);x.lineTo(w/2,ey+7);x.lineTo(w/2-6,ey);x.closePath();x.fill();x.globalAlpha=1;
  rr(x,6,h-T.bh-12,w-12,T.bh,5);x.fillStyle=tpl.box;x.fill();
  if(num>0){x.fillStyle=tpl.digit;x.textAlign='center';x.textBaseline='middle';const n=String(num);
    x.font=`500 ${(n.length>2?18:24)+(tab==='anime'?6:0)}px "IBM Plex Mono",monospace`;x.fillText(n,w/2,h-T.bh/2-12)}
  // dos légèrement arrondi + grain du papier
  const g=x.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(0,0,0,.32)');g.addColorStop(.18,'rgba(0,0,0,.04)');g.addColorStop(.45,'rgba(255,255,255,.07)');g.addColorStop(.8,'rgba(0,0,0,.06)');g.addColorStop(1,'rgba(0,0,0,.38)');
  x.fillStyle=g;x.fillRect(0,0,w,h);grain(x,w,h,w*30,.05);
  return tex(c);
}
function coverTexture(s,pal,tpl,idx){
  const W=384,H=576,[c,x]=canvas2d(W,H);
  const real=s.al&&(s.al.coverXL||s.al.cover);const img=real?coverImg(s.al.coverXL||s.al.cover,true):null;
  if(img){
    const r=Math.max(W/img.naturalWidth,H/img.naturalHeight),dw=img.naturalWidth*r,dh=img.naturalHeight*r;
    try{x.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh)}catch(e){}
    const g=x.createLinearGradient(0,0,W,0);g.addColorStop(0,'rgba(0,0,0,.25)');g.addColorStop(.05,'rgba(0,0,0,0)');g.addColorStop(.65,'rgba(255,255,255,.05)');g.addColorStop(.8,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,W,H);
    rr(x,W-96,H-58,80,40,20);x.fillStyle='rgba(12,13,17,.82)';x.fill();
    x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';x.font='500 20px "IBM Plex Mono",monospace';
    x.fillText(tab==='anime'?`C.${idx}`:`T.${idx}`,W-56,H-37);
    return tex(c);
  }
  const g=x.createLinearGradient(0,0,W,H);g.addColorStop(0,shade(pal,.5,.1));g.addColorStop(1,shade(pal,.22,.05));x.fillStyle=g;x.fillRect(0,0,W,H);
  const r=rng(hash(s.title)+idx);
  x.fillStyle='rgba(255,255,255,.10)';x.beginPath();x.arc(W*(.55+r()*.3),H*(.45+r()*.2),W*(.32+r()*.15),0,7);x.fill();
  x.strokeStyle='rgba(255,255,255,.12)';x.lineWidth=2;for(let i=0;i<26;i++){const a=r()*Math.PI*2,cx=W*.65,cy=H*.55;x.beginPath();x.moveTo(cx+Math.cos(a)*90,cy+Math.sin(a)*90);x.lineTo(cx+Math.cos(a)*520,cy+Math.sin(a)*520);x.stroke()}
  x.fillStyle='rgba(255,255,255,.12)';for(let yy=0;yy<H;yy+=12)for(let xx=(yy/12)%2*6;xx<W;xx+=12){x.beginPath();x.arc(xx,yy,.6+2*(yy/H),0,7);x.fill()}
  x.fillStyle='rgba(0,0,0,.28)';x.fillRect(0,0,12,H);
  const words=s.title.split(/\s+/);let lines=[''],fs=50;const F=n=>`400 ${n}px "Dela Gothic One",system-ui,sans-serif`;x.font=F(fs);
  const fit=()=>{lines=[''];for(const w of words){const t=(lines[lines.length-1]+' '+w).trim();if(x.measureText(t).width>W-84&&lines[lines.length-1])lines.push(w);else lines[lines.length-1]=t}};
  fit();while((lines.length>4||lines.some(l=>x.measureText(l).width>W-84))&&fs>20){fs-=3;x.font=F(fs);fit()}
  x.textBaseline='top';x.lineJoin='round';
  lines.slice(0,5).forEach((l,i)=>{x.lineWidth=8;x.strokeStyle='rgba(10,10,14,.85)';x.strokeText(l,40,44+i*fs*1.1);x.fillStyle='#fff';x.fillText(l,40,44+i*fs*1.1)});
  x.beginPath();x.arc(W-62,H-70,34,0,7);x.fillStyle=tpl.kind==='band'?pal.css:'#ffffff';x.fill();
  x.fillStyle=tpl.kind==='band'?'#fff':'#141519';x.textAlign='center';x.textBaseline='middle';x.font='400 30px "Dela Gothic One",sans-serif';x.fillText(String(idx),W-62,H-68);
  x.textAlign='left';x.fillStyle='#fff';x.font='500 15px "IBM Plex Mono",monospace';x.fillText(tab==='anime'?`COFFRET · ÉP. ${(idx-1)*EPS+1}–${idx*EPS}`:'TOME',40,H-70);
  x.fillStyle='rgba(255,255,255,.75)';x.beginPath();x.moveTo(40,H-40);x.lineTo(48,H-32);x.lineTo(40,H-24);x.lineTo(32,H-32);x.closePath();x.fill();
  const sh=x.createLinearGradient(0,0,W,0);sh.addColorStop(0,'rgba(255,255,255,0)');sh.addColorStop(.6,'rgba(255,255,255,.06)');sh.addColorStop(.75,'rgba(255,255,255,0)');x.fillStyle=sh;x.fillRect(0,0,W,H);
  return tex(c);
}
function noiseTex(w,h,base,amt,seed){const[c,x]=canvas2d(w,h);x.fillStyle=base;x.fillRect(0,0,w,h);const r=rng(seed);
  for(let i=0;i<w*h*.6;i++){const v=r();x.fillStyle=v<.5?`rgba(0,0,0,${amt*r()})`:`rgba(255,255,255,${amt*.6*r()})`;x.fillRect(r()*w,r()*h,1,1)}
  const t=tex(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;return t}
const feltTex=noiseTex(256,256,'#ffffff',.18,3);
const wallTex=noiseTex(256,256,'#ffffff',.22,9);
const glowTex=(()=>{const[c,x]=canvas2d(4,128);const g=x.createLinearGradient(0,0,0,128);g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(.25,'rgba(255,255,255,.14)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,4,128);return tex(c)})();

/* ---------- matériaux du meuble ---------- */
const CAB=mat({color:lin('#16171c'),roughness:.62,metalness:.15});
const BACK=mat({color:lin('#23262f'),roughness:.95,map:feltTex});
const ALU=new THREE.MeshStandardMaterial({color:lin('#9aa0aa'),roughness:.32,metalness:1});
const LEDM=new THREE.MeshBasicMaterial({color:new THREE.Color(4,4.3,4.8)});
const GLOW=new THREE.MeshBasicMaterial({map:glowTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,color:new THREE.Color(.55,.6,.7)});
const WALL=new THREE.MeshStandardMaterial({color:lin('#15161b'),roughness:.95,map:wallTex});
const FLOOR=new THREE.MeshStandardMaterial({color:lin('#0c0d10'),roughness:.38,metalness:.25});
const KEEP=new Set([CAB,BACK,ALU,LEDM,GLOW,WALL,FLOOR,...Object.values(PAGES),...Object.values(PAGES_G)]);

/* ---------- état de scène ---------- */
let shelf=new THREE.Group(); scene.add(shelf);
let recs=[], inst=[], layout={W:8,H:9};
const proxies=new Map(); let selKey=null, hovKey=null;
const cam={x:4,y:4,d:12,tx:4,ty:4,td:12,fitD:12};
const par={x:0,y:0,tx:0,ty:0};
const M=new THREE.Matrix4(),Q=new THREE.Quaternion(),V=new THREE.Vector3(),ONE=new THREE.Vector3(1,1,1),Z=new THREE.Vector3(0,0,1);

/* ---------- construction ---------- */
function units(s){
  if(tab==='manga'){const solid=s.done,ghost=s.total>s.done?Math.min(GHOST_CAP,s.total-s.done):0;return {solid,ghost:(solid+ghost)===0?1:ghost}}
  const solid=Math.ceil(s.done/EPS),all=Math.max(solid,Math.ceil(s.total/EPS));const ghost=Math.min(GHOST_CAP,all-solid);return {solid,ghost:(solid+ghost)===0?1:ghost};
}
function sorted(){
  const l=[...state[tab]];const byT=(a,b)=>a.title.localeCompare(b.title,'fr');
  if(sortBy==='note')l.sort((a,b)=>b.score-a.score||byT(a,b));
  else if(sortBy==='statut')l.sort((a,b)=>ORDER.indexOf(a.status)-ORDER.indexOf(b.status)||byT(a,b));
  else if(sortBy==='progression')l.sort((a,b)=>b.done-a.done||byT(a,b));
  else l.sort(byT);return l;
}
function placeMatrix(p,hidden){Q.setFromAxisAngle(Z,p.rz);M.compose(V.set(p.x,hidden?-1000:p.y,p.z),Q,ONE);return M}
function setInst(rec,idx,visible){
  const ghost=idx>rec.solid,im=ghost?rec.ghostMesh:rec.solidMesh;if(!im)return;
  im.setMatrixAt(ghost?idx-rec.solid-1:idx-1,placeMatrix(rec.pos[idx-1],!visible));im.instanceMatrix.needsUpdate=true;
}
function disposeShelf(){
  for(const m of proxies.values())releaseProxy(m,true);proxies.clear();selKey=null;hovKey=null;
  const mats=new Set(),geos=new Set(),texs=new Set();
  shelf.traverse(o=>{if(o.isMesh){geos.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m))}});
  geos.forEach(g=>{if(!Object.values(mergedGeo).includes(g)&&!Object.values(boxGeo).includes(g))g.dispose()});
  mats.forEach(m=>{if(KEEP.has(m))return;if(m.map&&m.map!==feltTex&&m.map!==wallTex)texs.add(m.map);m.dispose()});
  texs.forEach(t=>t.dispose());
  scene.remove(shelf);shelf=new THREE.Group();scene.add(shelf);recs=[];inst=[];
}
function add(geo,material,x,y,z,opt={}){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=!!opt.cast;m.receiveShadow=opt.receive!==false;if(opt.order)m.renderOrder=opt.order;shelf.add(m);return m}
function build(keep){
  const prev=selKey;
  try{
    disposeShelf();
    const T=TYPE[tab],list=sorted(),gap=.005,sgap=.08,pad=.28;
    let total=0;const plan=list.map(s=>{const u=units(s);total+=(u.solid+u.ghost)*(T.w+gap)+sgap;return{s,u}});
    let W=Math.max(7,total/ROWS*1.06+pad*2),pos=[];
    for(let tries=0;tries<40;tries++){
      pos=[];let row=0,cur=pad,ok=true;
      for(const p of plan){const n=p.u.solid+p.u.ghost;
        for(let i=0;i<n;i++){if(cur+T.w>W-pad){row++;cur=pad;if(row>=ROWS){ok=false;break}}pos.push({p,i,row,x:cur+T.w/2});cur+=T.w+gap}
        if(!ok)break;cur+=sgap}
      if(ok)break;W*=1.06;
    }
    const H=PLANK+ROWS*ROW_H;layout={W,H};LED.uTopY.value=H;
    const baseY=r=>PLANK+(ROWS-1-r)*ROW_H;

    // pièce : mur, sol, socle
    add(new THREE.PlaneGeometry(W+80,40),WALL,W/2,H/2+4,-.95);
    WALL.map.repeat.set((W+80)/3,40/3);
    const fl=add(new THREE.PlaneGeometry(W+80,30),FLOOR,W/2,-.16,6);fl.rotation.x=-Math.PI/2;
    add(new THREE.BoxGeometry(W+.36,.16,1.56),CAB,W/2,-.08,-.03,{cast:true});
    // meuble noir mat
    const plankG=new THREE.BoxGeometry(W+.2,PLANK,1.5),aluG=new THREE.BoxGeometry(W+.2,PLANK+.01,.02);
    const ledG=new THREE.BoxGeometry(W,.016,.025),glowG=new THREE.PlaneGeometry(W,.7);
    for(let r=0;r<=ROWS;r++){
      const y=r===ROWS?H-PLANK/2:baseY(r)-PLANK/2;
      add(plankG,CAB,W/2,y,-.03,{cast:true});add(aluG,ALU,W/2,y,.73);
      if(r<ROWS){const yl=baseY(r)+ROW_H-PLANK-.014;add(ledG,LEDM,W/2,yl,.62,{receive:false});
        const gl=add(glowG,GLOW,W/2,yl-.35,.6,{receive:false,order:3});gl.material=GLOW}
    }
    const sideG=new THREE.BoxGeometry(.14,H,1.5);
    [-.07,W+.07].forEach(xx=>{add(sideG,CAB,xx,H/2,-.03,{cast:true});add(new THREE.BoxGeometry(.02,H,.02),ALU,xx,H/2,.74)});
    BACK.map.repeat.set(W/2,H/2);
    add(new THREE.BoxGeometry(W+.24,H,.05),BACK,W/2,H/2,-.78);

    // tomes, une série = un bloc instancié
    const byS=new Map();
    for(const q of pos){let a=byS.get(q.p.s.id);if(!a){a=[];byS.set(q.p.s.id,a)}
      const r=rng(hash(q.p.s.id)+q.i*31),ghost=q.i>=q.p.u.solid;
      a.push({x:q.x,y:baseY(q.row)+T.h/2,z:ghost?0:(r()-.5)*.035,rz:ghost?0:(r()-.5)*.012})}
    const box=new THREE.Vector4(6/T.cw,1-6/T.cw,12/512,(12+T.bh)/512);
    for(const p of plan){
      const s=p.s,P=byS.get(s.id);if(!P)continue;
      const {pal,tpl}=styleFor(s),solid=Math.min(p.u.solid,P.length);
      const rec={s,pal,tpl,pos:P,solid,count:P.length,art:tpl.kind==='art',spines:[]};
      const coverC=bodyColor(pal,tpl);
      rec.body=mat({color:coverC,roughness:T.rough,metalness:0});
      rec.bodyG=mat({color:coverC,roughness:T.rough},{ghost:true});
      const map=spineTexture(s,pal,tpl,0),dcol=lin(tpl.digit);rec.dcol=dcol;rec.map=map;
      const mk=(from,to,ghost)=>{const n=to-from;if(n<=0)return null;
        const nums=[];for(let i=from;i<to;i++)nums.push(i+1);
        const spine=mat({map,roughness:T.rough},{num:{box,color:dcol},ghost,opacity:.15});rec.spines.push(spine);
        const im=new THREE.InstancedMesh(instGeo(mergedGeo[tab],nums),[ghost?rec.bodyG:rec.body,ghost?PAGES_G[tab]:PAGES[tab],spine],n);
        for(let i=0;i<n;i++)im.setMatrixAt(i,placeMatrix(P[from+i],false));
        im.instanceMatrix.needsUpdate=true;
        const bb=new THREE.Box3();for(let i=from;i<to;i++)bb.expandByPoint(V.set(P[i].x,P[i].y,0));
        const big=new THREE.Sphere();bb.getBoundingSphere(big);big.radius+=1.3;const one=mergedGeo[tab].boundingSphere;
        im.geometry.boundingSphere=big;
        im.raycast=function(r,hits){this.geometry.boundingSphere=one;try{THREE.InstancedMesh.prototype.raycast.call(this,r,hits)}finally{this.geometry.boundingSphere=big}};
        im.castShadow=!ghost;im.receiveShadow=!ghost;if(ghost)im.renderOrder=1;
        im.userData={rec,offset:from};shelf.add(im);inst.push(im);return im};
      rec.solidMesh=mk(0,solid,false);rec.ghostMesh=mk(solid,P.length,true);
      recs.push(rec);
    }
    fitCamera(keep);updateHeader();
    if(prev){const [sid,i]=prev.split(':');const rec=recs.find(r=>r.s.id===sid);
      if(rec)selectUnit(rec,clamp(+i,1,rec.count),false,true);else closePanel()}
  }catch(err){console.error(err);toast("L'étagère n'a pas pu s'afficher. Recharge la page pour réessayer.")}
}

function bodyColor(pal,tpl){return tpl.kind==='band'?lin('#ebe7de'):tpl.kind==='dark'?lin('#17181d'):pal.three}
// une couverture vient d'arriver : on repeint la série sans reconstruire l'étagère
function restyle(rec){
  const st=styleFor(rec.s);if(st.tpl.kind!=='art'||rec.art)return;
  rec.pal=st.pal;rec.tpl=st.tpl;rec.art=true;
  const map=spineTexture(rec.s,st.pal,st.tpl,0);
  rec.spines.forEach(m=>{m.map=map;m.needsUpdate=true});if(rec.map)rec.map.dispose();rec.map=map;
  rec.dcol.copy(lin(st.tpl.digit));const bc=bodyColor(st.pal,st.tpl);rec.body.color.copy(bc);rec.bodyG.color.copy(bc);
  for(const m of proxies.values())if(m.userData.rec===rec){const u=m.userData,old=u.spine.map;u.spine.map=spineTexture(rec.s,rec.pal,rec.tpl,u.idx);u.spine.needsUpdate=true;old.dispose();if(u.cover){removeCover(m);addCover(m)}}
}

/* ---------- tomes sortis ---------- */
function getProxy(rec,idx){
  const key=rec.s.id+':'+idx;let m=proxies.get(key);if(m)return m;
  const ghost=idx>rec.solid,T=TYPE[tab];
  const spine=mat({map:spineTexture(rec.s,rec.pal,rec.tpl,idx),roughness:T.rough},{ghost,opacity:.4});
  const body=ghost?rec.bodyG:rec.body,pages=ghost?PAGES_G[tab]:PAGES[tab];
  m=new THREE.Mesh(boxGeo[tab],[body,body,pages,pages,spine,body]);m.castShadow=!ghost;m.receiveShadow=true;
  const p=rec.pos[idx-1];m.position.set(p.x,p.y,p.z);m.rotation.z=p.rz;
  m.userData={proxy:true,rec,idx,ghost,key,base:p,pull:0,hover:0,tp:0,th:0,spine};
  shelf.add(m);proxies.set(key,m);setInst(rec,idx,false);return m;
}
function releaseProxy(m,skipRestore){
  const u=m.userData;shelf.remove(m);u.spine.map.dispose();u.spine.dispose();removeCover(m);
  if(!skipRestore){setInst(u.rec,u.idx,true);proxies.delete(u.key)}
}
function addCover(m){const u=m.userData;if(u.cover)return;
  u.cover=mat({map:coverTexture(u.rec.s,u.rec.pal,u.rec.tpl,u.idx),roughness:tab==='anime'?.18:.4},{ghost:u.ghost,opacity:.6});
  m.material=[u.cover,...m.material.slice(1)]}
function removeCover(m){const u=m.userData;if(!u.cover)return;m.material=[m.material[1],...m.material.slice(1)];u.cover.map.dispose();u.cover.dispose();u.cover=null}
const deg=THREE.MathUtils.degToRad;
function selectUnit(rec,idx,move,instant){
  const key=rec.s.id+':'+idx;
  if(selKey&&selKey!==key){const o=proxies.get(selKey);if(o){o.userData.tp=0;removeCover(o)}}
  const m=getProxy(rec,idx);m.userData.tp=1;selKey=key;addCover(m);
  if(instant){m.userData.pull=1;m.userData.hover=0}
  if(move){const T=TYPE[tab],narrow=innerWidth<=720,bh=T.h*1.25,bw=T.d*1.3;
    const needH=Math.max(bh/(narrow?.38:.6),bw/((narrow?.75:.45)*camera.aspect));
    cam.td=needH/(2*Math.tan(deg(camera.fov/2)))+1.4;const v=vis(cam.td);
    cam.tx=m.userData.base.x+(narrow?0:v.w*.18);cam.ty=m.userData.base.y+.2-(narrow?v.h*.2:0);clampCam()}
  renderPanel();
}
function closePanel(){if(selKey){const m=proxies.get(selKey);if(m){m.userData.tp=0;removeCover(m)}}selKey=null;$('#panel').hidden=true}
function setHover(hit){
  const key=hit?hit.rec.s.id+':'+hit.idx:null;if(key===hovKey)return;
  if(hovKey){const o=proxies.get(hovKey);if(o)o.userData.th=0}
  hovKey=key;if(hit)getProxy(hit.rec,hit.idx).userData.th=1;
}

/* ---------- caméra ---------- */
function vis(d){const h=2*d*Math.tan(deg(camera.fov/2));return{h,w:h*camera.aspect}}
function fitCamera(keep){
  const {H,W}=layout;cam.fitD=(H*1.12/2)/Math.tan(deg(camera.fov/2));
  if(!keep){const narrow=camera.aspect<.9;cam.td=narrow?cam.fitD*.5:cam.fitD;const v=vis(cam.td);
    cam.tx=Math.min(v.w/2,W/2);cam.ty=narrow?H-v.h/2:H/2;cam.x=cam.tx;cam.y=cam.ty;cam.d=cam.td}
  clampCam();
}
function clampCam(){const {W,H}=layout;cam.td=clamp(cam.td,2.2,cam.fitD*1.15);const v=vis(cam.td);
  cam.tx=v.w>=W?W/2:clamp(cam.tx,v.w*.35,W-v.w*.35);cam.ty=v.h>=H?H/2:clamp(cam.ty,v.h*.4,H-v.h*.4)}
let SW=1,SH=1;
function resize(){const r=stage.getBoundingClientRect();SW=Math.max(1,r.width);SH=Math.max(1,r.height);renderer.setSize(SW,SH,false);camera.aspect=SW/SH;camera.updateProjectionMatrix();clampCam()}
new ResizeObserver(resize).observe(stage);

/* ---------- interactions ---------- */
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),pointers=new Map();
let down=null,dragging=false,pinch0=0,d0=0;
function pick(e){
  const r=canvas.getBoundingClientRect();ndc.set(((e.clientX-r.left)/r.width)*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(ndc,camera);
  const hits=ray.intersectObjects([...inst,...proxies.values()],false);
  for(const h of hits){const u=h.object.userData;
    if(u.proxy)return{rec:u.rec,idx:u.idx};
    if(h.instanceId!=null){const idx=u.offset+h.instanceId+1;if(!proxies.has(u.rec.s.id+':'+idx))return{rec:u.rec,idx}}}
  return null;
}
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){const [a,b]=[...pointers.values()];pinch0=Math.hypot(a.x-b.x,a.y-b.y);d0=cam.td;dragging=true}
  else{down={x:e.clientX,y:e.clientY,lx:e.clientX,ly:e.clientY};dragging=false}});
canvas.addEventListener('pointermove',e=>{
  const r=canvas.getBoundingClientRect();
  if(e.pointerType==='mouse'){par.tx=((e.clientX-r.left)/r.width)*2-1;par.ty=((e.clientY-r.top)/r.height)*2-1}
  if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(pointers.size===2){const [a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch0>0&&d>0){cam.td=d0*pinch0/d;clampCam()}return}
  if(down){const dx=e.clientX-down.lx,dy=e.clientY-down.ly;
    if(!dragging&&Math.hypot(e.clientX-down.x,e.clientY-down.y)>6){dragging=true;canvas.classList.add('dragging');setHover(null)}
    if(dragging){const k=vis(cam.d).h/r.height;cam.tx-=dx*k;cam.ty+=dy*k;clampCam();if(reduce){cam.x=cam.tx;cam.y=cam.ty}}
    down.lx=e.clientX;down.ly=e.clientY;return}
  if(e.pointerType==='mouse'){const h=pick(e);setHover(h);canvas.classList.toggle('hovering',!!h)}
});
function endPointer(e){
  const wasDrag=dragging;pointers.delete(e.pointerId);
  if(pointers.size===0){
    if(down&&!wasDrag&&e.type==='pointerup'){const h=pick(e);if(h){(h.rec.s.id+':'+h.idx)===selKey?closePanel():selectUnit(h.rec,h.idx,true,false)}}
    down=null;dragging=false;pinch0=0;canvas.classList.remove('dragging')}
}
canvas.addEventListener('pointerup',endPointer);canvas.addEventListener('pointercancel',endPointer);
canvas.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){setHover(null);par.tx=0;par.ty=0}});
canvas.addEventListener('wheel',e=>{e.preventDefault();
  if(e.ctrlKey)cam.td*=1+e.deltaY*.01;else{const dx=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;cam.tx+=dx*vis(cam.d).w*.0012}
  clampCam()},{passive:false});
const panBy=f=>{cam.tx+=vis(cam.d).w*f;clampCam()};
$('#b-left').onclick=()=>panBy(-.7);$('#b-right').onclick=()=>panBy(.7);
$('#b-in').onclick=()=>{cam.td/=1.35;clampCam()};$('#b-out').onclick=()=>{cam.td*=1.35;clampCam()};
addEventListener('keydown',e=>{
  if(e.target.closest&&e.target.closest('input,select,textarea'))return;
  if(e.key==='Escape'){if(!$('#ov-add').hidden)return closeModal('#ov-add');if(!$('#ov-import').hidden)return closeModal('#ov-import');closePanel()}
  if(e.key==='ArrowRight')panBy(.35);if(e.key==='ArrowLeft')panBy(-.35);
  if(e.key==='ArrowUp'){cam.ty+=1;clampCam()}if(e.key==='ArrowDown'){cam.ty-=1;clampCam()}
});

/* ---------- panneau ---------- */
function findSeries(id){return state[tab].find(s=>s.id===id)}
function opts(sel){return ORDER.map(k=>`<option value="${k}"${k===sel?' selected':''}>${tab==='anime'?STATUS[k].a:STATUS[k].m}</option>`).join('')}
function scoreOpts(sel){let o=`<option value="0"${!sel?' selected':''}>—</option>`;for(let i=10;i>=1;i--)o+=`<option value="${i}"${i===sel?' selected':''}>${i}</option>`;return o}
function renderPanel(){
  const p=$('#panel');const m=selKey&&proxies.get(selKey);if(!m){p.hidden=true;return}
  const {rec,idx,ghost}=m.userData,s=findSeries(rec.s.id);if(!s){closePanel();return}
  const T=TYPE[tab];
  const kind=tab==='anime'?`Coffret ${idx} · ép. ${(idx-1)*EPS+1}–${idx*EPS}`:`Tome ${idx}`;
  const stateTxt=ghost?(tab==='anime'?'pas encore vu':'pas encore lu'):(tab==='anime'?'vu':'lu');
  const pct=s.total>0?Math.round(Math.min(1,s.done/s.total)*100):null;
  const unitLbl=tab==='anime'?'Épisodes':'Tomes';
  const jumpN=tab==='anime'?Math.min(idx*EPS,s.total||idx*EPS):idx;
  p.innerHTML=`
    <div class="p-top"><span class="p-kind">${kind} · ${stateTxt}</span><button class="x" id="p-close" aria-label="Fermer">×</button></div>
    <h2 class="p-title">${esc(s.title)}</h2>
    <div class="pills"><span class="pill" style="background:${STATUS[s.status].c}">${tab==='anime'?STATUS[s.status].a:STATUS[s.status].m}</span>
      ${s.score?`<span class="pill" style="background:var(--ink);color:var(--surface)">${s.score}/10</span>`:''}
      ${s.example?'<span class="pill ex">Exemple</span>':''}${s.estimated?'<span class="pill ex">Tomes estimés</span>':''}</div>
    <div class="prog"><div class="prog-bar"><span style="width:${pct??100}%;${pct===null?'opacity:.35':''}"></span></div>
      <small>${s.done} ${unitLbl.toLowerCase()} ${T.verb}${s.total?` sur ${s.total}`:' · série en cours de parution'}</small></div>
    <div class="grid2">
      <label class="f">Statut<select id="p-status">${opts(s.status)}</select></label>
      <label class="f">Note /10<select id="p-score">${scoreOpts(s.score)}</select></label>
      <label class="f">${unitLbl} ${T.verb}<input id="p-done" type="number" min="0" max="3000" value="${s.done}"></label>
      <label class="f">${unitLbl} ${tab==='anime'?'au total':'parus'}<input id="p-total" type="number" min="0" max="3000" value="${s.total}"></label>
    </div>
    <div class="row">
      ${jumpN!==s.done?`<button class="btn primary" id="p-jump">${tab==='anime'?`J'ai vu jusqu'à l'ép. ${jumpN}`:`J'ai lu jusqu'au tome ${idx}`}</button>`:''}
      <button class="btn danger" id="p-del">Retirer</button>
    </div>
    ${s.al&&s.al.id?`<a class="note" href="https://anilist.co/${tab}/${s.al.id}" target="_blank" rel="noopener">Voir la fiche sur AniList</a>`:''}
    <div id="p-confirm"></div>`;
  p.hidden=false;
  $('#p-close').onclick=closePanel;
  const upd=fn=>{fn(s);s.example=false;if(s.status==='termine'&&s.total>0)s.done=s.total;save();build(true)};
  $('#p-status').onchange=e=>upd(s=>s.status=e.target.value);
  $('#p-score').onchange=e=>upd(s=>s.score=+e.target.value);
  $('#p-done').onchange=e=>upd(s=>{s.done=clamp(+e.target.value||0,0,3000);s.estimated=false});
  $('#p-total').onchange=e=>upd(s=>s.total=clamp(+e.target.value||0,0,3000));
  const j=$('#p-jump');if(j)j.onclick=()=>upd(s=>{s.done=jumpN;s.estimated=false;if(s.status==='a_lire')s.status='en_cours';if(s.total&&s.done>=s.total)s.status='termine'});
  $('#p-del').onclick=()=>{$('#p-confirm').innerHTML=`<div class="confirm"><span>Retirer « ${esc(s.title)} » de l'étagère ?</span><div class="row"><button class="btn danger" id="p-del-ok">Retirer</button><button class="btn" id="p-del-no">Garder</button></div></div>`;
    $('#p-del-no').onclick=()=>$('#p-confirm').innerHTML='';
    $('#p-del-ok').onclick=()=>{state[tab]=state[tab].filter(x=>x.id!==s.id);save();closePanel();build(true);toast(`« ${s.title} » retiré`)}};
}

/* ---------- en-tête ---------- */
function updateHeader(){
  document.querySelectorAll('.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===tab));
  const l=state[tab];const done=l.reduce((a,s)=>a+s.done,0);
  $('#stats').innerHTML=`<b>${l.length}</b> séries · <b>${done.toLocaleString('fr-FR')}</b> ${tab==='manga'?'tomes lus':'épisodes vus'}`;
  $('#banner').hidden=!l.some(s=>s.example);
  $('#legend').innerHTML=ORDER.map(k=>`<span><i style="background:${STATUS[k].c};border-radius:50%"></i>${tab==='anime'?STATUS[k].a:STATUS[k].m}</span>`).join('')+`<span><i style="background:transparent;border:1px dashed #8a90a0"></i>${tab==='anime'?'Non vu':'Non lu'}</span>`;
}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{if(tab===b.dataset.tab)return;closePanel();tab=b.dataset.tab;build(false);progress()});
$('#sort').onchange=e=>{sortBy=e.target.value;build(true)};
function toast(t){const el=$('#toast');el.textContent=t;el.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>el.hidden=true,3500)}

/* ---------- modales ---------- */
function openModal(id){$(id).hidden=false;const f=$(id).querySelector('input:not([type=file]),button');f&&f.focus()}
function closeModal(id){$(id).hidden=true}
['#ov-import','#ov-add'].forEach(id=>$(id).addEventListener('click',e=>{if(e.target.id===id.slice(1))closeModal(id)}));
$('#btn-import').onclick=$('#banner-import').onclick=()=>{$('#imp-err').hidden=true;openModal('#ov-import')};
$('#imp-close').onclick=()=>closeModal('#ov-import');
$('#btn-add').onclick=()=>{
  $('#add-form').reset();
  $('#add-t').textContent=tab==='anime'?'Ajouter un anime':'Ajouter un manga';
  $('#a-done-l').textContent=tab==='anime'?'Épisodes vus':'Tomes lus';$('#a-total-l').textContent=tab==='anime'?'Épisodes au total':'Tomes parus';
  $('#a-status').innerHTML=opts('en_cours');$('#a-score').innerHTML=scoreOpts(0);alPick=null;renderResults(null);$('#a-picked').hidden=true;openModal('#ov-add')};
$('#add-close').onclick=()=>closeModal('#ov-add');
$('#add-form').onsubmit=e=>{e.preventDefault();
  const s={id:uid(),title:$('#a-title').value.trim().slice(0,80),done:clamp(+$('#a-done').value||0,0,3000),total:clamp(+$('#a-total').value||0,0,3000),status:$('#a-status').value,score:+$('#a-score').value};
  if(!s.title)return;if(alPick)applyAl(s,tab,alPick);if(s.status==='termine'&&s.total)s.done=s.total;
  state[tab].push(s);save();closeModal('#ov-add');build(true);
  const rec=recs.find(r=>r.s.id===s.id);if(rec)selectUnit(rec,Math.max(1,rec.solid),true,false);
  toast(`« ${s.title} » rangé sur l'étagère`);if(!s.al)enrich()};

/* ---------- import MyAnimeList ---------- */
const MAP={'completed':'termine','reading':'en_cours','watching':'en_cours','on-hold':'pause','dropped':'abandonne','plan to read':'a_lire','plan to watch':'a_lire','1':'en_cours','2':'termine','3':'pause','4':'abandonne','6':'a_lire'};
async function readText(file){
  const buf=await file.arrayBuffer(),u=new Uint8Array(buf);
  if(u[0]===0x1f&&u[1]===0x8b){if(!('DecompressionStream' in window))throw new Error("Ton navigateur ne sait pas ouvrir les fichiers .gz. Décompresse-le d'abord, puis dépose le fichier .xml.");
    return await new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text()}
  return new TextDecoder().decode(buf);
}
function parseMAL(text){
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.querySelector('parsererror')||!doc.querySelector('myanimelist'))throw new Error("Ce fichier n'est pas un export MyAnimeList. Prends bien le fichier issu de la page d'export.");
  const g=(n,tags)=>{for(const t of tags){const e=n.getElementsByTagName(t)[0];if(e)return e.textContent.trim()}return ''};
  const out={manga:[],anime:[]};
  for(const n of doc.getElementsByTagName('manga')){
    const title=g(n,['manga_title','series_title']);if(!title)continue;
    const total=parseInt(g(n,['manga_volumes','series_volumes']))||0;let done=parseInt(g(n,['my_read_volumes']))||0;
    const ch=parseInt(g(n,['my_read_chapters']))||0;const status=MAP[g(n,['my_status']).toLowerCase()]||'en_cours';let est=false;
    if(status==='termine'&&total)done=total;else if(!done&&ch>0){done=Math.max(1,Math.round(ch/9));est=true}
    out.manga.push({id:uid(),title,malId:parseInt(g(n,['manga_mangadb_id','series_mangadb_id']))||0,done:Math.min(done,3000),total:Math.min(total,3000),status,score:parseInt(g(n,['my_score']))||0,estimated:est})}
  for(const n of doc.getElementsByTagName('anime')){
    const title=g(n,['series_title']);if(!title)continue;
    const total=parseInt(g(n,['series_episodes']))||0;let done=parseInt(g(n,['my_watched_episodes']))||0;
    const status=MAP[g(n,['my_status']).toLowerCase()]||'en_cours';if(status==='termine'&&total)done=total;
    out.anime.push({id:uid(),title,malId:parseInt(g(n,['series_animedb_id']))||0,done:Math.min(done,3000),total:Math.min(total,3000),status,score:parseInt(g(n,['my_score']))||0})}
  if(!out.manga.length&&!out.anime.length)throw new Error("Le fichier ne contient aucune série. Ta liste MyAnimeList est peut-être vide.");
  return out;
}
async function importFile(file){
  const err=$('#imp-err');err.hidden=true;
  try{
    const res=parseMAL(await readText(file));const msg=[];
    for(const k of ['manga','anime']){if(!res[k].length)continue;
      const keep=state[k].filter(s=>!s.example);const byT=new Map(keep.map(s=>[s.title.toLowerCase(),s]));
      for(const s of res[k]){const ex=byT.get(s.title.toLowerCase());if(ex){if(s.malId&&ex.malId!==s.malId){delete ex.al;delete ex.alMiss}Object.assign(ex,{done:s.done,total:s.total,status:s.status,score:s.score,estimated:s.estimated,malId:s.malId||ex.malId})}else{keep.push(s);byT.set(s.title.toLowerCase(),s)}}
      state[k]=keep;msg.push(`${res[k].length} ${k==='manga'?'mangas':'animes'}`);tab=k}
    save();closeModal('#ov-import');closePanel();build(false);toast(`Import réussi : ${msg.join(' et ')}. Les couvertures arrivent au fur et à mesure.`);enrich();
  }catch(e){err.textContent=e.message||"Le fichier n'a pas pu être lu.";err.hidden=false}
}
$('#file').onchange=e=>{const f=e.target.files[0];if(f)importFile(f);e.target.value=''};
const drop=$('#drop');
['dragenter','dragover'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.add('over')}));
['dragleave','drop'].forEach(t=>drop.addEventListener(t,e=>{e.preventDefault();drop.classList.remove('over')}));
drop.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)importFile(f)});

/* ---------- AniList : couvertures et recherche ---------- */
const AL_URL='https://graphql.anilist.co';
const FIELDS='id idMal title{romaji english} coverImage{extraLarge large color} volumes episodes';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let alViaProxy=false,alNext=0,alChain=Promise.resolve();
// une requête toutes les ~2,1 s pour rester sous la limite actuelle d'AniList (30/min)
function alQuery(query,variables){
  const run=async()=>{
    for(let attempt=0;attempt<4;attempt++){
      const wait=alNext-Date.now();if(wait>0)await sleep(wait);
      alNext=Date.now()+2100;
      let r;
      try{r=await fetch(alViaProxy?'/api/anilist':AL_URL,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({query,variables})})}
      catch(e){if(!alViaProxy){alViaProxy=true;continue}throw e}
      if(r.status===429){alNext=Date.now()+(parseInt(r.headers.get('Retry-After'))||60)*1000;continue}
      const j=await r.json().catch(()=>null);
      if(j&&j.data)return j.data;
      if(r.status>=500){await sleep(3000);continue}
      throw new Error('AniList '+r.status);
    }
    throw new Error('AniList indisponible');
  };
  const p=alChain.then(run,run);alChain=p.catch(()=>{});return p;
}
const alInfo=m=>({id:m.id,cover:m.coverImage&&(m.coverImage.large||m.coverImage.extraLarge)||null,coverXL:m.coverImage&&(m.coverImage.extraLarge||m.coverImage.large)||null,color:m.coverImage&&m.coverImage.color||null,volumes:m.volumes||0,episodes:m.episodes||0});
const alTitle=m=>(m.title&&(m.title.english||m.title.romaji))||'';
function applyAl(s,kind,m){
  s.al=alInfo(m);if(!s.malId&&m.idMal)s.malId=m.idMal;delete s.alMiss;
  const t=kind==='manga'?s.al.volumes:s.al.episodes;
  if(!s.total&&t>0)s.total=Math.min(3000,t);
  if(s.status==='termine'&&s.total)s.done=s.total;
}
let enriching=false,restyleTimer=0;
function pendingCount(kind){return state[kind].filter(s=>!s.al&&!s.alMiss).length}
async function enrich(){
  if(enriching)return;enriching=true;progress();
  let failed=false;
  try{
    for(const kind of [tab,tab==='manga'?'anime':'manga']){
      const T=kind==='manga'?'MANGA':'ANIME';
      let todo=state[kind].filter(s=>!s.al&&!s.alMiss&&s.malId);
      for(let i=0;i<todo.length;i+=50){
        const chunk=todo.slice(i,i+50);
        const d=await alQuery(`query($ids:[Int]){Page(perPage:50){media(idMal_in:$ids,type:${T}){${FIELDS}}}}`,{ids:chunk.map(s=>s.malId)});
        const by=new Map(((d.Page&&d.Page.media)||[]).map(m=>[m.idMal,m]));
        chunk.forEach(s=>{const m=by.get(s.malId);if(m)applyAl(s,kind,m);else{s.malId=0}});
        afterBatch(kind);
      }
      todo=state[kind].filter(s=>!s.al&&!s.alMiss);
      for(let i=0;i<todo.length;i+=8){
        const chunk=todo.slice(i,i+8);
        const q='query('+chunk.map((_,j)=>`$q${j}:String`).join(',')+'){'+chunk.map((_,j)=>`a${j}:Media(search:$q${j},type:${T}){${FIELDS}}`).join(' ')+'}';
        const vars={};chunk.forEach((s,j)=>vars['q'+j]=s.q||s.title);
        const d=await alQuery(q,vars);
        chunk.forEach((s,j)=>{const m=d['a'+j];if(m)applyAl(s,kind,m);else s.alMiss=1});
        afterBatch(kind);
      }
    }
  }catch(e){console.warn(e);failed=true}
  finally{enriching=false;progress();if(failed)toast("AniList ne répond pas pour l'instant. Les couvertures manquantes seront récupérées à ta prochaine visite.")}
}
function afterBatch(kind){save();progress();if(kind!==tab)return;
  // les volumes connus d'AniList peuvent ajouter des tomes « non lus » : on reconstruit si besoin
  clearTimeout(restyleTimer);restyleTimer=setTimeout(()=>{const before=recs.map(r=>r.count).join(',');
    const now=sorted().map(s=>{const u=units(s);return u.solid+u.ghost}).join(',');
    if(before!==now)build(true);else recs.forEach(r=>{if(r.s.al&&r.s.al.cover)coverImg(r.s.al.cover)})},400)}
function progress(){
  const el=$('#al-progress');if(!el)return;const n=pendingCount(tab),tot=state[tab].length;
  el.hidden=!(enriching&&n>0);el.textContent=`Couvertures : ${tot-n}/${tot}`;
}
// images : passent par le relais du site (/api/cover) pour être utilisables en 3D
const IMG=new Map();
function coverImg(url,quiet){
  let e=IMG.get(url);
  if(!e){e={img:null,tries:0};IMG.set(url,e);
    const im=new Image();im.crossOrigin='anonymous';im.decoding='async';
    im.onload=()=>{e.img=im;onImg(url)};
    im.onerror=()=>{e.tries++;if(e.tries===1)im.src=url;};
    im.src=location.protocol.startsWith('http')?'/api/cover?u='+encodeURIComponent(url):url;}
  return e.img;
}
let imgQueue=new Set(),imgTimer=0;
function onImg(url){imgQueue.add(url);if(imgTimer)return;imgTimer=requestAnimationFrame(()=>{imgTimer=0;const q=imgQueue;imgQueue=new Set();
  for(const rec of recs){const a=rec.s.al;if(!a)continue;
    if(q.has(a.cover))restyle(rec);
    if(q.has(a.coverXL))for(const m of proxies.values())if(m.userData.rec===rec&&m.userData.cover){removeCover(m);addCover(m)}}})}

/* ---------- recherche AniList dans « Ajouter » ---------- */
let alPick=null,searchTimer=0,searchSeq=0;
function renderResults(list){
  const box=$('#a-results');
  if(!list){box.hidden=true;box.innerHTML='';return}
  box.hidden=false;
  if(!list.length){box.innerHTML='<p class="al-empty">Aucune série trouvée sur AniList. Tu peux quand même l\'ajouter avec ce titre.</p>';return}
  box.innerHTML=list.map((m,i)=>{const t=tab==='manga'?(m.volumes?`${m.volumes} tomes`:'En cours de parution'):(m.episodes?`${m.episodes} épisodes`:'En cours de diffusion');
    const img=m.coverImage&&m.coverImage.large?`<img alt="" loading="lazy" src="${location.protocol.startsWith('http')?'/api/cover?u='+encodeURIComponent(m.coverImage.large):m.coverImage.large}">`:'<span class="ph"></span>';
    return `<button type="button" class="al-item" data-i="${i}">${img}<span><b>${esc(alTitle(m))}</b><small>${esc(m.title.romaji&&m.title.romaji!==alTitle(m)?m.title.romaji+' · ':'')}${t}</small></span></button>`}).join('');
  box.querySelectorAll('.al-item').forEach(b=>b.onclick=()=>{const m=list[+b.dataset.i];alPick=m;
    $('#a-title').value=alTitle(m);const t=tab==='manga'?m.volumes:m.episodes;if(t)$('#a-total').value=t;
    renderResults(null);$('#a-picked').hidden=false;$('#a-picked').textContent='Fiche AniList sélectionnée : la couverture sera ajoutée.'})
}
$('#a-title').addEventListener('input',()=>{
  alPick=null;$('#a-picked').hidden=true;clearTimeout(searchTimer);const q=$('#a-title').value.trim();
  if(q.length<2){renderResults(null);return}
  searchTimer=setTimeout(async()=>{const seq=++searchSeq;
    try{const d=await alQuery(`query($q:String){Page(perPage:6){media(search:$q,type:${tab==='manga'?'MANGA':'ANIME'},sort:SEARCH_MATCH){${FIELDS}}}}`,{q});
      if(seq===searchSeq&&!$('#ov-add').hidden)renderResults((d.Page&&d.Page.media)||[])}
    catch(e){if(seq===searchSeq){$('#a-results').hidden=false;$('#a-results').innerHTML='<p class="al-empty">La recherche AniList ne répond pas. Tu peux remplir les champs à la main.</p>'}}},450)});

/* ---------- boucle ---------- */
function frame(){
  requestAnimationFrame(frame);
  const k=reduce?1:.12;
  cam.x+=(cam.tx-cam.x)*k;cam.y+=(cam.ty-cam.y)*k;cam.d+=(cam.td-cam.d)*k;
  par.x+=(par.tx-par.x)*.06;par.y+=(par.ty-par.y)*.06;
  const pf=reduce?0:cam.d/7;
  camera.position.set(cam.x+par.x*.9*pf,cam.y-par.y*.5*pf,cam.d);camera.lookAt(cam.x,cam.y,0);
  // la lumière principale suit la zone regardée pour garder des ombres nettes
  const v=vis(cam.d),half=Math.max(v.w,v.h)*.62+1.5,sc=key.shadow.camera;
  key.target.position.set(cam.x,cam.y,0);key.position.set(cam.x-3,cam.y+4.5,11);
  if(Math.abs(sc.right-half)>.05){sc.left=-half;sc.right=half;sc.top=half;sc.bottom=-half;sc.near=1;sc.far=30;sc.updateProjectionMatrix()}
  for(const m of [...proxies.values()]){const u=m.userData;
    u.pull+=(u.tp-u.pull)*(reduce?1:.14);u.hover+=(u.th-u.hover)*(reduce?1:.2);
    if(Math.abs(u.pull-u.tp)<.003)u.pull=u.tp;if(Math.abs(u.hover-u.th)<.003)u.hover=u.th;
    if(u.tp===0&&u.th===0&&u.pull===0&&u.hover===0){releaseProxy(m);continue}
    m.position.set(u.base.x,u.base.y+u.pull*.28,u.base.z+u.hover*.16+u.pull*1.4);
    m.rotation.set(0,-u.pull*(Math.PI/2-.3),u.base.rz*(1-u.pull));m.scale.setScalar(1+u.pull*.18)}
  renderer.render(scene,camera);
}
try{await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,2500))])}catch(e){}
resize();build(false);frame();
// les couvertures déjà connues sont chargées, les autres sont demandées à AniList
recs.forEach(r=>{if(r.s.al&&r.s.al.cover)coverImg(r.s.al.cover)});enrich();
})();
