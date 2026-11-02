// CENÁRIO DO ARQUIPÉLAGO — céu, mar, ilhas, estações, portal, ponte e pilares.
// Cada região tem uma paleta própria, mas todas usam o mesmo "kit" de formas e o mesmo traço de contorno.
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { G, TAU, mat, addMesh, outline, rgb, drawText, label3d, canvasTexture, roundRectPath } from './utils3d.js'

function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const clamp01 = (v) => Math.min(1, Math.max(0, v))
const rbox = (w, h, d, r, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2 - 0.001, h / 2 - 0.001, d / 2 - 0.001))

// ---------------------------------------------------------------- paletas das três regiões
export const THEMES = [
  { // Costa das Relações — manhã na praia
    sky: { top: '#4fb0ec', mid: '#9fdcf4', hor: '#c9edf0' }, fog: '#c9edf0', fogNear: 34, fogFar: 120,
    hemi: [0xf1ffff, 0x5e8b75, 2.7], sun: [0xfff5d2, 3.0, [-10, 24, 12]], stars: 0,
    sea: { shallow: '#9bf0d8', mid: '#58cddd', deep: '#30a4cf' }, cloud: { color: '#ffffff', emissive: '#dff3fb' },
    ambient: { color: '#fff3b0' },
    rock: 0x9a7658, rockBand: 0xc79f72, path: 0xf8ebc3, pathEdge: 0xe0cb97, lawnLight: '#b6eca2', lawnDark: '#86cf8a',
    stone: 0xe6e0cc, stoneDark: 0xb8b29b, wood: 0x8d7058, machine: 0x2b9aa0, tufts: ['#5cb46b', '#6fc97a', '#4aa062', '#86d88a']
  },
  { // Montanhas das Curvas — tarde dourada
    sky: { top: '#6aa8e6', mid: '#f4c995', hor: '#fadfc0' }, fog: '#fadfc0', fogNear: 34, fogFar: 125,
    hemi: [0xfff0dc, 0x8a7d5a, 2.5], sun: [0xffd7a0, 3.1, [-18, 18, 8]], stars: 0,
    sea: { shallow: '#a8ecd6', mid: '#5fc9d0', deep: '#3aa0c4' }, cloud: { color: '#fff1de', emissive: '#ffe0bd' },
    ambient: { color: '#ffc27a' },
    rock: 0xa86a4c, rockBand: 0xd89a68, path: 0xf5dcb4, pathEdge: 0xd9b985, lawnLight: '#c5e49a', lawnDark: '#9ccb7c',
    stone: 0xe9dcc3, stoneDark: 0xbfa98a, wood: 0x7d5c43, machine: 0xd9822f, tufts: ['#8fbf5a', '#a3cf68', '#7aa84c', '#b9d977']
  },
  { // Cavernas das Possibilidades — crepúsculo mágico
    sky: { top: '#2b2f78', mid: '#6f5fc0', hor: '#a999e6' }, fog: '#a59be0', fogNear: 30, fogFar: 115,
    hemi: [0xd6dcff, 0x4a5090, 2.6], sun: [0xcfd9ff, 2.4, [12, 26, -6]], stars: 1,
    sea: { shallow: '#86e6ea', mid: '#5b95dc', deep: '#3c52b0' }, cloud: { color: '#cfc6ff', emissive: '#9a8ce0' },
    ambient: { color: '#b8fff0' },
    rock: 0x6e5f94, rockBand: 0x9585bd, path: 0xd7e5ea, pathEdge: 0xa9bfcb, lawnLight: '#a9e3cf', lawnDark: '#7fc4b4',
    stone: 0xdcd8ee, stoneDark: 0xa39fc4, wood: 0x6a5a7a, machine: 0x5b4fb8, tufts: ['#5fb7a6', '#72c9b8', '#4aa393', '#8de0cf']
  }
]

// ilhas distantes, só decorativas (formam o "arquipélago" no horizonte)
const FAR = [[-30, -18, 5], [-27, 24, 4.2], [11, -35, 6.4], [35, 23, 4.6], [46, -15, 5.6], [-54, 3, 7.2], [-14, -46, 5], [56, 12, 4]]
const MAIN_ISLES = [[0, 0, 11.5], [18.4, 0, 4.55]]

const shapeK = (a, s = 0) => 1 + 0.02 * Math.sin(3 * a + 1 + s) + 0.012 * Math.sin(5 * a + 2.2 + s * 1.7) + 0.008 * Math.sin(9 * a + s * 0.5)
const seedOf = (x, z) => x * 0.01 + z * 0.02

function dotTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}
const dot = dotTexture()

function outlineRing(r0, r1, seg, s) {
  const pos = [], idx = []
  for (let i = 0; i <= seg; i++) {
    const a = (i / seg) * TAU, k = shapeK(a, s)
    pos.push(Math.cos(a) * r0 * k, 0, Math.sin(a) * r0 * k, Math.cos(a) * r1 * k, 0, Math.sin(a) * r1 * k)
  }
  for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3) }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  return geo
}

