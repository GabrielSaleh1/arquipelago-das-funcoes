// MATINHO 3D — mascote do REDMAT, montado a partir da arte 2D original:
// cabeça azul com óculos redondos verdes, tela com sorriso, faixa vermelha com botões e selo UFF,
// tronco trapezoidal com a placa "red mat", braços pretos, luvas brancas e sapatões vermelhos.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'
import { mat, outline, TAU, canvasTexture } from './utils3d.js'

const C = {
  cyan: 0x45d2fa, cyanDark: 0x2f9fcf, hip: 0x3cb4e6, mint: 0x36f2c0, red: 0xff3434, maroon: 0xc2425a,
  baseMaroon: 0x8a3c4c, black: 0x16282f, white: 0xffffff, gray: 0xb9bcc0, navy: 0x1f54b0, cuff: 0x00cfee, neck: 0x3a8fb8
}
const lerp = (a, b, k) => a + (b - a) * k

function part(parent, geo, color, pos = [0, 0, 0], o = {}) {
  const m = new THREE.Mesh(geo, mat(color, { roughness: o.rough ?? 0.5, metalness: 0.02 }))
  m.position.set(pos[0], pos[1], pos[2])
  if (o.scale) m.scale.set(o.scale[0], o.scale[1], o.scale[2])
  if (o.rot) m.rotation.set(o.rot[0], o.rot[1], o.rot[2])
  m.castShadow = true
  m.receiveShadow = true
  parent.add(m)
  if (o.line !== false) outline(m, o.th ?? 0.018)
  return m
}
const rbox = (w, h, d, r) => new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001))

function roundedShape(pts, r) {
  const s = new THREE.Shape()
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i + n - 1) % n], p1 = pts[i], p2 = pts[(i + 1) % n]
    const d1 = p1.clone().sub(p0).normalize()
    const d2 = p2.clone().sub(p1).normalize()
    const a = p1.clone().addScaledVector(d1, -r)
    const b = p1.clone().addScaledVector(d2, r)
    if (i === 0) s.moveTo(a.x, a.y)
    else s.lineTo(a.x, a.y)
    s.quadraticCurveTo(p1.x, p1.y, b.x, b.y)
  }
  s.closePath()
  return s
}

// ---------------------------------------------------------------- texturas do rosto
function makeScreen() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 150
  const ctx = c.getContext('2d')
  const tex = canvasTexture(c)
  function draw(expr) {
    ctx.clearRect(0, 0, 256, 150)
    ctx.fillStyle = '#3df2c0'
    ctx.fillRect(0, 0, 256, 150)
    ctx.fillStyle = 'rgba(255,255,255,0.14)'
    for (let y = 8; y < 150; y += 20) ctx.fillRect(0, y, 256, 8)
    ctx.lineCap = 'round'
    if (expr === 'open') {
      ctx.fillStyle = '#2f6b60'
      ctx.beginPath(); ctx.ellipse(135, 112, 25, 17, -0.35, 0, TAU); ctx.fill()
      ctx.fillStyle = '#5cc7a0'
      ctx.beginPath(); ctx.ellipse(141, 118, 12, 7, -0.35, 0, TAU); ctx.fill()
    } else {
      ctx.strokeStyle = '#2d7a68'
      ctx.lineWidth = 6
      ctx.beginPath(); ctx.moveTo(112, 112); ctx.quadraticCurveTo(138, 126, 162, 106); ctx.stroke()
    }
    tex.needsUpdate = true
  }
  draw('smile')
  return { texture: tex, draw }
}

function eyeTexture() {
  const c = document.createElement('canvas')
  c.width = 96
  c.height = 144
  const x = c.getContext('2d')
  x.fillStyle = '#2d6b5f'
  x.beginPath(); x.ellipse(48, 72, 36, 58, 0, 0, TAU); x.fill()
  x.globalCompositeOperation = 'destination-out'
  x.beginPath(); x.moveTo(-2, 34); x.lineTo(46, 72); x.lineTo(-2, 110); x.closePath(); x.fill()
  return canvasTexture(c)
}

function plateTexture() {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 290
  const x = c.getContext('2d')
  x.fillStyle = '#37f3c0'
  x.fillRect(0, 0, 256, 290)
  x.fillStyle = '#2f9b7d'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.font = '900 92px Arial, sans-serif'
  x.fillText('red', 128, 100)
  x.fillText('mat', 128, 188)
  x.fillRect(46, 238, 164, 12)
  return canvasTexture(c)
}

function badgeTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const x = c.getContext('2d')
  x.fillStyle = '#1f54b0'
  x.fillRect(0, 0, 128, 128)
  x.fillStyle = '#ffffff'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  x.font = 'italic 900 62px Arial, sans-serif'
  x.fillText('uff', 64, 66)
  return canvasTexture(c)
}

function softShadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(15,45,55,0.55)')
  g.addColorStop(1, 'rgba(15,45,55,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

// ---------------------------------------------------------------- personagem
export function createMatinho(scene, groundY) {
  const actor = new THREE.Group()
  actor.position.set(0, groundY, 6.3)
  scene.add(actor)
  const rig = new THREE.Group()
  actor.add(rig)

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({ map: softShadowTexture(), transparent: true, depthWrite: false })
  )
  shadow.rotation.x = -Math.PI / 2
  actor.add(shadow)

  // quadril
  part(rig, rbox(0.42, 0.2, 0.3, 0.07), C.hip, [0, 1.15, 0])

  // pernas (pivô no quadril) e sapatos
  function makeLeg(side) {
    const leg = new THREE.Group()
    leg.position.set(side * 0.1, 1.04, 0)
    rig.add(leg)
    part(leg, new THREE.CapsuleGeometry(0.062, 0.72, 6, 12), C.black, [0, -0.43, 0], { line: false })
    const shoe = new THREE.Group()
    shoe.position.set(0, -0.93, 0.06)
    leg.add(shoe)
    part(shoe, rbox(0.3, 0.22, 0.5, 0.09), C.red, [side * 0.02, 0, 0.1], { th: 0.02 })
    part(shoe, rbox(0.18, 0.1, 0.16, 0.04), C.maroon, [0, 0.1, -0.04], { th: 0.012 })
    return leg
  }
  const legL = makeLeg(-1)
  const legR = makeLeg(1)

  // parte de cima (cintura, tronco, braços, cabeça)
  const upper = new THREE.Group()
  upper.position.set(0, 1.3, 0)
  rig.add(upper)
  part(upper, new THREE.CylinderGeometry(0.1, 0.13, 0.13, 14), C.black, [0, -0.02, 0], { line: false })

  const pts = [new THREE.Vector2(-0.32, 0.275), new THREE.Vector2(0.32, 0.275), new THREE.Vector2(0.21, -0.275), new THREE.Vector2(-0.21, -0.275)]
  let tg = new THREE.ExtrudeGeometry(roundedShape(pts, 0.05), {
    depth: 0.16, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.04, bevelSegments: 3, curveSegments: 5
  })
  tg.translate(0, 0, -0.08)
  tg = toCreasedNormals(tg, 0.6)
  const torso = part(upper, tg, C.cyan, [0, 0.32, 0], { th: 0.02 })

  // placa "red mat"
  part(upper, rbox(0.31, 0.35, 0.03, 0.05), C.mint, [0, 0.25, 0.155], { th: 0.012 })
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.31), new THREE.MeshStandardMaterial({ map: plateTexture(), roughness: 0.5 }))
  plate.position.set(0, 0.25, 0.175)
  upper.add(plate)
  // parafusos
  for (const [sx, sy] of [[-0.21, 0.52], [0.2, 0.54]]) {
    part(upper, new THREE.CylinderGeometry(0.045, 0.045, 0.03, 14), C.gray, [sx, sy, 0.15], { rot: [Math.PI / 2, 0, 0], th: 0.012 })
    part(upper, rbox(0.075, 0.014, 0.014, 0.005), 0x555a60, [sx, sy, 0.168], { rot: [0, 0, 0.6], line: false })
  }
  // costas: escotilha e botão
  part(upper, rbox(0.34, 0.3, 0.03, 0.05), C.cyanDark, [0, 0.32, -0.155], { th: 0.012 })
  part(upper, rbox(0.09, 0.06, 0.02, 0.02), C.red, [0, 0.4, -0.18], { line: false })
  for (let i = 0; i < 3; i++) part(upper, rbox(0.2, 0.014, 0.014, 0.005), C.black, [0, 0.27 - i * 0.04, -0.176], { line: false })

  // braços (pivô no ombro)
  function makeArm(side) {
    const arm = new THREE.Group()
    arm.position.set(side * 0.34, 0.52, 0)
    upper.add(arm)
    part(arm, new THREE.CapsuleGeometry(0.04, 0.58, 6, 10), C.black, [0, -0.36, 0], { line: false })
    part(arm, new THREE.CylinderGeometry(0.075, 0.075, 0.09, 16), side < 0 ? C.cuff : C.red, [0, -0.72, 0], { th: 0.012 })
    const hand = new THREE.Group()
    hand.position.set(0, -0.84, 0)
    arm.add(hand)
    part(hand, new THREE.SphereGeometry(0.11, 16, 12), C.white, [0, 0, 0], { scale: [1, 1.1, 0.85], th: 0.014 })
    if (side > 0) {
      for (let f = 0; f < 4; f++) {
        part(hand, new THREE.CapsuleGeometry(0.022, 0.07, 4, 8), C.white, [-0.07 + f * 0.047, -0.14, 0.01], { rot: [0, 0, (f - 1.5) * 0.12], th: 0.01 })
      }
    } else {
      for (let f = 0; f < 3; f++) part(hand, new THREE.SphereGeometry(0.036, 10, 8), C.white, [-0.05 + f * 0.05, -0.06, 0.09], { th: 0.01 })
      part(hand, new THREE.SphereGeometry(0.04, 10, 8), C.white, [0.1, 0.02, 0.05], { th: 0.01 })
    }
    return arm
  }
  const armL = makeArm(-1)
  const armR = makeArm(1)

  // pescoço com fios coloridos
  part(upper, new THREE.CylinderGeometry(0.055, 0.085, 0.1, 14), C.neck, [0, 0.64, 0], { th: 0.012 })
  part(upper, new THREE.TorusGeometry(0.07, 0.015, 8, 20), C.red, [0, 0.6, 0], { rot: [Math.PI / 2, 0, 0], line: false })
  ;[0xff3434, 0xffffff, 0x4fd6fb, 0x36f2c0].forEach((col, i) => {
    part(upper, new THREE.CapsuleGeometry(0.008, 0.07, 3, 6), col, [0.1 + i * 0.022, 0.6, -0.03], { rot: [0, 0, -0.35], line: false })
  })

  // cabeça
  const headPivot = new THREE.Group()
  headPivot.position.set(0, 0.666, 0)
  upper.add(headPivot)
  const head = new THREE.Group()
  head.position.set(0, 0.417, 0)
  headPivot.add(head)
  part(head, rbox(1.06, 0.642, 0.62, 0.1), C.cyan, [0, 0.096, 0], { th: 0.02 })
  part(head, rbox(1.06, 0.14, 0.64, 0.05), C.red, [0, -0.294, 0.005], { th: 0.02 })
  part(head, rbox(0.9, 0.06, 0.54, 0.02), C.baseMaroon, [0, -0.39, 0], { th: 0.014 })
  part(head, rbox(0.09, 0.04, 0.62, 0.015), C.red, [-0.34, 0.417, 0], { line: false })
  // tela e rosto
  part(head, rbox(0.8, 0.5, 0.05, 0.06), C.mint, [0, 0.02, 0.315], { th: 0.012 })
  const screen = makeScreen()
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(0.76, 0.46),
    new THREE.MeshStandardMaterial({ map: screen.texture, roughness: 0.45, emissive: 0x0d4f3f, emissiveIntensity: 0.35 })
  )
  face.position.set(0, 0.02, 0.343)
  head.add(face)
  // óculos
  const eyeTex = eyeTexture()
  const eyes = []
  for (const side of [-1, 1]) {
    const lens = new THREE.Group()
    lens.position.set(side * 0.34, 0.082, 0.33)
    head.add(lens)
    part(lens, new THREE.CylinderGeometry(0.245, 0.245, 0.05, 36), C.mint, [0, 0, 0], { rot: [Math.PI / 2, 0, 0], line: false })
    part(lens, new THREE.TorusGeometry(0.255, 0.03, 10, 40), 0x0f2229, [0, 0, 0.01], { line: false })
    const eye = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.18), new THREE.MeshBasicMaterial({ map: eyeTex, transparent: true }))
    eye.position.set(-side * 0.14, 0, 0.03)
    lens.add(eye)
    eyes.push(eye)
  }
  part(head, new THREE.CapsuleGeometry(0.018, 0.1, 3, 6), 0x0f2229, [0, 0.1, 0.36], { rot: [0, 0, Math.PI / 2], line: false })
  // botões e selo UFF na faixa vermelha
  for (let i = 0; i < 3; i++) {
    part(head, new THREE.SphereGeometry(0.03, 10, 8), 0x0f2229, [0.2 + i * 0.065, -0.294, 0.326], { scale: [0.8, 1.4, 0.4], line: false })
  }
  const badge = new THREE.Mesh(new THREE.CircleGeometry(0.058, 24), new THREE.MeshStandardMaterial({ map: badgeTexture(), roughness: 0.4 }))
  badge.position.set(0.42, -0.294, 0.332)
  head.add(badge)
  const badgeRim = new THREE.Mesh(new THREE.RingGeometry(0.058, 0.07, 24), new THREE.MeshBasicMaterial({ color: 0x0f2229 }))
  badgeRim.position.set(0.42, -0.294, 0.331)
  head.add(badgeRim)

  // ---------------------------------------------------------------- partículas: poeira e confete
  const dust = []
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }))
    m.visible = false
    scene.add(m)
    dust.push({ m, life: 0 })
  }
  let dustIdx = 0
  function puff(x, y, z, spread = 0) {
    const d = dust[dustIdx++ % dust.length]
    d.life = 0.45
    d.m.visible = true
    d.m.position.set(x + (Math.random() - 0.5) * spread, y + 0.08, z + (Math.random() - 0.5) * spread)
  }
  const confettiColors = [0xff3434, 0x45d2fa, 0x36f2c0, 0xffd447]
  const confetti = []
  for (let i = 0; i < 30; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.14), new THREE.MeshBasicMaterial({ color: confettiColors[i % 4], side: THREE.DoubleSide }))
    m.visible = false
    scene.add(m)
    confetti.push({ m, life: 0, v: new THREE.Vector3(), spin: new THREE.Vector3() })
  }
  function burst() {
    for (const c of confetti) {
      c.life = 1.6 + Math.random() * 0.5
      c.m.visible = true
      c.m.position.set(actor.position.x, actor.position.y + 2.4, actor.position.z)
      c.v.set((Math.random() - 0.5) * 4.4, 3 + Math.random() * 3, (Math.random() - 0.5) * 4.4)
      c.spin.set(Math.random() * 10, Math.random() * 10, Math.random() * 10)
    }
  }

  // ---------------------------------------------------------------- animação
  let phase = 0, amp = 0, squash = 0, wasGrounded = true
  let blinkT = 2.5, blink = 0, idleT = 0, nextFidget = 6
  let waveT = 0, celebrateT = 0, pendingBurst = false, puffT = 0
  let expr = 'smile'

  function update(dt, t, s) {
    const moving = s.walking && s.grounded
    const panel = !!s.panel
    amp = lerp(amp, moving ? (s.running ? 0.95 : 0.65) : 0, 1 - Math.exp(-dt * 10))
    if (moving) phase += dt * (s.running ? 13 : 9.5)
    const sw = Math.sin(phase)

    if (!panel) {
      if (celebrateT > 0) celebrateT -= dt
      if (waveT > 0) waveT -= dt
    }
    if (pendingBurst && !panel) { burst(); pendingBurst = false }

    if (moving || !s.grounded || celebrateT > 0) { idleT = 0 } else idleT += dt
    if (idleT > nextFidget) { waveT = 1.6; idleT = 0; nextFidget = 6 + Math.random() * 4 }

    // alvos de pose
    let tLegL = sw * amp * 0.7, tLegR = -sw * amp * 0.7
    let tArmLx = -sw * amp * 0.8, tArmRx = sw * amp * 0.8
    let tArmLz = -0.08, tArmRz = 0.08
    let hop = 0
    let tHeadX = 0, tHeadY = 0, tHeadZ = 0

    if (!s.grounded) {
      if (s.vy > 0) { tArmLz = -2.3; tArmRz = 2.3; tArmLx = 0; tArmRx = 0; tLegL = -0.55; tLegR = 0.3; tHeadX = -0.15 }
      else { tArmLz = -1.1; tArmRz = 1.1; tArmLx = 0; tArmRx = 0; tLegL = -0.1; tLegR = 0.1; tHeadX = 0.08 }
    } else if (celebrateT > 0) {
      tArmLz = -2.5 - Math.sin(t * 16) * 0.25
      tArmRz = 2.5 + Math.sin(t * 16) * 0.25
      tArmLx = 0; tArmRx = 0
      hop = Math.abs(Math.sin(t * 7.5)) * 0.28
      tHeadX = -0.1
    } else if (waveT > 0 && !moving) {
      tArmRz = 2.3 + Math.sin(t * 11) * 0.35
      tArmRx = 0
      tHeadZ = 0.1
    }
    if (!moving && s.grounded && celebrateT <= 0) {
      tHeadY = Math.sin(t * 0.7) * 0.14
      tHeadZ += Math.sin(t * 1.3) * 0.035
    }

    const k = 1 - Math.exp(-dt * 18)
    legL.rotation.x = lerp(legL.rotation.x, tLegL, k)
    legR.rotation.x = lerp(legR.rotation.x, tLegR, k)
    armL.rotation.x = lerp(armL.rotation.x, tArmLx, k)
    armR.rotation.x = lerp(armR.rotation.x, tArmRx, k)
    armL.rotation.z = lerp(armL.rotation.z, tArmLz, k)
    armR.rotation.z = lerp(armR.rotation.z, tArmRz, k)
    headPivot.rotation.x = lerp(headPivot.rotation.x, tHeadX - amp * 0.1, k)
    headPivot.rotation.y = lerp(headPivot.rotation.y, tHeadY, k)
    headPivot.rotation.z = lerp(headPivot.rotation.z, tHeadZ, k)
    upper.rotation.y = lerp(upper.rotation.y, -sw * amp * 0.15, k)
    upper.scale.y = 1 + Math.sin(t * 2) * 0.012
    rig.rotation.x = lerp(rig.rotation.x, amp * (s.running ? 0.24 : 0.16), k)

    // aterrissagem: amassa e levanta poeira
    if (s.grounded && !wasGrounded) {
      squash = 1
      for (let i = 0; i < 4; i++) puff(actor.position.x, actor.position.y, actor.position.z, 0.7)
    }
    wasGrounded = s.grounded
    squash = Math.max(0, squash - dt * 5)
    const stretch = !s.grounded && s.vy > 2 ? 0.05 : 0
    rig.scale.set(1 + squash * 0.1, 1 - squash * 0.16 + stretch, 1 + squash * 0.1)
    rig.position.y = (moving ? Math.abs(sw) * 0.06 * (amp / 0.65) : Math.sin(t * 2) * 0.012) + hop

    // poeira dos passos
    if (moving) {
      puffT -= dt
      if (puffT <= 0) { puffT = s.running ? 0.12 : 0.22; puff(actor.position.x, actor.position.y, actor.position.z, 0.3) }
    }

    // piscar e expressão
    blinkT -= dt
    if (blinkT <= 0) { blink = 0.12; blinkT = 2.2 + Math.random() * 3 }
    blink = Math.max(0, blink - dt)
    const ey = blink > 0 ? 0.1 : 1
    eyes.forEach((e) => { e.scale.y = ey })
    const want = celebrateT > 0 ? 'open' : 'smile'
    if (want !== expr) { expr = want; screen.draw(expr) }

    // sombra no chão
    const h = Math.max(0, actor.position.y - groundY)
    shadow.position.y = -h + 0.02
    shadow.scale.setScalar(Math.max(0.5, 1 - h * 0.12))
    shadow.material.opacity = Math.max(0.35, 1 - h * 0.15)

    for (const d of dust) {
      if (d.life > 0) {
        d.life -= dt
        const p = 1 - Math.max(0, d.life) / 0.45
        d.m.scale.setScalar(0.4 + p * 1.1)
        d.m.material.opacity = (1 - p) * 0.5
        d.m.position.y += dt * 0.35
        if (d.life <= 0) d.m.visible = false
      }
    }
    for (const c of confetti) {
      if (c.life > 0) {
        c.life -= dt
        c.v.y -= 9 * dt
        c.m.position.addScaledVector(c.v, dt)
        c.m.rotation.x += c.spin.x * dt
        c.m.rotation.y += c.spin.y * dt
        c.m.scale.setScalar(Math.min(1, Math.max(0.01, c.life * 3)))
        if (c.life <= 0) c.m.visible = false
      }
    }
  }

  return {
    group: actor,
    update,
    celebrate(seconds = 2.4) { celebrateT = seconds; pendingBurst = true },
    wave() { waveT = 1.6 },
    reset() { squash = 0; celebrateT = 0; waveT = 0; pendingBurst = false; wasGrounded = true }
  }
}
