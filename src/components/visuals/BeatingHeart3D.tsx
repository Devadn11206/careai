import React, { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useReducedMotion } from 'framer-motion';

type Props = {
  className?: string;
  bpm?: number;
};

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function beatEnvelope(timeSeconds: number, bpm: number) {
  const bps = bpm / 60;
  const phase = (timeSeconds * bps) % 1;

  // Two-pulse heart beat (S1 + S2) using Gaussian bumps.
  const g = (x: number, mu: number, sigma: number) => {
    const t = (x - mu) / sigma;
    return Math.exp(-(t * t));
  };

  const s1 = g(phase, 0.12, 0.045);
  const s2 = g(phase, 0.34, 0.07);
  const raw = s1 * 1.0 + s2 * 0.45;

  // Normalize into [0,1] with a gentle floor.
  return clamp01(0.1 + raw);
}

function useHeartGeometry() {
  return useMemo(() => {
    // Subdivided icosahedron gives a smooth base but stays lightweight.
    // Detail 3 keeps the poly count reasonable for login/landing.
    const geometry = new THREE.IcosahedronGeometry(1, 3);
    const pos = geometry.attributes.position as THREE.BufferAttribute;

    const v = new THREE.Vector3();
    const tmp = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);

      // Base anatomical-ish proportions: slightly taller, slightly flatter.
      v.multiply(new THREE.Vector3(0.95, 1.12, 0.85));

      // Two-lobe silhouette (atria) + subtle asymmetry.
      // Adds a more recognizable heart outline without heavy meshing.
      const yTop = clamp01((v.y + 0.15) / 1.1);
      const lobeFalloff = 0.55;
      const lobeA = Math.exp(-((v.x - 0.34) * (v.x - 0.34) + (v.y - 0.22) * (v.y - 0.22) + v.z * v.z) / lobeFalloff);
      const lobeB = Math.exp(-((v.x + 0.30) * (v.x + 0.30) + (v.y - 0.20) * (v.y - 0.20) + v.z * v.z) / (lobeFalloff * 1.05));
      const lobes = (lobeA + lobeB) * 0.32;
      v.x += lobes * (v.x >= 0 ? 1 : -1);
      v.z += lobes * 0.55;

      // Left ventricle bias.
      v.x += 0.08 * Math.max(0, v.y);

      // Top bulge (atria).
      const top = clamp01((v.y + 0.2) / 1.2);
      const topBulge = 1 + 0.22 * top * top;
      v.x *= topBulge;
      v.z *= 1 + 0.14 * top;

      // Taper towards the apex.
      const bottom = clamp01((-v.y + 0.05) / 1.25);
      const taper = 1 - 0.45 * bottom;
      v.x *= taper;
      v.z *= taper;

      // Apex point.
      v.y -= 0.35 * bottom * bottom;

      // Interventricular groove suggestion: a shallow indentation.
      const groove = Math.exp(-((v.x + 0.05) * (v.x + 0.05) + (v.y + 0.05) * (v.y + 0.05) + (v.z - 0.15) * (v.z - 0.15)) / 0.22);
      v.addScaledVector(new THREE.Vector3(-0.10, 0.06, 0.0), groove);

      // Aorta-ish hint: small protrusion near upper back.
      const aorta = Math.exp(-((v.x - 0.10) * (v.x - 0.10) + (v.y - 0.55) * (v.y - 0.55) + (v.z + 0.05) * (v.z + 0.05)) / 0.12);
      v.addScaledVector(new THREE.Vector3(0.04, 0.16, -0.02), aorta);

      // Subtle surface variation (kept small for clinical look).
      const n =
        Math.sin(v.x * 4.7) * Math.sin(v.y * 5.1) * Math.sin(v.z * 4.3);
      v.multiplyScalar(1 + 0.055 * n);

      // Gentle indentation valley (suggests posterior contour).
      tmp.set(v.x + 0.18, v.y - 0.06, v.z - 0.36);
      const indent = Math.exp(-tmp.lengthSq() / 0.32);
      v.addScaledVector(new THREE.Vector3(-0.11, 0.06, 0.03), indent);

      // Final: soften the very top edge.
      v.y -= 0.05 * yTop;

      pos.setXYZ(i, v.x, v.y, v.z);
    }

    pos.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.center();

    return geometry;
  }, []);
}

