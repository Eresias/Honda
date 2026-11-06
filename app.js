(async function(){
const $=s=>document.querySelector(s);
const STATUS={
  en_cours:{m:'En cours',a:'En cours',c:'#3d7fd6'},
  termine:{m:'Terminé',a:'Terminé',c:'#3f9d6e'},
  pause:{m:'En pause',a:'En pause',c:'#c9902a'},
  a_lire:{m:'À lire',a:'À voir',g:'À jouer',c:'#8a8fa3'},
  abandonne:{m:'Abandonné',a:'Abandonné',c:'#b8524a'},
  cent:{m:'100 %',a:'100 %',g:'100 % / Platiné',c:'#9b6cf0'}
};
const ORDERS={manga:['en_cours','termine','pause','a_lire','abandonne'],anime:['en_cours','termine','pause','a_lire','abandonne'],game:['en_cours','termine','cent','pause','a_lire','abandonne']};
const ord=()=>ORDERS[tab];
// boîtiers génériques par famille de plateforme (tailles réelles approximatives, sans logos)
const GAME_PF={
  switch:{label:'Switch',short:'SWITCH',w:.11,h:1.7,d:1.05,cw:52,band:'#e4002b',body:'#c2121f'},
  ps:{label:'PlayStation',short:'PS',w:.14,h:1.71,d:1.35,cw:64,band:'#0b5fd1',body:'#0a3f8f'},
  xbox:{label:'Xbox',short:'XBOX',w:.14,h:1.9,d:1.35,cw:64,band:'#16a116',body:'#0d6b0d'},
  pc:{label:'PC',short:'PC',w:.14,h:1.9,d:1.35,cw:64,band:'#3a3f4b',body:'#1c1e24'},
  other:{label:'Autre',short:'JEU',w:.14,h:1.8,d:1.3,cw:64,band:'#6b6f7a',body:'#34363e'}
};
const EPS=12, KEY='hondana.v1'; // clé gardée telle quelle pour ne pas perdre les bibliothèques déjà enregistrées
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const uid=()=>Math.random().toString(36).slice(2,10);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const esc=t=>String(t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

/* ---------- données ---------- */
const mk=(title,done,total,status,score,owned)=>({id:uid(),title,done,total,status,score,owned:owned||done,example:true});
const EXAMPLE={
  manga:[mk('One Piece',105,0,'en_cours',9,108),mk('Berserk',41,0,'en_cours',10),mk('Frieren',13,0,'en_cours',9),
    mk('Vinland Saga',14,14,'termine',9),mk('Chainsaw Man',12,0,'en_cours',8),mk('Spy x Family',5,0,'pause',7,7),
    mk('Death Note',12,12,'termine',8),mk('Monster',7,18,'en_cours',9,10),mk('Fullmetal Alchemist',27,27,'termine',10),mk('Blue Period',0,0,'a_lire',0,3)],
  anime:[mk('Frieren',28,28,'termine',10),mk('Cowboy Bebop',26,26,'termine',9),{...mk("L'Attaque des Titans",87,87,'termine',9),q:'Shingeki no Kyojin'},
    mk('Jujutsu Kaisen',24,47,'en_cours',8),mk('Mob Psycho 100',37,37,'termine',9),mk('Dandadan',12,24,'en_cours',8),mk('Monster',0,74,'a_lire',0)],
  game:[['The Legend of Zelda: Tears of the Kingdom','switch','termine',10],['Elden Ring','ps','cent',10],['Hollow Knight','pc','en_cours',9],
    ['Final Fantasy VII Rebirth','ps','en_cours',9],['Hades','switch','termine',9],['Persona 5 Royal','ps','termine',10],["Baldur's Gate 3",'pc','pause',10],
    ['Forza Horizon 5','xbox','a_lire',0],['Stardew Valley','pc','en_cours',8],['Metroid Dread','switch','termine',8],['Halo Infinite','xbox','abandonne',6]]
    .map(([title,platform,status,score])=>({id:uid(),title,platform,status,score,done:0,total:0,example:true}))
};
function load(){try{const r=localStorage.getItem(KEY);if(r){const d=JSON.parse(r);if(d&&Array.isArray(d.manga)&&Array.isArray(d.anime))return d;}}catch(e){}return null}
// enregistrement : dans le compte si on est connecté, sinon dans ce navigateur
function save(){if(viewing)return;if(acct.user){scheduleSync();return}
  try{localStorage.setItem(KEY,JSON.stringify(state))}catch(e){toast("Ta bibliothèque n'a pas pu être enregistrée dans ce navigateur.")}}
// remet chaque série d'aplomb ; pour les mangas, on possède toujours au moins les tomes lus
function normalize(d){
  const out={};
  for(const k of ['manga','anime','game'])out[k]=(Array.isArray(d&&d[k])?d[k]:[]).filter(s=>s&&typeof s.title==='string'&&s.title.trim()).map(s=>{
    const n={...s,title:s.title.slice(0,200),done:clamp(+s.done||0,0,3000),total:clamp(+s.total||0,0,3000),score:clamp(+s.score||0,0,10),status:STATUS[s.status]?s.status:'en_cours',id:typeof s.id==='string'&&/^[\w-]{1,40}$/.test(s.id)?s.id:uid()};
    if(k==='manga')n.owned=Math.max(clamp(+s.owned||0,0,3000),n.done);else delete n.owned;
    if(k==='game'){n.platform=GAME_PF[s.platform]?s.platform:'other';n.hours=clamp(Math.round(+s.hours||0),0,100000);if(!ORDERS.game.includes(n.status))n.status='en_cours'}
    else if(n.status==='cent')n.status='termine';
    return n});
  return out;
}
// /u/pseudo : on visite la bibliothèque publique de quelqu'un, en lecture seule
const pm=location.pathname.match(/^\/u\/([a-z0-9_-]{3,24})\/?$/);
const viewing=pm?{name:pm[1]}:null;
// connecté sur cet appareil : on attend la bibliothèque du compte au lieu d'afficher les exemples
const CFG0=window.MYWEEBRARY_CONFIG||{};
let loadingAccount=!viewing&&!!(CFG0.supabaseUrl&&CFG0.supabaseKey)&&(()=>{try{for(let i=0;i<localStorage.length;i++)if(/^sb-.+-auth-token$/.test(localStorage.key(i)))return true}catch(e){}return false})();
const state=viewing||loadingAccount?{manga:[],anime:[],game:[]}:normalize(load()||JSON.parse(JSON.stringify(EXAMPLE)));
const fixOwned=s=>{if(tab==='manga')s.owned=Math.max(clamp(+s.owned||0,0,3000),s.done)};
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
function seriesCover(s){return(s.al&&s.al.cover)||(s.igdb&&s.igdb.cover&&igdbImg(s.igdb.cover,'t_cover_big'))||(s.steam&&steamImg(s.steam.appid))||null}
function styleFor(s){
  const cu=seriesCover(s),img=cu?coverImg(cu):null;
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
  anime:{w:.26,h:1.7,d:1.32,cw:80,bh:54,rough:.22,verb:'vus'},
  game:{w:.14,h:1.71,d:1.35,cw:64,bh:0,rough:.25,verb:'joués'}
};
const dimOf=s=>tab==='game'?{...TYPE.game,...(GAME_PF[s.platform]||GAME_PF.other)}:TYPE[tab];
const ROWS=4, ROW_H=2.18, PLANK=.08;

/* ---------- éclairage LED (sous chaque planche) + numéros peints par le shader ---------- */
const LED={uLed:{value:new THREE.Color(.95,1.02,1.15)},uRowH:{value:ROW_H},uBase:{value:PLANK},uTopY:{value:9},uRowOn:{value:new THREE.Vector4(1,1,1,1)}};
const LED_V=`#include <begin_vertex>
{vec4 lw=vec4(transformed,1.0);
#ifdef USE_INSTANCING
lw=instanceMatrix*lw;
#endif
lw=modelMatrix*lw;vLedY=lw.y;vLedN=normalize(mat3(modelMatrix)*objectNormal);}`;
const LED_F=`#include <emissivemap_fragment>
{float t=mod(vLedY-uBase,uRowH);float dist=max(uRowH-uBase-t,0.0);
float g=exp(-dist*2.3)*0.9+0.035;if(vLedY>uTopY||vLedY<0.0)g=0.0;
float rb=clamp(floor((vLedY-uBase)/uRowH),0.0,3.0);g*=rb>2.5?uRowOn.x:(rb>1.5?uRowOn.y:(rb>0.5?uRowOn.z:uRowOn.w));
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
    if(led){Object.assign(sh.uniforms,LED);vh+='varying float vLedY;varying vec3 vLedN;\n';fh+='uniform vec3 uLed;uniform vec4 uRowOn;uniform float uRowH;uniform float uBase;uniform float uTopY;varying float vLedY;varying vec3 vLedN;\n';
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
const boxGeo={},mergedGeo={},GEO=new Map(),KEEPGEO=new Set();
for(const k in TYPE){boxGeo[k]=new THREE.BoxGeometry(TYPE[k].w,TYPE[k].h,TYPE[k].d);mergedGeo[k]=mergedBox(TYPE[k].w,TYPE[k].h,TYPE[k].d);KEEPGEO.add(boxGeo[k]).add(mergedGeo[k])}
// géométries partagées par taille de boîtier
function geoFor(d){const k=`${d.w},${d.h},${d.d}`;let g=GEO.get(k);
  if(!g){g={box:new THREE.BoxGeometry(d.w,d.h,d.d),merged:mergedBox(d.w,d.h,d.d)};GEO.set(k,g);KEEPGEO.add(g.box).add(g.merged)}return g}
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
pagesTex.game=pagesTex.anime;
const PAGES={},PAGES_G={};
for(const k in TYPE){PAGES[k]=mat({color:0xffffff,map:pagesTex[k],roughness:k==='manga'?.9:.3});PAGES_G[k]=mat({color:0xffffff,map:pagesTex[k],roughness:.9},{ghost:true})}

function gameSpine(s,pal,tpl,T){
  const w=T.cw,h=512,[c,x]=canvas2d(w,h);
  x.fillStyle=T.body;x.fillRect(0,0,w,h);
  // bandeau de plateforme en haut, comme sur les boîtiers du commerce
  x.fillStyle=T.band;x.fillRect(0,0,w,46);x.fillStyle='rgba(255,255,255,.18)';x.fillRect(0,46,w,2);
  x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';let fs=17;x.font=`800 ${fs}px "IBM Plex Mono",monospace`;
  while(x.measureText(T.short).width>w-8&&fs>9){fs--;x.font=`800 ${fs}px "IBM Plex Mono",monospace`}x.fillText(T.short,w/2,24);
  let titleY=62;
  if(tpl.kind==='art'){const img=tpl.img,artH=Math.round(h*.3),y0=50;
    const cropH=img.naturalHeight*.5,cropW=Math.min(img.naturalWidth,cropH*(w/artH));
    try{x.drawImage(img,(img.naturalWidth-cropW)/2,img.naturalHeight*.08,cropW,cropH,0,y0,w,artH)}catch(e){}
    const f=x.createLinearGradient(0,y0+artH-50,0,y0+artH);f.addColorStop(0,'rgba(0,0,0,0)');f.addColorStop(1,T.body);x.fillStyle=f;x.fillRect(0,y0+artH-50,w,50);titleY=y0+artH+14}
  const avail=h-titleY-50;fs=w>56?26:22;const F=n=>`700 ${n}px "Zen Kaku Gothic New",system-ui,sans-serif`;x.font=F(fs);
  while(x.measureText(s.title).width>avail&&fs>10){fs--;x.font=F(fs)}
  x.save();x.translate(w/2,titleY);x.rotate(Math.PI/2);x.textAlign='left';x.fillStyle='#fff';x.fillText(s.title,0,0);x.restore();
  x.beginPath();x.arc(w/2,h-26,Math.min(w*.2,10),0,7);x.fillStyle=STATUS[s.status].c;x.fill();x.lineWidth=2;x.strokeStyle='rgba(255,255,255,.85)';x.stroke();
  // reflet du plastique
  const g=x.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(0,0,0,.35)');g.addColorStop(.2,'rgba(255,255,255,.06)');g.addColorStop(.5,'rgba(255,255,255,.14)');g.addColorStop(.8,'rgba(0,0,0,.05)');g.addColorStop(1,'rgba(0,0,0,.4)');
  x.fillStyle=g;x.fillRect(0,0,w,h);
  return tex(c);
}
function spineTexture(s,pal,tpl,num){
  const T=dimOf(s);if(tab==='game')return gameSpine(s,pal,tpl,T);
  const w=T.cw,h=512,[c,x]=canvas2d(w,h);
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
  const want=coverWants(s,idx);let img=null,rank=99;
  for(let i=0;i<want.length;i++){const im=coverImg(want[i]);if(im&&!img){img=im;rank=i}}
  if(img){
    const r=Math.max(W/img.naturalWidth,H/img.naturalHeight),dw=img.naturalWidth*r,dh=img.naturalHeight*r;
    try{x.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh)}catch(e){}
    const g=x.createLinearGradient(0,0,W,0);g.addColorStop(0,'rgba(0,0,0,.25)');g.addColorStop(.05,'rgba(0,0,0,0)');g.addColorStop(.65,'rgba(255,255,255,.05)');g.addColorStop(.8,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,W,H);
    if(tab!=='game'){rr(x,W-96,H-58,80,40,20);x.fillStyle='rgba(12,13,17,.82)';x.fill();
    x.fillStyle='#fff';x.textAlign='center';x.textBaseline='middle';x.font='500 20px "IBM Plex Mono",monospace';
    x.fillText(tab==='anime'?`C.${idx}`:`T.${idx}`,W-56,H-37)}
    return {tex:tex(c),rank};
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
  if(tab==='game'){const T=dimOf(s);x.fillStyle=T.band;x.fillRect(0,0,W,30);x.fillStyle='#fff';x.font='800 16px "IBM Plex Mono",monospace';x.textBaseline='middle';x.fillText(T.short,20,16)}
  else{x.beginPath();x.arc(W-62,H-70,34,0,7);x.fillStyle=tpl.kind==='band'?pal.css:'#ffffff';x.fill();
  x.fillStyle=tpl.kind==='band'?'#fff':'#141519';x.textAlign='center';x.textBaseline='middle';x.font='400 30px "Dela Gothic One",sans-serif';x.fillText(String(idx),W-62,H-68);
  x.textAlign='left';x.fillStyle='#fff';x.font='500 15px "IBM Plex Mono",monospace';x.fillText(tab==='anime'?`COFFRET · ÉP. ${(idx-1)*EPS+1}–${idx*EPS}`:'TOME',40,H-70)}
  x.fillStyle='rgba(255,255,255,.75)';x.beginPath();x.moveTo(40,H-40);x.lineTo(48,H-32);x.lineTo(40,H-24);x.lineTo(32,H-32);x.closePath();x.fill();
  const sh=x.createLinearGradient(0,0,W,0);sh.addColorStop(0,'rgba(255,255,255,0)');sh.addColorStop(.6,'rgba(255,255,255,.06)');sh.addColorStop(.75,'rgba(255,255,255,0)');x.fillStyle=sh;x.fillRect(0,0,W,H);
  return {tex:tex(c),rank:99};
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
let recs=[], inst=[], layout={W:8,H:9,mods:1,OW:7.88,centers:[3.94]};
const proxies=new Map(); let selKey=null, hovKey=null;
const cam={x:4,y:4,d:12,tx:4,ty:4,td:12,fitD:12};
const par={x:0,y:0,tx:0,ty:0};
const READ_C=new THREE.Color(1,1,1),UNREAD_C=new THREE.Color(.11,.115,.14);
const M=new THREE.Matrix4(),Q=new THREE.Quaternion(),V=new THREE.Vector3(),ONE=new THREE.Vector3(1,1,1),Z=new THREE.Vector3(0,0,1);

/* ---------- construction ---------- */
// Meubles de taille fixe, côte à côte : quand l'un est plein, le suivant se remplit.
const MOD_IW={manga:7.6,anime:7.6,game:7.6}, MOD_SIDE=.14, MOD_GAP=.75;
function units(s){return tab==='game'?1:tab==='manga'?Math.max(s.owned||0,s.done):Math.ceil(s.done/EPS)}
function sorted(){
  const l=[...state[tab]];const byT=(a,b)=>a.title.localeCompare(b.title,'fr');
  if(sortBy==='note')l.sort((a,b)=>b.score-a.score||byT(a,b));
  else if(sortBy==='statut')l.sort((a,b)=>ord().indexOf(a.status)-ord().indexOf(b.status)||byT(a,b));
  else if(sortBy==='progression')l.sort((a,b)=>tab==='game'?(b.hours||0)-(a.hours||0)||byT(a,b):b.done-a.done||byT(a,b));
  else l.sort(byT);return l;
}
function placeMatrix(p,hidden){Q.setFromAxisAngle(Z,p.rz);M.compose(V.set(p.x,hidden?-1000:p.y,p.z),Q,ONE);return M}
function setInst(rec,idx,visible){if(!rec.mesh)return;invalidate();rec.mesh.setMatrixAt(idx-1,placeMatrix(rec.pos[idx-1],!visible));rec.mesh.instanceMatrix.needsUpdate=true}
function disposeShelf(){
  for(const m of proxies.values())releaseProxy(m,true);proxies.clear();selKey=null;hovKey=null;
  const mats=new Set(),geos=new Set(),texs=new Set();
  shelf.traverse(o=>{if(o.isMesh){geos.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>mats.add(m))}});
  geos.forEach(g=>{if(!KEEPGEO.has(g))g.dispose()});
  mats.forEach(m=>{if(KEEP.has(m))return;if(m.map&&m.map!==feltTex&&m.map!==wallTex&&m.map!==glowTex)texs.add(m.map);m.dispose()});
  texs.forEach(t=>t.dispose());
  scene.remove(shelf);shelf=new THREE.Group();scene.add(shelf);recs=[];inst=[];
}
function add(geo,material,x,y,z,opt={}){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);m.castShadow=!!opt.cast;m.receiveShadow=opt.receive!==false;if(opt.order)m.renderOrder=opt.order;shelf.add(m);return m}
const modX0=m=>m*(MOD_IW[tab]+2*MOD_SIDE+MOD_GAP);
function build(keep){
  const prevSel=selKey,prevPanel=panelSid;
  try{
    disposeShelf();
    const T=TYPE[tab],IW=MOD_IW[tab],list=sorted(),gap=.005,sgap=tab==='game'?.012:.08,pad=.2,pitch=T.w+gap;
    const cap=Math.floor((IW-2*pad+gap)/pitch);
    // rangement : de gauche à droite, planche par planche, puis meuble suivant
    const pos=[],plan=[];let mod=0,row=0,cur=pad;
    const nextRow=()=>{row++;cur=pad;if(row>=ROWS){row=0;mod++}};
    for(const s of list){const n=units(s);if(n<=0)continue;plan.push(s);const d=dimOf(s);
      const left=Math.floor((IW-pad-cur+gap)/pitch);
      // une petite série qui ne tient plus sur la planche passe entière à la suivante
      if(cur>pad&&n<=cap&&left<n&&left<cap*.3)nextRow();
      for(let i=0;i<n;i++){if(cur+d.w>IW-pad)nextRow();pos.push({s,i,mod,row,d,x:modX0(mod)+MOD_SIDE+cur+d.w/2});cur+=d.w+gap}
      cur+=sgap;
    }
    const mods=pos.length?pos[pos.length-1].mod+1:1,OW=IW+2*MOD_SIDE;
    const W=modX0(mods-1)+OW,H=PLANK+ROWS*ROW_H;
    layout={W,H,mods,OW,centers:Array.from({length:mods},(_,m)=>modX0(m)+OW/2)};LED.uTopY.value=H;
    const baseY=r=>PLANK+(ROWS-1-r)*ROW_H;

    // pièce : mur et sol
    add(new THREE.PlaneGeometry(W+80,40),WALL,W/2,H/2+4,-.95);WALL.map.repeat.set((W+80)/3,40/3);
    const fl=add(new THREE.PlaneGeometry(W+80,30),FLOOR,W/2,-.16,6);fl.rotation.x=-Math.PI/2;
    // meubles noirs mats
    const plankG=new THREE.BoxGeometry(IW,PLANK,1.5),aluG=new THREE.BoxGeometry(IW,PLANK+.01,.02),
      ledG=new THREE.BoxGeometry(IW-.1,.016,.025),glowG=new THREE.PlaneGeometry(IW,.7),
      sideG=new THREE.BoxGeometry(MOD_SIDE,H,1.5),sideAluG=new THREE.BoxGeometry(.02,H,.02),
      baseG=new THREE.BoxGeometry(OW+.04,.16,1.56),backG=new THREE.BoxGeometry(IW,H,.05);
    BACK.map.repeat.set(IW/2,H/2);
    // une lumière par planche, pour les allumer l'une après l'autre
    rowLed=[];rowGlow=[];for(let r=0;r<ROWS;r++){rowLed.push(LEDM.clone());rowGlow.push(GLOW.clone())}
    for(let m=0;m<mods;m++){const x0=modX0(m),cx=x0+OW/2;
      add(baseG,CAB,cx,-.08,-.03,{cast:true});
      for(let r=0;r<=ROWS;r++){const y=r===ROWS?H-PLANK/2:baseY(r)-PLANK/2;
        add(plankG,CAB,cx,y,-.03,{cast:true});add(aluG,ALU,cx,y,.73);
        if(r<ROWS){const yl=baseY(r)+ROW_H-PLANK-.014;add(ledG,rowLed[r],cx,yl,.62,{receive:false});add(glowG,rowGlow[r],cx,yl-.35,.6,{receive:false,order:3})}}
      [x0+MOD_SIDE/2,x0+OW-MOD_SIDE/2].forEach(xx=>{add(sideG,CAB,xx,H/2,-.03,{cast:true});add(sideAluG,ALU,xx,H/2,.74)});
      add(backG,BACK,cx,H/2,-.78);
    }

    // tomes : une série = un bloc instancié, seuls les tomes lus sont rangés
    const byS=new Map();
    for(const q of pos){let a=byS.get(q.s.id);if(!a){a=[];byS.set(q.s.id,a)}
      const r=rng(hash(q.s.id)+q.i*31);a.push({x:q.x,y:baseY(q.row)+q.d.h/2,z:(r()-.5)*.035-(tab==='manga'&&q.i>=q.s.done?.14:0),rz:(r()-.5)*.012,mod:q.mod})}
    for(const s of plan){
      const P=byS.get(s.id);if(!P)continue;
      const {pal,tpl}=styleFor(s),D=dimOf(s),G=geoFor(D),box=new THREE.Vector4(6/D.cw,1-6/D.cw,12/512,(12+D.bh)/512);
      const rec={s,pal,tpl,pos:P,count:P.length,art:tpl.kind==='art',spines:[],dim:D};
      rec.body=mat({color:bodyColor(pal,tpl,D),roughness:D.rough,metalness:0});
      const map=spineTexture(s,pal,tpl,0),dcol=lin(tpl.digit);rec.dcol=dcol;rec.map=map;
      const spine=mat({map,roughness:D.rough},{num:{box,color:dcol}});rec.spines.push(spine);
      const im=new THREE.InstancedMesh(instGeo(G.merged,P.map((_,i)=>tab==='game'?0:i+1)),[rec.body,PAGES[tab],spine],P.length);
      P.forEach((q,i)=>im.setMatrixAt(i,placeMatrix(q,false)));im.instanceMatrix.needsUpdate=true;
      // mangas : les tomes possédés mais pas encore lus restent dans l'ombre
      if(tab==='manga'){P.forEach((q,i)=>im.setColorAt(i,i<s.done?READ_C:UNREAD_C));im.instanceColor.needsUpdate=true}
      const bb=new THREE.Box3();P.forEach(q=>bb.expandByPoint(V.set(q.x,q.y,0)));
      const big=new THREE.Sphere();bb.getBoundingSphere(big);big.radius+=1.3;const one=G.merged.boundingSphere;
      im.geometry.boundingSphere=big;
      im.raycast=function(r,hits){this.geometry.boundingSphere=one;try{THREE.InstancedMesh.prototype.raycast.call(this,r,hits)}finally{this.geometry.boundingSphere=big}};
      im.castShadow=true;im.receiveShadow=true;im.userData={rec,offset:0};shelf.add(im);inst.push(im);rec.mesh=im;
      recs.push(rec);
    }
    fitCamera(keep);updateHeader();if(keep)endIntro();else startIntro();
    let restored=false;
    if(prevSel){const [sid,i]=prevSel.split(':');const rec=recs.find(r=>r.s.id===sid);
      if(rec){selectUnit(rec,clamp(+i,1,rec.count),false,true);restored=true}}
    if(!restored){if(prevPanel&&findSeries(prevPanel)){panelSid=prevPanel;renderPanel()}else closePanel()}
  }catch(err){console.error(err);toast("L'étagère n'a pas pu s'afficher. Recharge la page pour réessayer.")}
}

function bodyColor(pal,tpl,D){if(tab==='game')return lin((D||dimOf({})).body);return tpl.kind==='band'?lin('#ebe7de'):tpl.kind==='dark'?lin('#17181d'):pal.three}
// une couverture de série vient d'arriver : on repeint la série sans reconstruire l'étagère
function restyle(rec){invalidate();
  const st=styleFor(rec.s);if(st.tpl.kind!=='art'||rec.art)return;
  rec.pal=st.pal;rec.tpl=st.tpl;rec.art=true;
  const map=spineTexture(rec.s,st.pal,st.tpl,0);
  rec.spines.forEach(m=>{m.map=map;m.needsUpdate=true});if(rec.map)rec.map.dispose();rec.map=map;
  rec.dcol.copy(lin(st.tpl.digit));rec.body.color.copy(bodyColor(st.pal,st.tpl,rec.dim));
  for(const m of proxies.values())if(m.userData.rec===rec){const u=m.userData,old=u.spine.map;u.spine.map=spineTexture(rec.s,rec.pal,rec.tpl,u.idx);u.spine.needsUpdate=true;old.dispose();if(u.cover){removeCover(m);addCover(m)}}
}

/* ---------- tomes sortis ---------- */
function getProxy(rec,idx){
  const key=rec.s.id+':'+idx;let m=proxies.get(key);if(m)return m;
  const T=rec.dim;
  const spine=mat({map:spineTexture(rec.s,rec.pal,rec.tpl,idx),roughness:T.rough});
  m=new THREE.Mesh(geoFor(T).box,[rec.body,rec.body,PAGES[tab],PAGES[tab],spine,rec.body]);m.castShadow=true;m.receiveShadow=true;
  const p=rec.pos[idx-1];m.position.set(p.x,p.y,p.z);m.rotation.z=p.rz;
  m.userData={proxy:true,rec,idx,key,base:p,pull:0,hover:0,tp:0,th:0,spine};
  shelf.add(m);proxies.set(key,m);setInst(rec,idx,false);return m;
}
function releaseProxy(m,skipRestore){
  const u=m.userData;shelf.remove(m);u.spine.map.dispose();u.spine.dispose();removeCover(m);
  if(!skipRestore){setInst(u.rec,u.idx,true);proxies.delete(u.key)}
}
// couvertures possibles d'un tome, de la meilleure à la plus générique
function coverWants(s,idx){if(tab==='game')return[s.igdb&&s.igdb.cover&&igdbImg(s.igdb.cover,'t_cover_big_2x'),s.steam&&steamImg(s.steam.appid)].filter(Boolean);
  return[tab==='manga'?volUrl(s,idx,512):null,s.al&&s.al.coverXL,s.al&&s.al.cover].filter(Boolean)}
function addCover(m){const u=m.userData;if(u.cover)return;invalidate();
  const r=coverTexture(u.rec.s,u.rec.pal,u.rec.tpl,u.idx);u.coverRank=r.rank;
  u.cover=mat({map:r.tex,roughness:tab==='manga'?.4:.18});
  m.material=[u.cover,...m.material.slice(1)];if(u.key===selKey&&!$('#panel').hidden)requestAnimationFrame(paintCover)}
function removeCover(m){const u=m.userData;if(!u.cover)return;invalidate();m.material=[m.material[1],...m.material.slice(1)];u.cover.map.dispose();u.cover.dispose();u.cover=null}
const deg=THREE.MathUtils.degToRad;
function selectUnit(rec,idx,move,instant){
  invalidate();const key=rec.s.id+':'+idx;
  if(selKey&&selKey!==key){const o=proxies.get(selKey);if(o){o.userData.tp=0;removeCover(o)}}
  const m=getProxy(rec,idx);m.userData.tp=1;selKey=key;panelSid=rec.s.id;addCover(m);
  if(instant){m.userData.pull=1;m.userData.hover=0}
  if(move){morphFrom=screenRect(m);const T=rec.dim,narrow=innerWidth<=720,bh=T.h*1.25,bw=T.d*1.3;
    const needH=Math.max(bh/(narrow?.38:.6),bw/((narrow?.75:.45)*camera.aspect));
    cam.td=needH/(2*Math.tan(deg(camera.fov/2)))+1.4;const v=vis(cam.td);
    cam.tx=m.userData.base.x+(narrow?0:v.w*.18);cam.ty=m.userData.base.y+.2-(narrow?v.h*.2:0);clampCam()}
  renderPanel();mdCovers(rec.s);
}
function hidePanel(){const p=$('#panel');if(p.hidden)return;
  if(reduce){p.hidden=true;return}
  p.animate([{opacity:1,transform:'none'},{opacity:0,transform:innerWidth<=720?'translateY(30px)':'translateY(8px) scale(.98)'}],{duration:170,easing:'ease-in'}).onfinish=()=>{if(!panelSid)p.hidden=true}}
function openPanel(s){invalidate();if(selKey){const m=proxies.get(selKey);if(m){m.userData.tp=0;removeCover(m)}}selKey=null;panelSid=s.id;renderPanel();mdCovers(s)}
function closePanel(){invalidate();if(selKey){const m=proxies.get(selKey);if(m){m.userData.tp=0;removeCover(m)}}selKey=null;panelSid=null;hidePanel()}
function setHover(hit){invalidate();
  const key=hit?hit.rec.s.id+':'+hit.idx:null;if(key===hovKey)return;
  if(hovKey){const o=proxies.get(hovKey);if(o)o.userData.th=0}
  hovKey=key;if(hit)getProxy(hit.rec,hit.idx).userData.th=1;
}

/* ---------- caméra ---------- */
function vis(d){const h=2*d*Math.tan(deg(camera.fov/2));return{h,w:h*camera.aspect}}
// distance qui montre un meuble entier
function modFitD(){const t=Math.tan(deg(camera.fov/2));return Math.max((layout.H*1.1/2)/t,((layout.OW+.8)/camera.aspect/2)/t)}
function fitCamera(keep){
  const {H}=layout;cam.fitD=(H*1.12/2)/Math.tan(deg(camera.fov/2));
  if(!keep){const narrow=camera.aspect<.9;cam.td=narrow?cam.fitD*.5:cam.fitD;const v=vis(cam.td);
    cam.tx=narrow?layout.centers[0]-layout.OW/2+v.w/2:layout.centers[0];cam.ty=narrow?H-v.h/2:H/2;clampCam();cam.x=cam.tx;cam.y=cam.ty;cam.d=cam.td}
  clampCam();
}
function clampCam(){invalidate();const {W,H}=layout;cam.td=clamp(cam.td,2.2,Math.max(cam.fitD*1.15,modFitD()*1.05));const v=vis(cam.td);
  cam.tx=v.w>=W?W/2:clamp(cam.tx,v.w*.35,W-v.w*.35);cam.ty=v.h>=H?H/2:clamp(cam.ty,v.h*.4,H-v.h*.4)}
let SW=1,SH=1;
function resize(){const r=stage.getBoundingClientRect();SW=Math.max(1,r.width);SH=Math.max(1,r.height);renderer.setSize(SW,SH,false);camera.aspect=SW/SH;camera.updateProjectionMatrix();clampCam()}
new ResizeObserver(resize).observe(stage);
// meubles visibles à l'écran (au moins aux trois quarts)
function visMods(){const v=vis(cam.td),half=v.w/2-layout.OW*.25;const ids=layout.centers.map((c,i)=>Math.abs(c-cam.tx)<=half?i:-1).filter(i=>i>=0);
  if(ids.length)return[ids[0],ids[ids.length-1]];let b=0,bd=1e9;layout.centers.forEach((c,i)=>{const d=Math.abs(c-cam.tx);if(d<bd){bd=d;b=i}});return[b,b]}
function goMod(i){i=clamp(i,0,layout.mods-1);const f=modFitD();if(cam.td>f)cam.td=f;cam.tx=layout.centers[i];if(cam.td>f*.9)cam.ty=layout.H/2;clampCam()}
let modTxt='';
function updModLabel(){const [a,b]=visMods(),n=layout.mods,t=a===b?`Meuble ${a+1} / ${n}`:`Meubles ${a+1}–${b+1} / ${n}`;if(t===modTxt)return;modTxt=t;
  $('#mod-label').textContent=t;$('#b-left').disabled=a===0;$('#b-right').disabled=b>=n-1}

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
  if(e.pointerType==='mouse'){par.tx=((e.clientX-r.left)/r.width)*2-1;par.ty=((e.clientY-r.top)/r.height)*2-1;invalidate()}
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
canvas.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){setHover(null);par.tx=0;par.ty=0;invalidate()}});
canvas.addEventListener('wheel',e=>{e.preventDefault();
  if(e.ctrlKey)cam.td*=1+e.deltaY*.01;else{const dx=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;cam.tx+=dx*vis(cam.d).w*.0012}
  clampCam()},{passive:false});
const panBy=f=>{cam.tx+=vis(cam.d).w*f;clampCam()};
$('#b-left').onclick=()=>goMod(visMods()[0]-1);$('#b-right').onclick=()=>goMod(visMods()[1]+1);
$('#b-in').onclick=()=>{cam.td/=1.35;clampCam()};$('#b-out').onclick=()=>{cam.td*=1.35;clampCam()};
addEventListener('keydown',e=>{
  if(e.target.closest&&e.target.closest('input,select,textarea'))return;
  if(e.key==='Escape'){for(const id of ['#ov-add','#ov-import','#ov-steam','#ov-list','#ov-login','#ov-account'])if(!$(id).hidden)return closeModal(id);closePanel()}
  if(e.key==='ArrowRight')panBy(.35);if(e.key==='ArrowLeft')panBy(-.35);
  if(e.key==='ArrowUp'){cam.ty+=1;clampCam()}if(e.key==='ArrowDown'){cam.ty-=1;clampCam()}
});

/* ---------- panneau ---------- */
let panelSid=null;
const viaProxy=u=>location.protocol.startsWith('http')?'/api/cover?u='+encodeURIComponent(u):u;
function volUrl(s,idx,size){const f=s.md&&s.md.v&&s.md.v[idx];return f?`https://uploads.mangadex.org/covers/${s.md.id}/${f}.${size}.jpg`:null}
function findSeries(id){return state[tab].find(s=>s.id===id)}
const stLbl=k=>tab==='anime'?STATUS[k].a:tab==='game'?(STATUS[k].g||STATUS[k].m):STATUS[k].m;
function opts(sel){return ord().map(k=>`<option value="${k}"${k===sel?' selected':''}>${stLbl(k)}</option>`).join('')}
function scoreOpts(sel){let o=`<option value="0"${!sel?' selected':''}>—</option>`;for(let i=10;i>=1;i--)o+=`<option value="${i}"${i===sel?' selected':''}>${i}</option>`;return o}
// --- petits effets de la fiche ---
let morphFrom=null,ringPrev=new Map(),fixOpen=false;
// position à l'écran d'un tome de l'étagère, d'où part la couverture
function screenRect(m){const u=m.userData,T=u.rec.dim,r=canvas.getBoundingClientRect();
  const pr=(x,y,z)=>{const v=new THREE.Vector3(x,y,z).project(camera);return[r.left+(v.x+1)/2*r.width,r.top+(1-v.y)/2*r.height]};
  const [cx,top]=pr(u.base.x,u.base.y+T.h/2,u.base.z+T.d/2),[,bot]=pr(u.base.x,u.base.y-T.h/2,u.base.z+T.d/2);
  const h=Math.max(8,bot-top);return{x:cx-h*.33,y:top,w:h*.66,h}}
function paintCover(){
  const c=$('#p-cover');if(!c)return;const x=c.getContext('2d');const m=selKey&&proxies.get(selKey);
  let src=m&&m.userData.cover&&m.userData.cover.map.image,tmp=null;
  if(!src){const s=findSeries(panelSid);if(!s)return;const st=styleFor(s);tmp=coverTexture(s,st.pal,st.tpl,1);src=tmp.tex.image}
  x.clearRect(0,0,c.width,c.height);try{x.drawImage(src,0,0,c.width,c.height)}catch(e){}
  if(tmp)tmp.tex.dispose();
}
function playMorph(p,wasHidden){
  if(reduce)return;
  if(wasHidden)p.animate([{opacity:0,transform:innerWidth<=720?'translateY(40px)':'translateY(10px) scale(.97)'},{opacity:1,transform:'none'}],{duration:340,easing:'cubic-bezier(.16,1,.3,1)'});
  const c=$('#p-cover');if(!c||!morphFrom)return;const t=c.getBoundingClientRect(),f=morphFrom;morphFrom=null;if(!t.width)return;
  c.animate([{transform:`translate(${f.x-t.left}px,${f.y-t.top}px) scale(${f.w/t.width},${f.h/t.height})`,opacity:.35,filter:'brightness(1.6)'},
    {opacity:1,offset:.45},{transform:'none',opacity:1,filter:'none'}],{duration:620,easing:'cubic-bezier(.16,1,.3,1)'});
}
// gerbe de particules quand une série est terminée
function burst(el){
  if(reduce||!el)return;const r=el.getBoundingClientRect(),cv=document.createElement('canvas');
  cv.className='burst';cv.width=innerWidth*devicePixelRatio;cv.height=innerHeight*devicePixelRatio;document.body.appendChild(cv);
  const x=cv.getContext('2d');x.scale(devicePixelRatio,devicePixelRatio);
  const cols=['#f0c450','#3f9d6e','#3d7fd6','#e8eaf2','#d16a9b'],ox=r.left+r.width/2,oy=r.top+r.height/2;
  const ps=Array.from({length:70},(_,i)=>{const a=Math.random()*Math.PI*2,v=2+Math.random()*6;return{x:ox,y:oy,vx:Math.cos(a)*v,vy:Math.sin(a)*v-2.5,s:2+Math.random()*3.5,c:cols[i%cols.length],r:Math.random()*6}});
  const t0=performance.now();
  (function step(t){const k=(t-t0)/1100;x.clearRect(0,0,innerWidth,innerHeight);
    for(const p of ps){p.vy+=.16;p.vx*=.985;p.x+=p.vx;p.y+=p.vy;p.r+=.2;x.globalAlpha=Math.max(0,1-k);x.fillStyle=p.c;
      x.save();x.translate(p.x,p.y);x.rotate(p.r);x.fillRect(-p.s/2,-p.s/2,p.s,p.s*1.6);x.restore()}
    if(k<1)requestAnimationFrame(step);else cv.remove()})(t0);
}
function boing(b){if(!b||reduce)return;b.classList.remove('boing');void b.offsetWidth;b.classList.add('boing')}
// anneau de progression : lus (couleur du statut) sur possédés (gris) sur parus
function ring(s,man){
  const owned=man?Math.max(s.owned||0,s.done):s.done,base=s.total>0?Math.max(s.total,owned):Math.max(owned,s.done,1);
  const C=2*Math.PI*42,prev=ringPrev.get(s.id)||{d:0,o:0},fr=v=>C*(1-Math.min(1,v/base));
  ringPrev.set(s.id,{d:s.done,o:owned});
  return{html:`<svg class="ring" viewBox="0 0 100 100" role="img" aria-label="${s.done} ${man?'tomes lus':'épisodes vus'}${s.total?` sur ${s.total}`:''}">
    <circle cx="50" cy="50" r="42" class="r-bg${s.total?'':' open'}"/>
    ${man?`<circle cx="50" cy="50" r="42" class="r-own" stroke-dasharray="${C}" stroke-dashoffset="${fr(prev.o)}" data-to="${fr(owned)}"/>`:''}
    <circle cx="50" cy="50" r="42" class="r-read" style="stroke:${STATUS[s.status].c}" stroke-dasharray="${C}" stroke-dashoffset="${fr(prev.d)}" data-to="${fr(s.done)}"/>
    <text x="50" y="52" class="r-num">${s.done}</text><text x="50" y="67" class="r-sub">${s.total?`sur ${s.total}`:man?'lus':'vus'}</text></svg>`,owned};
}
function renderPanel(){
  const p=$('#panel');const s=panelSid&&findSeries(panelSid);if(!s){p.hidden=true;return}
  const wasHidden=p.hidden;
  const m=selKey&&proxies.get(selKey),idx=m?m.userData.idx:null,rec=recs.find(r=>r.s.id===s.id);
  const man=tab==='manga',game=tab==='game',ro=!!viewing;
  const kind=game?`Jeu · ${(GAME_PF[s.platform]||GAME_PF.other).label}`:idx?(man?`Tome ${idx}${idx>s.done?' · pas encore lu':''}`:`Coffret ${idx} · ép. ${(idx-1)*EPS+1}–${Math.min(idx*EPS,s.done)}`):(s.done?'Série':(man?"Aucun tome sur l'étagère":'Aucun épisode vu'));
  const rg=ring(s,man),owned=rg.owned,missing=man&&s.total>owned?s.total-owned:0;
  const full=s.total>0&&s.done>=s.total,canBuy=man&&!(s.total&&owned>=s.total);
  let src='';
  if(man&&s.done){src=s.md?(idx&&!volUrl(s,idx,256)?"Pas de couverture pour ce tome sur MangaDex : celle de la série est affichée.":'Couvertures des tomes : MangaDex'):
    mdBusy.has(s.id)?'Recherche des couvertures des tomes…':s.mdMiss?'Couvertures des tomes introuvables sur MangaDex : celle de la série est affichée.':''}
  const fan=man&&s.md&&s.done>1?`<div class="fan" id="p-fan">${Array.from({length:Math.min(Math.max(owned,s.done),400)},(_,i)=>{const n=i+1,u=volUrl(s,n,256);
    return `<button type="button" class="vol${n===idx?' cur':''}${n>s.done?' unread':''}" data-n="${n}" aria-label="Tome ${n}">${u?`<img alt="" loading="lazy" src="${viaProxy(u)}">`:''}<span>${n}</span></button>`}).join('')}</div>`:'';
  const legend=man?`<li><i class="k-read" style="background:${STATUS[s.status].c}"></i><b>${s.done}</b> lu${s.done>1?'s':''}</li>
      <li><i class="k-own"></i><b>${owned}</b> possédé${owned>1?'s':''}</li>
      <li><i class="k-tot"></i>${s.total?`<b>${s.total}</b> parus`:'parution en cours'}</li>
      ${missing?`<li class="shop">${missing>1?`Tomes ${owned+1} à ${s.total} à acheter`:`Tome ${s.total} à acheter`}</li>`:''}`
    :`<li><i class="k-read" style="background:${STATUS[s.status].c}"></i><b>${s.done}</b> épisode${s.done>1?'s':''} vu${s.done>1?'s':''}</li><li><i class="k-tot"></i>${s.total?`<b>${s.total}</b> au total`:'diffusion en cours'}</li>`;
  const scoreTxt=v=>v?`${v}/10`:'Pas noté';
  if(game)src=s.igdb&&s.igdb.cover?'Jaquette : IGDB':s.steam?'Jaquette : Steam':'';
  const pf=GAME_PF[s.platform]||GAME_PF.other;
  const gInfoHtml=game?`<div class="g-info"><span class="chip" style="background:${pf.band}">${pf.label}</span>${s.igdb&&s.igdb.year?`<span>Sorti en <b>${s.igdb.year}</b></span>`:''}${s.hours?`<span><b>${s.hours.toLocaleString('fr-FR')}</b> h de jeu</span>`:''}</div>`:'';
  const pfSeg=game?`<div class="pfs" id="p-pf" role="radiogroup" aria-label="Plateforme">${['switch','ps','xbox','pc','other'].map(k=>`<button type="button" role="radio" aria-checked="${k===s.platform}" data-k="${k}" style="--c:${GAME_PF[k].band}">${GAME_PF[k].label}</button>`).join('')}</div>`:'';
  p.innerHTML=`
    <div class="p-top"><span class="p-kind">${kind}</span><button class="x" id="p-close" aria-label="Fermer">×</button></div>
    <div class="p-hero">
      <canvas id="p-cover" class="p-cover" width="384" height="576" aria-hidden="true"></canvas>
      <div class="p-head">
        <h2 class="p-title">${esc(s.title)}</h2>
        <div class="pills">${ro?`<span class="pill" style="background:${STATUS[s.status].c}">${stLbl(s.status)}</span>${s.score?`<span class="pill" style="background:var(--ink);color:var(--surface)">${s.score}/10</span>`:''}`:''}
          ${s.example?'<span class="pill ex">Exemple</span>':''}${s.estimated?'<span class="pill ex">Tomes estimés</span>':''}</div>
        ${idx&&rec&&rec.count>1?`<div class="row nav"><button class="btn" id="p-prev"${idx<=1?' disabled':''} aria-label="${man?'Tome':'Coffret'} précédent">‹</button><button class="btn" id="p-next"${idx>=rec.count?' disabled':''} aria-label="${man?'Tome':'Coffret'} suivant">›</button></div>`:''}
      </div>
    </div>
    ${game?gInfoHtml:`<div class="p-prog">${rg.html}<ul class="legend-l">${legend}</ul></div>`}
    ${ro?'':`${pfSeg}<div class="p-acts"${game?' hidden':''}>
      ${full?'':`<button class="btn primary jelly" id="p-plus">+1 ${man?'lu':'épisode'}<small>${man?`tome ${s.done+1}`:`épisode ${s.done+1}`}</small></button>`}
      ${canBuy?`<button class="btn jelly" id="p-buy">+1 acheté<small>tome ${owned+1}</small></button>`:''}
    </div>
    <div class="seg" id="p-seg" role="radiogroup" aria-label="Statut"><span class="seg-ind" aria-hidden="true"></span>
      ${ord().map(k=>`<button type="button" role="radio" aria-checked="${k===s.status}" data-k="${k}" style="--c:${STATUS[k].c}">${stLbl(k)}</button>`).join('')}</div>
    <label class="score"><span>Note</span><input type="range" id="p-score" min="0" max="10" step="1" value="${s.score}" style="--p:${s.score*10}%" aria-valuetext="${scoreTxt(s.score)}"><output id="p-score-o">${scoreTxt(s.score)}</output></label>`}
    ${fan}
    <p class="note" id="p-src"${src?'':' hidden'}>${src}</p>
    ${ro?'':`<details class="fix" id="p-fix"${fixOpen?' open':''}><summary>${game?'Corriger ou retirer le jeu':'Corriger les nombres ou retirer la série'}</summary>
      ${game?`<div class="grid2"><label class="f">Heures de jeu<input id="p-hours" type="number" min="0" max="100000" value="${s.hours||0}"></label></div>`:''}
      <div class="grid2"${game?' hidden':''}>
        <label class="f">${man?'Tomes lus':'Épisodes vus'}<input id="p-done" type="number" min="0" max="3000" value="${s.done}"></label>
        ${man?`<label class="f">Tomes possédés<input id="p-owned" type="number" min="0" max="3000" value="${owned}"></label>`:''}
        <label class="f">${man?'Tomes parus':'Épisodes au total'}<input id="p-total" type="number" min="0" max="3000" value="${s.total||''}" placeholder="${man?'en cours':'?'}"></label>
      </div>
      <button class="btn danger" id="p-del">${game?'Retirer ce jeu':'Retirer de ma bibliothèque'}</button>
      <div id="p-confirm"></div>
    </details>`}
    ${s.al&&s.al.id?`<a class="note" href="https://anilist.co/${tab}/${s.al.id}" target="_blank" rel="noopener">Voir la fiche sur AniList</a>`:''}
    ${game&&s.steam?`<a class="note" href="https://store.steampowered.com/app/${s.steam.appid}" target="_blank" rel="noopener">Voir sur Steam</a>`:''}`;
  p.hidden=false;
  paintCover();playMorph(p,wasHidden);
  // l'anneau part de l'ancienne valeur
  requestAnimationFrame(()=>p.querySelectorAll('.ring [data-to]').forEach(c=>c.setAttribute('stroke-dashoffset',c.dataset.to)));
  $('#p-close').onclick=closePanel;
  const el=id=>$(id)||{};
  // après un changement, on reconstruit ; « pick » choisit le tome à sortir
  const upd=(fn,pick)=>{const was=s.status;fn(s);s.example=false;if(s.status==='termine'&&s.total>0)s.done=s.total;fixOwned(s);save();build(true);
    if(pick){const r=recs.find(r=>r.s.id===s.id);if(r)selectUnit(r,clamp(typeof pick==='function'?pick(s):r.count,1,r.count),true,false);else{panelSid=s.id;renderPanel()}}
    const fin=k=>k==='termine'||k==='cent';
    if(!fin(was)&&fin(s.status)||was!=='cent'&&s.status==='cent'){burst($('#panel .ring')||$('#p-cover'));toast(`« ${s.title} » ${s.status==='cent'?'à 100 %':'terminé'}, bravo !`)}};
  const later=(b,fn)=>{boing(b);setTimeout(fn,reduce?0:200)};
  const plus=$('#p-plus');if(plus)plus.onclick=()=>later(plus,()=>upd(s=>{s.done=Math.min(3000,s.done+1);s.estimated=false;if(s.status==='a_lire'||s.status==='abandonne')s.status='en_cours';if(s.total&&s.done>=s.total)s.status='termine'},s=>s.done));
  const pb=$('#p-buy');if(pb)pb.onclick=()=>later(pb,()=>upd(s=>s.owned=Math.min(3000,Math.max(s.owned||0,s.done)+1),s=>Math.max(s.owned||0,s.done)));
  // statut : l'indicateur glisse jusqu'à la pastille choisie, puis on enregistre
  const seg=$('#p-seg');
  if(seg){const ind=seg.querySelector('.seg-ind');
    const place=b=>{ind.style.left=b.offsetLeft+'px';ind.style.top=b.offsetTop+'px';ind.style.width=b.offsetWidth+'px';ind.style.height=b.offsetHeight+'px';ind.style.background=b.style.getPropertyValue('--c')};
    const cur=seg.querySelector('[aria-checked="true"]');ind.style.transition='none';if(cur)place(cur);void ind.offsetWidth;ind.style.transition='';
    seg.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(b.dataset.k===s.status)return;seg.querySelectorAll('button').forEach(x=>x.setAttribute('aria-checked',x===b));place(b);
      setTimeout(()=>upd(s=>s.status=b.dataset.k),reduce?0:260)})}
  const sc=$('#p-score');
  if(sc){sc.oninput=()=>{const v=+sc.value;sc.style.setProperty('--p',v*10+'%');$('#p-score-o').textContent=scoreTxt(v);sc.setAttribute('aria-valuetext',scoreTxt(v))};
    sc.onchange=()=>upd(s=>s.score=+sc.value)}
  const fx=$('#p-fix');if(fx)fx.ontoggle=()=>{fixOpen=fx.open};
  const pfb=$('#p-pf');if(pfb)pfb.querySelectorAll('button').forEach(b=>b.onclick=()=>{if(b.dataset.k===s.platform)return;upd(s=>s.platform=b.dataset.k,true)});
  el('#p-hours').onchange=e=>upd(s=>s.hours=clamp(Math.round(+e.target.value||0),0,100000));
  el('#p-done').onchange=e=>upd(s=>{s.done=clamp(+e.target.value||0,0,3000);s.estimated=false},s=>s.done);
  const po=$('#p-owned');if(po)po.onchange=e=>{const v=clamp(+e.target.value||0,0,3000);if(v<s.done)toast(`Tu as lu ${s.done} tomes : ils restent sur l'étagère.`);upd(s=>s.owned=v,true)};
  el('#p-total').onchange=e=>upd(s=>s.total=clamp(+e.target.value||0,0,3000));
  const pv=$('#p-prev'),nx=$('#p-next');
  if(pv)pv.onclick=()=>selectUnit(rec,idx-1,true,false);if(nx)nx.onclick=()=>selectUnit(rec,idx+1,true,false);
  // éventail : les tomes pivotent selon leur distance au centre
  const f=$('#p-fan');
  if(f){const items=[...f.querySelectorAll('.vol')];let q=0;
    const lay=()=>{q=0;const mid=f.scrollLeft+f.clientWidth/2,half=f.clientWidth/2||1;
      for(const b of items){const d=(b.offsetLeft+b.offsetWidth/2-mid)/half;if(Math.abs(d)>1.6){b.style.transform='';continue}const a=Math.min(1,Math.abs(d));
        b.style.transform=`perspective(420px) rotateY(${clamp(-d*42,-55,55)}deg) scale(${1-a*.2})`;b.style.zIndex=String(200-Math.round(a*100));b.style.opacity=String(1-a*.45)}};
    f.addEventListener('scroll',()=>{if(!q)q=requestAnimationFrame(lay)},{passive:true});
    items.forEach(b=>b.onclick=()=>{if(rec)selectUnit(rec,Math.min(+b.dataset.n,rec.count),true,false)});
    const c=f.querySelector('.cur');if(c)f.scrollLeft=c.offsetLeft-f.clientWidth/2+c.offsetWidth/2;lay()}
  el('#p-del').onclick=()=>{$('#p-confirm').innerHTML=`<div class="confirm"><span>Retirer « ${esc(s.title)} » de ta bibliothèque ?</span><div class="row"><button class="btn danger" id="p-del-ok">Retirer</button><button class="btn" id="p-del-no">Garder</button></div></div>`;
    $('#p-del-no').onclick=()=>$('#p-confirm').innerHTML='';
    $('#p-del-ok').onclick=()=>{state[tab]=state[tab].filter(x=>x.id!==s.id);save();closePanel();build(true);toast(`« ${s.title} » retiré`)}};
}

/* ---------- liste des séries ---------- */
function renderList(){
  const q=$('#l-q').value.trim().toLowerCase(),man=tab==='manga';
  const items=sorted().filter(s=>!q||s.title.toLowerCase().includes(q));
  const box=$('#l-items');
  box.innerHTML=items.length?items.slice(0,500).map(s=>{const n=s.done;
    const th=seriesCover(s)?`<img alt="" loading="lazy" src="${viaProxy(seriesCover(s))}">`:'<span class="ph"></span>';
    const o=man?Math.max(s.owned||0,n):0,miss=man&&s.total>o?s.total-o:0;
    const cnt=tab==='game'?`${(GAME_PF[s.platform]||GAME_PF.other).label}${s.hours?` · ${s.hours} h`:''}`:man?(o?`${n} lu${n>1?'s':''} · ${o} possédé${o>1?'s':''}${miss?` · ${miss} à acheter`:''}`:'aucun tome rangé'):(n?`${n} épisode${n>1?'s':''}`:'aucun épisode vu');
    return `<button type="button" class="al-item" data-id="${s.id}">${th}<span><b>${esc(s.title)}</b><small><i class="dot" style="background:${STATUS[s.status].c}"></i>${stLbl(s.status)} · ${cnt}</small></span></button>`}).join('')
    :'<p class="al-empty">Aucune série ne correspond à cette recherche.</p>';
  box.querySelectorAll('.al-item').forEach(b=>b.onclick=()=>{const s=findSeries(b.dataset.id);if(!s)return;closeModal('#ov-list');
    const rec=recs.find(r=>r.s.id===s.id);if(rec)selectUnit(rec,rec.count,true,false);else openPanel(s)});
}
$('#btn-list').onclick=()=>{$('#l-q').value='';$('#bk-confirm').innerHTML='';
  $('.backup').hidden=!!viewing;$('#bk-note').textContent=acct.user?"Ta bibliothèque est enregistrée dans ton compte. Tu peux aussi en télécharger une copie, ou restaurer une sauvegarde.":"Ta bibliothèque n'existe que dans ce navigateur. Télécharge-la de temps en temps pour ne rien perdre, ou crée un compte pour la retrouver partout.";$('#l-t').textContent=tab==='manga'?'Mes mangas':'Mes animes';renderList();openModal('#ov-list')};
$('#l-q').addEventListener('input',renderList);
$('#l-close').onclick=()=>closeModal('#ov-list');

/* ---------- sauvegarde : télécharger / restaurer la bibliothèque ---------- */
const count=d=>d.manga.length+d.anime.length+(d.game||[]).length;
$('#bk-export').onclick=()=>{
  const d=new Date(),day=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const blob=new Blob([JSON.stringify({app:'myweebrary',version:1,exported:d.toISOString(),manga:state.manga,anime:state.anime,game:state.game},null,1)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`myweebrary-${day}.json`;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);toast(`Sauvegarde téléchargée : ${count(state)} séries.`)};
$('#bk-import').onclick=()=>$('#bk-file').click();
$('#bk-file').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;const box=$('#bk-confirm');
  let d;
  try{const raw=JSON.parse(await readText(f));if(!raw||(!Array.isArray(raw.manga)&&!Array.isArray(raw.anime)))throw 0;d=normalize(raw)}
  catch(_){box.innerHTML='<p class="err">Ce fichier n\'est pas une sauvegarde MyWeebrary.</p>';return}
  if(!count(d)){box.innerHTML='<p class="err">Cette sauvegarde ne contient aucune série.</p>';return}
  const mine=state.manga.concat(state.anime,state.game).filter(s=>!s.example).length;
  const apply=()=>{state.manga=d.manga;state.anime=d.anime;state.game=d.game;save();box.innerHTML='';closeModal('#ov-list');closePanel();
    tab=d.manga.length||!d.anime.length?'manga':'anime';build(false);progress();enrich();toast(`Bibliothèque restaurée : ${d.manga.length} mangas et ${d.anime.length} animes.`)};
  if(!mine)return apply();
  box.innerHTML=`<div class="confirm"><span>Remplacer ${mine>1?`tes ${mine} séries`:'ta série'} par ${count(d)>1?`les ${count(d)} séries`:'la série'} de la sauvegarde ?</span><div class="row"><button class="btn danger" id="bk-ok">Remplacer</button><button class="btn" id="bk-no">Annuler</button></div></div>`;
  $('#bk-ok').onclick=apply;$('#bk-no').onclick=()=>box.innerHTML=''};

/* ---------- en-tête ---------- */
function updateBanner(){
  const b=$('#banner'),l=state[tab];let h='';
  if(viewing){
    const own=acct.user&&viewing.profile&&viewing.profile.id===acct.user.id;
    if(viewing.missing)h=`<span>Aucune bibliothèque publique ne s'appelle <b>@${esc(viewing.name)}</b>.</span> <a href="/">Créer la mienne</a>`;
    else if(viewing.failed)h=`<span>La bibliothèque de <b>@${esc(viewing.name)}</b> n'a pas pu être chargée.</span>`;
    else if(viewing.profile)h=`<span>Bibliothèque de <b>@${esc(viewing.profile.username)}</b>${own?' : ta page publique':''}.</span> <a href="/">${own?'Modifier ma bibliothèque':'Créer la mienne'}</a>`;
    else h=`<span>Chargement de la bibliothèque de <b>@${esc(viewing.name)}</b>…</span>`;
  }
  else if(loadingAccount)h='<span>Chargement de ta bibliothèque…</span>';
  else if(l.some(s=>s.example))h=`<span>Étagère d'exemple.</span> <button data-act="import">${tab==='game'?'Importer ta ludothèque Steam':'Importer ta liste MyAnimeList'}</button><span class="long">pour la remplacer par la tienne.</span>`;
  else if(!l.length)h=`<span>${tab==='manga'?'Aucun manga':tab==='anime'?'Aucun anime':'Aucun jeu'} pour l'instant.</span> <button data-act="import">${tab==='game'?'Importer ta ludothèque Steam':'Importer ta liste MyAnimeList'}</button> <span>ou</span> <button data-act="add">${tab==='game'?'ajouter un jeu':'ajouter une série'}</button>`;
  else if(sb&&!acct.user)h=`<span>Ta bibliothèque est enregistrée dans ce navigateur seulement.</span> <button data-act="login">Crée un compte</button><span class="long">pour la retrouver partout et la partager.</span>`;
  b.innerHTML=h;b.hidden=!h;
}
$('#banner').addEventListener('click',e=>{const a=e.target.closest('[data-act]');if(!a)return;
  ({import:()=>$('#btn-import').click(),add:()=>$('#btn-add').click(),login:()=>$('#btn-account').click()})[a.dataset.act]()});
function updateHeader(){
  document.querySelectorAll('.tabs button').forEach(b=>b.setAttribute('aria-selected',b.dataset.tab===tab));
  $('#btn-import').textContent=(innerWidth<=720?'':'Importer ')+(tab==='game'?'Steam':'MAL');
  $('#sort option[value=progression]').textContent=tab==='game'?'Temps de jeu':tab==='anime'?"Nombre d'épisodes":'Nombre de tomes';
  const l=state[tab];const done=l.reduce((a,s)=>a+s.done,0),own=tab==='manga'?l.reduce((a,s)=>a+Math.max(s.owned||0,s.done),0):0;
  if(tab==='game'){const fin=l.filter(s=>s.status==='termine'||s.status==='cent').length,hrs=l.reduce((a,s)=>a+(s.hours||0),0);
    $('#stats').innerHTML=`<b>${l.length}</b> jeu${l.length>1?'x':''} · <b>${fin}</b> terminé${fin>1?'s':''}${hrs?` · <b>${hrs.toLocaleString('fr-FR')}</b> h de jeu`:''} · <b>${layout.mods}</b> meuble${layout.mods>1?'s':''}`}
  else $('#stats').innerHTML=`<b>${l.length}</b> série${l.length>1?'s':''} · <b>${done.toLocaleString('fr-FR')}</b> ${tab==='manga'?`tomes lus · <b>${own.toLocaleString('fr-FR')}</b> possédés`:'épisodes vus'} · <b>${layout.mods}</b> meuble${layout.mods>1?'s':''}`;
  updateBanner();
  $('#legend').innerHTML=ord().map(k=>`<span><i style="background:${STATUS[k].c};border-radius:50%"></i>${stLbl(k)}</span>`).join('')+(tab==='manga'?'<span><i style="background:#3a3c44"></i>Pas encore lu</span>':'');
  modTxt='';
}
document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{if(tab===b.dataset.tab)return;closePanel();tab=b.dataset.tab;build(false);progress();if(tab==='game')gameEnrich()});
$('#sort').onchange=e=>{sortBy=e.target.value;build(true)};
function toast(t){const el=$('#toast');el.textContent=t;el.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>el.hidden=true,3500)}

