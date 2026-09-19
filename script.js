pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const $=id=>document.getElementById(id);
const toast=m=>{const t=$('toast');t.textContent=m;t.classList.add('show');clearTimeout(toast._);toast._=setTimeout(()=>t.classList.remove('show'),2200)};

/* ===== FONT LISTS ===== */
const UNICODE_FONTS = [
  // English / Latin
  'Arial','Times New Roman','Helvetica','Georgia','Verdana','Courier','Calibri',
  'Noto Sans','Noto Serif','Poppins','Roboto','Open Sans','Lato','Inter','Hind',
  // Devanagari (Hindi / Sanskrit / Marathi / Nepali)
  'Noto Sans Devanagari','Noto Serif Devanagari','Lohit Devanagari','Tiro Devanagari Hindi','Mangal','Aparajita','Utsaah',
  // Bengali
  'Noto Sans Bengali',
  // Tamil
  'Noto Sans Tamil',
  // Gujarati
  'Noto Sans Gujarati',
  // Gurmukhi
  'Noto Sans Gurmukhi',
  // Kannada
  'Noto Sans Kannada',
  // Malayalam
  'Noto Sans Malayalam',
  // Telugu
  'Noto Sans Telugu',
  // Legacy Kruti Dev
  'Kruti Dev 010','Kruti Dev 014'
];

/* ===== KRUTI DEV CONVERSION ===== */
const KM={',ksS':'ॠ',',ks':'ऋ',',kS':'ॡ','vS':'ऑ','vkS':'औ','vk':'ओ','Bk':'आ',',d':'ई',',':'इ','nq':'ऊ','n':'उ',',s':'ए',',dk':'ऐ','[kk':'खा','[k':'ख','xk':'गा','x':'ग','?kk':'घा','?':'घ','³':'ङ','pkS':'चौ','pk':'चा','p':'च','Nk':'छा','N':'छ','tk':'जा','t':'ज','>k':'झा','>':'झ','}':'ञ','Vk':'टा','V':'ट','Mk':'डा','M':'ड','<Mk':'ढा','<M':'ढ','.kk':'णा','.':'ण','rk':'ता','r':'त','Fkk':'था','F':'थ','nk':'दा','/kk':'धा','/':'ध','uk':'ना','Qk':'फा','Q':'फ','ck':'बा','c':'ब','Hkk':'भा','H':'भ','ek':'मा','e':'म',';k':'या',';':'य','jk':'रा','j':'र','yk':'ला','y':'ल','Ok':'वा','O':'व','ok':'वा','o':'व',"'k":"शा","'":"श",'"k':'षा','"':'ष','lk':'सा','l':'स','gk':'हा','g':'ह','DkS':'कृ','Dk':'क','kkS':'ौ','kk':'ा','h':'ी','S':'्','W':'ँ','a':'ं','f':'ि','q':'ु','w':'ू','s':'े','ks':'ो','B':'अ','%':'०','`':'१','d':'२','n':'३','p':'४','i':'५','t':'६','l':'७','g':'८','c':'९','È':'़','••':'॥','•':'।','·':'ॐ'};
const KM14=Object.assign({},KM);