// ================================================================= CÉU, MAR, LUZ, NUVENS
export function createEnvironment(scene) {
  const T0 = THEMES[0]
  scene.background = new THREE.Color(T0.fog)
  scene.fog = new THREE.Fog(T0.fog, T0.fogNear, T0.fogFar)

  const hemi = new THREE.HemisphereLight(T0.hemi[0], T0.hemi[1], T0.hemi[2])
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(T0.sun[0], T0.sun[1])
  sun.position.set(...T0.sun[2])
  sun.castShadow = true
  sun.shadow.mapSize.set(2048, 2048)
  const sc = sun.shadow.camera
  sc.left = -26; sc.right = 26; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 90
  sun.shadow.normalBias = 0.04
  scene.add(sun)

  // céu em degradê, com estrelas na região 3
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(450, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        top: { value: rgb(T0.sky.top) }, mid: { value: rgb(T0.sky.mid) }, hor: { value: rgb(T0.sky.hor) },
        sunDir: { value: sun.position.clone().normalize() }, stars: { value: 0 }
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 top; uniform vec3 mid; uniform vec3 hor; uniform vec3 sunDir; uniform float stars;
        varying vec3 vDir;
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, 0.0, 1.0);
          vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h));
          c = mix(c, top, smoothstep(0.15, 0.75, h));
          float s = max(dot(d, sunDir), 0.0);
          c += vec3(1.0, 0.93, 0.7) * (pow(s, 64.0) * 0.5 + pow(s, 8.0) * 0.12);
          vec3 q = floor(d * 160.0);
          float r = fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
          c += vec3(1.0) * step(0.9965, r) * stars * smoothstep(0.08, 0.4, d.y);
          gl_FragColor = vec4(c, 1.0);
        }`
    })
  )
  sky.renderOrder = -1
  scene.add(sky)

  // mar com ondas suaves e cor mais clara perto das ilhas
  const seaGeo = new THREE.PlaneGeometry(300, 300, 110, 110)
  seaGeo.rotateX(-Math.PI / 2)
  const seaColors = new Float32Array(seaGeo.attributes.position.count * 3)
  seaGeo.setAttribute('color', new THREE.BufferAttribute(seaColors, 3))
  const sea = new THREE.Mesh(seaGeo, new THREE.MeshStandardMaterial({
    color: 0xffffff, vertexColors: true, roughness: 0.42, metalness: 0, flatShading: true
  }))
  sea.receiveShadow = true
  sea.frustumCulled = false
  scene.add(sea)
  const seaBase = seaGeo.attributes.position.array.slice()
  const isles = [...MAIN_ISLES, ...FAR]
  function recolorSea(th) {
    const a = seaGeo.attributes.position.array
    const shallow = new THREE.Color(th.sea.shallow), mid = new THREE.Color(th.sea.mid), deep = new THREE.Color(th.sea.deep)
    const c = new THREE.Color()
    for (let i = 0; i < a.length; i += 3) {
      let d = 1e9
      for (const [ix, iz, r] of isles) d = Math.min(d, Math.hypot(a[i] - ix, a[i + 2] - iz) - r * 1.25)
      c.copy(shallow).lerp(mid, clamp01(d / 4)).lerp(deep, clamp01((d - 4) / 24))
      seaColors[i] = c.r; seaColors[i + 1] = c.g; seaColors[i + 2] = c.b
    }
    seaGeo.attributes.color.needsUpdate = true
  }

  // espuma na beira das ilhas
  const foamMats = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide }))
  for (const [x, z, r] of isles) {
    const s = seedOf(x, z)
    const a = new THREE.Mesh(outlineRing(r * 1.22, r * 1.22 + 0.5, 96, s), foamMats[0])
    const b = new THREE.Mesh(outlineRing(r * 1.45, r * 1.45 + 0.22, 96, s), foamMats[1])
    a.position.set(x, 0.12, z); b.position.set(x, 0.12, z)
    scene.add(a, b)
  }

  // nuvens
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#dff3fb', emissiveIntensity: 0.55, roughness: 1, flatShading: true })
  const puffs = [[-1.3, 0, 0, 0.9], [-0.4, 0.35, 0.1, 1.25], [0.7, 0.2, -0.1, 1.1], [1.6, -0.05, 0, 0.8], [0.1, -0.1, 0.5, 0.9]]
  const clouds = []
  ;[[-14, 10, -10, 1.4, 0.35], [10, 11, -16, 1.75, 0.3], [-2, 13, -25, 2, 0.25], [22, 15, 8, 1.3, 0.4],
    [-30, 14, 14, 1.6, 0.3], [40, 16, -30, 2.2, 0.2], [-45, 17, -35, 2.4, 0.25]].forEach(([x, y, z, s, speed]) => {
    const g = new THREE.Group()
    puffs.forEach(([dx, dy, dz, size]) => {
      const p = new THREE.Mesh(new THREE.IcosahedronGeometry(size, 1), cloudMat)
      p.position.set(dx, dy, dz)
      g.add(p)
    })
    g.position.set(x, y, z)
    g.scale.setScalar(s)
    scene.add(g)
    clouds.push({ g, x0: x, speed })
  })

  // partículas flutuando (pólen, brasas, vaga-lumes)
  const COUNT = 70
  const ambGeo = new THREE.BufferGeometry()
  ambGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(COUNT * 3), 3))
  const ambient = new THREE.Points(ambGeo, new THREE.PointsMaterial({
    color: T0.ambient.color, size: 0.2, map: dot, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  }))
  ambient.frustumCulled = false
  scene.add(ambient)
  const r = rng(11)
  const ambData = Array.from({ length: COUNT }, () => ({ x: -14 + r() * 42, y: 1.8 + r() * 4.5, z: -13 + r() * 26, ph: r() * TAU }))

  function applyTheme(i) {
    const th = THEMES[i]
    scene.background.set(th.fog)
    scene.fog.color.set(th.fog)
    scene.fog.near = th.fogNear
    scene.fog.far = th.fogFar
    hemi.color.set(th.hemi[0]); hemi.groundColor.set(th.hemi[1]); hemi.intensity = th.hemi[2]
    sun.color.set(th.sun[0]); sun.intensity = th.sun[1]; sun.position.set(...th.sun[2])
    const u = sky.material.uniforms
    u.top.value.copy(rgb(th.sky.top)); u.mid.value.copy(rgb(th.sky.mid)); u.hor.value.copy(rgb(th.sky.hor))
    u.sunDir.value.copy(sun.position).normalize(); u.stars.value = th.stars
    cloudMat.color.set(th.cloud.color); cloudMat.emissive.set(th.cloud.emissive)
    ambient.material.color.set(th.ambient.color)
    recolorSea(th)
  }
  applyTheme(0)

  function update(t) {
    const a = seaGeo.attributes.position.array
    for (let i = 0; i < a.length; i += 3) {
      const x = seaBase[i], z = seaBase[i + 2]
      a[i + 1] = Math.sin(x * 0.22 + t * 1.1) * 0.05 + Math.sin(z * 0.3 - t * 1.4) * 0.04 + Math.sin((x + z) * 0.11 + t * 0.7) * 0.06
    }
    seaGeo.attributes.position.needsUpdate = true
    foamMats[0].opacity = 0.5 + Math.sin(t * 1.4) * 0.15
    foamMats[1].opacity = 0.3 + Math.sin(t * 1.4 + 2) * 0.12
    for (const c of clouds) c.g.position.x = ((((c.x0 + t * c.speed + 80) % 160) + 160) % 160) - 80
    const p = ambGeo.attributes.position.array
    ambData.forEach((d, i) => {
      p[i * 3] = d.x + Math.sin(t * 0.3 + d.ph) * 0.7
      p[i * 3 + 1] = d.y + Math.sin(t * 0.6 + d.ph) * 0.4
      p[i * 3 + 2] = d.z + Math.cos(t * 0.25 + d.ph) * 0.7
    })
    ambGeo.attributes.position.needsUpdate = true
  }
  return { applyTheme, update }
}

// ================================================================= ILHAS
function blob(parent, rt, rb, h, color, y, s, cast, extra = {}) {
  const geo = new THREE.CylinderGeometry(rt, rb, h, 72)
  const p = geo.attributes.position
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i)
    const k = shapeK(Math.atan2(z, x), s)
    p.setX(i, x * k); p.setZ(i, z * k)
  }
  return addMesh(parent, geo, mat(color, extra), 0, y, 0, cast)
}

function lawnTexture(light, dark, seed) {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const x = c.getContext('2d')
  const r = rng(seed)
  x.fillStyle = light
  x.fillRect(0, 0, 512, 512)
  for (let i = 0; i < 46; i++) {
    x.fillStyle = i % 2 ? dark : '#ffffff'
    x.globalAlpha = 0.1 + r() * 0.08
    x.beginPath(); x.ellipse(r() * 512, r() * 512, 30 + r() * 70, 20 + r() * 45, r() * 3, 0, TAU); x.fill()
  }
  x.globalAlpha = 1
  x.globalCompositeOperation = 'destination-in'
  const g = x.createRadialGradient(256, 256, 0, 256, 256, 256)
  g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.9, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 512, 512)
  return canvasTexture(c)
}

function makeIsland(parent, x, z, R, ch, th, { cast = true, lawn = true } = {}) {
  const g = new THREE.Group()
  g.position.set(x, 0, z)
  parent.add(g)
  const s = seedOf(x, z)
  blob(g, R * 0.96, R * 0.78, 3.15, th.rock, -0.825, s, cast)
  blob(g, R * 1.0, R * 1.0, 0.15, th.rockBand, 0.825, s, cast)
  blob(g, R * 0.995, R * 0.995, 0.1, ch.edge, 0.95, s, cast)
  blob(g, R * 0.985, R * 0.985, 0.08, ch.ground, 1.0, s, cast)
  blob(g, R * 1.1, R * 1.18, 1.0, ch.sand, 0.05, s, false, { roughness: 1 })
  if (lawn) {
    const l = new THREE.Mesh(
      new THREE.CircleGeometry(R * 0.97, 64),
      new THREE.MeshStandardMaterial({ map: lawnTexture(th.lawnLight, th.lawnDark, Math.floor(x + z + R * 7)), roughness: 1, transparent: true, depthWrite: false })
    )
    l.rotation.x = -Math.PI / 2
    l.position.y = 1.043
    l.receiveShadow = true
    g.add(l)
  }
  return g
}

// ================================================================= CAMINHOS
const PATH_SEGS = [[0, 7.6, 0, -7.6, 2.3], [0, -0.8, -4.5, -0.6, 1.7], [0, 0.4, 6.5, 0.3, 1.7], [6.5, 0.3, 10.5, 0, 1.7]]
const PLAZAS = [[0, 0, 2.7], [-4.5, -0.6, 1.9], [6.5, 0.3, 1.9], [0, 6.3, 1.6]]

function distSeg(px, pz, x1, z1, x2, z2) {
  const dx = x2 - x1, dz = z2 - z1
  const t = clamp01(((px - x1) * dx + (pz - z1) * dz) / (dx * dx + dz * dz))
  return Math.hypot(px - (x1 + dx * t), pz - (z1 + dz * t))
}
function spotFree(x, z, pad = 0.4) {
  for (const [x1, z1, x2, z2, w] of PATH_SEGS) if (distSeg(x, z, x1, z1, x2, z2) < w / 2 + pad) return false
  for (const [cx, cz, r] of PLAZAS) if (Math.hypot(x - cx, z - cz) < r + pad) return false
  if (Math.abs(x) < 6.6 && z > -6.7 && z < -3.9) return false // pilares dos testes
  if (x > 8.6 && Math.abs(z) < 1.8) return false // chegada da ponte
  return Math.hypot(x, z) < 10.2
}

function strip(parent, x1, z1, x2, z2, w, color, y) {
  const dx = x2 - x1, dz = z2 - z1, L = Math.hypot(dx, dz)
  const m = new THREE.Mesh(new THREE.PlaneGeometry(L, w), new THREE.MeshStandardMaterial({ color, roughness: 1 }))
  m.rotation.set(-Math.PI / 2, 0, Math.atan2(-dz, dx))
  m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2)
  m.receiveShadow = true
  parent.add(m)
}
function disc(parent, x, z, r, color, y) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 40), new THREE.MeshStandardMaterial({ color, roughness: 1 }))
  m.rotation.x = -Math.PI / 2
  m.position.set(x, y, z)
  m.receiveShadow = true
  parent.add(m)
}

function axesTexture(th, ch) {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const x = c.getContext('2d')
  const hex = (n) => '#' + n.toString(16).padStart(6, '0')
  x.fillStyle = hex(th.path)
  x.beginPath(); x.arc(256, 256, 256, 0, TAU); x.fill()
  x.strokeStyle = hex(th.pathEdge); x.lineWidth = 10
  x.beginPath(); x.arc(256, 256, 238, 0, TAU); x.stroke()
  x.strokeStyle = hex(ch.color); x.lineWidth = 9; x.lineCap = 'round'
  x.beginPath(); x.moveTo(40, 256); x.lineTo(472, 256); x.moveTo(256, 40); x.lineTo(256, 472); x.stroke()
  x.lineWidth = 7
  x.beginPath(); x.moveTo(472, 256); x.lineTo(448, 242); x.moveTo(472, 256); x.lineTo(448, 270)
  x.moveTo(256, 40); x.lineTo(242, 64); x.moveTo(256, 40); x.lineTo(270, 64); x.stroke()
  x.lineWidth = 5
  for (let i = -3; i <= 3; i++) {
    if (!i) continue
    x.beginPath(); x.moveTo(256 + i * 58, 246); x.lineTo(256 + i * 58, 266); x.moveTo(246, 256 + i * 58); x.lineTo(266, 256 + i * 58); x.stroke()
  }
  x.fillStyle = hex(ch.color); x.font = '800 34px Arial'; x.textAlign = 'center'
  x.fillText('x', 462, 296); x.fillText('y', 292, 58)
  return canvasTexture(c)
}

function buildPaths(g, th, ch) {
  for (const [x1, z1, x2, z2, w] of PATH_SEGS) strip(g, x1, z1, x2, z2, w + 0.3, th.pathEdge, 1.05)
  for (const [cx, cz, r] of PLAZAS) disc(g, cx, cz, r + 0.15, th.pathEdge, 1.05)
  for (const [x1, z1, x2, z2, w] of PATH_SEGS) strip(g, x1, z1, x2, z2, w, th.path, 1.056)
  for (const [cx, cz, r] of PLAZAS) disc(g, cx, cz, r, th.path, 1.056)
  const ax = new THREE.Mesh(new THREE.CircleGeometry(2.45, 48), new THREE.MeshStandardMaterial({ map: axesTexture(th, ch), roughness: 1, transparent: true }))
  ax.rotation.x = -Math.PI / 2
  ax.position.y = 1.062
  ax.receiveShadow = true
  g.add(ax)
  // pequena plaza de pedra na ilha do portal
  disc(g, 18.4, 0, 3.15, th.pathEdge, 1.05)
  disc(g, 18.4, 0, 3.0, th.path, 1.056)
}

// ================================================================= PEÇAS DO CENÁRIO
function makeCtx(g, anim, colliders, th, ch) { return { g, anim, colliders, th, ch } }

function roundTree(c, x, z, s = 1, colA = 0x58b98c, colB = 0x8add9f) {
  const t = new THREE.Group()
  t.position.set(x, G, z)
  c.g.add(t)
  addMesh(t, new THREE.CylinderGeometry(0.15 * s, 0.25 * s, 1.2 * s, 8), mat(c.th.wood), 0, 0.6 * s, 0)
  addMesh(t, new THREE.IcosahedronGeometry(0.95 * s, 1), mat(colA, { flatShading: true }), 0, 1.65 * s, 0)
  addMesh(t, new THREE.IcosahedronGeometry(0.66 * s, 1), mat(colB, { flatShading: true }), -0.3 * s, 2.05 * s, 0.08 * s)
  addMesh(t, new THREE.IcosahedronGeometry(0.5 * s, 1), mat(colA, { flatShading: true }), 0.55 * s, 1.35 * s, 0.3 * s)
  c.colliders.push({ x, z, r: 0.45 * s + 0.1 })
  c.anim.push((tm) => { t.rotation.z = Math.sin(tm * 0.9 + x) * 0.012 })
}
function pine(c, x, z, s = 1, col = 0x3c977d, col2 = 0x6ac0a0) {
  const t = new THREE.Group()
  t.position.set(x, G, z)
  c.g.add(t)
  addMesh(t, new THREE.CylinderGeometry(0.1 * s, 0.17 * s, 0.8 * s, 8), mat(c.th.wood), 0, 0.4 * s, 0)
  addMesh(t, new THREE.ConeGeometry(0.85 * s, 1.5 * s, 8), mat(col, { flatShading: true }), 0, 1.45 * s, 0)
  addMesh(t, new THREE.ConeGeometry(0.64 * s, 1.2 * s, 8), mat(col2, { flatShading: true }), 0, 2.2 * s, 0)
  addMesh(t, new THREE.ConeGeometry(0.42 * s, 0.95 * s, 8), mat(col, { flatShading: true }), 0, 2.85 * s, 0)
  c.colliders.push({ x, z, r: 0.4 * s + 0.1 })
  c.anim.push((tm) => { t.rotation.z = Math.sin(tm * 0.8 + z) * 0.01 })
}
function palm(c, x, z, s = 1, turn = 0) {
  const t = new THREE.Group()
  t.position.set(x, G, z)
  t.rotation.y = turn
  c.g.add(t)
  const pts = [[0, 0, 0], [0.15, 0.9, 0], [0.4, 1.8, 0], [0.8, 2.5, 0]].map((p) => new THREE.Vector3(p[0] * s, p[1] * s, p[2] * s))
  addMesh(t, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.14 * s, 8), mat(0x9a7150), 0, 0, 0)
  const crown = new THREE.Group()
  crown.position.copy(pts[3])
  t.add(crown)
  for (let i = 0; i < 7; i++) {
    const f = new THREE.Group()
    f.rotation.y = (i / 7) * TAU
    crown.add(f)
    const leaf = addMesh(f, new THREE.SphereGeometry(0.5 * s, 10, 6), mat(i % 2 ? 0x3fb27a : 0x58c98a, { flatShading: true }), 0.75 * s, 0.05 * s, 0)
    leaf.scale.set(1.5, 0.12, 0.5)
    leaf.rotation.z = -0.35
  }
  addMesh(crown, new THREE.SphereGeometry(0.12 * s, 8, 6), mat(0x6b4a2f), 0.12 * s, -0.12 * s, 0.1 * s)
  addMesh(crown, new THREE.SphereGeometry(0.12 * s, 8, 6), mat(0x6b4a2f), -0.1 * s, -0.1 * s, -0.1 * s)
  c.colliders.push({ x, z, r: 0.4 * s })
  c.anim.push((tm) => { crown.rotation.z = Math.sin(tm * 0.9 + x) * 0.04; crown.rotation.x = Math.cos(tm * 0.7 + z) * 0.03 })
}
function bush(c, x, z, s = 1, col = 0x4cbf7f) {
  const b = addMesh(c.g, new THREE.IcosahedronGeometry(0.55 * s, 1), mat(col, { flatShading: true }), x, G + 0.28 * s, z)
  b.scale.set(1.25, 0.8, 1)
}
function rock(c, x, z, s = 1, col = 0xb2b9af, solid = true) {
  const r = addMesh(c.g, new THREE.DodecahedronGeometry(0.5 * s, 0), mat(col, { flatShading: true }), x, G + 0.16 * s, z)
  r.scale.set(1.35, 0.62, 1.05)
  r.rotation.y = x * 3.1
  if (solid) c.colliders.push({ x, z, r: 0.55 * s })
}
function flowerPatch(c, x, z, colors) {
  const r = rng(Math.floor(x * 13 + z * 7 + 100))
  for (let i = 0; i < 7; i++) {
    const fx = x + (r() - 0.5) * 1.6, fz = z + (r() - 0.5) * 1.6
    addMesh(c.g, new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), mat(0x62a580), fx, G + 0.2, fz, false)
    addMesh(c.g, new THREE.IcosahedronGeometry(0.12, 0), mat(colors[i % colors.length]), fx, G + 0.46, fz, false)
  }
}
function lamp(c, x, z) {
  addMesh(c.g, new THREE.CylinderGeometry(0.05, 0.07, 1.3, 8), mat(c.th.wood), x, G + 0.65, z)
  const bulb = addMesh(c.g, new THREE.SphereGeometry(0.15, 12, 10), mat(0xffe9b0, { emissive: 0xffc866, emissiveIntensity: 1.8 }), x, G + 1.4, z, false)
  addMesh(c.g, new THREE.ConeGeometry(0.22, 0.2, 8), mat(c.th.wood), x, G + 1.62, z)
  c.colliders.push({ x, z, r: 0.2 })
  c.anim.push((tm) => { bulb.material.emissiveIntensity = 1.6 + Math.sin(tm * 2 + x) * 0.25 })
}
function crystals(c, x, z, s, colors) {
  const grp = new THREE.Group()
  grp.position.set(x, G, z)
  c.g.add(grp)
  const mats = []
  ;[[0, 0, 1.6, 0], [0.45, 0.2, 1.1, 0.3], [-0.4, 0.15, 1.25, -0.35], [0.1, -0.45, 0.9, 0.2], [-0.2, 0.5, 0.8, -0.2]].forEach(([dx, dz, h, tilt], i) => {
    const col = colors[i % colors.length]
    const m = mat(col, { emissive: col, emissiveIntensity: 0.55, roughness: 0.25, flatShading: true })
    mats.push(m)
    const cr = addMesh(grp, new THREE.ConeGeometry(0.22 * s, h * s, 5), m, dx * s, (h * s) / 2, dz * s)
    cr.rotation.z = tilt
  })
  c.colliders.push({ x, z, r: 0.7 * s })
  c.anim.push((tm) => { mats.forEach((m, i) => { m.emissiveIntensity = 0.5 + Math.sin(tm * 1.6 + x + i) * 0.2 }) })
}
function mushroom(c, x, z, s = 1) {
  addMesh(c.g, new THREE.CylinderGeometry(0.07 * s, 0.1 * s, 0.35 * s, 10), mat(0xf4efe0), x, G + 0.17 * s, z)
  addMesh(c.g, new THREE.SphereGeometry(0.28 * s, 14, 8, 0, TAU, 0, Math.PI / 2), mat(0x5ee3d6, { emissive: 0x2fc6c0, emissiveIntensity: 0.7 }), x, G + 0.34 * s, z, false)
}
function cairn(c, x, z) {
  ;[0.34, 0.26, 0.18].forEach((r, i) => {
    const s = addMesh(c.g, new THREE.DodecahedronGeometry(r, 0), mat(0xc9c6b8, { flatShading: true }), x + i * 0.02, G + 0.12 + i * 0.3, z)
    s.scale.y = 0.7
  })
  c.colliders.push({ x, z, r: 0.4 })
}
function pillarBlock(c, x, z, h, w = 0.7, col = null) {
  addMesh(c.g, rbox(w, h, w, 0.12), mat(col ?? c.th.stone, { roughness: 0.7 }), x, G + h / 2, z)
  c.colliders.push({ x, z, r: w * 0.8 })
}

// ================================================================= MARCOS DE CADA REGIÃO (atrás dos pilares)
function landmark(c, index) {
  const z = -9.1
  if (index === 0) {
    // portal inclinado: a reta que sobe sempre o mesmo tanto
    pillarBlock(c, -3.2, z, 2.0, 0.75)
    pillarBlock(c, 3.2, z, 4.2, 0.75)
    const L = Math.hypot(6.4, 2.2)
    const beam = addMesh(c.g, rbox(L, 0.36, 0.55, 0.1), mat(0xd9a441, { roughness: 0.5 }), 0, G + 3.2 + 0.3, z)
    beam.rotation.z = Math.atan2(2.2, 6.4)
    for (let i = 0; i < 6; i++) {
      const bx = -3.2 + (6.4 * (i + 0.5)) / 6
      addMesh(c.g, new THREE.SphereGeometry(0.1, 8, 6), mat(c.ch.color, { emissive: c.ch.color, emissiveIntensity: 0.9 }), bx, G + 2.0 + (2.2 * (i + 0.5)) / 6 + 0.62, z + 0.3, false)
    }
  } else if (index === 1) {
    // arco em forma de parábola
    const pts = []
    for (let i = 0; i <= 24; i++) {
      const x = -3.4 + (6.8 * i) / 24
      pts.push(new THREE.Vector3(x, 0.1 + 4.2 * (1 - Math.pow(x / 3.4, 2)), 0))
    }
    const arch = addMesh(c.g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.34, 10), mat(c.th.stone, { roughness: 0.7 }), 0, G, z)
    arch.scale.set(1, 1, 1)
    for (const sx of [-3.4, 3.4]) {
      addMesh(c.g, new THREE.CylinderGeometry(0.55, 0.65, 0.35, 10), mat(c.th.stoneDark), sx, G + 0.17, z)
      c.colliders.push({ x: sx, z, r: 0.65 })
    }
    addMesh(c.g, new THREE.OctahedronGeometry(0.3), mat(0xffd447, { emissive: 0xffb62e, emissiveIntensity: 0.9 }), 0, G + 4.75, z, false)
  } else {
    // escultura em forma de raiz quadrada, nascendo de cristais
    const pts = []
    for (let i = 0; i <= 28; i++) {
      const t = i / 28
      pts.push(new THREE.Vector3(-3.6 + 7.2 * t, 0.2 + 3.4 * Math.sqrt(t), 0))
    }
    const m = mat(0x9d8cf0, { emissive: 0x6b57d8, emissiveIntensity: 0.55, roughness: 0.3 })
    addMesh(c.g, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 56, 0.28, 10), m, 0, G, z)
    crystals(c, -3.8, z + 0.2, 1.2, [0x8f8dde, 0x5fd8e8])
    pillarBlock(c, 3.7, z, 3.1, 0.55, 0x8d7fc4)
    c.anim.push((tm) => { m.emissiveIntensity = 0.5 + Math.sin(tm * 1.4) * 0.15 })
  }
}

// ================================================================= DECORAÇÃO POR REGIÃO
function decorate(c, index, g) {
  const th = c.th
  landmark(c, index)
  lamp(c, -1.9, 4.8); lamp(c, 1.9, 4.8)
  if (index === 0) {
    ;[[-8.8, -5.2, 1.15, 0.5], [-9.1, 2.8, 1.0, 2.2], [-5.6, 7.9, 1.1, 4], [8.6, -5.4, 1.2, 1], [9.8, -2.4, 0.95, 3], [7.9, 6.2, 1.05, 5]]
      .forEach(([x, z, s, t]) => palm(c, x, z, s, t))
    ;[[-7.6, 4.6, 1], [3.8, 8.4, 0.9], [-9.6, -1.6, 0.8], [5.2, -8.4, 0.85]].forEach(([x, z, s]) => bush(c, x, z, s))
    ;[[-8.4, 6.2, 0.9], [9.4, 3.6, 0.8], [-3.6, -9.0, 0.7]].forEach(([x, z, s]) => rock(c, x, z, s))
    flowerPatch(c, -8.0, -3.2, [0xfcaeae, 0xffffff, 0xffd991])
    flowerPatch(c, 7.8, -7.0, [0xffffff, 0xe3b7ff, 0xffd991])
    flowerPatch(c, -2.8, 8.6, [0xfcaeae, 0xffd991])
  } else if (index === 1) {
    ;[[-8.8, -5.2, 1.1], [-7.6, 4.6, 1.2], [8.6, -5.4, 1.05], [7.9, 6.2, 1.15], [-3.6, -9.4, 0.9]].forEach(([x, z, s]) => pine(c, x, z, s, 0x4f9a68, 0x74b983))
    ;[[-9.1, 2.8, 1.0], [9.8, -2.4, 1.1], [-5.6, 7.9, 0.95]].forEach(([x, z, s]) => roundTree(c, x, z, s, 0xe8873a, 0xf6b24f))
    ;[[-9.6, -1.6, 1.1], [3.8, 8.4, 0.9], [9.4, 3.6, 1.0], [5.2, -8.6, 1.2], [-8.0, 7.0, 0.8]].forEach(([x, z, s]) => rock(c, x, z, s, 0xcbb79b))
    cairn(c, -7.4, -2.8); cairn(c, 7.6, -3.2)
    flowerPatch(c, -8.2, -7.0, [0xffd447, 0xffffff, 0xffb27a])
    flowerPatch(c, 3.2, 8.8, [0xffd447, 0xffb27a])
  } else {
    ;[[-8.8, -5.2, 1.3], [-9.1, 2.8, 1.0], [8.6, -5.4, 1.2], [9.8, -2.4, 0.9], [7.9, 6.2, 1.1], [-5.6, 7.9, 1.0]]
      .forEach(([x, z, s], i) => crystals(c, x, z, s, i % 2 ? [0x5fd8e8, 0x8f8dde] : [0x8f8dde, 0xc08df0, 0x5fd8e8]))
    ;[[-7.6, 4.6, 1.1], [3.8, 8.4, 0.9], [-9.6, -1.6, 0.8], [9.4, 3.6, 1.0], [5.2, -8.4, 0.9], [-3.4, -9.2, 1.1]].forEach(([x, z, s]) => mushroom(c, x, z, s))
    ;[[-8.4, 6.2, 0.9], [-8.0, -7.2, 0.8]].forEach(([x, z, s]) => rock(c, x, z, s, 0x9a90c0))
  }
  // grama (instanciada: leve para o computador)
  const geo = new THREE.ConeGeometry(0.09, 0.45, 4)
  geo.translate(0, 0.225, 0)
  const COUNT = index === 2 ? 260 : 420
  const tufts = new THREE.InstancedMesh(geo, mat(0xffffff, { roughness: 1 }), COUNT)
  const d = new THREE.Object3D()
  const col = new THREE.Color()
  const r = rng(40 + index)
  let n = 0, guard = 0
  while (n < COUNT && guard++ < 6000) {
    const a = r() * TAU, rad = Math.sqrt(r()) * 9.3
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad
    if (!spotFree(x, z, 0.2)) continue
    d.position.set(x, G, z)
    d.rotation.set((r() - 0.5) * 0.3, r() * TAU, (r() - 0.5) * 0.3)
    d.scale.setScalar(0.6 + r() * 1.1)
    d.updateMatrix()
    tufts.setMatrixAt(n, d.matrix)
    tufts.setColorAt(n, col.set(th.tufts[n % 4]))
    n++
  }
  tufts.count = n
  tufts.receiveShadow = true
  g.add(tufts)
}

// ilhas distantes
function farIslands(g, index, ch, th) {
  FAR.forEach(([x, z, r], i) => {
    const isl = makeIsland(g, x, z, r, ch, th, { cast: false, lawn: false })
    const s = seedOf(x, z)
    const rr = rng(Math.floor(Math.abs(x * 3 + z)) + index)
    const sub = (fn) => { const grp = new THREE.Group(); isl.add(grp); fn(grp) }
    if (index === 0) {
      sub((p) => {
        const c = makeCtx(p, [], [], th, ch)
        c.g = p
        for (let k = 0; k < 2 + (r > 5 ? 1 : 0); k++) {
          const a = rr() * TAU, rad = rr() * r * 0.5
          palm({ ...c, g: p, colliders: [], anim: [] }, Math.cos(a) * rad, Math.sin(a) * rad, 0.8 + rr() * 0.3, rr() * 6)
        }
      })
      if (i === 2) {
        const tower = new THREE.Group()
        tower.position.set(x + 1.2, G, z - 0.6)
        g.add(tower)
        for (let k = 0; k < 4; k++) addMesh(tower, new THREE.CylinderGeometry(0.62 - k * 0.07, 0.7 - k * 0.07, 0.9, 14), mat(k % 2 ? 0xffffff : 0xff5a4f), 0, 0.45 + k * 0.9, 0, false)
        addMesh(tower, new THREE.SphereGeometry(0.42, 12, 10), mat(0xffe9a0, { emissive: 0xffd447, emissiveIntensity: 1 }), 0, 4.0, 0, false)
        addMesh(tower, new THREE.ConeGeometry(0.55, 0.5, 14), mat(0x3b4a56), 0, 4.45, 0, false)
      }
    } else if (index === 1) {
      sub((p) => {
        if (i % 2 === 0) {
          const h = 4 + r * 0.7
          addMesh(p, new THREE.ConeGeometry(r * 0.5, h, 7), mat(0xb98f6c, { flatShading: true }), 0, G + h / 2, 0, false)
          addMesh(p, new THREE.ConeGeometry(r * 0.2, h * 0.22, 7), mat(0xffffff, { flatShading: true }), 0, G + h * 0.89, 0, false)
        } else {
          const c = makeCtx(p, [], [], th, ch)
          pine({ ...c, g: p, colliders: [], anim: [] }, rr() * 2 - 1, rr() * 2 - 1, 0.9, 0x4f9a68, 0x74b983)
          pine({ ...c, g: p, colliders: [], anim: [] }, rr() * 2 - 1, rr() * 2 - 1, 0.7, 0x4f9a68, 0x74b983)
        }
      })
    } else {
      sub((p) => {
        const c = makeCtx(p, [], [], th, ch)
        for (let k = 0; k < 2; k++) crystals({ ...c, g: p, colliders: [], anim: [] }, rr() * r * 0.6 - r * 0.3, rr() * r * 0.6 - r * 0.3, 1.4 + rr(), k ? [0x5fd8e8, 0x8f8dde] : [0xc08df0, 0x8f8dde])
      })
    }
    void s
  })
}

// ================================================================= ESTAÇÕES
function screenCanvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { c, ctx: c.getContext('2d'), tex: canvasTexture(c) }
}

function createMachine(c, x, z, title) {
  const { g: parent, ch, th } = c
  const g = new THREE.Group()
  g.position.set(x, G, z)
  parent.add(g)
  const base = addMesh(g, new THREE.CylinderGeometry(1.35, 1.5, 0.22, 36), mat(0xe8e3d2), 0, 0.11, 0)
  outline(base, 0.03)
  const ring = addMesh(g, new THREE.TorusGeometry(1.2, 0.045, 8, 48), mat(ch.color, { emissive: ch.color, emissiveIntensity: 0.9 }), 0, 0.24, 0, false)
  ring.rotation.x = Math.PI / 2
  const body = addMesh(g, rbox(1.7, 1.3, 1.15, 0.22, 4), mat(th.machine, { roughness: 0.45 }), 0, 0.87, 0)
  outline(body, 0.03)
  const frame = addMesh(g, rbox(1.2, 0.78, 0.12, 0.1), mat(0x0f3f47), 0, 1.0, 0.55)
  outline(frame, 0.02)
  const scr = screenCanvas(320, 190)
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.04, 0.62), new THREE.MeshBasicMaterial({ map: scr.tex }))
  screen.position.set(0, 1.0, 0.62)
  g.add(screen)
  const funnel = addMesh(g, new THREE.CylinderGeometry(0.55, 0.22, 0.5, 24, 1, true), mat(0xd9a441, { roughness: 0.4, metalness: 0.2, side: THREE.DoubleSide }), -0.4, 1.77, 0)
  void funnel
  const pipe = addMesh(g, new THREE.CylinderGeometry(0.14, 0.14, 0.5, 14), mat(0xd9a441, { roughness: 0.4 }), 1.0, 0.95, 0)
  pipe.rotation.z = Math.PI / 2
  const out = addMesh(g, new THREE.SphereGeometry(0.12, 12, 10), mat(ch.color, { emissive: ch.color, emissiveIntensity: 1 }), 1.3, 0.95, 0, false)
  const gearGeo = (r, teeth) => {
    const s = new THREE.Shape()
    const n = teeth * 4
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU, k = i % 4 < 2 ? 1.2 : 1
      const px = Math.cos(a) * r * k, py = Math.sin(a) * r * k
      if (i) s.lineTo(px, py)
      else s.moveTo(px, py)
    }
    s.closePath()
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false })
    geo.translate(0, 0, -0.04)
    return geo
  }
  const gearA = addMesh(g, gearGeo(0.24, 8), mat(0xe0b04a, { roughness: 0.35, metalness: 0.3 }), -0.5, 0.42, 0.62)
  const gearB = addMesh(g, gearGeo(0.16, 6), mat(0xf0c868, { roughness: 0.35, metalness: 0.3 }), -0.14, 0.38, 0.62)
  addMesh(g, new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8), mat(0x394b52), 0.6, 1.8, -0.2)
  const lampMat = mat(ch.color, { emissive: ch.color, emissiveIntensity: 1 })
  addMesh(g, new THREE.SphereGeometry(0.13, 14, 12), lampMat, 0.6, 2.12, -0.2, false)
  label3d(g, title, 0, 2.75, 0, 2.55, 0.7)

  let discovered = false
  function draw() {
    const { ctx } = scr
    ctx.fillStyle = '#12525b'
    ctx.fillRect(0, 0, 320, 190)
    ctx.fillStyle = discovered ? '#ffe27a' : '#bdfbe0'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '900 130px Arial'
    ctx.fillText(discovered ? '✓' : '?', 160, 100)
    scr.tex.needsUpdate = true
  }
  draw()
  c.colliders.push({ x, z, r: 1.15 })
  c.anim.push((t, dt) => {
    gearA.rotation.z += dt * 0.9
    gearB.rotation.z -= dt * 1.4
    lampMat.emissiveIntensity = 0.9 + Math.sin(t * 3) * 0.35
    out.scale.setScalar(1 + Math.sin(t * 4) * 0.12)
    screen.scale.setScalar(1 + (discovered ? 0 : Math.sin(t * 2.4) * 0.015))
  })
  return {
    group: g,
    setDiscovered(v) {
      if (v === discovered) return
      discovered = v
      lampMat.color.set(v ? 0xffe27a : ch.color)
      lampMat.emissive.set(v ? 0xffc43a : ch.color)
      draw()
    }
  }
}

function createTerminal(c, x, z, title) {
  const { g: parent, ch, th } = c
  const g = new THREE.Group()
  g.position.set(x, G, z)
  parent.add(g)
  const base = addMesh(g, new THREE.CylinderGeometry(1.05, 1.15, 0.22, 32), mat(0xe8e3d2), 0, 0.11, 0)
  outline(base, 0.03)
  const ring = addMesh(g, new THREE.TorusGeometry(0.92, 0.04, 8, 40), mat(ch.color, { emissive: ch.color, emissiveIntensity: 0.9 }), 0, 0.24, 0, false)
  ring.rotation.x = Math.PI / 2
  const ped = addMesh(g, rbox(0.7, 1.0, 0.6, 0.15), mat(th.stoneDark, { roughness: 0.6 }), 0, 0.72, 0)
  outline(ped, 0.025)
  const head = new THREE.Group()
  head.position.set(0, 1.45, 0.05)
  head.rotation.x = -0.4
  g.add(head)
  const hb = addMesh(head, rbox(1.3, 0.8, 0.16, 0.08), mat(0x177f88), 0, 0, 0)
  outline(hb, 0.025)
  const scr = screenCanvas(320, 190)
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.14, 0.64), new THREE.MeshBasicMaterial({ map: scr.tex }))
  screen.position.set(0, 0, 0.09)
  head.add(screen)
  const holo = addMesh(g, new THREE.TorusGeometry(0.5, 0.03, 8, 40), mat(ch.color, { emissive: ch.color, emissiveIntensity: 1.2, transparent: true, opacity: 0.7 }), 0, 2.35, 0, false)
  holo.rotation.x = Math.PI / 2
  label3d(g, title, 0, 2.95, 0, 1.9, 0.7)

  let built = -1
  function draw() {
    const { ctx } = scr
    ctx.fillStyle = '#12525b'
    ctx.fillRect(0, 0, 320, 190)
    for (let i = 0; i < 3; i++) {
      roundRectPath(ctx, 28 + i * 94, 86, 84, 40, 12)
      ctx.fillStyle = i < built ? '#38f2c0' : '#2c6d75'
      ctx.fill()
    }
    ctx.strokeStyle = '#bdfbe0'
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.beginPath(); ctx.moveTo(30, 50); ctx.lineTo(280, 50); ctx.moveTo(258, 32); ctx.lineTo(284, 50); ctx.lineTo(258, 68); ctx.stroke()
    scr.tex.needsUpdate = true
  }
  draw()
  c.colliders.push({ x, z, r: 0.8 })
  c.anim.push((t) => { holo.position.y = 2.35 + Math.sin(t * 2) * 0.08; holo.rotation.z = t })
  return {
    group: g,
    setProgress(n) { if (n !== built) { built = n; draw() } }
  }
}

// ================================================================= PORTAL
function createPortal(c) {
  const { g: parent, ch, th } = c
  const g = new THREE.Group()
  g.position.set(18.4, G, 0)
  parent.add(g)
  addMesh(g, new THREE.CylinderGeometry(2.35, 2.5, 0.28, 40), mat(th.stone), 0, 0.14, 0)
  addMesh(g, new THREE.CylinderGeometry(1.95, 2.1, 0.2, 36), mat(th.stoneDark), 0, 0.38, 0)
  const shardMat = mat(ch.color, { emissive: ch.color, emissiveIntensity: 1.1 })
  const crystalsTop = []
  for (const sx of [-1.95, 1.95]) {
    const p = addMesh(g, rbox(0.5, 3.4, 0.5, 0.12), mat(th.stone, { roughness: 0.7 }), sx, 2.2, 0)
    outline(p, 0.025)
    const cr = addMesh(g, new THREE.OctahedronGeometry(0.28), shardMat, sx, 4.35, 0, false)
    cr.scale.y = 1.5
    crystalsTop.push(cr)
  }
  const portal = new THREE.Mesh(new THREE.TorusGeometry(1.38, 0.19, 12, 64), mat(0x789f9d, { metalness: 0.1, emissive: 0x235357, emissiveIntensity: 0.18 }))
  portal.position.set(0, 2.28, 0)
  portal.castShadow = true
  g.add(portal)
  outline(portal, 0.025)
  const surface = new THREE.Mesh(new THREE.CircleGeometry(1.25, 50), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { t: { value: 0 }, power: { value: 0 }, tint: { value: rgb(ch.color) } },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float t; uniform float power; uniform vec3 tint; varying vec2 vUv;
      void main() {
        vec2 p = vUv * 2.0 - 1.0;
        float r = length(p);
        float a = atan(p.y, p.x);
        float sw = sin(a * 4.0 + r * 9.0 - t * 2.2) * 0.5 + 0.5;
        float rings = sin(r * 18.0 - t * 3.0) * 0.5 + 0.5;
        vec3 live = mix(tint, vec3(0.85, 1.0, 1.0), sw * 0.6 + rings * 0.3);
        vec3 dormant = vec3(0.35, 0.5, 0.52);
        float aLive = smoothstep(1.0, 0.82, r) * (0.5 + 0.3 * sw) + smoothstep(0.35, 0.0, r) * 0.35;
        float aDormant = smoothstep(1.0, 0.85, r) * 0.12;
        gl_FragColor = vec4(mix(dormant, live, power), mix(aDormant, aLive, power));
      }`
  }))
  surface.position.set(0, 2.28, -0.05)
  g.add(surface)
  const light = new THREE.PointLight(ch.color, 2, 8)
  light.position.set(0, 2.28, 0.5)
  g.add(light)
  const runes = new THREE.Group()
  runes.position.set(0, 2.28, 0)
  g.add(runes)
  const runeMat = mat(0xbafcff, { emissive: 0x4fe3f3, emissiveIntensity: 1.4 })
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU
    const b = addMesh(runes, rbox(0.14, 0.14, 0.08, 0.03), runeMat, Math.cos(a) * 1.78, Math.sin(a) * 1.78, 0, false)
    b.rotation.z = a
  }
  const sparkGeo = new THREE.BufferGeometry()
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(40 * 3), 3))
  const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xbafcff, size: 0.2, map: dot, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }))
  sparks.frustumCulled = false
  g.add(sparks)
  const r = rng(77)
  const sd = Array.from({ length: 40 }, () => ({ x: (r() - 0.5) * 3, z: (r() - 0.5) * 0.8, sp: 0.25 + r() * 0.3, off: r() * 3 }))
  label3d(g, 'PORTAL', 0, 5.1, 0, 2.2, 0.62)

  let target = 0, power = 0
  const dormantCol = new THREE.Color(0x789f9d), liveCol = new THREE.Color(0x29ded5)
  const dormantEm = new THREE.Color(0x235357), liveEm = new THREE.Color(ch.color)
  c.anim.push((t, dt) => {
    power += (target - power) * Math.min(1, dt * 2.2)
    surface.material.uniforms.t.value = t
    surface.material.uniforms.power.value = power
    portal.rotation.z = Math.sin(t * 0.7) * 0.025
    runes.rotation.z = -t * (0.15 + power * 0.35)
    portal.material.color.copy(dormantCol).lerp(liveCol, power)
    portal.material.emissive.copy(dormantEm).lerp(liveEm, power)
    portal.material.emissiveIntensity = 0.18 + power * 1.4
    light.intensity = 2 + power * (10 + Math.sin(t * 3) * 2)
    shardMat.emissiveIntensity = 0.3 + power * 0.9
    crystalsTop.forEach((cr, i) => { cr.rotation.y = t * 0.8; cr.position.y = 4.35 + Math.sin(t * 1.5 + i * 2) * 0.1 })
    sparks.material.opacity = power * 0.9
    const p = sparkGeo.attributes.position.array
    sd.forEach((s, i) => {
      p[i * 3] = s.x + Math.sin(t + s.off) * 0.15
      p[i * 3 + 1] = 0.6 + ((t * s.sp + s.off) % 1) * 3.6
      p[i * 3 + 2] = s.z
    })
    sparkGeo.attributes.position.needsUpdate = true
  })
  return { group: g, setReady(v) { target = v ? 1 : 0 } }
}

