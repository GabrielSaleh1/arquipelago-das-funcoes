import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { G, TAU, disposeTree } from './utils3d.js'
import { createEnvironment, buildChapterWorld, createMarker } from './mundo.js'
import { createMatinho } from './matinho.js'
import './style.css'

/* ARQUIPÉLAGO DAS FUNÇÕES · REDMAT · 1.0
   Jogo 3D gratuito, sem conta e sem servidor de dados. O progresso permanece neste navegador.
   As máquinas ocultam a regra até o estudante investigar, prever e generalizar.
*/
const app = document.querySelector('#app')
const ASSETS = import.meta.env.BASE_URL
const SAVE_KEY = 'redmat_arquipelago_v1'
const chapters = [
  { name: 'Costa das Relações', tag: 'FUNÇÕES AFINS', color: 0x28b5aa, ground: 0x9ddd94, edge: 0x7acb91, sand:0xffe4a7, x: 0,
    f: x => 2*x+1, domain: [-1,5], samples: [0,1,2,3,4,5], chart: [-1,8,-2,18], formula: 'f(x) = 2x + 1',
    question: 'Se a entrada aumenta 1, de quanto a saída aumenta?', expected: 2, prediction: 6, predicted: 13,
    rule: 'A máquina duplica a entrada e acrescenta 1.', alternatives: ['Multiplica a entrada por 2 e soma 1', 'Soma 2 à entrada', 'Multiplica a entrada por 3 e subtrai 1'], correct: 0,
    bridge: [{x:6,y:13},{x:7,y:15},{x:8,y:17}], insight: 'Uma função afim associa a cada entrada x uma saída ax + b. A taxa de variação permanece constante.',
    discussion: 'Como você percebeu o crescimento constante das saídas? Como justificaria a regra para uma entrada nunca testada?' },
  { name: 'Montanhas das Curvas', tag: 'FUNÇÕES QUADRÁTICAS', color:0xf0a34e, ground:0xb4dc91, edge:0x96c47f, sand:0xffddb0, x: 0,
    f: x=>x*x-4*x+3, domain:[0,4], samples:[0,1,2,3,4], chart:[-1,6,-3,16], formula:'f(x) = x² − 4x + 3',
    question: 'Entre as entradas de 0 a 4, qual produz a menor saída?', expected:2, prediction:5, predicted:8,
    rule:'A saída primeiro diminui e depois aumenta. O menor valor ocorre em x = 2.', alternatives:['x² − 4x + 3','x² + 4x + 3','−x² + 4x − 3'], correct:0,
    bridge:[{x:5,y:8},{x:-1,y:8},{x:6,y:15}], insight:'Uma função quadrática pode mudar de sentido de variação. Seu gráfico é uma parábola, e o vértice indica um extremo.',
    discussion:'Quais entradas tiveram a mesma saída? O que essa simetria sugere sobre o gráfico?' },
  { name:'Cavernas das Possibilidades', tag:'DOMÍNIO E IMAGEM', color:0x8f8dde, ground:0x9acdbc, edge:0x72b6ad, sand:0xcfe9da, x:0,
    f:x=>x>=-2?Math.sqrt(x+2):null, domain:[-4,4], samples:[-4,-3,-2,-1,0,2,7], chart:[-5,8,-1,5], formula:'f(x) = √(x + 2)',
    question:'Qual é a menor entrada inteira que a máquina aceita?', expected:-2, prediction:7, predicted:3,
    rule:'Só existem saídas reais para entradas maiores ou iguais a −2.', alternatives:['x ≥ −2','x ≤ −2','Qualquer número real'], correct:0,
    bridge:[{x:-1,y:1},{x:2,y:2},{x:7,y:3}], insight:'Domínio é o conjunto das entradas permitidas. Aqui, x ≥ −2; a imagem é formada pelos valores y ≥ 0.',
    discussion:'Por que algumas entradas são recusadas? O que podemos afirmar sobre as saídas possíveis?' },
]
const defaultProgress = () => chapters.map(()=>({tested:{},phase:0,discovered:false,bridge:0,notes:'',mistakes:0}))
const initialState = () => ({chapter:0,progress:defaultProgress(),finished:false,started:false})
let state = initialState()
try {
  const saved=JSON.parse(localStorage.getItem(SAVE_KEY)||'null')
  if(saved&&Array.isArray(saved.progress)&&saved.progress.length===chapters.length){
    state={...initialState(),...saved,progress:saved.progress.map(p=>({...defaultProgress()[0],...p,tested:p.tested||{}}))}
    state.chapter=Math.max(0,Math.min(2,Number(state.chapter)||0))
  }
} catch { /* navegação privada, dados indisponíveis */ }
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(state))}catch{}}
let currentChapter=state.chapter
let openPanel=null
let modalType=null
let player, matinho, env, world, marker
let camera, scene, renderer, controls, group, bridgeSegments=[], podiumBars=[]
let interactables=[], busy=false
const pose={walking:false,running:false,grounded:true,vy:0,panel:false}
let jumpSpeed=0, grounded=true, time=0, lastTime=performance.now(), toastTimer
const keys = new Set()
let lookAngle=0

const safe = str=>String(str).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))
const fmt = n=>n===null?'sem saída real':Number.isInteger(n)?String(n):n.toFixed(2).replace('.',',')
const prog = () => state.progress[currentChapter]
const chapter = () => chapters[currentChapter]
const btn = (label,id='button',kind='primary')=>`<button type="button" class="${kind}" id="${id}">${label}</button>`
const byId = id => document.getElementById(id)
function toast(message){const t=byId('toast');t.textContent=message;t.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.hidden=true,3200)}

