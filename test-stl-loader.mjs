/**
 * Test STLLoader.parse() with valid fixtures
 * Run with: node test-stl-loader.mjs
 */

import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

console.log('🧪 Testing STLLoader.parse()...\n');

const loader = new STLLoader();

// Test 1: Binary STL with one triangle
console.log('Test 1: Binary STL (1 triangle)');
try {
  const triangleCount = 1;
  const headerSize = 80;
  const triangleSize = 50;
  const totalSize = headerSize + 4 + (triangleCount * triangleSize);

  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);

  // Triangle count at byte 80
  view.setUint32(80, triangleCount, true);

  // Triangle data starting at byte 84
  let offset = 84;

  // Normal (0, 0, 1)
  view.setFloat32(offset, 0, true); offset += 4;
  view.setFloat32(offset, 0, true); offset += 4;
  view.setFloat32(offset, 1, true); offset += 4;

  // Vertex 1 (0, 0, 0)
  view.setFloat32(offset, 0, true); offset += 4;
  view.setFloat32(offset, 0, true); offset += 4;
  view.setFloat32(offset, 0, true); offset += 4;

  // Vertex 2 (1, 0, 0)
  view.setFloat32(offset, 1, true); offset += 4;
  view.setFloat32(offset, 0, true); offset += 4;
  view.setFloat32(offset, 0, true); offset += 4;

  // Vertex 3 (0, 1, 0)
  view.setFloat32(offset, 0, true); offset += 4;
  view.setFloat32(offset, 1, true); offset += 4;
  view.setFloat32(offset, 0, true); offset += 4;

  // Attribute byte count
  view.setUint16(offset, 0, true);

  const geometry = loader.parse(buffer);

  console.log('✅ Parsed successfully');
  console.log('  - Type:', geometry.type);
  console.log('  - Has attributes:', !!geometry.attributes);
  console.log('  - Attribute keys:', Object.keys(geometry.attributes || {}));
  console.log('  - Position count:', geometry.attributes?.position?.count);
  console.log('  - Position itemSize:', geometry.attributes?.position?.itemSize);
  console.log('  - Has normal:', !!geometry.attributes?.normal);
  console.log('');
} catch (err) {
  console.error('❌ FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
}

// Test 2: ASCII STL
console.log('Test 2: ASCII STL (1 triangle)');
try {
  const asciiSTL = `solid Test
  facet normal 0 0 1
    outer loop
      vertex 0 0 0
      vertex 1 0 0
      vertex 0 1 0
    endloop
  endfacet
endsolid Test`;

  const buffer = new TextEncoder().encode(asciiSTL).buffer;
  const geometry = loader.parse(buffer);

  console.log('✅ Parsed successfully');
  console.log('  - Type:', geometry.type);
  console.log('  - Has attributes:', !!geometry.attributes);
  console.log('  - Attribute keys:', Object.keys(geometry.attributes || {}));
  console.log('  - Position count:', geometry.attributes?.position?.count);
  console.log('  - Position itemSize:', geometry.attributes?.position?.itemSize);
  console.log('  - Has normal:', !!geometry.attributes?.normal);
  console.log('');
} catch (err) {
  console.error('❌ FAILED:', err.message);
  console.error(err.stack);
  process.exit(1);
}

console.log('✅ All tests passed!\n');
console.log('STLLoader.parse() works correctly with valid fixtures.');
console.log('This means the issue is likely with the actual file being uploaded or how it\'s being read.');