/* ---------- modales ---------- */
function openModal(id){$(id).hidden=false;const f=$(id).querySelector('input:not([type=file]),button');f&&f.focus()}
function closeModal(id){$(id).hidden=true}
['#ov-import','#ov-add','#ov-list','#ov-login','#ov-account','#ov-steam'].forEach(id=>$(id).addEventListener('click',e=>{if(e.target.id===id.slice(1))closeModal(id)}));
$('#btn-import').onclick=()=>{if(tab==='game'){$('#st-err').hidden=true;openModal('#ov-steam');return}$('#imp-err').hidden=true;openModal('#ov-import')};
$('#imp-close').onclick=()=>closeModal('#ov-import');
$('#btn-add').onclick=()=>{
  $('#add-form').reset();
  const g=tab==='game';$('#add-t').textContent=g?'Ajouter un jeu':tab==='anime'?'Ajouter un anime':'Ajouter un manga';
  $('#a-title').placeholder=g?'Ex. Elden Ring':'Ex. Blue Lock';$('#a-platform-f').hidden=!g;$('#a-platform').innerHTML=pfOpts('ps');gPick=null;
  for(const id of ['#a-done','#a-total'])$(id).closest('label').hidden=g;$('#a-total-note').hidden=g;$('#a-submit').textContent=g?"Ranger le jeu":"Ranger sur l'étagère";
  $('#a-done-l').textContent=tab==='anime'?'Épisodes vus':'Tomes lus';$('#a-owned-f').hidden=tab!=='manga';$('#a-total-l').textContent=tab==='anime'?'Épisodes au total':'Tomes parus';
  $('#a-status').innerHTML=opts('en_cours');$('#a-score').innerHTML=scoreOpts(0);alPick=null;renderResults(null);$('#a-picked').hidden=true;openModal('#ov-add')};