// -------------------------------- EFEITOS SONOROS --------------------------------
// Sons criados pelo próprio navegador (sem arquivos de áudio). O jogador pode desligar no menu.
const SOUND_KEY='redmat_arquipelago_som'
let soundOn=true, audioCtx=null
try{soundOn=localStorage.getItem(SOUND_KEY)!=='off'}catch{}
function sfx(name){
 if(!soundOn)return
 try{
  audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)()
  if(audioCtx.state==='suspended')audioCtx.resume()
  const now=audioCtx.currentTime
  const tone=(f,t0,d,type='sine',v=.1,to=0)=>{
   const o=audioCtx.createOscillator(),g=audioCtx.createGain()
   o.type=type;o.frequency.setValueAtTime(f,now+t0)
   if(to)o.frequency.exponentialRampToValueAtTime(to,now+t0+d)
   g.gain.setValueAtTime(.0001,now+t0)
   g.gain.exponentialRampToValueAtTime(v,now+t0+.02)
   g.gain.exponentialRampToValueAtTime(.0001,now+t0+d)
   o.connect(g);g.connect(audioCtx.destination)
   o.start(now+t0);o.stop(now+t0+d+.05)
  }
  if(name==='click')tone(760,0,.06,'triangle',.07)
  else if(name==='jump')tone(300,0,.14,'sine',.08,560)
  else if(name==='land')tone(150,0,.09,'triangle',.07,80)
  else if(name==='ok'){tone(523,0,.12,'triangle',.09);tone(784,.1,.18,'triangle',.09)}
  else if(name==='wrong')tone(220,0,.2,'sawtooth',.04,150)
  else if(name==='build'){tone(392,0,.1,'square',.05);tone(523,.09,.14,'triangle',.09)}
  else if(name==='discover'){[523,659,784,1047].forEach((f,i)=>tone(f,i*.1,.22,'triangle',.09))}
  else if(name==='portal')tone(180,0,.7,'sine',.1,900)
 }catch{ /* áudio indisponível: o jogo segue normalmente */ }
}

app.innerHTML=`<div id="canvas-host"></div><div id="ui">
  <div class="hud-top" id="hud-top">
    <div class="brand"><div class="brand-mark">fx</div><div><small>REDMAT · JOGO 3D</small><b>Arquipélago das Funções</b></div></div>
    <div class="chapter-pill"><small id="hud-chapter-tag">ILHA 1 DE 3</small><b id="hud-chapter">Costa das Relações</b></div>
  </div>
  <div class="hud-actions" id="hud-actions">
    <div class="progress-dots" id="progress-dots" aria-label="Progresso nas seis missões"></div>
    <button class="pill-btn" id="notebook-button" title="Diário de bordo (N)">▤ Diário</button>
    <button class="icon-btn" id="menu-button" aria-label="Menu e configurações (P)">☰</button>
  </div>
  <div class="objective" id="objective"><small>MISSÃO ATUAL</small><p id="objective-text">Encontre uma máquina e investigue.</p></div>
  <div class="controls-short" id="controls-short">WASD · mover &nbsp;·&nbsp; Mouse · câmera<br>E · interagir &nbsp;·&nbsp; Espaço · pular &nbsp;·&nbsp; Shift · correr<br>N · diário &nbsp;·&nbsp; P · menu &nbsp;·&nbsp; R · reposicionar</div>
  <div class="prompt" id="prompt" hidden><kbd>E</kbd><span id="prompt-text"></span></div>
  <div class="toast" id="toast" role="status" hidden></div>
</div>
<div class="screen" id="welcome-screen">
  <div class="welcome">
    <div class="welcome-copy">
      <span class="eyebrow">REDMAT / UMA AVENTURA DE MATEMÁTICA</span>
      <h1>Arquipélago<br>das <em>Funções.</em></h1>
      <p>Explore ilhas, experimente com máquinas misteriosas e construa caminhos com suas próprias descobertas. Aqui, a matemática transforma o mundo.</p>
      <div class="welcome-buttons">
        ${btn(state.started?'Continuar minha aventura':'Começar a explorar','play-button')}
        ${btn('Começar do início','new-button','secondary')}
        ${btn('Guia para professores','welcome-teacher','ghost')}
      </div>
      <span class="welcome-foot">Gratuito · funciona no navegador · progresso salvo neste dispositivo</span>
    </div>
    <div class="welcome-art">
      <div class="art-bubble">Olá! Eu sou o Matinho. Vamos descobrir a regra das máquinas?</div>
      <img class="matinho-a" src="${ASSETS}matinho-normal.png" alt="Matinho, mascote do REDMAT"/>
      <img class="matinho-b" src="${ASSETS}matinho-sorrindo.png" alt="" aria-hidden="true"/>
      <span class="art-caption">Matinho · mascote do REDMAT</span>
    </div>
  </div>
</div>
<div id="fade"></div>
<div class="overlay hidden" id="overlay" role="presentation"><section class="modal" id="modal" role="dialog" aria-modal="true" aria-label="Painel do jogo"></section></div>`
byId('play-button').onclick=()=>startGame()
byId('new-button').onclick=()=>{if(state.started&&!confirm('Começar do início apagará o progresso salvo deste jogo. Deseja continuar?'))return;state=initialState();state.started=true;save();loadChapter(0);startGame()}
byId('welcome-teacher').onclick=()=>showTeacher(true)
byId('menu-button').onclick=()=>showMenu()
byId('notebook-button').onclick=()=>showNotebook()

// -------------------------------- CENA 3D --------------------------------
// O cenário (céu, mar, ilhas, estações) está em mundo.js e o personagem em matinho.js.
document.title='Arquipélago das Funções · REDMAT'
{ // ícone da aba do navegador: a cabeça do Matinho, recortada da imagem do projeto
  const img=new Image()
  img.onload=()=>{try{
    const c=document.createElement('canvas');c.width=c.height=64
    c.getContext('2d').drawImage(img,0,0,img.width,img.width*.71,0,9,64,46)
    let l=document.querySelector("link[rel~='icon']")
    if(!l){l=document.createElement('link');l.rel='icon';document.head.append(l)}
    l.type='image/png';l.href=c.toDataURL('image/png')
  }catch{}}
  img.src=`${ASSETS}matinho-normal.png`
}
scene = new THREE.Scene()
camera=new THREE.PerspectiveCamera(58,innerWidth/innerHeight,.1,700)
camera.position.set(0,6,18)
renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'})
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.8))
renderer.setSize(innerWidth,innerHeight)
renderer.outputColorSpace=THREE.SRGBColorSpace
renderer.toneMapping=THREE.ACESFilmicToneMapping
renderer.toneMappingExposure=1.55
renderer.shadowMap.enabled=true
renderer.shadowMap.type=THREE.PCFSoftShadowMap
renderer.domElement.id='game-canvas'
byId('canvas-host').append(renderer.domElement)
controls=new OrbitControls(camera,renderer.domElement)
controls.enableDamping=true
controls.dampingFactor=.08
controls.enablePan=false
controls.minDistance=5
controls.maxDistance=24
controls.minPolarAngle=.24
controls.maxPolarAngle=1.41
controls.target.set(0,1.7,5)
controls.update()
env=createEnvironment(scene)
marker=createMarker(scene)
matinho=createMatinho(scene,G)
player=matinho.group
player.rotation.y=Math.PI

