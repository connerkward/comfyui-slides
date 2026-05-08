import { defineAppSetup } from '@slidev/types'

declare global {
  interface Window { __threeMounted?: WeakSet<HTMLElement> }
}

const THREE_URL  = 'https://esm.sh/three@0.166.1'
const LOADER_URL = 'https://esm.sh/three@0.166.1/examples/jsm/loaders/GLTFLoader.js'

let threeLib: Promise<any> | null = null
function loadThree() {
  if (!threeLib) {
    threeLib = Promise.all([
      import(/* @vite-ignore */ THREE_URL),
      import(/* @vite-ignore */ LOADER_URL),
    ]).then(([THREE, m]) => ({ THREE, GLTFLoader: m.GLTFLoader }))
  }
  return threeLib
}

const glbCache = new Map<string, Promise<any>>()
function resolveAssetUrl(src: string): string {
  // Honor Vite/Slidev's base path so /police-car.glb resolves under /comfytwo/ on Pages.
  if (/^https?:\/\//i.test(src)) return src
  const base = (import.meta as any).env?.BASE_URL ?? '/'
  return base.replace(/\/$/, '') + (src.startsWith('/') ? src : '/' + src)
}
function loadWireGLB(THREE: any, GLTFLoader: any, src: string): Promise<any> {
  const url = resolveAssetUrl(src)
  if (!glbCache.has(url)) {
    glbCache.set(url, new Promise((resolve, reject) => {
      new GLTFLoader().load(url, (gltf: any) => {
        const group = new THREE.Group()
        const skip = /Lights|Siren|Plane/i
        gltf.scene.traverse((n: any) => {
          if (!n.isMesh) return
          if (skip.test(n.name)) return
          const wireGeo = new THREE.WireframeGeometry(n.geometry)
          const mat = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 1,
            depthTest: true,
          })
          const lines = new THREE.LineSegments(wireGeo, mat)
          n.updateWorldMatrix(true, false)
          lines.applyMatrix4(n.matrixWorld)
          group.add(lines)
        })
        // Recenter around bounding-box midpoint
        const box = new THREE.Box3().setFromObject(group)
        const c = new THREE.Vector3()
        box.getCenter(c)
        group.position.sub(c)
        resolve(group)
      }, undefined, reject)
    }))
  }
  return glbCache.get(url)!
}

type Vec3 = [number, number, number]
interface ModelCfg {
  src: string
  position?: Vec3
  rotation?: Vec3        // degrees
  scale?: number
  opacity?: number
}
interface CameraCfg {
  position: Vec3
  lookAt?: Vec3
  fov?: number
}
interface AnimateCfg {
  orbit?: { speed: number, amplitude: number }      // sway theta
  pitch?: { speed: number, amplitude: number }      // sway phi
  bob?:   { speed: number, amplitude: number }      // sway camera Y
  pulse?: { speed: number, amplitude: number }      // sway camera distance
}
interface SceneCfg {
  models: ModelCfg[]
  camera: CameraCfg
  animate?: AnimateCfg
}

