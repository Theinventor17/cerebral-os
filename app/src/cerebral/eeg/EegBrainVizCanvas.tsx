import { Suspense, useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import * as THREE from 'three'
import type { NormalizedEEGFrame } from '@/cerebral/headsets'
import { useResonantAgents } from '@/providers/ResonantAgentsProvider'

/** Map Cortex-style magnitudes to 0..1 (stream scale varies). */
function nrm(n: number | undefined | null): number {
  if (n == null || Number.isNaN(n)) {
    return 0
  }
  const x = Math.abs(n)
  if (x <= 1) {
    return x
  }
  if (x <= 100) {
    return Math.min(1, x / 100)
  }
  return Math.min(1, Math.log10(1 + x) / 4)
}

const C_THETA = new THREE.Color(0x4ade80)
const C_ALPHA = new THREE.Color(0xfacc15)
const C_BETA = new THREE.Color(0xfb923c)
const C_GAMMA = new THREE.Color(0xfef9c7)

const GRADIENT_SKY_VS = /* glsl */ `
varying vec3 vN;
void main() {
  vN = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`
const GRADIENT_SKY_FS = /* glsl */ `
uniform float uTime;
varying vec3 vN;
void main() {
  float t = vN.y * 0.5 + 0.5;
  vec3 top = vec3(0.12, 0.16, 0.28);
  vec3 mid = vec3(0.04, 0.09, 0.16);
  vec3 bot = vec3(0.02, 0.04, 0.09);
  vec3 g = mix(bot, top, t);
  float w = 0.35 + 0.65 * (1.0 - abs(vN.x) * 0.5);
  vec3 te = vec3(0.02, 0.2, 0.22) * (0.4 + 0.6 * sin(uTime * 0.15 + vN.x * 1.2));
  g = mix(g, g + te, 0.18 * w);
  float v = 0.04 * (1.0 - smoothstep(0.0, 0.5, t));
  g += vec3(v, v * 0.5, 0.0);
  gl_FragColor = vec4(g, 1.0);
}
`

function EegVizGradientSky(): ReactNode {
  const matRef = useRef<THREE.ShaderMaterial | null>(null)
  const matArgs: [THREE.ShaderMaterialParameters] = useMemo(
    () => [
      {
        depthWrite: false,
        side: THREE.BackSide,
        uniforms: { uTime: { value: 0 } },
        vertexShader: GRADIENT_SKY_VS,
        fragmentShader: GRADIENT_SKY_FS
      }
    ],
    []
  )
  useFrame((s) => {
    const m = matRef.current
    if (m?.uniforms?.uTime) {
      m.uniforms.uTime.value = s.clock.elapsedTime
    }
  })
  return (
    <mesh renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[20, 48, 48]} />
      <shaderMaterial ref={matRef} attach="material" args={matArgs} />
    </mesh>
  )
}

function buildShellPoints(count: number, radius: number, xOffset: number) {
  const pos = new Float32Array(count * 3)
  const reg = new Uint8Array(count)
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(1, count - 1)) * 2
    const rr = Math.sqrt(Math.max(0, 1 - y * y))
    const th = Math.PI * (3 - Math.sqrt(5)) * i
    const x = Math.cos(th) * rr
    const z = Math.sin(th) * rr
    pos[i * 3] = x * radius + xOffset
    pos[i * 3 + 1] = y * radius * 0.88
    pos[i * 3 + 2] = z * radius * 0.92
    const a = Math.atan2(x, z)
    if (a > 0.4 && a < 1.2) {
      reg[i] = 0
    } else if (a <= -0.3) {
      reg[i] = 1
    } else if (Math.abs(y) < 0.3) {
      reg[i] = 2
    } else {
      reg[i] = 3
    }
  }
  return { pos, reg }
}