// ================================================================= PONTE (3 plataformas)
function createBridge(c, index, shown) {
  const { g: parent, ch, th } = c
  const segs = []
  for (let i = 0; i < 3; i++) {
    const seg = new THREE.Group()
    seg.position.set(10.78 + i * 1.52, G, 0)
    parent.add(seg)
    const inner = new THREE.Group()
    seg.add(inner)
    if (index === 2) {
      addMesh(inner, rbox(1.58, 0.2, 1.8, 0.08), mat(0x9d8cf0, { emissive: 0x6b57d8, emissiveIntensity: 0.55, roughness: 0.3 }), 0, -0.07, 0)
      for (const zz of [-0.88, 0.88]) addMesh(inner, rbox(1.55, 0.1, 0.08, 0.03), mat(ch.color, { emissive: ch.color, emissiveIntensity: 1 }), 0, 0.06, zz, false)
    } else {
      addMesh(inner, rbox(1.58, 0.2, 1.8, 0.07), mat(index === 1 ? 0xd9b790 : 0xc5a779), 0, -0.07, 0)
      for (const zz of [-0.65, -0.2, 0.25, 0.7]) addMesh(inner, new THREE.BoxGeometry(1.48, 0.02, 0.07), mat(index === 1 ? 0xefd9b5 : 0xf5dfae), 0, 0.035, zz, false)
      for (const zz of [-0.88, 0.88]) addMesh(inner, rbox(1.55, 0.12, 0.08, 0.03), mat(ch.color), 0, 0.1, zz)
      for (const zz of [-0.88, 0.88]) addMesh(inner, new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), mat(th.wood), 0.7, 0.2, zz)
    }
    seg.userData.f = i < shown ? 1 : 0
    seg.userData.target = seg.userData.f
    seg.visible = seg.userData.f > 0
    segs.push(seg)
  }
  return segs
}
const easeOutBack = (t) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2)

