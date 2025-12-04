import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

export const geometryUtils = {
  /**
   * Parses an STL file and calculates its volume in cubic millimeters.
   */
  calculateVolume: async (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const buffer = event.target?.result as ArrayBuffer;
          if (!buffer) {
             resolve(0);
             return;
          }
          
          const loader = new STLLoader();
          const geometry = loader.parse(buffer);
          
          let volume = 0;
          const position = geometry.attributes.position;
          
          // Signed volume of tetrahedron method
          if (position) {
             const p1 = new THREE.Vector3();
             const p2 = new THREE.Vector3();
             const p3 = new THREE.Vector3();
             const faces = position.count / 3;
             
             for (let i = 0; i < faces; i++) {
                p1.fromBufferAttribute(position, i * 3 + 0);
                p2.fromBufferAttribute(position, i * 3 + 1);
                p3.fromBufferAttribute(position, i * 3 + 2);
                volume += p1.dot(p2.cross(p3)) / 6.0;
             }
          }
          
          geometry.dispose();
          resolve(Math.abs(volume));
        } catch (e) {
          console.error("Error calculating volume:", e);
          resolve(0);
        }
      };
      
      reader.onerror = (e) => {
        console.error("Error reading file:", e);
        resolve(0);
      };
      
      reader.readAsArrayBuffer(file);
    });
  }
};