function updateBars(){
 const p=prog(),ch=chapter()
 for(const b of podiumBars){
   const raw=p.tested[String(b.x)]
   const seen=Object.hasOwn(p.tested,String(b.x))
   b.block.visible=seen
   if(seen){
     let h=raw===null?.23:Math.max(.22,Math.min(3.6,(raw+(currentChapter===1?1.7:0.3))*.23+.3))
     b.target=h
     b.block.material.color.set(raw===null?0xe8998d:ch.color)
     b.block.material.emissive.set(raw===null?0x83433a:ch.color)
     b.block.material.emissiveIntensity=p.discovered?.35:.11
     b.setValue(raw)
   } else {b.target=0;b.setValue(undefined)}
 }
}
function refreshVisualProgress(){
 const p=prog()
 bridgeSegments.forEach((o,i)=>{o.userData.target=i<p.bridge?1:0})
 world.portal.setReady(p.bridge===3)
 world.terminal.setProgress(p.bridge)
 world.machine.setDiscovered(p.discovered)
 updateBars()
}
function loadChapter(index){
 currentChapter=index;state.chapter=index
 if(group){scene.remove(group);disposeTree(group)}
 const ch=chapter()
 world=buildChapterWorld(index,ch,prog().bridge)
 group=world.group
 scene.add(group)
 podiumBars=world.bars
 bridgeSegments=world.bridge
 env.applyTheme(index)
 interactables=[
  {kind:'machine',x:-4.5,z:-.6,label:'Investigar máquina'},
  {kind:'bridge',x:6.5,z:.3,label:'Construir a ponte'},
  {kind:'portal',x:18.4,z:0,label:index===2?'Concluir aventura':'Viajar para a próxima ilha'}
 ]
 if(player){player.position.set(0,G,6.3);player.rotation.y=Math.PI;jumpSpeed=0;grounded=true;matinho.reset();resetCamera()}
 refreshVisualProgress();updateHud();save()
}

function resetCamera(){
 camera.position.set(player.position.x+1.7,player.position.y+4.5,player.position.z+9.4)
 controls.target.copy(player.position).add(new THREE.Vector3(0,1.5,0));controls.update()
}
function blocked(x,z){
 const list=world?world.group.userData.colliders:[]
 for(const c of list){if(Math.hypot(x-c.x,z-c.z)<c.r)return true}
 return false
}
function safeToWalk(x,z){
 if(blocked(x,z))return false
 if(Math.hypot(x,z)<10.7)return true
 if(Math.hypot(x-18.4,z)<4.05&&prog().bridge===3)return true
 if(prog().bridge>0&&Math.abs(z)<.78&&x>=10.25&&x<=10.79+prog().bridge*1.52)return true
 return false
}
function nearest(){
 let nearestObj=null,d=Infinity
 for(const obj of interactables){
  if(obj.kind==='portal'&&prog().bridge<3)continue
  const dis=Math.hypot(player.position.x-obj.x,player.position.z-obj.z)
  if(dis<2.3&&dis<d){nearestObj=obj;d=dis}
 }
 return nearestObj
}
function objectiveText(){
 const p=prog()
 if(!p.discovered)return 'Aproxime-se da máquina misteriosa, pressione E e investigue a relação entre entradas e saídas.'
 if(p.bridge<3)return 'Encontre o terminal da ponte. Use suas descobertas para prever três resultados.'
 return currentChapter===2?'Atravesse a ponte, alcance o portal e conclua sua jornada.':'Atravesse a ponte e entre no portal para descobrir a próxima ilha.'
}
function updateHud(){
 byId('hud-chapter-tag').textContent=`ILHA ${currentChapter+1} DE 3 · ${chapter().tag}`
 byId('hud-chapter').textContent=chapter().name
 byId('objective-text').textContent=objectiveText()
 const dots=state.progress.flatMap(p=>[p.discovered,p.bridge===3])
 const active=currentChapter*2+(prog().discovered?1:0)
 byId('progress-dots').innerHTML=dots.map((d,i)=>`<span class="dot ${d?'done':i===active?'now':''}" title="Missão ${i+1}"></span>`).join('')
}
function startGame(){
 state.started=true;save();byId('welcome-screen').classList.add('hidden')
 byId('hud-top').hidden=false;byId('hud-actions').hidden=false
 byId('objective').hidden=false;byId('controls-short').hidden=false
 updateHud();resetCamera();matinho.wave();sfx('click');toast('Siga o caminho e procure uma máquina para investigar.')
}
function openModal(content,{type='normal',size='normal'}={}){
 openPanel=type;modalType=type
 const modal=byId('modal')
 modal.className=`modal ${size==='slim'?'slim':size==='wide'?'wide':''}`
 modal.innerHTML=content
 byId('overlay').classList.remove('hidden')
 byId('prompt').hidden=true
 const close=modal.querySelector('[data-close]')
 if(close)close.onclick=closeModal
 // Evita teclas de movimento quando o painel está aberto.
 keys.clear()
}
function closeModal(){byId('overlay').classList.add('hidden');openPanel=null;modalType=null;keys.clear();updateHud()}
byId('overlay').addEventListener('mousedown',e=>{if(e.target===byId('overlay')&&modalType!=='mission'&&modalType!=='bridge')closeModal()})
const header=(eyebrow,title)=>`<header class="modal-head"><div><span class="eyebrow">${eyebrow}</span><h2>${title}</h2></div><button type="button" class="close-btn" data-close aria-label="Fechar painel">×</button></header>`

