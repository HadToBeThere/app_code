const test = require('node:test');
const assert = require('node:assert');

const heuristics = require('../moderation-heuristics.js');

function buildPixels(descriptors) {
  const data = [];
  for (const { count, r, g, b, a = 255 } of descriptors) {
    for (let i = 0; i < count; i++) {
      data.push(r, g, b, a);
    }
  }
  return Uint8ClampedArray.from(data);
}

test('analyzePixels rejects invalid data', () => {
  assert.throws(() => heuristics.analyzePixels(null), /Invalid image data/);
  assert.throws(() => heuristics.analyzePixels(Uint8ClampedArray.of(1, 2, 3)), /multiple of 4/);
});

test('analyzePixels treats low skin-tone coverage as safe', () => {
  const pixels = buildPixels([
    { count: 800, r: 20, g: 40, b: 120 }, // blue background
    { count: 200, r: 200, g: 160, b: 120 } // small warm region
  ]);
  const result = heuristics.analyzePixels(pixels);
  assert.strictEqual(result.isNSFW, false);
  assert.ok(result.confidence < 0.45, 'confidence should stay below high skin threshold');
});

test('analyzePixels flags explicit mixtures with high nude and pink ratios', () => {
  const pixels = buildPixels([
    { count: 700, r: 199, g: 171, b: 142 }, // nude + pink overlap
    { count: 200, r: 185, g: 140, b: 105 }, // tan support
    { count: 100, r: 210, g: 180, b: 150 } // peach highlights
  ]);
  const result = heuristics.analyzePixels(pixels);
  assert.strictEqual(result.isNSFW, true);
  assert.ok(result.confidence > 0.6, 'confidence should indicate explicit content');
  assert.ok(result.debug.pinkRatio > 0.1);
  assert.ok(result.debug.nudeRatio > 0.2);
});

test('analyzePixels stays safe when pink tones exist without nude coverage', () => {
  const pixels = buildPixels([
    { count: 120, r: 170, g: 145, b: 120 }, // pink but below nude threshold
    { count: 880, r: 40, g: 60, b: 150 }
  ]);
  const result = heuristics.analyzePixels(pixels);
  assert.strictEqual(result.isNSFW, false);
  assert.ok(result.debug.pinkRatio > 0.1);
  assert.ok(result.debug.nudeRatio < 0.2);
});