function HemiSphere({
  frameRef,
  live,
  xOffset,
  side,
  compact
}: {
  frameRef: RefObject<NormalizedEEGFrame | null>
  live: boolean
  xOffset: number
  side: 'L' | 'R'
  /** Right rail: fewer points, smaller billboards */
  compact?: boolean
}): ReactNode {
  const count = compact ? 220 : 400
  const { pos, reg } = useMemo(() => buildShellPoints(count, 0.88, xOffset), [count, xOffset])
  const pointSize = compact ? 0.04 : 0.056
  const col = useRef(new Float32Array(count * 3))
  const colInit = useMemo(() => new Float32Array(count * 3).fill(0.2), [count])
  const geomRef = useRef<THREE.BufferGeometry>(null)
  const tmp = useRef(new THREE.Color())

  useFrame((state) => {
    const fr = frameRef.current
    const t = state.clock.elapsedTime
    const bp = fr?.bandPower
    const th = nrm(bp?.theta)
    const al = nrm(bp?.alpha)
    const b1 = nrm(bp?.betaL)
    const b2 = nrm(bp?.betaH)
    const bta = (b1 + b2) * 0.5
    const ga = nrm(bp?.gamma)
    let ch5 = 0
    if (fr?.channels) {
      const vals = Object.values(fr.channels).map((v) => Math.abs(v))
      ch5 = vals.length ? Math.min(1, Math.max(...vals) / 2500) : 0
    }
    const foc = nrm(fr?.metrics?.focus) * 0.35
    const str = nrm(fr?.metrics?.stress) * 0.28
    const rel = nrm(fr?.metrics?.relaxation) * 0.22
    const liveBoost = live ? 1 : 0.48
    const bandMix = th + al * 0.9 + bta * 0.85 + ga * 0.95
    const idleWave =
      0.1 + 0.11 * Math.sin(t * 0.55 + (side === 'R' ? 1.1 : 0)) * (live ? 0.22 : 1)

    for (let i = 0; i < count; i++) {
      const ri = reg[i]
      let w = 0.14
      if (ri === 0) {
        w += th * 0.55 + bta * 0.2 + foc
      } else if (ri === 1) {
        w += al * 0.55 + rel + ga * 0.12
      } else if (ri === 2) {
        w += bta * 0.48 + th * 0.12
      } else {
        w += ga * 0.52 + bta * 0.18 + ch5 * 0.45
      }
      w += str * 0.12
      w *= liveBoost
      w += idleWave
      w += 0.035 * Math.sin(t * 1.15 + i * 0.08 + (side === 'R' ? 2 : 0)) * (bandMix * 0.18 + 0.06)
      w = Math.min(1, w * 1.05)
      if (ri === 0) {
        tmp.current.copy(C_THETA).lerp(C_GAMMA, ga * 0.5)
      } else if (ri === 1) {
        tmp.current.copy(C_ALPHA).lerp(C_GAMMA, bta * 0.35)
      } else if (ri === 2) {
        tmp.current.copy(C_BETA).lerp(C_THETA, th * 0.35)
      } else {
        tmp.current.copy(C_GAMMA).lerp(new THREE.Color(0xffffff), 0.35 * ga)
      }
      tmp.current.multiplyScalar(0.28 + 0.72 * w)
      const o = i * 3
      col.current[o] = tmp.current.r
      col.current[o + 1] = tmp.current.g
      col.current[o + 2] = tmp.current.b
    }
    const g = geomRef.current
    if (g) {
      const attr = g.getAttribute('color') as THREE.BufferAttribute
      const arr = attr.array as Float32Array
      arr.set(col.current)
      attr.needsUpdate = true
    }
  })

  return (
    <points>
      <bufferGeometry ref={geomRef}>
        <bufferAttribute attach="attributes-position" count={count} array={pos} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={count} array={colInit} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial
        size={pointSize}
        vertexColors
        transparent
        opacity={0.97}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        sizeAttenuation
      />
    </points>
  )
}

function BrainMeshes({ frameRef, live }: { frameRef: RefObject<NormalizedEEGFrame | null>; live: boolean }): ReactNode {
  const matL = useRef<THREE.MeshPhysicalMaterial>(null)
  const matR = useRef<THREE.MeshPhysicalMaterial>(null)
  const root = useRef<THREE.Group>(null)

  useFrame((state) => {
    const fr = frameRef.current
    const t = state.clock.elapsedTime
    const bp = fr?.bandPower
    const sum = nrm(bp?.theta) + nrm(bp?.alpha) + nrm(bp?.betaL) + nrm(bp?.betaH) + nrm(bp?.gamma)
    const met = nrm(fr?.metrics?.focus) + nrm(fr?.metrics?.relaxation) * 0.5
    const idleBreath = 0.12 + 0.1 * Math.sin(t * 0.4) + 0.04 * Math.sin(t * 1.1)
    const pulse = live
      ? Math.min(0.55, sum * 0.14 + met * 0.18)
      : idleBreath * 0.45
    if (root.current) {
      const b = 1.02 + 0.04 * Math.sin(t * 0.38) + (live ? 0.02 * pulse : 0.015)
      root.current.scale.setScalar(b)
    }
    if (matL.current) {
      matL.current.emissiveIntensity = 0.18 + pulse * 1.05
    }
    if (matR.current) {
      matR.current.emissiveIntensity = 0.16 + pulse * 1.0
    }
  })

  return (
    <group ref={root} rotation={[0.18, 0, 0]}>
      <mesh position={[-0.38, 0, 0]}>
        <sphereGeometry args={[0.92, 56, 44]} />
        <meshPhysicalMaterial
          ref={matL}
          color="#3d4f66"
          roughness={0.52}
          metalness={0.22}
          emissive="#0a4a5c"
          emissiveIntensity={0.2}
          clearcoat={0.4}
          clearcoatRoughness={0.5}
        />
      </mesh>
      <mesh position={[0.38, 0, 0]}>
        <sphereGeometry args={[0.92, 56, 44]} />
        <meshPhysicalMaterial
          ref={matR}
          color="#4b3c58"
          roughness={0.52}
          metalness={0.22}
          emissive="#2a0a2c"
          emissiveIntensity={0.2}
          clearcoat={0.4}
          clearcoatRoughness={0.5}
        />
      </mesh>
    </group>
  )
}

