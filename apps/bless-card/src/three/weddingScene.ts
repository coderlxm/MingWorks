import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OctahedronGeometry,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  Scene,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  WebGLRenderer,
} from 'three'
import type { ThemeId } from '../types'

interface FireworkParticle {
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  maxLife: number
  color: Color
}

export interface WeddingStageController {
  setTheme(theme: ThemeId): void
  burstFireworks(shells?: number): void
  dispose(): void
}

const THEME_FIREWORK_COLORS: Record<ThemeId, readonly number[]> = {
  gilded: [0xfde68a, 0xf5d08a, 0xf4a6b8, 0xfff7ed, 0xfbbf24],
  crimson: [0xfcd34d, 0xfb7185, 0xf59e0b, 0xffe4e6, 0xe11d48],
  starlight: [0xf472b6, 0xc4b5fd, 0xfbbf24, 0xf9a8d4, 0xede9fe],
}

const THEME_AMBIENT_COLORS: Record<ThemeId, readonly number[]> = {
  gilded: [0xf5d08a, 0xeba9a4, 0xfff3d6],
  crimson: [0xfcd34d, 0xfb7185, 0xfde68a],
  starlight: [0xc4b5fd, 0xf472b6, 0xfbbf24],
}

function createGlowTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, 30)
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
    gradient.addColorStop(0.28, 'rgba(255, 250, 240, 0.8)')
    gradient.addColorStop(0.62, 'rgba(255, 224, 180, 0.24)')
    gradient.addColorStop(1, 'rgba(255, 224, 180, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, 64, 64)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}

function buildGildedSculpture(): { group: Group; halos: Group; diamond: Group } {
  const group = new Group()

  const champagneMat = new MeshPhysicalMaterial({
    color: 0xf4cd76,
    metalness: 0.94,
    roughness: 0.14,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    emissive: 0x3b2608,
    emissiveIntensity: 0.28,
  })
  const roseGoldMat = new MeshPhysicalMaterial({
    color: 0xe8a49c,
    metalness: 0.92,
    roughness: 0.16,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    emissive: 0x3d1518,
    emissiveIntensity: 0.24,
  })
  const diamondMat = new MeshPhysicalMaterial({
    color: 0xfffaf2,
    metalness: 0.15,
    roughness: 0.03,
    clearcoat: 1,
    reflectivity: 1,
    emissive: 0xfef3c7,
    emissiveIntensity: 0.55,
  })

  // Twin interlocking rings
  const ringA = new Mesh(new TorusGeometry(0.92, 0.11, 28, 84), champagneMat)
  ringA.rotation.set(0.45, 0.35, 0.25)
  ringA.position.set(-0.34, -0.05, 0)
  group.add(ringA)

  const ringB = new Mesh(new TorusGeometry(0.86, 0.1, 28, 84), roseGoldMat)
  ringB.rotation.set(-0.55, -0.35, -0.35)
  ringB.position.set(0.36, -0.1, 0.06)
  group.add(ringB)

  // Solitaire diamond crown resting at top center
  const diamond = new Group()
  diamond.position.set(0, 0.72, 0.12)

  const crown = new Mesh(new OctahedronGeometry(0.38, 0), diamondMat)
  crown.scale.set(1, 0.85, 1)
  diamond.add(crown)

  const pavilion = new Mesh(new ConeGeometry(0.32, 0.42, 8), diamondMat)
  pavilion.rotation.x = Math.PI
  pavilion.position.y = -0.22
  diamond.add(pavilion)

  const prongGeo = new CylinderGeometry(0.025, 0.022, 0.36, 8)
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4
    const prong = new Mesh(prongGeo, champagneMat)
    prong.position.set(Math.cos(angle) * 0.28, -0.06, Math.sin(angle) * 0.28)
    prong.rotation.z = Math.cos(angle) * 0.28
    prong.rotation.x = -Math.sin(angle) * 0.28
    diamond.add(prong)
  }
  group.add(diamond)

  // Orbital golden halos with pearl sparks
  const halos = new Group()
  const outerHalo = new Mesh(
    new TorusGeometry(1.52, 0.018, 12, 96),
    new MeshStandardMaterial({ color: 0xfde68a, metalness: 0.9, roughness: 0.2, emissive: 0x784f12, emissiveIntensity: 0.4 }),
  )
  outerHalo.rotation.set(1.18, 0.22, 0)
  halos.add(outerHalo)

  const innerHalo = new Mesh(
    new TorusGeometry(1.26, 0.014, 12, 84),
    new MeshStandardMaterial({ color: 0xf4a6b8, metalness: 0.88, roughness: 0.22, emissive: 0x6b2135, emissiveIntensity: 0.35 }),
  )
  innerHalo.rotation.set(-1.12, -0.28, 0)
  halos.add(innerHalo)

  const pearlGeo = new SphereGeometry(0.065, 16, 16)
  for (let i = 0; i < 6; i++) {
    const theta = (i / 6) * Math.PI * 2
    const pearl = new Mesh(pearlGeo, i % 2 === 0 ? champagneMat : diamondMat)
    pearl.position.set(Math.cos(theta) * 1.52, Math.sin(theta) * 0.42, Math.sin(theta) * 1.38)
    halos.add(pearl)
  }
  group.add(halos)

  return { group, halos, diamond }
}

