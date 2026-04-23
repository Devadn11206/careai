import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useReducedMotion } from 'framer-motion';

type HoloBackdrop3DProps = {
  className?: string;
  palette?: [string, string, string];
  intensity?: number;
};

function makePoints(count: number, spread: number) {
  const points = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    const baseIndex = i * 3;
    const radius = spread * (0.25 + Math.random() * 0.75);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    points[baseIndex] = radius * Math.sin(phi) * Math.cos(theta);
    points[baseIndex + 1] = radius * Math.sin(phi) * Math.sin(theta);
    points[baseIndex + 2] = radius * Math.cos(phi);
  }
  return points;
}

function Core({ palette, intensity }: { palette: [string, string, string]; intensity: number }) {
  const rootRef = useRef<THREE.Group | null>(null);
  const knotRef = useRef<THREE.Mesh | null>(null);
  const haloRef = useRef<THREE.Mesh | null>(null);
  const reducedMotion = useReducedMotion();

  const materials = useMemo(() => ({
    knot: new THREE.MeshStandardMaterial({
      color: new THREE.Color(palette[0]),
      emissive: new THREE.Color(palette[1]),
      emissiveIntensity: 0.45,
      roughness: 0.18,
      metalness: 0.35,
      transparent: true,
      opacity: 0.92,
    }),
    halo: new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette[2]),
      transparent: true,
      opacity: 0.08,
      wireframe: true,
    }),
    ring: new THREE.MeshBasicMaterial({
      color: new THREE.Color(palette[1]),
      transparent: true,
      opacity: 0.25,
      wireframe: true,
    }),
  }), [palette]);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const sway = reducedMotion ? 0 : Math.sin(t * 0.45) * 0.16;
    const drift = reducedMotion ? 0 : Math.sin(t * 0.28) * 0.12;

    if (rootRef.current) {
      rootRef.current.rotation.x = sway * 0.45;
      rootRef.current.rotation.y = t * 0.16 + drift;
      rootRef.current.rotation.z = Math.sin(t * 0.2) * 0.08;
      rootRef.current.position.y = Math.sin(t * 0.55) * 0.08;
    }

    if (knotRef.current) {
      knotRef.current.rotation.z = t * 0.3;
      knotRef.current.scale.setScalar(1 + Math.sin(t * 1.6) * 0.03 * intensity);
    }

    if (haloRef.current) {
      haloRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.25) * 0.08;
      haloRef.current.rotation.z = t * -0.15;
    }
  });

  return (
    <group ref={rootRef} position={[0, 0, 0]}>
      <ambientLight intensity={0.9} />
      <pointLight position={[2.8, 2.2, 4]} intensity={2.5 * intensity} color={palette[0]} />
      <pointLight position={[-3, -1.5, 3]} intensity={1.8 * intensity} color={palette[1]} />
      <pointLight position={[0, 3.5, -1.5]} intensity={1.4 * intensity} color={palette[2]} />

      <mesh ref={haloRef} scale={[2.7, 2.7, 2.7]} material={materials.halo}>
        <torusGeometry args={[0.98, 0.08, 16, 120]} />
      </mesh>

      <mesh ref={knotRef} material={materials.knot} scale={[1.1, 1.1, 1.1]}>
        <torusKnotGeometry args={[0.72, 0.22, 196, 32, 2, 3]} />
      </mesh>

      <mesh rotation={[Math.PI / 2.3, 0, Math.PI / 4]} material={materials.ring} scale={[1.8, 1.8, 1.8]}>
        <torusGeometry args={[0.98, 0.025, 12, 240]} />
      </mesh>

      <mesh rotation={[Math.PI / 3, Math.PI / 5, 0]} material={materials.ring} scale={[1.55, 1.55, 1.55]}>
        <torusGeometry args={[0.96, 0.022, 12, 240]} />
      </mesh>
    </group>
  );
}

function PointCloud({ palette, intensity }: { palette: [string, string, string]; intensity: number }) {
  const ref = useRef<THREE.Points | null>(null);
  const reducedMotion = useReducedMotion();

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(makePoints(700, 9.5), 3));
    return geo;
  }, []);

  useFrame((state) => {
    if (!ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = reducedMotion ? 0 : t * 0.03;
    ref.current.rotation.x = reducedMotion ? 0 : Math.sin(t * 0.18) * 0.08;
    const material = ref.current.material as THREE.PointsMaterial;
    material.opacity = 0.25 + Math.sin(t * 1.2) * 0.05 * intensity;
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial
        size={0.045}
        sizeAttenuation
        transparent
        opacity={0.28}
        color={new THREE.Color(palette[2])}
        depthWrite={false}
      />
    </points>
  );
}

export const HoloBackdrop3D: React.FC<HoloBackdrop3DProps> = ({
  className = '',
  palette = ['#00D4FF', '#00FFB3', '#7B61FF'],
  intensity = 1,
}) => {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,212,255,0.16),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(0,255,179,0.14),transparent_30%),radial-gradient(circle_at_bottom,rgba(123,97,255,0.12),transparent_42%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,10,20,0.3)_0%,rgba(5,10,20,0.88)_100%)]" />
      <Canvas
        camera={{ position: [0, 0, 7.4], fov: 45 }}
        dpr={[1, 1]}
        gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      >
        <fog attach="fog" args={[new THREE.Color('#050A14'), 8.5, 18]} />
        <Core palette={palette} intensity={intensity} />
        <PointCloud palette={palette} intensity={intensity} />
      </Canvas>
    </div>
  );
};