// --------------------- PAINÉIS DE INVESTIGAÇÃO ------------------------------
function testEntry(x){
 const p=prog(),ch=chapter(),key=String(x)
 const y=ch.f(x)
 p.tested[key]=y
 save();updateBars();sfx('click')
 toast(y===null?`Entrada ${x}: a máquina não produz saída real.`:`Teste registrado: ${x} → ${fmt(y)}`)
 return y
}
function phaseLabel(phase){return ['Experimentar','Investigar','Prever','Generalizar','Formalizar'][phase]||'Concluído'}
function reachedTests(){
 const values=Object.keys(prog().tested).map(Number)
 if(currentChapter<2)return values.length>=3
 return values.filter(x=>x<-2).length>=1&&values.filter(x=>x>=-2).length>=3
}
function testPanel(){
 const p=prog(),ch=chapter()
 const entries=Object.entries(p.tested).sort((a,b)=>Number(a[0])-Number(b[0]))
 return `<div class="subpanel"><h3>Laboratório de experimentos</h3>
   <p>Escolha entradas, compare as saídas e observe as colunas no mundo 3D.</p>
   <div class="experiment-controls"><label>Valor de entrada
     <input id="experiment-input" type="number" min="${ch.domain[0]}" max="${ch.domain[1]}" step="1" value="${ch.domain[0]}" aria-label="Valor a testar"/></label>
     <button class="secondary" id="experiment-button">Testar</button></div>
   <span class="section-label">REGISTROS PRODUZIDOS · ${entries.length}</span>
   <div class="records" id="records">
     ${entries.length?entries.slice(-12).map(([x,y])=>`<div class="record ${y===null?'invalid':''}">x = ${safe(x)}<b>${fmt(y)}</b></div>`).join(''):'<p class="microcopy">Nenhum teste ainda.</p>'}
   </div>
   <p class="microcopy">Os registros são mantidos quando você fecha a máquina. Não existe punição por tentar.</p>
 </div>`
}
function missionBody(){
 const p=prog(),ch=chapter(),phase=p.phase
 if(phase===0)return `<div class="phase-head"><span class="section-label">01 · EXPERIMENTAR</span><div class="step-track">${[0,1,2,3].map((_,i)=>`<span class="${i<phase?'filled':''}"></span>`).join('')}</div></div>
  <div class="question-card"><h3>O que acontece com diferentes entradas?</h3><p>Produza pelo menos ${currentChapter===2?'quatro testes, incluindo alguma entrada recusada':'três testes com entradas diferentes'}. Anote o que percebe. <b>A regra ainda é um mistério.</b></p>
  ${btn('Conferir meus registros','check-experiments')}
  <p class="feedback" id="phase-feedback">Observe também as colunas que surgem do lado de fora da máquina.</p></div>`
 if(phase===1)return `<div class="phase-head"><span class="section-label">02 · IDENTIFICAR REGULARIDADE</span><div class="step-track">${[0,1,2,3].map((_,i)=>`<span class="${i<phase?'filled':''}"></span>`).join('')}</div></div>
  <div class="question-card"><h3>${ch.question}</h3><p>${currentChapter===0?'Compare duas entradas consecutivas.':currentChapter===1?'Compare os resultados e procure uma mudança no sentido de crescimento.':'Compare uma entrada que funciona com outra que não produz saída real.'}</p>
  <div class="answer-row"><input id="answer-number" type="number" step="1" placeholder="Sua hipótese" aria-label="Sua hipótese"/>${btn('Testar hipótese','submit-answer')}</div>
  <p class="feedback" id="phase-feedback">Use os dados que você mesmo produziu.</p></div>`
 if(phase===2)return `<div class="phase-head"><span class="section-label">03 · FAZER UMA PREVISÃO</span><div class="step-track">${[0,1,2,3].map((_,i)=>`<span class="${i<phase?'filled':''}"></span>`).join('')}</div></div>
  <div class="question-card"><h3>Sem testar antes: qual seria a saída para x = ${ch.prediction}?</h3><p>Use sua hipótese para prever algo novo. A máquina só revelará o resultado depois da previsão.</p>
  <div class="answer-row"><input id="answer-number" type="number" step="any" placeholder="Sua previsão" aria-label="Valor previsto"/>${btn('Conferir previsão','submit-answer')}</div>
  <p class="feedback" id="phase-feedback">Uma previsão é um bom modo de colocar uma hipótese à prova.</p></div>`
 if(phase===3)return `<div class="phase-head"><span class="section-label">04 · CONSTRUIR A REGRA</span><div class="step-track">${[0,1,2,3].map((_,i)=>`<span class="${i<phase?'filled':''}"></span>`).join('')}</div></div>
  <div class="question-card"><h3>${currentChapter===0?'Qual regra descreve a máquina?':currentChapter===1?'Qual expressão representa os valores observados?':'Qual conjunto descreve as entradas permitidas?'}</h3>
    <p>Compare as possibilidades com seus registros. Escolha uma regra que funcione para todos os testes.</p>
    <div class="choice-list">${ch.alternatives.map((a,i)=>`<button type="button" class="choice-btn" data-choice="${i}">${safe(a)}</button>`).join('')}</div>
    <p class="feedback" id="phase-feedback">Você pode experimentar novos valores antes de decidir.</p></div>`
 return `<div class="phase-head"><span class="section-label">05 · FORMALIZAR A DESCOBERTA</span><div class="step-track">${[0,1,2,3].map(()=>'<span class="filled"></span>').join('')}</div></div>
 <div class="question-card"><h3>Você descobriu uma relação matemática.</h3>
 <div class="discovery-box"><span class="microcopy">REPRESENTAÇÃO ALGÉBRICA</span><b>${ch.formula}</b><p>${ch.insight}</p></div>
 <div class="graph-wrap"><canvas id="mission-graph" width="560" height="265" aria-label="Gráfico da função descoberta"></canvas></div>
 <label class="info-label" for="mission-notes">Como você chegou à sua resposta? (Registro opcional)</label>
 <textarea id="mission-notes" rows="2" placeholder="Escreva sua explicação para a turma ou para o professor">${safe(p.notes)}</textarea>
 ${btn(p.discovered?'Revisão concluída':'Concluir investigação','finish-investigation')}
 </div>`
}
function renderMission(){
 const phase=prog().phase
 openModal(`${header(`ILHA ${currentChapter+1} · INVESTIGAÇÃO 01`,'A máquina misteriosa')}
 <div class="modal-body"><p class="modal-sub">A máquina transforma entradas em saídas. Experimente e construa uma explicação antes de conhecer a regra matemática.</p>
 <div class="split">${testPanel()}<div>${missionBody()}</div></div>
 <div class="statline"><span class="chip">${phaseLabel(phase)}</span><span>Explore sem pressa. Pressione Esc para observar o cenário.</span></div></div>`,{type:'mission',size:'wide'})
 byId('experiment-button').onclick=()=>{
    const el=byId('experiment-input'),v=Number(el.value),[min,max]=chapter().domain
    if(el.value.trim()===''||!Number.isInteger(v)||v<min||v>max){toast(`Escolha um número inteiro entre ${min} e ${max}.`);el.focus();return}
    testEntry(v);renderMission()
    byId('experiment-input').value=String(v)
 }
 byId('experiment-input').addEventListener('keydown',e=>{if(e.key==='Enter')byId('experiment-button').click()})
 if(phase===0)byId('check-experiments').onclick=()=>{
  if(!reachedTests()){feedback('Faça mais alguns testes diferentes para fundamentar sua hipótese.',true);return}
  prog().phase=1;save();renderMission()
 }
 if(phase===1||phase===2){
  byId('submit-answer').onclick=()=>submitNumeric()
  byId('answer-number').addEventListener('keydown',e=>{if(e.key==='Enter')byId('submit-answer').click()})
 }
 if(phase===3)document.querySelectorAll('[data-choice]').forEach(el=>el.onclick=()=>submitChoice(Number(el.dataset.choice)))
 if(phase===4){
  drawGraph(byId('mission-graph'),chapter())
  byId('mission-notes').addEventListener('input',e=>{prog().notes=e.target.value;save()})
  byId('finish-investigation').onclick=()=>{
    prog().notes=byId('mission-notes').value
    prog().discovered=true;save();refreshVisualProgress();closeModal();updateHud();toast('Investigação concluída! O terminal da ponte está pronto para você.');matinho.celebrate();sfx('discover')
  }
 }
}
function feedback(message,error=false){const p=byId('phase-feedback');if(!p)return;p.textContent=message;p.classList.toggle('error',error)}
function wrongAnswer(phase){
 prog().mistakes++;save();sfx('wrong')
 if(phase===1)feedback(currentChapter===0?'Experimente entradas que diferem em 1 e compare as saídas.':currentChapter===1?'Observe as cinco entradas entre 0 e 4. Em qual delas a saída é mais baixa?':'Teste −3, −2 e −1. Em qual ponto as saídas passam a existir?',true)
 else if(phase===2)feedback(currentChapter===0?'Tente avançar de 5 para 6 mantendo o padrão de crescimento.':currentChapter===1?'Compare as saídas em 0 e 4. Pense na simetria em torno de 2.':'Qual número ao quadrado resulta em 9? Retorne aos seus registros.',true)
 else feedback('Teste essa regra com pelo menos dois pares registrados. Ela precisa explicar todos os resultados.',true)
}
function submitNumeric(){
 const el=byId('answer-number'),value=Number(el.value),p=prog()
 if(el.value.trim()===''||!Number.isFinite(value)){feedback('Digite um número antes de testar.',true);return}
 if(Math.abs(value-(p.phase===1?chapter().expected:chapter().predicted))>1e-6){wrongAnswer(p.phase);return}
 p.phase++;save();renderMission();sfx('ok');toast('Hipótese confirmada. Continue investigando!')
}
function submitChoice(choice){
 if(choice!==chapter().correct){wrongAnswer(3);return}
 prog().phase=4;save();renderMission();sfx('ok');toast('Uma regra que explica os resultados! Agora observe sua representação gráfica.')
}
function drawGraph(canvas,ch){
 if(!canvas)return
 const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height
 const [xmin,xmax,ymin,ymax]=ch.chart
 const px=x=>46+(x-xmin)/(xmax-xmin)*(W-68),py=y=>H-29-(y-ymin)/(ymax-ymin)*(H-52)
 ctx.fillStyle='#fcfff9';ctx.fillRect(0,0,W,H)
 ctx.strokeStyle='#e1ede8';ctx.lineWidth=1
 for(let x=Math.ceil(xmin);x<=xmax;x++){ctx.beginPath();ctx.moveTo(px(x),15);ctx.lineTo(px(x),H-29);ctx.stroke()}
 for(let y=Math.ceil(ymin);y<=ymax;y+=Math.abs(ymax-ymin)>15?2:1){ctx.beginPath();ctx.moveTo(45,py(y));ctx.lineTo(W-22,py(y));ctx.stroke()}
 ctx.strokeStyle='#688585';ctx.lineWidth=2
 if(ymin<=0&&ymax>=0){ctx.beginPath();ctx.moveTo(45,py(0));ctx.lineTo(W-22,py(0));ctx.stroke()}
 if(xmin<=0&&xmax>=0){ctx.beginPath();ctx.moveTo(px(0),15);ctx.lineTo(px(0),H-29);ctx.stroke()}
 ctx.fillStyle='#59787c';ctx.font='15px sans-serif';ctx.fillText('x',W-21,py(0)+18);ctx.fillText('y',px(0)+8,21)
 ctx.strokeStyle=currentChapter===1?'#e39c43':currentChapter===2?'#8781d6':'#17a69b';ctx.lineWidth=4
 ctx.beginPath();let first=true
 for(let i=0;i<=450;i++){
  const x=xmin+(xmax-xmin)*i/450, y=ch.f(x)
  if(y===null||y<ymin-.8||y>ymax+.8){first=true;continue}
  if(first){ctx.moveTo(px(x),py(y));first=false}else ctx.lineTo(px(x),py(y))
 } ctx.stroke()
 Object.entries(prog().tested).forEach(([x,y])=>{
  if(y===null)return;const ax=Number(x)
  if(ax<xmin||ax>xmax||y<ymin||y>ymax)return
  ctx.beginPath();ctx.arc(px(ax),py(y),5.5,0,TAU);ctx.fillStyle='#fd6661';ctx.fill()
 })
}