function buildCrimsonSculpture(): { group: Group; core: Mesh; tassel: Group; auraRing: Group } {
  const group = new Group()

  const goldMat = new MeshPhysicalMaterial({
    color: 0xfbbf24,
    metalness: 0.92,
    roughness: 0.18,
    clearcoat: 0.9,
    emissive: 0x5c3605,
    emissiveIntensity: 0.32,
  })
  const silkMat = new MeshPhysicalMaterial({
    color: 0xc81e3a,
    metalness: 0.18,
    roughness: 0.32,
    clearcoat: 0.65,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.68,
    transparent: true,
    opacity: 0.92,
  })
  const coreMat = new MeshBasicMaterial({
    color: 0xfde68a,
  })

  // Glowing lantern heart
  const core = new Mesh(new SphereGeometry(0.42, 24, 24), coreMat)
  core.position.y = 0.08
  group.add(core)

  // Octagonal crimson lantern body
  const body = new Mesh(new CylinderGeometry(0.68, 0.64, 1.08, 8), silkMat)
  body.position.y = 0.08
  group.add(body)

  const topDome = new Mesh(new CylinderGeometry(0.38, 0.68, 0.24, 8), silkMat)
  topDome.position.y = 0.74
  group.add(topDome)

  const bottomDome = new Mesh(new CylinderGeometry(0.64, 0.36, 0.22, 8), silkMat)
  bottomDome.position.y = -0.57
  group.add(bottomDome)

  // 8 vertical gilded ribs
  const ribGeo = new CylinderGeometry(0.025, 0.025, 1.12, 8)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const rib = new Mesh(ribGeo, goldMat)
    rib.position.set(Math.cos(angle) * 0.68, 0.08, Math.sin(angle) * 0.68)
    group.add(rib)
  }

  // Carved crown & base collars
  const topCrown = new Mesh(new TorusGeometry(0.42, 0.065, 16, 48), goldMat)
  topCrown.rotation.x = Math.PI / 2
  topCrown.position.y = 0.87
  group.add(topCrown)

  const topFinial = new Mesh(new OctahedronGeometry(0.16, 0), goldMat)
  topFinial.position.y = 1.08
  group.add(topFinial)

  const bottomCrown = new Mesh(new TorusGeometry(0.4, 0.065, 16, 48), goldMat)
  bottomCrown.rotation.x = Math.PI / 2
  bottomCrown.position.y = -0.69
  group.add(bottomCrown)

  // Hanging tassel & beads
  const tassel = new Group()
  tassel.position.y = -0.74
  const knotPearl = new Mesh(new SphereGeometry(0.09, 16, 16), goldMat)
  knotPearl.position.y = -0.06
  tassel.add(knotPearl)

  const cordOffsets = [
    [0, 0],
    [-0.08, 0.05],
    [0.08, 0.05],
    [-0.05, -0.07],
    [0.05, -0.07],
  ] as const
  const cordGeo = new CylinderGeometry(0.014, 0.01, 0.48, 8)
  for (const [cx, cz] of cordOffsets) {
    const cord = new Mesh(cordGeo, goldMat)
    cord.position.set(cx, -0.34, cz)
    tassel.add(cord)
  }
  group.add(tassel)

  // Auspicious surrounding gold ring
  const auraRing = new Group()
  const frameRing = new Mesh(new TorusGeometry(1.36, 0.026, 14, 84), goldMat)
  frameRing.rotation.set(0.18, 0, 0)
  auraRing.add(frameRing)

  const charmGeo = new OctahedronGeometry(0.085, 0)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2
    const charm = new Mesh(charmGeo, goldMat)
    charm.position.set(Math.cos(angle) * 1.36, Math.sin(angle) * 1.36 * 0.98, Math.sin(angle) * 0.24)
    auraRing.add(charm)
  }
  group.add(auraRing)

  return { group, core, tassel, auraRing }
}