$('#add-close').onclick=()=>closeModal('#ov-add');
$('#add-form').onsubmit=e=>{e.preventDefault();
  const s={id:uid(),title:$('#a-title').value.trim().slice(0,80),done:clamp(+$('#a-done').value||0,0,3000),total:clamp(+$('#a-total').value||0,0,3000),status:$('#a-status').value,score:+$('#a-score').value};
  if(!s.title)return;
  if(tab==='game'){Object.assign(s,{done:0,total:0,platform:$('#a-platform').value,hours:0});if(gPick)s.igdb=gInfo(gPick)}
  if(tab==='manga')s.owned=+$('#a-owned').value||0;if(alPick)applyAl(s,tab,alPick);if(s.status==='termine'&&s.total)s.done=s.total;fixOwned(s);
  state[tab].push(s);save();closeModal('#ov-add');build(true);
  const rec=recs.find(r=>r.s.id===s.id);if(rec)selectUnit(rec,rec.count,true,false);else openPanel(s);
  toast(rec?`« ${s.title} » rangé sur l'étagère`:`« ${s.title} » ajouté à tes séries : ses tomes apparaîtront dès que tu en auras lu un.`);if(tab==='game'){if(!s.igdb)gameEnrich()}else if(!s.al)enrich()};

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
      const keep=state[k].filter(s=>!s.example);const byT=new Map(keep.map(s=>[s.title.toLowerCase(),s])),byM=new Map(keep.filter(s=>s.malId).map(s=>[s.malId,s]));
      for(const s of res[k]){if(k==='manga')s.owned=s.done;const ex=(s.malId&&byM.get(s.malId))||byT.get(s.title.toLowerCase());if(ex){if(s.malId&&ex.malId!==s.malId){delete ex.al;delete ex.alMiss}Object.assign(ex,{done:s.done,total:s.total,status:s.status,score:s.score,estimated:s.estimated,malId:s.malId||ex.malId});if(k==='manga')ex.owned=Math.max(ex.owned||0,ex.done)}else{keep.push(s);byT.set(s.title.toLowerCase(),s)}}
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
const alInfo=m=>({id:m.id,romaji:(m.title&&m.title.romaji)||'',cover:m.coverImage&&(m.coverImage.large||m.coverImage.extraLarge)||null,coverXL:m.coverImage&&(m.coverImage.extraLarge||m.coverImage.large)||null,color:m.coverImage&&m.coverImage.color||null,volumes:m.volumes||0,episodes:m.episodes||0});
const alTitle=m=>(m.title&&(m.title.english||m.title.romaji))||'';
function applyAl(s,kind,m){
  s.al=alInfo(m);if(!s.malId&&m.idMal)s.malId=m.idMal;delete s.alMiss;
  const t=kind==='manga'?s.al.volumes:s.al.episodes;
  if(!s.total&&t>0)s.total=Math.min(3000,t);
  if(s.status==='termine'&&s.total)s.done=s.total;
  if(kind==='manga')s.owned=Math.max(s.owned||0,s.done);
}
let enriching=false,restyleTimer=0;
function pendingCount(kind){return kind==='game'?state.game.filter(s=>!s.igdb&&!s.igdbMiss).length:state[kind].filter(s=>!s.al&&!s.alMiss).length}
async function enrich(){
  if(enriching||viewing)return;enriching=true;progress();
  let failed=false;
  try{
    for(const kind of tab==='anime'?['anime','manga']:['manga','anime']){
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
  gameEnrich();
}
function afterBatch(kind){save();progress();if(kind!==tab)return;
  // les volumes connus d'AniList peuvent ajouter des tomes « non lus » : on reconstruit si besoin
  clearTimeout(restyleTimer);restyleTimer=setTimeout(()=>{const before=recs.map(r=>r.count).join(',');
    const now=sorted().map(units).filter(n=>n>0).join(',');
    if(before!==now)build(true);else recs.forEach(r=>{if(seriesCover(r.s))coverImg(seriesCover(r.s))})},400)}
function progress(){
  const el=$('#al-progress');if(!el)return;const n=pendingCount(tab),tot=state[tab].length;
  el.hidden=!((tab==='game'?gEnriching:enriching)&&n>0);el.textContent=`${tab==='game'?'Jaquettes':'Couvertures'} : ${tot-n}/${tot}`;
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
  for(const rec of recs){const u=seriesCover(rec.s);if(u&&q.has(u))restyle(rec)}
  for(const m of proxies.values()){const u=m.userData;if(!u.cover)continue;
    if(coverWants(u.rec.s,u.idx).some((x,i)=>i<u.coverRank&&q.has(x))){removeCover(m);addCover(m)}}})}

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
  alPick=null;gPick=null;$('#a-picked').hidden=true;clearTimeout(searchTimer);const q=$('#a-title').value.trim();
  if(q.length<2){renderResults(null);return}
  if(tab==='game'){searchTimer=setTimeout(()=>searchGames(q,++searchSeq),450);return}
  searchTimer=setTimeout(async()=>{const seq=++searchSeq;
    try{const d=await alQuery(`query($q:String){Page(perPage:6){media(search:$q,type:${tab==='manga'?'MANGA':'ANIME'},sort:SEARCH_MATCH){${FIELDS}}}}`,{q});
      if(seq===searchSeq&&!$('#ov-add').hidden)renderResults((d.Page&&d.Page.media)||[])}
    catch(e){if(seq===searchSeq){$('#a-results').hidden=false;$('#a-results').innerHTML='<p class="al-empty">La recherche AniList ne répond pas. Tu peux remplir les champs à la main.</p>'}}},450)});