// Named presets — driven from data-preset attribute in slides.md
const PRESETS: Record<string, SceneCfg> = {
  // ── Title alt: rotor hero — heli swooping in cinematically from upper-right
  title_heli: {
    models: [
      // Hero heli: large foreground, banking in
      { src: '/helicopter.glb', position: [3.0, 3.8, -1], rotation: [-4, -14, 18], scale: 1.25, opacity: 1.0 },
      // Wingman heli: smaller, far back-right
      { src: '/helicopter.glb', position: [6.0, 5.5, -14], rotation: [-2, -8, 12], scale: 0.7, opacity: 0.5 },
    ],
    camera: { position: [-3.5, 1.4, 9], lookAt: [3.5, 3.6, -5], fov: 44 },
    animate: { orbit: { speed: 0.40, amplitude: 0.06 }, bob: { speed: 0.50, amplitude: 0.32 }, pulse: { speed: 0.45, amplitude: 0.7 } },
  },

  // ── Title alt: FLEET — mixed asset hero (foreground car + distant car + heli)
  title_fleet: {
    models: [
      // Foreground car: large, right of frame
      { src: '/police-car.glb', position: [3.5, -0.4, 2], rotation: [0, -16, 3], scale: 1.0, opacity: 1.0 },
      // Distant car: small, deep right
      { src: '/police-car.glb', position: [8.0, 0.3, -22], rotation: [0, -8, 0], scale: 0.85, opacity: 0.40 },
      // Heli: upper-right, banking over the cars
      { src: '/helicopter.glb', position: [4.0, 5.5, -7], rotation: [-3, -10, 14], scale: 0.95, opacity: 0.92 },
    ],
    camera: { position: [-4, 2.2, 11], lookAt: [4.5, 1.4, -10], fov: 44 },
    animate: { orbit: { speed: 0.38, amplitude: 0.05 }, bob: { speed: 0.45, amplitude: 0.30 }, pulse: { speed: 0.40, amplitude: 0.6 } },
  },

  // ── RUN WILD: V-symmetric splay — helis top corners, cars bottom corners, tucked close to text without overlap
  run_wild: {
    models: [
      // Top helis — closer in, larger, blades carefully clear of center text
      { src: '/helicopter.glb', position: [-7.5, 6.0, -3], rotation: [-4, -44, -34], scale: 0.75, opacity: 0.9 },
      { src: '/helicopter.glb', position: [7.5, 6.0, -3],  rotation: [-4, 44, 34],   scale: 0.75, opacity: 0.9 },
      // Bottom cars — closer in, larger, hugging the title from below
      { src: '/police-car.glb', position: [-7.0, -1.6, 4], rotation: [0, -48, -4], scale: 0.82, opacity: 0.95 },
      { src: '/police-car.glb', position: [7.0, -1.6, 4],  rotation: [0, 48, 4],   scale: 0.82, opacity: 0.95 },
    ],
    camera: { position: [0, 2.4, 13], lookAt: [0, 2.4, -3], fov: 42 },
    animate: { orbit: { speed: 0.26, amplitude: 0.02 }, bob: { speed: 0.45, amplitude: 0.20 }, pulse: { speed: 0.35, amplitude: 0.4 } },
  },

  // ── Title pursuit ─ mixed asset hero (foreground car + distant car + heli), shared with title_fleet
  title: {
    models: [
      // Foreground car: large, right of frame
      { src: '/police-car.glb', position: [3.5, -0.4, 2], rotation: [0, -16, 3], scale: 1.0, opacity: 1.0 },
      // Distant car: small, deep right
      { src: '/police-car.glb', position: [8.0, 0.3, -22], rotation: [0, -8, 0], scale: 0.85, opacity: 0.40 },
      // Heli: upper-right, banking over the cars
      { src: '/helicopter.glb', position: [4.0, 5.5, -7], rotation: [-3, -10, 14], scale: 0.95, opacity: 0.92 },
    ],
    camera: { position: [-4, 2.2, 11], lookAt: [4.5, 1.4, -10], fov: 44 },
    animate: { orbit: { speed: 0.38, amplitude: 0.05 }, bob: { speed: 0.45, amplitude: 0.30 }, pulse: { speed: 0.40, amplitude: 0.6 } },
  },

  // ── Chap dividers — single car, varied poses ───────────────────────────
  // Mid-jump — nose pitched up, front-quarter view, biased right within own viewport, model fits without clipping
  chap_jump: {
    models: [{ src: '/police-car.glb', position: [1.0, 0, 0], rotation: [18, 0, 0], scale: 0.85, opacity: 0.95 }],
    camera: { position: [6, 2.5, 9], lookAt: [-1.5, 1.0, 0], fov: 38 },
    animate: { orbit: { speed: 0.50, amplitude: 0.10 }, bob: { speed: 0.70, amplitude: 0.18 } },
  },
  // Low pursuit — camera below, looking up at car, biased right
  chap_low: {
    models: [{ src: '/police-car.glb', position: [1.0, 0, 0], rotation: [0, 0, 0], scale: 0.85, opacity: 0.95 }],
    camera: { position: [6, -0.8, 9], lookAt: [-1.5, 2.0, 0], fov: 42 },
    animate: { orbit: { speed: 0.45, amplitude: 0.10 }, bob: { speed: 0.55, amplitude: 0.20 } },
  },
  // Drift — rear-side with body roll, biased right
  chap_drift: {
    models: [{ src: '/police-car.glb', position: [1.0, 0, 0], rotation: [0, 0, -10], scale: 0.85, opacity: 0.95 }],
    camera: { position: [-7, 1.5, -5], lookAt: [-1.5, 1.0, 0], fov: 40 },
    animate: { orbit: { speed: 0.50, amplitude: 0.12 }, bob: { speed: 0.40, amplitude: 0.18 } },
  },
  // Overhead — top-down recon, biased right
  chap_overhead: {
    models: [{ src: '/police-car.glb', position: [1.0, 0, 0], rotation: [0, 0, 0], scale: 0.85, opacity: 0.95 }],
    camera: { position: [3, 9, 6], lookAt: [-1.5, 0, 0], fov: 40 },
    animate: { orbit: { speed: 0.40, amplitude: 0.14 }, bob: { speed: 0.50, amplitude: 0.30 } },
  },

  // ── Chase Index frames ─────────────────────────────────────────────────
  // F-01 Car-on-car rear pursuit — lead car right-foreground, chaser receding upper-left, biased right
  cf_carcar: {
    models: [
      { src: '/police-car.glb', position: [-2.5, 0.6, -10], rotation: [0, -22, 0], scale: 0.85, opacity: 0.55 },
      { src: '/police-car.glb', position: [4.5, -0.2, 0],   rotation: [0, -8, 0],  scale: 0.9,  opacity: 1.0 },
    ],
    camera: { position: [10, 2.6, 13], lookAt: [-4.0, 1.0, -4], fov: 36 },
    animate: { orbit: { speed: 0.40, amplitude: 0.05 }, bob: { speed: 0.55, amplitude: 0.18 } },
  },
  // F-03 Heli strafe low altitude — heli swooping in from upper-right, car drifting low-right
  cf_heliattack: {
    models: [
      { src: '/police-car.glb', position: [3.0, -0.5, 1.5], rotation: [0, 8, -12], scale: 1.0, opacity: 0.85 },
      { src: '/helicopter.glb', position: [0, 3.8, -1],     rotation: [4, 8, 24],  scale: 1.5, opacity: 1.0 },
    ],
    camera: { position: [6, 2.0, 13], lookAt: [-2.0, 1.0, 0], fov: 38 },
    animate: { orbit: { speed: 0.45, amplitude: 0.06 }, bob: { speed: 0.50, amplitude: 0.18 } },
  },
  // F-04 Ramp Overwatch — car airborne off ramp, profile launch (nose up); heli watching from above
  cf_overwatch: {
    models: [
      // Airborne car: pure X-pitch +30deg gives nose-up. Camera on +X side gives profile view.
      { src: '/police-car.glb', position: [0, 2.0, -1], rotation: [30, 0, 0], scale: 0.85, opacity: 0.95 },
      // Heli watching from upper area, slight yaw so it doesn't read as straight-on
      { src: '/helicopter.glb', position: [0, 6.2, -7], rotation: [-3, 20, 16], scale: 0.85, opacity: 0.85 },
    ],
    camera: { position: [13, 1.6, 2], lookAt: [-2, 3.2, -1.5], fov: 40 },
    animate: { orbit: { speed: 0.40, amplitude: 0.06 }, bob: { speed: 0.50, amplitude: 0.20 } },
  },

  // F-05 Side-by-side parallel chase — both cars right of frame, lead in foreground
  cf_parallel: {
    models: [
      { src: '/police-car.glb', position: [-1.0, 0, -2],    rotation: [0, -2, 0], opacity: 0.78 },
      { src: '/police-car.glb', position: [3.0, -0.2, 1.0], rotation: [0, 4, -4], scale: 1.05, opacity: 1.0 },
    ],
    camera: { position: [3, 1.8, 13], lookAt: [-2.0, 0.8, -1], fov: 38 },
    animate: { orbit: { speed: 0.50, amplitude: 0.10 }, bob: { speed: 0.60, amplitude: 0.25 } },
  },

  // F-07 Tunnel low-angle — single car charging past camera, biased right
  cf_tunnel: {
    models: [
      { src: '/police-car.glb', position: [2.0, -0.6, 0], rotation: [0, -22, 0], scale: 1.05, opacity: 1.0 },
    ],
    camera: { position: [5, -0.5, 10], lookAt: [-1.5, 1.8, 0], fov: 46 },
    animate: { orbit: { speed: 0.55, amplitude: 0.12 }, bob: { speed: 0.70, amplitude: 0.22 } },
  },

  // ── Multi-vehicle compositions ─────────────────────────────────────────

  // Helicopter swarm — three rotorcraft in V formation, biased right
  cf_swarm: {
    models: [
      { src: '/helicopter.glb', position: [-1.5, 4.0, -2], rotation: [0, 4, 16], scale: 1.0,  opacity: 0.95 },
      { src: '/helicopter.glb', position: [4.5, 5.0, -3],  rotation: [0, -10, -14], scale: 1.0, opacity: 0.90 },
      { src: '/helicopter.glb', position: [2.0, 4.5, -10], rotation: [-3, -2, 6], scale: 0.75, opacity: 0.55 },
    ],
    camera: { position: [6, 2.4, 12], lookAt: [-2.0, 4.2, -4], fov: 40 },
    animate: { orbit: { speed: 0.40, amplitude: 0.08 }, bob: { speed: 0.55, amplitude: 0.40 }, pulse: { speed: 0.45, amplitude: 0.6 } },
  },

  // Pincer — two flankers converging on a target, target right of frame
  cf_pincer: {
    models: [
      { src: '/police-car.glb', position: [1.5, 0, 0],     rotation: [0, 0, 0],   scale: 0.95, opacity: 1.0 },
      { src: '/police-car.glb', position: [-2.5, 0, 4],    rotation: [0, 28, 0],  scale: 0.9,  opacity: 0.85 },
      { src: '/police-car.glb', position: [4.0, 0, 4],     rotation: [0, -28, 0], scale: 0.9,  opacity: 0.85 },
    ],
    camera: { position: [-0.5, 5.0, 16], lookAt: [-1.5, 0.5, 0], fov: 40 },
    animate: { orbit: { speed: 0.38, amplitude: 0.08 }, bob: { speed: 0.50, amplitude: 0.30 } },
  },

  // Dogfight — two helicopters dueling, lead heli right
  cf_dogfight: {
    models: [
      { src: '/helicopter.glb', position: [3.5, 4.0, 0],   rotation: [-4, 2, 8],   scale: 1.0,  opacity: 1.0 },
      { src: '/helicopter.glb', position: [-1.5, 5.2, -5], rotation: [-6, 16, 22], scale: 0.85, opacity: 0.85 },
    ],
    camera: { position: [6, 3.2, 9], lookAt: [-2.0, 4, -2], fov: 42 },
    animate: { orbit: { speed: 0.45, amplitude: 0.10 }, bob: { speed: 0.60, amplitude: 0.30 }, pulse: { speed: 0.45, amplitude: 0.7 } },
  },

  // Tandem ramp — pure side profile: foreground car nose-down cropping right edge, distant car nose-up upper-left
  cf_tandem: {
    models: [
      // Distant rising car: small, upper-left, climbing past the apex (nose-up)
      { src: '/police-car.glb', position: [-1, 3.2, 5],  rotation: [26, 0, 0], scale: 0.55, opacity: 0.5 },
      // Foreground descending car: big, body cropping off the right edge of frame (nose-down)
      { src: '/police-car.glb', position: [0, 2.2, -5],  rotation: [-26, 0, 0], scale: 1.0, opacity: 1.0 },
    ],
    // Pure side-on camera from +X axis — lookAt has same Y/Z as camera region for true profile
    camera: { position: [15, 1.0, 0], lookAt: [-2, 1.8, 0], fov: 32 },
    animate: { orbit: { speed: 0.36, amplitude: 0.03 }, bob: { speed: 0.50, amplitude: 0.18 } },
  },
}