const VOXEL_HEART_GRID = [
  '.11..11.',
  '12211221',
  '12322321',
  '12233221',
  '.122221.',
  '..1221..',
  '...11...',
] as const

function buildStarlightSculpture(): {
  group: Group
  heartGroup: Group
  orbitRings: Group
  satellites: Group
} {
  const group = new Group()
  const heartGroup = new Group()

  const roseMat = new MeshPhysicalMaterial({
    color: 0xf472b6,
    metalness: 0.35,
    roughness: 0.16,
    clearcoat: 1,
    emissive: 0x9d174d,
    emissiveIntensity: 0.55,
  })
  const violetMat = new MeshPhysicalMaterial({
    color: 0xc4b5fd,
    metalness: 0.42,
    roughness: 0.18,
    clearcoat: 1,
    emissive: 0x5b21b6,
    emissiveIntensity: 0.45,
  })
  const goldMat = new MeshPhysicalMaterial({
    color: 0xfbbf24,
    metalness: 0.85,
    roughness: 0.15,
    clearcoat: 1,
    emissive: 0xb45309,
    emissiveIntensity: 0.48,
  })

  const voxelGeo = new BoxGeometry(0.2, 0.2, 0.26)
  const rows = VOXEL_HEART_GRID.length
  const cols = VOXEL_HEART_GRID[0].length
  const spacing = 0.22

  for (let r = 0; r < rows; r++) {
    const line = VOXEL_HEART_GRID[r]
    for (let c = 0; c < cols; c++) {
      const cell = line[c]
      if (cell === '.') continue
      const x = (c - (cols - 1) / 2) * spacing
      const y = ((rows - 1) / 2 - r) * spacing + 0.08
      const material = cell === '3' ? goldMat : cell === '2' ? violetMat : roseMat
      const depthScale = cell === '3' ? 1.65 : cell === '2' ? 1.3 : 1
      const block = new Mesh(voxelGeo, material)
      block.position.set(x, y, 0)
      block.scale.set(1, 1, depthScale)
      heartGroup.add(block)
    }
  }
  group.add(heartGroup)

  const orbitRings = new Group()
  const ringPink = new Mesh(
    new TorusGeometry(1.42, 0.025, 14, 88),
    new MeshStandardMaterial({ color: 0xf472b6, emissive: 0xbe185d, emissiveIntensity: 0.65, roughness: 0.2 }),
  )
  ringPink.rotation.set(1.05, 0.42, 0)
  orbitRings.add(ringPink)

  const ringGold = new Mesh(
    new TorusGeometry(1.22, 0.022, 14, 88),
    new MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.6, roughness: 0.2 }),
  )
  ringGold.rotation.set(-0.98, -0.45, 0.2)
  orbitRings.add(ringGold)
  group.add(orbitRings)

  // P1 & P2 orbiting crystal satellites
  const satellites = new Group()
  const p1 = new Mesh(new IcosahedronGeometry(0.14, 0), goldMat)
  p1.position.set(1.42, 0.22, 0)
  satellites.add(p1)

  const p2 = new Mesh(new IcosahedronGeometry(0.14, 0), roseMat)
  p2.position.set(-1.42, -0.22, 0)
  satellites.add(p2)
  group.add(satellites)

  return { group, heartGroup, orbitRings, satellites }
}