// ------------------------ PONTE DAS PREVISÕES -------------------------------
function renderBridge(){
 const p=prog(),ch=chapter()
 if(!p.discovered){
  openModal(`${header(`ILHA ${currentChapter+1} · ESTAÇÃO 02`,'A Ponte das Previsões')}
  <div class="modal-body"><p class="modal-sub">A ponte ainda está desligada. Primeiro investigue a máquina misteriosa e construa uma regra para compreender suas entradas e saídas.</p>${btn('Voltar a explorar','bridge-back','secondary')}</div>`,{type:'bridge',size:'slim'})
  byId('bridge-back').onclick=closeModal;return
 }
 const i=p.bridge,finished=i>=3
 openModal(`${header(`ILHA ${currentChapter+1} · DESAFIO 02`,'A Ponte das Previsões')}
 <div class="modal-body">
 <p class="modal-sub">Cada uma das três plataformas depende de uma previsão. Use a regra que você descobriu e transforme seus cálculos em um caminho no mundo 3D.</p>
 <div class="phase-head"><span class="section-label">${finished?'TRAVESSIA LIBERADA':`PLATAFORMA ${i+1} DE 3`}</span>
 <div class="step-track">${[0,1,2].map((_,j)=>`<span class="${j<i?'filled':''}"></span>`).join('')}</div></div>
 <div class="question-card">${finished?`<h3>As três plataformas estão prontas.</h3>
   <p>Agora feche o painel, atravesse a ponte e aproxime-se do portal. A Matemática construiu seu caminho!</p>
   ${btn('Voltar à ilha','bridge-return')}`:`<h3>Qual saída corresponde à entrada x = ${ch.bridge[i].x}?</h3>
   <p>Não é necessário voltar à máquina. Aplique a regra que você investigou para prever a saída desta nova entrada.</p>
   <div class="answer-row"><input id="bridge-value" type="number" step="any" placeholder="Sua previsão" aria-label="Saída prevista para construir ponte"/>
   ${btn('Construir plataforma','bridge-build')}</div>
   <p class="feedback" id="phase-feedback">Se não funcionar, reveja sua hipótese. As tentativas são parte da aprendizagem.</p>`}
 </div>
 <div class="statline"><span class="chip">${i}/3 plataformas</span><span>As plataformas surgem no cenário após a previsão correta.</span></div>
 </div>`,{type:'bridge',size:'slim'})
 if(finished){byId('bridge-return').onclick=closeModal;return}
 byId('bridge-build').onclick=()=>{
  const input=byId('bridge-value');const val=Number(input.value)
  if(input.value.trim()===''||!Number.isFinite(val)){feedback('Digite o valor previsto para esta saída.',true);return}
  if(Math.abs(val-ch.bridge[p.bridge].y)>1e-6){prog().mistakes++;save();sfx('wrong');feedback('A plataforma não se ativou. Compare sua previsão com a regra descoberta na primeira máquina.',true);return}
  p.bridge++;save();refreshVisualProgress();updateHud();sfx('build');if(p.bridge===3){matinho.celebrate();sfx('discover')}
  renderBridge();toast(p.bridge===3?'Ponte concluída! Agora atravesse até o portal.':'Plataforma construída no cenário!')
 }
 byId('bridge-value').addEventListener('keydown',e=>{if(e.key==='Enter')byId('bridge-build').click()})
}
function travel(){
 if(prog().bridge!==3){toast('Construa as três plataformas antes de usar o portal.');return}
 if(currentChapter<2){
  const next=currentChapter+1
  sfx('portal');busy=true;keys.clear()
  byId('fade').classList.add('on')
  setTimeout(()=>{
   loadChapter(next)
   toast(`Você chegou à ilha ${next+1}: ${chapter().name}.`)
   matinho.wave()
   byId('fade').classList.remove('on');busy=false
  },520)
 }else finishGame()
}
function finishGame(){
 state.finished=true;state.started=true;save();updateHud();matinho.celebrate();sfx('discover')
 openModal(`${header('A EXPEDIÇÃO FOI CONCLUÍDA','O conhecimento abriu caminhos')}
 <div class="modal-body completion-hero"><div class="award">✦</div>
 <h3>Parabéns, explorador!</h3>
 <p>Você percorreu as três ilhas com o Matinho, investigou relações, formulou hipóteses e usou suas descobertas para construir caminhos.</p>
 <div class="statline" style="justify-content:center;margin-bottom:20px"><span class="chip">3 ilhas visitadas</span><span class="chip">6 missões concluídas</span><span class="chip">Progresso salvo</span></div>
 <div class="btn-row" style="justify-content:center">${btn('Abrir diário de bordo','win-diary')}${btn('Baixar minhas descobertas','win-download','secondary')}${btn('Voltar ao mundo','win-world','ghost')}</div>
 <p class="tiny" style="margin-top:19px">Para a sala de aula: discuta quais estratégias foram úteis e quais ideias mudaram durante os testes.</p></div>`,{type:'ending',size:'slim'})
 byId('win-diary').onclick=showNotebook
 byId('win-download').onclick=downloadNotebook
 byId('win-world').onclick=closeModal
}