/* ---------- jeux vidéo : IGDB, Steam ---------- */
const igdbImg=(id,size)=>id?`https://images.igdb.com/igdb/image/upload/${size||'t_cover_big'}/${id}.jpg`:null;
const steamImg=appid=>appid?`https://cdn.cloudflare.steamstatic.com/steam/apps/${appid}/library_600x900.jpg`:null;
// familles de plateformes IGDB → boîtier
const PF_IDS={switch:[130,508,41,5,37,4,18,19,20,21,22,24,33,47,137,159],ps:[167,48,9,8,7,46,38,390],xbox:[169,49,12,11],pc:[6,14,3,92,163]};
function pfOf(ids){for(const k of ['switch','ps','xbox','pc'])if((ids||[]).some(i=>PF_IDS[k].includes(typeof i==='object'?i.id:i)))return k;return 'other'}
function pfList(ids){const out=[];for(const k of ['switch','ps','xbox','pc'])if((ids||[]).some(i=>PF_IDS[k].includes(typeof i==='object'?i.id:i)))out.push(k);return out.length?out:['other']}
let igChain=Promise.resolve(),igNext=0,igOff=false,igWarned=false;
function igdb(endpoint,query){
  const run=async()=>{
    if(igOff)throw new Error('igdb_off');
    for(let a=0;a<3;a++){
      const w=igNext-Date.now();if(w>0)await sleep(w);igNext=Date.now()+300;
      const r=await fetch('/api/igdb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({endpoint,query})});
      if(r.status===503){igOff=true;throw new Error('igdb_off')}
      if(r.status===429){igNext=Date.now()+1500;continue}
      const j=await r.json().catch(()=>null);
      if(!r.ok)throw Object.assign(new Error('igdb '+r.status),{status:r.status,body:j});
      return j;
    }
    throw new Error('igdb_busy');
  };
  const p=igChain.then(run,run);igChain=p.catch(()=>{});return p;
}
const igq=t=>String(t).replace(/["\\]/g,' ').slice(0,120);
const gInfo=g=>({id:g.id,cover:g.cover&&g.cover.image_id||null,year:g.first_release_date?new Date(g.first_release_date*1000).getFullYear():0,pf:(g.platforms||[]).map(p=>typeof p==='object'?p.id:p)});
const GFIELDS='id,name,first_release_date,cover.image_id,platforms';
// Steam → IGDB : on essaie le nouveau nom de champ d'IGDB, puis l'ancien
async function steamToIgdb(appids){
  const uids=appids.map(a=>`"${a}"`).join(',');
  const f=`fields uid,game.id,game.name,game.first_release_date,game.cover.image_id,game.platforms;`;
  try{return await igdb('external_games',`${f} where external_game_source = 1 & uid = (${uids}); limit 500;`)}
  catch(e){if(e.status===400)return igdb('external_games',`${f} where category = 1 & uid = (${uids}); limit 500;`);throw e}
}
let gEnriching=false;
async function gameEnrich(){
  if(gEnriching||viewing||!location.protocol.startsWith('http'))return;gEnriching=true;
  try{
    const L=()=>state.game;
    let todo=L().filter(s=>!s.igdb&&!s.igdbMiss&&s.steam&&s.steam.appid);
    for(let i=0;i<todo.length;i+=100){
      const chunk=todo.slice(i,i+100),rows=await steamToIgdb(chunk.map(s=>s.steam.appid));
      const by=new Map((rows||[]).filter(r=>r.game).map(r=>[String(r.uid),r.game]));
      chunk.forEach(s=>{const g=by.get(String(s.steam.appid));if(g)s.igdb=gInfo(g);else s.igdbMiss=1});
      gAfter();
    }
    todo=L().filter(s=>!s.igdb&&!s.igdbMiss);
    for(let i=0;i<todo.length;i+=10){
      const chunk=todo.slice(i,i+10);
      const q=chunk.map((s,j)=>`query games "g${j}" { search "${igq(s.title)}"; fields ${GFIELDS}; limit 1; };`).join('\n');
      const res=await igdb('multiquery',q);
      chunk.forEach((s,j)=>{const r=(res||[]).find(x=>x.name==='g'+j),g=r&&r.result&&r.result[0];if(g){s.igdb=gInfo(g);if(!s.platform||s.platform==='other')s.platform=pfOf(g.platforms)}else s.igdbMiss=1});
      gAfter();
    }
  }catch(e){console.warn(e);if(e.message==='igdb_off'&&tab==='game'&&!igWarned){igWarned=true;toast("Les jaquettes de jeux arriveront dès que l'accès IGDB sera configuré sur le site.")}}
  finally{gEnriching=false;progress()}
}
function gAfter(){save();progress();if(tab!=='game')return;clearTimeout(restyleTimer);
  restyleTimer=setTimeout(()=>{const before=recs.map(r=>r.s.platform).join(','),now=sorted().map(s=>s.platform).join(',');
    if(before!==now)build(true);else recs.forEach(r=>{const u=seriesCover(r.s);if(u)coverImg(u)})},400)}

// --- recherche IGDB dans « Ajouter » ---
let gPick=null;
function renderGameResults(list){
  const box=$('#a-results');if(!list){box.hidden=true;box.innerHTML='';return}box.hidden=false;
  if(!list.length){box.innerHTML='<p class="al-empty">Aucun jeu trouvé sur IGDB. Tu peux quand même l\'ajouter avec ce titre.</p>';return}
  box.innerHTML=list.map((g,i)=>{const c=g.cover&&g.cover.image_id,y=g.first_release_date?new Date(g.first_release_date*1000).getFullYear():'';
    const pl=pfList(g.platforms).filter(k=>k!=='other').map(k=>GAME_PF[k].label).join(', ');
    return `<button type="button" class="al-item" data-i="${i}">${c?`<img alt="" loading="lazy" src="${viaProxy(igdbImg(c,'t_cover_small'))}">`:'<span class="ph"></span>'}<span><b>${esc(g.name)}</b><small>${[y,pl].filter(Boolean).join(' · ')||'Plateforme inconnue'}</small></span></button>`}).join('');
  box.querySelectorAll('.al-item').forEach(b=>b.onclick=()=>{const g=list[+b.dataset.i];gPick=g;$('#a-title').value=g.name;
    const ks=pfList(g.platforms);$('#a-platform').innerHTML=pfOpts(ks[0],ks);renderGameResults(null);
    $('#a-picked').hidden=false;$('#a-picked').textContent='Fiche IGDB sélectionnée : la jaquette sera ajoutée.'})
}
function pfOpts(sel,first){const all=[...new Set([...(first||[]),'switch','ps','xbox','pc','other'])];
  return all.map(k=>`<option value="${k}"${k===sel?' selected':''}>${GAME_PF[k].label}</option>`).join('')}
async function searchGames(q,seq){
  try{const r=await igdb('games',`search "${igq(q)}"; fields ${GFIELDS}; limit 8;`);
    if(seq===searchSeq&&!$('#ov-add').hidden)renderGameResults(r||[])}
  catch(e){if(seq===searchSeq){$('#a-results').hidden=false;$('#a-results').innerHTML=`<p class="al-empty">${e.message==='igdb_off'?"La recherche de jeux n'est pas encore configurée sur le site.":"La recherche IGDB ne répond pas."} Tu peux remplir les champs à la main.</p>`}}
}

// --- import Steam ---
$('#st-form').onsubmit=async e=>{e.preventDefault();
  const v=$('#st-profile').value.trim(),err=$('#st-err'),btn=$('#st-go');err.hidden=true;
  if(!v){err.textContent="Colle l'adresse de ton profil Steam, par exemple https://steamcommunity.com/id/ton-pseudo.";err.hidden=false;return}
  btn.disabled=true;btn.textContent='Import…';
  try{
    const r=await fetch('/api/steam?profile='+encodeURIComponent(v));const j=await r.json().catch(()=>({}));
    if(!r.ok){const m={private_profile:"Ton profil Steam ne montre pas tes jeux. Sur Steam : Profil → Modifier le profil → Confidentialité → « Détails des jeux : Public », puis réessaie.",
      profile_not_found:"Ce profil Steam est introuvable. Vérifie l'adresse ou le pseudo.",not_configured:"L'import Steam n'est pas encore configuré sur le site."};
      throw new Error(m[j.error]||"Steam ne répond pas pour l'instant. Réessaie dans quelques minutes.")}
    const keep=state.game.filter(s=>!s.example),byApp=new Map(keep.filter(s=>s.steam).map(s=>[s.steam.appid,s])),byT=new Map(keep.map(s=>[s.title.toLowerCase(),s]));
    let added=0;
    for(const g of j.games){const ex=byApp.get(g.appid)||byT.get(String(g.name).toLowerCase()),hours=Math.round(g.minutes/60);
      if(ex){ex.steam={appid:g.appid};ex.hours=Math.max(ex.hours||0,hours);continue}
      keep.push({id:uid(),title:String(g.name).slice(0,200),done:0,total:0,score:0,platform:'pc',status:g.minutes>0?'en_cours':'a_lire',steam:{appid:g.appid},hours});added++}
    state.game=keep;save();closeModal('#ov-steam');closePanel();build(false);
    toast(`Import Steam réussi : ${j.games.length} jeux, dont ${added} nouveaux. Les jaquettes arrivent au fur et à mesure.`);gameEnrich();
  }catch(e2){err.textContent=e2.message;err.hidden=false}
  finally{btn.disabled=false;btn.textContent='Importer'}
};
$('#st-close').onclick=()=>closeModal('#ov-steam');

/* ---------- MangaDex : couvertures de chaque tome ---------- */
// MangaDex exige de passer par un serveur : tout va par /api/mangadex et /api/cover.
const mdBusy=new Set();let mdChain=Promise.resolve(),mdNext=0;
function mdGet(params){
  const run=async()=>{
    for(let a=0;a<3;a++){
      const w=mdNext-Date.now();if(w>0)await sleep(w);mdNext=Date.now()+260;
      const r=await fetch('/api/mangadex?'+params.toString());
      if(r.status===429){mdNext=Date.now()+(parseInt(r.headers.get('Retry-After'))||5)*1000;continue}
      if(!r.ok)throw new Error('MangaDex '+r.status);
      return r.json();
    }
    throw new Error('MangaDex indisponible');
  };
  const p=mdChain.then(run,run);mdChain=p.catch(()=>{});return p;
}
async function mdCovers(s){
  if(tab!=='manga'||!s||s.md||s.mdMiss||mdBusy.has(s.id)||!location.protocol.startsWith('http'))return;
  mdBusy.add(s.id);const kind=tab;{const n=$('#p-src');if(n&&panelSid===s.id){n.hidden=false;n.textContent='Recherche des couvertures des tomes…'}}
  try{
    const q=new URLSearchParams({path:'manga',title:(s.al&&s.al.romaji)||s.q||s.title,limit:'10'});
    ['safe','suggestive','erotica'].forEach(c=>q.append('contentRating[]',c));
    const list=((await mdGet(q))||{}).data||[];
    const links=x=>(x.attributes&&x.attributes.links)||{};
    const alId=s.al&&s.al.id?String(s.al.id):'',malId=s.malId?String(s.malId):'';
    // on ne garde que la fiche qui renvoie vers la même série AniList ou MyAnimeList
    let m=list.find(x=>(alId&&links(x).al===alId)||(malId&&links(x).mal===malId));
    if(!m&&!alId&&!malId)m=list[0];
    if(!m){s.mdMiss=1;return}
    const all=[];
    for(let off=0;off<1000;off+=100){
      const c=new URLSearchParams({path:'cover',limit:'100',offset:String(off)});c.append('manga[]',m.id);c.append('order[volume]','asc');
      const r=await mdGet(c);all.push(...((r&&r.data)||[]));if(!r||off+100>=(r.total||0))break;
    }
    // une langue principale pour garder une série homogène, complétée par les autres
    const byLoc={};
    for(const c of all){const a=c.attributes||{};if(!a.volume||!/^\d+$/.test(a.volume)||!a.fileName)continue;(byLoc[a.locale||'?']=byLoc[a.locale||'?']||{})[+a.volume]=a.fileName}
    const rank=l=>l==='ja'?0:l==='fr'?1:2;
    const locs=Object.keys(byLoc).sort((a,b)=>Object.keys(byLoc[b]).length-Object.keys(byLoc[a]).length||rank(a)-rank(b));
    const v={};for(const l of locs.reverse())Object.assign(v,byLoc[l]);
    if(!Object.keys(v).length){s.mdMiss=1;return}
    s.md={id:m.id,v};
  }catch(e){console.warn(e)}
  finally{mdBusy.delete(s.id);save();if(kind===tab)afterMd(s)}
}
function afterMd(s){
  for(const m of proxies.values())if(m.userData.rec.s.id===s.id&&m.userData.cover){removeCover(m);addCover(m)}
  // on laisse finir l'envol de la couverture avant de redessiner la fiche
  if(panelSid===s.id)setTimeout(()=>{if(panelSid===s.id)renderPanel()},reduce?0:700);
}

/* ---------- comptes et pages publiques (Supabase) ---------- */
const CFG=window.MYWEEBRARY_CONFIG||{};
const sb=CFG.supabaseUrl&&CFG.supabaseKey&&window.supabase?window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseKey):null;
const acct={user:null,profile:null};
const synced=new Map();let syncTimer=0,syncing=false,syncAgain=false,syncWarned=false;
const PUBLIC_RE=/^\/u\/([a-z0-9_-]{3,24})\/?$/;
const USER_RE=/^[a-z0-9_-]{3,24}$/;
const RESERVED=['admin','api','app','u','login','compte','hondana','myweebrary','weebrary','support','aide'];
const pageUrl=u=>`${location.origin}/u/${u}`;
const EXTRA=['al','md','estimated','q','alMiss','mdMiss','igdb','igdbMiss','steam','platform','hours'];
function toRow(s,kind){const extra={};for(const k of EXTRA)if(s[k]!=null)extra[k]=s[k];
  return{user_id:acct.user.id,id:String(s.id),kind,title:s.title.slice(0,200),done:s.done,owned:kind==='manga'?Math.max(s.owned||0,s.done):0,total:s.total,status:s.status,score:s.score,mal_id:s.malId||null,extra}}
function fromRow(r){return{...(r.extra||{}),id:r.id,title:r.title,done:r.done,owned:r.owned||0,total:r.total,status:r.status,score:r.score,malId:r.mal_id||0}}
function setLibrary(data){state.manga=data.manga;state.anime=data.anime;state.game=data.game||[]}
async function fetchSeries(uid){
  const rows=[];
  for(let from=0;from<20000;from+=1000){
    const {data,error}=await sb.from('series').select('*').eq('user_id',uid).range(from,from+999);
    if(error)throw error;rows.push(...data);if(data.length<1000)break;
  }
  const out={manga:[],anime:[],game:[]};for(const r of rows)(out[r.kind]||out.manga).push(fromRow(r));return normalize(out);
}

// page publique : /u/pseudo, en lecture seule
async function loadPublic(name){
  $('#banner').hidden=false;$('#banner').innerHTML=`<span>Chargement de la bibliothèque de <b>@${esc(name)}</b>…</span>`;
  try{
    const {data:p,error}=await sb.from('profiles').select('id,username,is_public').eq('username',name).maybeSingle();
    if(error)throw error;
    if(!p){viewing.missing=true;setLibrary({manga:[],anime:[],game:[]});build(false);return}
    viewing.profile=p;setLibrary(await fetchSeries(p.id));
    if(!state.manga.length)tab=state.anime.length?'anime':state.game.length?'game':'manga';
    document.title=`Bibliothèque de @${p.username} · MyWeebrary`;
    build(false);recs.forEach(r=>{if(seriesCover(r.s))coverImg(seriesCover(r.s))});
  }catch(e){console.warn(e);viewing.failed=true;updateHeader();toast("La bibliothèque n'a pas pu être chargée. Recharge la page pour réessayer.")}
}

// mon compte : la bibliothèque vient de Supabase, celle du navigateur y est versée une fois
async function loadAccount(user){
  acct.user=user;updateAccountBtn();
  try{
    const {data:p,error}=await sb.from('profiles').select('*').eq('id',user.id).maybeSingle();
    if(error)throw error;acct.profile=p||null;updateAccountBtn();
    const remote=await fetchSeries(user.id);synced.clear();
    for(const k of ['manga','anime','game'])for(const s of remote[k])synced.set(k+':'+s.id,JSON.stringify(toRow(s,k)));
    // séries de ce navigateur pas encore dans le compte
    let added=0;const localLib=normalize(load()||{});
    for(const k of ['manga','anime','game']){const have=new Set(remote[k].map(s=>s.title.toLowerCase()));
      for(const s of localLib[k])if(!s.example&&!have.has(s.title.toLowerCase())){remote[k].push(s);have.add(s.title.toLowerCase());added++}}
    closePanel();loadingAccount=false;setLibrary(remote);
    build(false);recs.forEach(r=>{if(seriesCover(r.s))coverImg(seriesCover(r.s))});
    if(added){toast(`${added} série${added>1?'s':''} de ce navigateur ajoutée${added>1?'s':''} à ton compte.`);sync()}
    enrich();
    if(!acct.profile)openModal('#ov-user');
  }catch(e){console.warn(e);fallbackLocal();toast("Ton compte n'a pas pu être chargé. Recharge la page pour réessayer.")}
}
function scheduleSync(){if(!sb||!acct.user||viewing)return;clearTimeout(syncTimer);syncTimer=setTimeout(sync,1200)}
async function sync(){
  if(!acct.user)return;if(syncing){syncAgain=true;return}syncing=true;clearTimeout(syncTimer);
  try{
    const up=[],seen=new Set();
    for(const k of ['manga','anime','game'])for(const s of state[k]){if(s.example)continue;const key=k+':'+s.id;seen.add(key);
      const row=toRow(s,k),j=JSON.stringify(row);if(synced.get(key)!==j)up.push([key,row,j])}
    for(let i=0;i<up.length;i+=400){const part=up.slice(i,i+400);
      const {error}=await sb.from('series').upsert(part.map(x=>x[1]),{onConflict:'user_id,id'});if(error)throw error;
      part.forEach(([key,,j])=>synced.set(key,j))}
    const del=[...synced.keys()].filter(k=>!seen.has(k));
    for(let i=0;i<del.length;i+=200){const part=del.slice(i,i+200);
      const {error}=await sb.from('series').delete().eq('user_id',acct.user.id).in('id',part.map(k=>k.split(':')[1]));if(error)throw error;
      part.forEach(k=>synced.delete(k))}
    syncWarned=false;
    // tout est dans le compte : la copie de ce navigateur ne sert plus
    try{localStorage.removeItem(KEY)}catch(e){}
  }catch(e){console.warn(e);if(!syncWarned){syncWarned=true;toast("Tes changements n'ont pas pu être enregistrés dans ton compte. Nouvel essai dans quelques secondes.")}setTimeout(scheduleSync,15000)}
  finally{syncing=false;if(syncAgain){syncAgain=false;scheduleSync()}}
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&syncTimer)sync()});