// ================================================================= PILARES DOS TESTES
function valueSprite() {
  const c = document.createElement('canvas')
  c.width = 192
  c.height = 96
  const ctx = c.getContext('2d')
  const tex = canvasTexture(c)
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }))
  sprite.scale.set(1.2, 0.6, 1)
  let last = null
  function draw(text) {
    if (text === last) return
    last = text
    ctx.clearRect(0, 0, 192, 96)
    roundRectPath(ctx, 8, 10, 176, 76, 26)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    ctx.lineWidth = 8
    ctx.strokeStyle = '#12303c'
    ctx.stroke()
    ctx.fillStyle = '#12303c'
    ctx.font = '800 50px Arial'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 96, 50)
    tex.needsUpdate = true
  }
  return { sprite, draw }
}
const valueText = (v) => (v === null ? '✕' : Number.isInteger(v) ? String(v) : v.toFixed(2).replace('.', ','))

function createBars(c, index) {
  const { g: parent, ch, th } = c
  const bars = []
  const sx = ch.samples.length
  const width = sx === 7 ? 1.78 : 2.07
  const start = -((sx - 1) * width) / 2
  const seg = [24, 6, 5][index]
  ch.samples.forEach((x, i) => {
    const b = new THREE.Group()
    b.position.set(start + i * width, G, -5.3)
    parent.add(b)
    addMesh(b, new THREE.CylinderGeometry(0.52, 0.62, 0.2, 24), mat(th.stoneDark), 0, 0.1, 0)
    const rim = addMesh(b, new THREE.TorusGeometry(0.5, 0.03, 8, 32), mat(ch.color, { emissive: ch.color, emissiveIntensity: 0.7 }), 0, 0.21, 0, false)
    rim.rotation.x = Math.PI / 2
    const block = addMesh(b, new THREE.CylinderGeometry(0.34, 0.4, 1, seg), mat(ch.color, { emissive: ch.color, emissiveIntensity: 0.08, roughness: 0.35, flatShading: index > 0 }), 0, 0.75, 0)
    block.visible = false
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.32), new THREE.MeshBasicMaterial({
      map: drawText(`x = ${x}`, { width: 320, height: 100, size: 50, background: '#fffef6', border: '#12303c' }), transparent: true
    }))
    tag.position.set(0, 0.62, 0.55)
    b.add(tag)
    const val = valueSprite()
    val.sprite.visible = false
    b.add(val.sprite)
    bars.push({
      x, block, tag, group: b, target: 0, height: 0, val,
      setValue(v) {
        if (v === undefined) { val.sprite.visible = false; return }
        val.draw(valueText(v))
        val.sprite.visible = true
      }
    })
  })
  return bars
}