function GlowShell({ bpm = 72 }: { bpm?: number }) {
  const geom = useHeartGeometry();
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  const material = useMemo(() => {
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uBeat: { value: 0.2 },
        uColorA: { value: new THREE.Color('#00F5D4') },
        uColorB: { value: new THREE.Color('#7B61FF') },
      },
      vertexShader: `
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform float uBeat;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying vec3 vN;
        varying vec3 vV;
        void main() {
          float fres = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.35);
          float pulse = 0.35 + uBeat * 0.95;
          vec3 c = mix(uColorA, uColorB, 0.55 + 0.35 * uBeat);
          float a = fres * pulse;
          gl_FragColor = vec4(c, a);
        }
      `,
    });
    return m;
  }, []);

  useEffect(() => {
    matRef.current = material;
    return () => {
      material.dispose();
    };
  }, [material]);

  useFrame((state) => {
    const beat = beatEnvelope(state.clock.elapsedTime, bpm);
    if (matRef.current) {
      matRef.current.uniforms.uBeat.value = beat;
    }
  });

  return (
    <mesh geometry={geom} material={material} scale={[1.04, 1.04, 1.04]} />
  );
}

function HeartCore({ bpm = 72 }: { bpm?: number }) {
  const geom = useHeartGeometry();
  const meshRef = useRef<THREE.Mesh | null>(null);
  const matRef = useRef<THREE.MeshPhysicalMaterial | null>(null);
  const lightRef = useRef<THREE.PointLight | null>(null);

  const coreColors = useMemo(() => {
    return {
      blue: new THREE.Color('#00CFFF'),
      teal: new THREE.Color('#00F5D4'),
      ice: new THREE.Color('#B8F0FF'),
      tmp: new THREE.Color(),
    };
  }, []);

  const material = useMemo(() => {
    // Semi-transparent bioluminescent glass look.
    const m = new THREE.MeshStandardMaterial({
      color: new THREE.Color('#00CFFF'),
      roughness: 0.18,
      metalness: 0.0,
      transparent: true,
      opacity: 0.65,
      emissive: new THREE.Color('#00F5D4'),
      emissiveIntensity: 0.35,
    });
    return m;
  }, []);

  useEffect(() => {
    matRef.current = material;
    return () => {
      material.dispose();
    };
  }, [material]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const beat = beatEnvelope(t, bpm);

    // Subtle beat scale + micro-tilt to feel alive.
    const s = 1 + beat * 0.055;
    if (meshRef.current) {
      meshRef.current.scale.set(s, s, s);
      meshRef.current.rotation.y = Math.sin(t * 0.35) * 0.22;
      meshRef.current.rotation.x = Math.sin(t * 0.28) * 0.12;
    }

    // Glow synced with beat.
    if (matRef.current) {
      matRef.current.emissiveIntensity = 0.28 + beat * 0.85;
      // Shift from cyan -> teal on beat.
      coreColors.tmp.copy(coreColors.blue).lerp(coreColors.teal, 0.55 + 0.35 * beat);
      matRef.current.color.copy(coreColors.tmp).lerp(coreColors.ice, 0.45);
    }

    if (lightRef.current) {
      lightRef.current.intensity = 1.2 + beat * 2.2;
    }
  });

  return (
    <group>
      <pointLight
        ref={lightRef}
        position={[0.6, 0.25, 1.35]}
        color={'#00F5D4'}
        intensity={1.5}
        distance={7}
      />
      <pointLight
        position={[-0.8, -0.3, 0.9]}
        color={'#7B61FF'}
        intensity={0.6}
        distance={5}
      />
      <mesh ref={meshRef} geometry={geom} material={material} />
      <GlowShell bpm={bpm} />
    </group>
  );
}