function updateAccountBtn(){
  const b=$('#btn-account');if(!sb){b.hidden=true;return}b.hidden=false;
  b.textContent=acct.user?(acct.profile?'@'+acct.profile.username:'Mon compte'):'Se connecter';
}
$('#btn-account').onclick=()=>{
  if(!acct.user){$('#lg-sent').hidden=true;$('#lg-err').hidden=true;$('#login-form').hidden=false;openModal('#ov-login');return}
  if(!acct.profile){openModal('#ov-user');return}
  const u=acct.profile.username;$('#ac-name').textContent='@'+u;$('#ac-url').value=pageUrl(u);$('#ac-open').href='/u/'+u;
  $('#ac-public').checked=!!acct.profile.is_public;$('#ac-copy').textContent='Copier';openModal('#ov-account');
};
$('#login-form').onsubmit=async e=>{e.preventDefault();
  const email=$('#lg-email').value.trim(),btn=$('#lg-send'),err=$('#lg-err');err.hidden=true;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){err.textContent='Entre une adresse e-mail valide, par exemple prenom@exemple.fr.';err.hidden=false;return}
  btn.disabled=true;btn.textContent='Envoi…';
  const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.origin+'/'}});
  btn.disabled=false;btn.textContent='Recevoir le lien';
  if(error){err.textContent=/rate|limit|seconds/i.test(error.message)?"Trop de demandes de lien pour l'instant. Réessaie dans quelques minutes.":"Le lien n'a pas pu être envoyé. Vérifie l'adresse et réessaie.";err.hidden=false;return}
  $('#login-form').hidden=true;$('#lg-sent').hidden=false;$('#lg-to').textContent=email;
};
$('#lg-close').onclick=$('#lg-close2').onclick=()=>closeModal('#ov-login');
$('#user-form').onsubmit=async e=>{e.preventDefault();
  const name=$('#us-name').value.trim().toLowerCase(),err=$('#us-err');err.hidden=true;
  if(!USER_RE.test(name)){err.textContent='Ton pseudo doit faire de 3 à 24 caractères : lettres minuscules sans accent, chiffres, tiret ou tiret bas.';err.hidden=false;return}
  if(RESERVED.includes(name)){err.textContent='Ce pseudo est réservé. Choisis-en un autre.';err.hidden=false;return}
  const {data,error}=await sb.from('profiles').insert({id:acct.user.id,username:name,is_public:true}).select().single();
  if(error){console.warn(error);err.textContent=error.code==='23505'?'Ce pseudo est déjà pris. Choisis-en un autre.'
    :(error.code==='PGRST205'||error.code==='42P01'||/schema cache|does not exist/i.test(error.message||''))?"La base de données n'est pas encore prête : le script schema.sql n'a pas été exécuté dans Supabase."
    :error.code==='42501'?"La base refuse l'enregistrement (droits d'accès). Relance le script schema.sql dans Supabase."
    :`Ton pseudo n'a pas pu être enregistré (${error.code||'erreur'} : ${error.message||'inconnue'}).`;err.hidden=false;return}
  acct.profile=data;updateAccountBtn();closeModal('#ov-user');sync();
  toast(`Ta page publique est prête : ${pageUrl(name)}`);
};
$('#us-name').addEventListener('input',e=>{const v=e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g,'');if(v!==e.target.value)e.target.value=v;$('#us-preview').textContent=pageUrl(v||'pseudo')});
$('#us-later').onclick=()=>closeModal('#ov-user');
$('#ac-copy').onclick=async()=>{const i=$('#ac-url');try{await navigator.clipboard.writeText(i.value);$('#ac-copy').textContent='Copié'}catch(e){i.focus();i.select()}};
$('#ac-public').onchange=async e=>{const v=e.target.checked;
  const {error}=await sb.from('profiles').update({is_public:v}).eq('id',acct.user.id);
  if(error){e.target.checked=!v;toast("Le réglage n'a pas pu être enregistré. Réessaie.");return}
  acct.profile.is_public=v;toast(v?'Ta page est visible par tout le monde.':'Ta page est maintenant privée : seul toi peux la voir.')};