// ================================================================= SETA DO OBJETIVO
export function createMarker(scene) {
  const g = new THREE.Group()
  scene.add(g)
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.6, 4), new THREE.MeshBasicMaterial({ color: 0xffd447 }))
  arrow.rotation.x = Math.PI
  g.add(arrow)
  outline(arrow, 0.04)
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 28), new THREE.MeshBasicMaterial({ color: 0xffd447 }))
  halo.rotation.x = Math.PI / 2
  halo.position.y = 0.55
  g.add(halo)
  let baseY = 3
  g.visible = false
  return {
    group: g,
    setTarget(x, y, z) { g.position.set(x, 0, z); baseY = y },
    update(t) {
      arrow.position.y = baseY + Math.sin(t * 3) * 0.15
      halo.position.y = baseY + 0.55 + Math.sin(t * 3) * 0.15
      arrow.rotation.y = t * 2
      halo.scale.setScalar(1 + Math.sin(t * 3) * 0.08)
    }
  }
}

// ================================================================= MONTAGEM DE UMA ILHA (capítulo)
export function buildChapterWorld(index, ch, bridgeShown = 0) {
  const th = THEMES[index]
  const group = new THREE.Group()
  const anim = []
  const colliders = []
  group.userData.colliders = colliders
  const c = makeCtx(group, anim, colliders, th, ch)

  makeIsland(group, 0, 0, 11.5, ch, th)
  makeIsland(group, 18.4, 0, 4.55, ch, th)
  buildPaths(group, th, ch)
  decorate(c, index, group)
  farIslands(group, index, ch, th)
  roundTree(c, 19.6, 3.2, 0.85, 0x58b98c)
  pine(c, 20.6, -3.0, 0.8)

  const machine = createMachine(c, -4.5, -0.6, index === 0 ? 'MÁQUINA' : index === 1 ? 'CURVAS' : 'ENTRADAS')
  const terminal = createTerminal(c, 6.5, 0.3, 'PONTE')
  const bars = createBars(c, index)
  const bridge = createBridge(c, index, bridgeShown)
  const portal = createPortal(c)

  return {
    group, machine, terminal, bars, bridge, portal,
    update(t, dt, allowPop = true) {
      for (const fn of anim) fn(t, dt)
      for (const seg of bridge) {
        const u = seg.userData
        if (u.target === 1 && u.f < 1 && allowPop) u.f = Math.min(1, u.f + dt * 2.4)
        else if (u.target === 0) u.f = 0
        seg.visible = u.f > 0.001
        const e = Math.max(0.001, easeOutBack(u.f))
        seg.children[0].scale.setScalar(e)
        seg.children[0].position.y = (1 - u.f) * -0.5
      }
      for (const b of bars) b.val.sprite.position.y = 0.24 + b.height + 0.5
    }
  }
}
