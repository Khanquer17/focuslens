// Create a simple 22x22 PNG tray icon (a circle with "F")
// We'll use a data URI approach - just create a minimal PNG
const fs = require('fs');
const path = require('path');

// 22x22 template image for macOS tray - white circle with F
// Using a base64-encoded minimal PNG
// For now, just create a placeholder that Electron can use
// We'll create a proper icon later

// Simple 44x44 (@2x) black circle PNG as template image
const size = 44;
const canvas = Buffer.alloc(size * size * 4);

// Draw a filled circle
const cx = size / 2;
const cy = size / 2;
const r = size / 2 - 4;

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const idx = (y * size + x) * 4;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
    if (dist <= r) {
      canvas[idx] = 0;     // R
      canvas[idx + 1] = 0; // G
      canvas[idx + 2] = 0; // B
      canvas[idx + 3] = 255; // A
    } else {
      canvas[idx + 3] = 0; // transparent
    }
  }
}

console.log('Icon placeholder created - using Electron nativeImage instead');