// --------------------------------- DIÁRIO ----------------------------------
function notebookText(){
 let lines=['ARQUIPÉLAGO DAS FUNÇÕES — DIÁRIO DE BORDO','REDMAT · Registro individual, salvo neste navegador','']
 chapters.forEach((ch,i)=>{
  const p=state.progress[i]
  lines.push(`ILHA ${i+1}: ${ch.name}`)
  lines.push(p.discovered?`Regra investigada: ${ch.formula}`:'Regra ainda não formalizada')
  lines.push(`Ponte: ${p.bridge}/3 plataformas`)
  lines.push('Registros de experimentação:')
  for(const [x,y] of Object.entries(p.tested).sort((a,b)=>Number(a[0])-Number(b[0])))lines.push(`  Entrada ${x} → saída ${fmt(y)}`)
  lines.push(`Minha explicação: ${p.notes||'(não registrada)'}`)
  lines.push(`Questão para debate: ${ch.discussion}`,'')
 })
 lines.push('Registro formativo: explique sua estratégia ao professor e compare hipóteses com colegas.')
 return lines.join('\n')
}
function downloadNotebook(){
 const data=new Blob([notebookText()],{type:'text/plain;charset=utf-8'})
 const url=URL.createObjectURL(data)
 const a=document.createElement('a');a.href=url;a.download='diario-de-bordo-arquipelago.txt';document.body.appendChild(a);a.click();a.remove()
 setTimeout(()=>URL.revokeObjectURL(url),2000)
 toast('Diário de bordo preparado para download.')
}
function showNotebook(){
 const body=chapters.map((ch,i)=>{
  const p=state.progress[i],records=Object.entries(p.tested).sort((a,b)=>Number(a[0])-Number(b[0]))
  return `<section class="book-chapter"><h3>Ilha ${i+1} · ${ch.name}</h3>
   <p class="${p.discovered?'completed':'locked'}">${p.discovered?'Investigação concluída':'Investigação em andamento'} · Ponte ${p.bridge}/3</p>
   ${p.discovered?`<div class="book-fmt">${ch.formula}</div><p>${ch.insight}</p>`:''}
   <p><strong>Testes realizados:</strong> ${records.length?records.map(([x,y])=>`${safe(x)} → ${fmt(y)}`).join(' · '):'Nenhum ainda'}</p>
   ${p.notes?`<p><strong>Meu raciocínio:</strong> ${safe(p.notes)}</p>`:''}
   <p><strong>Para discutir:</strong> ${ch.discussion}</p></section>`
 }).join('')
 openModal(`${header('SEU REGISTRO DE APRENDIZAGEM','Diário de bordo')}
 <div class="modal-body"><p class="modal-sub">Aqui estão os testes e as descobertas da sua expedição. Você pode baixar o diário e compartilhar o raciocínio com colegas ou professor.</p>
 ${body}<div class="btn-row">${btn('Baixar diário (.txt)','download-notes')}${btn('Fechar','close-notes','secondary')}</div></div>`,{type:'notebook'})
 byId('download-notes').onclick=downloadNotebook
 byId('close-notes').onclick=closeModal
}
function showTeacher(fromWelcome=false){
 openModal(`${header('PARA USAR EM SALA DE AULA','Guia do professor')}
 <div class="modal-body"><p class="modal-sub">O Arquipélago das Funções é um recurso para investigação matemática mediada. As respostas não são exibidas inicialmente: cada aluno testa entradas, constrói registros, formula hipóteses e só depois encontra uma representação algébrica.</p>
 <div class="teacher-grid">
 <section><h3>Objetivos de aprendizagem</h3><ul><li>Relacionar entradas, saídas e regularidades.</li><li>Investigar a taxa de variação constante em funções afins.</li><li>Identificar simetria, mínimo e comportamento de funções quadráticas.</li><li>Discutir entradas admissíveis e a ideia de domínio e imagem.</li><li>Articular tabelas, regras algébricas, gráficos e representações visuais.</li></ul></section>
 <section><h3>Sugestão de aula — 50 a 60 min</h3><ul><li>5 min · Problematizar: como descobrir a regra de uma máquina?</li><li>15 min · Exploração em duplas sem antecipar expressões.</li><li>10 min · Comparar registros e hipóteses.</li><li>20 min · Travessias e construção de novas previsões.</li><li>10 min · Sistematização coletiva e retomada dos erros.</li></ul></section>
 <section><h3>Mediação docente</h3><p>Questione “o que mudou?”, “qual teste pode refutar sua hipótese?” e “a regra funcionaria para qualquer entrada?”. Evite mostrar a expressão antes de os estudantes justificarem suas escolhas.</p></section>
 <section><h3>Avaliação formativa</h3><p>Observe a escolha dos testes, os argumentos usados, a revisão de hipóteses e a capacidade de transitar entre registros. O diário de bordo pode ser baixado como texto, mas não envia dados a servidores.</p></section>
 </div><p class="teacher-footer">Público sugerido: 9º ano e Ensino Médio, com adaptações. Os três capítulos podem ocupar aulas diferentes; o conteúdo de domínio da raiz pode exigir mediação adicional.</p>
 <div class="btn-row">${btn('Fechar guia','close-teacher','secondary')}${btn('Abrir diário','teacher-diary','ghost')}</div>
 </div>`,{type:'teacher',size:'wide'})
 byId('close-teacher').onclick=closeModal
 byId('teacher-diary').onclick=showNotebook
}
function showMenu(){
 openModal(`${header('EXPLORAÇÃO · CONFIGURAÇÕES','Menu da aventura')}
 <div class="modal-body"><p class="modal-sub">Seu progresso é salvo automaticamente neste navegador. Você pode interromper e continuar depois.</p>
 <div class="keymap">
 <div><span>Movimentar o Matinho</span><kbd>W A S D / ↑ ↓ ← →</kbd></div>
 <div><span>Girar a câmera</span><kbd>Mouse</kbd></div>
 <div><span>Interagir</span><kbd>E</kbd></div><div><span>Pular / correr</span><kbd>Espaço / Shift</kbd></div>
 <div><span>Diário de bordo</span><kbd>N</kbd></div><div><span>Recolocar personagem</span><kbd>R</kbd></div>
 </div><div class="btn-row" style="margin-top:22px">
 ${btn('Voltar a explorar','menu-resume')}${btn('Guia do professor','menu-teacher','secondary')}
 ${btn(soundOn?'Som: ligado':'Som: desligado','menu-sound','secondary')}${btn('Recomeçar jogo','menu-reset','ghost')}</div>
 <p class="tiny" style="margin-top:18px">Para publicar gratuitamente, veja o arquivo LEIA-ME.txt incluído no projeto.</p>
 </div>`,{type:'menu',size:'slim'})
 byId('menu-resume').onclick=closeModal
 byId('menu-teacher').onclick=()=>showTeacher()
 byId('menu-sound').onclick=e=>{soundOn=!soundOn;try{localStorage.setItem(SOUND_KEY,soundOn?'on':'off')}catch{};e.target.textContent=soundOn?'Som: ligado':'Som: desligado';sfx('click')}
 byId('menu-reset').onclick=()=>{
  if(!confirm('Isso apagará seu progresso local. Deseja recomeçar?'))return
  state=initialState();state.started=true;save();loadChapter(0);closeModal();toast('Nova expedição iniciada.')
 }
}

