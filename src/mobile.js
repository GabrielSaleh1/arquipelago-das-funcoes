/* Arquipélago das Funções — camada de interação para dispositivos de toque.
 * Não modifica as regras das missões, o salvamento ou o mundo 3D.
 * O movimento analógico é lido pelo loop principal; a câmera permanece com OrbitControls.
 */
export const isMobileTouch = typeof window !== 'undefined' &&
  (window.matchMedia('(pointer: coarse)').matches ||
   (navigator.maxTouchPoints > 0 && window.innerWidth <= 1024))

export function setupMobileControls({ onInteract, onJump, onReset }) {
  const input = { x: 0, y: 0, sprint: false }
  const noop = () => {}
  if (!isMobileTouch) return { input, update: noop, release: noop, enhanceMission: noop }

  document.body.classList.add('mobile-touch')
  const ui = document.getElementById('ui')
  if (!ui) return { input, update: noop, release: noop, enhanceMission: noop }

  const container = document.createElement('section')
  container.id = 'mobile-controls'
  container.className = 'mobile-controls'
  container.hidden = true
  container.setAttribute('aria-label', 'Controles de toque')
  container.innerHTML = `
    <div class="mobile-pad" id="mobile-pad" role="group" aria-label="Controle de movimentação">
      <div class="mobile-pad-ring"><div class="mobile-pad-knob" id="mobile-pad-knob"></div></div>
      <span class="mobile-pad-hint">MOVER</span>
    </div>
    <div class="mobile-actions">
      <button type="button" class="mobile-interact" id="mobile-interact" hidden>INTERAGIR</button>
      <div class="mobile-actions-row">
        <button type="button" class="mobile-run" id="mobile-run" aria-pressed="false">CORRER</button>
        <button type="button" class="mobile-jump" id="mobile-jump">PULAR</button>
      </div>
    </div>`
  ui.appendChild(container)

  const pad = container.querySelector('#mobile-pad')
  const ring = container.querySelector('.mobile-pad-ring')
  const knob = container.querySelector('#mobile-pad-knob')
  const interact = container.querySelector('#mobile-interact')
  const run = container.querySelector('#mobile-run')
  const jump = container.querySelector('#mobile-jump')
  let activePointer = null
  let wasActive = false
  let currentPhase = -1
  let missionTab = 'experiment'
  let currentNear = ''

  function resetStick() {
    input.x = 0; input.y = 0
    knob.style.transform = 'translate3d(0, 0, 0)'
  }
  function release() {
    activePointer = null
    resetStick()
  }
  function steer(e) {
    const r = ring.getBoundingClientRect()
    const limit = Math.max(22, (r.width - knob.offsetWidth) / 2)
    let dx = e.clientX - (r.left + r.width / 2)
    let dy = e.clientY - (r.top + r.height / 2)
    const length = Math.hypot(dx, dy)
    if (length > limit) { dx = dx * limit / length; dy = dy * limit / length }
    input.x = Math.abs(dx / limit) < 0.09 ? 0 : dx / limit
    input.y = Math.abs(dy / limit) < 0.09 ? 0 : -dy / limit
    knob.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`
  }
  pad.addEventListener('pointerdown', e => {
    if (activePointer !== null || container.hidden) return
    e.preventDefault()
    activePointer = e.pointerId
    pad.setPointerCapture(e.pointerId)
    steer(e)
  })
  pad.addEventListener('pointermove', e => {
    if (e.pointerId !== activePointer) return
    e.preventDefault(); steer(e)
  })
  function endPointer(e) {
    if (e.pointerId === activePointer) release()
  }
  for (const ev of ['pointerup','pointercancel','lostpointercapture']) pad.addEventListener(ev, endPointer)

  for (const b of [interact, run, jump]) b.addEventListener('pointerdown', e => e.stopPropagation())
  interact.addEventListener('click', () => onInteract())
  jump.addEventListener('click', () => onJump())
  run.addEventListener('click', () => {
    input.sprint = !input.sprint
    run.setAttribute('aria-pressed', String(input.sprint))
    run.classList.toggle('is-running', input.sprint)
    run.textContent = input.sprint ? 'ANDAR' : 'CORRER'
  })
  const resetWhenHidden = () => { if (document.hidden) release() }
  document.addEventListener('visibilitychange', resetWhenHidden)
  window.addEventListener('blur', release)

  // Acrescenta uma maneira de retornar ao início sem depender do teclado.
  const resetButton = document.createElement('button')
  resetButton.type = 'button'
  resetButton.className = 'mobile-reset'
  resetButton.textContent = 'Reposicionar Matinho'
  resetButton.onclick = () => { release(); onReset() }
  // O botão aparece pelo próprio menu do jogo, inserido pelo main.js.
  function attachResetButton() {
    const row = document.querySelector('#modal .btn-row')
    if (row && !row.querySelector('.mobile-reset')) row.append(resetButton)
  }

  function update({ active, nearby }) {
    if (!active && wasActive) release()
    if (active !== wasActive) {
      container.hidden = !active
      document.body.classList.toggle('mobile-playing', active)
      wasActive = active
    }
    const key = active && nearby ? `${nearby.kind}:${nearby.label}` : ''
    if (currentNear !== key) {
      currentNear = key
      interact.hidden = !key
      if (key) interact.textContent = nearby.kind === 'portal' ? 'PORTAL' : nearby.kind === 'bridge' ? 'PONTE' : 'INTERAGIR'
    }
  }

  // Durante uma missão, deixa alternar entre laboratório e pergunta sem rolagem longa.
  // A etapa de investigação continua sequencial; o aluno pode voltar aos testes.
  function enhanceMission(modal, phase) {
    const split = modal?.querySelector('.split')
    if (!split) return
    const experiment = split.children[0], challenge = split.children[1]
    if (!experiment || !challenge) return
    if (phase !== currentPhase) {
      missionTab = phase === 0 ? 'experiment' : 'challenge'
      currentPhase = phase
    }
    split.classList.add('mobile-mission-split')
    experiment.classList.add('mobile-experiment-panel')
    challenge.classList.add('mobile-challenge-panel')
    const tabs = document.createElement('div')
    tabs.className = 'mobile-mission-tabs'
    tabs.setAttribute('role', 'tablist')
    tabs.innerHTML = `<button type="button" data-mtab="experiment" role="tab" aria-selected="false">Experimentar</button><button type="button" data-mtab="challenge" role="tab" aria-selected="false">Desafio atual</button>`
    split.before(tabs)
    function setTab(tab) {
      missionTab = tab
      split.dataset.activeTab = tab
      tabs.querySelectorAll('[data-mtab]').forEach(b => {
        const selected = b.dataset.mtab === tab
        b.setAttribute('aria-selected', String(selected))
      })
      const body = modal.querySelector('.modal-body')
      if (body) body.scrollTop = 0
      modal.scrollTop = 0
    }
    tabs.querySelectorAll('[data-mtab]').forEach(b => b.onclick = () => setTab(b.dataset.mtab))
    setTab(missionTab)
  }

  return { input, update, release, enhanceMission, attachResetButton }
}