$('#ac-logout').onclick=async()=>{await sync();await sb.auth.signOut();location.href='/'};
$('#ac-close').onclick=()=>closeModal('#ov-account');

function fallbackLocal(){if(!loadingAccount)return;loadingAccount=false;setLibrary(normalize(load()||JSON.parse(JSON.stringify(EXAMPLE))));build(false);enrich()}
async function initAccounts(){
  updateAccountBtn();if(!sb){fallbackLocal();return}
  const {data}=await sb.auth.getSession();const session=data&&data.session;
  if(viewing){
    if(session){acct.user=session.user;updateAccountBtn();
      sb.from('profiles').select('*').eq('id',session.user.id).maybeSingle().then(({data})=>{acct.profile=data||null;updateAccountBtn();updateBanner()})}
    await loadPublic(viewing.name);return}
  if(session)await loadAccount(session.user);else{fallbackLocal();updateBanner()}
  sb.auth.onAuthStateChange((ev,session)=>{
    if(ev==='SIGNED_IN'&&session&&(!acct.user||acct.user.id!==session.user.id)){closeModal('#ov-login');loadAccount(session.user)}
    if(ev==='SIGNED_OUT'&&acct.user){acct.user=null;acct.profile=null;location.href='/'}
  });
}

/* ---------- ouverture : les LED s'allument, les tomes se rangent ---------- */
let intro=null,lightsShown=false,rowLed=[],rowGlow=[];
const BASE_LED=new THREE.Color(4,4.3,4.8),easeOut=t=>1-Math.pow(1-t,3),TMP={x:0,y:0,z:0,rz:0};
// scintillement d'un néon qui démarre
function flick(t){if(t<=0)return 0;if(t<50)return 1;if(t<100)return .12;if(t<150)return .85;if(t<190)return .25;if(t<330)return .25+(t-190)/140*.75;return 1}
function setRow(r,v){LED.uRowOn.value.setComponent(r,v);if(rowLed[r])rowLed[r].color.copy(BASE_LED).multiplyScalar(Math.max(v,.03));if(rowGlow[r])rowGlow[r].opacity=v}
function startIntro(){
  if(reduce){endIntro();return}
  const lights=!lightsShown;lightsShown=true;const list=[];let end=0;
  for(const rec of recs)rec.pos.forEach((p,i)=>{const row=clamp(ROWS-1-Math.round((p.y-rec.dim.h/2-PLANK)/ROW_H),0,ROWS-1),mod=p.mod||0;
    const d=(lights?380+row*260:row*150)+((p.x-modX0(mod))/layout.OW)*420+Math.min(mod,3)*160;if(d>end)end=d;
    list.push({rec,i,p,d,done:false});rec.mesh.setMatrixAt(i,placeMatrix(p,true));rec.mesh.instanceMatrix.needsUpdate=true});
  intro={t0:performance.now(),lights,list,end:end+700};
  for(let r=0;r<ROWS;r++)setRow(r,lights?0:1);invalidate();
}
function stepIntro(now){
  const t=now-intro.t0,touched=new Set();
  if(intro.lights)for(let r=0;r<ROWS;r++)setRow(r,flick(t-120-r*260));
  for(const x of intro.list){if(x.done)continue;const e=(t-x.d)/620;if(e<=0)continue;
    if(proxies.has(x.rec.s.id+':'+(x.i+1))){x.done=true;continue}
    const k=easeOut(Math.min(1,e));TMP.x=x.p.x;TMP.y=x.p.y+(1-k)*.45;TMP.z=x.p.z+(1-k)*1.1;TMP.rz=x.p.rz+(1-k)*.22;
    x.rec.mesh.setMatrixAt(x.i,placeMatrix(TMP,false));touched.add(x.rec.mesh);if(e>=1)x.done=true}
  touched.forEach(m=>m.instanceMatrix.needsUpdate=true);
  return t<intro.end;
}
function endIntro(){
  if(intro){for(const x of intro.list)if(!x.done&&!proxies.has(x.rec.s.id+':'+(x.i+1))){x.rec.mesh.setMatrixAt(x.i,placeMatrix(x.p,false));x.rec.mesh.instanceMatrix.needsUpdate=true}intro=null}
  for(let r=0;r<ROWS;r++)setRow(r,1);invalidate();
}

