(function (globalScope, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    globalScope.__HTBTModeration = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function analyzePixels(pixelData) {
    if (!pixelData || typeof pixelData.length !== 'number') {
      throw new Error('Invalid image data provided to moderation heuristics');
    }
    if (pixelData.length % 4 !== 0) {
      throw new Error('Pixel array length must be a multiple of 4');
    }

    let skinPixels = 0;
    let fleshPixels = 0;
    let pinkPixels = 0;
    let nudePixels = 0;
    let tanPixels = 0;
    let peachPixels = 0;
    const totalPixels = pixelData.length / 4;

    for (let i = 0; i < pixelData.length; i += 4) {
      const r = pixelData[i];
      const g = pixelData[i + 1];
      const b = pixelData[i + 2];

      if (
        r > 95 && g > 40 && b > 20 &&
        Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
        Math.abs(r - g) > 15 && r > g && r > b
      ) {
        skinPixels++;
      }

      if (r > 120 && g > 80 && b > 60 && r > g && g > b) {
        fleshPixels++;
      }

      if (r > 140 && g > 100 && b > 80 && r > g && g > b && (r - g) < 30) {
        pinkPixels++;
      }

      if (r > 180 && g > 150 && b > 120 && r > g && g > b && (r - g) < 40 && (g - b) < 40) {
        nudePixels++;
      }

      if (r > 160 && g > 120 && b > 80 && r > g && g > b && (r - g) < 50 && (g - b) < 50) {
        tanPixels++;
      }

      if (r > 200 && g > 160 && b > 120 && r > g && g > b && (r - g) < 60 && (g - b) < 60) {
        peachPixels++;
      }
    }

    const skinRatio = skinPixels / totalPixels;
    const fleshRatio = fleshPixels / totalPixels;
    const pinkRatio = pinkPixels / totalPixels;
    const nudeRatio = nudePixels / totalPixels;
    const tanRatio = tanPixels / totalPixels;
    const peachRatio = peachPixels / totalPixels;

    const totalInappropriate = (skinRatio * 0.3) + (fleshRatio * 0.4) + (pinkRatio * 0.6) +
      (nudeRatio * 0.5) + (tanRatio * 0.4) + (peachRatio * 0.5);

    const hasLotsOfSkin = totalInappropriate > 0.45;
    const hasSensitiveAreas = pinkRatio > 0.15;
    const hasNudeTones = nudeRatio > 0.20;
    const hasExplicitPatterns = (pinkRatio > 0.10 && nudeRatio > 0.10);
    const isVeryExplicit = totalInappropriate > 0.60;

    const isNSFW = isVeryExplicit || hasExplicitPatterns || (hasLotsOfSkin && hasSensitiveAreas && hasNudeTones);

    const debug = {
      isNSFW,
      confidence: totalInappropriate,
      skinRatio,
      fleshRatio,
      pinkRatio,
      nudeRatio,
      tanRatio,
      peachRatio,
      hasLotsOfSkin,
      hasSensitiveAreas,
      hasNudeTones,
      hasExplicitPatterns,
      isVeryExplicit,
      method: 'smart_image_heuristic_v2'
    };

    return {
      isNSFW,
      confidence: totalInappropriate,
      debug
    };
  }

  return {
    analyzePixels
  };
});