function isKruti(t){if(!t)return false;if(/[\u0900-\u097F]/.test(t))return false;let m=0;for(let i=0;i<t.length;i++)if(/[vBZnk,.\[\]{}<>|\\\/\^&\*%`~]/.test(t[i]))m++;return m/t.length>.4}
function k2u(t,v='010'){if(!t)return t;const m=v==='014'?KM14:KM;const ks=Object.keys(m).sort((a,b)=>b.length-a.length);let r='',i=0;while(i<t.length){let f=false;for(const k of ks)if(t.substr(i,k.length)===k){r+=m[k];i+=k.length;f=true;break}if(!f){r+=t[i];i++}}return r}
function u2k(t,v='010'){if(!t)return t;const m=v==='014'?KM14:KM;const rm={};for(const[k,v2]of Object.entries(m))if(!rm[v2]||k.length>rm[v2].length)rm[v2]=k;const ks=Object.keys(rm).sort((a,b)=>b.length-a.length);let r='',i=0;while(i<t.length){let f=false;for(const k of ks)if(t.substr(i,k.length)===k){r+=rm[k];i+=k.length;f=true;break}if(!f){r+=t[i];i++}}return r}
function detKruti(f){if(!f)return null;const n=f.replace(/\+/g,' ').toLowerCase();if(/kruti\s*dev\s*0?10/.test(n))return'Kruti Dev 010';if(/kruti\s*dev\s*0?14/.test(n))return'Kruti Dev 014';return null}
function normFont(r){if(!r)return'Unknown';const k=detKruti(r);if(k)return k;let n=r.replace(/^[A-Z]{6}\+/,'').replace(/[-_,]/g,' ').replace(/\s+/g,' ').trim();const l=n.toLowerCase();if(l.includes('arial'))return'Arial';if(l.includes('times'))return'Times New Roman';if(l.includes('helvetica'))return'Helvetica';if(l.includes('courier'))return'Courier';if(l.includes('georgia'))return'Georgia';if(l.includes('verdana'))return'Verdana';if(l.includes('calibri'))return'Calibri';if(l.includes('mangal'))return'Mangal';if(l.includes('noto')&&l.includes('devanagari'))return l.includes('serif')?'Noto Serif Devanagari':'Noto Sans Devanagari';if(l.includes('poppins'))return'Poppins';if(l.includes('roboto'))return'Roboto';if(l.includes('open sans'))return'Open Sans';if(l.includes('lato'))return'Lato';if(l.includes('inter'))return'Inter';if(l.includes('hind'))return'Hind';if(l.includes('lohit')&&l.includes('devanagari'))return'Lohit Devanagari';if(l.includes('tiro')&&l.includes('devanagari'))return'Tiro Devanagari Hindi';return n||'Unknown'}

/* ===== STATE ===== */
const S={pdf:null,bytes:null,cp:1,tp:0,sc:1.25,vp:null,tool:'select',hist:[],hi:-1,pa:new Map(),sel:null,edit:null,pencil:{sz:3,c:'#111827'},hl:{c:'#fde047'},eraser:{mode:'circle',sz:30},textStyle:{font:'Noto Sans Devanagari',size:16,color:'#000000',bold:false,italic:false},lock:false,lastClick:0,lastClickPos:null};

function snap(){const s=new Map();for(const[k,v]of S.pa)s.set(k,JSON.parse(JSON.stringify(v)));S.hist=S.hist.slice(0,S.hi+1);S.hist.push(s);S.hi=S.hist.length-1;updUR()}
function rest(s){S.pa=new Map();for(const[k,v]of s)S.pa.set(k,JSON.parse(JSON.stringify(v)));renderA();updUR()}
function undo(){if(S.hi<=0)return;S.hi--;rest(S.hist[S.hi]);toast('Undo')}
function redo(){if(S.hi>=S.hist.length-1)return;S.hi++;rest(S.hist[S.hi]);toast('Redo')}
function updUR(){$('bUn').disabled=S.hi<=0;$('bRe').disabled=S.hi>=S.hist.length-1}

/* ===== PDF LOAD/RENDER ===== */
async function loadPDF(f){try{const b=await f.arrayBuffer();S.bytes=new Uint8Array(b);S.pdf=await pdfjsLib.getDocument({data:S.bytes.slice()}).promise;S.tp=S.pdf.numPages;S.cp=1;$('emp').style.display='none';$('pw').style.display='block';$('pn').style.display='flex';$('pInf').textContent=S.tp+' pages';snap();await renderP(S.cp);toast('PDF loaded — double-click empty area to add text')}catch(e){console.error(e);toast('Failed to open PDF')}}

async function renderP(n){if(!S.pdf)return;const pg=await S.pdf.getPage(n);const vp=pg.getViewport({scale:S.sc});S.vp=vp;const cv=$('pc'),cx=cv.getContext('2d'),d=devicePixelRatio||1;cv.width=vp.width*d;cv.height=vp.height*d;cv.style.width=vp.width+'px';cv.style.height=vp.height+'px';cx.setTransform(d,0,0,d,0,0);await pg.render({canvasContext:cx,viewport:vp}).promise;const td=$('tl');td.style.width=vp.width+'px';td.style.height=vp.height+'px';td.style.setProperty('--scale-factor',S.sc);td.innerHTML='';const tc=await pg.getTextContent();await pdfjsLib.renderTextLayer({textContent:tc,container:td,viewport:vp,enhanceTextSelection:true}).promise;const an=$('ac');an.width=vp.width*d;an.height=vp.height*d;an.style.width=vp.width+'px';an.style.height=vp.height+'px';$('pw').style.width=vp.width+'px';$('pw').style.height=vp.height+'px';renderA();updPL();showHint()}

function updPL(){$('pLb').textContent=`Page ${S.cp} of ${S.tp}`;$('bPr').disabled=S.cp<=1;$('bNx').disabled=S.cp>=S.tp}
function epa(n){if(!S.pa.has(n))S.pa.set(n,{strokes:[],highlights:[],erases:[],edits:[],pageNumbers:[]});return S.pa.get(n)}

function renderA(){const an=$('ac'),cx=an.getContext('2d'),d=devicePixelRatio||1;cx.setTransform(d,0,0,d,0,0);cx.clearRect(0,0,an.width,an.height);const a=epa(S.cp);
for(const e of a.erases){cx.fillStyle=e.c||'#fff';if(e.sh==='r')cx.fillRect(e.x,e.y,e.w,e.h);else{cx.beginPath();cx.arc(e.x,e.y,e.r,0,Math.PI*2);cx.fill()}}
for(const h of a.highlights){cx.fillStyle=h.c+'80';cx.fillRect(h.x,h.y,h.w,h.h)}
for(const s of a.strokes){if(s.pts.length<2)continue;cx.strokeStyle=s.c;cx.lineWidth=s.sz;cx.lineCap='round';cx.lineJoin='round';cx.beginPath();cx.moveTo(s.pts[0].x,s.pts[0].y);for(let i=1;i<s.pts.length;i++){const a=s.pts[i-1],b=s.pts[i];cx.quadraticCurveTo(a.x,a.y,(a.x+b.x)/2,(a.y+b.y)/2)}cx.stroke()}
for(const e of a.edits){cx.save();cx.font=`${e.it?'italic ':''}${e.bd?'bold ':''}${e.sz}px "${e.fn}"`;cx.fillStyle=e.c||'#000';cx.textBaseline='top';cx.fillText(e.tx,e.x,e.y);cx.restore()}
for(const p of a.pageNumbers){cx.save();cx.font=`${p.sz}px sans-serif`;cx.fillStyle=p.c||'#000';cx.textBaseline='middle';let x=0,y=0;const v=S.vp;if(p.pos.startsWith('h'))y=p.sz+10;else y=v.height-p.sz-10;if(p.pos.endsWith('left')){cx.textAlign='left';x=20}else if(p.pos.endsWith('right')){cx.textAlign='right';x=v.width-20}else{cx.textAlign='center';x=v.width/2}cx.fillText(p.tx,x,y);cx.restore()}}

function showHint(){if(S.pdf&&!S.edit){$('hint').style.display='block';clearTimeout(showHint._);showHint._=setTimeout(()=>$('hint').style.display='none',3500)}}

/* ===== TOOL SWITCHING ===== */
function setTool(t){S.tool=t;document.querySelectorAll('[data-tool]').forEach(b=>b.classList.toggle('on',b.dataset.tool===t));$('stage').classList.toggle('dm',t==='pencil'||t==='eraser'||t==='highlight');$('ov').classList.toggle('ia',t==='move'||t==='pencil'||t==='eraser'||t==='highlight');$('cc').style.display=(t==='eraser'&&S.eraser.mode==='circle')?'block':'none';$('pT').textContent=t[0].toUpperCase()+t.slice(1);hideTT();closeEd();if(t==='text')toast('Click on the page to write text')}

/* ===== TEXT SELECTION ===== */
function getSel(){const s=window.getSelection();if(!s||s.rangeCount===0||s.isCollapsed)return null;const r=s.getRangeAt(0),tl=$('tl');if(!tl.contains(r.commonAncestorContainer))return null;const sp=Array.from(tl.querySelectorAll('span')).filter(s=>{try{return r.intersectsNode(s)}catch(e){return false}});if(!sp.length)return null;const txt=s.toString(),fs=sp[0],cs=getComputedStyle(fs),rf=fs.dataset.fontName||cs.fontFamily,fz=parseFloat(cs.fontSize)||12;const rc=[];for(const s of sp){const b=s.getBoundingClientRect();if(b.width>0)rc.push(b)}if(!rc.length)return null;return{spans:sp,text:txt,font:rf,size:fz,box:{l:Math.min(...rc.map(r=>r.left)),t:Math.min(...rc.map(r=>r.top)),r:Math.max(...rc.map(r=>r.right)),b:Math.max(...rc.map(r=>r.bottom))}}}

function populateFontDropdown(detected){const fonts=[...UNICODE_FONTS];if(detected&&detected!=='Unknown'&&!fonts.includes(detected))fonts.unshift(detected);for(const id of ['tF','fontTop']){const fs=$(id);fs.innerHTML='';for(const f of fonts){const o=document.createElement('option');o.value=f;o.textContent=f;if(f===detected)o.selected=true;fs.appendChild(o)}}}

function showTT(sel){const tb=$('tt'),wr=$('pw').getBoundingClientRect();const cx=(sel.box.l+sel.box.r)/2-wr.left,cy=sel.box.t-wr.top;tb.style.left=cx+'px';tb.style.top=cy+'px';tb.style.display='flex';
const det=normFont(sel.font);populateFontDropdown(det);
$('tS').value=Math.round(sel.size*.75);S.sel=sel;S.lock=true;showEB(sel)}

function showTTAt(x,y,font,size){const tb=$('tt'),wr=$('pw').getBoundingClientRect();tb.style.left=(x-wr.left)+'px';tb.style.top=(y-wr.top)+'px';tb.style.display='flex';
populateFontDropdown(font||'Noto Sans Devanagari');
$('tS').value=size||16;S.lock=true}

function hideTT(){$('tt').style.display='none';$('eb').style.display='none';S.lock=false}

function showEB(sel){const b=$('eb'),det=normFont(sel.font),ik=det==='Kruti Dev 010'||det==='Kruti Dev 014',lk=!ik&&isKruti(sel.text);if(ik||lk){const v=det==='Kruti Dev 014'?'014':'010';b.textContent=`🔤 ${det!=='Unknown'?det:'Kruti Dev'} → Unicode`;b.style.display='block';const wr=$('pw').getBoundingClientRect();b.style.left=((sel.box.l+sel.box.r)/2-wr.left)+'px';b.style.top=(sel.box.b-wr.top+6)+'px';S.sel.enc=v;S.sel.isK=true}else{b.style.display='none';if(S.sel){S.sel.enc=null;S.sel.isK=false}}}

document.addEventListener('selectionchange',()=>{if(S.tool!=='select')return;if(S.lock)return;if(S.edit)return;const s=getSel();if(s)showTT(s);else hideTT()});

/* ===== CLICK OUTSIDE TO DISMISS ===== */
$('stage').addEventListener('pointerdown',e=>{if(e.target.closest('.tt')||e.target.closest('.te')||e.target.closest('.eb'))return;if(S.edit)return;S.lock=false;hideTT()});
$('stage').addEventListener('scroll',()=>{if(!S.edit)hideTT()});

/* ===== TEXT EDITOR — EDIT EXISTING ===== */
function openEd(){if(!S.sel){toast('Select text first');return}closeEd();const wr=$('pw'),wrR=wr.getBoundingClientRect(),sel=S.sel,det=normFont(sel.font),ik=det==='Kruti Dev 010'||det==='Kruti Dev 014'||sel.isK||isKruti(sel.text),v=sel.enc||(det==='Kruti Dev 014'?'014':'010');let dt=sel.text,ef=det;if(ik){dt=k2u(sel.text,v);ef='Noto Sans Devanagari';toast('Converted to Unicode')}
const d=document.createElement('div');d.className='te';d.contentEditable='true';d.spellcheck=false;d.style.fontFamily=`"${ef}",sans-serif`;d.style.fontSize=sel.size+'px';d.style.left=(sel.box.l-wrR.left)+'px';d.style.top=(sel.box.t-wrR.top)+'px';d.style.color=getComputedStyle(sel.spans[0]).color;d.textContent=dt;wr.appendChild(d);S.lock=true;
setTimeout(()=>{d.focus();const r=document.createRange();r.selectNodeContents(d);const s=window.getSelection();s.removeAllRanges();s.addRange(r)},30);
S.edit={el:d,orig:sel.text,of:det,ik:ik,v:v,box:sel.box,isNew:false};
attachEdHandlers(d)}

/* ===== TEXT EDITOR — ADD NEW (double-click on empty area) ===== */
function openNewEd(clientX,clientY){closeEd();const wr=$('pw'),wrR=wr.getBoundingClientRect(),ts=S.textStyle;const x=clientX-wrR.left,y=clientY-wrR.top;
const d=document.createElement('div');d.className='te';d.contentEditable='true';d.spellcheck=false;d.style.fontFamily=`"${ts.font}",sans-serif`;d.style.fontSize=ts.size+'px';d.style.fontWeight=ts.bold?'bold':'normal';d.style.fontStyle=ts.italic?'italic':'normal';d.style.left=x+'px';d.style.top=y+'px';d.style.color=ts.color;d.textContent='';wr.appendChild(d);
S.lock=true;
setTimeout(()=>{d.focus()},30);
S.edit={el:d,orig:'',of:ts.font,ik:false,v:null,box:{l:clientX,t:clientY,r:clientX+40,b:clientY+20},isNew:true};
showTTAt(clientX,clientY,ts.font,ts.size);
attachEdHandlers(d);
toast('Type your text — choose any font')}

function attachEdHandlers(d){
d.addEventListener('blur',()=>{setTimeout(()=>{if(S.edit&&S.edit.el===d)commitEd();S.lock=false},180)});
d.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();d.blur()}if(e.key==='Escape'){if(S.edit&&S.edit.isNew){d.remove();S.edit=null;hideTT()}else{d.textContent=S.edit.orig;d.blur()}}});
}

function commitEd(){if(!S.edit)return;const{el,orig,box,ik,v,of,isNew}=S.edit;const nt=el.textContent;
if(nt.trim()!==''){const a=epa(S.cp),wrR=$('pw').getBoundingClientRect();
if(!isNew){a.erases.push({sh:'r',x:box.l-wrR.left,y:box.t-wrR.top,w:box.r-box.l,h:box.b-box.t,c:'#fff'})}
const cs=getComputedStyle(el);let et=nt,ef=cs.fontFamily.replace(/"/g,'');
// If user chose a Kruti font, convert Unicode → Kruti for export
const chosenFont=$('tF').value;
if(chosenFont==='Kruti Dev 010'||chosenFont==='Kruti Dev 014'){et=u2k(nt,chosenFont==='Kruti Dev 014'?'014':'010');ef=chosenFont}
else if(ik){et=u2k(nt,v);ef=of}
a.edits.push({tx:et,x:box.l-wrR.left,y:box.t-wrR.top,sz:parseFloat(cs.fontSize),fn:ef,bd:cs.fontWeight>=600,it:cs.fontStyle==='italic',c:cs.color,isNew:!!isNew});
snap();renderA()}
if(el.parentNode)el.remove();S.edit=null;hideTT()}

function closeEd(){if(S.edit)commitEd()}

/* ===== TOOLBAR BUTTON HANDLERS ===== */
['tB','tI','tH'].forEach(id=>{$(id).addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation()})});
$('tF').addEventListener('pointerdown',e=>e.stopPropagation());
$('tS').addEventListener('pointerdown',e=>e.stopPropagation());

$('tF').addEventListener('change',e=>{S.textStyle.font=e.target.value;$('fontTop').value=e.target.value;if(S.edit)S.edit.el.style.fontFamily=`"${e.target.value}",sans-serif`});
$('tS').addEventListener('change',e=>{S.textStyle.size=parseFloat(e.target.value)||16;$('fontSizeTop').value=S.textStyle.size;if(S.edit)S.edit.el.style.fontSize=(S.textStyle.size*1.333)+'px'});

$('fontTop').addEventListener('change',e=>{$('tF').value=e.target.value;S.textStyle.font=e.target.value;if(S.edit)S.edit.el.style.fontFamily=`"${e.target.value}",sans-serif`});
$('fontSizeTop').addEventListener('change',e=>{S.textStyle.size=parseFloat(e.target.value)||16;$('tS').value=S.textStyle.size;if(S.edit)S.edit.el.style.fontSize=(S.textStyle.size*1.333)+'px'});
$('fontBoldTop').addEventListener('click',()=>{S.textStyle.bold=!S.textStyle.bold;$('fontBoldTop').classList.toggle('on',S.textStyle.bold);if(S.edit)S.edit.el.style.fontWeight=S.textStyle.bold?'bold':'normal'});
$('fontItalicTop').addEventListener('click',()=>{S.textStyle.italic=!S.textStyle.italic;$('fontItalicTop').classList.toggle('on',S.textStyle.italic);if(S.edit)S.edit.el.style.fontStyle=S.textStyle.italic?'italic':'normal'});
$('fontColorTop').addEventListener('input',e=>{$('fontColorTopSwatch').style.background=e.target.value;S.textStyle.color=e.target.value;if(S.edit){S.edit.el.style.color=e.target.value;$('tCP').value=e.target.value;$('tCS').style.background=e.target.value}});

$('tB').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(!S.edit){toast('Double-click to add text first');return}const c=S.edit.el.style.fontWeight,ib=c==='bold'||parseInt(c)>=600;S.edit.el.style.fontWeight=ib?'normal':'bold';$('tB').classList.toggle('on',!ib)});

$('tI').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();if(!S.edit){toast('Double-click to add text first');return}const c=S.edit.el.style.fontStyle,ii=c==='italic';S.edit.el.style.fontStyle=ii?'normal':'italic';$('tI').classList.toggle('on',!ii)});

$('tCP').addEventListener('input',e=>{if(!S.edit){toast('Double-click to add text first');return}S.edit.el.style.color=e.target.value;$('tCS').style.background=e.target.value});

$('tH').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();
// Highlight either selection or current editor region
const a=epa(S.cp),wrR=$('pw').getBoundingClientRect();
let box=null;
if(S.edit){const r=S.edit.el.getBoundingClientRect();box={l:r.left,t:r.top,r:r.right,b:r.bottom}}
else if(S.sel){box=S.sel.box}
if(!box){toast('Select or edit text first');return}
a.highlights.push({x:box.l-wrR.left,y:box.t-wrR.top,w:box.r-box.l,h:box.b-box.t,c:S.hl.c});
snap();renderA();toast('Highlight applied')});

/* ===== DOUBLE-CLICK HANDLER — edit existing OR add new ===== */
$('stage').addEventListener('dblclick',e=>{
  if(!$('pw').contains(e.target))return;
  if(e.target.closest('.tt')||e.target.closest('.te'))return;
  if(S.tool!=='select'&&S.tool!=='text')return;
  const s=S.tool==='select'?getSel():null;
  if(s){S.sel=s;openEd()}
  else{
    window.getSelection().removeAllRanges();
    openNewEd(e.clientX,e.clientY);
  }
});

$('stage').addEventListener('click',e=>{
  if(S.tool!=='text'||S.edit||!$('pw').contains(e.target))return;
  if(e.target.closest('.tt')||e.target.closest('.te'))return;
  openNewEd(e.clientX,e.clientY);
});

/* ===== DRAWING ===== */
const acv=$('ac');let drw=null,lastP=null;
function gpp(e){const r=acv.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top}}

acv.addEventListener('pointerdown',e=>{
  if(S.tool==='select')return;
  if(S.tool==='move'){handleMoveDown(e);return}
  e.preventDefault();acv.setPointerCapture(e.pointerId);const p=gpp(e);lastP=p;
  if(S.tool==='pencil')drw={t:'s',pts:[p],sz:S.pencil.sz,c:S.pencil.c};
  else if(S.tool==='highlight')drw={t:'h',s:p,l:p,c:S.hl.c};
  else if(S.tool==='eraser'){if(S.eraser.mode==='circle')drw={t:'ec',pts:[p],r:S.eraser.sz};else drw={t:'er',s:p,e:p}}
});

acv.addEventListener('pointermove',e=>{
  const p=gpp(e);lastP=p;
  if(S.tool==='move'){handleMoveMove(e);return}
  if(S.tool==='eraser'&&S.eraser.mode==='circle'&&!drw){const c=$('cc');c.style.display='block';c.style.width=c.style.height=(S.eraser.sz*2)+'px';c.style.left=p.x+'px';c.style.top=p.y+'px'}
  if(!drw)return;e.preventDefault();
  const cx=acv.getContext('2d'),d=devicePixelRatio||1;
  if(drw.t==='s'){drw.pts.push(p);renderA();cx.setTransform(d,0,0,d,0,0);cx.strokeStyle=drw.c;cx.lineWidth=drw.sz;cx.lineCap='round';cx.lineJoin='round';cx.beginPath();cx.moveTo(drw.pts[0].x,drw.pts[0].y);for(let i=1;i<drw.pts.length;i++){const a=drw.pts[i-1],b=drw.pts[i];cx.quadraticCurveTo(a.x,a.y,(a.x+b.x)/2,(a.y+b.y)/2)}cx.stroke()}
  else if(drw.t==='h'){drw.l=p;renderA();cx.setTransform(d,0,0,d,0,0);cx.fillStyle=drw.c+'80';cx.fillRect(Math.min(drw.s.x,p.x),Math.min(drw.s.y,p.y),Math.abs(p.x-drw.s.x),Math.abs(p.y-drw.s.y))}
  else if(drw.t==='ec'){drw.pts.push(p);renderA();cx.setTransform(d,0,0,d,0,0);cx.fillStyle='#fff';cx.beginPath();cx.arc(p.x,p.y,drw.r,0,Math.PI*2);cx.fill()}
  else if(drw.t==='er'){drw.e=p;renderA();cx.setTransform(d,0,0,d,0,0);cx.fillStyle='#fff';cx.fillRect(Math.min(drw.s.x,p.x),Math.min(drw.s.y,p.y),Math.abs(p.x-drw.s.x),Math.abs(p.y-drw.s.y))}
});

function finDrw(){if(!drw)return;const a=epa(S.cp),p=lastP;
if(drw.t==='s')a.strokes.push({pts:drw.pts,sz:drw.sz,c:drw.c});
else if(drw.t==='h'){const e=drw.l||p;a.highlights.push({x:Math.min(drw.s.x,e.x),y:Math.min(drw.s.y,e.y),w:Math.abs(e.x-drw.s.x),h:Math.abs(e.y-drw.s.y),c:drw.c})}
else if(drw.t==='ec')for(const pt of drw.pts)a.erases.push({sh:'c',x:pt.x,y:pt.y,r:drw.r,c:'#fff'});
else if(drw.t==='er'){const e=drw.e||p;a.erases.push({sh:'r',c:'#fff',x:Math.min(drw.s.x,e.x),y:Math.min(drw.s.y,e.y),w:Math.abs(e.x-drw.s.x),h:Math.abs(e.y-drw.s.y)})}
drw=null;snap();renderA()}

acv.addEventListener('pointerup',finDrw);
acv.addEventListener('pointercancel',finDrw);

/* ===== MOVE TOOL ===== */
let mv=null;
function handleMoveDown(e){const p=gpp(e),a=epa(S.cp);for(let i=a.edits.length-1;i>=0;i--){const ed=a.edits[i];if(p.x>=ed.x&&p.x<=ed.x+300&&p.y>=ed.y&&p.y<=ed.y+ed.sz+4){mv={i:i,s:p,ox:ed.x,oy:ed.y};acv.setPointerCapture(e.pointerId);e.preventDefault();break}}}
function handleMoveMove(e){if(!mv)return;const p=gpp(e),a=epa(S.cp),ed=a.edits[mv.i];ed.x=mv.ox+(p.x-mv.s.x);ed.y=mv.oy+(p.y-mv.s.y);renderA()}
acv.addEventListener('pointerup',()=>{if(mv){mv=null;snap()}});

/* ===== TOOL BUTTONS ===== */
document.querySelectorAll('[data-tool]').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));

/* ===== PROPS PANEL ===== */
$('psS').addEventListener('input',e=>S.pencil.sz=+e.target.value);
$('psC').innerHTML=['#111827','#dc2626','#2563eb','#16a34a','#eab308','#9333ea','#fff'].map(c=>`<div class="sw" style="background:${c}" data-c="${c}"></div>`).join('');
$('psC').addEventListener('click',e=>{const c=e.target.dataset.c;if(!c)return;S.pencil.c=c;$('psC').querySelectorAll('.sw').forEach(s=>s.classList.toggle('on',s.dataset.c===c))});
$('psC').firstElementChild?.classList.add('on');
$('hlC').innerHTML=['#fde047','#86efac','#93c5fd','#f9a8d4','#fdba74','#d8b4fe'].map(c=>`<div class="sw" style="background:${c}" data-c="${c}"></div>`).join('');
$('hlC').addEventListener('click',e=>{const c=e.target.dataset.c;if(!c)return;S.hl.c=c;$('hlC').querySelectorAll('.sw').forEach(s=>s.classList.toggle('on',s.dataset.c===c))});
$('hlC').firstElementChild?.classList.add('on');
$('eM').addEventListener('change',e=>{S.eraser.mode=e.target.value;$('cc').style.display=(S.tool==='eraser'&&S.eraser.mode==='circle')?'block':'none'});
$('eS').addEventListener('input',e=>{S.eraser.sz=+e.target.value;$('eSL').textContent=e.target.value});

/* ===== PAGE NAV ===== */
$('bPr').addEventListener('click',async()=>{if(S.cp>1){closeEd();hideTT();S.cp--;await renderP(S.cp)}});
$('bNx').addEventListener('click',async()=>{if(S.cp<S.tp){closeEd();hideTT();S.cp++;await renderP(S.cp)}});

/* ===== ZOOM ===== */
async function setSc(s){S.sc=Math.max(.5,Math.min(4,s));$('zLb').textContent=Math.round(S.sc*100)+'%';await renderP(S.cp)}
$('bZI').addEventListener('click',()=>setSc(S.sc+.15));
$('bZO').addEventListener('click',()=>setSc(S.sc-.15));
$('bFW').addEventListener('click',async()=>{if(!S.pdf)return;const pg=await S.pdf.getPage(S.cp),vp=pg.getViewport({scale:1});await setSc(($('stage').clientWidth-40)/vp.width)});
let pnch=null;
$('stage').addEventListener('touchstart',e=>{if(e.touches.length===2)pnch={d:Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY),s:S.sc}},{passive:true});
$('stage').addEventListener('touchmove',e=>{if(e.touches.length===2&&pnch){const d=Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);setSc(pnch.s*(d/pnch.d))}},{passive:true});
$('stage').addEventListener('touchend',()=>pnch=null);

/* ===== UNDO/REDO ===== */
$('bUn').addEventListener('click',undo);
$('bRe').addEventListener('click',redo);
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='z'){e.preventDefault();e.shiftKey?redo():undo()}else if((e.ctrlKey||e.metaKey)&&e.key==='y'){e.preventDefault();redo()}});

/* ===== PAGE NUMBERS ===== */
$('bPN').addEventListener('click',()=>$('pmM').classList.add('open'));
$('pmC').addEventListener('click',()=>$('pmM').classList.remove('open'));
$('pmOk').addEventListener('click',()=>{if(!S.pdf){toast('Load a PDF first');return}const pos=$('pmP').value,fmt=$('pmF').value,custom=$('pmHdrFtTxt').value.trim(),st=parseInt($('pmS').value)||1,sz=parseInt($('pmFS').value)||11,ap=$('pmA').value;const pgs=ap==='all'?Array.from({length:S.tp},(_,i)=>i+1):[S.cp];for(let i=0;i<pgs.length;i++){const a=epa(pgs[i]);a.pageNumbers=[];const tx=(custom||fmt).replace('{n}',st+i).replace('{total}',S.tp);a.pageNumbers.push({pos:pos,tx:tx,sz:sz,c:'#000'})}snap();renderA();$('pmM').classList.remove('open');toast('Header/footer text applied')});

/* ===== IMPORT ===== */
function imp(){$('fIn').click()}
$('bImp').addEventListener('click',imp);$('bImp2').addEventListener('click',imp);
$('fIn').addEventListener('change',e=>{const f=e.target.files[0];if(f)loadPDF(f);e.target.value=''});

/* ===== SAVE ===== */
$('bSav').addEventListener('click',async()=>{if(!S.bytes){toast('No PDF loaded');return}toast('Generating PDF…');try{const{PDFDocument,rgb,StandardFonts}=PDFLib;const doc=await PDFDocument.load(S.bytes.slice());const pgs=doc.getPages();const fn=await doc.embedFont(StandardFonts.Helvetica);
for(let i=0;i<pgs.length;i++){const a=S.pa.get(i+1);if(!a)continue;const pg=pgs[i],{width:w,height:h}=pg.getSize(),sc=w/(S.vp?S.vp.width:w);
for(const e of a.erases){if(e.sh==='c')pg.drawEllipse({x:e.x*sc,y:h-e.y*sc,xScale:e.r*sc,yScale:e.r*sc,color:rgb(1,1,1)});else pg.drawRectangle({x:e.x*sc,y:h-(e.y+e.h)*sc,width:e.w*sc,height:e.h*sc,color:rgb(1,1,1)})};
for(const hl of a.highlights){const c=h2r(hl.c);pg.drawRectangle({x:hl.x*sc,y:h-(hl.y+hl.h)*sc,width:hl.w*sc,height:hl.h*sc,color:rgb(c.r,c.g,c.b),opacity:.5})}
for(const s of a.strokes){const c=h2r(s.c);for(let j=1;j<s.pts.length;j++){const a=s.pts[j-1],b=s.pts[j];pg.drawLine({start:{x:a.x*sc,y:h-a.y*sc},end:{x:b.x*sc,y:h-b.y*sc},thickness:s.sz*sc,color:rgb(c.r,c.g,c.b)})}}
for(const e of a.edits){const c=h2r(e.c);try{pg.drawText(e.tx,{x:e.x*sc,y:h-(e.y+e.sz)*sc,size:e.sz*sc,font:fn,color:rgb(c.r,c.g,c.b)})}catch(err){pg.drawText(e.tx.replace(/[^\x00-\x7F]/g,'?'),{x:e.x*sc,y:h-(e.y+e.sz)*sc,size:e.sz*sc,font:fn,color:rgb(c.r,c.g,c.b)})}}
for(const p of a.pageNumbers){let x=20,y=20;if(p.pos.startsWith('h'))y=h-p.sz-10;else y=p.sz+10;const tw=fn.widthOfTextAtSize(p.tx,p.sz);if(p.pos.endsWith('center'))x=(w-tw)/2;else if(p.pos.endsWith('right'))x=w-tw-20;pg.drawText(p.tx,{x,y,size:p.sz,font:fn,color:rgb(0,0,0)})}}
const out=await doc.save(),bl=new Blob([out],{type:'application/pdf'}),u=URL.createObjectURL(bl),a=document.createElement('a');a.href=u;a.download='edited.pdf';a.click();URL.revokeObjectURL(u);toast('PDF saved')}catch(e){console.error(e);toast('Export failed')}});

function h2r(h){const n=parseInt(h.replace('#','').padEnd(6,'0'),16);return{r:((n>>16)&255)/255,g:((n>>8)&255)/255,b:(n&255)/255}}

/* ===== INIT ===== */
populateFontDropdown(S.textStyle.font);
$('fontTop').value=S.textStyle.font;
setTool('select');updUR();