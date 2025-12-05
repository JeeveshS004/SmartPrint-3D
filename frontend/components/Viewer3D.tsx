import React, { Suspense, useMemo, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import {
  OrbitControls,
  Stage,
  Html,
  Grid
} from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import * as THREE from 'three';
import { AppState } from '../types';

// Fix for missing JSX types for R3F elements in strict environments
declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

// Component to load and display the user's mesh
const Model = ({ url, color = "#6366f1", opacity = 1.0, isFailureMode = false, onLoaded }: { url: string, color?: string, opacity?: number, isFailureMode?: boolean, onLoaded?: (offset: [number, number, number]) => void }) => {
  const [geom, setGeom] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    if (!url) return;
    const loader = new STLLoader();
    loader.load(url,
      (geometry) => {
        // Calculate offset to center and floor the model
        geometry.computeBoundingBox();
        const box = geometry.boundingBox;

        if (box) {
          const center = new THREE.Vector3();
          box.getCenter(center);

          // We want to move center.x -> 0, center.z -> 0
          // And min.y -> 0
          const offsetX = -center.x;
          const offsetY = -box.min.y;
          const offsetZ = -center.z;

          // Report the offset to parent
          if (onLoaded) {
            onLoaded([offsetX, offsetY, offsetZ]);
          }
        }

        // Do NOT modify geometry vertices directly
        geometry.computeVertexNormals();
        setGeom(geometry);
      },
      undefined,
      (error) => console.error("Error loading STL:", error)
    );
  }, [url, onLoaded]);

  const material = useMemo(() => {
    if (isFailureMode) {
      return new THREE.MeshPhysicalMaterial({
        color: "#f97316",
        emissive: "#7c2d12",
        metalness: 0.1,
        roughness: 0.8,
        wireframe: false,
        side: THREE.DoubleSide
      });
    }

    return new THREE.MeshPhysicalMaterial({
      color: color,
      metalness: 0.5,
      roughness: 0.5,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      transparent: opacity < 1.0,
      opacity: opacity,
      side: THREE.DoubleSide
    });
  }, [color, opacity, isFailureMode]);

  if (!geom) return null;

  return (
    <mesh geometry={geom} material={material} castShadow receiveShadow />
  );
};

// Visualizes the printer bed volume
const PrinterBed = ({ width, depth, height }: { width: number, depth: number, height: number }) => {
  return (
    <group>
      {/* Build Volume Box (Wireframe) - shifted so bottom is at Y=0 */}
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, height, depth]} />
        <meshBasicMaterial color="#3f3f46" wireframe transparent opacity={0.2} />
      </mesh>

      {/* Bed Base Plate */}
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#18181b" roughness={0.8} metalness={0.2} />
      </mesh>

      {/* Grid Helper on the floor */}
      <gridHelper args={[Math.max(width, depth) * 1.5, 20, 0x444444, 0x222222]} position={[0, 0.1, 0]} />

      {/* Label */}
      <Html position={[width / 2, height, depth / 2]} center transform sprite>
        <div className="bg-zinc-900/80 text-xs text-white px-2 py-1 rounded border border-white/10 backdrop-blur-sm whitespace-nowrap font-mono">
          {Math.round(width)} x {Math.round(depth)} x {Math.round(height)}mm
        </div>
      </Html>
    </group>
  );
};

const CutPlane = ({ position, normal, size = 300, visualizationMesh }: { position: [number, number, number], normal: [number, number, number], size?: number, visualizationMesh?: { vertices: number[][], faces: number[][] } }) => {
  const meshGeometry = useMemo(() => {
    if (!visualizationMesh) return null;
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array(visualizationMesh.vertices.flat());
    const indices = visualizationMesh.faces.flat();

    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }, [visualizationMesh]);

  if (meshGeometry) {
    return (
      <group>
        <mesh geometry={meshGeometry}>
          <meshBasicMaterial color="#10b981" side={THREE.DoubleSide} transparent opacity={0.5} depthWrite={false} />
        </mesh>
        <lineSegments>
          <edgesGeometry args={[meshGeometry]} />
          <lineBasicMaterial color="#34d399" />
        </lineSegments>
      </group>
    );
  }

  return (
    <group position={new THREE.Vector3(...position)}>
      {/* Visual Plane */}
      <mesh rotation={[normal[1] === 1 ? -Math.PI / 2 : 0, 0, 0]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial color="#10b981" side={THREE.DoubleSide} transparent opacity={0.3} depthWrite={false} />
      </mesh>
      {/* Border */}
      <lineSegments rotation={[normal[1] === 1 ? -Math.PI / 2 : 0, 0, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(size, size)]} />
        <lineBasicMaterial color="#34d399" />
      </lineSegments>
    </group>
  );
};

interface Viewer3DProps {
  appState: AppState;
}

export const Viewer3D: React.FC<Viewer3DProps> = ({ appState }) => {
  const { meshRegistry, selectedNodeId, mode, printers } = appState;
  const [modelOffset, setModelOffset] = useState<[number, number, number]>([0, 0, 0]);

  // Get active node
  const activeNode = selectedNodeId ? meshRegistry[selectedNodeId] : null;

  // Get active printer for this node
  const activePrinter = activeNode
    ? printers.find(p => p.id === activeNode.printerId)
    : null;

  const bedSize = activePrinter?.bedSize || { x: 220, y: 220, z: 250 };
  const isFailureMode = mode === 'failure' && !!activeNode?.failureReport;

  return (
    <div className="absolute inset-0 z-0 bg-gradient-to-b from-zinc-900 to-zinc-950">
      <Canvas shadows camera={{ position: [200, 200, 300], fov: 45 }} dpr={[1, 2]}>
        <Suspense fallback={<Html center><div className="text-white animate-pulse font-mono">Loading 3D Engine...</div></Html>}>

          {/* 
            Stage settings:
            - preset="rembrandt": Good standard studio lighting
            - intensity={1}: Balanced brightness
            - environment="city": Adds realistic reflections
            - adjustCamera={1.2}: Auto-zooms to fit content with padding
            - shadows: Enables contact shadows
          */}
          <Stage
            preset="rembrandt"
            intensity={1}
            environment="city"
            adjustCamera={1.2}
            shadows="contact"
          >
            {activeNode && (
              <group>
                {/* 
                   We group Model and CutPlane together and apply the offset.
                   The Model is loaded in original coordinates.
                   The CutPlane is defined in original coordinates.
                   The offset moves them both so the Model is centered and on the floor.
                */}
                <group position={modelOffset}>
                  <Model
                    url={activeNode.fileUrl}
                    isFailureMode={isFailureMode}
                    onLoaded={setModelOffset}
                  />

                  {activeNode.splitPlane && (
                    <CutPlane
                      position={activeNode.splitPlane.position}
                      normal={activeNode.splitPlane.normal}
                      size={Math.max(bedSize.x, bedSize.y) * 1.5}
                      visualizationMesh={activeNode.splitPlane.visualizationMesh}
                    />
                  )}
                </group>

                {/* Bed is centered at (0,0,0) (XZ) and sits on Y=0 */}
                <PrinterBed width={bedSize.x} depth={bedSize.y} height={bedSize.z} />
              </group>
            )}
          </Stage>

          {!activeNode && (
            <Grid infiniteGrid fadeDistance={200} cellColor="#3f3f46" sectionColor="#52525b" />
          )}

          <OrbitControls makeDefault />

        </Suspense>
      </Canvas>

      {/* Overlay Gradient for UI readability */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-r from-zinc-950/80 via-transparent to-transparent w-[500px]" />
    </div>
  );
};