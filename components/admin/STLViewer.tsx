'use client';

import { useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import * as THREE from 'three';

interface STLViewerProps {
  file: File | string | null;
  color?: string;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  positionX?: number;
  positionY?: number;
  positionZ?: number;
  scale?: number;
}

function STLModel({
  geometry,
  color,
  rotationX = 0,
  rotationY = 0,
  rotationZ = 0,
  positionX = 0,
  positionY = 0,
  positionZ = 0,
  scale: userScale = 1
}: {
  geometry: THREE.BufferGeometry;
  color: string;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  positionX?: number;
  positionY?: number;
  positionZ?: number;
  scale?: number;
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

      // Scale to fit in a 5-unit box (auto-scale)
      const autoScale = 5 / maxDim;

      // Center the geometry on X and Z, but keep Y (bottom) at 0
      const center = new THREE.Vector3();
      boundingBox.getCenter(center);

      // Translate so the model sits on the build plate (Y=0)
      geometry.translate(-center.x, -boundingBox.min.y, -center.z);

      // Recompute bounding sphere after translation
      geometry.computeBoundingSphere();

      // Apply auto-scale combined with user scale
      const finalScale = autoScale * userScale;
      meshRef.current.scale.set(finalScale, finalScale, finalScale);

      // Position the mesh slightly above the grid to avoid z-fighting
      meshRef.current.position.y = 0.01;

      // Adjust camera to view the entire model
      if (camera && boundingSphere) {
        const scaledRadius = boundingSphere.radius * finalScale;
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
  }, [geometry, userScale, camera, controls]);

  // Apply manual rotation
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.rotation.x = (rotationX * Math.PI) / 180;
      meshRef.current.rotation.y = (rotationY * Math.PI) / 180;
      meshRef.current.rotation.z = (rotationZ * Math.PI) / 180;
    }
  }, [rotationX, rotationY, rotationZ]);

  // Apply manual position
  useEffect(() => {
    if (meshRef.current) {
      meshRef.current.position.x = positionX;
      meshRef.current.position.y = positionY + 0.01;
      meshRef.current.position.z = positionZ;
    }
  }, [positionX, positionY, positionZ]);

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
  rotationX,
  rotationY,
  rotationZ,
  positionX,
  positionY,
  positionZ,
  scale
}: {
  geometry: THREE.BufferGeometry;
  color: string;
  rotationX?: number;
  rotationY?: number;
  rotationZ?: number;
  positionX?: number;
  positionY?: number;
  positionZ?: number;
  scale?: number;
}) {
  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} castShadow />
      <directionalLight position={[-10, -10, -5]} intensity={0.4} />
      <pointLight position={[0, 10, 0]} intensity={0.5} />
      <hemisphereLight args={['#ffffff', '#444444', 0.4]} />

      <STLModel
        geometry={geometry}
        color={color}
        rotationX={rotationX}
        rotationY={rotationY}
        rotationZ={rotationZ}
        positionX={positionX}
        positionY={positionY}
        positionZ={positionZ}
        scale={scale}
      />

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

export function STLViewer({
  file,
  color = '#B7FF2A',
  rotationX = 0,
  rotationY = 0,
  rotationZ = 0,
  positionX = 0,
  positionY = 0,
  positionZ = 0,
  scale = 1
}: STLViewerProps) {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(new STLLoader());

  useEffect(() => {
    if (!file) {
      setGeometry(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    setGeometry(null); // Clear previous geometry

    const loadSTL = async () => {
      try {
        if (typeof file === 'string') {
          // URL provided
          loaderRef.current.load(
            file,
            (loadedGeometry) => {
              if (loadedGeometry.attributes?.position?.count > 0) {
                setGeometry(loadedGeometry);
                setError(null);
              } else {
                setError('STL file contains no geometry');
              }
              setLoading(false);
            },
            undefined,
            (err) => {
              setError('Failed to load STL from URL');
              setLoading(false);
            }
          );
        } else {
          // File object - read and parse
          const arrayBuffer = await file.arrayBuffer();
          const loadedGeometry = loaderRef.current.parse(arrayBuffer);

          if (loadedGeometry.attributes?.position?.count > 0) {
            setGeometry(loadedGeometry);
            setError(null);
          } else {
            setError('STL file contains no geometry');
          }
          setLoading(false);
        }
      } catch (err: any) {
        console.error('STL loading error:', err);
        setError(err.message || 'Failed to load STL file');
        setLoading(false);
      }
    };

    loadSTL();
  }, [file]);

  if (!file) {
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-cream to-white rounded-xl border-2 border-dashed border-ink/20 flex items-center justify-center">
        <div className="text-center p-8">
          <svg
            className="w-20 h-20 mx-auto mb-4 text-ink/20"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <p className="text-ink/60 font-medium">Upload an STL file to preview the 3D model</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="absolute inset-0 bg-cream rounded-xl border-2 border-ink/10 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-lime border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-ink/70 font-medium">Loading 3D model...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute inset-0 bg-red-50 rounded-xl border-2 border-red-200 flex items-center justify-center">
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
    <div className="absolute inset-0 overflow-hidden rounded-xl">
      <div className="w-full h-full bg-gradient-to-br from-cream via-white to-cream border-2 border-ink/10 shadow-inner">
        <Canvas
          camera={{ position: [5, 5, 5], fov: 50 }}
          shadows
          gl={{ antialias: true, alpha: true }}
          style={{ display: 'block', width: '100%', height: '100%' }}
        >
          <Scene
            geometry={geometry}
            color={color}
            rotationX={rotationX}
            rotationY={rotationY}
            rotationZ={rotationZ}
            positionX={positionX}
            positionY={positionY}
            positionZ={positionZ}
            scale={scale}
          />
        </Canvas>

        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-lg border border-ink/10 text-xs text-ink/70 pointer-events-none">
          <p><strong>Controls:</strong> Left-click: Rotate | Right-click: Pan | Scroll: Zoom</p>
        </div>
      </div>
    </div>
  );
}
