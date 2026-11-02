// Utilidades compartilhadas pelo cenário (mundo.js) e pelo Matinho (matinho.js).
import * as THREE from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

export const G = 1.05 // altura do chão onde o Matinho pisa
export const TAU = Math.PI * 2

export function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra })
}

export function addMesh(parent, geo, paint, x = 0, y = 0, z = 0, cast = true) {
  const o = new THREE.Mesh(geo, paint)
  o.position.set(x, y, z)
  o.castShadow = cast
  o.receiveShadow = true
  parent.add(o)
  return o
}

// Cor "crua" (sRGB) para shaders próprios: sai na tela exatamente como o código hexadecimal.
export function rgb(hex) {
  const n = typeof hex === 'string' ? parseInt(hex.replace('#', ''), 16) : hex
  return new THREE.Vector3(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

// ---------------------------------------------------------------- contorno de desenho animado
// Uma "casca" preta ligeiramente maior, desenhada por trás, cria o traço grosso do Matinho 2D.
const INK = '#0b2530'
const outlineGeos = new WeakMap()
const outlineMats = new Map()

function outlineGeometry(geo) {
  let g = outlineGeos.get(geo)
  if (!g) {
    const c = geo.clone()
    c.deleteAttribute('uv')
    c.deleteAttribute('normal')
    g = mergeVertices(c)
    g.computeVertexNormals()
    outlineGeos.set(geo, g)
  }
  return g
}

function outlineMaterial(th) {
  const key = th.toFixed(4)
  let m = outlineMats.get(key)
  if (!m) {
    m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: { th: { value: th }, col: { value: rgb(INK) } },
      vertexShader: `
        uniform float th;
        void main() {
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position + normalize(normal) * th, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 col;
        void main() { gl_FragColor = vec4(col, 1.0); }`
    })
    outlineMats.set(key, m)
  }
  return m
}

export function outline(mesh, thickness = 0.02) {
  const o = new THREE.Mesh(outlineGeometry(mesh.geometry), outlineMaterial(thickness))
  o.name = 'outline'
  mesh.add(o)
  return mesh
}

export function outlineAll(root, thickness = 0.02) {
  const list = []
  root.traverse((o) => { if (o.isMesh && o.name !== 'outline' && !o.userData.noOutline) list.push(o) })
  list.forEach((o) => outline(o, thickness))
  return root
}

// ---------------------------------------------------------------- textos desenhados em canvas
export function canvasTexture(canvas) {
  const t = new THREE.CanvasTexture(canvas)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

export function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function drawText(str, { width = 512, height = 180, background = null, text = '#12303c', size = 56, sub = '', subSize = 0, border = null } = {}) {
  const c = document.createElement('canvas')
  c.width = width
  c.height = height
  const ctx = c.getContext('2d')
  if (background) {
    roundRectPath(ctx, 6, 6, width - 12, height - 12, Math.min(34, height * 0.28))
    ctx.fillStyle = background
    ctx.fill()
    if (border) { ctx.lineWidth = 8; ctx.strokeStyle = border; ctx.stroke() }
  }
  ctx.fillStyle = text
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `800 ${size}px Arial, sans-serif`
  ctx.fillText(str, width / 2, sub ? height * 0.4 : height * 0.52, width * 0.86)
  if (sub) {
    ctx.fillStyle = '#5a7a82'
    ctx.font = `700 ${subSize || 24}px Arial`
    ctx.fillText(sub, width / 2, height * 0.75, width * 0.9)
  }
  return canvasTexture(c)
}

export function label3d(parent, title, x, y, z, width = 2.5, height = 0.8, sub = '') {
  const p = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({
      map: drawText(title, { background: '#fffef6', border: '#12303c', sub, size: 64 }),
      side: THREE.DoubleSide, transparent: true
    })
  )
  p.position.set(x, y, z)
  parent.add(p)
  return p
}

// Libera a memória de uma cena que não será mais usada (troca de ilha).
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose()
    const m = o.material
    if (m && !m.isShaderMaterial) {
      for (const mm of [].concat(m)) {
        if (mm.map) mm.map.dispose()
        mm.dispose()
      }
    }
  })
}