/* ---------- boucle ---------- */
// l'image n'est recalculée que si quelque chose bouge : sinon le navigateur se repose (batterie)
let raf=0;
function invalidate(){if(!raf)raf=requestAnimationFrame(frame)}
const ease=(o,a,b,k)=>{const d=o[b]-o[a];if(Math.abs(d)<1e-4){o[a]=o[b];return false}o[a]+=d*k;return true};
function frame(){
  raf=0;
  const k=reduce?1:.12;
  let moving=ease(cam,'x','tx',k)|ease(cam,'y','ty',k)|ease(cam,'d','td',k)|ease(par,'x','tx',.06)|ease(par,'y','ty',.06);
  const pf=reduce?0:cam.d/7;
  camera.position.set(cam.x+par.x*.9*pf,cam.y-par.y*.5*pf,cam.d);camera.lookAt(cam.x,cam.y,0);
  // la lumière principale suit la zone regardée pour garder des ombres nettes
  const v=vis(cam.d),half=Math.max(v.w,v.h)*.62+1.5,sc=key.shadow.camera;
  key.target.position.set(cam.x,cam.y,0);key.position.set(cam.x-3,cam.y+4.5,11);
  if(Math.abs(sc.right-half)>.05){sc.left=-half;sc.right=half;sc.top=half;sc.bottom=-half;sc.near=1;sc.far=30;sc.updateProjectionMatrix()}
  for(const m of [...proxies.values()]){const u=m.userData;
    u.pull+=(u.tp-u.pull)*(reduce?1:.14);u.hover+=(u.th-u.hover)*(reduce?1:.2);
    if(Math.abs(u.pull-u.tp)<.003)u.pull=u.tp;if(Math.abs(u.hover-u.th)<.003)u.hover=u.th;
    if(u.pull!==u.tp||u.hover!==u.th)moving=true;
    if(u.tp===0&&u.th===0&&u.pull===0&&u.hover===0){releaseProxy(m);continue}
    m.position.set(u.base.x,u.base.y+u.pull*.28,u.base.z+u.hover*.16+u.pull*1.4);
    m.rotation.set(0,-u.pull*(Math.PI/2-.3),u.base.rz*(1-u.pull));m.scale.setScalar(1+u.pull*.18)}
  if(intro){if(stepIntro(performance.now()))moving=true;else endIntro()}
  updModLabel();
  renderer.render(scene,camera);
  if(moving)invalidate();
}
try{await Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,2500))])}catch(e){}
resize();build(false);invalidate();
// les couvertures déjà connues sont chargées, les autres sont demandées à AniList
if(viewing){$('#btn-add').hidden=true;$('#btn-import').hidden=true}
recs.forEach(r=>{if(seriesCover(r.s))coverImg(seriesCover(r.s))});
initAccounts().catch(e=>console.warn(e)).then(()=>{if(!viewing&&!acct.user)enrich()});
})();