function OrbitCtl({ live }: { live: boolean }): ReactNode {
  const { camera, gl } = useThree()
  const ctrl = useRef<OrbitControls | null>(null)
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.enablePan = false
    c.minDistance = 2.2
    c.maxDistance = 4.5
    c.enableDamping = true
    c.dampingFactor = 0.08
    c.autoRotate = !live
    c.autoRotateSpeed = live ? 0.35 : 0.62
    ctrl.current = c
    return () => {
      c.dispose()
      ctrl.current = null
    }
  }, [camera, gl])
  useEffect(() => {
    const c = ctrl.current
    if (c) {
      c.autoRotate = !live
      c.autoRotateSpeed = live ? 0.35 : 0.62
    }
  }, [live])
  useFrame(() => {
    ctrl.current?.update()
  })
  return null
}

function Scene({
  frameRef,
  live,
  compact
}: {
  frameRef: RefObject<NormalizedEEGFrame | null>
  live: boolean
  compact?: boolean
}): ReactNode {
  return (
    <>
      <color attach="background" args={['#080c12']} />
      <fog attach="fog" args={['#080c12', 12, 26]} />
      <EegVizGradientSky />
      <hemisphereLight intensity={0.55} color="#a8c0e8" groundColor="#080a0c" />
      <ambientLight intensity={0.38} />
      <directionalLight position={[2.8, 3.4, 2.2]} intensity={1.05} color="#f0f6ff" />
      <directionalLight position={[-2.2, 1.4, -1.2]} intensity={0.38} color="#c4b8e8" />
      <pointLight position={[0, -1.2, 2.4]} intensity={0.35} color="#5ee8c8" distance={8} decay={2} />
      <pointLight position={[-1.6, 1.2, 0.8]} intensity={0.22} color="#88a8ff" distance={7} decay={2} />
      <BrainMeshes frameRef={frameRef} live={live} />
      <HemiSphere frameRef={frameRef} live={live} xOffset={-0.38} side="L" compact={compact} />
      <HemiSphere frameRef={frameRef} live={live} xOffset={0.38} side="R" compact={compact} />
      <OrbitCtl live={live} />
    </>
  )
}

export function EegBrainVizCanvas({
  compact,
  className
}: {
  /** Narrow right-rail vs full settings panel */
  compact?: boolean
  className?: string
}): ReactNode {
  const { eegVizFrameRef, insightLive, signalLock, battery, headset } = useResonantAgents()
  const sig =
    signalLock == null ? null : Math.min(100, Math.round(signalLock <= 1 ? signalLock * 100 : signalLock))
  const battNum = /^\d+$/.test(String(battery).trim()) ? parseInt(String(battery).trim(), 10) : null

  const h = compact ? 200 : 360

  return (
    <div className={className ?? 'cos-brain-viz'} style={{ position: 'relative', width: '100%', height: h, borderRadius: 8, overflow: 'hidden' }}>
      <Suspense fallback={<div className="cos-brain-viz-fallback">Loading 3D…</div>}>
        <Canvas
          camera={{ position: [0, 0.32, 2.65], fov: 44 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          dpr={[1, 2]}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <Scene frameRef={eegVizFrameRef} live={insightLive} compact={compact} />
        </Canvas>
      </Suspense>
      <div className="cos-brain-viz-hud" aria-hidden>
        {battNum != null && battNum <= 100 && (
          <span className="cos-brain-viz-badge cos-brain-viz-batt" title="Battery (from stream when available)">
            🔋 {battNum}%
          </span>
        )}
        {sig != null && (
          <span className="cos-brain-viz-badge cos-brain-viz-sig" title="Signal / contact quality">
            {sig}%
          </span>
        )}
      </div>
      <p className="cos-brain-viz-caption">
        {insightLive
          ? `Live · ${headset || 'Insight'} · θ/α/β/γ drive glow (inspired by EMOTIV BrainViz-style demos).`
          : 'No live stream — enable Cortex + subscribe to pow/eeg/met in Headsets; preview uses idle motion.'}
      </p>
    </div>
  )
}