function Particles({ bpm = 72 }: { bpm?: number }) {
  const pointsRef = useRef<THREE.Points | null>(null);
  const matRef = useRef<THREE.ShaderMaterial | null>(null);

  const { geometry, material } = useMemo(() => {
    const count = 160;
    const positions = new Float32Array(count * 3);
    const seed = new Float32Array(count);

    const v = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      // Populate in a loose shell around the heart.
      const r = 1.65 + Math.random() * 1.35;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(THREE.MathUtils.lerp(-1, 1, Math.random()));
      v.setFromSphericalCoords(r, phi, theta);
      v.y *= 0.78;
      positions[i * 3 + 0] = v.x;
      positions[i * 3 + 1] = v.y;
      positions[i * 3 + 2] = v.z;
      seed[i] = Math.random();
    }

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));

    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uBeat: { value: 0.2 },
        uColorA: { value: new THREE.Color('#00F5D4') },
        uColorB: { value: new THREE.Color('#00CFFF') },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uBeat;
        attribute float aSeed;
        varying float vAlpha;

        void main() {
          vec3 p = position;

          // Minimal floating motion (clinical, not noisy)
          float t = uTime * (0.28 + aSeed * 0.55);
          p.y += sin(t + aSeed * 6.283) * 0.10;
          p.x += cos(t * 0.9 + aSeed * 12.0) * 0.06;
          p.z += sin(t * 0.85 + aSeed * 8.0) * 0.06;

          // Beat synchronized shimmer
          vAlpha = 0.12 + uBeat * 0.22;

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;

          // Size falls off with distance
          float size = 18.0 + 22.0 * uBeat;
          gl_PointSize = size * (1.0 / -mv.z);
        }
      `,
      fragmentShader: `
        uniform float uBeat;
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        varying float vAlpha;

        void main() {
          vec2 uv = gl_PointCoord.xy - 0.5;
          float d = dot(uv, uv);
          float soft = smoothstep(0.25, 0.0, d);
          vec3 c = mix(uColorA, uColorB, 0.55 + 0.35 * uBeat);
          gl_FragColor = vec4(c, soft * vAlpha);
        }
      `,
    });

    return { geometry: g, material: m };
  }, []);

  useEffect(() => {
    matRef.current = material;
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const beat = beatEnvelope(t, bpm);
    if (pointsRef.current) {
      pointsRef.current.rotation.y = t * 0.10;
      pointsRef.current.rotation.x = Math.sin(t * 0.08) * 0.08;
    }
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = t;
      matRef.current.uniforms.uBeat.value = beat;
    }
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

function Scene({ bpm = 72 }: { bpm?: number }) {
  return (
    <group>
      <ambientLight intensity={0.4} />
      <directionalLight position={[-2.4, 2.2, 2.0]} intensity={1.2} color={'#00CFFF'} />
      <directionalLight position={[2.6, -1.8, 1.2]} intensity={0.7} color={'#00F5D4'} />
      <directionalLight position={[0, 0, -2]} intensity={0.3} color={'#7B61FF'} />
      <Particles bpm={bpm} />
      <HeartCore bpm={bpm} />
    </group>
  );
}

export const BeatingHeart3D: React.FC<Props> = ({ className = '', bpm = 72 }) => {
  const reduceMotion = useReducedMotion();

  // If user prefers reduced motion, render a static-looking panel.
  if (reduceMotion) {
    return (
      <div
        className={`relative rounded-3xl border border-slate-200/70 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur overflow-hidden ${className}`}
        aria-label="3D heart visualization"
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-primary-600/10 via-secondary-500/8 to-indigo-500/10" />
        <div className="relative p-6">
          <div className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Clinical visualization</div>
          <div className="mt-2 text-lg font-extrabold text-slate-900 dark:text-white">3D Heart</div>
          <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">Reduced motion enabled.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} aria-label="3D heart visualization">
      <Canvas
        dpr={[1, 1]}
        camera={{ position: [0, 0.12, 3.15], fov: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      >
        <Scene bpm={bpm} />
      </Canvas>

      {/* Soft vignette + clinical glow */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-tr from-primary-600/12 via-transparent to-secondary-500/10" />
        <div className="absolute inset-0 [mask-image:radial-gradient(closest-side,transparent,rgba(0,0,0,0.55))] bg-slate-950/50" />
      </div>
    </div>
  );
};

export default BeatingHeart3D;