function deg(THREE: any, n: number) { return THREE.MathUtils.degToRad(n) }

interface MountedScene {
  dispose: () => void
}

async function mountScene(el: HTMLElement, cfg: SceneCfg): Promise<MountedScene> {
  const { THREE, GLTFLoader } = await loadThree()
  const w = () => Math.max(el.clientWidth, 80)
  const h = () => Math.max(el.clientHeight, 60)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(cfg.camera.fov ?? 42, w() / h(), 0.1, 200)
  const [px, py, pz] = cfg.camera.position
  camera.position.set(px, py, pz)
  const lookAt = cfg.camera.lookAt ?? [0, 0, 0]

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
  renderer.setSize(w(), h())
  renderer.setClearColor(0x000000, 0)
  el.appendChild(renderer.domElement)
  Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' })

  const root = new THREE.Group()
  scene.add(root)

  let alive = true

  for (const m of cfg.models) {
    const proto = await loadWireGLB(THREE, GLTFLoader, m.src)
    if (!alive) break
    const inst = proto.clone(true)
    inst.traverse((c: any) => {
      if (c.material) {
        c.material = c.material.clone()
        c.material.opacity = m.opacity ?? 0.9
        c.material.transparent = true
      }
    })
    if (m.position) inst.position.set(m.position[0], m.position[1], m.position[2])
    if (m.rotation) inst.rotation.set(deg(THREE, m.rotation[0]), deg(THREE, m.rotation[1]), deg(THREE, m.rotation[2]))
    if (m.scale)    inst.scale.setScalar(m.scale)
    root.add(inst)
  }

  const dx = px - lookAt[0]
  const dz = pz - lookAt[2]
  const baseR = Math.sqrt(dx * dx + dz * dz)
  const baseTheta = Math.atan2(dx, dz)
  const orbit = cfg.animate?.orbit
  const bob = cfg.animate?.bob
  const pulse = cfg.animate?.pulse
  const pitchA = cfg.animate?.pitch

  let rafId = 0
  function frame() {
    if (!alive) return
    rafId = requestAnimationFrame(frame)
    const t = performance.now() * 0.001
    let theta = baseTheta
    let r = baseR
    let y = py
    if (orbit) theta += Math.sin(t * orbit.speed) * orbit.amplitude
    if (pulse) r += Math.sin(t * pulse.speed) * pulse.amplitude
    if (bob)   y += Math.sin(t * bob.speed)   * bob.amplitude
    let camY = y
    if (pitchA) camY += Math.sin(t * pitchA.speed) * pitchA.amplitude
    camera.position.x = lookAt[0] + Math.sin(theta) * r
    camera.position.z = lookAt[2] + Math.cos(theta) * r
    camera.position.y = camY
    camera.lookAt(lookAt[0], lookAt[1], lookAt[2])
    renderer.render(scene, camera)
  }
  frame()

  const ro = new ResizeObserver(() => {
    if (!alive) return
    camera.aspect = w() / h()
    camera.updateProjectionMatrix()
    renderer.setSize(w(), h())
  })
  ro.observe(el)

  return {
    dispose() {
      if (!alive) return
      alive = false
      cancelAnimationFrame(rafId)
      ro.disconnect()
      // Free GPU resources
      scene.traverse((o: any) => {
        if (o.geometry) o.geometry.dispose?.()
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose?.())
          else o.material.dispose?.()
        }
      })
      renderer.dispose()
      renderer.forceContextLoss?.()
      renderer.domElement.remove()
    },
  }
}