export function mountWeddingStage(
  canvas: HTMLCanvasElement,
  initialTheme: ThemeId,
  getTilt: () => { x: number; y: number },
): WeddingStageController {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.24

  const scene = new Scene()
  const camera = new PerspectiveCamera(42, 1, 0.1, 80)

  const ambientLight = new AmbientLight(0xffe9d2, 1.35)
  scene.add(ambientLight)

  const keyLight = new DirectionalLight(0xfff4de, 2.8)
  keyLight.position.set(4, 6, 7)
  scene.add(keyLight)

  const rimLight = new PointLight(0xf5d08a, 18, 24)
  rimLight.position.set(-4.2, 2.5, 4.5)
  scene.add(rimLight)

  const fillLight = new PointLight(0xf4a6b8, 14, 24)
  fillLight.position.set(4.5, -1.5, 4)
  scene.add(fillLight)

  const sculptureStage = new Group()
  scene.add(sculptureStage)

  const gilded = buildGildedSculpture()
  const crimson = buildCrimsonSculpture()
  const starlight = buildStarlightSculpture()

  sculptureStage.add(gilded.group)
  sculptureStage.add(crimson.group)
  sculptureStage.add(starlight.group)

  const themeGroups: Record<ThemeId, Group> = {
    gilded: gilded.group,
    crimson: crimson.group,
    starlight: starlight.group,
  }

  let activeTheme: ThemeId = initialTheme
  for (const id of Object.keys(themeGroups) as ThemeId[]) {
    const targetScale = id === initialTheme ? 1 : 0.001
    themeGroups[id].visible = id === initialTheme
    themeGroups[id].scale.setScalar(targetScale)
  }

  // Ambient floating particles
  const glowTexture = createGlowTexture()
  const ambientCount = 170
  const ambientPositions = new Float32Array(ambientCount * 3)
  const ambientColors = new Float32Array(ambientCount * 3)
  const ambientSeeds = new Float32Array(ambientCount)

  for (let i = 0; i < ambientCount; i++) {
    ambientPositions[i * 3] = (Math.random() - 0.5) * 14
    ambientPositions[i * 3 + 1] = (Math.random() - 0.5) * 10
    ambientPositions[i * 3 + 2] = (Math.random() - 0.5) * 8 - 1.5
    ambientSeeds[i] = Math.random() * Math.PI * 2
  }

  const ambientGeo = new BufferGeometry()
  ambientGeo.setAttribute('position', new Float32BufferAttribute(ambientPositions, 3))
  ambientGeo.setAttribute('color', new Float32BufferAttribute(ambientColors, 3))

  const ambientMat = new PointsMaterial({
    size: 0.22,
    map: glowTexture,
    transparent: true,
    opacity: 0.78,
    vertexColors: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const ambientPoints = new Points(ambientGeo, ambientMat)
  scene.add(ambientPoints)

  function applyAmbientPalette(theme: ThemeId) {
    const palette = THEME_AMBIENT_COLORS[theme]
    const colorAttr = ambientGeo.getAttribute('color')
    const tmp = new Color()
    for (let i = 0; i < ambientCount; i++) {
      tmp.setHex(palette[i % palette.length])
      colorAttr.setXYZ(i, tmp.r, tmp.g, tmp.b)
    }
    colorAttr.needsUpdate = true

    if (theme === 'gilded') {
      rimLight.color.setHex(0xf5d08a)
      fillLight.color.setHex(0xeba9a4)
    } else if (theme === 'crimson') {
      rimLight.color.setHex(0xfbbf24)
      fillLight.color.setHex(0xf43f5e)
    } else {
      rimLight.color.setHex(0xc4b5fd)
      fillLight.color.setHex(0xf472b6)
    }
  }
  applyAmbientPalette(initialTheme)

  // Firework burst particle pool
  const fireworkParticles: FireworkParticle[] = []
  const maxFireworks = 520
  const fwPositions = new Float32Array(maxFireworks * 3)
  const fwColors = new Float32Array(maxFireworks * 3)
  const fwGeo = new BufferGeometry()
  fwGeo.setAttribute('position', new Float32BufferAttribute(fwPositions, 3))
  fwGeo.setAttribute('color', new Float32BufferAttribute(fwColors, 3))

  const fwMat = new PointsMaterial({
    size: 0.28,
    map: glowTexture,
    transparent: true,
    opacity: 0.95,
    vertexColors: true,
    blending: AdditiveBlending,
    depthWrite: false,
  })
  const fwPoints = new Points(fwGeo, fwMat)
  fwPoints.frustumCulled = false
  scene.add(fwPoints)

  function spawnShell(originX: number, originY: number, originZ: number, palette: readonly number[], sparks: number) {
    for (let i = 0; i < sparks; i++) {
      if (fireworkParticles.length >= maxFireworks) {
        fireworkParticles.shift()
      }
      const u = Math.random()
      const v = Math.random()
      const theta = 2 * Math.PI * u
      const phi = Math.acos(2 * v - 1)
      const speed = 1.9 + Math.random() * 2.8
      const colorHex = palette[Math.floor(Math.random() * palette.length)]
      fireworkParticles.push({
        x: originX,
        y: originY,
        z: originZ,
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.cos(phi) * speed + 0.9,
        vz: Math.sin(phi) * Math.sin(theta) * speed,
        life: 0,
        maxLife: 1.25 + Math.random() * 0.65,
        color: new Color(colorHex),
      })
    }
  }

  let disposed = false
  const pendingTimers = new Set<ReturnType<typeof globalThis.setTimeout>>()

  function burstFireworks(shells = 3) {
    if (disposed) return
    const palette = THEME_FIREWORK_COLORS[activeTheme]
    for (let s = 0; s < shells; s++) {
      const ox = (Math.random() - 0.5) * 4.2
      const oy = sculptureStage.position.y + 0.4 + (Math.random() - 0.35) * 1.8
      const oz = (Math.random() - 0.5) * 1.4
      const timer = globalThis.setTimeout(() => {
        pendingTimers.delete(timer)
        if (disposed) return
        spawnShell(ox, oy, oz, palette, 82)
      }, s * 130)
      pendingTimers.add(timer)
    }
  }

  // Responsive stage placement so centerpiece shines cleanly above the card
  function syncViewportSize() {
    const width = canvas.clientWidth || window.innerWidth
    const height = canvas.clientHeight || window.innerHeight
    if (width <= 0 || height <= 0) return

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(width, height, false)
    camera.aspect = width / height
    camera.updateProjectionMatrix()

    const isWide = width >= 920
    camera.position.set(0, 0.1, isWide ? 8.8 : 9.4)
    if (isWide) {
      sculptureStage.position.set(-2.55, 0.25, 0)
      sculptureStage.scale.setScalar(1.06)
    } else {
      sculptureStage.position.set(0, 1.82, 0)
      sculptureStage.scale.setScalar(0.78)
    }
  }
  syncViewportSize()

  const resizeObserver = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(syncViewportSize)
    : null
  if (resizeObserver) {
    resizeObserver.observe(canvas)
  }
  window.addEventListener('resize', syncViewportSize, { passive: true })

  let dragYaw = 0
  let dragPitch = 0
  let dragging = false
  let lastPointerX = 0
  let lastPointerY = 0

  function onPointerDown(event: PointerEvent) {
    const target = event.target as HTMLElement | null
    if (target?.closest('button, input, textarea, a, [data-no-stage-drag]')) return
    dragging = true
    lastPointerX = event.clientX
    lastPointerY = event.clientY
  }

  function onPointerMove(event: PointerEvent) {
    if (!dragging) return
    const dx = event.clientX - lastPointerX
    const dy = event.clientY - lastPointerY
    lastPointerX = event.clientX
    lastPointerY = event.clientY
    dragYaw += dx * 0.008
    dragPitch = MathUtils.clamp(dragPitch + dy * 0.006, -0.65, 0.65)
  }

  function onPointerUp() {
    dragging = false
  }

  window.addEventListener('pointerdown', onPointerDown, { passive: true })
  window.addEventListener('pointermove', onPointerMove, { passive: true })
  window.addEventListener('pointerup', onPointerUp, { passive: true })

  let lastFrameMs = performance.now()
  let elapsed = 0

  function tick() {
    if (document.visibilityState === 'hidden') {
      lastFrameMs = performance.now()
      return
    }
    const now = performance.now()
    const dt = Math.min((now - lastFrameMs) / 1000, 0.05)
    lastFrameMs = now
    elapsed += dt

    if (!dragging) {
      dragYaw *= 0.992
      dragPitch *= 0.98
    }

    // Smooth cross-scale transition between themes
    for (const id of Object.keys(themeGroups) as ThemeId[]) {
      const grp = themeGroups[id]
      const desired = id === activeTheme ? 1 : 0.001
      const current = grp.scale.x
      const next = current + (desired - current) * 0.14
      grp.scale.setScalar(next)
      grp.visible = next > 0.02
    }

    const tilt = getTilt()
    sculptureStage.rotation.y = elapsed * 0.42 + tilt.x * 0.45 + dragYaw
    sculptureStage.rotation.x = Math.sin(elapsed * 0.7) * 0.08 + tilt.y * 0.25 + dragPitch
    const baseY = (canvas.clientWidth || window.innerWidth) >= 920 ? 0.25 : 1.82
    sculptureStage.position.y = baseY + Math.sin(elapsed * 1.45) * 0.09

    // Theme-specific secondary motion
    gilded.halos.rotation.z = elapsed * 0.35
    gilded.diamond.rotation.y = -elapsed * 0.9

    crimson.core.scale.setScalar(1 + Math.sin(elapsed * 3.1) * 0.06)
    crimson.tassel.rotation.z = Math.sin(elapsed * 2.2) * 0.08
    crimson.auraRing.rotation.y = -elapsed * 0.55

    starlight.heartGroup.scale.setScalar(1 + Math.sin(elapsed * 2.6) * 0.045)
    starlight.orbitRings.rotation.z = elapsed * 0.48
    starlight.satellites.rotation.y = elapsed * 1.35

    // Drift ambient particles upward gently
    const posAttr = ambientGeo.getAttribute('position')
    for (let i = 0; i < ambientCount; i++) {
      let y = posAttr.getY(i) + dt * 0.24
      const x = posAttr.getX(i) + Math.sin(elapsed * 0.7 + ambientSeeds[i]) * dt * 0.12
      if (y > 5) y = -5
      posAttr.setXY(i, x, y)
    }
    posAttr.needsUpdate = true

    // Simulate firework bursts
    const fwPosAttr = fwGeo.getAttribute('position')
    const fwColAttr = fwGeo.getAttribute('color')
    for (let i = fireworkParticles.length - 1; i >= 0; i--) {
      const p = fireworkParticles[i]
      p.life += dt
      if (p.life >= p.maxLife) {
        fireworkParticles.splice(i, 1)
        continue
      }
      p.vx *= 0.982
      p.vy = p.vy * 0.982 - 2.15 * dt
      p.vz *= 0.982
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.z += p.vz * dt
    }

    for (let i = 0; i < maxFireworks; i++) {
      const p = fireworkParticles[i]
      if (p) {
        const fade = Math.max(0, 1 - p.life / p.maxLife)
        fwPosAttr.setXYZ(i, p.x, p.y, p.z)
        fwColAttr.setXYZ(i, p.color.r * fade, p.color.g * fade, p.color.b * fade)
      } else {
        fwPosAttr.setXYZ(i, 0, -999, 0)
        fwColAttr.setXYZ(i, 0, 0, 0)
      }
    }
    fwPosAttr.needsUpdate = true
    fwColAttr.needsUpdate = true

    renderer.render(scene, camera)
  }

  const renderTimer = globalThis.setInterval(tick, 16)

  return {
    setTheme(theme: ThemeId) {
      if (activeTheme === theme) return
      activeTheme = theme
      applyAmbientPalette(theme)
      burstFireworks(2)
    },
    burstFireworks,
    dispose() {
      disposed = true
      globalThis.clearInterval(renderTimer)
      pendingTimers.forEach(timer => globalThis.clearTimeout(timer))
      pendingTimers.clear()
      if (resizeObserver) resizeObserver.disconnect()
      window.removeEventListener('resize', syncViewportSize)
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      glowTexture.dispose()
      scene.traverse((obj) => {
        if (obj instanceof Mesh || obj instanceof Points) {
          obj.geometry.dispose()
          if (Array.isArray(obj.material)) {
            obj.material.forEach(mat => mat.dispose())
          } else {
            obj.material.dispose()
          }
        }
      })
      renderer.dispose()
    },
  }
}