// --------------------------- CONTROLES E ANIMAÇÕES -------------------------
loadChapter(state.chapter)
byId('hud-top').hidden=true;byId('hud-actions').hidden=true
byId('objective').hidden=true;byId('controls-short').hidden=true
const direction=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3()
const up=new THREE.Vector3(0,1,0),oldTarget=new THREE.Vector3(),newTarget=new THREE.Vector3()
function resetPlayer(){
 player.position.set(0,G,6.3);player.rotation.y=Math.PI;jumpSpeed=0;grounded=true;matinho.reset();resetCamera()
 toast('Matinho voltou ao caminho inicial.')
}
window.addEventListener('keydown',event=>{
 const k=event.key.toLowerCase()
 if(openPanel){
  if(k==='escape'){event.preventDefault();closeModal()}
  return
 }
 if(!byId('welcome-screen').classList.contains('hidden'))return
 if(busy)return
 if(k==='p'||k==='escape'){event.preventDefault();showMenu();return}
 if(k==='n'){event.preventDefault();showNotebook();return}
 if(k==='e'&&!event.repeat){const near=nearest();if(near){event.preventDefault();player.rotation.y=Math.atan2(near.x-player.position.x,near.z-player.position.z);sfx('click');if(near.kind==='machine')renderMission();else if(near.kind==='bridge')renderBridge();else travel()}return}
 if(k==='r'){event.preventDefault();resetPlayer();return}
 if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))event.preventDefault()
 keys.add(k)
 if(k===' '&&grounded){jumpSpeed=6.2;grounded=false;sfx('jump')}
})
window.addEventListener('keyup',event=>keys.delete(event.key.toLowerCase()))
window.addEventListener('blur',()=>keys.clear())
function movePlayer(dt){
 forward.subVectors(controls.target,camera.position);forward.y=0
 if(forward.lengthSq()<.001)forward.set(0,0,-1)
 forward.normalize();right.crossVectors(forward,up).normalize()
 const v=Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'))
 const h=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'))
 direction.copy(forward).multiplyScalar(v).addScaledVector(right,h)
 const walking=direction.lengthSq()>.01
 pose.walking=walking;pose.running=walking&&keys.has('shift')
 if(walking){
   direction.normalize()
   const speed=(keys.has('shift')?7.5:4.4)*dt
   const nx=player.position.x+direction.x*speed,nz=player.position.z+direction.z*speed
   // Resolve os eixos separadamente: permite caminhar junto às bordas.
   if(safeToWalk(nx,nz)){player.position.x=nx;player.position.z=nz}
   else if(safeToWalk(nx,player.position.z))player.position.x=nx
   else if(safeToWalk(player.position.x,nz))player.position.z=nz
   const angle=Math.atan2(direction.x,direction.z)
   let delta=(angle-player.rotation.y+Math.PI*3)%TAU-Math.PI
   player.rotation.y+=delta*Math.min(1,dt*11)
 }
 if(!grounded){
   jumpSpeed-=16*dt
   player.position.y+=jumpSpeed*dt
   if(player.position.y<=G){player.position.y=G;grounded=true;jumpSpeed=0;sfx('land')}
 }
 pose.grounded=grounded;pose.vy=jumpSpeed
 newTarget.copy(player.position).add(new THREE.Vector3(0,1.45,0))
 oldTarget.copy(controls.target)
 controls.target.lerp(newTarget,1-Math.exp(-dt*8))
 camera.position.add(controls.target.clone().sub(oldTarget))
}
function animateScene(dt,t){
 env.update(t,dt)
 for(const bar of podiumBars){
   bar.height+=(bar.target-bar.height)*Math.min(1,dt*8)
   if(bar.block.visible){bar.block.scale.y=Math.max(.02,bar.height);bar.block.position.y=.24+bar.height/2}
 }
 world.update(t,dt,!openPanel&&!busy)
}
// Seta dourada: mostra para onde ir na missão atual.
function updateMarker(t){
 const p=prog()
 const target=!p.discovered?{x:-4.5,z:-.6,y:3.5}:p.bridge<3?{x:6.5,z:.3,y:3.4}:{x:18.4,z:0,y:5.9}
 const playing=byId('welcome-screen').classList.contains('hidden')
 const d=Math.hypot(player.position.x-target.x,player.position.z-target.z)
 marker.group.visible=playing&&!openPanel&&!busy&&d>2.6
 marker.setTarget(target.x,G+target.y,target.z)
 marker.update(t)
}
function updatePrompt(){
 const prompt=byId('prompt')
 if(openPanel||!byId('welcome-screen').classList.contains('hidden')){prompt.hidden=true;return}
 const near=nearest()
 prompt.hidden=!near
 if(near){
   const label=near.kind==='machine'?(prog().discovered?'Revisar sua descoberta':'Investigar a máquina'):
      near.kind==='bridge'?(prog().bridge===3?'Revisar ponte construída':'Construir a ponte'):near.label
   byId('prompt-text').textContent=label
 }
}
function tick(){
 const now=performance.now(),dt=Math.min((now-lastTime)/1000,.05);lastTime=now;time+=dt
 const playing=byId('welcome-screen').classList.contains('hidden')
 if(!openPanel&&playing&&!busy)movePlayer(dt);else{pose.walking=false;pose.running=false}
 pose.panel=!!openPanel
 matinho.update(dt,time,pose)
 animateScene(dt,time);updateMarker(time);updatePrompt()
 controls.update();renderer.render(scene,camera)
}
renderer.setAnimationLoop(tick)
window.addEventListener('resize',()=>{
 camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()
 renderer.setSize(innerWidth,innerHeight)
})
