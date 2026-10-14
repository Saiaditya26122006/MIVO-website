'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import * as THREE from 'three';

interface STLModelViewerProps {
  storageKey: string;
  color?: string;
  className?: string;
}

function STLModel({
  geometry,
  color,
}: {
  geometry: THREE.BufferGeometry;
  color: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera, controls } = useThree();

  useEffect(() => {
    if (!geometry || !meshRef.current) return;

    // Compute normals for proper lighting
    geometry.computeVertexNormals();

    // Calculate bounding box and sphere
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    const boundingBox = geometry.boundingBox;
    const boundingSphere = geometry.boundingSphere;

    if (boundingBox && boundingSphere) {
      // Get size for scaling
      const size = new THREE.Vector3();
      boundingBox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);

      // Scale to fit in a 5-unit box
      const autoScale = 5 / maxDim;

      // Center the geometry
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);

      // Translate so the model sits on the build plate (Y=0)
      geometry.translate(-center.x, -boundingBox.min.y, -center.z);

      // Recompute bounding sphere after translation
      geometry.computeBoundingSphere();

      // Apply auto-scale
      meshRef.current.scale.set(autoScale, autoScale, autoScale);

      // Position slightly above grid
      meshRef.current.position.y = 0.01;

      // Adjust camera to view the entire model
      if (camera && boundingSphere) {
        const scaledRadius = boundingSphere.radius * autoScale;
        const distance = scaledRadius * 3;

        camera.position.set(distance * 0.7, distance * 0.7, distance * 0.7);
        camera.near = distance * 0.01;
        camera.far = distance * 10;
        camera.updateProjectionMatrix();

        // Update controls target
        if (controls && 'target' in controls) {
          (controls as any).target.set(0, scaledRadius * 0.5, 0);
          (controls as any).update();
        }
      }
    }
  }, [geometry, camera, controls]);

  return (
    <mesh ref={meshRef} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        roughness={0.3}
        metalness={0.2}
      />
    </mesh>
  );
}

function Scene({
  geometry,
  color,
}: {
  geometry: THREE.BufferGeometry;
  color: string;
}) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-10, -10, -5]} intensity={0.4} />
      <pointLight position={[0, 10, 0]} intensity={0.5} />
      <hemisphereLight args={['#ffffff', '#444444', 0.4]} />

      <STLModel geometry={geometry} color={color} />

      <OrbitControls
        enableZoom={true}
        enablePan={true}
        enableRotate={true}
        minDistance={2}
        maxDistance={50}
        makeDefault
      />

      <gridHelper args={[20, 20, '#B7FF2A', '#e0e0e0']} position={[0, 0, 0]} />
    </>
  );
}

export function STLModelViewer({
  storageKey,
  color = '#B7FF2A',
  className = '',
}: STLModelViewerProps) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(new STLLoader());

  useEffect(() => {
    if (!storageKey) {
      setGeometry(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setGeometry(null);

    const loadSTL = async () => {
      try {
        // Request presigned URL from our preview API
        const encodedKey = encodeURIComponent(storageKey);
        const response = await fetch(`/api/r2/preview/${encodedKey}`);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to load model' }));
          throw new Error(errorData.error || 'Failed to get preview URL');
        }

        const { url } = await response.json();

        // Load STL from presigned URL
        loaderRef.current.load(
          url,
          (loadedGeometry) => {
            if (loadedGeometry.attributes?.position?.count > 0) {
              setGeometry(loadedGeometry);
              setError(null);
            } else {
              setError('Model file is empty');
            }
            setLoading(false);
          },
          undefined,
          (err) => {
            setError('Failed to load 3D model');
            setLoading(false);
            console.error('STL loading error:', err);
          }
        );
      } catch (err: any) {
        console.error('Preview error:', err);
        setError(err.message || 'Failed to load 3D model');
        setLoading(false);
      }
    };

    loadSTL();
  }, [storageKey]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gradient-to-br from-cream to-white ${className}`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-lime border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-ink/70 font-medium">Loading 3D model...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-red-50 ${className}`}>
        <div className="text-center p-8">
          <svg
            className="w-16 h-16 mx-auto mb-4 text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="text-red-800 font-semibold mb-2">Failed to load 3D model</p>
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!geometry) return null;

  return (
    <div className={`overflow-hidden ${className}`}>
      <div className="w-full h-full bg-gradient-to-br from-cream via-white to-cream">
        <Canvas
          camera={{ position: [5, 5, 5], fov: 50 }}
          shadows
          gl={{ antialias: true, alpha: true }}
          style={{ display: 'block', width: '100%', height: '100%' }}
        >
          <Scene geometry={geometry} color={color} />
        </Canvas>

        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-ink/10 text-xs text-ink/70 pointer-events-none">
          <p><strong>Controls:</strong> Left-click: Rotate | Right-click: Pan | Scroll: Zoom</p>
        </div>
      </div>
    </div>
  );
}