export default defineAppSetup(() => {
  if (typeof document === 'undefined') return

  // Backwards-compat: model-viewer fallback
  if (!document.querySelector('script[data-model-viewer]')) {
    const s = document.createElement('script')
    s.type = 'module'
    s.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js'
    s.dataset.modelViewer = '1'
    document.head.appendChild(s)
  }

  // Global slide-number indicator — top-right corner, updates on route change
  const numEl = document.createElement('div')
  numEl.className = 'global-slide-num'
  document.body.appendChild(numEl)
  const updateNum = () => {
    const m = window.location.pathname.match(/\/(\d+)/)
    numEl.textContent = m ? String(m[1]).padStart(2, '0') : ''
  }
  updateNum()
  window.addEventListener('popstate', updateNum)
  const origPush = history.pushState
  history.pushState = function (...args: any[]) { origPush.apply(this, args as any); updateNum() }
  const origReplace = history.replaceState
  history.replaceState = function (...args: any[]) { origReplace.apply(this, args as any); updateNum() }

  // LRU dispose policy — browsers cap WebGL contexts at ~8-16. Keep at most MAX_ACTIVE alive.
  const MAX_ACTIVE = 4
  const lru: HTMLElement[] = []
  const mounted = new Map<HTMLElement, MountedScene>()

  function touch(el: HTMLElement) {
    const i = lru.indexOf(el)
    if (i !== -1) lru.splice(i, 1)
    lru.push(el)
    while (lru.length > MAX_ACTIVE) {
      const old = lru.shift()
      if (!old) break
      const m = mounted.get(old)
      if (m) {
        m.dispose()
        mounted.delete(old)
      }
    }
  }

  async function activate(el: HTMLElement) {
    const preset = el.dataset.preset
    if (!preset) return
    const cfg = PRESETS[preset]
    if (!cfg) {
      console.warn('[three-scene] unknown preset:', preset)
      return
    }
    if (mounted.has(el)) {
      touch(el)
      return
    }
    try {
      const m = await mountScene(el, cfg)
      mounted.set(el, m)
      touch(el)
    } catch (err) {
      console.error('[three-scene] mount failed:', preset, err)
    }
  }

  // IntersectionObserver — mount when scene enters viewport
  const io = new IntersectionObserver(entries => {
    for (const e of entries) {
      if (e.isIntersecting) activate(e.target as HTMLElement)
    }
  }, { threshold: 0.05 })

  function tryInit() {
    document.querySelectorAll<HTMLElement>('.three-scene:not([data-observed])').forEach(el => {
      el.setAttribute('data-observed', '1')
      io.observe(el)
    })
  }

  new MutationObserver(tryInit).observe(document.body, { childList: true, subtree: true })
  tryInit()
})
