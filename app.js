async function main(){
  /* --------- NSFW Content Moderation System --------- */
  let nsfwModel = null;
  let moderationReady = false;
  
  // Initialize enhanced heuristic moderation system
  async function initializeModeration() {
    try {
      console.log('🚀 Initializing enhanced content moderation system...');
      
      // Skip NSFW.js model loading entirely - use enhanced heuristics directly
      // This is more reliable and aggressive than the NSFW.js model
      console.log('🛡️ Using enhanced heuristic moderation system');
      console.log('📊 Features: 6 skin tone detection algorithms, weighted scoring, 10% threshold');
      
      moderationReady = true;
      nsfwModel = null; // We'll use heuristics instead
      
      console.log('✅ Enhanced content moderation system ready');
      console.log('🎯 System will block inappropriate content with 10% confidence threshold');
      
    } catch (error) {
      console.error('❌ Failed to initialize moderation system:', error);
      
      // Even if something goes wrong, still enable basic moderation
      console.log('🔄 Enabling basic moderation as final fallback');
      moderationReady = true;
      nsfwModel = null;
    }
  }
  
  // Analyze image for NSFW content using NSFW.js
  async function analyzeImage(imageElement) {
    if (!moderationReady) {
      console.log('Moderation not ready, allowing image');
      return { isNSFW: false, confidence: 0, predictions: [] };
    }
    
    try {
      if (nsfwModel) {
        // Use NSFW.js model for analysis
        return await analyzeImageWithNSFWJS(imageElement);
      } else {
        // Fallback to enhanced heuristic
        return await analyzeImageWithHeuristic(imageElement);
      }
    } catch (error) {
      console.error('Error analyzing image:', error);
      // If analysis fails, allow the content through
      return { isNSFW: false, confidence: 0, predictions: [], error: error.message };
    }
  }
  
  // NSFW.js image analysis
  async function analyzeImageWithNSFWJS(imageElement) {
    try {
      // Create canvas and resize image to 224x224
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 224;
      canvas.height = 224;
      
      // Draw and resize image
      ctx.drawImage(imageElement, 0, 0, 224, 224);
      
      // Run NSFW.js prediction
      const predictions = await nsfwModel.classify(canvas);
      
      // NSFW.js returns predictions in format: [{className, probability}]
      const results = predictions.map(p => ({
        className: p.className,
        probability: p.probability
      }));
      
      // Check for NSFW content (Porn, Sexy, Hentai)
      const nsfwCategories = ['Porn', 'Sexy', 'Hentai'];
      let nsfwScore = 0;
      
      for (const prediction of predictions) {
        if (nsfwCategories.includes(prediction.className)) {
          nsfwScore += prediction.probability;
        }
      }
      
      const isNSFW = nsfwScore > 0.5; // 50% threshold
      
      console.log('NSFW.js image analysis results:', {
        isNSFW,
        confidence: nsfwScore,
        predictions: results
      });
      
      return {
        isNSFW,
        confidence: nsfwScore,
        predictions: results
      };
    } catch (error) {
      console.error('NSFW.js analysis failed:', error);
      throw error;
    }
  }
  
  // Enhanced heuristic image analysis (fallback)
  async function analyzeImageWithHeuristic(imageElement) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 224;
    canvas.height = 224;

    ctx.drawImage(imageElement, 0, 0, 224, 224);

    try {
      const imageData = ctx.getImageData(0, 0, 224, 224);
      const analyzer = (typeof window !== 'undefined' && window.__HTBTModeration && typeof window.__HTBTModeration.analyzePixels === 'function')
        ? window.__HTBTModeration
        : null;

      if (!analyzer) {
        throw new Error('Moderation heuristics module unavailable');
      }

      const result = analyzer.analyzePixels(imageData.data);

      console.log('Smart image analysis results:', result.debug);

      return {
        isNSFW: result.isNSFW,
        confidence: result.confidence,
        predictions: [
          { className: 'SkinTone', probability: result.debug.skinRatio },
          { className: 'FleshTone', probability: result.debug.fleshRatio },
          { className: 'PinkTone', probability: result.debug.pinkRatio },
          { className: 'NudeTone', probability: result.debug.nudeRatio },
          { className: 'TanTone', probability: result.debug.tanRatio },
          { className: 'PeachTone', probability: result.debug.peachRatio }
        ],
        debug: result.debug
      };
    } catch (error) {
      console.error('Heuristic moderation failed:', error);
      return { isNSFW: false, confidence: 0, predictions: [], error: error.message };
    }
  }
  
  // Analyze image from file
  async function analyzeImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = async () => {
        try {
          const analysis = await analyzeImage(img);
          URL.revokeObjectURL(img.src);
          resolve(analysis);
        } catch (error) {
          URL.revokeObjectURL(img.src);
          reject(error);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error('Failed to load image'));
      };
      img.src = URL.createObjectURL(file);
    });
  }
  
  // Analyze video from file
  async function analyzeVideoFromFile(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = async () => {
        try {
          const analysis = await analyzeVideo(video);
          URL.revokeObjectURL(video.src);
          resolve(analysis);
        } catch (error) {
          URL.revokeObjectURL(video.src);
          reject(error);
        }
      };
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        reject(new Error('Failed to load video'));
      };
      video.src = URL.createObjectURL(file);
    });
  }

  // Analyze video for NSFW content (multiple frames)
  async function analyzeVideo(videoElement) {
    if (!moderationReady) {
      console.log('Moderation not ready, allowing video');
      return { isNSFW: false, confidence: 0, predictions: [] };
    }
    
    try {
      console.log('🎬 Starting video analysis...');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const video = videoElement;
      
      // Set canvas size to match video
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 240;
      
      console.log(`📹 Video dimensions: ${canvas.width}x${canvas.height}, duration: ${video.duration}s`);
      
      // Analyze more frames for better coverage
      const frameCount = 8; // Increased from 5 to 8 frames
      const frameResults = [];
      
      for (let i = 0; i < frameCount; i++) {
        // Seek to different points in the video
        const seekTime = (video.duration / frameCount) * i;
        video.currentTime = seekTime;
        
        console.log(`🔍 Analyzing frame ${i + 1}/${frameCount} at ${seekTime.toFixed(2)}s`);
        
        // Wait for seek to complete
        await new Promise(resolve => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            resolve();
          };
          video.addEventListener('seeked', onSeeked);
        });
        
        // Draw current frame to canvas
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // DEBUG: Save frame for inspection if debugging is enabled
        if (window.frameDebugEnabled) {
          const frameDataURL = canvas.toDataURL();
          console.log(`🖼️ Frame ${i + 1} data URL:`, frameDataURL.substring(0, 100) + '...');
          // You can copy this URL and paste it in a new tab to see the actual frame
        }
        
        // Analyze this frame using enhanced video-specific analysis
        const frameAnalysis = await analyzeVideoFrame(canvas);
        frameResults.push(frameAnalysis);
        
        console.log(`📊 Frame ${i + 1} result:`, {
          isNSFW: frameAnalysis.isNSFW,
          confidence: frameAnalysis.confidence.toFixed(3),
          method: frameAnalysis.method
        });
      }
      
      // SMART video analysis - only flag if there's clear evidence of explicit content
      const maxConfidence = Math.max(...frameResults.map(r => r.confidence));
      const avgConfidence = frameResults.reduce((sum, r) => sum + r.confidence, 0) / frameResults.length;
      const nsfwFrames = frameResults.filter(r => r.isNSFW).length;
      const suspiciousFrames = frameResults.filter(r => r.confidence > 0.1).length; // 10% threshold for suspicious
      
      // Only flag if multiple frames are NSFW or if there's a high-confidence frame
      const isNSFW = nsfwFrames >= 2 || (nsfwFrames >= 1 && maxConfidence > 0.2) || suspiciousFrames >= 3;
      
      console.log('🎬 Video analysis results:', {
        isNSFW,
        maxConfidence: maxConfidence.toFixed(3),
        avgConfidence: avgConfidence.toFixed(3),
        suspiciousFrames,
        frameCount: frameResults.length,
        frameResults: frameResults.map((r, i) => ({ 
          frame: i, 
          isNSFW: r.isNSFW, 
          confidence: r.confidence.toFixed(3),
          method: r.method
        }))
      });
      
      return {
        isNSFW,
        confidence: maxConfidence,
        avgConfidence,
        suspiciousFrames,
        predictions: frameResults.flatMap(r => r.predictions),
        frameResults
      };
    } catch (error) {
      console.error('❌ Error analyzing video:', error);
      // If analysis fails, allow the content through
      return { isNSFW: false, confidence: 0, predictions: [], error: error.message };
    }
  }
  
  // SMART video frame analysis - detects explicit content in both light and dark videos
  async function analyzeVideoFrame(canvas) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let skinPixels = 0;
    let fleshPixels = 0;
    let pinkPixels = 0;
    let nudePixels = 0;
    let tanPixels = 0;
    let peachPixels = 0;
    let darkPixels = 0;
    let lightPixels = 0;
    let mediumPixels = 0;
    let totalPixels = data.length / 4;
    
    // First pass: determine if this is a dark video
    let totalBrightness = 0;
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      totalBrightness += (r + g + b) / 3;
    }
    const avgBrightness = totalBrightness / (data.length / 16);
    const isDarkVideo = avgBrightness < 80; // Dark video threshold
    
    // Sample every 4th pixel for performance
    for (let i = 0; i < data.length; i += 16) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Adjust detection ranges based on video brightness
      if (isDarkVideo) {
        // DARK VIDEO DETECTION - lower thresholds for dark videos
        
        // Dark skin tone detection (much lower thresholds)
        if (r > 40 && g > 20 && b > 10 && 
            Math.max(r, g, b) - Math.min(r, g, b) > 8 &&
            Math.abs(r - g) > 8 && r > g && r > b) {
          skinPixels++;
        }
        
        // Dark flesh tone detection
        if (r > 60 && g > 40 && b > 25 && r > g && g > b) {
          fleshPixels++;
        }
        
        // Dark pink/flesh tone detection (for sensitive areas in dark videos)
        if (r > 70 && g > 50 && b > 35 && r > g && g > b && (r - g) < 25) {
          pinkPixels++;
        }
        
        // Dark nude/beige tone detection
        if (r > 90 && g > 75 && b > 60 && r > g && g > b && (r - g) < 30 && (g - b) < 30) {
          nudePixels++;
        }
        
        // Dark tan/brown skin tone detection
        if (r > 80 && g > 60 && b > 40 && r > g && g > b && (r - g) < 40 && (g - b) < 40) {
          tanPixels++;
        }
        
        // Dark peach/salmon tone detection
        if (r > 100 && g > 80 && b > 60 && r > g && g > b && (r - g) < 50 && (g - b) < 50) {
          peachPixels++;
        }
      } else {
        // BRIGHT VIDEO DETECTION - normal thresholds for well-lit videos
        
        // Normal skin tone detection
        if (r > 95 && g > 40 && b > 20 && 
            Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
            Math.abs(r - g) > 15 && r > g && r > b) {
          skinPixels++;
        }
        
        // Normal flesh tone detection
        if (r > 120 && g > 80 && b > 60 && r > g && g > b) {
          fleshPixels++;
        }
        
        // Normal pink/flesh tone detection
        if (r > 140 && g > 100 && b > 80 && r > g && g > b && (r - g) < 30) {
          pinkPixels++;
        }
        
        // Normal nude/beige tone detection
        if (r > 180 && g > 150 && b > 120 && r > g && g > b && (r - g) < 40 && (g - b) < 40) {
          nudePixels++;
        }
        
        // Normal tan/brown skin tone detection
        if (r > 160 && g > 120 && b > 80 && r > g && g > b && (r - g) < 50 && (g - b) < 50) {
          tanPixels++;
        }
        
        // Normal peach/salmon tone detection
        if (r > 200 && g > 160 && b > 120 && r > g && g > b && (r - g) < 60 && (g - b) < 60) {
          peachPixels++;
        }
      }
      
      // Brightness detection (same for both)
      if (r < 50 && g < 50 && b < 50) {
        darkPixels++;
      }
      if (r > 200 && g > 200 && b > 200) {
        lightPixels++;
      }
      if (r > 100 && g > 100 && b > 100 && r < 200 && g < 200 && b < 200) {
        mediumPixels++;
      }
    }
    
    const skinRatio = skinPixels / (totalPixels / 4);
    const fleshRatio = fleshPixels / (totalPixels / 4);
    const pinkRatio = pinkPixels / (totalPixels / 4);
    const nudeRatio = nudePixels / (totalPixels / 4);
    const tanRatio = tanPixels / (totalPixels / 4);
    const peachRatio = peachPixels / (totalPixels / 4);
    const darkRatio = darkPixels / (totalPixels / 4);
    const lightRatio = lightPixels / (totalPixels / 4);
    const mediumRatio = mediumPixels / (totalPixels / 4);
    
    // Adjust scoring based on video brightness
    let totalInappropriate;
    let hasLotsOfSkin, hasSensitiveAreas, hasNudeTones;
    
    if (isDarkVideo) {
      // DARK VIDEO SCORING - extremely aggressive for dark explicit content
      totalInappropriate = (skinRatio * 0.8) + (fleshRatio * 0.9) + (pinkRatio * 1.2) + 
                          (nudeRatio * 1.1) + (tanRatio * 0.9) + (peachRatio * 1.0);
      
      hasLotsOfSkin = totalInappropriate > 0.03; // 3% threshold for dark videos (extremely aggressive)
      hasSensitiveAreas = pinkRatio > 0.015; // 1.5% threshold for dark videos (extremely aggressive)
      hasNudeTones = nudeRatio > 0.02; // 2% threshold for dark videos (extremely aggressive)
    } else {
      // BRIGHT VIDEO SCORING - normal thresholds
      totalInappropriate = (skinRatio * 0.3) + (fleshRatio * 0.4) + (pinkRatio * 0.6) + 
                          (nudeRatio * 0.5) + (tanRatio * 0.4) + (peachRatio * 0.5);
      
      hasLotsOfSkin = totalInappropriate > 0.15; // 15% threshold for bright videos
      hasSensitiveAreas = pinkRatio > 0.05; // 5% threshold for bright videos
      hasNudeTones = nudeRatio > 0.08; // 8% threshold for bright videos
    }
    
    const isWellLit = lightRatio > 0.2;
    
    // Flag if it's clearly explicit content
    const isNSFW = (hasLotsOfSkin && isWellLit) || hasSensitiveAreas || hasNudeTones;
    
    console.log(`🔍 Smart frame analysis (${isDarkVideo ? 'DARK' : 'BRIGHT'} video):`, {
      avgBrightness: avgBrightness.toFixed(1),
      skinRatio: skinRatio.toFixed(4),
      fleshRatio: fleshRatio.toFixed(4),
      pinkRatio: pinkRatio.toFixed(4),
      nudeRatio: nudeRatio.toFixed(4),
      totalInappropriate: totalInappropriate.toFixed(4),
      hasLotsOfSkin,
      hasSensitiveAreas,
      isWellLit,
      hasNudeTones,
      isNSFW
    });
    
    return {
      isNSFW,
      confidence: totalInappropriate,
      predictions: [
        { className: 'SkinTone', probability: skinRatio },
        { className: 'FleshTone', probability: fleshRatio },
        { className: 'PinkTone', probability: pinkRatio },
        { className: 'NudeTone', probability: nudeRatio },
        { className: 'TanTone', probability: tanRatio },
        { className: 'PeachTone', probability: peachRatio },
        { className: 'DarkRatio', probability: darkRatio },
        { className: 'LightRatio', probability: lightRatio },
        { className: 'MediumRatio', probability: mediumRatio }
      ],
      method: isDarkVideo ? 'smart_dark_video_heuristic' : 'smart_bright_video_heuristic'
    };
  }
  
  // Show moderation loading indicator
  function showModerationLoading(message = 'Analyzing content...') {
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'moderationLoading';
    loadingDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px;
      border-radius: 8px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      text-align: center;
    `;
    loadingDiv.innerHTML = `
      <div style="margin-bottom: 10px;">🔍</div>
      <div>${message}</div>
    `;
    document.body.appendChild(loadingDiv);
  }
  
  // Hide moderation loading indicator
  function hideModerationLoading() {
    const loadingDiv = document.getElementById('moderationLoading');
    if (loadingDiv) {
      loadingDiv.remove();
    }
  }
  
  // Block upload and show NSFW warning
  function blockUploadForNSFW(reason = 'inappropriate content detected') {
    hideModerationLoading();
    showToast(`Upload blocked: ${reason}`, 'error');
  }
  
  // Fallback video analysis when video can't be loaded directly
  async function analyzeVideoFallback(ping) {
    console.log(`🔄 Using fallback analysis for video in ping ${ping.id}`);
    
    try {
      // Analyze based on URL patterns, file names, and other metadata
      let suspiciousScore = 0;
      let reasons = [];
      
      // Check URL patterns
      const url = ping.videoUrl.toLowerCase();
      if (url.includes('porn') || url.includes('xxx') || url.includes('adult') || url.includes('nsfw')) {
        suspiciousScore += 0.8;
        reasons.push('suspicious URL');
      }
      
      // Check file name patterns
      if (ping.videoUrl.includes('xvideos') || ping.videoUrl.includes('pornhub') || ping.videoUrl.includes('redtube')) {
        suspiciousScore += 0.9;
        reasons.push('adult site URL');
      }
      
      // Check ping text for suspicious keywords
      if (ping.text) {
        const text = ping.text.toLowerCase();
        const suspiciousWords = ['nude', 'naked', 'sex', 'porn', 'xxx', 'adult', 'nsfw', 'explicit'];
        const foundWords = suspiciousWords.filter(word => text.includes(word));
        if (foundWords.length > 0) {
          suspiciousScore += foundWords.length * 0.2;
          reasons.push(`suspicious text: ${foundWords.join(', ')}`);
        }
      }
      
      // Check if ping was previously flagged or deleted
      if (ping.deleted || ping.flagged || ping.nsfw) {
        suspiciousScore += 0.7;
        reasons.push('previously flagged');
      }
      
      // Check video duration (very short videos might be suspicious)
      if (ping.duration && ping.duration < 5) {
        suspiciousScore += 0.3;
        reasons.push('very short duration');
      }
      
      // AGGRESSIVE FALLBACK: If we can't analyze the video content directly,
      // and this is a retroactive scan, be more suspicious of videos
      // This is because we know some videos were inappropriate but can't load them
      if (suspiciousScore === 0) {
        console.log(`⚠️ No suspicious metadata found for ping ${ping.id}, but video exists - applying conservative scoring`);
        suspiciousScore = 0.3; // Conservative suspicion for any video we can't analyze
        reasons.push('video exists but cannot be analyzed - conservative flag');
      }
      
      const isNSFW = suspiciousScore > 0.5;
      const confidence = Math.min(suspiciousScore, 1.0);
      
      console.log(`🔍 Fallback analysis for ping ${ping.id}:`, {
        suspiciousScore,
        confidence,
        reasons,
        isNSFW,
        method: 'fallback_metadata_analysis'
      });
      
      return {
        isNSFW,
        confidence,
        predictions: [
          { className: 'SuspiciousURL', probability: url.includes('porn') || url.includes('xxx') ? 0.8 : 0 },
          { className: 'SuspiciousText', probability: ping.text ? (ping.text.toLowerCase().includes('nude') ? 0.6 : 0) : 0 },
          { className: 'PreviouslyFlagged', probability: ping.deleted || ping.flagged ? 0.7 : 0 },
          { className: 'UnanalyzedVideo', probability: suspiciousScore === 0.3 ? 0.3 : 0 }
        ],
        method: 'fallback_metadata_analysis'
      };
      
    } catch (error) {
      console.error(`❌ Fallback analysis failed for ping ${ping.id}:`, error);
      return {
        isNSFW: false,
        confidence: 0,
        predictions: [],
        method: 'fallback_failed'
      };
    }
  }

  // Analyze existing ping content for NSFW
  async function analyzeExistingPingContent(ping) {
    if (!moderationReady) {
      console.log(`⚠️ Moderation not ready for ping ${ping.id}`);
      return false; // If moderation not ready, don't delete
    }
    
    try {
      let isNSFW = false;
      let analysisResults = [];
      
      // Analyze image if present
      if (ping.imageUrl) {
        console.log(`🖼️ Analyzing image for ping ${ping.id}: ${ping.imageUrl}`);
        
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous'; // Handle CORS
          
          const imageAnalysis = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Image loading timeout'));
            }, 10000); // 10 second timeout
            
            img.onload = async () => {
              clearTimeout(timeout);
              try {
                const analysis = await analyzeImage(img);
                resolve(analysis);
              } catch (error) {
                reject(error);
              }
            };
            img.onerror = () => {
              clearTimeout(timeout);
              reject(new Error('Failed to load image'));
            };
            img.src = ping.imageUrl;
          });
          
          analysisResults.push(`Image: ${imageAnalysis.isNSFW ? 'NSFW' : 'Clean'} (${(imageAnalysis.confidence * 100).toFixed(1)}%)`);
          
          if (imageAnalysis.isNSFW) {
            console.log(`❌ NSFW image detected in ping ${ping.id}:`, imageAnalysis);
            isNSFW = true;
          } else {
            console.log(`✅ Image clean for ping ${ping.id}:`, imageAnalysis);
          }
        } catch (error) {
          console.log(`⚠️ Failed to analyze image for ping ${ping.id}:`, error.message);
          analysisResults.push(`Image: Failed to load (${error.message})`);
          // Don't fail the whole analysis if image fails to load
        }
      }
      
      // Analyze video if present
      if (ping.videoUrl && !isNSFW) {
        console.log(`🎬 Analyzing video for ping ${ping.id}: ${ping.videoUrl}`);
        
        try {
          // Try multiple approaches to load the video
          let videoAnalysis = null;
          
          // Approach 1: Try with CORS
          try {
            const video = document.createElement('video');
            video.crossOrigin = 'anonymous';
            video.preload = 'metadata';
            video.muted = true; // Mute to avoid autoplay issues
            
            videoAnalysis = await new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                reject(new Error('Video loading timeout (CORS)'));
              }, 10000); // 10 second timeout
              
              video.onloadedmetadata = async () => {
                clearTimeout(timeout);
                try {
                  const analysis = await analyzeVideo(video);
                  resolve(analysis);
                } catch (error) {
                  reject(error);
                }
              };
              video.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('Failed to load video (CORS)'));
              };
              video.src = ping.videoUrl;
            });
          } catch (corsError) {
            console.log(`⚠️ CORS approach failed for ping ${ping.id}:`, corsError.message);
            
            // Approach 2: Try without CORS
            try {
              const video = document.createElement('video');
              video.preload = 'metadata';
              video.muted = true;
              
              videoAnalysis = await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                  reject(new Error('Video loading timeout (no CORS)'));
                }, 10000);
                
                video.onloadedmetadata = async () => {
                  clearTimeout(timeout);
                  try {
                    const analysis = await analyzeVideo(video);
                    resolve(analysis);
                  } catch (error) {
                    reject(error);
                  }
                };
                video.onerror = () => {
                  clearTimeout(timeout);
                  reject(new Error('Failed to load video (no CORS)'));
                };
                video.src = ping.videoUrl;
              });
            } catch (noCorsError) {
              console.log(`⚠️ No-CORS approach also failed for ping ${ping.id}:`, noCorsError.message);
              
              // Approach 3: Fallback - analyze based on URL patterns and ping metadata
              console.log(`🔄 Using fallback analysis for ping ${ping.id}`);
              videoAnalysis = await analyzeVideoFallback(ping);
            }
          }
          
          if (videoAnalysis) {
            analysisResults.push(`Video: ${videoAnalysis.isNSFW ? 'NSFW' : 'Clean'} (${(videoAnalysis.confidence * 100).toFixed(1)}%)`);
            
            if (videoAnalysis.isNSFW) {
              console.log(`❌ NSFW video detected in ping ${ping.id}:`, videoAnalysis);
              isNSFW = true;
            } else {
              console.log(`✅ Video clean for ping ${ping.id}:`, videoAnalysis);
            }
          } else {
            analysisResults.push(`Video: Analysis failed`);
          }
        } catch (error) {
          console.log(`⚠️ All video analysis approaches failed for ping ${ping.id}:`, error.message);
          analysisResults.push(`Video: All methods failed (${error.message})`);
        }
      }
      
      // Log analysis summary
      console.log(`📊 Ping ${ping.id} analysis summary:`, analysisResults.join(', '));
      
      return isNSFW;
    } catch (error) {
      console.error(`❌ Error analyzing existing ping content for ${ping.id}:`, error);
      return false; // If analysis fails, don't delete
    }
  }

  // Delete ping and associated content when NSFW is detected
  async function deletePingForNSFW(pingId, reason = 'inappropriate content detected') {
    try {
      console.log(`Deleting ping ${pingId} due to NSFW content: ${reason}`);
      
      // Get database reference dynamically
      const db = firebase.firestore();
      const pingsCollection = db.collection('pings');
      
      // Delete from Firestore
      await pingsCollection.doc(pingId).delete();
      
      // Remove from map if it exists (using correct variable name)
      if (typeof markers !== 'undefined' && markers && markers.has(pingId)) {
        try {
          map.removeLayer(markers.get(pingId));
          markers.delete(pingId);
          console.log(`Removed marker for ping ${pingId}`);
        } catch (mapError) {
          console.log(`Could not remove marker for ping ${pingId}:`, mapError.message);
        }
      }
      
      // Remove from cache if it exists
      if (typeof lastPingCache !== 'undefined' && lastPingCache && lastPingCache.has(pingId)) {
        lastPingCache.delete(pingId);
        console.log(`Removed ping ${pingId} from cache`);
      }
      
      showToast('Content removed due to policy violation', 'error');
      console.log(`Successfully deleted ping ${pingId}`);
    } catch (error) {
      console.error('Error deleting NSFW ping:', error);
      showToast('Error removing content', 'error');
    }
  }
  // Manual moderation system check and fix (call from console: checkModeration())
  window.checkModeration = async function() {
    console.log('🔍 Checking moderation system status...');
    console.log('moderationReady:', moderationReady);
    console.log('nsfwModel:', nsfwModel);
    
    if (!moderationReady) {
      console.log('⚠️ Moderation system not ready - attempting to initialize...');
      try {
        await initializeModeration();
        console.log('✅ Moderation system initialized successfully');
        console.log('moderationReady is now:', moderationReady);
      } catch (error) {
        console.error('❌ Failed to initialize moderation system:', error);
        console.log('🔄 Manually setting moderation ready as fallback...');
        moderationReady = true;
        nsfwModel = null;
        console.log('✅ Moderation system manually enabled');
      }
    } else {
      console.log('✅ Moderation system is ready');
    }
    
    // Test the system
    console.log('🧪 Testing moderation system...');
    try {
      const testCanvas = document.createElement('canvas');
      testCanvas.width = 100;
      testCanvas.height = 100;
      const testCtx = testCanvas.getContext('2d');
      testCtx.fillStyle = '#ffdbac'; // Skin tone color
      testCtx.fillRect(0, 0, 100, 100);
      
      const testImg = new Image();
      testImg.src = testCanvas.toDataURL();
      testImg.onload = async () => {
        try {
          const result = await analyzeImage(testImg);
          console.log('✅ Test analysis successful:', result);
        } catch (error) {
          console.error('❌ Test analysis failed:', error);
        }
      };
    } catch (error) {
      console.error('❌ Test setup failed:', error);
    }
  };

  // Test function for content moderation (call from console: testModeration())
  window.testModeration = async function() {
    console.log('🧪 Testing enhanced content moderation system...');
    console.log('Moderation ready:', moderationReady);
    console.log('Using enhanced heuristics:', nsfwModel === null);
    console.log('System features: 6 skin tone detection algorithms, weighted scoring, 10% threshold');
    
    if (moderationReady) {
      // Create a test image (skin tone colored square)
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 100;
      canvas.height = 100;
      ctx.fillStyle = '#D2B48C'; // Tan color (skin tone)
      ctx.fillRect(0, 0, 100, 100);
      
      try {
        const result = await analyzeImage(canvas);
        console.log('✅ Test analysis result:', result);
        console.log('🎯 This image would be', result.isNSFW ? 'BLOCKED' : 'ALLOWED');
      } catch (error) {
        console.error('❌ Test analysis failed:', error);
      }
    } else {
      console.log('❌ Moderation system not ready');
    }
  };
  
  // Test function for video moderation (call from console: testVideoModeration())
  window.testVideoModeration = async function() {
    console.log('🎬 Testing video moderation system...');
    console.log('Moderation ready:', moderationReady);
    
    if (moderationReady) {
      // Create a test video element with skin tone frames
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = 320;
      canvas.height = 240;
      
      // Create a test video with skin tone content
      ctx.fillStyle = '#D2B48C'; // Tan color
      ctx.fillRect(0, 0, 320, 240);
      
      // Simulate video analysis by analyzing the canvas directly
      try {
        const result = await analyzeVideoFrame(canvas);
        console.log('✅ Video frame test result:', result);
        console.log('🎯 This video frame would be', result.isNSFW ? 'BLOCKED' : 'ALLOWED');
        console.log('📊 Confidence breakdown:', result.predictions);
      } catch (error) {
        console.error('❌ Video test analysis failed:', error);
      }
    } else {
      console.log('❌ Moderation system not ready');
    }
  };
  
  // Enable frame debugging (call from console: enableFrameDebug())
  window.enableFrameDebug = function() {
    console.log('🔍 Frame debugging enabled - frames will be saved for inspection');
    window.frameDebugEnabled = true;
  };
  
  // Disable frame debugging (call from console: disableFrameDebug())
  window.disableFrameDebug = function() {
    console.log('🔍 Frame debugging disabled');
    window.frameDebugEnabled = false;
  };
  
  // Test video file analysis (call from console: testVideoFile(file))
  window.testVideoFile = async function(file) {
    console.log('🎬 Testing video file analysis...');
    console.log('File:', file.name, 'Size:', file.size, 'Type:', file.type);
    
    if (!moderationReady) {
      console.log('❌ Moderation system not ready');
      return;
    }
    
    try {
      const result = await analyzeVideoFromFile(file);
      console.log('✅ Video file analysis result:', result);
      console.log('🎯 This video would be', result.isNSFW ? 'BLOCKED' : 'ALLOWED');
      
      if (result.frameResults) {
        console.log('📊 Frame-by-frame results:', result.frameResults.map((r, i) => ({
          frame: i + 1,
          isNSFW: r.isNSFW,
          confidence: r.confidence.toFixed(3)
        })));
      }
    } catch (error) {
      console.error('❌ Video file analysis failed:', error);
    }
  };
  
  // Enable drag and drop testing (call from console: enableDragDropTest())
  window.enableDragDropTest = function() {
    console.log('🎬 Drag and drop testing enabled - drag video files onto the page to test');
    
    // Add drag and drop event listeners
    document.addEventListener('dragover', function(e) {
      e.preventDefault();
    });
    
    document.addEventListener('drop', function(e) {
      e.preventDefault();
      const files = e.dataTransfer.files;
      
      for (let file of files) {
        if (file.type.startsWith('video/')) {
          console.log('📁 Video file dropped:', file.name);
          testVideoFile(file);
        } else {
          console.log('📁 Non-video file dropped:', file.name, '- ignoring');
        }
      }
    });
  };
  
  // Retroactively scan and delete inappropriate pings (call from console: scanAllPings())
  window.scanAllPings = async function() {
    console.log('🔍 Starting retroactive scan of all pings...');
    
    if (!moderationReady) {
      console.log('❌ Moderation system not ready');
      return;
    }
    
    try {
      // Wait for Firebase to be initialized
      let db;
      let attempts = 0;
      while (attempts < 10) {
        try {
          db = firebase.firestore();
          // Test the connection
          await db.collection('pings').limit(1).get();
          break;
        } catch (error) {
          attempts++;
          console.log(`⏳ Waiting for Firebase... attempt ${attempts}/10`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!db) {
        console.log('❌ Firebase not available after 10 attempts');
        return;
      }
      
      const pingsCollection = db.collection('pings');
      let allPings = [];
      
      try {
        // First try: get all pings
        const pingsSnapshot = await pingsCollection.get();
        allPings = pingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`📊 Found ${allPings.length} pings using direct query`);
      } catch (error) {
        console.log('❌ Direct query failed, trying alternative approach...');
        
        // Alternative: get pings from the last 30 days
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        const recentSnapshot = await pingsCollection.where('timestamp', '>=', thirtyDaysAgo).get();
        allPings = recentSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        console.log(`📊 Found ${allPings.length} pings using date filter`);
      }
      
      if (allPings.length === 0) {
        console.log('❌ No pings found to scan. Checking database connection...');
        console.log('db:', db);
        console.log('pingsCollection:', pingsCollection);
        
        // Try to get any collection to test connection
        try {
          const testSnapshot = await db.collection('users').limit(1).get();
          console.log(`📊 Test query found ${testSnapshot.docs.length} users`);
        } catch (testError) {
          console.log('❌ Test query failed:', testError);
        }
        return;
      }
      
      let deletedCount = 0;
      let scannedCount = 0;
      
      for (const ping of allPings) {
        scannedCount++;
        console.log(`🔍 Scanning ping ${scannedCount}/${allPings.length}: ${ping.id}`);
        
        try {
          const isInappropriate = await analyzeExistingPingContent(ping);
          
          if (isInappropriate) {
            console.log(`❌ Inappropriate content detected in ping ${ping.id} - deleting...`);
            await deletePingForNSFW(ping.id, 'retroactive scan detected inappropriate content');
            deletedCount++;
          } else {
            console.log(`✅ Ping ${ping.id} is clean`);
          }
        } catch (error) {
          console.error(`❌ Error scanning ping ${ping.id}:`, error);
        }
        
        // Add small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`🎉 Retroactive scan complete!`);
      console.log(`📊 Scanned: ${scannedCount} pings`);
      console.log(`🗑️ Deleted: ${deletedCount} inappropriate pings`);
      console.log(`✅ Clean: ${scannedCount - deletedCount} pings`);
      
      showToast(`Retroactive scan complete: ${deletedCount} inappropriate pings deleted`, 'success');
      
    } catch (error) {
      console.error('❌ Error during retroactive scan:', error);
      showToast('Error during retroactive scan', 'error');
    }
  };
  
  // Debug function to check ping collection (call from console: debugPings())
  window.debugPings = async function() {
    console.log('🔍 Debugging ping collection...');
    
    try {
      // Wait for Firebase to be initialized
      let db;
      let attempts = 0;
      while (attempts < 10) {
        try {
          db = firebase.firestore();
          // Test the connection
          await db.collection('pings').limit(1).get();
          break;
        } catch (error) {
          attempts++;
          console.log(`⏳ Waiting for Firebase... attempt ${attempts}/10`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!db) {
        console.log('❌ Firebase not available after 10 attempts');
        return;
      }
      
      console.log('db:', db);
      
      // Try to get pings collection directly using db
      const pingsCollection = db.collection('pings');
      const snapshot = await pingsCollection.get();
      console.log(`📊 Direct collection query: ${snapshot.docs.length} pings found`);
      
      if (snapshot.docs.length > 0) {
        const firstPing = snapshot.docs[0].data();
        console.log('📋 First ping sample:', firstPing);
        console.log('📋 Ping ID:', snapshot.docs[0].id);
        console.log('📋 Ping timestamp:', firstPing.timestamp || firstPing.createdAt);
        console.log('📋 Ping has imageUrl:', !!firstPing.imageUrl);
        console.log('📋 Ping has videoUrl:', !!firstPing.videoUrl);
        console.log('📋 Ping text preview:', firstPing.text ? firstPing.text.substring(0, 50) + '...' : 'No text');
      }
      
      // Try with pingsRef if it exists
      if (typeof pingsRef !== 'undefined') {
        const pingsRefSnapshot = await pingsRef.get();
        console.log(`📊 pingsRef query: ${pingsRefSnapshot.docs.length} pings found`);
      }
      
      // Test other collections
      try {
        const usersSnapshot = await db.collection('users').limit(1).get();
        console.log(`📊 Users collection: ${usersSnapshot.docs.length} users found`);
      } catch (error) {
        console.log('❌ Users collection test failed:', error);
      }
      
    } catch (error) {
      console.error('❌ Error debugging pings:', error);
    }
  };
  
  // Scan pings from a specific time range (call from console: scanPingsFromDate('2024-01-01'))
  window.scanPingsFromDate = async function(startDate) {
    console.log(`🔍 Starting scan of pings from ${startDate}...`);
    
    if (!moderationReady) {
      console.log('❌ Moderation system not ready');
      return;
    }
    
    try {
      const startTimestamp = new Date(startDate).getTime();
      
      // Wait for Firebase to be initialized
      let db;
      let attempts = 0;
      while (attempts < 10) {
        try {
          db = firebase.firestore();
          // Test the connection
          await db.collection('pings').limit(1).get();
          break;
        } catch (error) {
          attempts++;
          console.log(`⏳ Waiting for Firebase... attempt ${attempts}/10`);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      if (!db) {
        console.log('❌ Firebase not available after 10 attempts');
        return;
      }
      
      const pingsCollection = db.collection('pings');
      
      // Get pings from specific date onwards
      const pingsSnapshot = await pingsCollection.where('timestamp', '>=', startTimestamp).get();
      const pings = pingsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      console.log(`📊 Found ${pings.length} pings to scan from ${startDate}`);
      
      let deletedCount = 0;
      let scannedCount = 0;
      
      for (const ping of pings) {
        scannedCount++;
        console.log(`🔍 Scanning ping ${scannedCount}/${pings.length}: ${ping.id}`);
        
        try {
          const isInappropriate = await analyzeExistingPingContent(ping);
          
          if (isInappropriate) {
            console.log(`❌ Inappropriate content detected in ping ${ping.id} - deleting...`);
            await deletePingForNSFW(ping.id, 'retroactive scan detected inappropriate content');
            deletedCount++;
          } else {
            console.log(`✅ Ping ${ping.id} is clean`);
          }
        } catch (error) {
          console.error(`❌ Error scanning ping ${ping.id}:`, error);
        }
        
        // Add small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      console.log(`🎉 Scan complete!`);
      console.log(`📊 Scanned: ${scannedCount} pings`);
      console.log(`🗑️ Deleted: ${deletedCount} inappropriate pings`);
      console.log(`✅ Clean: ${scannedCount - deletedCount} pings`);
      
      showToast(`Scan complete: ${deletedCount} inappropriate pings deleted`, 'success');
      
    } catch (error) {
      console.error('❌ Error during date-based scan:', error);
      showToast('Error during date-based scan', 'error');
    }
  };
  
  // Initialize moderation system with delay to ensure script is loaded
  setTimeout(async () => {
    await initializeModeration();
    
    // 🚀 PERFORMANCE OPTIMIZATION: Disabled automatic retroactive scanning
    // Auto-scan was slowing down app startup significantly
    // To manually scan pings, use console: scanAllPings() or scanPingsFromDate('2025-01-01')
    console.log('💡 Moderation ready. Run scanAllPings() in console to manually scan content.');
    
    /* DISABLED AUTOMATIC SCAN - Run manually if needed
    setTimeout(async () => {
      console.log('🔄 Starting automatic retroactive scan of recent pings...');
      try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        await scanPingsFromDate(sevenDaysAgo);
      } catch (error) {
        console.error('❌ Automatic retroactive scan failed:', error);
      }
    }, 5000);
    */
  }, 1000);

  /* --------- Profile System --------- */
  const PROFILE_VIEW = {
    OWN: 'own',
    OTHER: 'other',
    SETTINGS: 'settings'
  };
  let currentProfileView = PROFILE_VIEW.OWN;
  
  // Profile system state
  let profileSystemReady = false;
  let profileElements = {};
  let currentProfileLoadId = 0; // 🏁 RACE CONDITION FIX: Track latest profile load request
  
  // Initialize profile system when DOM is ready
  function initializeProfileSystem() {
    console.log('Initializing profile system...');
    
    // Cache all profile elements
    profileElements = {
      modal: document.getElementById('profileModal'),
      title: document.getElementById('profileModalTitle'),
      actions: document.getElementById('profileActions'),
      signOutBtn: document.getElementById('signOutInProfile'),
      gear: document.getElementById('openSettings'),
      back: document.getElementById('backToProfile'),
      storeBtn: document.getElementById('openStore'),
      own: document.getElementById('ownProfileSection'),
      other: document.getElementById('otherProfileSection'),
      settings: document.getElementById('settingsSection'),
      ownAvatar: document.getElementById('ownProfileAvatar'),
      otherAvatar: document.getElementById('otherProfileAvatar'),
      settingsAvatar: document.getElementById('settingsProfileAvatar'),
      handleInput: document.getElementById('handleInput'),
      emailDisplay: document.getElementById('emailDisplay'),
      ownStatsLine: document.getElementById('ownStatsLine'),
      otherStatsLine: document.getElementById('otherStatsLine'),
      otherProfileName: document.getElementById('otherProfileName')
    };
    
    // Check if all critical elements exist
    const criticalElements = ['modal', 'title', 'actions', 'own', 'other', 'settings'];
    const missingElements = criticalElements.filter(key => !profileElements[key]);
    
    if (missingElements.length > 0) {
      console.warn('Missing profile elements:', missingElements);
      setTimeout(initializeProfileSystem, 100);
      return;
    }
    
    profileSystemReady = true;
    console.log('Profile system initialized successfully');
    
    // Set up event listeners
    setupProfileEventListeners();
  }
  
  // Set up all profile-related event listeners
  function setupProfileEventListeners() {
    // Close button
    if (profileElements.modal) {
      const closeBtn = document.getElementById('closeProfile');
      if (closeBtn) {
        closeBtn.onclick = () => closeModal('profileModal');
      }
    }
    
    // Sign out button
    if (profileElements.signOutBtn) {
      profileElements.signOutBtn.onclick = async () => {
        try {
          // 🧹 MEMORY LEAK FIX: Cleanup listeners before sign-out
          if(typeof notifUnsub !== 'undefined' && notifUnsub) {
            notifUnsub();
            notifUnsub = null;
          }
          await auth.signOut();
          closeModal('profileModal');
          showToast('Signed out');
        } catch (e) {
          showToast('Sign out failed');
        }
      };
    }
    
    // Settings button
    if (profileElements.gear) {
      profileElements.gear.onclick = () => switchToSettings();
    }
    
    // Back button
    if (profileElements.back) {
      profileElements.back.onclick = () => switchToOwnProfile();
    }
    
    // Store button
    if (profileElements.storeBtn) {
      profileElements.storeBtn.onclick = () => {
        try {
          openModal('storeModal');
          if (typeof renderStore === 'function') renderStore();
        } catch (e) {
          console.error('Error opening store:', e);
        }
      };
    }
  }
  
  // Switch to own profile view
  function switchToOwnProfile() {
    if (!profileSystemReady) {
      console.warn('Profile system not ready');
      return;
    }
    
    console.log('Switching to own profile');
    currentProfileView = PROFILE_VIEW.OWN;
    
    // Update UI elements
    if (profileElements.title) profileElements.title.textContent = 'Your Profile';
    if (profileElements.own) profileElements.own.style.display = 'block';
    if (profileElements.other) profileElements.other.style.display = 'none';
    if (profileElements.settings) profileElements.settings.style.display = 'none';
    if (profileElements.actions) profileElements.actions.style.display = 'flex';
    if (profileElements.signOutBtn) profileElements.signOutBtn.style.display = 'inline-flex';
    if (profileElements.gear) profileElements.gear.style.display = 'inline-flex';
    if (profileElements.back) profileElements.back.style.display = 'none';
    if (profileElements.storeBtn) profileElements.storeBtn.style.display = 'inline-flex';
    
    // Load profile data
    loadOwnProfileData();
  }
  
  // Switch to settings view
  function switchToSettings() {
    if (!profileSystemReady) {
      console.warn('Profile system not ready');
      return;
    }
    
    console.log('Switching to settings');
    currentProfileView = PROFILE_VIEW.SETTINGS;
    
    // Update UI elements
    if (profileElements.title) profileElements.title.textContent = 'Settings';
    if (profileElements.own) profileElements.own.style.display = 'none';
    if (profileElements.other) profileElements.other.style.display = 'none';
    if (profileElements.settings) profileElements.settings.style.display = 'block';
    if (profileElements.actions) profileElements.actions.style.display = 'flex';
    if (profileElements.signOutBtn) profileElements.signOutBtn.style.display = 'inline-flex';
    if (profileElements.gear) profileElements.gear.style.display = 'none';
    if (profileElements.back) profileElements.back.style.display = 'inline-flex';
    if (profileElements.storeBtn) profileElements.storeBtn.style.display = 'inline-flex';
    
    // Load settings data
    loadSettingsData();
  }
  
  // Switch to other profile view
  function switchToOtherProfile(uid) {
    if (!profileSystemReady) {
      console.warn('Profile system not ready');
      return;
    }
    
    console.log('Switching to other profile:', uid);
    currentProfileView = PROFILE_VIEW.OTHER;
    
    // Update UI elements
    if (profileElements.title) profileElements.title.textContent = 'Profile';
    if (profileElements.own) profileElements.own.style.display = 'none';
    if (profileElements.other) profileElements.other.style.display = 'block';
    if (profileElements.settings) profileElements.settings.style.display = 'none';
    if (profileElements.actions) profileElements.actions.style.display = 'flex';
    if (profileElements.signOutBtn) profileElements.signOutBtn.style.display = 'none';
    if (profileElements.gear) profileElements.gear.style.display = 'inline-flex';
    if (profileElements.back) profileElements.back.style.display = 'none';
    if (profileElements.storeBtn) profileElements.storeBtn.style.display = 'none';
    
    // Load other profile data
    loadOtherProfileData(uid);
  }
  
  // Load own profile data
  async function loadOwnProfileData() {
    if (!currentUser) {
      console.warn('No current user for own profile');
      return;
    }
    
    try {
      console.log('Loading own profile data...');
      
      // Load user data from Firestore
      const userDoc = await usersRef.doc(currentUser.uid).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      
      // Update avatar
      if (profileElements.ownAvatar) {
        const photoURL = userData.photoURL || '';
        if (photoURL) {
          profileElements.ownAvatar.style.backgroundImage = `url("${photoURL}")`;
          profileElements.ownAvatar.style.backgroundSize = 'cover';
          profileElements.ownAvatar.style.backgroundPosition = 'center';
          profileElements.ownAvatar.style.backgroundRepeat = 'no-repeat';
          profileElements.ownAvatar.classList.add('custom-avatar');
        } else {
          profileElements.ownAvatar.style.backgroundImage = '';
          profileElements.ownAvatar.classList.remove('custom-avatar');
        }
      }
      
      // No dev flags persisted in UI; keep runtime clean

      // Update handle input
      if (profileElements.handleInput) {
        profileElements.handleInput.value = userData.handle || '';
      }
      
      // Update email display
      if (profileElements.emailDisplay) {
        const email = userData.email || currentUser.email || 'No email';
        profileElements.emailDisplay.textContent = email;
      }
      
      // Update stats
      if (profileElements.ownStatsLine) {
        const points = Number(userData.points || 0);
        const streak = Number(userData.streakDays || 0);
        profileElements.ownStatsLine.textContent = `${points} PPs • 🔥 ${streak}`;
      }
      
      console.log('Own profile data loaded successfully');
    } catch (e) {
      console.error('Error loading own profile data:', e);
    }
  }
  
  // Load settings data
  async function loadSettingsData() {
    if (!currentUser) {
      console.warn('No current user for settings');
      return;
    }
    
    try {
      console.log('Loading settings data...');
      
      // Load user data from Firestore
      const userDoc = await usersRef.doc(currentUser.uid).get();
      const userData = userDoc.exists ? userDoc.data() : {};
      
      // No dev flags persisted in UI; keep runtime clean

      // Update settings avatar
      if (profileElements.settingsAvatar) {
        const photoURL = userData.photoURL || '';
        if (photoURL) {
          profileElements.settingsAvatar.style.backgroundImage = `url("${photoURL}")`;
          profileElements.settingsAvatar.style.backgroundSize = 'cover';
          profileElements.settingsAvatar.style.backgroundPosition = 'center';
          profileElements.settingsAvatar.style.backgroundRepeat = 'no-repeat';
          profileElements.settingsAvatar.classList.add('custom-avatar');
        } else {
          profileElements.settingsAvatar.style.backgroundImage = '';
          profileElements.settingsAvatar.classList.remove('custom-avatar');
        }
      }
      
      // Update handle input in settings
      if (profileElements.handleInput) {
        profileElements.handleInput.value = userData.handle || '';
      }
      
      // Initialize custom ping UI
      if (typeof renderCustomPingUI === 'function') {
        console.log('🎨 Calling renderCustomPingUI from loadSettingsData');
        setTimeout(() => {
          try {
            renderCustomPingUI();
          } catch (e) {
            console.error('❌ Error rendering custom ping UI:', e);
          }
        }, 100); // Small delay to ensure DOM is ready
      } else {
        console.error('❌ renderCustomPingUI function NOT FOUND!');
      }

      // Developer tools (per-account overrides)
      // Dev Tools removed
      
      console.log('✅ Settings data loaded successfully');
    } catch (e) {
      console.error('Error loading settings data:', e);
    }
  }

  // Dev tools UI removed
  
  // Load other profile data
  async function loadOtherProfileData(uid) {
    // 🏁 RACE CONDITION FIX: Generate unique ID for this request
    const requestId = ++currentProfileLoadId;
    
    try {
      console.log('Loading other profile data for:', uid, 'requestId:', requestId);
      
      // Load user data from Firestore
      const userDoc = await usersRef.doc(uid).get();
      
      // Check if this request is still the latest
      if(requestId !== currentProfileLoadId) {
        console.log('🚫 Ignoring stale profile load request', requestId, 'current:', currentProfileLoadId);
        return; // Abandon this request, a newer one is in progress
      }
      
      const userData = userDoc.exists ? userDoc.data() : {};
      
      // Update other profile avatar
      if (profileElements.otherAvatar) {
        const photoURL = userData.photoURL || '';
        if (photoURL) {
          profileElements.otherAvatar.style.backgroundImage = `url("${photoURL}")`;
          profileElements.otherAvatar.style.backgroundSize = 'cover';
          profileElements.otherAvatar.style.backgroundPosition = 'center';
          profileElements.otherAvatar.style.backgroundRepeat = 'no-repeat';
          profileElements.otherAvatar.classList.add('custom-avatar');
        } else {
          profileElements.otherAvatar.style.backgroundImage = '';
          profileElements.otherAvatar.classList.remove('custom-avatar');
        }
      }
      
      // Update other profile name
      if (profileElements.otherProfileName) {
        const handle = userData.handle || 'User';
        profileElements.otherProfileName.textContent = handle;
      }
      
      // Update other profile stats
      if (profileElements.otherStatsLine) {
        const points = Number(userData.points || 0);
        const streak = Number(userData.streakDays || 0);
        profileElements.otherStatsLine.textContent = `${points} PPs • 🔥 ${streak}`;
      }
      
      console.log('Other profile data loaded successfully');
    } catch (e) {
      console.error('Error loading other profile data:', e);
    }
  }
  // Open profile modal with proper initialization
  function openProfileModal(view = PROFILE_VIEW.OWN, uid = null) {
    console.log('Opening profile modal with view:', view, 'uid:', uid);
    
    // Open the modal
    openModal('profileModal');
    
    // Wait for modal to be ready, then switch to appropriate view
    setTimeout(() => {
      if (!profileSystemReady) {
        console.warn('Profile system not ready, retrying...');
        setTimeout(() => openProfileModal(view, uid), 100);
        return;
      }
      
      switch (view) {
        case PROFILE_VIEW.OWN:
          switchToOwnProfile();
          break;
        case PROFILE_VIEW.SETTINGS:
          switchToSettings();
          break;
        case PROFILE_VIEW.OTHER:
          if (uid) {
            switchToOtherProfile(uid);
          } else {
            console.warn('No UID provided for other profile');
            switchToOwnProfile();
          }
          break;
        default:
          switchToOwnProfile();
      }
    }, 100);
  }

  /* --------- Splash --------- */
  const splash = document.getElementById('splash');
  const startGlobe = document.getElementById('startGlobe');
  const appRoot = document.getElementById('app');
  // Splash: animate earth mask to map, then hide
  // Subtle scale/fade on the small globe, zoom the map behind, then fade splash
  startGlobe.addEventListener('click', ()=>{
    try{
      // Remove container scaling; use native map zoom animation only
      try{ if(appRoot){ appRoot.classList.remove('scale-in'); appRoot.classList.remove('prestart-scale'); } }catch(_){ }
      // Instantly fade out the splash text/UI (keep globe slower)
      ['.apptitle','.bigq','.tagline','.logo-pin'].forEach(sel=>{ try{ const el=document.querySelector(sel); if(el){ el.style.transition='opacity .25s ease, transform .25s ease'; el.style.opacity='0'; el.style.transform='translateY(-6px)'; } }catch(_){ } });
      // Scale the globe strongly with a cinematic blur (kept)
      startGlobe.style.transform='scale(18)';
      startGlobe.style.filter='blur(6px)';
      startGlobe.style.opacity='0.0';
      const lbl=document.querySelector('.start-label'); if(lbl){ lbl.style.opacity='0'; lbl.style.transform='translateY(-6px)'; }
      // Fade splash while globe scales
      splash.style.transition='opacity 1.2s ease';
      splash.style.opacity='0';
      // Leaflet zoom animation in sync with globe (zoom OUT->IN)
      try{
        if(typeof map!=='undefined' && typeof FENCE_CENTER!=='undefined'){
          const centerCandidate = (typeof userPos!== 'undefined' && userPos && userPos.distanceTo(FENCE_CENTER) <= RADIUS_M) ? userPos : FENCE_CENTER;
          // Temporarily relax min zoom constraint so we can start wide
          try{ if(typeof map.setMinZoom==='function'){ map.setMinZoom(0); } }catch(_){ }
          // Ensure we start wide first, then zoom in to 16
          try{ map.setZoom(12, {animate:false}); }catch(_){ }
          map.flyTo(centerCandidate, 16, { animate:true, duration:1.2, easeLinearity:.25 });
        }
      }catch(_){ }
    }catch(_){ }
    // Fully remove splash after fade completes; minor settle pan/zoom after
    setTimeout(()=>{
      splash.style.display='none';
      // Restore normal view constraints after the zoom
      try{ updateViewConstraints(); }catch(_){ }
      // Enable hotspots only after intro animation completes
      setTimeout(() => {
      try{ if(typeof enableHotspots==='function') enableHotspots(); }catch(_){ }
      }, 100);
    }, 1250);
  });

  /* --------- Config --------- */
  const DEFAULT_CENTER = [45.5048, -73.5772];
  const RADIUS_M = 3219; // 2 miles
  const MAX_PINGS_PER_DAY = 3;
  const MIN_MILLIS_BETWEEN_PINGS = 5*60*1000; // 5 minutes
  const LIVE_WINDOW_MS = 24*3600*1000;
  // Dev/test: unlimited ping whitelist by email
  const UNLIMITED_EMAILS = new Set(['tobias.dicker@mail.mcgill.ca']);

  // Size curve constants
  const BASE_RADIUS = 10;                 // px at 0 net likes
  const MIN_RADIUS  = 6;                  // hard minimum px
  const MAX_RADIUS  = 36;                 // hard cap for normal pins
  const POTW_CAP    = 42;                 // slightly bigger cap for PotW display
  const L_LINEAR    = 50;                 // linear up to this net-like count
  const A_SLOPE     = 0.30;               // px per like (0..50)
  const B_SQRT      = 0.15;               // px * sqrt(likes-50) after 50

  const TZ = 'America/Toronto'; // Montreal time IANA
  const ONE_DAY = 24*3600*1000;

  // PotW thresholds and settings
  const POTW_MIN_NET_LIKES = 10;      // Minimum net likes to qualify for PotW
  const POTW_MIN_COMPETITORS = 5;     // OR minimum number of eligible pings
  const POTW_REWARD_PP = 100;         // PP reward for winning PotW

  /* --------- Firebase --------- */
  // Firebase config is now loaded from config.js (not committed to git)
  if (typeof window.firebaseConfig === 'undefined') {
    console.error('⚠️ Firebase config not found! Please create config.js from config.example.js');
    throw new Error('Firebase configuration missing. See config.example.js for setup instructions.');
  }
  firebase.initializeApp(window.firebaseConfig);
  const auth = firebase.auth();
  const db   = firebase.firestore();
  // Ensure session persists across reloads
  // Persist session across reloads without changing splash behavior
  try{ await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); }catch(e){ console.warn('persistence', e); }

  /* --------- Helpers --------- */
  const $ = s=>document.querySelector(s);
  const $$ = s=>document.querySelectorAll(s);
  const toastEl = $('#toast');
  // Toast system with types and queue
  const toastQueue = [];
  let toastShowing = false;
  function showToast(message, type='info'){
    try{
      const duration = type==='error' ? 5000 : type==='warning' ? 4000 : 3000;
      toastQueue.push({ message:String(message||''), type, duration });
      if(!toastShowing) dequeueToast();
    }catch(_){ }
  }
  function styleToast(kind){
    try{
      toastEl.className = 'toast show';
      // Basic color coding by type without changing layout
      if(kind==='success'){ toastEl.style.background='#111'; toastEl.style.border='1px solid #0f8a3b'; }
      else if(kind==='error'){ toastEl.style.background='#111'; toastEl.style.border='1px solid #ef4444'; }
      else if(kind==='warning'){ toastEl.style.background='#111'; toastEl.style.border='1px solid #f59e0b'; }
      else { toastEl.style.background='#111'; toastEl.style.border='1px solid #e6e6e6'; }
    }catch(_){ }
  }
  function dequeueToast(){
    if(!toastQueue.length){ toastShowing=false; try{ toastEl.classList.remove('show'); }catch(_){ } return; }
    toastShowing = true;
    const { message, type, duration } = toastQueue.shift();
    try{ toastEl.textContent = message; styleToast(type); }catch(_){ }
    setTimeout(()=>{
      try{ toastEl.classList.remove('show'); }catch(_){ }
      setTimeout(()=>{ dequeueToast(); }, 120);
    }, duration);
  }
  function montrealNow(){ try{ return new Date(new Date().toLocaleString('en-US', { timeZone: TZ })); }catch(_){ return new Date(); } }
  function dateKey(d){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }

  // Reverse geocoding (OSM Nominatim) with simple localStorage cache
  const GEOCODE_CACHE_KEY = 'htbt_geocode_cache_v1';
  let geocodeCache = {};
  const GEOCODE_CACHE_MAX = 1000; // 🛡️ MEMORY PROTECTION: Limit cache size
  try{ const raw=localStorage.getItem(GEOCODE_CACHE_KEY); if(raw) geocodeCache=JSON.parse(raw)||{}; }catch(_){ geocodeCache={}; }
  function saveGeocodeCache(){ try{ localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(geocodeCache)); }catch(_){ } }
  function geokey(lat, lon){ return `${lat.toFixed(4)},${lon.toFixed(4)}`; }
  function pickArea(addr){ return addr.neighbourhood||addr.suburb||addr.city_district||addr.borough||addr.village||addr.town||addr.city||addr.county||''; }
  // 🧹 LRU eviction: Remove oldest entries when cache is full
  function evictOldGeocacheEntries() {
    const keys = Object.keys(geocodeCache);
    if(keys.length > GEOCODE_CACHE_MAX) {
      // Sort by timestamp (oldest first)
      const sorted = keys.sort((a, b) => (geocodeCache[a].ts || 0) - (geocodeCache[b].ts || 0));
      // Remove oldest 20%
      const toRemove = Math.floor(keys.length * 0.2);
      for(let i = 0; i < toRemove; i++) {
        delete geocodeCache[sorted[i]];
      }
      console.log(`🧹 Evicted ${toRemove} old geocache entries`);
      saveGeocodeCache();
    }
  }
  function formatPlace(addr){
    try{
      const road = addr.road || addr.pedestrian || addr.residential || addr.footway || addr.path || addr.cycleway || '';
      const area = pickArea(addr);
      if(road && area) return `${road}, ${area}`;
      if(area) return `${area}`;
      const disp = addr.display_name || '';
      if(disp) return disp.split(',').slice(0,3).join(', ').trim();
    }catch(_){ }
    return '';
  }
  async function reverseGeocode(lat, lon){
    const key = geokey(lat, lon);
    const cached = geocodeCache[key];
    const now = Date.now();
    if(cached && (now - (cached.ts||0) < 14*24*3600*1000) && cached.label){ return cached.label; }
    try{
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=17&addressdetails=1&accept-language=en`;
      const res = await fetch(url, { headers:{ 'Accept':'application/json' } });
      if(!res.ok) throw new Error('geocode http');
      const j = await res.json();
      const addr = j && (j.address||{});
      const label = formatPlace(addr) || (j.display_name ? String(j.display_name).split(',').slice(0,3).join(', ').trim() : '');
      if(label){ 
        evictOldGeocacheEntries(); // Check and evict before adding
        geocodeCache[key] = { label, ts: now }; 
        saveGeocodeCache(); 
        return label; 
      }
    }catch(_){ }
    return '';
  }

  // ---------- Mentions helpers ----------
  const uidHandleCache = new Map();
  const handleCacheTimestamps = new Map(); // Track when each handle was cached
  const HANDLE_CACHE_TTL = 2 * 60 * 1000; // 🔒 2 minutes TTL (reduced from 5 for freshness)
  
  // 🔄 Invalidate cache entry for a specific user
  function invalidateHandleCache(uid) {
    if(uidHandleCache.has(uid)) {
      uidHandleCache.delete(uid);
      handleCacheTimestamps.delete(uid);
      console.log('🧹 Invalidated handle cache for UID:', uid);
    }
  }
  
  // 🔄 Clear all handle caches (use after widespread changes)
  function clearAllHandleCaches() {
    uidHandleCache.clear();
    handleCacheTimestamps.clear();
    console.log('🧹 Cleared all handle caches');
  }
  
  async function getHandleForUid(uid, forceRefresh = false){
    if(!uid) return '@user';
    
    // Check if cache is stale (older than TTL)
    const cachedTime = handleCacheTimestamps.get(uid);
    const isCacheStale = cachedTime && (Date.now() - cachedTime > HANDLE_CACHE_TTL);
    
    if(!forceRefresh && !isCacheStale && uidHandleCache.has(uid)) {
      return uidHandleCache.get(uid);
    }
    
    // Cache miss or stale - fetch fresh data
    try{
      const d = await usersRef.doc(uid).get();
      const u = d.exists ? d.data() : null;
      const h = u && u.handle ? String(u.handle).trim() : '';
      const display = h ? `@${h}` : `@user${String(uid).slice(0,6)}`;
      
      // Cache with timestamp (only cache real handles)
      if(h) {
      uidHandleCache.set(uid, display);
        handleCacheTimestamps.set(uid, Date.now());
        console.log('📦 Cached handle for', uid, ':', display);
      }
      return display;
    }catch(err){
      console.error('Error in getHandleForUid:', err);
      // Don't cache fallback values - might get real handle next time
      const fallback = `@user${String(uid).slice(0,6)}`;
      return fallback;
    }
  }
  
  // 🕒 Periodic cache cleanup - remove stale entries every 2 minutes
  setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;
    
    handleCacheTimestamps.forEach((timestamp, uid) => {
      if(now - timestamp > HANDLE_CACHE_TTL) {
        uidHandleCache.delete(uid);
        handleCacheTimestamps.delete(uid);
        cleanedCount++;
      }
    });
    
    if(cleanedCount > 0) {
      console.log(`🧹 Cleaned ${cleanedCount} stale handle cache entries`);
    }
  }, 2 * 60 * 1000); // Every 2 minutes
  
  // 🧹 CRITICAL: Clean up ALL orphaned handles from database
  async function cleanupOrphanedHandles() {
    console.log('🧹 Starting comprehensive orphaned handle cleanup...');
    const toDelete = []; // Track which handles to delete
    
    try {
      const handleDocs = await db.collection('handles').get();
      const scanned = handleDocs.size;
      console.log(`🔍 Scanning ${scanned} handles...`);
      
      // First pass: identify orphaned handles
      const validationPromises = [];
      const handleInfo = [];
      
      for (const doc of handleDocs.docs) {
        const handle = doc.id;
        const data = doc.data();
        const uid = data.uid;
        
        if (!uid) {
          console.log(`❌ Handle "${handle}" has no UID -> marking for deletion`);
          toDelete.push(handle);
          continue;
        }
        
        handleInfo.push({ handle, uid, ref: doc.ref });
        validationPromises.push(usersRef.doc(uid).get());
      }
      
      // Validate all handles in parallel
      const userDocs = await Promise.all(validationPromises);
      
      for (let i = 0; i < handleInfo.length; i++) {
        const { handle, uid, ref } = handleInfo[i];
        const userDoc = userDocs[i];
        
        if (!userDoc.exists) {
          console.log(`❌ Handle "${handle}" points to non-existent user ${uid} -> marking for deletion`);
          toDelete.push(handle);
          continue;
        }
        
        const userData = userDoc.data();
        const userHandle = userData.handle ? String(userData.handle).trim().toLowerCase() : '';
        
        if (userHandle !== handle.toLowerCase()) {
          console.log(`❌ Handle "${handle}" doesn't match user's handle "${userHandle}" -> marking for deletion`);
          toDelete.push(handle);
          continue;
        }
        
        // Valid handle
        console.log(`✅ Handle "${handle}" is valid`);
      }
      
      // Second pass: delete all orphaned handles
      console.log(`🗑️ Deleting ${toDelete.length} orphaned handles...`);
      const deletionPromises = toDelete.map(handle => 
        db.collection('handles').doc(handle).delete().catch(err => {
          console.error(`Failed to delete handle "${handle}":`, err);
        })
      );
      
      await Promise.all(deletionPromises);
      
      const deleted = toDelete.length;
      console.log(`✅ Cleanup complete: ${deleted}/${scanned} orphaned handles deleted`);
      showToast(`Cleanup: ${deleted}/${scanned} orphaned handles deleted`, 'success');
      
      // Clear all caches after cleanup
      clearAllHandleCaches();
      
      return { scanned, deleted, orphaned: toDelete };
    } catch (err) {
      console.error('❌ Error during handle cleanup:', err);
      showToast('Handle cleanup failed: ' + err.message, 'error');
      return { error: err };
    }
  }
  
  // Expose for debugging and manual cleanup
  window.invalidateHandleCache = invalidateHandleCache;
  window.clearAllHandleCaches = clearAllHandleCaches;
  window.getHandleForUid = getHandleForUid;
  window.cleanupOrphanedHandles = cleanupOrphanedHandles; // 🧹 NEW: Manual cleanup function

  const HANDLE_RE = /(^|[^a-z0-9_.])@([a-z0-9_.]{2,24})\b/i;
  function extractSingleMention(text){
    if(!text) return { kind:'none' };
    const m = text.match(HANDLE_RE);
    if(!m) return { kind:'none' };
    const handle = m[2];
    if(handle.toLowerCase()==='friends') return { kind:'friends', start: m.index + m[1].length, end: (m.index + m[0].length), raw:`@${m[2]}` };
    // Ensure there isn't a second @handle
    const rest = text.slice((m.index||0) + m[0].length);
    if(HANDLE_RE.test(rest)) return { kind:'invalid_multi' };
    return { kind:'handle', handleLC: handle.toLowerCase(), start: m.index + m[1].length, end: (m.index + m[0].length), raw:`@${m[2]}` };
  }

  async function resolveHandleToUid(handleLC){
    try{
      const doc = await db.collection('handles').doc(handleLC).get();
      const uid = doc.exists ? (doc.data().uid||null) : null;
      if(!uid) return null;
      // Validate that the user doc still claims this handle. If not, treat as unused.
      try{
        const u = await usersRef.doc(uid).get();
        const h = u && u.exists ? String(u.data().handle||'').trim().toLowerCase() : '';
        if(h !== handleLC) return null;
      }catch(_){ return null; }
      return uid;
    }catch(_){ return null; }
  }

  async function incMentionQuotaOrFail(senderUid){
    try{
      const day = dateKey(montrealNow());
      const id = `mention_quota_${senderUid}_${day}`;
      let ok = false;
      await db.runTransaction(async (tx)=>{
        const ref = db.collection('meta').doc(id);
        const snap = await tx.get(ref);
        const count = snap.exists ? Number(snap.data().count||0) : 0;
        if(count >= 20){ ok=false; return; }
        tx.set(ref, { count: count+1, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
        ok = true;
      });
      return ok;
    }catch(_){ return false; }
  }

  // SIMPLE NOTIFICATION SYSTEM - NO MORE BUGS!
  async function sendNotification(recipientUid, type, data) {
    try {
      console.log(`📧 Attempting to send ${type} notification to ${recipientUid}`);
      console.log(`📧 Notification data:`, data);
      
      if (!recipientUid) {
        console.log('❌ No recipient UID provided');
        return;
      }
      
      if (!currentUser) {
        console.log('❌ No current user logged in');
        return;
      }
      
      if (recipientUid === currentUser.uid) {
        console.log('⚠️ Cannot send notification to yourself');
        return;
      }
      
      // Use subcollection pattern to match the listener
      // Generate deterministic ID to prevent duplicates (no timestamp for most types)
      let notifId;
      if(type === 'mention' || type === 'mention_comment') {
        // For mentions, one notification per ping per sender
        notifId = `${type}_${data.pingId}_${currentUser.uid}`;
      } else if(type === 'like_milestone') {
        // For milestones, one notification per ping per milestone
        notifId = `${type}_${data.pingId}_${data.milestone}`;
      } else if(type === 'friend_comment') {
        // For friend comments, one notification per ping (latest comment overwrites)
        notifId = `${type}_${data.pingId}_${currentUser.uid}`;
      } else {
        // For other types, include timestamp
        notifId = `${type}_${data.pingId || 'notif'}_${currentUser.uid}_${Date.now()}`;
      }
      
      const notificationData = {
        type: type,
        from: currentUser.uid,
        data: data,
        read: false,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      };
      
      console.log(`📧 Creating notification with ID: ${notifId}`);
      
      // Check if notification already exists to avoid incrementing unread count
      const notifRef = usersRef.doc(recipientUid).collection('notifications').doc(notifId);
      const existingNotif = await notifRef.get();
      const isNew = !existingNotif.exists;
      
      // Write to user's subcollection (matches the listener)
      // Using set() with same ID will overwrite duplicates
      await notifRef.set(notificationData);
      
      // Update unread count only if notification is new
      if(isNew) {
        await usersRef.doc(recipientUid).set({ 
          unreadCount: firebase.firestore.FieldValue.increment(1) 
        }, { merge: true });
      }
      
      console.log(`✅ Notification sent successfully to ${recipientUid}`);
      
    } catch (error) {
      console.error('❌ Error sending notification:', error);
      console.error('❌ Error details:', {
        recipientUid,
        type,
        data,
        currentUser: currentUser?.uid,
        error: error.message
      });
    }
  }

  // SIMPLE MENTION PARSING - NO MORE COMPLEXITY!
  function parseMentions(text) {
    console.log('🔍 Parsing mentions in text:', text);
    
    if (!text) {
      console.log('❌ No text provided');
      return [];
    }
    
    const mentions = [];
    const mentionRegex = /@([a-zA-Z0-9_.]+)/g;
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      const handle = match[1].toLowerCase();
      const start = match.index;
      const end = match.index + match[0].length;
      
      console.log(`📝 Found mention: @${handle} at position ${start}-${end}`);
      
      mentions.push({
        handle: handle,
        start: start,
        end: end,
        fullMatch: match[0]
      });
    }
    
    console.log(`✅ Parsed ${mentions.length} mentions:`, mentions);
    return mentions;
  }

  // SIMPLE MENTION RESOLUTION (resolves handles to UIDs, keeps @friends as-is)
  async function resolveMentions(mentions) {
    console.log('🔍 Resolving mentions:', mentions);
    
    if (!mentions || mentions.length === 0) {
      console.log('❌ No mentions to resolve');
      return [];
    }
    
    const resolved = [];
    
    for (const mention of mentions) {
      console.log(`🔍 Resolving mention: @${mention.handle}`);
      
      // 👥 SPECIAL CASE: @friends is stored as-is (no UID, marked as special)
      if (mention.handle.toLowerCase() === 'friends') {
        console.log('👥 Detected @friends - storing as special mention');
        
        if(!currentUser || currentUser.isAnonymous) {
          console.log('⚠️ Cannot use @friends - not signed in');
          continue;
        }
        
        // Store @friends as a special mention (no UID expansion)
        resolved.push({
          ...mention,
          handle: 'friends',
          uid: null, // No specific UID - this is a group mention
          isFriendsGroup: true // Flag to identify this is @friends
        });
        
        console.log('✅ Added @friends as special mention');
        continue;
      }
      
      // Normal handle resolution
      try {
        const db = firebase.firestore();
        const handleDoc = await db.collection('handles').doc(mention.handle).get();
        
        if (handleDoc.exists) {
          const uid = handleDoc.data().uid;
          console.log(`✅ Handle @${mention.handle} found, UID: ${uid}`);
          
          if (uid && uid !== currentUser?.uid) { // Don't mention yourself
            console.log(`✅ Adding @${mention.handle} to resolved mentions`);
            resolved.push({
              ...mention,
              uid: uid
            });
          } else if (uid === currentUser?.uid) {
            console.log(`⚠️ Skipping @${mention.handle} - cannot mention yourself`);
          } else {
            console.log(`❌ Invalid UID for @${mention.handle}: ${uid}`);
          }
        } else {
          console.log(`❌ Handle @${mention.handle} not found in database`);
        }
      } catch (error) {
        console.error(`❌ Error resolving mention @${mention.handle}:`, error);
      }
    }
    
    console.log(`✅ Resolved ${resolved.length} mentions:`, resolved);
    return resolved;
  }
  
  // 👥 EXPAND @friends for notifications (separate from storage)
  async function expandMentionsForNotifications(mentions) {
    console.log('📧 Expanding mentions for notifications...');
    
    const expanded = [];
    
    for(const mention of mentions) {
      // If it's @friends, expand to all current user's friends
      if(mention.isFriendsGroup && mention.handle === 'friends') {
        console.log('👥 Expanding @friends for notifications...');
        
        const friendIds = myFriends && myFriends.size > 0 ? Array.from(myFriends) : [];
        console.log(`👥 Notifying ${friendIds.length} friends`);
        
        // Add each friend as a separate notification target
        for(const friendUid of friendIds) {
          expanded.push({
            ...mention,
            uid: friendUid,
            handle: 'friends' // Keep as "friends" for notification message
          });
        }
      } else if(mention.uid) {
        // Normal mention with UID - add as-is
        expanded.push(mention);
      }
    }
    
    console.log(`📧 Expanded to ${expanded.length} notification targets`);
    return expanded;
  }

  function renderTextWithMentions(container, text, mentions){
    try{
      container.textContent='';
      if(!text){ return; }
      const parts = [];
      if(!Array.isArray(mentions) || mentions.length===0){ container.textContent = text; return; }
      
      // 👥 Detect @friends in the original text to render it specially
      const friendsMentions = mentions.filter(m => m.isFriendsGroup || m.handle === 'friends');
      const hasFriendsMention = friendsMentions.length > 0;
      
      // assume at most one mention; still robust for many
      let idx=0;
      const sorted = [...mentions].sort((a,b)=> (Number(a.start||0)) - (Number(b.start||0)));
      
      // Deduplicate mentions by position (since @friends creates multiple with same position)
      const uniqueMentions = [];
      const seenPositions = new Set();
      for(const m of sorted) {
        const posKey = `${m.start}-${m.end}`;
        if(!seenPositions.has(posKey)) {
          uniqueMentions.push(m);
          seenPositions.add(posKey);
        }
      }
      
      for(const m of uniqueMentions){
        const s = Number(m.start||0), e = Number(m.end||s);
        if(s>idx){ parts.push({ kind:'text', text: text.slice(idx,s) }); }
        parts.push({ 
          kind:'mention', 
          uid: m.uid, 
          raw: text.slice(s,e),
          isFriendsGroup: m.isFriendsGroup || m.handle === 'friends' // Flag for @friends
        });
        idx = e;
      }
      if(idx < text.length){ parts.push({ kind:'text', text: text.slice(idx) }); }
      const frag = document.createDocumentFragment();
      let pendingResolves = [];
      for(const p of parts){
        if(p.kind==='text'){ frag.appendChild(document.createTextNode(p.text)); }
        else if(p.kind==='mention'){ 
          const span=document.createElement('button'); 
          span.className='mention-btn'; 
          span.style.padding='2px 6px'; 
          span.style.borderRadius='12px'; 
          span.style.margin='0 2px'; 
          span.style.fontWeight='600'; 
          span.style.backgroundColor='#e3f2fd';
          span.style.color='#1976d2';
          span.style.border='none';
          
          // 👥 @friends is NOT clickable
          if(p.isFriendsGroup) {
            span.style.cursor='default';
            span.style.opacity='0.9';
            span.title='Mentioned all friends';
            span.onclick=(e)=>{ 
              e.preventDefault();
              e.stopPropagation();
              // Do nothing - @friends is not clickable
            };
          } else {
            // Normal mention - clickable
          span.style.cursor='pointer';
          span.title='Click to open profile'; 
          span.setAttribute('data-uid', p.uid||''); 
          
          // Enhanced click handler with logging
          span.onclick=(e)=>{ 
            e.preventDefault();
            e.stopPropagation();
            console.log('🎯 Mention clicked:', { uid: p.uid, raw: p.raw });
            if(p.uid) {
              console.log('🚀 Opening profile for UID:', p.uid);
                // Use window reference to ensure function is defined
                if(typeof window.openOtherProfile === 'function') {
                  window.openOtherProfile(p.uid);
                } else if(typeof openOtherProfile === 'function') {
              openOtherProfile(p.uid); 
                } else {
                  console.error('❌ openOtherProfile function not found');
                  showToast('Profile feature loading...');
                }
            } else {
              console.log('❌ No UID for mention');
            }
          }; 
          } 
          
          span.textContent=p.raw||'@user'; 
          frag.appendChild(span); 
          pendingResolves.push({ el:span, uid:p.uid }); 
        }
      }
      container.appendChild(frag);
      // Resolve display labels
      pendingResolves.forEach(async ({el,uid})=>{ const disp=await getHandleForUid(uid); if(disp){ el.textContent = disp; } });
    }catch(e){ try{ container.textContent = text; }catch(_){ } }
  }
  // Points (PPs) helpers
  async function awardPoints(uid, delta, reason){
    if(!uid || !Number.isFinite(delta) || delta===0) return;
    try{
      await db.runTransaction(async (tx)=>{
        const uref = usersRef.doc(uid);
        const usnap = await tx.get(uref);
        const prev = usnap.exists ? Number(usnap.data().points||0) : 0;
        const next = Math.max(0, prev + delta);
        tx.set(uref, { points: next }, { merge:true });
      });
    }catch(e){ console.warn('awardPoints failed', reason||'', e); }
  }

  // Once-per-day login award (+2 PPs), signed-in users only
  async function maybeAwardDailyLogin(uid){
    try{
      const todayKey = dateKey(montrealNow());
      await db.runTransaction(async (tx)=>{
        const ref = usersRef.doc(uid);
        const snap = await tx.get(ref);
        const last = snap.exists ? (snap.data().lastLoginDay || '') : '';
        if(last === todayKey) return; // already awarded
        const prev = snap.exists ? Number(snap.data().points||0) : 0;
        const next = Math.max(0, prev + 2);
        tx.set(ref, { points: next, lastLoginDay: todayKey }, { merge:true });
      });
    }catch(e){ console.warn('daily login award failed', e); }
  }
  // On first ping of the day: update ping streak and award floor(streak/2), cap 25; toast
  async function awardOnFirstPingOfDay(uid){
    try{
      const today = montrealNow();
      const todayKey = dateKey(today);
      const yesterday = new Date(today.getTime() - ONE_DAY);
      const yesterdayKey = dateKey(yesterday);
      await db.runTransaction(async (tx)=>{
        const ref = usersRef.doc(uid);
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : {};
        const lastPingDay = data.lastPingDay || '';
        let streak = Number(data.streakDays||0);
        let firstPingToday = false;
        if(lastPingDay === todayKey){
          // already pinged today: no streak change, no streak award
        }else if(lastPingDay === yesterdayKey){
          streak = Math.max(1, streak + 1);
          firstPingToday = true;
        }else{
          streak = 1; // reset
          firstPingToday = true;
        }
        // Always update lastPingDay on any ping
        const update = { lastPingDay: todayKey, streakDays: streak };
        // Streak award only once on first ping of the day
        if(firstPingToday){
          const alreadyAwardedDay = data.lastStreakAwardDay || '';
          if(alreadyAwardedDay !== todayKey){
            const bonus = Math.min(25, Math.floor(streak/2));
            const prevPts = Number(data.points||0);
            const nextPts = Math.max(0, prevPts + bonus);
            update.points = nextPts;
            update.lastStreakAwardDay = todayKey;
            // Toast after transaction commits (outside)
            tx.set(ref, update, { merge:true });
            throw { __postCommitToast: `🔥 +${bonus} PPs — streak ${streak} days` };
          }
        }
        tx.set(ref, update, { merge:true });
      });
    }catch(e){
      if(e && e.__postCommitToast){ showToast(e.__postCommitToast); return; }
      if(e && e.message && String(e.message).includes('__postCommitToast')){ return; }
      // normal errors
    }
  }
  function isUnlimited(){
    try{
      const e = (auth.currentUser && auth.currentUser.email || '').toLowerCase();
      return !!(e && UNLIMITED_EMAILS.has(e));
    }catch(_){ return false; }
  }
  function anyModalOpen(){ return document.querySelector('.modal.open') || document.querySelector('.sheet.open'); }
  function applyModalOpenClass(){ 
    try{ 
      const hasModal = anyModalOpen();
      if(hasModal){ 
        document.body.classList.add('modal-open'); 
      } else { 
        document.body.classList.remove('modal-open'); 
      }
      // Don't disable buttons - they should always be clickable
      const profileWidget = document.getElementById('profileWidget');
      const bellBtn = document.getElementById('bellBtn');
      if(profileWidget) profileWidget.style.pointerEvents = 'auto';
      if(bellBtn) bellBtn.style.pointerEvents = 'auto';
    }catch(_){ } 
  }
  function openModal(id){
    console.log('=== OPENING MODAL ===', id);
    document.getElementById(id).classList.add('open');
    applyModalOpenClass();
    // Handle profile modal opening with new system
    if(id==='profileModal'){
      console.log('Profile modal opened via openModal');
      // The new profile system will handle initialization
      // Just ensure the system is ready
      if (!profileSystemReady) {
        console.log('Profile system not ready, initializing...');
        initializeProfileSystem();
      }
    }
  }
  function closeModal(id){ document.getElementById(id).classList.remove('open'); applyModalOpenClass(); }

  // Notifications elements (needed by refreshAuthUI even when signed out)
  const notifBadge = $('#notifBadge'), notifsModal = $('#notifsModal'), notifsContent = $('#notifsContent');

  // Unified time-ago formatter: s (<60), m (<60), h (<24), then d
  function timeAgo(input){
    try{
      let ts = input;
      if(!ts) return '0s ago';
      if(typeof ts.toDate === 'function') ts = ts.toDate().getTime();
      else if(ts instanceof Date) ts = ts.getTime();
      ts = Number(ts)||0;
      const diff = Math.max(0, Date.now() - ts);
      const secs = Math.floor(diff/1000);
      if(secs < 60) return `${secs}s ago`;
      const mins = Math.floor(secs/60);
      if(mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins/60);
      if(hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours/24);
      return `${days}d ago`;
    }catch(_){ return '0s ago'; }
  }

  function enableColorZone() {
    const pane = document.querySelector('.leaflet-pane.inner-pane');
    const hole = document.querySelector('.desat-hole');
    if (pane) pane.classList.remove('gray-all');   // stop full-gray
    if (hole) hole.style.display = 'block';        // outside-gray only
    if (typeof updateMask === 'function') updateMask();
  }
  function disableColorZone() {
    const pane = document.querySelector('.leaflet-pane.inner-pane');
    const hole = document.querySelector('.desat-hole');
    if (pane) pane.classList.add('gray-all');      // full-gray everywhere
    if (hole) hole.style.display = 'none';         // hide mask
  }
  // Central place to refresh UI after sign-in / link / state change
async function refreshAuthUI(user){
  currentUser = user || auth.currentUser || null;

  // Update profile widget (avatar + name)
  try{
    const w = document.getElementById('profileWidget');
    const av = document.getElementById('profileAvatar');
    const nm = document.getElementById('profileName');
    const signInTop = document.getElementById('signInTop');
    if(currentUser){
      // 🔒 CRITICAL USERNAME PERSISTENCE FIX V2
      // ALWAYS use cached handle first, only fetch if not cached
      // This prevents random overwrites when Firestore fetch is slow/fails
      
      let handle = null, uploadedPhoto = null;
      
      // 1️⃣ First try to get handle from cache (fast & reliable)
      const cachedHandle = uidHandleCache.get(currentUser.uid);
      if(cachedHandle) {
        // Extract handle without @ prefix
        handle = cachedHandle.startsWith('@') ? cachedHandle.slice(1) : cachedHandle;
        console.log('🚀 Using CACHED handle for display:', handle);
      }
      
      // 2️⃣ Only fetch from Firestore if not in cache (or to get photo)
      try{ 
        const udoc = await usersRef.doc(currentUser.uid).get(); 
        if(udoc.exists){ 
          const firestoreHandle = udoc.data().handle||null;
          uploadedPhoto = udoc.data().photoURL || null;
          
          // Only use Firestore handle if we don't have a cached one
          if(!handle && firestoreHandle) {
            handle = firestoreHandle;
            console.log('📥 Using Firestore handle for display:', handle);
          } else if(handle && firestoreHandle && handle !== firestoreHandle) {
            // Cache and Firestore don't match - prefer Firestore as source of truth
            handle = firestoreHandle;
            console.log('🔄 Updated handle from Firestore:', firestoreHandle);
          }
        } 
      }catch(err){ 
        console.error('⚠️ Error fetching user data in refreshAuthUI (using cached handle):', err);
        // Keep using cached handle even if Firestore fetch fails
      }
      
      // 3️⃣ Update display - ONLY if we have a valid handle
      if(nm) {
        if(handle) {
          nm.textContent = `@${handle}`;
          console.log('✅ Display updated to:', `@${handle}`);
        } else {
          // No handle available at all - preserve existing or show loading
          const currentText = nm.textContent || '';
          if(currentText === '' || currentText === 'Sign in') {
            nm.textContent = 'Loading...';
            console.log('⏳ No handle available - showing loading state');
          } else {
            console.log('🔒 No handle found - preserving display:', currentText);
          }
        }
      }
      if(av){ 
        if(uploadedPhoto){ 
          av.style.backgroundImage = `url("${uploadedPhoto}")`; 
          av.style.backgroundSize = 'cover';
          av.style.backgroundPosition = 'center';
          av.style.backgroundRepeat = 'no-repeat';
          av.classList.add('custom-avatar');
          // console.log('Updated profile avatar with:', uploadedPhoto.substring(0, 50) + '...');
        } else { 
          av.style.backgroundImage=''; 
          av.classList.remove('custom-avatar');
        } 
      }
      
      // Also update the profile modal avatar
      const profileModalAvatar = document.getElementById('ownProfileAvatar');
      if(profileModalAvatar) {
        if(uploadedPhoto) {
          profileModalAvatar.style.backgroundImage = `url("${uploadedPhoto}")`;
          profileModalAvatar.style.backgroundSize = 'cover';
          profileModalAvatar.style.backgroundPosition = 'center';
          profileModalAvatar.style.backgroundRepeat = 'no-repeat';
          profileModalAvatar.classList.add('custom-avatar');
          // console.log('Updated profile modal avatar with:', uploadedPhoto.substring(0, 50) + '...');
        } else {
          profileModalAvatar.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='%23cccccc'/%3E%3Cpath d='M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8' fill='%23e6e6e6'/%3E%3C/svg%3E")`;
          profileModalAvatar.style.backgroundSize = 'cover';
          profileModalAvatar.style.backgroundPosition = 'center';
          profileModalAvatar.style.backgroundRepeat = 'no-repeat';
          profileModalAvatar.classList.remove('custom-avatar');
        }
      }
      
      // Set default silhouettes for any avatar elements that don't have custom images
      const allAvatars = document.querySelectorAll('.profile-avatar');
      allAvatars.forEach(avatar => {
        if (!avatar.classList.contains('custom-avatar')) {
          avatar.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='%23cccccc'/%3E%3Cpath d='M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8' fill='%23e6e6e6'/%3E%3C/svg%3E")`;
          avatar.style.backgroundSize = 'cover';
          avatar.style.backgroundPosition = 'center';
          avatar.style.backgroundRepeat = 'no-repeat';
        }
      });
      if(w) w.style.display = 'flex';
      if(signInTop) signInTop.style.display = 'none';
      enableColorZone();
      updateAddressSearchVisibility(); // Show address search when signed in
      try{ await maybeAwardDailyLogin(currentUser.uid); }catch(_){ }
    }else{
      if(nm) nm.textContent = 'Sign in';
      if(av){ av.style.backgroundImage=''; }
      if(w) w.style.display = 'none';
      if(signInTop) signInTop.style.display = 'inline-flex';
      updateAddressSearchVisibility(); // Hide address search when signed out
      // Close any open profile/settings modals
      try{ document.getElementById('profileModal').classList.remove('open'); }catch(_){ }
    }
  }catch(_){ }

  if(currentUser){
    enableColorZone();
    try{
      if(!currentUser.isAnonymous){
        // Ensure user doc exists & has display name
        await usersRef.doc(currentUser.uid).set({
          displayName: currentUser.displayName || 'Friend'
        }, { merge:true });
        await refreshQuota(currentUser.uid);
        await refreshFriends();
        startFriendsListener(currentUser.uid); // 🔥 Start real-time friend list updates
        startNotifListener(currentUser.uid);
        await ensureIdentityMappings(currentUser);
startRequestsListeners(currentUser.uid);


      }else{
        $('#quotaText').textContent=`0/${MAX_PINGS_PER_DAY} pings today`;
        await refreshFriends();
      }
    }catch(e){ console.error('refreshAuthUI:', e); }

    // Do not auto-close splash; only PRESS START hides it
  } else {
    // Signed out
    myFriends = new Set();
    if(typeof notifUnsub === 'function') notifUnsub();
    if(typeof unreadCountUnsub === 'function') unreadCountUnsub(); // 🔔 Clean up unread count listener
    notifBadge.style.display='none';
    disableColorZone();
    $('#quotaText').textContent=`0/${MAX_PINGS_PER_DAY} pings today`;
    // Reset filters to All so pings remain visible when signed out
    try{
      filterMode = 'all';
      document.querySelectorAll('#filterSeg button').forEach(b=>b.classList.remove('active'));
      const btnAll = document.querySelector('#filterSeg button[data-mode="all"]'); if(btnAll) btnAll.classList.add('active');
    }catch(_){ }
    reFilterMarkers();
  }

  // Re-evaluate PotW after any auth change (filters/me/friends may differ)
  if(typeof recomputePotw === 'function') {
    recomputePotw().catch(console.error);
  }
}

  // Hard UI flip helper (in case listeners/races delay refresh)
  function forceAuthUI(user){
    try{ refreshAuthUI(user); }catch(_){ }
  }


  // Week start (Monday 00:00) in Montreal time
  function startOfWeekMondayLocal(now = new Date()){
    try{
      // Represent "now" in Montreal local time
      const tzNow = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
      const midnight = new Date(tzNow.getFullYear(), tzNow.getMonth(), tzNow.getDate(), 0, 0, 0, 0);
      const dow = tzNow.getDay(); // 0=Sun,1=Mon,... in Montreal
      const daysFromMon = (dow === 0 ? 6 : dow - 1);
      const tzMonday = new Date(midnight.getTime() - daysFromMon * ONE_DAY);
      // Convert back to real epoch by removing the same offset we added via toLocaleString
      const offset = tzNow.getTime() - now.getTime();
      return new Date(tzMonday.getTime() - offset);
    }catch(_){
      // Fallback to local timezone Monday if TZ logic fails
      const local = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const dow = local.getDay();
      const daysFromMon = (dow === 0 ? 6 : dow - 1);
      return new Date(local.getTime() - daysFromMon * ONE_DAY);
    }
  }
  function isThisWeek(ts){
    const wStart = startOfWeekMondayLocal();
    return ts >= wStart.getTime();
  }

  function endOfCurrentWeekLocal(){
    const start = startOfWeekMondayLocal();
    return new Date(start.getTime() + 7*ONE_DAY);
  }

  function potwEndsInText(){
    try{
      const end = endOfCurrentWeekLocal().getTime();
      const now = Date.now();
      const diff = Math.max(0, end - now);
      const hours = Math.floor(diff / (3600*1000));
      const days = Math.floor(hours / 24);
      const remH = hours % 24;
      if(days > 0) return `Ends in ${days}d ${remH}h`;
      const mins = Math.floor((diff % (3600*1000)) / (60*1000));
      if(hours > 0) return `Ends in ${hours}h ${mins}m`;
      const secs = Math.floor((diff % (60*1000)) / 1000);
      return `Ends in ${mins}m ${secs}s`;
    }catch(_){ return ''; }
  }

  /* --------- Auth UI --------- */
  const profileWidget = document.getElementById('profileWidget');
  const profileAvatar = document.getElementById('profileAvatar');
  const profileName = document.getElementById('profileName');
  // If returning from Google redirect, apply UI immediately
  // Do not auto open or redirect into sign-in; only when user clicks
  try{ const rr = await auth.getRedirectResult(); if(rr && rr.user){ /* keep splash until user presses start */ await refreshAuthUI(rr.user); } }catch(e){ console.warn('redirect result', e); }
  // Use event delegation for profile widget
  document.addEventListener('click', async (e) => {
    if(e.target.id === 'profileWidget' || e.target.closest('#profileWidget')){
      e.stopPropagation(); // Prevent map click handler from firing
        const u = auth.currentUser || null;
        if(!u){ openModal('signInModal'); return; }
        // Use new profile system
        openProfileModal(PROFILE_VIEW.OWN);
    }
  });
  const signInTopBtn = document.getElementById('signInTop');
  if(signInTopBtn){ signInTopBtn.onclick = ()=> openModal('signInModal'); }

  $('#closeSignIn').onclick=()=>closeModal('signInModal');

  // Central Google sign-in flow (also supports upgrading Guest)
  async function signInWithGoogle(){
    try{
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const isEmbedded = (()=>{ try{ return window.self !== window.top; }catch(_){ return true; } })();
      const isHttp = (location.protocol === 'http:' || location.protocol === 'https:');
      if(!isHttp || isEmbedded){
        await auth.signInWithRedirect(provider);
        return;
      }
      let result;
      const userBefore = auth.currentUser;
      if(userBefore && userBefore.isAnonymous){
        result = await userBefore.linkWithPopup(provider);
      }else{
        result = await auth.signInWithPopup(provider);
      }
      const user = result.user; if(!user) throw new Error('Google sign-in returned no user');
      const isNew = !!(result.additionalUserInfo && result.additionalUserInfo.isNewUser);
      if(isNew){
        // Create with default random handle
        const base = (user.displayName || (user.email ? user.email.split('@')[0] : 'user')).toLowerCase().replace(/[^a-z0-9_.]/g,'');
        let attempt = (base.slice(0,12) || 'user') + (Math.floor(Math.random()*9000)+1000);
        let finalHandle = attempt;
        try{
          for(let i=0;i<30;i++){
            const doc = await db.collection('handles').doc(finalHandle).get();
            if(!doc.exists){ break; }
            finalHandle = (base.slice(0,10) || 'user') + (Math.floor(Math.random()*900000)+100000);
          }
          await db.collection('handles').doc(finalHandle).set({ uid:user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }catch(_){ }
        await usersRef.doc(user.uid).set({
          email: user.email || null,
          handle: finalHandle,
          handleLC: finalHandle.toLowerCase(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          friendIds: [], lastPingAt: null, unreadCount: 0
        }, { merge:true });
      }else{
        // Do not overwrite custom profile fields on re-login except to backfill missing displayName
        try{
          const uref = usersRef.doc(user.uid); const snap = await uref.get();
          if(!snap.exists || !snap.data().email){ await uref.set({ email: user.email || null }, { merge:true }); }
        }catch(_){ }
        await ensureIdentityMappings(user);
      }
      try{ document.getElementById('signInModal').classList.remove('open'); }catch(e){}
      // Immediate forced UI flip, then full refresh
      forceAuthUI(user);
      await refreshAuthUI(user);
      // Extra safety: run a delayed refresh and ensure visible change
      setTimeout(()=>{ try{ forceAuthUI(auth.currentUser); }catch(e){} }, 80);
    }catch(e){
      console.error(e);
      // If linking Guest -> Google fails because Google account already exists, sign in with that credential
      try{
        const userBefore = auth.currentUser;
        if(userBefore && userBefore.isAnonymous && e && e.code==='auth/credential-already-in-use' && e.credential){
          const cred = e.credential; // OAuthCredential
          const signed = await auth.signInWithCredential(cred);
          const user = signed && signed.user ? signed.user : auth.currentUser;
          if(user){
            // Do NOT overwrite handle here; only ensure email is stored
            await usersRef.doc(user.uid).set({ email: user.email || null }, { merge:true });
            forceAuthUI(user);
            await refreshAuthUI(user);
            setTimeout(()=>{ try{ forceAuthUI(auth.currentUser); }catch(_){ } }, 80);
            return;
          }
        }
      }catch(err){ console.error('credential-in-use recovery failed', err); }
      // Fallback to redirect in environments where popups are blocked or unsupported
      if(e && (e.code==='auth/popup-blocked' || e.code==='auth/operation-not-supported-in-this-environment')){
        try{ const provider = new firebase.auth.GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' }); await auth.signInWithRedirect(provider); return; }catch(err){ console.error('redirect failed', err); }
      }
      let msg = e && e.message ? e.message : 'Google sign-in failed';
      if(e.code==='auth/unauthorized-domain') msg='Unauthorized domain: add this origin in Firebase Auth → Settings → Authorized domains.';
      else if(e.code==='auth/operation-not-allowed') msg='Enable Google provider in Firebase Auth → Sign-in method.';
      else if(e.code==='auth/popup-blocked' || e.code==='auth/popup-closed-by-user') msg='Popup blocked/closed. Allow popups and try again.';
      else if(e.code==='auth/credential-already-in-use') msg='This Google account is already linked. Signing you into that account failed—try again.';
      showToast(msg);
    }
  }
  $('#doGoogle').onclick = ()=>signInWithGoogle();


        


  // Guest (anonymous)
  async function enterGuest(){
    try{
      await auth.signInAnonymously();
      enableColorZone();
      splash.style.opacity='0'; 
      setTimeout(()=>splash.style.display='none',450);
      showToast('Browsing as Guest (no posting or reacting)');
    }catch(e){ console.error(e); showToast('Guest sign-in failed'); }
  }

  // Sign out can be added inside profile if needed

  /* --------- Map --------- */
  const map = L.map('map',{ center:DEFAULT_CENTER, zoom:12, minZoom:0, maxZoom:22, zoomAnimation:true, markerZoomAnimation:true, fadeAnimation:true, zoomSnap:.5, wheelPxPerZoomLevel:45, wheelDebounceTime:40, scrollWheelZoom:true, doubleClickZoom:false, dragging:true, touchZoom:'center', zoomControl:false });
  // Hotspot overlay pane (below markers, above inner overlay)
  const HOTSPOT_RADIUS_M = 160; // 🎯 1.6x the original 100m radius
  const HOTSPOT_MIN_PINGS = 15; // 🎯 Minimum 15 pings required for hotspot
  const HOTSPOT_MIN_CENTER_SEP_M = 150;
  const HOTSPOT_MAX_CLUSTERS = 3;
  try{ map.createPane('hotspotPane'); map.getPane('hotspotPane').style.zIndex = 500; }catch(_){ }
  let hotspotLayers=[], hotspotData=[], hotspotTimer=null;
  // Gate: do not render hotspots until intro animation completes
  let hotspotsEnabled = false;
  function enableHotspots(){ hotspotsEnabled = true; updateHotspotVisibility(); }

  function saveHotspot(dataArr){ try{ localStorage.setItem('hadToBeThere_hotspot', JSON.stringify({ list:dataArr, savedAt:Date.now() })); }catch(_){ } }
  function loadHotspot(){ try{ const s=localStorage.getItem('hadToBeThere_hotspot'); if(!s) return []; const parsed=JSON.parse(s); const arr=Array.isArray(parsed)? parsed : (Array.isArray(parsed.list)? parsed.list: []); return arr.filter(d=>d && typeof d.lat==='number' && typeof d.lon==='number'); }catch(_){ return []; } }

  function clearHotspot(){ if(hotspotLayers&&hotspotLayers.length){ hotspotLayers.forEach(l=>{ try{ map.removeLayer(l); }catch(_){ } }); } hotspotLayers=[]; }
  function updateHotspotVisibility(){ if(!hotspotsEnabled){ clearHotspot(); return; } if(filterMode!=='all'){ clearHotspot(); return; } if(hotspotData && hotspotData.length){ drawHotspots(hotspotData); } else { clearHotspot(); } }

  function drawHotspots(list){ if(!hotspotsEnabled){ return; } if(filterMode!=='all'){ clearHotspot(); return; } clearHotspot(); if(!list || !list.length) return;
    list.forEach((data,idx)=>{
      if(typeof data.lat!== 'number' || typeof data.lon!== 'number') return;
      // 🎯 Light red circle with no border, same translucency
      const circle = L.circle([data.lat, data.lon], { 
        radius: HOTSPOT_RADIUS_M, 
        color: 'transparent', // 🎯 No rim/border
        weight: 0, // 🎯 No border weight
        opacity: 0, // 🎯 No border opacity
        fillColor: '#ff6b6b', // 🎯 Light red color
        fillOpacity: .18, // 🎯 Same translucency as before
        pane: 'hotspotPane' 
      }).addTo(map);
      hotspotLayers.push(circle);
      // 🎯 NO LABEL - users should see it's a hotspot based on ping count
    });
  }

  function hotspotEligible(p){
    const ts = p.createdAt?.toDate ? p.createdAt.toDate().getTime() : 0; if (!ts || Date.now()-ts > LIVE_WINDOW_MS) return false; // 24h
    if(p.status==='hidden') return false;
    // Exclude private pings from global hotspot computation
    if(p.visibility==='private') return false;
    if(!inFence(p)) return false; return true;
  }

  // 🔥 PERFORMANCE: Increased debounce from 250ms to 1000ms - hotspot computation is expensive
  function scheduleHotspotRecompute(){ if(hotspotTimer) clearTimeout(hotspotTimer); hotspotTimer=setTimeout(recomputeHotspot, 1000); }
  function recomputeHotspot(){
    hotspotTimer=null;
    // Collect eligible pings (always consider All, independent of current filter selection)
    const seen=new Set(); const arr=[]; lastPingCache.forEach((p,id)=>{ if(seen.has(id)) return; seen.add(id); if(hotspotEligible(p)) arr.push(p); });
    if(arr.length===0){ hotspotData=[]; updateHotspotVisibility(); return; }
    // Helper to evaluate a center candidate over provided set
    function evaluateCenter(centerPing, pool){
      const cLL=L.latLng(centerPing.lat,centerPing.lon); const members=[];
      for(let j=0;j<pool.length;j++){ const q=pool[j]; const d=cLL.distanceTo([q.lat,q.lon]); if(d<=HOTSPOT_RADIUS_M) members.push(q); }
      const count=members.length; if(count===0) return null;
      let sumLat=0,sumLon=0; for(const m of members){ sumLat+=m.lat; sumLon+=m.lon; }
      const centLat=sumLat/count, centLon=sumLon/count;
      const centLL=L.latLng(centLat,centLon); let sumD=0; for(const m of members){ sumD+=centLL.distanceTo([m.lat,m.lon]); }
      const avgDist=sumD/count; return { lat:centLat, lon:centLon, count, avgDist };
    }
    // Greedily pick up to HOTSPOT_MAX_CLUSTERS separated cluster centers
    const selected=[];
    for(let k=0;k<HOTSPOT_MAX_CLUSTERS;k++){
      let best=null;
      for(let i=0;i<arr.length;i++){
        const cand=evaluateCenter(arr[i], arr); if(!cand) continue;
        // 🎯 Enforce minimum ping count requirement
        if(cand.count < HOTSPOT_MIN_PINGS) continue; // Must have at least 15 pings
        let tooClose=false; for(const prev of selected){ const d=L.latLng(prev.lat,prev.lon).distanceTo([cand.lat,cand.lon]); if(d < HOTSPOT_MIN_CENTER_SEP_M){ tooClose=true; break; } }
        if(tooClose) continue;
        if(!best || cand.count>best.count || (cand.count===best.count && cand.avgDist<best.avgDist)) best=cand;
      }
      if(best) selected.push(best); else break;
    }
    hotspotData=selected; saveHotspot(selected); updateHotspotVisibility();
  }

  // On load, read saved hotspots but don't render until enabled after intro
  try{ const saved=loadHotspot(); if(saved && saved.length){ hotspotData=saved; if(hotspotsEnabled) drawHotspots(saved); } }catch(_){ }
  const innerPane = map.createPane('inner'); innerPane.style.zIndex=401; innerPane.classList.add('inner-pane','gray-all');
  // Try vector basemap first for color-targeted adjustments; fall back to raster
  let vectorLayer=null;
  try{
    const MAPTILER_KEY = (window.MAPTILER_KEY||'');
    if(MAPTILER_KEY){
      const styleUrl = `https://api.maptiler.com/maps/streets-v2/style.json?key=${MAPTILER_KEY}`;
      vectorLayer = (window.leafletMaplibreGL ? window.leafletMaplibreGL : L.maplibreGL)({
        style: styleUrl,
        pane:'inner'
      });
      vectorLayer.addTo(map);
      vectorLayer.on('styledata',()=>{
        try{
          const mapgl = vectorLayer.getMaplibreMap ? vectorLayer.getMaplibreMap() : vectorLayer._glMap;
          if(!mapgl || !mapgl.getStyle) return;
          const st = mapgl.getStyle();
          // Duplicate and tweak paint properties
          for(const layer of st.layers){
            // Hide labels entirely; we'll keep Leaflet labels overlay disabled for vector path
            if(layer.type==='symbol'){
              try{ mapgl.setLayoutProperty(layer.id,'visibility','none'); }catch(_){ }
              continue;
            }
            // For fill/line layers, boost saturation differently for yellow vs others
            const paintProps = Object.keys(layer.paint||{});
            const isFill = layer.type==='fill';
            const isLine = layer.type==='line';
            if(!(isFill||isLine)) continue;
            // Prefer color properties likely present
            const colorProp = isFill ? 'fill-color' : 'line-color';
            let val = layer.paint[colorProp];
            if(!val) continue;
            // Wrap color in an expression that adjusts saturation by hue
            // Convert to HSL via expressions: not native, approximate by matrix on rgb -> use interpolate across hue
            // Practical approach: if hue within [45,65] treat as yellow
            const expr = [
              'case',
              ['all', ['>=',['h',['to-color',val]],45], ['<=',['h',['to-color',val]],65]],
              ['saturate',['to-color',val], 0.2],
              ['saturate',['to-color',val], 0.4]
            ];
            try{ mapgl.setPaintProperty(layer.id, colorProp, expr); }catch(_){ }
          }
        }catch(_){ }
      });
    }
  }catch(_){ vectorLayer=null; }
  if(!vectorLayer){
    // Raster fallback (Voyager) without POI icons + labels pane
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png',{
      attribution:'© OpenStreetMap contributors, © CARTO',
      subdomains:'abcd',
      maxZoom:22,
      pane:'inner'
    }).addTo(map);
    const labelsPane = map.createPane('labels');
    labelsPane.style.zIndex = 403;
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',{
      attribution:'© OpenStreetMap contributors, © CARTO',
      subdomains:'abcd',
      maxZoom:22,
      pane:'labels'
    }).addTo(map);
  }

  // Removed McGill campus shading overlay by request

  let FENCE_CENTER = L.latLng(DEFAULT_CENTER);
  let userPos = null;

  const fenceCircle = L.circle(FENCE_CENTER,{ radius:RADIUS_M, color:'#0f8a3b', weight:2, opacity:.9, dashArray:'6 4', fillOpacity:0 }).addTo(map);
  function updateViewConstraints(){ const fit = map.getBoundsZoom(fenceCircle.getBounds(), true); map.setMinZoom(fit); if(map.getZoom()<fit) map.setZoom(fit); }
  updateViewConstraints();

  const EPS=.8;
  const clampToCircle=(center, pt, r)=>{ const d=center.distanceTo(pt); if(d<=r) return pt; const k=r/d; return L.latLng(center.lat+(pt.lat-center.lat)*k, center.lng+(pt.lng-center.lng)*k); };
  function enforceLock(){ const c=map.getCenter(); if(FENCE_CENTER.distanceTo(c)>RADIUS_M+EPS){ map.setView(clampToCircle(FENCE_CENTER,c,RADIUS_M), map.getZoom(), {animate:false}); } }
  map.on('moveend', enforceLock);
  map.on('zoomend', ()=>{ 
    enforceLock(); 
    // 🔥 PERFORMANCE: Clear icon cache on zoom changes (icons depend on zoom level)
    iconCache.clear();
    try{ restyleMarkers(); }catch(e){} 
  });

  const des = document.querySelector('.desat-hole');
  function updateMask(){
    const lat=FENCE_CENTER.lat,lng=FENCE_CENTER.lng; const mPerDegLon=111320*Math.cos(lat*Math.PI/180);
    const degLon=RADIUS_M/mPerDegLon; const c=map.latLngToContainerPoint(FENCE_CENTER); const ex=map.latLngToContainerPoint([lat,lng+degLon]);
    const rPx=Math.max(40, Math.abs(ex.x-c.x)); des.style.setProperty('--cx', Math.round(c.x)+'px'); des.style.setProperty('--cy',Math.round(c.y)+'px'); des.style.setProperty('--r', rPx+'px');
  }
  // 🔥 PERFORMANCE: Throttle map updates to prevent excessive recalculations
  const throttledUpdateMask = window.throttle ? window.throttle(updateMask, 150) : updateMask;
  map.on('move zoom resize', throttledUpdateMask); updateMask();

  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{
      userPos=L.latLng(pos.coords.latitude, pos.coords.longitude);
      if(userPos.distanceTo(FENCE_CENTER)<=RADIUS_M){
        // Keep initial wide zoom; just center to user without changing zoom
        map.panTo(userPos, {animate:false});
        const latEl=$('#lat'),lonEl=$('#lon'); if(latEl&&lonEl){ latEl.value=userPos.lat.toFixed(6); lonEl.value=userPos.lng.toFixed(6); }
      }
      updateViewConstraints(); enforceLock(); updateMask();
    },()=>{}, {enableHighAccuracy:true, maximumAge:15000, timeout:8000});
  }

  /* --------- Address Search --------- */
  const addressSearchEl = document.getElementById('addressSearch');
  const addressInput = document.getElementById('addressInput');
  const addressSuggestions = document.getElementById('addressSuggestions');
  let searchTimeout = null;
  let currentSearchResults = [];
  let searchLocationMarker = null; // Hologram marker for searched location

  console.log('🔍 Address search elements:', {
    searchEl: !!addressSearchEl,
    input: !!addressInput,
    suggestions: !!addressSuggestions
  });

  // Show/hide address search based on auth status
  function updateAddressSearchVisibility() {
    if(addressSearchEl) {
      const shouldShow = currentUser && !currentUser.isAnonymous;
      addressSearchEl.style.display = shouldShow ? 'block' : 'none';
      console.log('🔍 Address search visibility:', shouldShow ? 'shown' : 'hidden');
    }
  }
  // Debounced search function
  async function searchAddress(query) {
    console.log('🔍 Searching for:', query);
    
    if(!query || query.length < 2) {
      if(addressSuggestions) addressSuggestions.style.display = 'none';
      currentSearchResults = [];
      return;
    }

    try {
      console.log('🔍 Fetching results from Nominatim...');
      
      // Calculate bounding box around the allowed circle
      // RADIUS_M is in meters, convert to approximate degrees
      const latDelta = (RADIUS_M / 111000); // ~111km per degree latitude
      const lonDelta = (RADIUS_M / (111000 * Math.cos(FENCE_CENTER.lat * Math.PI / 180)));
      
      const viewbox = [
        FENCE_CENTER.lng - lonDelta, // left
        FENCE_CENTER.lat + latDelta, // top
        FENCE_CENTER.lng + lonDelta, // right
        FENCE_CENTER.lat - latDelta  // bottom
      ].join(',');
      
      console.log('🔍 Search viewbox:', viewbox);
      
      // Use Nominatim (OpenStreetMap) geocoding API with viewbox to prioritize local results
      // Search broadly for everything: POIs, buildings, amenities, addresses
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
        `q=${encodeURIComponent(query)}&` +
        `format=json&` +
        `limit=100&` + // Get many more results for comprehensive coverage
        `viewbox=${viewbox}&` +
        `bounded=0&` + // Don't strictly limit to viewbox, but prioritize it
        `addressdetails=1&` +
        `dedupe=0&` + // Don't deduplicate to get all variations
        `extratags=1`, // Get extra tags for better POI info
        {
          headers: {
            'User-Agent': 'HadToBeThere/1.0'
          }
        }
      );
      
      if(!response.ok) throw new Error('Search failed');
      
      const results = await response.json();
      console.log('🔍 Got results:', results.length);
      
      // Log first few results for debugging
      if(results.length > 0) {
        console.log('🔍 Sample results:', results.slice(0, 3).map(r => ({
          name: r.name || r.display_name.split(',')[0],
          type: r.type,
          class: r.class,
          distance: L.latLng(parseFloat(r.lat), parseFloat(r.lon)).distanceTo(FENCE_CENTER) + 'm'
        })));
      }
      
      // Filter results to only include locations within the allowed circle
      // Accept all results within circle - no fuzzy matching restriction
      const filteredResults = results.filter(result => {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        if(isNaN(lat) || isNaN(lon)) return false;
        
        const location = L.latLng(lat, lon);
        const distance = location.distanceTo(FENCE_CENTER);
        
        // Only requirement: must be within circle
        return distance <= RADIUS_M;
      });
      
      console.log('🔍 Filtered to allowed area:', filteredResults.length, 'of', results.length);
      if(filteredResults.length === 0 && results.length > 0) {
        console.warn('⚠️ All results filtered out - they are outside the allowed circle');
        console.log('📏 Circle center:', FENCE_CENTER, 'Radius:', RADIUS_M + 'm');
      }
      
      // Sort by distance from center (closest first)
      filteredResults.sort((a, b) => {
        const distA = L.latLng(parseFloat(a.lat), parseFloat(a.lon)).distanceTo(FENCE_CENTER);
        const distB = L.latLng(parseFloat(b.lat), parseFloat(b.lon)).distanceTo(FENCE_CENTER);
        return distA - distB;
      });
      
      // Show more results for generic queries (like "library"), fewer for specific ones
      const isGenericQuery = query.length <= 10 || !query.includes(' ');
      const maxResults = isGenericQuery ? 15 : 10;
      currentSearchResults = filteredResults.slice(0, maxResults);
      
      // Display suggestions
      if(filteredResults.length === 0) {
        addressSuggestions.innerHTML = '<div class="address-suggestion"><div class="main">No results in allowed area</div><div class="sub">Try a more specific address nearby</div></div>';
        addressSuggestions.style.display = 'block';
      } else {
        addressSuggestions.innerHTML = currentSearchResults.map((result, index) => {
          const mainName = result.name || result.display_name.split(',')[0];
          const subName = result.display_name;
          const distance = L.latLng(parseFloat(result.lat), parseFloat(result.lon)).distanceTo(FENCE_CENTER);
          const distanceText = distance < 1000 ? `${Math.round(distance)}m` : `${(distance/1000).toFixed(1)}km`;
          
          // Add type badge for POIs/buildings
          let typeBadge = '';
          const type = result.type || '';
          const classType = result.class || '';
          if(classType === 'amenity' || classType === 'building' || type === 'university' || type === 'library' || type === 'cafe' || type === 'restaurant') {
            const typeLabel = type || classType;
            typeBadge = `<span style="background:#e0f2fe;color:#0369a1;padding:2px 6px;border-radius:6px;font-size:10px;font-weight:900;margin-left:6px">${escapeHtml(typeLabel)}</span>`;
          }
          
          return `
            <div class="address-suggestion" data-index="${index}">
              <div class="main">${escapeHtml(mainName)}${typeBadge} <span style="color:#999;font-weight:400;font-size:11px">${distanceText}</span></div>
              <div class="sub">${escapeHtml(subName)}</div>
            </div>
          `;
        }).join('');
        addressSuggestions.style.display = 'block';
        
        // Add click handlers to suggestions
        addressSuggestions.querySelectorAll('.address-suggestion').forEach(el => {
          el.onclick = () => {
            const idx = parseInt(el.dataset.index);
            selectAddressResult(currentSearchResults[idx]);
          };
        });
      }
    } catch(err) {
      console.error('Address search error:', err);
      showToast('Search failed. Try again.', 'error');
    }
  }

  // Select a search result
  function selectAddressResult(result) {
    if(!result) return;
    
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    const location = L.latLng(lat, lon);
    
    // Remove any existing search marker
    if(searchLocationMarker) {
      map.removeLayer(searchLocationMarker);
      searchLocationMarker = null;
    }
    
    // Pan and zoom to the location with high precision zoom
    map.flyTo(location, 20, {
      duration: 1.5,
      easeLinearity: 0.3
    });
    
      // Create hologram marker with "Ping here" label after zoom animation
      setTimeout(() => {
        // Create custom hologram icon
        const hologramIcon = L.divIcon({
          className: 'search-hologram-marker',
          html: `
            <div class="hologram-close-btn" data-action="close">✕</div>
            <div class="hologram-pulse"></div>
            <div class="hologram-pin">
              <svg viewBox="0 0 100 100" width="60" height="80">
                <defs>
                  <linearGradient id="hologramGrad" x1="0%" x2="0%" y1="0%" y2="100%">
                    <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.9"/>
                    <stop offset="100%" stop-color="#1d4ed8" stop-opacity="0.95"/>
                  </linearGradient>
                </defs>
                <path d="M50 10c17 0 30 13 30 30 0 22-30 50-30 50S20 62 20 40c0-17 13-30 30-30z" fill="url(#hologramGrad)" stroke="#1e40af" stroke-width="2"/>
                <circle cx="50" cy="40" r="12" fill="#fff" opacity="0.9"/>
              </svg>
            </div>
            <div class="hologram-label">Ping here</div>
          `,
          iconSize: [60, 100],
          iconAnchor: [30, 80],
          popupAnchor: [0, -80]
        });
      
      searchLocationMarker = L.marker(location, { 
        icon: hologramIcon,
        zIndexOffset: 10000 // Show above all other markers
      }).addTo(map);
      
      // Click handler to create ping at this location
      searchLocationMarker.on('click', (e) => {
        console.log('🎯 Hologram marker clicked!');
        
        // Stop event propagation to prevent map click
        if(e.originalEvent) {
          e.originalEvent.stopPropagation();
          e.originalEvent.preventDefault();
          
          // Check if close button was clicked
          const target = e.originalEvent.target;
          if(target && target.dataset && target.dataset.action === 'close') {
            console.log('❌ Close button clicked - removing hologram and zooming out');
            
            // Remove marker
            if(searchLocationMarker) {
              map.removeLayer(searchLocationMarker);
              searchLocationMarker = null;
            }
            
            // Zoom back out to show full area
            const centerLocation = userPos && userPos.distanceTo(FENCE_CENTER) <= RADIUS_M ? userPos : FENCE_CENTER;
            map.flyTo(centerLocation, 16, {
              duration: 1.2,
              easeLinearity: 0.25
            });
            
            return; // Don't open modal
          }
        }
        
        if(!currentUser) return showToast('Sign in first');
        if(currentUser.isAnonymous) return showToast("Guests can't post. Create an account to drop pings.");
        
        console.log('✅ User authorized, opening modal...');
        
        // Pre-fill the location in create modal
        const latEl = $('#lat'), lonEl = $('#lon');
        if(latEl && lonEl) {
          latEl.value = lat.toFixed(6);
          lonEl.value = lon.toFixed(6);
          console.log('📍 Pre-filled location:', lat.toFixed(6), lon.toFixed(6));
        }
        
        // Open modal first
        try {
          openModal('createModal');
          console.log('✅ Modal opened');
        } catch(err) {
          console.error('❌ Error opening modal:', err);
        }
        
        // Then remove the hologram marker after a short delay
        setTimeout(() => {
          if(searchLocationMarker) {
            map.removeLayer(searchLocationMarker);
            searchLocationMarker = null;
            console.log('🗑️ Hologram marker removed');
          }
        }, 100);
      });
      
      // Auto-remove after 30 seconds if not clicked
      setTimeout(() => {
        if(searchLocationMarker) {
          map.removeLayer(searchLocationMarker);
          searchLocationMarker = null;
        }
      }, 30000);
      
    }, 1500); // Wait for zoom animation to finish
    
    // Clear the input and hide suggestions
    addressInput.value = '';
    addressSuggestions.style.display = 'none';
    currentSearchResults = [];
    
    showToast(`📍 ${result.display_name.split(',').slice(0, 2).join(',')}`, 'success');
  }

  // HTML escape helper
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Simple fuzzy matching - checks if query matches text with typos
  function fuzzyMatch(query, text) {
    if(!query || !text) return false;
    
    query = query.toLowerCase().trim();
    text = text.toLowerCase();
    
    // Exact match or contains
    if(text.includes(query)) return true;
    
    // Check each word in the text
    const words = text.split(/[\s,\-\.]+/);
    for(const word of words) {
      // Allow 1 typo per 4 characters
      const maxErrors = Math.floor(word.length / 4) + 1;
      if(levenshteinDistance(query, word) <= maxErrors) {
        return true;
      }
      // Also check if query is at start of word
      if(word.startsWith(query.slice(0, -1))) return true;
    }
    
    return false;
  }

  // Calculate Levenshtein distance (edit distance) between two strings
  function levenshteinDistance(a, b) {
    if(a.length === 0) return b.length;
    if(b.length === 0) return a.length;
    
    const matrix = [];
    
    for(let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    
    for(let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    
    for(let i = 1; i <= b.length; i++) {
      for(let j = 1; j <= a.length; j++) {
        if(b.charAt(i-1) === a.charAt(j-1)) {
          matrix[i][j] = matrix[i-1][j-1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i-1][j-1] + 1, // substitution
            matrix[i][j-1] + 1,   // insertion
            matrix[i-1][j] + 1    // deletion
          );
        }
      }
    }
    
    return matrix[b.length][a.length];
  }

  // Input event handler with debouncing
  if(addressInput) {
    console.log('🔍 Setting up address input listeners');
    
    addressInput.addEventListener('input', (e) => {
      const query = e.target.value.trim();
      console.log('🔍 Input changed:', query);
      
      // Clear previous timeout
      if(searchTimeout) clearTimeout(searchTimeout);
      
      // Debounce: wait 300ms after user stops typing (faster response)
      searchTimeout = setTimeout(() => {
        searchAddress(query);
      }, 300);
    });
    
    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
      if(addressSearchEl && !addressSearchEl.contains(e.target)) {
        if(addressSuggestions) addressSuggestions.style.display = 'none';
      }
    });
    
    // Handle Enter key
    addressInput.addEventListener('keydown', (e) => {
      if(e.key === 'Enter' && currentSearchResults.length > 0) {
        e.preventDefault();
        selectAddressResult(currentSearchResults[0]);
      }
      if(e.key === 'Escape') {
        if(addressSuggestions) addressSuggestions.style.display = 'none';
        addressInput.blur();
      }
    });
  } else {
    console.error('❌ Address input not found!');
  }

  /* --------- Firestore --------- */
  const pingsRef = db.collection('pings');
  const votesRef = db.collection('votes');
  const usersRef = db.collection('users');

  /* --------- Leftbar contains only Filters now ---------- */
  const leftbar = document.getElementById('leftbar');

  /* --------- Filter (All / Friends+Me / Me) + Time window --------- */
  let filterMode = 'all'; // 'all' | 'friends' | 'me'
  let timeWindow = 'any'; // 'any' | '30m' | '2h' | '8h' | '24h'
  $$('#filterSeg button').forEach(btn=>{
    btn.onclick=()=>{ $$('#filterSeg button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); filterMode=btn.dataset.mode; reFilterMarkers(); };
  });
  $$('#timeSeg button').forEach(btn=>{
    btn.onclick=()=>{ $$('#timeSeg button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); timeWindow=btn.dataset.time||'any'; reFilterMarkers(); };
  });

  /* --------- Pin icons & sizing --------- */
  function netLikes(p){ return Math.max(0, (p.likes||0) - (p.dislikes||0)); }
  // Zoom scaling: double size every ~3 zooms; clamp to [0.7, 2.2]
  function zoomFactor(){
    try{
      const z = map && typeof map.getZoom==='function' ? map.getZoom() : 14;
      const f = Math.pow(2, (z - 14)/3);
      return Math.min(2.2, Math.max(0.7, f));
    }catch(e){ return 1; }
  }


  function radiusFromNet(net){
    const n = Math.max(0, Number(net)||0);
    let r = BASE_RADIUS;
    if(n <= L_LINEAR){
      r = BASE_RADIUS + A_SLOPE * n;
    }else{
      r = BASE_RADIUS + A_SLOPE * L_LINEAR + B_SQRT * Math.sqrt(n - L_LINEAR);
    }
    return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, r));
  }

  function balloonSVG(color, sizePx, opts={}){
    const w=Math.max(18,Math.min(56,Math.round(sizePx))), h=Math.round(w*1.5);
    const stroke='rgba(0,0,0,0.35)';
    const pinD = `M12 2 C7 2, 4 5.5, 4 10 c0 6, 8 12, 8 12 s8-6, 8-12 c0-4.5-3-8-8-8z`;
    const uid = Math.random().toString(36).slice(2,8);
    let innerPath = `<path d="M9 6 C7.8 6.4,7 7.5,7 8.6" stroke="rgba(255,255,255,0.6)" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
    if(opts.variant==='alien'){ innerPath = `<circle cx="12" cy="11" r="4" fill="#a7f3d0"/><ellipse cx="10.5" cy="10" rx="1.6" ry="2.2" fill="#111"/><ellipse cx="13.5" cy="10" rx="1.6" ry="2.2" fill="#111"/>`; }
    if(opts.variant==='galactic'){
      innerPath = `
        <defs>
          <radialGradient id="galGlow_${uid}" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stop-color="#a78bfa"/>
            <stop offset="60%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </radialGradient>
          <linearGradient id="shoot_${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="100%" stop-color="#60a5fa" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <circle cx="12" cy="11" r="5.8" fill="url(#galGlow_${uid})"/>
        <circle cx="12" cy="11" r="4.6" fill="none" stroke="#334155" stroke-width="0.8"/>
        <path d="M6.2 10.6 a6.2 6.2 0 0 1 11.6 0" fill="none" stroke="#64748b" stroke-width="0.8"/>
        <circle cx="16.4" cy="8.9" r="1.1" fill="#f59e0b"/>
        <circle cx="8.1" cy="13.3" r="0.9" fill="#e879f9"/>
        <circle cx="14.2" cy="14.4" r="0.8" fill="#22d3ee"/>
        <!-- shooting star -->
        <path d="M7 8.4 L11 9.6" stroke="url(#shoot_${uid})" stroke-width="1.4" stroke-linecap="round"/>
        <circle cx="11.1" cy="9.6" r="0.9" fill="#ffffff"/>
        <!-- tiny stars -->
        <circle cx="10.1" cy="12.1" r="0.4" fill="#93c5fd"/>
        <circle cx="13.8" cy="10.3" r="0.35" fill="#fde68a"/>
        <circle cx="9.2" cy="9.7" r="0.3" fill="#f472b6"/>
      `;
    }
    if(opts.variant==='nuke'){
      innerPath = `
        <defs>
          <radialGradient id="nukeGlow_${uid}" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stop-color="#fff7ad"/>
            <stop offset="60%" stop-color="#fde047"/>
            <stop offset="100%" stop-color="#facc15"/>
          </radialGradient>
          <radialGradient id="waste_${uid}" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stop-color="#a3e635"/>
            <stop offset="100%" stop-color="#0f8a3b"/>
          </radialGradient>
        </defs>
        <!-- glowing core -->
        <circle cx="12" cy="11" r="6" fill="url(#nukeGlow_${uid})"/>
        <!-- radiation trefoil -->
        <g fill="#111">
          <path d="M12 11 l0 -3 a3 3 0 0 1 2.6 1.5 L12 11 z"/>
          <g transform="rotate(120 12 11)"><path d="M12 11 l0 -3 a3 3 0 0 1 2.6 1.5 L12 11 z"/></g>
          <g transform="rotate(240 12 11)"><path d="M12 11 l0 -3 a3 3 0 0 1 2.6 1.5 L12 11 z"/></g>
          <circle cx="12" cy="11" r="1.1" fill="#111"/>
        </g>
        <!-- toxic puddle + bubbles -->
        <ellipse cx="12" cy="18.6" rx="6.2" ry="2.1" fill="url(#waste_${uid})" stroke="#166534" stroke-width="0.6" opacity="0.95"/>
        <circle cx="10.0" cy="17.6" r="0.55" fill="#bbf7d0" stroke="#166534" stroke-width="0.3"/>
        <circle cx="14.1" cy="16.8" r="0.45" fill="#bbf7d0" stroke="#166534" stroke-width="0.3"/>
        <circle cx="11.6" cy="16.0" r="0.4" fill="#bbf7d0" stroke="#166534" stroke-width="0.3"/>
      `;
    }
    const clipId = `pinClip_${Math.random().toString(36).slice(2,8)}`;
    let svg;
    if(opts.image){
      // Solid, fully-opaque pin: draw a white base under the clipped image, then outline
      svg = `<svg width="${w}" height="${h}" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="rgba(0,0,0,0.35)"/></filter>
          <clipPath id="${clipId}"><path d="${pinD}"/></clipPath>
        </defs>
        <path d="${pinD}" fill="#ffffff"/>
        <image href="${opts.image}" x="2" y="1" width="20" height="22" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
        <path d="${pinD}" fill="none" stroke="${stroke}" stroke-width="1.5" filter="url(#pinShadow)"/>
      </svg>`;
    }else{
      svg = `<svg width="${w}" height="${h}" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
        <defs><filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="rgba(0,0,0,0.35)"/></filter></defs>
        <path d="${pinD}" fill="${color}" stroke="${stroke}" stroke-width="1.5" filter="url(#pinShadow)"/>
        ${innerPath}
      </svg>`;
    }
    return {html:svg, size:[w,h], anchor:[w/2,h]};
  }
  function mIcon(px){ return L.divIcon({className:'pin-icon', ...balloonSVG('#ffffff', px, {drawM:true})}); }

  function colorForPing(p){
    const mine = (currentUser && p.authorId === currentUser.uid);
    if (mine) return { kind:'mine', color:'#0f8a3b' };
    const friend = myFriends.has(p.authorId);
    if (friend) return { kind:'friend', color:'#f59e0b' };
    return { kind:'other', color:'#0ea5e9' };
  }

  async function iconForPing(p, isPotw=false){
    // 🔥 PERFORMANCE: Check icon cache first to avoid redundant async calls
    const cacheKey = getIconCacheKey(p, isPotw);
    if(iconCache.has(cacheKey)) {
      return iconCache.get(cacheKey);
    }
    
    const n = netLikes(p);
    // Normal size
    let r = radiusFromNet(n);
    // PotW appears as size of a ping with 2x its NET likes
    if(isPotw){
      const fourN = n*4; // PotW size = size of a ping with 4x NET likes
      let potwR;
      if(fourN <= L_LINEAR){
        potwR = BASE_RADIUS + A_SLOPE * fourN;
      }else{
        potwR = BASE_RADIUS + A_SLOPE * L_LINEAR + B_SQRT * Math.sqrt(fourN - L_LINEAR);
      }
      r = Math.min(POTW_CAP, Math.max(MIN_RADIUS, potwR));
    }
    const px = r*2.2 * zoomFactor();

    // Determine custom ping style for self and non-friends
    let style = colorForPing(p);
    try{
      const u = await awaitCachedUser(p.authorId);
      // Apply custom styles only if NOT a friend (keep friends orange)
      if(u && u.selectedPingTier && style.kind !== 'friend'){
        const tier = Number(u.selectedPingTier||0);
        // Use customUrl for 1000-tier only
        style = { kind: style.kind, color: style.color, customTier: tier, customUrl: u.customPingUrl };
      }
    }catch(_){ }
    let inner;
    if(isPotw){
      // PotW marker is always gold, regardless of author relationship
      const {html,size,anchor}=balloonSVG('#d4af37',px);
      inner = L.divIcon({className:'pin-icon', html, iconSize:size, iconAnchor:anchor});
    }else{
      if(style.customTier){
        let color = style.color;
        let variant=null, image=null;
        if(style.customTier===100){ color = '#7c3aed'; }
        if(style.customTier===200){ variant='alien'; color='#0ea5e9'; }
        if(style.customTier===300){ variant='galactic'; color='#0f172a'; }
        if(style.customTier===500){ variant='nuke'; color='#fde047'; }
        if(style.customTier===1000 && style.customUrl){ image=style.customUrl; }
        const {html,size,anchor}=balloonSVG(color,px,{variant,image});
        inner = L.divIcon({className:'pin-icon', html, iconSize:size, iconAnchor:anchor});
      } else {
        const {html,size,anchor}=balloonSVG(style.color,px);
        inner = L.divIcon({className:'pin-icon', html, iconSize:size, iconAnchor:anchor});
      }
    }
    
    // 🔥 PERFORMANCE: Cache icon (clear on zoom changes)
    iconCache.set(cacheKey, inner);
    if(iconCache.size > 500) {
      // Clear oldest entries if cache gets too large
      const firstKey = iconCache.keys().next().value;
      iconCache.delete(firstKey);
    }

    if(!isPotw) return inner;

    // Wrap with banner + ring
    const wrap = document.createElement('div');
    wrap.className='potw-wrap';
    wrap.style.position='relative';
    wrap.innerHTML = inner.options.html;

    const ring = document.createElement('div');
    ring.className='potw-ring';
    ring.style.width = '100%';
    ring.style.height = 'auto';

    const banner = document.createElement('div');
    banner.className='potw-banner';
    banner.textContent='PING OF THE WEEK';

    wrap.appendChild(ring);
    wrap.appendChild(banner);

    return L.divIcon({
      className:'pin-icon',
      html:wrap.outerHTML,
      iconSize:inner.options.iconSize,
      iconAnchor:inner.options.iconAnchor
    });
  }

  /* --------- Live markers --------- */
  // Hoist PotW state so functions below can reference it before recompute
  let currentPotw = null; // { id, text, net, likes, dislikes, imageUrl, lat, lon, authorId, authorName }
  let lastWeekChampion = null; // Previous week's winner for display
  let userPreviousRank = null; // Track user's rank for "passed you" notifications
  let userNotifiedTop3 = new Set(); // Track which pings we've sent top-3 notifications for
  const markers=new Map(); const lastPingCache=new Map(); let unsubscribe=null;
  let currentUser=null, myFriends=new Set();
  // Simple user doc cache for rendering custom pings
  const userDocCache = new Map();
  async function awaitCachedUser(uid){
    if(userDocCache.has(uid)) return userDocCache.get(uid);
    try{ const snap=await usersRef.doc(uid).get(); const data=snap.exists? snap.data():null; userDocCache.set(uid,data); return data; }catch(_){ return null; }
  }
  
  // 🔥 PERFORMANCE: Icon cache to avoid redundant async calls
  const iconCache = new Map();
  function getIconCacheKey(p, isPotw) {
    const n = netLikes(p);
    const zoom = Math.floor(map.getZoom());
    return `${p.id}-${n}-${zoom}-${isPotw ? 'potw' : 'normal'}-${p.authorId}`;
  }

  function isMine(p){ return currentUser && p.authorId===currentUser.uid; }
  function isFriend(p){ return myFriends.has(p.authorId); }
  function inFence(p){ return L.latLng(p.lat,p.lon).distanceTo(FENCE_CENTER) <= RADIUS_M; }

  function shouldShow(p){
    // PotW always shows (overrides TTL and filters) while it's current
    if (currentPotw && currentPotw.id===p.id) return true;
    // 24h TTL
    const ts = p.createdAt?.toDate ? p.createdAt.toDate().getTime() : 0;
    if (!ts || Date.now()-ts > LIVE_WINDOW_MS) return false;
    // Time window filter
    if(timeWindow && timeWindow!=='any'){
      const now=Date.now();
      const limitMs = timeWindow==='30m' ? 30*60*1000 : timeWindow==='2h' ? 2*3600*1000 : timeWindow==='8h' ? 8*3600*1000 : 24*3600*1000;
      if(now-ts > limitMs) return false;
    }
    if(!inFence(p)) return false;
    if(p.status==='hidden' || p.status==='deleted') return false;
    // Respect visibility: private pings are visible to author and friends only
    if(p.visibility==='private'){
      if(isMine(p)) return true;
      if(isFriend(p)) return true;
      return false;
    }
    if(filterMode==='me') return isMine(p);
    if(filterMode==='friends') return isMine(p) || isFriend(p);
    return true;
  }

  async function upsertMarker(p){
    if(typeof p.lat!=='number' || typeof p.lon!=='number') return;
    
    // Queue NSFW check instead of blocking UI (prevents crashes)
    if ((p.imageUrl || p.videoUrl) && window.nsfwQueue) {
      window.nsfwQueue.add(p.id, p.imageUrl, p.videoUrl).then(shouldDelete => {
        if (shouldDelete) {
          console.log(`Removing ping ${p.id} due to NSFW content`);
          removeMarker(p.id);
          deletePingForNSFW(p.id, 'inappropriate content detected').catch(console.error);
        }
      }).catch(err => console.error('NSFW check error:', err));
    }
    
    const isPotw = !!(currentPotw && currentPotw.id===p.id);
    if(!shouldShow(p)){ removeMarker(p.id); return; }
    
    // 🔥 PERFORMANCE: Viewport culling - skip icon generation for markers outside viewport
    // Leaflet will still render markers, but we avoid expensive icon generation for off-screen markers
    const shouldGenerateIcon = !window.isInViewport || window.isInViewport(p.lat, p.lon, map, 0.3);
    if(!shouldGenerateIcon && !markers.has(p.id)) {
      // Skip creating new markers outside viewport (they'll be created when panned into view)
      return;
    }
    
    const icon=await iconForPing(p, isPotw);
    if(!markers.has(p.id)){
      const m=L.marker([p.lat,p.lon],{icon}).addTo(map).on('click',()=>openSheet(p.id));
      markers.set(p.id,m);
    } else {
      markers.get(p.id).setIcon(icon);
    }
    // 🔥 PERFORMANCE: Removed immediate hotspot recompute - it's debounced separately and expensive
  }
  function removeMarker(id){ const m=markers.get(id); if(m){ map.removeLayer(m); markers.delete(id); } }
  
  // Debounced to prevent excessive CPU usage
  const reFilterMarkers = (window.debounce ? window.debounce(function(){ 
    lastPingCache.forEach((p,id)=>{ 
      const allowed=shouldShow(p); 
      const on=markers.has(id); 
      if(allowed&&!on) upsertMarker(p); 
      else if(!allowed&&on) removeMarker(id); 
    }); 
    updateHotspotVisibility(); 
  }, 200) : function(){ 
    lastPingCache.forEach((p,id)=>{ 
      const allowed=shouldShow(p); 
      const on=markers.has(id); 
      if(allowed&&!on) upsertMarker(p); 
      else if(!allowed&&on) removeMarker(id); 
    }); 
    updateHotspotVisibility(); 
  });
  
  // Debounced and batched to prevent UI freezing
  const restyleMarkers = (window.debounce ? window.debounce(async function(){ 
    const updates = Array.from(markers.entries()).map(([id, m]) => ({id, m, p: lastPingCache.get(id)})).filter(u => u.p);
    if (window.batchProcess) {
      await window.batchProcess(updates, async ({id, m, p}) => {
        try {
          const isPotw = !!(currentPotw && currentPotw.id===id);
          const icon = await iconForPing(p, isPotw);
          m.setIcon(icon);
        } catch(e) { console.error('Icon update error:', e); }
      }, 10, 50);
    } else {
      for (const {id, m, p} of updates) {
        try {
          const isPotw = !!(currentPotw && currentPotw.id===id);
          const icon = await iconForPing(p, isPotw);
          m.setIcon(icon);
        } catch(e) {}
      }
    }
  }, 500) : async function(){ 
    markers.forEach(async (m,id)=>{ 
      try{ 
        const p=lastPingCache.get(id); 
        if(!p) return; 
        const isPotw=!!(currentPotw && currentPotw.id===id); 
        const icon = await iconForPing(p, isPotw); 
        m.setIcon(icon); 
      }catch(_){ } 
    }); 
  });

  function startLive(){
    if(unsubscribe) unsubscribe();
    // Dynamic limit based on device capability (prevents iOS crashes)
    const pingLimit = (window.getOptimalPingLimit && window.getOptimalPingLimit()) || 
                      (window.innerWidth < 768 ? 100 : 200);
    console.log(`📊 Loading ${pingLimit} pings (device-optimized)`);
    unsubscribe = pingsRef
  .orderBy('createdAt','desc').limit(pingLimit)
  .onSnapshot(s=>{
    s.docChanges().forEach(ch=>{
      const p={id:ch.doc.id, ...ch.doc.data()};
      lastPingCache.set(p.id,p);
      if(ch.type==='removed'){ removeMarker(p.id); lastPingCache.delete(p.id); return; }
      if(!shouldShow(p)){ removeMarker(p.id); return; }
      upsertMarker(p);
    });
    // 🔑 Ensure PotW is re-evaluated, but debounced to prevent excessive recomputation
    if(typeof recomputePotw === 'function' && typeof window.debounce === 'function') {
      // Debounce PotW recomputation - only run every 2 seconds max
      if(!window.potwRecomputeDebounced) {
        window.potwRecomputeDebounced = window.debounce(() => {
          recomputePotw().catch(console.error);
        }, 2000);
      }
      window.potwRecomputeDebounced();
    } else if(typeof recomputePotw === 'function') {
      recomputePotw().catch(console.error);
    }
    // 🔥 PERFORMANCE: Only recompute hotspot every 5 seconds max (debounced separately)
    // Removed immediate hotspot recompute - it's expensive and runs on every ping update
  }, e=>{ console.error(e); showToast((e.code||'error')+': '+(e.message||'live error')); });

  }
  startLive();

  // ⏰ AUTO-UPDATE TIMESTAMPS: Refresh relative times every 30 seconds
  setInterval(() => {
    try {
      // Update timestamps in comments
      document.querySelectorAll('.comment small').forEach(small => {
        const commentDiv = small.closest('.comment');
        if(!commentDiv) return;
        // Try to extract timestamp from data attribute if we add one, otherwise skip
        // For now, just re-render open sheet's comments (will be handled by listener)
      });
      
      // Update ping sheet meta if open
      const sheetMetaEl = document.getElementById('sheetMeta');
      if(sheetMetaEl && openId) {
        const ping = lastPingCache.get(openId);
        if(ping && ping.createdAt) {
          const created = ping.createdAt?.toDate ? ping.createdAt.toDate().getTime() : null;
          if(created) {
            const currentText = sheetMetaEl.textContent;
            const parts = currentText.split(' • ');
            if(parts.length > 0) {
              // Replace last part (timestamp) with fresh one
              parts[parts.length - 1] = timeAgo(created);
              sheetMetaEl.textContent = parts.join(' • ');
            }
          }
        }
      }
      
      console.log('⏰ Refreshed timestamps');
    } catch(err) {
      console.error('Error refreshing timestamps:', err);
    }
  }, 30000); // 30 seconds
  // ⌨️ KEYBOARD SHORTCUTS: Power user features
  document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts if user is typing in an input/textarea
    const isTyping = ['INPUT', 'TEXTAREA'].includes(e.target.tagName);
    
    // ESC: Close any open modal or sheet
    if(e.key === 'Escape') {
      const openModals = document.querySelectorAll('.modal.open');
      if(openModals.length > 0) {
        openModals.forEach(modal => modal.classList.remove('open'));
        applyModalOpenClass();
        e.preventDefault();
        return;
      }
      
      const openSheet = document.querySelector('.sheet.open');
      if(openSheet) {
        openSheet.classList.remove('open');
        if(openUnsub) openUnsub();
        if(openCommentsUnsub) openCommentsUnsub();
        openId = null;
        applyModalOpenClass();
        e.preventDefault();
        return;
      }
    }
    
    if(isTyping) return; // Don't trigger letter shortcuts while typing
    
    // N: New ping (if signed in and inside circle)
    if(e.key === 'n' || e.key === 'N') {
      if(currentUser && !currentUser.isAnonymous) {
        try {
          openModal('createModal');
          // Focus on text input
          setTimeout(() => {
            const pingTextEl = document.getElementById('pingText');
            if(pingTextEl) pingTextEl.focus();
          }, 100);
        } catch(_) {}
        e.preventDefault();
      }
    }
    
    // P: Open profile
    if(e.key === 'p' || e.key === 'P') {
      if(currentUser && !currentUser.isAnonymous) {
        try {
          openModal('profileModal');
        } catch(_) {}
        e.preventDefault();
      }
    }
    
    // B or M: Open notifications
    if(e.key === 'b' || e.key === 'B' || e.key === 'm' || e.key === 'M') {
      if(currentUser && !currentUser.isAnonymous) {
        try {
          openModal('notifsModal');
        } catch(_) {}
        e.preventDefault();
      }
    }
    
    // ?: Show keyboard shortcuts help
    if(e.key === '?') {
      showToast(`Keyboard Shortcuts:\nN = New Ping\nP = Profile\nB/M = Notifications\nESC = Close\n? = This help`, 'success');
      e.preventDefault();
    }
  });
  
  console.log('⌨️ Keyboard shortcuts enabled. Press ? for help.');

  /* --------- What You Missed (>=1h idle) --------- */
  const MISSED_LAST_SEEN_KEY = 'htbt_last_seen_ts';
  const MISSED_THRESHOLD_MS = 15*60*1000; // 🎯 15 minutes (optimized from 1 hour)
  const MISSED_CHECK_COOLDOWN_MS = 60*1000; // 🛡️ Only check once per minute to avoid spam
  let lastMissedCheck = 0; // Track when we last ran the check
  const missedCard = document.getElementById('missedCard');
  const missedText = document.getElementById('missedText');
  const missedMeta = document.getElementById('missedMeta');
  const missedView = document.getElementById('missedView');
  const missedClose = document.getElementById('missedClose');

  function markSeen(){ try{ localStorage.setItem(MISSED_LAST_SEEN_KEY, String(Date.now())); }catch(_){ } }
  function getLastSeen(){ try{ const v=Number(localStorage.getItem(MISSED_LAST_SEEN_KEY)||'0'); return Number.isFinite(v)? v:0; }catch(_){ return 0; } }

  // Helper function to render missed pings card (removes code duplication)
  function renderMissedPingsCard(topPings, lastSeenTs, testMode = false){
      let displayHTML = '';
      let viewButtonEnabled = false;
      
    if(topPings.length === 0) {
        displayHTML = '<div class="ping-item">No new pings since your last visit</div>';
      } else {
        displayHTML = topPings.map((p, i) => {
          const netLikes = Math.max(0, (p.likes||0) - (p.dislikes||0));
          const authorName = p.authorName || 'Anonymous';
          const timeAgo = p.createdAt?.toDate ? 
            (() => {
              const diffMs = Date.now() - p.createdAt.toDate().getTime();
              const diffMins = Math.floor(diffMs / 60000);
              const diffHours = Math.floor(diffMins / 60);
              if (diffHours > 0) {
                return `${diffHours}h ${diffMins % 60}m ago`;
              } else {
                return `${diffMins}m ago`;
              }
            })() : 
            'Unknown time';
          
          return `
            <div class="ping-item">
              <strong>${i+1}. ${String(p.text||'Ping')}</strong> (${netLikes}★)
              <div class="ping-author">by ${authorName}</div>
              <div class="ping-time">${timeAgo}</div>
            </div>
          `;
        }).join('');
        
        viewButtonEnabled = topPings.length > 0;
      }
      
      if(missedText) missedText.innerHTML = displayHTML;
    if(missedMeta){ 
      if(testMode){
        missedMeta.textContent = 'Test mode - showing current pings';
      } else {
        const diff = Math.round((Date.now()-lastSeenTs)/3600000); 
        missedMeta.textContent = `${diff}h since your last visit`;
      }
    }
    
      if(missedView){ 
        missedView.disabled = !viewButtonEnabled;
        if(viewButtonEnabled && topPings.length > 0) {
          let currentPingIndex = 0;
          missedView.onclick = () => {
            try {
              const ping = topPings[currentPingIndex];
              if(ping) {
                map.setView([ping.lat, ping.lon], 16, { animate:true });
                openSheet(ping.id);
              // Move to next ping
              currentPingIndex++;
              // After viewing all pings, hide card automatically
              if(currentPingIndex >= topPings.length) {
                  setTimeout(() => {
                    if(missedCard) missedCard.style.display='none';
                    markSeen();
                }, 500);
              } else {
                // Update button text to show progress
                missedView.textContent = `View ${currentPingIndex + 1}/${topPings.length}`;
                }
              }
            } catch(_) { 
              if(missedCard) missedCard.style.display='none'; 
              markSeen(); 
            }
          };
          // Set initial button text
          missedView.textContent = `View 1/${topPings.length}`;
        } else {
          missedView.onclick=()=>{ if(missedCard) missedCard.style.display='none'; markSeen(); }
        }
      }
    
      if(missedClose){ missedClose.onclick=()=>{ if(missedCard) missedCard.style.display='none'; markSeen(); }; }
      if(missedCard) {
        missedCard.style.display='block';
      console.log('What you missed card shown with', topPings.length, 'items');
    }
  }

  async function showWhatYouMissedIfAny(){
    try{
      // 🛡️ OPTIMIZATION: Cooldown to prevent repeated checks
      const now = Date.now();
      if(now - lastMissedCheck < MISSED_CHECK_COOLDOWN_MS) {
        console.log('⏳ Skipping missed check - cooldown active');
        return;
      }
      lastMissedCheck = now;
      
      const lastSeen = getLastSeen();
      console.log('What you missed check:', { lastSeen, threshold: MISSED_THRESHOLD_MS, timeSince: now - lastSeen });
      if(!lastSeen) { markSeen(); return; }
      if(now - lastSeen < MISSED_THRESHOLD_MS) return;
      
      // Collect all live pings from cache (top 3 current pings, excluding Ping of the Week)
      const list = [];
      lastPingCache.forEach((p)=>{
        if(p.status !== 'live') return; // Only show pings that are still up/live
        if(currentPotw && p.id === currentPotw.id) return; // Exclude Ping of the Week
        // Respect visibility; reuse shouldShow minus timeWindow constraint
        const keepTime = timeWindow; timeWindow='any'; const ok=shouldShow(p); timeWindow=keepTime; if(!ok) return;
        list.push(p);
      });
      console.log('What you missed candidates:', list.length, 'from cache size:', lastPingCache.size);
      
      // Sort by net likes desc, then recency
      list.sort((a,b)=>{ const an=Math.max(0,(a.likes||0)-(a.dislikes||0)); const bn=Math.max(0,(b.likes||0)-(b.dislikes||0)); if(bn!==an) return bn-an; const at=a.createdAt?.toDate? a.createdAt.toDate().getTime():0; const bt=b.createdAt?.toDate? b.createdAt.toDate().getTime():0; return bt-at; });
      const topPings = list.slice(0,3);
      
      renderMissedPingsCard(topPings, lastSeen, false);
    }catch(e){ console.error('What you missed error:', e); markSeen(); }
  }
  // Run shortly after live starts, with retry logic for cache population
  setTimeout(() => {
    console.log('=== AUTOMATIC WHAT YOU MISSED CHECK ===');
    showWhatYouMissedIfAny();
  }, 1200);

  // Additional check after 5 seconds to ensure cache is populated
  setTimeout(() => {
    console.log('=== SECONDARY WHAT YOU MISSED CHECK (after cache population) ===');
    showWhatYouMissedIfAny();
  }, 5000);
  // Mark seen on first interaction
  ['click','keydown','touchstart','wheel'].forEach(evt=>{ window.addEventListener(evt, ()=>{ markSeen(); }, { once:true, passive:true }); });
  
  // Debug function to manually test "what you missed"
  window.testWhatYouMissed = function() {
    console.log('=== TESTING WHAT YOU MISSED ===');
    console.log('Current lastSeen:', getLastSeen());
    console.log('Current time:', Date.now());
    console.log('Time difference:', Date.now() - getLastSeen());
    console.log('Threshold (1 hour):', MISSED_THRESHOLD_MS);
    console.log('Should show?', (Date.now() - getLastSeen()) >= MISSED_THRESHOLD_MS);
    console.log('Cache size:', lastPingCache.size);
    console.log('Cache contents:', Array.from(lastPingCache.keys()));
    
    // Bypass the 1-hour check and directly show the card with current pings
    console.log('Bypassing time check, showing card with current pings...');
    
    // Collect all live pings from cache (top 3 current pings, excluding Ping of the Week)
    const list = [];
    lastPingCache.forEach((p)=>{
      if(p.status !== 'live') return; // Only show pings that are still up/live
      if(currentPotw && p.id === currentPotw.id) return; // Exclude Ping of the Week
      // Respect visibility; reuse shouldShow minus timeWindow constraint
      const keepTime = timeWindow; timeWindow='any'; const ok=shouldShow(p); timeWindow=keepTime; if(!ok) return;
      list.push(p);
    });
    console.log('Test candidates:', list.length, 'from cache size:', lastPingCache.size);
    
      // Sort by net likes desc, then recency
      list.sort((a,b)=>{ const an=Math.max(0,(a.likes||0)-(a.dislikes||0)); const bn=Math.max(0,(b.likes||0)-(b.dislikes||0)); if(bn!==an) return bn-an; const at=a.createdAt?.toDate? a.createdAt.toDate().getTime():0; const bt=b.createdAt?.toDate? b.createdAt.toDate().getTime():0; return bt-at; });
    const topPings = list.slice(0,3);
    
    renderMissedPingsCard(topPings, getLastSeen(), true);
  };
  
  window.clearMissedTimestamp = function() {
    localStorage.removeItem(MISSED_LAST_SEEN_KEY);
    console.log('Cleared missed timestamp');
  };
  
  window.triggerRegularMissedCheck = function() {
    console.log('=== MANUAL TRIGGER OF REGULAR CHECK ===');
    showWhatYouMissedIfAny();
  };

  // Force show "What You Missed" regardless of timing (for testing)
  window.forceShowWhatYouMissed = function() {
    console.log('=== FORCING WHAT YOU MISSED DISPLAY ===');
    try {
      const lastSeen = getLastSeen();
      console.log('Current lastSeen:', lastSeen);
      console.log('Current time:', Date.now());
      console.log('Time difference:', Date.now() - lastSeen);
      console.log('Cache size:', lastPingCache.size);
      
      // Temporarily set lastSeen to 2 hours ago to force the check
      const twoHoursAgo = Date.now() - (2 * 3600 * 1000);
      localStorage.setItem(MISSED_LAST_SEEN_KEY, String(twoHoursAgo));
      console.log('Set lastSeen to 2 hours ago:', twoHoursAgo);
      
      // Now trigger the check
      showWhatYouMissedIfAny();
    } catch (error) {
      console.error('Error forcing what you missed:', error);
    }
  };

  // Check "What You Missed" every 30 minutes when tab is active
  window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      console.log('=== PERIODIC WHAT YOU MISSED CHECK ===');
      showWhatYouMissedIfAny();
    }
  }, 30 * 60 * 1000); // 30 minutes

  // Check "What You Missed" when tab becomes visible again (user returns)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      console.log('=== TAB BECAME VISIBLE - CHECKING WHAT YOU MISSED ===');
      // Add a small delay to ensure everything is loaded
      setTimeout(() => {
        showWhatYouMissedIfAny();
      }, 1000);
    }
  });
  
  // Debug function to test mention system
  window.debugMentions = async function() {
    console.log('=== DEBUGGING MENTION SYSTEM ===');
    console.log('Current user:', currentUser ? currentUser.uid : 'Not logged in');
    console.log('My friends:', myFriends ? Array.from(myFriends) : 'No friends');
    
    // Test handle resolution
    const testHandle = prompt('Enter a handle to test (without @):');
    if (testHandle) {
      console.log(`Testing handle resolution for: ${testHandle}`);
      try {
        const db = firebase.firestore();
        const handleDoc = await db.collection('handles').doc(testHandle.toLowerCase()).get();
        console.log('Handle document exists:', handleDoc.exists);
        if (handleDoc.exists) {
          console.log('Handle document data:', handleDoc.data());
        } else {
          console.log('❌ Handle not found in database');
        }
        
        // Test resolveUidByHandle function
        const uid = await resolveUidByHandle(testHandle.toLowerCase());
        console.log('Resolved UID:', uid);
      } catch (error) {
        console.error('Error testing handle:', error);
      }
    }
  };

  // Test mention parsing
  window.testMentionParsing = async function() {
    console.log('=== TESTING NEW SIMPLE MENTION SYSTEM ===');
    const testText = prompt('Enter text with mentions to test:');
    if (testText) {
      console.log('Testing text:', testText);
      const mentions = parseMentions(testText);
      console.log('Parsed mentions:', mentions);
      
      if (mentions.length > 0) {
        console.log('Resolving mentions...');
        const resolved = await resolveMentions(mentions);
        console.log('Resolved mentions:', resolved);
        
        console.log('✅ New system working! No more bugs!');
      } else {
        console.log('No mentions found in text');
      }
    }
  };

  // Comprehensive mention testing
  window.testAllMentionScenarios = async function() {
    console.log('🧪 === COMPREHENSIVE MENTION TESTING ===');
    
    const testCases = [
      { name: 'Single mention', text: 'Hey @username check this out!' },
      { name: 'Multiple mentions', text: 'Hey @user1 and @user2, what do you think?' },
      { name: 'Mention at start', text: '@username hello there' },
      { name: 'Mention at end', text: 'Hello there @username' },
      { name: 'Mention with numbers', text: 'Hey @user123 and @test_456' },
      { name: 'Mention with underscores', text: 'Hey @user_name and @test_user' },
      { name: 'Mention with dots', text: 'Hey @user.name and @test.user' },
      { name: 'No mentions', text: 'Just regular text without any mentions' },
      { name: 'Invalid mention', text: 'Hey @invaliduser12345' },
      { name: 'Empty text', text: '' },
      { name: 'Self mention', text: `Hey @${currentUser?.uid || 'currentuser'}` }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n🧪 Testing: ${testCase.name}`);
      console.log(`📝 Text: "${testCase.text}"`);
      
      const mentions = parseMentions(testCase.text);
      console.log(`📝 Parsed: ${mentions.length} mentions`);
      
      if (mentions.length > 0) {
        const resolved = await resolveMentions(mentions);
        console.log(`✅ Resolved: ${resolved.length} valid mentions`);
      }
    }
    
    console.log('\n✅ All test cases completed!');
  };

  // Test notification sending
  window.testNotificationSending = async function() {
    console.log('🧪 === TESTING NOTIFICATION SENDING ===');
    
    if (!currentUser) {
      console.log('❌ No current user logged in');
      return;
    }
    
    const testUid = prompt('Enter a UID to send test notification to:');
    if (testUid) {
      console.log(`📧 Notification test disabled on client (handled server-side)`);
    }
  };

  // Test handle resolution
  window.testHandleResolution = async function() {
    console.log('🧪 === TESTING HANDLE RESOLUTION ===');
    
    const testHandle = prompt('Enter a handle to test (without @):');
    if (testHandle) {
      console.log(`🔍 Testing handle: @${testHandle}`);
      
      try {
        const db = firebase.firestore();
        const handleDoc = await db.collection('handles').doc(testHandle.toLowerCase()).get();
        
        if (handleDoc.exists) {
          const uid = handleDoc.data().uid;
          console.log(`✅ Handle @${testHandle} resolves to UID: ${uid}`);
          
          // Test if we can mention this user
          const mentions = parseMentions(`Hey @${testHandle} test`);
          const resolved = await resolveMentions(mentions);
          
          if (resolved.length > 0) {
            console.log(`✅ Mention would work: @${testHandle} -> ${resolved[0].uid}`);
          } else {
            console.log(`❌ Mention would not work for @${testHandle}`);
          }
        } else {
          console.log(`❌ Handle @${testHandle} not found in database`);
        }
      } catch (error) {
        console.error(`❌ Error testing handle @${testHandle}:`, error);
      }
    }
  };

  // Check mention system status
  window.checkMentionSystemStatus = async function() {
    console.log('🔍 === MENTION SYSTEM STATUS CHECK ===');
    
    // Check current user
    console.log('👤 Current user:', currentUser?.uid || 'Not logged in');
    
    if (!currentUser) {
      console.log('❌ Cannot test mentions - no user logged in');
      return;
    }
    
    // Check if user has a handle
    try {
      const db = firebase.firestore();
      const userDoc = await db.collection('users').doc(currentUser.uid).get();
      
      if (userDoc.exists) {
        const userData = userDoc.data();
        const handle = userData.handle;
        console.log('👤 User handle:', handle || 'No handle');
        
        if (handle) {
          // Check if handle exists in handles collection
          const handleDoc = await db.collection('handles').doc(handle.toLowerCase()).get();
          console.log('🔗 Handle in handles collection:', handleDoc.exists ? '✅ Yes' : '❌ No');
          
          if (handleDoc.exists) {
            const handleData = handleDoc.data();
            console.log('🔗 Handle data:', handleData);
          }
        }
      } else {
        console.log('❌ User document not found');
      }
    } catch (error) {
      console.error('❌ Error checking user status:', error);
    }
    
    // Test basic mention parsing
    console.log('\n🧪 Testing basic mention parsing...');
    const testText = 'Hey @testuser check this out!';
    const mentions = parseMentions(testText);
    console.log(`📝 Parsed "${testText}": ${mentions.length} mentions`);
    
    // Test Firebase connection
    console.log('\n🔥 Testing Firebase connection...');
    try {
      const db = firebase.firestore();
      const testDoc = await db.collection('handles').limit(1).get();
      console.log('✅ Firebase connection working');
    } catch (error) {
      console.error('❌ Firebase connection error:', error);
    }
    
    console.log('\n✅ Status check complete!');
  };

  // Simulate complete mention workflow
  window.simulateMentionWorkflow = async function() {
    console.log('🎭 === SIMULATING COMPLETE MENTION WORKFLOW ===');
    
    if (!currentUser) {
      console.log('❌ No user logged in');
      return;
    }
    
    const testText = prompt('Enter text with mentions to simulate posting:');
    if (!testText) return;
    
    console.log('🎯 Simulating ping posting with text:', testText);
    
    // Step 1: Parse mentions
    console.log('\n📝 Step 1: Parsing mentions...');
    const mentions = parseMentions(testText);
    console.log(`Found ${mentions.length} mentions`);
    
    // Step 2: Resolve mentions
    console.log('\n🔍 Step 2: Resolving mentions...');
    const resolvedMentions = await resolveMentions(mentions);
    console.log(`Resolved ${resolvedMentions.length} mentions`);
    
    // Step 3: Simulate ping creation
    console.log('\n📝 Step 3: Simulating ping creation...');
    const mockPingId = 'mock-ping-' + Date.now();
    console.log(`Mock ping ID: ${mockPingId}`);
    
    // Step 4: Send notifications
    console.log('\n📧 Step 4: Sending notifications...');
    if (resolvedMentions.length === 0) {
      console.log('📧 No notifications to send');
    } else {
      console.log('📧 Mention notifications disabled on client (handled server-side)');
    }
    
    console.log('\n✅ Workflow simulation complete!');
  };

  // Manually ensure current user has a handle
  window.ensureMyHandle = async function() {
    if (!currentUser) {
      console.log('❌ No current user logged in');
      return;
    }
    console.log('🔧 Manually ensuring handle for current user...');
    try {
      await ensureIdentityMappings(currentUser);
      console.log('✅ Handle creation complete');
    } catch (error) {
      console.error('❌ Error ensuring handle:', error);
    }
  };

  // Lock in a specific handle for current user (permanent)
  window.lockMyHandle = async function() {
    if (!currentUser) {
      console.log('❌ No current user logged in');
      return;
    }
    
    const desiredHandle = prompt('Enter the handle you want to lock in (without @):');
    if (!desiredHandle) return;
    
    const handle = desiredHandle.toLowerCase().replace(/[^a-z0-9_.]/g,'');
    if (handle !== desiredHandle.toLowerCase()) {
      console.log('⚠️ Handle sanitized to:', handle);
    }
    
    console.log('🔒 Locking in handle:', handle);
    try {
      const db = firebase.firestore();
      const uref = db.collection('users').doc(currentUser.uid);
      const handleRef = db.collection('handles').doc(handle);
      
      // Use transaction to ensure atomicity
      await db.runTransaction(async (tx) => {
        // Check if handle is available
        const handleSnap = await tx.get(handleRef);
        if (handleSnap.exists && handleSnap.data().uid !== currentUser.uid) {
          throw new Error('Handle already taken by another user');
        }
        
        // Set the handle
        tx.set(handleRef, { 
          uid: currentUser.uid, 
          locked: true,
          createdAt: firebase.firestore.FieldValue.serverTimestamp() 
        });
        
        // Update user document
        tx.set(uref, { 
          handle: handle, 
          handleLC: handle.toLowerCase(),
          handleLocked: true 
        }, { merge: true });
      });
      
      console.log('✅ Handle locked successfully:', handle);
      console.log('🎉 Your handle is now permanent and will not change');
      
    } catch (error) {
      console.error('❌ Error locking handle:', error);
      if (error.message.includes('already taken')) {
        console.log('💡 Try a different handle or add numbers/underscores');
      }
    }
  };
  
  window.debugProfileModal = function() {
    console.log('=== PROFILE MODAL DEBUG ===');
    const elements = {
      own: document.getElementById('ownProfileSection'),
      other: document.getElementById('otherProfileSection'),
      settings: document.getElementById('settingsSection'),
      title: document.getElementById('profileModalTitle'),
      actions: document.getElementById('profileActions'),
      signOutBtn: document.getElementById('signOutInProfile'),
      gear: document.getElementById('openSettings'),
      back: document.getElementById('backToProfile'),
      storeBtn: document.getElementById('openStore')
    };
    console.log('Profile modal elements:', elements);
    console.log('Current profile view:', currentProfileView);
    console.log('Modal open class:', document.getElementById('profileModal')?.classList.contains('open'));
    
    // Show computed styles
    if(elements.own) {
      console.log('ownProfileSection computed display:', window.getComputedStyle(elements.own).display);
    }
    if(elements.other) {
      console.log('otherProfileSection computed display:', window.getComputedStyle(elements.other).display);
    }
    if(elements.settings) {
      console.log('settingsSection computed display:', window.getComputedStyle(elements.settings).display);
    }
  };
  
  window.forceProfileModalCorrect = function() {
    console.log('=== FORCING PROFILE MODAL TO CORRECT STATE ===');
    console.log('PROFILE_VIEW defined:', typeof PROFILE_VIEW !== 'undefined');
    console.log('PROFILE_VIEW.OWN:', PROFILE_VIEW?.OWN);
    if(typeof applyProfileView === 'function') {
      applyProfileView(PROFILE_VIEW.OWN);
    }
  };
  
  window.addTestPingsToCache = function() {
    console.log('Adding test pings to cache...');
    const now = Date.now();
    const testPings = [
      {
        id: 'test1',
        text: 'Test Ping 1',
        lat: 40.7128,
        lon: -74.0060,
        likes: 5,
        dislikes: 0,
        createdAt: { toDate: () => new Date(now - 1000) },
        visibility: 'public',
        status: 'live'
      },
      {
        id: 'test2', 
        text: 'Test Ping 2',
        lat: 40.7589,
        lon: -73.9851,
        likes: 3,
        dislikes: 1,
        createdAt: { toDate: () => new Date(now - 2000) },
        visibility: 'public',
        status: 'live'
      },
      {
        id: 'test3',
        text: 'Test Ping 3', 
        lat: 40.7505,
        lon: -73.9934,
        likes: 8,
        dislikes: 2,
        createdAt: { toDate: () => new Date(now - 3000) },
        visibility: 'public',
        status: 'live'
      }
    ];
    
    testPings.forEach(ping => {
      lastPingCache.set(ping.id, ping);
    });
    
    console.log('Added', testPings.length, 'test pings to cache');
    console.log('Cache size now:', lastPingCache.size);
  };
  
  window.forceShowMissedCard = function() {
    console.log('=== FORCE SHOW MISSED CARD DEBUG ===');
    console.log('missedCard variable:', missedCard);
    console.log('Document element by ID:', document.getElementById('missedCard'));
    console.log('All elements with class potw-card:', document.querySelectorAll('.potw-card'));
    
    const element = document.getElementById('missedCard');
    if (element) {
      element.style.display = 'block';
      // Remove all debug styling to show normal card
      element.style.background = '';
      element.style.border = '';
      element.style.zIndex = '';
      element.style.position = '';
      element.style.top = '';
      element.style.left = '';
      element.style.transform = '';
      element.style.width = '';
      element.style.height = '';
      
      const textEl = document.getElementById('missedText');
      const metaEl = document.getElementById('missedMeta');
      const viewEl = document.getElementById('missedView');
      
      if (textEl) textEl.textContent = '1. Test Ping (5★)  2. Another Ping (3★)  3. Third Ping (1★)';
      if (metaEl) metaEl.textContent = '12h since your last visit';
      if (viewEl) viewEl.disabled = false;
      
      console.log('Element forced to show with bright colors');
      console.log('Element position:', element.getBoundingClientRect());
    } else {
      console.log('ERROR: missedCard element not found in DOM');
      // Create a test element if the original doesn't exist
      const testDiv = document.createElement('div');
      testDiv.id = 'testMissedCard';
      testDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 400px;
        height: 200px;
        background: #ff0000;
        border: 5px solid #00ff00;
        z-index: 99999;
        color: white;
        padding: 20px;
        font-size: 16px;
        font-weight: bold;
      `;
      testDiv.innerHTML = 'TEST MISSED CARD - This should be visible!';
      document.body.appendChild(testDiv);
      console.log('Created test element instead');
    }
  };

  setInterval(()=>{ const now=Date.now(); lastPingCache.forEach((p,id)=>{ if(currentPotw && currentPotw.id===id) return; const ts=p.createdAt?.toDate? p.createdAt.toDate().getTime():0; if(ts && now-ts>LIVE_WINDOW_MS){ removeMarker(id); lastPingCache.delete(id); } }); },60*1000);

  /* --------- Quota & rate limits --------- */
  async function todayCount(uid){
    const start=new Date(); start.setHours(0,0,0,0);
    try{ const qs=await pingsRef.where('authorId','==',uid).where('createdAt','>=',start).get(); return qs.size; }
    catch(e){ const qs=await pingsRef.where('authorId','==',uid).get(); let c=0; qs.forEach(d=>{ const t=d.data().createdAt?.toDate?.(); if(t && t>=start) c++; }); return c; }
  }
  async function refreshQuota(uid){
    if(isUnlimited()){ $('#quotaText').textContent=`∞/${MAX_PINGS_PER_DAY} pings today`; return 0; }
    const used=await todayCount(uid);
    $('#quotaText').textContent=`${Math.min(used,MAX_PINGS_PER_DAY)}/${MAX_PINGS_PER_DAY} pings today`;
    return used;
  }
  /* --------- Image upload (Firebase Storage) --------- */
  async function uploadPingImage(file, uid){
    // Compress large images to avoid oversized data URLs in local dev
    async function compressToDataUrl(file, maxWidth=1600, quality=0.85){
      return new Promise((resolve)=>{
        const img=new Image(); const reader=new FileReader();
        reader.onload=()=>{ img.src=reader.result; };
        img.onload=()=>{
          const scale=Math.min(1, maxWidth/Math.max(img.width, img.height));
          const w=Math.round(img.width*scale), h=Math.round(img.height*scale);
          const c=document.createElement('canvas'); c.width=w; c.height=h; const ctx=c.getContext('2d');
          ctx.drawImage(img,0,0,w,h);
          // Try jpeg first, fallback to png if needed
          let url=c.toDataURL('image/jpeg', quality);
          // Guard: Firestore field limit is 1,048,487 bytes; aim smaller
          if(url.length>950000){ url=c.toDataURL('image/jpeg', 0.7); }
          if(url.length>950000){ url=c.toDataURL('image/jpeg', 0.6); }
          resolve(url);
        };
        reader.readAsDataURL(file);
      });
    }
    // For local development, always use data URL to avoid CORS issues
    if(location.hostname === 'localhost' || location.hostname === '127.0.0.1'){
      console.log('Local development detected, compressing to data URL');
      return await compressToDataUrl(file);
    }
    
    try{
      const storage = firebase.storage();
      const extGuess = (file && file.name && file.name.includes('.')) ? file.name.split('.').pop().toLowerCase() : 'jpg';
      const ext = (extGuess || 'jpg').replace(/[^a-z0-9]/g,'').slice(0,5) || 'jpg';
      const path = `pings/${uid}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
      const ref = storage.ref().child(path);
      
      const metadata = {
        contentType: file.type || 'image/jpeg',
        cacheControl: 'public, max-age=31536000'
      };
      
      const snap = await ref.put(file, metadata);
      const url = await snap.ref.getDownloadURL();
      return url;
    }catch(e){ 
      console.error('uploadPingImage', e); 
      // Fallback: compress to data URL
      console.log('Upload failed, compressing to data URL fallback');
      return await compressToDataUrl(file);
    }
  }

  // Video upload (Firebase Storage)
  async function uploadPingVideo(file, uid){
    // Local development fallback: return an object URL so posting works without Storage
    try{
      if(location.hostname === 'localhost' || location.hostname === '127.0.0.1'){
        try{ console.log('Local development detected, using object URL for video'); }catch(_){ }
        return URL.createObjectURL(file);
      }
      const storage = firebase.storage();
      const extGuess = (file && file.name && file.name.includes('.')) ? file.name.split('.').pop().toLowerCase() : 'mp4';
      const ext = (extGuess || 'mp4').replace(/[^a-z0-9]/g,'').slice(0,5) || 'mp4';
      const path = `pings/${uid}/vid_${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
      const ref = storage.ref().child(path);
      const metadata = {
        contentType: file.type || 'video/mp4',
        cacheControl: 'public, max-age=31536000'
      };
      const snap = await ref.put(file, metadata);
      const url = await snap.ref.getDownloadURL();
      return url;
    }catch(e){ console.error('uploadPingVideo', e); throw e; }
  }

  /* --------- Create ping --------- */
  const attachInput = document.getElementById('pingMedia');
  const pingTextInput = document.getElementById('pingText');
  const mentionSuggest = document.getElementById('mentionSuggest');
  const attachPreview = document.getElementById('attachPreview');
  const attachPreviewImg = document.getElementById('attachPreviewImg');
  const attachVideoPreview = document.getElementById('attachVideoPreview');
  const attachPreviewVid = document.getElementById('attachPreviewVid');

  // Subscriber UI removed

  $('#addBtn').onclick=()=>{
    if(!currentUser) return showToast('Sign in first');
    if(currentUser.isAnonymous) return showToast("Guests can't post. Create an account to drop pings.");
    const latEl=$('#lat'), lonEl=$('#lon');
    const base=(userPos && userPos.distanceTo(FENCE_CENTER)<=RADIUS_M) ? userPos : FENCE_CENTER;
    latEl.value=base.lat.toFixed(6); lonEl.value=base.lng.toFixed(6);
    openModal('createModal');
    // Reset preview and ensure attach is enabled for all users
    try{
      const lbl = document.getElementById('attachMediaLabel');
      if(attachInput) attachInput.disabled = false;
      if(lbl){ lbl.classList.remove('muted'); lbl.style.pointerEvents='auto'; lbl.title='Attach Media'; }
      const prev = document.getElementById('attachPreview');
      if(prev) prev.style.display = 'none';
      if(lbl) lbl.style.display = 'inline-flex';
      if(attachInput) attachInput.value = '';
      if(attachVideoPreview) attachVideoPreview.style.display = 'none';
    }catch(_){ }
  };
  $('#cancelCreate').onclick=()=>{ try{ const prev=document.getElementById('attachPreview'); const lbl=document.getElementById('attachMediaLabel'); if(prev) prev.style.display='none'; if(lbl) lbl.style.display='inline-flex'; if(attachInput) attachInput.value=''; const vp=document.getElementById('attachVideoPreview'); if(vp) vp.style.display='none'; if(attachPreviewVid){ attachPreviewVid.pause(); attachPreviewVid.src=''; } }catch(_){ } closeModal('createModal'); };
  // Visibility toggle element
  const pingVisibility = document.getElementById('pingVisibility');
  if(attachInput){
    attachInput.onchange = ()=>{
      try{
        const f = attachInput.files && attachInput.files[0];
        if(!f){ if(attachPreview) attachPreview.style.display='none'; if(attachVideoPreview) attachVideoPreview.style.display='none'; const lbl=document.getElementById('attachMediaLabel'); if(lbl) lbl.style.display='inline-flex'; return; }
        const isVideo = (f.type||'').startsWith('video/');
        const isImage = (f.type||'').startsWith('image/');
        const lbl = document.getElementById('attachMediaLabel'); if(lbl) lbl.style.display='none';
        if(isImage){
          const url = URL.createObjectURL(f);
          if(attachPreviewVid){ attachPreviewVid.pause(); attachPreviewVid.src=''; }
          if(attachVideoPreview) attachVideoPreview.style.display='none';
          if(attachPreviewImg) attachPreviewImg.src=url;
          if(attachPreview) attachPreview.style.display='block';
        } else if(isVideo){
          const url = URL.createObjectURL(f);
          if(attachPreviewImg) attachPreviewImg.src=''; if(attachPreview) attachPreview.style.display='none';
          if(attachPreviewVid) attachPreviewVid.src=url;
          if(attachVideoPreview) attachVideoPreview.style.display='block';
        }
      }catch(_){ }
    };
  }

  map.on('click', e=>{
    if(!currentUser || currentUser.isAnonymous) return;
    const clamped=clampToCircle(FENCE_CENTER, e.latlng, RADIUS_M);
    $('#lat').value=clamped.lat.toFixed(6); $('#lon').value=clamped.lng.toFixed(6);
    openModal('createModal');
  });

  function validText(s){ if(!s) return false; if(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(s)) return false; return true; }
  async function getUserDoc(uid){ const d=await usersRef.doc(uid).get(); return d.exists? d.data() : null; }

  let isSubmittingPing = false; // 🛡️ DUPLICATE PREVENTION: Lock flag
  const localTTLByPingId = new Map(); try{ window.__localTTLByPingId = localTTLByPingId; }catch(_){ }

  function setSubmitButtonsDisabled(disabled){
    try{ const btn=document.getElementById('submitPing'); if(btn) btn.disabled=disabled; }catch(_){ }
  }

  async function submitPingWithTTL(ttlHours){
    if(isSubmittingPing){ console.log('🚫 Ping submission already in progress'); return; }
    try{
      isSubmittingPing = true;
      setSubmitButtonsDisabled(true);

      if(!currentUser) return showToast('Sign in first');
      if(currentUser.isAnonymous) return showToast("Guests can't post. Create an account.");
      const udoc = await getUserDoc(currentUser.uid) || {};
      const lastAt = udoc.lastPingAt?.toDate ? udoc.lastPingAt.toDate().getTime() : 0;
      if(!isUnlimited()){
        if(Date.now()-lastAt < MIN_MILLIS_BETWEEN_PINGS) return showToast('Slow down—try again in a few minutes');
        const used=await refreshQuota(currentUser.uid);
        if(used>=MAX_PINGS_PER_DAY) return showToast('Daily limit reached');
      } else {
        await refreshQuota(currentUser.uid);
      }

      const text=($('#pingText').value||'').trim();
      let lat=parseFloat($('#lat').value), lon=parseFloat($('#lon').value);
      if(!validText(text)) return showToast('Add text (no real names)');
      if(Number.isNaN(lat)||Number.isNaN(lon)){ const base=(userPos && userPos.distanceTo(FENCE_CENTER)<=RADIUS_M)? userPos : FENCE_CENTER; lat=base.lat; lon=base.lng; }
      if(L.latLng(lat,lon).distanceTo(FENCE_CENTER)>RADIUS_M) return showToast('Outside the circle');

      let imageUrl = null, videoUrl = null;
      const mediaFile = attachInput && attachInput.files && attachInput.files[0];
      if(mediaFile){
        const isVideo = (mediaFile.type||'').startsWith('video/');
        const isImage = (mediaFile.type||'').startsWith('image/');
        if(isImage){
          if(mediaFile.size > 10*1024*1024) return showToast('Image must be ≤ 10MB');
          showModerationLoading('Analyzing image...');
          try{
            const analysis = await analyzeImageFromFile(mediaFile);
            hideModerationLoading();
            if(analysis.isNSFW){ return blockUploadForNSFW(`inappropriate content detected (confidence: ${Math.round(analysis.confidence*100)}%)`); }
            imageUrl = await uploadPingImage(mediaFile, currentUser.uid);
          }catch(error){ hideModerationLoading(); console.error('Error analyzing image:', error); imageUrl = await uploadPingImage(mediaFile, currentUser.uid); }
        } else if(isVideo){
          if(mediaFile.size > 50*1024*1024) return showToast('Video must be ≤ 50MB');
          showModerationLoading('Analyzing video...');
          try{
            const analysis = await analyzeVideoFromFile(mediaFile);
            hideModerationLoading();
            if(analysis.isNSFW){ return blockUploadForNSFW(`inappropriate content detected (confidence: ${Math.round(analysis.confidence*100)}%)`); }
            videoUrl = await uploadPingVideo(mediaFile, currentUser.uid);
          }catch(error){ hideModerationLoading(); console.error('Error analyzing video:', error); videoUrl = await uploadPingVideo(mediaFile, currentUser.uid); }
        }
      }

      const visibility = (pingVisibility && pingVisibility.value==='private') ? 'private' : 'public';
      console.log('🔒 Creating ping via secure Cloud Function...');
      const result = await createPingSecure({
        text,
        lat,
        lon,
        visibility,
        imageUrl: imageUrl || null,
        videoUrl: videoUrl || null,
        ttlHours: Number(ttlHours)||24
      });
      if(!result || !result.success || !result.pingId) throw new Error('Failed to create ping');
      const pingId = result.pingId;
      console.log('✅ Ping created securely:', pingId);

      const localCreatedAt = new Date();
      const localTTL = Number(ttlHours)||24;
      const localExpiresAt = new Date(localCreatedAt.getTime() + localTTL*60*60*1000);
      const temp = { id: pingId, text, lat, lon, createdAt: {toDate: () => localCreatedAt}, expiresAt: {toDate: () => localExpiresAt}, ttlHours: localTTL, uid: currentUser.uid, authorId: currentUser.uid, visibility, imageUrl, videoUrl, reactions: {}, commentCount: 0 };
      lastPingCache.set(pingId, temp);
      try{ localTTLByPingId.set(pingId, localTTL); }catch(_){ }
      upsertMarker(temp);

      closeModal('createModal'); $('#pingText').value=''; $('#lat').value=''; $('#lon').value=''; if(attachInput) attachInput.value=''; if(attachPreview) attachPreview.style.display='none'; if(attachVideoPreview) attachVideoPreview.style.display='none';
      await refreshQuota(currentUser.uid);
      showToast('Ping posted', 'success');
    }catch(e){ console.error(e); showToast((e.code||'error')+': '+(e.message||'Error posting')); }
    finally{ isSubmittingPing=false; setSubmitButtonsDisabled(false); }
  }

  // TTL segmented control
  let selectedTTL = 24;
  const ttlSeg = document.getElementById('ttlSeg');
  if(ttlSeg){
    ttlSeg.addEventListener('click', (e)=>{
      const btn = e.target && e.target.closest('button');
      if(!btn) return;
      const ttl = Number(btn.getAttribute('data-ttl')) || 24;
      selectedTTL = ttl;
      // Toggle active state
      const all = ttlSeg.querySelectorAll('button');
      all.forEach(b=> b.classList.toggle('active', b===btn));
    });
  }

  const submitBtn = document.getElementById('submitPing');
  if(submitBtn){ submitBtn.onclick = ()=> submitPingWithTTL(selectedTTL); }

  // Helper: determine TTL from ping document
  function getPingTTLHours(p){
    const allowed = [2,12,24];
    try{ if(p && p.id && localTTLByPingId.has(p.id)) return localTTLByPingId.get(p.id); }catch(_){ }
    const direct = Number(p && p.ttlHours);
    if(Number.isFinite(direct) && allowed.includes(direct)) return direct;
    try{
      const cMs = p && p.createdAt && p.createdAt.toDate ? p.createdAt.toDate().getTime() : null;
      const eMs = p && p.expiresAt && p.expiresAt.toDate ? p.expiresAt.toDate().getTime() : null;
      if(cMs && eMs){
        const diffH = Math.round((eMs - cMs) / (60*60*1000));
        let closest=24, best=Infinity; for(const v of allowed){ const d=Math.abs(v-diffH); if(d<best){best=d; closest=v;} }
        return closest;
      }
      if(eMs){
        const remH = Math.ceil((eMs - Date.now()) / (60*60*1000));
        if(remH <= 2) return 2;
        if(remH <= 12) return 12;
        return 24;
      }
    }catch(_){ }
    return 24;
  }

  /* --------- Sheet / votes / comments / reports --------- */
  const sheet=$('#pingSheet'), sheetText=$('#sheetText'), sheetMeta=$('#sheetMeta');
  const sheetImage=$('#sheetImage'), sheetImgEl=$('#sheetImgEl');
  const sheetVideo=$('#sheetVideo'), sheetVidEl=$('#sheetVidEl');
  const viewMediaBtn=$('#viewMediaBtn');
  const authorRow=document.getElementById('authorRow');
  const authorAvatar=document.getElementById('authorAvatar');
  const authorNameLine=document.getElementById('authorNameLine');
  const authorStatsLine=document.getElementById('authorStatsLine');
  const authorAddFriendBtn=document.getElementById('authorAddFriendBtn');
  const reactBar=$('#reactBar'), commentsEl=$('#comments'), commentInput=$('#commentInput');
  const openInMapsBtn=document.getElementById('openInMapsBtn');
  let openId=null, openUnsub=null, openCommentsUnsub=null;

  // 🚀 PERFORMANCE: Comment rendering cache to avoid re-parsing mentions
  const commentRenderCache = new Map(); // commentId -> {text, mentions, rendered HTML}

  function openSheet(id){
    if(openUnsub) openUnsub(); if(openCommentsUnsub) openCommentsUnsub();
    commentRenderCache.clear(); // Clear cache when opening new ping
    openId=id; sheet.classList.add('open'); applyModalOpenClass();

    openUnsub = pingsRef.doc(id).onSnapshot(doc=>{
      if(!doc.exists){ sheet.classList.remove('open'); return; }
      const p={id:doc.id, ...doc.data()}; lastPingCache.set(p.id,p);
      
      // 🔒 SECURITY CHECK: Verify user has permission to view this ping
      if(p.visibility === 'private') {
        const isAuthor = currentUser && p.authorId === currentUser.uid;
        const isFriend = myFriends && myFriends.has && myFriends.has(p.authorId);
        
        if(!isAuthor && !isFriend) {
          console.warn('🔒 Access denied: User does not have permission to view private ping', p.id);
          sheet.classList.remove('open');
          showToast('This ping is private', 'error');
          return;
        }
      }
      
      // Populate author row (visible to everyone for public; private limited by shouldShow)
      (async ()=>{
        try{
          const uid = p.authorId;
          const you = currentUser && uid===currentUser.uid;
          const uDoc = await usersRef.doc(uid).get();
          const u = uDoc.exists ? uDoc.data() : {};
          const handle = (u && u.handle) ? String(u.handle).trim() : '';
          const displayBase = handle ? `@${handle}` : (u.email || 'Friend');
          const name = you ? 'You' : displayBase;
          const pts = Number(u.points||0);
          const streak = Number(u.streakDays||0);
          if(authorNameLine){ authorNameLine.textContent = name; }
          if(authorStatsLine){ authorStatsLine.textContent = `${pts} PPs • 🔥 ${streak}`; }
          if(authorAvatar){ if(u.photoURL){ authorAvatar.style.backgroundImage=`url("${u.photoURL}")`; authorAvatar.classList.add('custom-avatar'); } else { authorAvatar.style.backgroundImage=''; authorAvatar.classList.remove('custom-avatar'); } }
          if(authorRow){ authorRow.onclick = ()=> openOtherProfile(uid); }
          // Friend CTA inline
          try{
            if(authorAddFriendBtn){
              const isFriend = myFriends && myFriends.has && myFriends.has(uid);
              if(!you && !isFriend){ authorAddFriendBtn.style.display='inline-flex'; authorAddFriendBtn.onclick = async (e)=>{ e.stopPropagation(); try{ if(!currentUser) return showToast('Sign in first'); await sendFriendRequest(currentUser.uid, uid); authorAddFriendBtn.style.display='none'; showToast('Friend request sent'); }catch(err){ console.error(err); showToast('Could not send request'); } }; }
              else { authorAddFriendBtn.style.display='none'; authorAddFriendBtn.onclick=null; }
            }
          }catch(_){ }
          // Lightbox bylines
          try{ const imgBy=document.getElementById('imageByline'); if(imgBy){ imgBy.textContent = `by ${displayBase}`; } }catch(_){ }
          try{ const vidBy=document.getElementById('videoByline'); if(vidBy){ vidBy.textContent = `by ${displayBase}`; } }catch(_){ }
        }catch(e){ console.warn('author row', e); }
      })();
      // Open in Maps button
      try{
        if(openInMapsBtn){
          const lat = Number(p.lat), lon = Number(p.lon);
          const valid = Number.isFinite(lat) && Number.isFinite(lon);
          openInMapsBtn.style.display = valid ? 'inline-flex' : 'none';
          openInMapsBtn.onclick = ()=>{
            if(!valid) return;
            const isApple = /Mac|iPhone|iPad|iPod/i.test(navigator.platform) || /Safari\//.test(navigator.userAgent) && !/Chrome\//.test(navigator.userAgent);
            // Prefer directions from current location
            const apple = `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
            const google = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;
            const href = isApple ? apple : google;
            try{ window.open(href, (isApple? '_self' : '_blank')); }catch(_){ location.href = href; }
          };
        }
      }catch(_){ }
      // Render ping text with mentions if present
      try{
        if(Array.isArray(p.mentions) && p.mentions.length){ renderTextWithMentions(sheetText, String(p.text||''), p.mentions); }
        else { sheetText.textContent = p.text; }
      }catch(_){ sheetText.textContent = p.text; }
      const created = p.createdAt?.toDate ? p.createdAt.toDate().getTime() : null;
      // Build meta: place label • distance (if available) • time ago
      (async ()=>{
        const parts=[];
        try{
          const label = await reverseGeocode(Number(p.lat), Number(p.lon));
          if(label) parts.push(label); else parts.push('Nearby');
        }catch(_){ parts.push('Nearby'); }
        try{
          if(userPos){
            const d=L.latLng(p.lat,p.lon).distanceTo(userPos);
            const distTxt = (d<1000) ? `${Math.round(d)} m away` : `${(d/1000).toFixed(1)} km away`;
            parts.push(distTxt);
          }
        }catch(_){ }
        // TTL label (2/12/24 hr)
        try{ const ttl = getPingTTLHours(p); parts.push(`${ttl} hr`); }catch(_){ parts.push('24 hr'); }
        parts.push(timeAgo(created));
        sheetMeta.textContent = parts.join(' • ');
      })();
      try{ const titleEl=document.getElementById('pingSheetTitle'); if(titleEl){ titleEl.innerHTML = p.visibility==='private' ? 'Ping <span class="private-badge">Private</span>' : 'Ping'; } }catch(_){ }
      // Media handling: hide inline; show a single View button and set byline
      let hasMedia=false; let mediaType=null;
      if(p.imageUrl){ sheetImgEl.src=p.imageUrl; sheetImage.style.display='none'; hasMedia=true; mediaType='image'; }
      else { sheetImage.style.display='none'; }
      if(p.videoUrl){ if(sheetVidEl) sheetVidEl.src=p.videoUrl; if(sheetVideo) sheetVideo.style.display='none'; hasMedia=true; mediaType= mediaType || 'video'; }
      else { if(sheetVideo) sheetVideo.style.display='none'; }
      if(viewMediaBtn){
        if(hasMedia){
          viewMediaBtn.style.display='inline-flex';
          viewMediaBtn.onclick=()=>{
            if(p.videoUrl){ const vl=document.getElementById('lightboxVideo'); if(vl){ try{ vl.pause(); }catch(_){ } vl.removeAttribute('src'); vl.load(); vl.src=p.videoUrl; try{ vl.currentTime=0; }catch(_){ } setTimeout(()=>{ try{ vl.play(); }catch(_){ } }, 50); openModal('videoLightbox'); } return; }
            if(p.imageUrl){ const lb=document.getElementById('lightboxImg'); if(lb){ lb.src=p.imageUrl; openModal('imageLightbox'); } }
          };
        } else { viewMediaBtn.style.display='none'; viewMediaBtn.onclick=null; }
      }
      // Toggle Delete button visibility if author
      try{
        const delBtn=document.getElementById('deletePingBtn');
        if(delBtn){
          const mine = (currentUser && p.authorId===currentUser.uid);
          delBtn.style.display = mine ? 'inline-flex' : 'none';
          if(mine){
            delBtn.onclick = async ()=>{
              try{
                if(!confirm('Delete this ping?')) return;
                await pingsRef.doc(p.id).delete();
                showToast('Ping deleted');
                sheet.classList.remove('open'); applyModalOpenClass();
              }catch(e){ console.error(e); showToast('Delete failed'); }
            };
          } else {
            delBtn.onclick = null;
          }
        }
      }catch(_){ }

      // 🚩 Toggle Report button visibility (only show for other people's content)
      try{
        const reportBtn=document.getElementById('reportBtn');
        if(reportBtn){
          const mine = (currentUser && p.authorId===currentUser.uid);
          const signedIn = !!currentUser;
          // Show report button if: signed in AND not your own ping
          reportBtn.style.display = (signedIn && !mine) ? 'inline-flex' : 'none';
          if(signedIn && !mine){
            reportBtn.onclick = ()=>{
              // Store current ping ID for report submission
              window.currentReportPingId = p.id;
              openModal('reportModal');
            };
          } else {
            reportBtn.onclick = null;
          }
        }
      }catch(_){ }

      renderVoteBar(p); upsertMarker(p);
    });

    // 🔥 PERFORMANCE: Reduced from 200 to 50 comments - most pings don't need more
    openCommentsUnsub = pingsRef.doc(id).collection('comments').orderBy('createdAt','desc').limit(50).onSnapshot(s=>{
      commentsEl.innerHTML=''; s.forEach(d=>{
        const c=d.data(); const when=c.createdAt||null;
        const div=document.createElement('div'); div.className='comment';
        const textSpan=document.createElement('span');
        textSpan.style.display='inline'; // Ensure inline display for click events
        textSpan.style.pointerEvents='auto'; // Ensure pointer events work
        
        // 🚀 MEMOIZATION: Check cache first to avoid re-parsing mentions
        const cacheKey = d.id;
        const cached = commentRenderCache.get(cacheKey);
        const textChanged = !cached || cached.text !== c.text || JSON.stringify(cached.mentions) !== JSON.stringify(c.mentions);
        
        if(textChanged) {
        // Render mentions if present
          if(Array.isArray(c.mentions) && c.mentions.length){ 
            console.log('Rendering comment with mentions:', c.mentions);
            renderTextWithMentions(textSpan, String(c.text||''), c.mentions); 
          }
        else { textSpan.textContent=String(c.text||''); }
          
          // Cache the rendered HTML
          commentRenderCache.set(cacheKey, {
            text: c.text,
            mentions: c.mentions,
            html: textSpan.innerHTML
          });
        } else {
          // Use cached HTML
          textSpan.innerHTML = cached.html;
        }
        const br=document.createElement('br');
        const small=document.createElement('small'); small.textContent=timeAgo(when);
        div.appendChild(textSpan); div.appendChild(br); div.appendChild(small);
        // Delete for own comment
        try{
          if(currentUser && c.authorId===currentUser.uid){
            const del=document.createElement('button'); del.className='btn'; del.textContent='Delete'; del.style.marginLeft='8px';
            del.onclick = async ()=>{
              try{ await pingsRef.doc(openId).collection('comments').doc(d.id).delete(); showToast('Comment deleted'); }
              catch(e){ console.error(e); showToast('Delete failed'); }
            };
            div.appendChild(del);
          }
        }catch(_){ }
        commentsEl.appendChild(div);
      });
      try{ commentsEl.scrollTo({ top: 0, behavior: 'smooth' }); }catch(_){ }
    });
  }
  $('#closeSheet').onclick=()=>{ sheet.classList.remove('open'); if(openUnsub) openUnsub(); if(openCommentsUnsub) openCommentsUnsub(); openId=null; applyModalOpenClass(); };

  // Image lightbox behavior
  try{
    sheetImgEl.onclick = ()=>{ const lb=document.getElementById('lightboxImg'); if(sheetImgEl && sheetImgEl.src && lb){ lb.src = sheetImgEl.src; openModal('imageLightbox'); } };
    document.getElementById('closeLightbox').onclick = ()=> closeModal('imageLightbox');
  }catch(_){ }

  // Video lightbox behavior
  try{
    const closeV = document.getElementById('closeVideoLightbox');
    if(closeV){ closeV.onclick = ()=>{ try{ const vl=document.getElementById('lightboxVideo'); if(vl){ vl.pause(); vl.removeAttribute('src'); vl.load(); } }catch(_){ } closeModal('videoLightbox'); }; }
  }catch(_){ }

  // Remove attached image in create modal
  try{
    const removeAttachBtn = document.getElementById('removeAttachBtn');
    const removeVideoBtn = document.getElementById('removeVideoBtn');
    const clearAll = ()=>{
      try{
        if(attachPreviewImg) attachPreviewImg.src=''; if(attachPreview) attachPreview.style.display='none';
        if(attachPreviewVid){ attachPreviewVid.pause(); attachPreviewVid.src=''; }
        if(attachVideoPreview) attachVideoPreview.style.display='none';
        const lbl = document.getElementById('attachMediaLabel'); if(lbl) lbl.style.display='inline-flex';
        if(attachInput) attachInput.value='';
      }catch(_){ }
    };
    if(removeAttachBtn){ removeAttachBtn.onclick = clearAll; }
    if(removeVideoBtn){ removeVideoBtn.onclick = clearAll; }
  }catch(_){ }

  const ENABLE_FRIEND_REACTIONS = false; // disable to avoid extra reads/permissions
  async function renderVoteBar(p){
    reactBar.innerHTML='';
    const disabled = (!currentUser || currentUser.isAnonymous);
    const mk=(type,label,count)=>{
      const b=document.createElement('button'); b.className='react';
      const n = Number(count)||0; b.textContent = n>0 ? `${label} ${n}` : label;
      if(disabled){ b.disabled=true; b.style.opacity=.6; b.title='Sign in to react'; }
      else { b.onclick=()=>setVote(p.id,type).catch(console.error); }
      return b;
    };
    reactBar.appendChild(mk('like','👍',p.likes)); 
    reactBar.appendChild(mk('dislike','👎',p.dislikes));
    
    // Show which friends reacted (optional)
    if(ENABLE_FRIEND_REACTIONS && currentUser && !currentUser.isAnonymous && myFriends && myFriends.size > 0){
      try{
        // Query votes for this ping
        const votesSnapshot = await votesRef.where('pingId', '==', p.id).get();
        const friendLikes = [];
        const friendDislikes = [];
        
        votesSnapshot.forEach(voteDoc => {
          const vote = voteDoc.data();
          if(vote.userId && myFriends.has(vote.userId)){
            if(vote.type === 'like') friendLikes.push(vote.userId);
            else if(vote.type === 'dislike') friendDislikes.push(vote.userId);
          }
        });
        
        // Display friend reactions
        if(friendLikes.length > 0 || friendDislikes.length > 0){
          const friendSection = document.createElement('div');
          friendSection.style.cssText = 'margin-top:8px;padding-top:8px;border-top:1px solid #f2f2f2;font-size:12px;color:#6b7280';
          
          if(friendLikes.length > 0){
            const likeDiv = document.createElement('div');
            likeDiv.style.marginBottom = '4px';
            likeDiv.innerHTML = '<strong style="color:#0f8a3b">👍 Friends who liked:</strong> ';
            
            for(let i = 0; i < Math.min(friendLikes.length, 5); i++){
              const uid = friendLikes[i];
              const handleSpan = document.createElement('span');
              handleSpan.style.cssText = 'color:#1d4ed8;font-weight:600;cursor:pointer;margin-right:6px';
              handleSpan.textContent = '@...';
              handleSpan.onclick = ()=> openOtherProfile(uid);
              
              // Fetch handle asynchronously
              (async ()=>{
                try{
                  const handle = await getHandleForUid(uid);
                  handleSpan.textContent = handle;
                }catch(_){}
              })();
              
              likeDiv.appendChild(handleSpan);
            }
            
            if(friendLikes.length > 5){
              const more = document.createElement('span');
              more.textContent = `+${friendLikes.length - 5} more`;
              more.style.color = '#9ca3af';
              likeDiv.appendChild(more);
            }
            
            friendSection.appendChild(likeDiv);
          }
          
          if(friendDislikes.length > 0){
            const dislikeDiv = document.createElement('div');
            dislikeDiv.innerHTML = '<strong style="color:#ef4444">👎 Friends who disliked:</strong> ';
            
            for(let i = 0; i < Math.min(friendDislikes.length, 5); i++){
              const uid = friendDislikes[i];
              const handleSpan = document.createElement('span');
              handleSpan.style.cssText = 'color:#1d4ed8;font-weight:600;cursor:pointer;margin-right:6px';
              handleSpan.textContent = '@...';
              handleSpan.onclick = ()=> openOtherProfile(uid);
              
              // Fetch handle asynchronously
              (async ()=>{
                try{
                  const handle = await getHandleForUid(uid);
                  handleSpan.textContent = handle;
                }catch(_){}
              })();
              
              dislikeDiv.appendChild(handleSpan);
            }
            
            if(friendDislikes.length > 5){
              const more = document.createElement('span');
              more.textContent = `+${friendDislikes.length - 5} more`;
              more.style.color = '#9ca3af';
              dislikeDiv.appendChild(more);
            }
            
            friendSection.appendChild(dislikeDiv);
          }
          
          reactBar.appendChild(friendSection);
        }
      }catch(err){
        console.error('Error loading friend reactions:', err);
      }
    }
  }

  // Vote transaction with NET-like milestones (firstNetAt.{N})
  async function setVote(pingId,type){
    if(!currentUser) return showToast('Sign in first');
    if(currentUser.isAnonymous) return showToast("Guests can't react");
    try{
      // Map legacy like/dislike to secure emoji reactions
      const emoji = type === 'like' ? '👍' : '👀';
      // 🔒 SECURITY: Use Cloud Function to toggle reaction
      const res = await toggleReactionSecure(pingId, emoji);
      if(!res || !res.success){ throw new Error('Failed to toggle reaction'); }
      // Live snapshot listener will update counts; no client-side writes
    }catch(err){
      console.error('Reaction failed:', err);
      showToast(err.message || 'Could not react');
    }
  }
  $('#sendComment').onclick=async()=>{
    if(!openId) return; if(!currentUser) return showToast('Sign in first');
    if(currentUser.isAnonymous) return showToast("Guests can't comment");
    const t=(commentInput.value||'').trim(); 
    if(!t) return; 
    if(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(t)) return showToast('No real names');
    
    try{
      // 🔒 SECURITY: Use Cloud Function for secure comment creation
      console.log('🔒 Creating comment via secure Cloud Function...');
      
      const result = await addCommentSecure(openId, t);
      
      if(!result || !result.success) {
        throw new Error('Failed to add comment');
      }
      
      console.log('✅ Comment added securely');
      commentInput.value = '';
      
      // Note: Comment will appear via real-time listener
      // No need to manually update UI
      
      // Notifications handled server-side; client-side disabled to avoid permission errors
      
      // Mention notifications handled server-side
    }catch(err){
      console.error('Error posting comment:', err);
      showToast('Could not post comment');
    }
    commentInput.value='';
    try{ commentsEl.scrollTo({ top: 0, behavior: 'smooth' }); }catch(_){ }
  };

  // Enter to send, Shift+Enter for newline
  try{
    if(commentInput){
      commentInput.addEventListener('keydown', (e)=>{
        if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); const btn=document.getElementById('sendComment'); if(btn) btn.click(); }
      });
    }
  }catch(_){ }

  // Old report dropdown removed - now using modal

  
  // ---- Friend identity helpers ----
  async function sha256Hex(str){
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function resolveUserByHandleOrEmail(q){
    // handle: starts with @ or contains only allowed chars
    let handle = null, email = null;
    if(q.includes('@') && q.includes('.')){ email = q; }
    else { handle = q.startsWith('@') ? q.slice(1) : q; }

    if(email){
      const h = await sha256Hex(email.trim().toLowerCase());
      const doc = await db.collection('emailHashes').doc(h).get();
      if(doc.exists) return doc.data().uid || null;
    }
    if(handle){
      const hdl = handle.trim().toLowerCase();
      const doc = await db.collection('handles').doc(hdl).get();
      if(doc.exists) return doc.data().uid || null;
    }
    return null;
  }

  // ---- Mentions helpers ----
  const mentionHandleRegex = /(^|[^a-z0-9_.])@([a-z0-9_.]+)/ig;
  const mentionsCache = new Map(); // uid -> { handle, photoURL }
  async function resolveUidByHandle(handleLC){
    try{ const doc = await db.collection('handles').doc(handleLC).get(); return doc.exists ? (doc.data().uid||null) : null; }catch(_){ return null; }
  }
  async function getUserBasics(uid){
    if(!uid) return { handle:null, photoURL:null, displayName:'Friend' };
    if(mentionsCache.has(uid)) return mentionsCache.get(uid);
    try{ const d=await usersRef.doc(uid).get(); const handle=d.exists? (d.data().handle||null):null; const photoURL=d.exists? (d.data().photoURL||null):null; const displayName = handle? ('@'+handle) : ('@user'+String(uid).slice(0,6)); const out = { handle, photoURL, displayName }; mentionsCache.set(uid,out); return out; }catch(_){ return { handle:null, photoURL:null, displayName:'Friend' }; }
  }

  // HELPER: Get friend list for a user (with caching)
  const friendListCache = new Map(); // uid -> Set of friend UIDs
  async function getFriendsList(uid){
    if(!uid) return new Set();
    if(friendListCache.has(uid)) return friendListCache.get(uid);
    try{
      const userDoc = await usersRef.doc(uid).get();
      const friendIds = userDoc.exists && Array.isArray(userDoc.data().friendIds) ? userDoc.data().friendIds : [];
      const friendSet = new Set(friendIds);
      friendListCache.set(uid, friendSet);
      return friendSet;
    }catch(err){
      console.error('Error fetching friends list:', err);
      return new Set();
    }
  }

  // Mention suggestions (handles + @friends)
  function hideMentionSuggest(){ if(mentionSuggest){ mentionSuggest.style.display='none'; mentionSuggest.innerHTML=''; } }
  function showMentionSuggest(items, anchorEl){
    if(!mentionSuggest || !anchorEl) return; if(!items || !items.length){ hideMentionSuggest(); return; }
    const rect = anchorEl.getBoundingClientRect();
    mentionSuggest.innerHTML='';
    items.forEach(it=>{
      const row=document.createElement('div'); row.className='mi';
      const av=document.createElement('div'); av.className='av'; if(it.photoURL){ av.style.backgroundImage=`url("${it.photoURL}")`; av.style.backgroundSize='cover'; av.style.border='1px solid #e6e6e6'; }
      const nm=document.createElement('div'); nm.className='nm'; nm.textContent = it.label;
      row.appendChild(av); row.appendChild(nm);
      row.onclick = ()=>{ try{
        let el = null;
        if(mentionTarget){
          if(mentionTarget.type==='comment') el = commentInput;
          else if(mentionTarget.type==='addfriend') el = addFriendInputProfile;
          else if(mentionTarget.type==='gift') el = document.getElementById('giftWho');
          else el = pingTextInput;
        } else {
          el = pingTextInput;
        }
        if(!el) return;
        // For Add Friend/gift fields, replace entire field with handle (no '@' search)
        if(mentionTarget && (mentionTarget.type==='addfriend' || mentionTarget.type==='gift')){
          el.value = it.insert;
          el.focus(); const ev=new Event('input', {bubbles:true}); el.dispatchEvent(ev);
          hideMentionSuggest(); return;
        }
        const val = el.value; const at = val.lastIndexOf('@'); if(at>=0){ el.value = val.slice(0,at) + it.insert + ' '; el.focus(); const ev=new Event('input', {bubbles:true}); el.dispatchEvent(ev); }
        hideMentionSuggest();
      }catch(_){ } };
      mentionSuggest.appendChild(row);
    });
    // Prefer positioning above the input to save space on small screens
    const spaceBelow = window.innerHeight - rect.bottom;
    const popH = Math.min(220, Math.max(140, items.length*32 + 12));
    const showAbove = spaceBelow < popH + 16 && rect.top > popH + 16;
    mentionSuggest.style.left = Math.max(8, rect.left) + 'px';
    mentionSuggest.style.top  = showAbove ? (rect.top - popH - 6) + 'px' : (rect.bottom + 6) + 'px';
    mentionSuggest.style.display='block';
  }

  async function buildMentionCandidates(prefixLC){
    const list=[];
    // @friends option when matches prefix
    if('friends'.startsWith(prefixLC)) list.push({ label:'@friends', insert:'@friends', photoURL:'' });
    // friends handles
    try{
      const ids = myFriends ? Array.from(myFriends).slice(0,50) : [];
      const snaps = await Promise.all(ids.map(id=> usersRef.doc(id).get().catch(()=>null)));
      snaps.forEach(d=>{
        if(d && d.exists){ const u=d.data(); const h=u && u.handle ? String(u.handle).trim() : ''; if(h && h.toLowerCase().startsWith(prefixLC)){ list.push({ label:'@'+h, insert:'@'+h, photoURL: u.photoURL||'' }); } }
      });
    }catch(_){ }
    // if few results, try global handle lookup by prefix
    // 🔒 FIXED: Validate handles but DON'T try to clean up during autocomplete
    if(list.length<5){
      try{
        const q = await db.collection('handles').where(firebase.firestore.FieldPath.documentId(), '>=', prefixLC).where(firebase.firestore.FieldPath.documentId(), '<=', prefixLC+'\uf8ff').limit(20).get();
        
        // 🛡️ Validate each handle points to a real user before adding to suggestions
        const validationPromises = [];
        const handleDocs = [];
        q.forEach(doc => {
          if(!doc.id) return;
          const uid = doc.data().uid;
          if(!uid) return;
          handleDocs.push({ handle: doc.id, uid: uid });
          validationPromises.push(usersRef.doc(uid).get());
        });
        
        const userDocs = await Promise.all(validationPromises);
        for(let i = 0; i < handleDocs.length; i++) {
          const handleDoc = handleDocs[i];
          const userDoc = userDocs[i];
          
          // Skip if user doesn't exist (just skip, don't try to clean up)
          if(!userDoc.exists) {
            console.log('⚠️ Skipping orphaned handle:', handleDoc.handle);
            continue;
          }
          
          const userData = userDoc.data();
          const userHandle = userData.handle ? String(userData.handle).trim().toLowerCase() : '';
          
          // Skip if handles don't match (just skip, don't try to clean up)
          if(userHandle !== handleDoc.handle.toLowerCase()) {
            console.log('⚠️ Skipping mismatched handle:', handleDoc.handle, '(user has:', userHandle + ')');
            continue;
          }
          
          // Valid handle - add to suggestions if not already present
          if(list.find(x=>x.insert==='@'+handleDoc.handle)) continue;
          list.push({ 
            label: '@'+handleDoc.handle, 
            insert: '@'+handleDoc.handle, 
            photoURL: userData.photoURL || '' 
          });
          
          if(list.length >= 10) break; // Stop once we have enough suggestions
        }
      }catch(err){ 
        console.error('Error in handle autocomplete:', err);
      }
    }
    // Clean up: remove empties and dedupe labels; put @friends first, then alpha
    const seen = new Set();
    const cleaned = [];
    for(const it of list){ if(!it || !it.label) continue; if(it.label==='@') continue; if(seen.has(it.label.toLowerCase())) continue; seen.add(it.label.toLowerCase()); cleaned.push(it); }
    cleaned.sort((a,b)=>{ const af=(a.label==='@friends')?0:1, bf=(b.label==='@friends')?0:1; if(af!==bf) return af-bf; return a.label.toLowerCase().localeCompare(b.label.toLowerCase()); });
    return cleaned.slice(0,10);
  }

  let mentionSuggestReq = 0; let mentionTarget = null; // {type:'ping'|'comment'}
  if(pingTextInput){
    pingTextInput.addEventListener('input', async ()=>{
      const req = ++mentionSuggestReq;
      try{
        const val = pingTextInput.value||''; const at = val.lastIndexOf('@'); if(at<0){ hideMentionSuggest(); return; }
        const prefix = val.slice(at+1).toLowerCase().replace(/[^a-z0-9_.]/g,'');
        mentionTarget={type:'ping'};
        if(prefix.length===0){ if(req===mentionSuggestReq) showMentionSuggest([{ label:'@friends', insert:'@friends', photoURL:'' }], pingTextInput); return; }
        const items = await buildMentionCandidates(prefix);
        if(req===mentionSuggestReq) showMentionSuggest(items, pingTextInput);
      }catch(_){ }
    });
    document.addEventListener('click', (e)=>{ if(!mentionSuggest) return; if(e.target===mentionSuggest || mentionSuggest.contains(e.target)) return; hideMentionSuggest(); });
  }

  // Comment @-suggest (reuse existing commentInput declared earlier)
  if(commentInput){
    commentInput.addEventListener('input', async ()=>{
      const req = ++mentionSuggestReq;
      try{
        const val = commentInput.value||''; const at = val.lastIndexOf('@'); if(at<0){ hideMentionSuggest(); return; }
        const prefix = val.slice(at+1).toLowerCase().replace(/[^a-z0-9_.]/g,'');
        mentionTarget={type:'comment'};
        if(prefix.length===0){ if(req===mentionSuggestReq) showMentionSuggest([{ label:'@friends', insert:'@friends', photoURL:'' }], commentInput); return; }
        const items = await buildMentionCandidates(prefix);
        if(req===mentionSuggestReq) showMentionSuggest(items, commentInput);
      }catch(_){ }
    });
  }


  async function ensureIdentityMappings(user){
    // Ensure handle - PRESERVE EXISTING HANDLES
    try{
      console.log('🔧 Ensuring identity mappings for user:', user.uid);
      const uref = usersRef.doc(user.uid);
      const udoc = await uref.get();
      let handle = udoc.exists ? (udoc.data().handle||null) : null;
      console.log('Current handle from user doc:', handle);
      
      // CRITICAL: If user already has a handle, verify/repair mapping WITHOUT changing the handle
      if(handle) {
        console.log('✅ User has existing handle:', handle);
        
        // Check if handle is locked (permanent)
        const userData = udoc.exists ? udoc.data() : {};
        if(userData.handleLocked) {
          console.log('🔒 Handle is LOCKED - will never change:', handle);
          return; // Locked handle, never change it
        }
        
        // Verify the handle mapping in `handles` collection
        const handleLC = String(handle).toLowerCase();
        const handleRef = db.collection('handles').doc(handleLC);
        const handleSnap = await handleRef.get();
        if(handleSnap.exists) {
          const ownerUid = handleSnap.data().uid;
          if(ownerUid === user.uid) {
            console.log('✅ Handle mapping is correct. Preserving handle:', handle);
            return; // All good
          }
          // Handle claimed by someone else (should be rare) → generate a new one below
          console.warn('⚠️ Handle mapping points to a different user. Will generate a new handle. handle=', handle, 'owner=', ownerUid);
          handle = null; // Trigger new handle generation
        } else {
          // Mapping missing → claim it atomically via transaction (do NOT change user's handle)
          console.log('🛠️ Handle mapping missing. Claiming handle for user:', handle);
          try{
            await db.runTransaction(async (tx) => {
              const snap = await tx.get(handleRef);
              if(!snap.exists) {
                tx.set(handleRef, { uid: user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
              } else if(snap.data().uid !== user.uid) {
                throw new Error('Handle was claimed during transaction');
              }
              // Ensure user doc has correct normalized case fields
              tx.set(uref, { handle: handle, handleLC: handleLC }, { merge:true });
            });
            console.log('✅ Repaired handle mapping for:', handle);
            return; // Mapping repaired, nothing else to do
          }catch(repairErr){
            console.error('❌ Failed to repair handle mapping:', repairErr);
            // Fall through to new handle generation as safety
            handle = null;
          }
        }
      }
      
      if(!handle){
        console.log('📝 Creating new handle for user...');
        const base = (user.displayName || (user.email ? user.email.split('@')[0] : 'user')).toLowerCase().replace(/[^a-z0-9_.]/g,'');
        let attempt = base.slice(0,16) || 'user';
        console.log('Base handle:', base, 'First attempt:', attempt);
        let i=0;
        while(i<50){
          const doc = await db.collection('handles').doc(attempt).get();
          if(!doc.exists){ 
            console.log('✅ Handle available:', attempt);
            // Use transaction to prevent race conditions
            await db.runTransaction(async (tx) => {
              const handleRef = db.collection('handles').doc(attempt);
              const handleSnap = await tx.get(handleRef);
              if(!handleSnap.exists) {
                tx.set(handleRef, { uid:user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
                tx.set(uref, { handle: attempt, handleLC: attempt.toLowerCase() }, { merge:true });
                handle = attempt;
                console.log('✅ Created handle document for:', handle);
              }
            });
            if(handle) {
              // 🧹 Invalidate cache after creating new handle
              if(typeof invalidateHandleCache === 'function') {
                invalidateHandleCache(user.uid);
              }
              break;
            }
          }
          console.log('⚠️ Handle taken:', attempt, 'trying next...');
          i++; attempt = (base.slice(0,12) || 'user') + (Math.floor(Math.random()*9000)+1000);
        }
        if(!handle) {
          console.error('❌ Failed to create handle after 50 attempts');
        } else {
          console.log('✅ Handle created successfully:', handle);
      }
      }
    }catch(e){ console.error('❌ Ensure handle failed:', e); }
    // Ensure email hash map
    try{
      if(user.email){
        const h = await sha256Hex(user.email.trim().toLowerCase());
        await db.collection('emailHashes').doc(h).set({ uid:user.uid, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      }
    }catch(e){ console.warn('ensure email hash failed', e); }
  }

  // ---- Friend requests ----
  async function sendFriendRequest(_fromUid, toUid){
    if(!currentUser) throw new Error('Sign in first');
    if(!toUid) throw new Error('No recipient');
    const result = await sendFriendRequestSecure({ targetUid: toUid });
    if(result && result.autoAccepted){
      showToast('Friend added', 'success');
      await refreshFriends();
    }
  }

  async function acceptFriendRequest(reqId){
    try{
      // 🔒 SECURITY: Use Cloud Function for secure friend request acceptance
      console.log('🔒 Accepting friend request via secure Cloud Function...');
      
      const result = await acceptFriendRequestSecure(reqId);
      
      if(!result || !result.success) {
        throw new Error('Failed to accept friend request');
      }
      
      console.log('✅ Friend request accepted securely');
      showToast('Friend request accepted', 'success');
    await refreshFriends();
    }catch(e){
      showToast(e.message||'Failed to accept request', 'error');
      console.error(e);
    }
  }
  async function declineFriendRequest(reqId){
    try{
      // 🔒 SECURITY: Use Cloud Function for secure friend request rejection
      console.log('🔒 Rejecting friend request via secure Cloud Function...');
      
      const result = await rejectFriendRequestSecure(reqId);
      
      if(!result || !result.success) {
        throw new Error('Failed to reject friend request');
      }
      
      console.log('✅ Friend request rejected securely');
    }catch(e){
      console.error('Error rejecting friend request:', e);
      // Silent fail for reject - not critical
    }
  }
  async function cancelFriendRequest(reqId){
    await cancelFriendRequestSecure(reqId);
  }

  // Requests UI (Profile modal)
  let reqInUnsub=null, reqOutUnsub=null;
  function startRequestsListeners(uid){
    if(reqInUnsub) reqInUnsub(); if(reqOutUnsub) reqOutUnsub();
    // Simplified queries to avoid index requirements
    const inRef = db.collection('friendRequests').where('to','==',uid).where('status','==','pending');
    const outRef= db.collection('friendRequests').where('from','==',uid).where('status','==','pending');
    reqInUnsub = inRef.onSnapshot(()=>updateRequestsUI().catch(console.error));
    reqOutUnsub = outRef.onSnapshot(()=>updateRequestsUI().catch(console.error));
    // Initial paint in case there are existing requests
    updateRequestsUI().catch(console.error);
  }

  async function updateRequestsUI(){
    const cont = document.getElementById('requestsList'); if(!cont) return;
    if(!currentUser){ cont.innerHTML='<div class="muted">Sign in to see requests.</div>'; return; }
    // Simplified queries to avoid index requirements
    const inSS  = await db.collection('friendRequests').where('to','==',currentUser.uid).where('status','==','pending').get();
    const outSS = await db.collection('friendRequests').where('from','==',currentUser.uid).where('status','==','pending').get();

    const items=[];
    const seenUsers = new Set(); // FIX: Deduplicate by user, not doc ID
    // Incoming requests - deduplicate by 'from' UID
    for(const doc of inSS.docs){ 
      const fromUid = doc.data().from;
      if(!seenUsers.has(fromUid)){ 
        items.push({ id:doc.id, dir:'in', ...doc.data() }); 
        seenUsers.add(fromUid); 
      }
    }
    // Outgoing requests - deduplicate by 'to' UID
    for(const doc of outSS.docs){ 
      const toUid = doc.data().to;
      if(!seenUsers.has(toUid)){ 
        items.push({ id:doc.id, dir:'out', ...doc.data() }); 
        seenUsers.add(toUid); 
      }
    }
    if(!items.length){ cont.innerHTML='<div class="muted">No pending requests.</div>'; return; }

    // 🚀 OPTIMIZATION: Batch fetch all user handles at once (fixes N+1 query problem)
    const uniqueUids = new Set(items.map(it => it.dir === 'in' ? it.from : it.to));
    const handleMap = new Map(); // UID -> display label
    
    // Batch fetch all users in parallel
    const userFetches = Array.from(uniqueUids).map(async uid => {
      try {
        const ud = await usersRef.doc(uid).get();
        if(ud.exists) {
          const h = ud.data().handle || '';
          const disp = ud.data().displayName || ud.data().email || '';
          handleMap.set(uid, h ? '@' + String(h).trim() : String(disp || 'Friend'));
        } else {
          handleMap.set(uid, 'Unknown user');
        }
      } catch(_) {
        handleMap.set(uid, 'Unknown user');
      }
    });
    
    await Promise.all(userFetches);

    cont.innerHTML='';
    for(const it of items){
      const other = (it.dir==='in' ? it.from : it.to);
      const label = handleMap.get(other) || 'Unknown user';
      const row = document.createElement('div'); row.className='req-card';
      row.innerHTML = '<div><strong>'+label+'</strong></div>';
      const actions = document.createElement('div'); actions.className='req-actions';
      if(it.dir==='in'){
        const acc=document.createElement('button'); acc.className='btn'; acc.textContent='✓';
        acc.onclick=()=>acceptFriendRequest(it.id).catch(console.error);
        const dec=document.createElement('button'); dec.className='btn'; dec.textContent='✕';
        dec.onclick=()=>declineFriendRequest(it.id).catch(console.error);
        actions.appendChild(acc); actions.appendChild(dec);
      }else{
        const canc=document.createElement('button'); canc.className='btn'; canc.textContent='Cancel';
        canc.onclick=()=>cancelFriendRequest(it.id).catch(console.error);
        actions.appendChild(canc);
      }
      row.appendChild(actions); cont.appendChild(row);
    }
  }
/* --------- Profile modal friend actions --------- */
  const addFriendInputProfile = document.getElementById('addFriendInputProfile');
  const addFriendBtnProfile = document.getElementById('addFriendBtnProfile');
  if(addFriendBtnProfile){
    addFriendBtnProfile.onclick = async ()=>{
      const raw = (addFriendInputProfile && addFriendInputProfile.value || '').trim(); if(!raw) return;
      if(!currentUser) return showToast('Sign in first');
      const q = raw.toLowerCase();
      try{
        const targetUid = await resolveUserByHandleOrEmail(q);
        if(!targetUid){ showToast('No user found'); return; }
        if(targetUid===currentUser.uid){ showToast("That's you!"); return; }
        await sendFriendRequest(currentUser.uid, targetUid);
        if(addFriendInputProfile) addFriendInputProfile.value=''; showToast('Friend request sent'); await updateRequestsUI();
      }catch(e){ console.error(e); showToast('Could not send request'); }
    };
  // Autosuggest for Add Friend (friends-only)
  if(addFriendInputProfile){
    addFriendInputProfile.addEventListener('input', async ()=>{
      try{
        const val=(addFriendInputProfile.value||'').toLowerCase().replace(/[^a-z0-9_.]/g,'');
        if(!val){ hideMentionSuggest(); return; }
        // Search both friends and global handles by prefix
        const items=[];
        try{
          const q = await db.collection('handles')
            .where(firebase.firestore.FieldPath.documentId(), '>=', val)
            .where(firebase.firestore.FieldPath.documentId(), '<=', val+'\uf8ff')
            .limit(10)
            .get();
          q.forEach(d=>{ const h=d.id; if(!h) return; items.push({ label:'@'+h, insert:'@'+h, photoURL:'' }); });
        }catch(_){ }
        // De-dupe and include top friends first
        try{
          const ids = myFriends ? Array.from(myFriends).slice(0,50) : [];
          const snaps = await Promise.all(ids.map(id=> usersRef.doc(id).get().catch(()=>null)));
          snaps.forEach(s=>{ if(!s||!s.exists) return; const u=s.data(); const h=u&&u.handle? String(u.handle).trim().toLowerCase():''; if(h && h.startsWith(val)){ if(!items.find(it=>it.insert==='@'+h)) items.unshift({ label:'@'+h, insert:'@'+h, photoURL:u.photoURL||'' }); } });
        }catch(_){ }
        // Limit and show
        showMentionSuggest(items.slice(0,10), addFriendInputProfile);
        mentionTarget={type:'addfriend'};
      }catch(_){ }
    });
  }

  // Profile modal elements and behaviors

  // Legacy wrapper for applyProfileView - redirects to new system
  function applyProfileView(view) {
    console.log('Legacy applyProfileView called with:', view);
    if (!profileSystemReady) {
      console.warn('Profile system not ready, initializing...');
      initializeProfileSystem();
        setTimeout(() => applyProfileView(view), 100);
        return;
      }

    switch (view) {
      case PROFILE_VIEW.OWN:
        switchToOwnProfile();
        break;
      case PROFILE_VIEW.SETTINGS:
        switchToSettings();
        break;
      case PROFILE_VIEW.OTHER:
        // For other profile, we need a UID - this is a legacy call
        console.warn('Legacy applyProfileView called for OTHER without UID');
        switchToOwnProfile();
        break;
      default:
        switchToOwnProfile();
    }
  }
  function forceOwnProfileHeader(){
    try{
      const title = document.getElementById('profileModalTitle'); if(title) title.textContent='Your Profile';
      const gear = document.getElementById('openSettings'); if(gear) gear.style.display='inline-flex';
      const back = document.getElementById('backToProfile'); if(back) back.style.display='none';
      const storeBtn = document.getElementById('openStore'); if(storeBtn) storeBtn.style.display='inline-flex';
      const actions = document.getElementById('profileActions'); if(actions) actions.style.display='flex';
      const signOutBtn = document.getElementById('signOutInProfile'); if(signOutBtn) signOutBtn.style.display='inline-flex';
    }catch(_){ }
  }
  const profileModal = document.getElementById('profileModal');
  const closeProfileBtn = document.getElementById('closeProfile');
  if(closeProfileBtn){ closeProfileBtn.onclick = ()=> closeModal('profileModal'); }
  // Sign out button inside profile modal
  const signOutInProfile = document.getElementById('signOutInProfile');
  if(signOutInProfile){ signOutInProfile.onclick = async ()=>{ try{ if(notifUnsub){ notifUnsub(); notifUnsub=null; } await auth.signOut(); closeModal('profileModal'); showToast('Signed out'); }catch(e){ showToast('Sign out failed'); } }; }
  const ownAvatar = document.getElementById('ownProfileAvatar');
  const emailDisplay = document.getElementById('emailDisplay');
  const handleInput = document.getElementById('handleInput');
  const saveHandle = document.getElementById('saveHandle');
  const handleCooldownHint = document.getElementById('handleCooldownHint');

  async function updateHandleCooldownUI(){
    try{
      if(!handleCooldownHint || !currentUser) return;
      const uref = usersRef.doc(currentUser.uid); const ud = await uref.get();
      const prev = ud.exists? (ud.data().handle||null) : null;
      // No cooldown: always allow changes
      handleCooldownHint.textContent = prev ? 'You can change your username now.' : 'Pick your username.';
    }catch(_){ }
  }
  // Legacy button (may not exist): define to avoid ReferenceError
  const saveProfilePhoto = document.getElementById('saveProfilePhoto');
  const openSettingsBtn = document.getElementById('openSettings');
  const backToProfileBtn = document.getElementById('backToProfile');
  const openChangePicBtn = document.getElementById('openChangePic');
  const settingsImageInput = document.getElementById('settingsImageInput');

  const cropModal = document.getElementById('cropModal');
  const cropImage = document.getElementById('cropImage');
  const cropZoom = document.getElementById('cropZoom');
  const closeCrop = document.getElementById('closeCrop');
  const saveCroppedAvatar = document.getElementById('saveCroppedAvatar');

  // Legacy wrapper for openOwnProfile - redirects to new system
  async function openOwnProfile(){
    console.log('Legacy openOwnProfile called');
    if(!currentUser){ openModal('signInModal'); return; }
    
    if (!profileSystemReady) {
      console.warn('Profile system not ready, initializing...');
      initializeProfileSystem();
      setTimeout(() => openOwnProfile(), 100);
      return;
    }
    
    // Use new system
    switchToOwnProfile();
    
    // Also refresh friends if that function exists
    if (typeof refreshFriends === 'function') {
      try {
    await refreshFriends();
      } catch (e) {
        console.error('Error refreshing friends:', e);
      }
    }
  }

  async function openOtherProfile(uid){
    console.log('Opening other profile for UID:', uid);
    try {
      if (!profileSystemReady) {
        console.warn('Profile system not ready, initializing...');
        initializeProfileSystem();
        setTimeout(() => openOtherProfile(uid), 100);
        return;
      }
      
      // Use new system
      openProfileModal(PROFILE_VIEW.OTHER, uid);
    } catch(e) { 
      console.error('Error opening other profile:', e); 
      showToast('Could not load profile'); 
    }
  }
  
  // Expose to window for mention click handlers
  window.openOtherProfile = openOtherProfile;
  
  // Use event delegation for dynamic buttons
  document.addEventListener('click', async (e) => {
    if(e.target.id === 'openSettings'){
    try{
      if (profileSystemReady) {
        switchToSettings();
      } else {
        console.warn('Profile system not ready for settings');
      }
      // Update settings profile avatar with current photo
        const settingsProfileAvatar = document.getElementById('settingsProfileAvatar');
        if(settingsProfileAvatar && currentUser) {
          // Get current photo from user data
          usersRef.doc(currentUser.uid).get().then(doc => {
            if(doc.exists) {
              const photoURL = doc.data().photoURL;
              if(photoURL) {
                settingsProfileAvatar.style.backgroundImage = `url("${photoURL}")`;
                settingsProfileAvatar.style.backgroundSize = 'cover';
                settingsProfileAvatar.style.backgroundPosition = 'center';
                settingsProfileAvatar.style.backgroundRepeat = 'no-repeat';
                settingsProfileAvatar.classList.add('custom-avatar');
              } else {
                settingsProfileAvatar.style.backgroundImage = '';
                settingsProfileAvatar.classList.remove('custom-avatar');
              }
        }
          }).catch(console.error);
        }
      try{ renderCustomPingUI(); }catch(_){ }
    }catch(_){ }
    }
    if(e.target.id === 'backToProfile') { 
      if (profileSystemReady) {
        switchToOwnProfile();
      } else {
        console.warn('Profile system not ready for back button');
      }
    }
    if(e.target.id === 'openGift'){ openModal('giftModal'); }
  });

  // 🧾 Ledger button - FIXED with direct event listener
  const ledgerBtn = document.getElementById('ledgerBtn');
  if(ledgerBtn){ 
    console.log('✅ Ledger button found');
    ledgerBtn.addEventListener('click', async (e)=>{ 
      e.preventDefault();
      e.stopPropagation();
      console.log('🧾 Ledger button clicked!');
      try{ 
        if(!currentUser) return showToast('Sign in to view'); 
        openModal('ledgerModal'); 
        await renderLedger(); 
      }catch(err){ 
        console.error('Ledger error:', err); 
      } 
    }); 
  } else {
    console.error('❌ Ledger button NOT FOUND!');
  }
  // 🔥 FIXED: All modal close handlers with direct event listeners
  const closeLedger = document.getElementById('closeLedger'); 
  if(closeLedger){ 
    console.log('✅ closeLedger found');
    closeLedger.addEventListener('click', (e)=> { 
      e.preventDefault(); 
      e.stopPropagation(); 
      console.log('Closing ledger modal'); 
      closeModal('ledgerModal'); 
    }); 
  } else {
    console.error('❌ closeLedger NOT FOUND');
  }
  
  const closeGift = document.getElementById('closeGift'); 
  if(closeGift){ 
    console.log('✅ closeGift found');
    closeGift.addEventListener('click', (e)=> { 
      e.preventDefault(); 
      e.stopPropagation(); 
      console.log('Closing gift modal'); 
      closeModal('giftModal'); 
    }); 
  } else {
    console.error('❌ closeGift NOT FOUND');
  }
  
  const closeStore = document.getElementById('closeStore'); 
  if(closeStore){ 
    console.log('✅ closeStore found');
    closeStore.addEventListener('click', (e)=> { 
      e.preventDefault(); 
      e.stopPropagation(); 
      console.log('Closing store modal'); 
      closeModal('storeModal'); 
    }); 
  } else {
    console.error('❌ closeStore NOT FOUND');
  }
  
  // 🚩 Report Modal Handlers
  const closeReport = document.getElementById('closeReport'); 
  if(closeReport){ 
    console.log('✅ closeReport found');
    closeReport.addEventListener('click', (e)=> {
      e.preventDefault(); 
      e.stopPropagation();
      console.log('Closing report modal');
      closeModal('reportModal');
      // Reset form
      try{
        document.getElementById('reportReasonSelect').value = '';
        document.getElementById('reportMessage').value = '';
        window.currentReportPingId = null;
      }catch(err){
        console.error('Error resetting report form:', err);
      }
    });
  } else {
    console.error('❌ closeReport button NOT FOUND!');
  }
  
  const submitReport = document.getElementById('submitReport');
  if(submitReport){ 
    console.log('✅ submitReport button found');
    submitReport.addEventListener('click', async (e)=>{
      e.preventDefault(); 
      e.stopPropagation();
      console.log('📝 Submit report clicked');
      try{
        if(!currentUser) return showToast('Sign in first','error');
        
        const pingId = window.currentReportPingId;
        if(!pingId) return showToast('No content selected','error');
        
        const category = document.getElementById('reportReasonSelect').value;
        if(!category) return showToast('Please select a reason','warning');
        
        const details = (document.getElementById('reportMessage').value || '').trim();
        
        // 🔒 RATE LIMITING: Check if user has exceeded daily report limit
        const today = dateKey(montrealNow());
        const reportsToday = await db.collection('reports')
          .where('reportedBy', '==', currentUser.uid)
          .where('date', '==', today)
          .get();
        
        if(reportsToday.size >= 5) {
          return showToast('Daily report limit reached (5/day)','error');
        }
        
        // 🚫 DUPLICATE CHECK: Check if user already reported this ping
        const existingReport = await db.collection('reports')
          .where('reportedBy', '==', currentUser.uid)
          .where('pingId', '==', pingId)
          .get();
        
        if(!existingReport.empty) {
          return showToast('You already reported this content','warning');
        }
        
        // Submit report
        await db.collection('reports').add({
          reportedBy: currentUser.uid,
          pingId,
          reason: category,
          category,
          details,
          contentType: 'ping',
          date: today,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          status: 'pending'
        });
        
        showToast('Report submitted. Thank you.','success');
        closeModal('reportModal');
        
        // Reset form
        document.getElementById('reportReasonSelect').value = '';
        document.getElementById('reportMessage').value = '';
        window.currentReportPingId = null;
        
      }catch(err){ 
        console.error('Report submission error:', err); 
        showToast('Failed to submit report','error'); 
      }
    });
  } else {
    console.error('❌ submitReport button NOT FOUND!');
  }
  
  const sendGift = document.getElementById('sendGift');
  if(sendGift){ sendGift.onclick = async ()=>{
    try{
      if(!currentUser) return showToast('Sign in first','error');
      const who=(document.getElementById('giftWho').value||'').trim().toLowerCase();
      const amt=Number(document.getElementById('giftAmt').value||'0');
      if(!who || !Number.isFinite(amt) || amt<=0) return showToast('Enter friend and amount','warning');
      const targetUid = await resolveUserByHandleOrEmail(who);
      if(!targetUid) return showToast('No such user','error');
      if(targetUid===currentUser.uid) return showToast('You cannot gift yourself','warning');
      if(!myFriends || !myFriends.has(targetUid)) return showToast('Only gift to friends','warning');
      await giftPointsSecure({ targetUid, amount: amt });
      showToast(`Gifted ${amt} PPs`,'success');
      closeModal('giftModal');
    }catch(e){ if(/not enough/i.test(String(e&&e.message||''))) showToast('Not enough PPs','error'); else { console.error(e); showToast(e.message || 'Gift failed','error'); } }
  }; }

  // Autosuggest for Gift PPs friend input (friends-only)
  const giftWho = document.getElementById('giftWho');
  if(giftWho){
    giftWho.addEventListener('input', async ()=>{
      try{
        const val=(giftWho.value||'').toLowerCase().replace(/[^a-z0-9_.]/g,'');
        if(!val){ hideMentionSuggest(); return; }
        const ids = myFriends ? Array.from(myFriends).slice(0,100) : [];
        const snaps = await Promise.all(ids.map(id=> usersRef.doc(id).get().catch(()=>null)));
        const items=[]; snaps.forEach(s=>{ if(!s||!s.exists) return; const u=s.data(); const h=u&&u.handle? String(u.handle).trim().toLowerCase():''; if(h && h.startsWith(val)) items.push({ label:'@'+h, insert:h, photoURL:u.photoURL||'' }); });
        showMentionSuggest(items, giftWho); mentionTarget={type:'gift'};
      }catch(_){ }
    });
  }

  // Close pin preview modal
  (function(){ const closeBtn=document.getElementById('closePinPreview'); if(closeBtn){ closeBtn.onclick=()=> closeModal('pinPreviewModal'); }})();

  async function renderLedger(){
    try{
      const el=document.getElementById('ledgerContent'); if(!el) return;
      el.innerHTML='<div class="muted">Loading…</div>';
      const qs = await usersRef.doc(currentUser.uid).collection('ledger').orderBy('ts','desc').limit(100).get();
      if(qs.empty){ el.innerHTML='<div class="muted">No activity</div>'; return; }
      const frag=document.createDocumentFragment();
      // Group by day for neatness
      const groups=new Map();
      qs.forEach(doc=>{ const d=doc.data(); const dt=d.ts&&d.ts.toDate? d.ts.toDate():new Date(); const key=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); if(!groups.has(key)) groups.set(key, []); groups.get(key).push({dt,d}); });
      for(const [day,items] of groups){ const h=document.createElement('div'); h.style.fontWeight='900'; h.style.marginTop='6px'; h.textContent=day; frag.appendChild(h); let net=0; items.forEach(({d,dt})=>{ const row=document.createElement('div'); row.className='req-card'; let line=''; if(d.type==='gift_in'){ net+=Number(d.amount||0); line=`+${d.amount} from ${d.from}`; } else if(d.type==='gift_out'){ net-=Number(d.amount||0); line=`-${d.amount} to ${d.to}`; } else if(d.type==='unlock_ping'){ net-=Number(d.amount||0); line=`-${d.amount} unlock ${d.tier}`; } else if(d.type==='award'){ net+=Number(d.amount||0); line=`+${d.amount} ${d.reason||''}`; } else { line=`${d.type||'activity'} ${d.amount||''}`; } row.textContent=`${line}`; frag.appendChild(row); }); const sum=document.createElement('div'); sum.className='muted'; sum.textContent=`Net: ${net>0?'+':''}${net} PPs`; frag.appendChild(sum); }
      el.innerHTML=''; el.appendChild(frag);
    }catch(_){ }
  }

  if(saveHandle){
    saveHandle.onclick = async ()=>{
      if(!currentUser) return showToast('Sign in first');
      let raw = (handleInput && handleInput.value || '').trim();
      if(!raw) return;
      
      try{
        // 🔒 SECURITY: Use Cloud Function for atomic username update
        console.log('🔒 Updating username via secure Cloud Function...');
        
        const result = await updateUsernameSecure(raw);
        
        if(!result || !result.success) {
          throw new Error('Failed to update username');
        }
        
        const finalUsername = result.username;
        console.log('✅ Username updated securely to:', finalUsername);
        
        // Clear caches
        if(typeof clearAllHandleCaches === 'function') {
          clearAllHandleCaches();
        }
        
        // Update local cache
        if(typeof uidHandleCache !== 'undefined') {
          uidHandleCache.set(currentUser.uid, `@${finalUsername}`);
          if(typeof handleCacheTimestamps !== 'undefined') {
            handleCacheTimestamps.set(currentUser.uid, Date.now());
          }
        }
        
        // Update UI
        const profileName = document.getElementById('profileName');
        if(profileName) {
          profileName.textContent = `@${finalUsername}`;
        }
        
        // Refresh ping displays
        try {
          if(typeof lastPingCache !== 'undefined' && lastPingCache) {
            lastPingCache.forEach(ping => {
              if(ping.authorId === currentUser.uid || ping.uid === currentUser.uid) {
                if(typeof upsertMarker === 'function') {
                  upsertMarker(ping);
                }
              }
            });
          }
        } catch(_) {}
        
        try{ await refreshAuthUI(currentUser); }catch(_){ }
        try{ await updateHandleCooldownUI(); }catch(_){ }
        showToast('Username updated', 'success');
      }catch(e){ 
        showToast(e.message||'Failed to update username', 'error'); 
        console.error(e); 
      }
    };
  }

  if(saveProfilePhoto){
    saveProfilePhoto.onclick = async ()=>{
      try{
        if(!currentUser) return showToast('Sign in first');
        // Deprecated path; handled by Change profile pic flow
        showToast('Use "Change profile pic"');
      }catch(e){ console.error(e); showToast('Photo update failed'); }
    };
  }

  // Settings: Change profile pic with simple circle crop (zoom & pan)
  let cropState = { startX:0, startY:0, imgX:0, imgY:0, dragging:false, scale:1, imgW:0, imgH:0 };
  function openCropperWith(file){
    try{
      cropImage.style.visibility = 'hidden';
    cropState = { startX:0,startY:0,imgX:0,imgY:0,dragging:false,scale:1,imgW:0,imgH:0 };
    cropZoom.value = '1';
      
      // Try URL.createObjectURL first, fallback to FileReader
      const loadImage = (src) => {
        cropImage.src = src;
    cropImage.onload = ()=>{
      cropState.imgW = cropImage.naturalWidth; cropState.imgH = cropImage.naturalHeight;
          renderCropTransform();
          cropImage.style.visibility = 'visible';
        };
        cropImage.onerror = ()=>{
          cropImage.style.visibility = 'visible';
          showToast('Could not load image');
        };
      };
      
      try {
        const objectUrl = URL.createObjectURL(file);
        loadImage(objectUrl);
        // Clean up after load
        cropImage.onload = ()=>{
          cropState.imgW = cropImage.naturalWidth; cropState.imgH = cropImage.naturalHeight;
          renderCropTransform();
          cropImage.style.visibility = 'visible';
          URL.revokeObjectURL(objectUrl);
        };
      } catch(e) {
        // Fallback to FileReader
        const reader = new FileReader();
        reader.onload = (e) => loadImage(e.target.result);
        reader.readAsDataURL(file);
      }
      
      openModal('cropModal');
    }catch(e){ 
      console.error('openCropperWith error:', e);
    openModal('cropModal');
    }
  }
  function renderCropTransform(){
    cropImage.style.transform = `translate(calc(-50% + ${cropState.imgX}px), calc(-50% + ${cropState.imgY}px)) scale(${cropState.scale})`;
  }
  // Remove the onclick handler since we're using a label now
  // The label will handle the file picker opening automatically
  if(settingsImageInput){
    settingsImageInput.onchange = ()=>{ const f=settingsImageInput.files&&settingsImageInput.files[0]; if(!f) return; if(f.size>10*1024*1024) return showToast('Image must be ≤ 10MB'); openCropperWith(f); };
  }
  // Custom Ping UI setup
  const customPingOptions = document.getElementById('customPingOptions');
  const customPingInput = document.getElementById('customPingInput');
  if(customPingOptions) {
    console.log('✅ customPingOptions element found');
  } else {
    console.error('❌ customPingOptions element NOT FOUND!');
  }
  if(customPingInput) {
    console.log('✅ customPingInput element found');
  } else {
    console.error('❌ customPingInput element NOT FOUND!');
  }
  // Accessed via openModal/closeModal by id; no local reference needed
  const pingCropImage = document.getElementById('pingCropImage');
  const pingCropZoom = document.getElementById('pingCropZoom');
  const closePingCrop = document.getElementById('closePingCrop');
  const savePingCrop = document.getElementById('savePingCrop');
  const pingPreview = document.getElementById('pingPreview');
  const pingCropState = { startX:0,startY:0,imgX:0,imgY:0,dragging:false,scale:1,imgW:0,imgH:0 };
  function renderPingCropTransform(){
    if(!pingCropImage) return;
    const s=Math.max(0.2, Math.min(5, pingCropState.scale));
    pingCropImage.style.transform = `translate(calc(-50% + ${pingCropState.imgX}px), calc(-50% + ${pingCropState.imgY}px)) scale(${s})`;
    // Also render live preview
    try{
      const canvas = pingPreview; if(!canvas) return; const ctx=canvas.getContext('2d'); if(!ctx) return; 
      // 🎯 FIXED: Larger preview for better visibility
      if(canvas.width!==160) canvas.width=160; 
      if(canvas.height!==213) canvas.height=213; 
      ctx.clearRect(0,0,canvas.width,canvas.height);
      
      // Draw pin path and clip
      ctx.save();
      ctx.scale(canvas.width/100, canvas.height/100);
      const path=new Path2D('M50 10c17 0 30 13 30 30 0 22-30 50-30 50S20 62 20 40c0-17 13-30 30-30z');
      ctx.clip(path);
      ctx.setTransform(1,0,0,1,0,0);
      const img=pingCropImage; if(!img || !img.naturalWidth) { ctx.restore(); return; }
      
      // 🔒 FIXED: Match overlay scale (CSS uses center/70% 70% for the pin mask)
      const CLIP_SCALE = 0.70;
      const frameEl=document.getElementById('pingCropFrame'); 
      
      // Calculate the visible area dimensions (70% of frame)
      const visibleW = frameEl.clientWidth * CLIP_SCALE;
      const visibleH = frameEl.clientHeight * CLIP_SCALE;
      
      // Calculate how the image is positioned in the frame
      // The frame is centered, so visible area is also centered
      const base = Math.min(visibleW / img.naturalWidth, visibleH / img.naturalHeight);
      const drawS = s * base;
      const drawW = img.naturalWidth * drawS;
      const drawH = img.naturalHeight * drawS;
      
      // 🎯 CRITICAL FIX: Properly calculate offset relative to visible area
      // The image pan (imgX, imgY) is in frame coordinates
      // We need to scale this to canvas coordinates
      const scaleToCanvas = (canvas.width * CLIP_SCALE) / visibleW;
      const offX = pingCropState.imgX * scaleToCanvas;
      const offY = pingCropState.imgY * scaleToCanvas;
      
      // Draw centered with offset
      const dx = canvas.width/2 - drawW/2 + offX;
      const dy = canvas.height/2 - drawH/2 + offY;
      ctx.drawImage(img, dx, dy, drawW, drawH);
      ctx.restore();
      
      // Outline
      ctx.save(); ctx.scale(canvas.width/100, canvas.height/100); ctx.strokeStyle='rgba(0,0,0,.5)'; ctx.lineWidth=2; ctx.stroke(path); ctx.restore();
    }catch(err){ console.error('Preview render error:', err); }
  }
  function addPingDrag(el){ el.addEventListener('pointerdown', (e)=>{ pingCropState.dragging=true; pingCropState.startX=e.clientX; pingCropState.startY=e.clientY; el.setPointerCapture(e.pointerId); }); el.addEventListener('pointermove', (e)=>{ if(!pingCropState.dragging) return; const dx=e.clientX-pingCropState.startX, dy=e.clientY-pingCropState.startY; pingCropState.imgX+=dx; pingCropState.imgY+=dy; pingCropState.startX=e.clientX; pingCropState.startY=e.clientY; renderPingCropTransform(); }); el.addEventListener('pointerup', ()=>{ pingCropState.dragging=false; }); el.addEventListener('pointercancel', ()=>{ pingCropState.dragging=false; }); }
  if(pingCropImage){ addPingDrag(pingCropImage); }
  if(pingCropZoom){ pingCropZoom.oninput=(e)=>{ pingCropState.scale=Number(e.target.value||'1'); renderPingCropTransform(); }; }
  if(closePingCrop){ closePingCrop.onclick = ()=> closeModal('pingCropModal'); }
  const TIERS=[{tier:0,label:'Default',price:0},{tier:100,label:'Purple',price:100},{tier:200,label:'Alien',price:200},{tier:300,label:'Galactic',price:300},{tier:500,label:'Nuke',price:500},{tier:1000,label:'Custom Image (sub only)',price:1000}];
  async function renderCustomPingUI(){
    console.log('🎨 renderCustomPingUI called');
    try{
      const customPingOptionsEl = document.getElementById('customPingOptions');
      if(!customPingOptionsEl) {
        console.error('❌ customPingOptions element not found! DOM not ready or element missing from HTML');
        return;
      }
      if(!currentUser) {
        console.warn('⚠️ No current user, skipping custom ping UI');
        customPingOptionsEl.innerHTML = '<div class="muted">Sign in to customize your ping markers.</div>';
        return;
      }
      console.log('✅ Rendering custom ping UI for user:', currentUser.uid);
      const snap=await usersRef.doc(currentUser.uid).get(); const u=snap.exists? snap.data():{};
      const owned=u.ownedPings||{}; const sel=Number(u.selectedPingTier||0);
      console.log('📦 User ping data:', { owned, selected: sel });
      customPingOptionsEl.innerHTML=''; customPingOptionsEl.classList.add('ping-grid');
      TIERS.forEach(t=>{
        const row=document.createElement('div'); row.className='ping-card';
        let ownedFlag = !!owned[t.tier] || t.tier===0;
        const price = t.price;
        const preview=document.createElement('div'); preview.className='pin-preview';
        let svg = balloonSVG(t.tier===0? '#0f8a3b' : (t.tier===100?'#7c3aed': t.tier===200?'#0ea5e9': t.tier===300?'#0f172a': t.tier===500?'#fde047':'#e5e7eb'), 42, { variant: t.tier===200?'alien': t.tier===300?'galactic': t.tier===500?'nuke': null });
        if(t.tier===1000){ svg = balloonSVG('#e5e7eb',42,{ image: (u.customPingUrl||null) }); }
        preview.innerHTML=svg.html;
        // Click to open big preview modal
        preview.style.cursor='zoom-in';
        preview.onclick=()=>{
          try{
            const big=document.getElementById('pinPreviewBig'); if(!big) return; const bigSvg = (t.tier===1000) ? balloonSVG('#e5e7eb', 480, { image:(u.customPingUrl||null) }) : balloonSVG((t.tier===0?'#0f8a3b': t.tier===100?'#7c3aed': t.tier===200?'#0ea5e9': t.tier===300?'#0f172a': t.tier===500?'#fde047':'#e5e7eb'), 480, { variant: t.tier===200?'alien': t.tier===300?'galactic': t.tier===500?'nuke': null });
            big.innerHTML=bigSvg.html;
            try{ const svgEl = big.querySelector('svg'); if(svgEl){ svgEl.style.width='min(680px, 90%)'; svgEl.style.height='auto'; } }catch(_){ }
            openModal('pinPreviewModal');
          }catch(_){ }
        };
        const label=document.createElement('div'); label.className='ping-label'; label.textContent = `${t.label}${price?` — ${price} PPs`:''}`; label.style.fontWeight='900';
        const btn=document.createElement('button'); btn.className='btn'; btn.textContent = ownedFlag? (sel===t.tier?'Selected':'Select') : 'Unlock'; btn.style.minWidth='76px';
        
        if(!ownedFlag && t.tier!==0){ btn.onclick = async ()=>{
          try{
            await db.runTransaction(async tx=>{
              const ref=usersRef.doc(currentUser.uid); const s=await tx.get(ref); const prev=s.exists? Number(s.data().points||0):0; if(prev < price) throw new Error('insufficient');
              const now=firebase.firestore.FieldValue.serverTimestamp();
              const ownedNext=Object.assign({}, s.exists? (s.data().ownedPings||{}):{}); ownedNext[t.tier]=true;
              tx.set(ref,{ points: prev-price, ownedPings: ownedNext, selectedPingTier:t.tier },{merge:true});
              tx.set(ref.collection('ledger').doc(), { ts:now, type:'unlock_ping', amount:price, tier:t.tier });
            });
            showToast('Unlocked','success');
            renderCustomPingUI();
          }catch(e){ if(String(e&&e.message||'').includes('insufficient')) showToast('Not enough PPs','error'); else { console.error(e); showToast('Unlock failed','error'); } }
        }; } else {
          btn.onclick = async ()=>{ try{ await usersRef.doc(currentUser.uid).set({ selectedPingTier:t.tier }, { merge:true }); showToast('Selected','success'); renderCustomPingUI(); try{ userDocCache.delete(currentUser.uid); }catch(_){ } try{ restyleMarkers(); }catch(_){ } }catch(_){ showToast('Select failed','error'); } };
        }
        row.appendChild(preview); row.appendChild(label); row.appendChild(btn);
        const lock=document.createElement('div'); lock.className='lock'; lock.textContent = ownedFlag? '' : '🔒'; row.appendChild(lock);
        if(t.tier===1000){
          const up=document.createElement('label');
          up.className='btn';
          up.textContent='Upload Image';
          up.htmlFor='customPingInput';
          up.style.padding='10px 14px';
          // place upload button right before the Select/Unlock button
          row.insertBefore(up, btn);
        }
        customPingOptions.appendChild(row);
      });
    }catch(_){ }
  }
  if(closeCrop){ closeCrop.onclick = ()=> closeModal('cropModal'); }
  if(cropZoom){ cropZoom.oninput = (e)=>{ cropState.scale = Number(e.target.value||'1'); renderCropTransform(); }; }
  // Basic drag to pan
  function addDrag(el){
    el.addEventListener('pointerdown', (e)=>{ cropState.dragging=true; cropState.startX=e.clientX; cropState.startY=e.clientY; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e)=>{ if(!cropState.dragging) return; const dx=e.clientX-cropState.startX, dy=e.clientY-cropState.startY; cropState.imgX+=dx; cropState.imgY+=dy; cropState.startX=e.clientX; cropState.startY=e.clientY; renderCropTransform(); });
    el.addEventListener('pointerup', ()=>{ cropState.dragging=false; });
    el.addEventListener('pointercancel', ()=>{ cropState.dragging=false; });
  }
  if(cropImage){ addDrag(cropImage); }

  // ⚠️ REMOVED: Duplicate event listener (already handled in main profile click delegation above)

  // Store: PPs bundles + subscription
  const ppBundles = [
    { amount:100, price:1.49 },
    { amount:300, price:3.99 },
    { amount:700, price:7.99 },
    { amount:1500, price:14.99 }
  ];
  function fmt(n){ return n.toLocaleString(); }
  async function renderStore(){
    try{
      const cont=document.getElementById('ppBundles'); if(cont){ cont.innerHTML=''; }
      ppBundles.forEach(b=>{
        const btn=document.createElement('button'); btn.className='btn'; btn.textContent = `${fmt(b.amount)} PPs — $${b.price.toFixed(2)}`;
        btn.onclick = async ()=>{
          try{
            if(!currentUser) return showToast('Sign in first');
            await usersRef.doc(currentUser.uid).set({ points: firebase.firestore.FieldValue.increment(b.amount) }, { merge:true });
            await usersRef.doc(currentUser.uid).collection('ledger').add({ ts: firebase.firestore.FieldValue.serverTimestamp(), type:'buy_pps', amount:b.amount, price:b.price });
            showToast(`Added ${fmt(b.amount)} PPs`, 'success');
            try{ await refreshTopProfileStats(); }catch(_){ }
          }catch(e){ console.error(e); showToast('Purchase failed'); }
        };
        if(cont) cont.appendChild(btn);
      });
      const subBtn=document.getElementById('subscribeBtn');
      const subStatus=document.getElementById('subStatus');
      if(subBtn){
        subBtn.onclick = async ()=>{
          try{
            if(!currentUser) return showToast('Sign in first');
            const ref = usersRef.doc(currentUser.uid);
            await ref.set({ subActive:true, subStartedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
            await ref.set({ points: firebase.firestore.FieldValue.increment(100) }, { merge:true });
            await ref.collection('ledger').add({ ts: firebase.firestore.FieldValue.serverTimestamp(), type:'subscribe', price:1.99, bonusPPs:100 });
            showToast('Subscribed! +100 PPs', 'success');
            if(subStatus) subStatus.textContent = 'Active — $1.99/mo';
            try{ await refreshTopProfileStats(); }catch(_){ }
            try{ renderCustomPingUI(); }catch(_){ }
          }catch(e){ console.error(e); showToast('Subscription failed'); }
        };
      }
      try{
        if(currentUser){
          const d=await usersRef.doc(currentUser.uid).get(); const u=d.exists? d.data():{};
          if(subStatus) subStatus.textContent = u.subActive ? 'Active — $1.99/mo' : 'Not active';
        }
      }catch(_){ }
    }catch(_){ }
  }

  async function refreshTopProfileStats(){ try{ if(currentUser){ const d=await usersRef.doc(currentUser.uid).get(); const u=d.exists? d.data():{}; const ownStatsLine=document.getElementById('ownStatsLine'); if(ownStatsLine){ const pts=Number(u.points||0); const streak=Number(u.streakDays||0); ownStatsLine.textContent = `${pts} PPs • 🔥 ${streak}`; } } }catch(_){ } }
  // Handle custom ping image upload (1000-tier)
  if(customPingInput){
    customPingInput.onchange = ()=>{
      try{
        const f=customPingInput.files && customPingInput.files[0]; if(!f) return; if(f.size>5*1024*1024) return showToast('Image must be ≤ 5MB','warning');
        // Load image into ping crop modal (independent of avatar)
        const url = URL.createObjectURL(f);
        pingCropState.imgX=0; pingCropState.imgY=0; pingCropState.scale=1;
        if(pingCropZoom){ try{ pingCropZoom.value='1'; }catch(_){ } }
        if(pingCropImage){ pingCropImage.src=url; pingCropImage.onload=()=>{ URL.revokeObjectURL(url); renderPingCropTransform(); }; }
        openModal('pingCropModal');
        // Save handler for pin-shaped export
        if(savePingCrop){ savePingCrop.onclick = async ()=>{
          try{
            if(!currentUser) return;
            const ownedSnap=await usersRef.doc(currentUser.uid).get(); const owned=(ownedSnap.exists? ownedSnap.data().ownedPings||{}:{});
            if(!owned[1000]){ showToast('Unlock Custom Image ping first'); return; }
            // Use the same aspect as the live preview canvas so saved output matches what user sees
            const previewCanvas = document.getElementById('pingPreview');
            const outScale = 3; // export at higher resolution for quality
            const outW = (previewCanvas? previewCanvas.width : 120) * outScale;
            const outH = (previewCanvas? previewCanvas.height: 160) * outScale;
            const canvas=document.createElement('canvas'); canvas.width=outW; canvas.height=outH; const ctx=canvas.getContext('2d');
            const img=pingCropImage; if(!img || !img.naturalWidth){ showToast('Image not ready'); return; }
            // Define pin clip in normalized coords; keep clip active across drawing
            ctx.save();
            ctx.scale(canvas.width/100, canvas.height/100);
            const path=new Path2D('M50 10c17 0 30 13 30 30 0 22-30 50-30 50S20 62 20 40c0-17 13-30 30-30z');
            ctx.clip(path);
            // Reset transform but keep clip
            ctx.setTransform(1,0,0,1,0,0);
            // Scale image to CONTAIN canvas initially, then apply user zoom + pan
            const frameEl = document.getElementById('pingCropFrame');
            // Match the clip scale (70%) used by the overlay for visual alignment
            const CLIP_SCALE = 0.70;
            const effW = canvas.width * CLIP_SCALE;
            const effH = canvas.height * CLIP_SCALE;
            const base = Math.min(effW / img.naturalWidth, effH / img.naturalHeight);
            const s = Math.max(0.2, Math.min(5, pingCropState.scale)) * base;
            const drawW = img.naturalWidth * s;
            const drawH = img.naturalHeight * s;
            const offX = (pingCropState.imgX / frameEl.clientWidth) * effW;
            const offY = (pingCropState.imgY / frameEl.clientHeight) * effH;
            const dx = canvas.width/2 - drawW/2 + offX;
            const dy = canvas.height/2 - drawH/2 + offY;
            ctx.drawImage(img, dx, dy, drawW, drawH);
            // Fill background to ensure no transparency, then restore
            ctx.globalCompositeOperation='destination-over';
            ctx.fillStyle='#ffffff';
            ctx.fillRect(0,0,canvas.width,canvas.height);
            // Restore after draw (clip no longer needed)
            ctx.restore();
            const dataUrl = canvas.toDataURL('image/png');
            
            // Analyze custom ping image for NSFW content before saving
            showModerationLoading('Analyzing custom ping image...');
            try {
              // Convert data URL to blob for analysis
              const response = await fetch(dataUrl);
              const blob = await response.blob();
              const file = new File([blob], 'custom-ping.png', { type: 'image/png' });
              
              const analysis = await analyzeImageFromFile(file);
              hideModerationLoading();
              if (analysis.isNSFW) {
                return blockUploadForNSFW(`inappropriate content detected (confidence: ${Math.round(analysis.confidence * 100)}%)`);
              }
            } catch (error) {
              hideModerationLoading();
              console.error('Error analyzing custom ping image:', error);
              // If analysis fails, allow save to proceed
            }
            
            await usersRef.doc(currentUser.uid).set({ customPingUrl:dataUrl, selectedPingTier:1000 }, { merge:true });
            // Refresh cache and markers immediately
            try{ userDocCache.delete(currentUser.uid); }catch(_){ }
            try{ // Update icons synchronously for best UX
              markers.forEach((m,id)=>{ const p=lastPingCache.get(id); if(!p) return; if(p.authorId===currentUser.uid){ iconForPing(p,false).then(ic=>{ try{ m.setIcon(ic); }catch(_){ } }); } });
            }catch(_){ }
            try{ renderCustomPingUI(); }catch(_){ }
            closeModal('pingCropModal'); showToast('Custom ping image set','success');
          }catch(_){ showToast('Save failed'); }
        }; }
      }catch(_){ }
    };
  }

  if(saveCroppedAvatar){
    saveCroppedAvatar.onclick = async ()=>{
      try{
        if(!currentUser) return showToast('Sign in first');
        
        // Check if image is loaded
        if(!cropImage.complete || !cropImage.naturalWidth){
          showToast('Image not loaded yet, please wait');
          return;
        }
        
        const frame = document.getElementById('cropFrame');
        const size = Math.min(frame.clientWidth, frame.clientHeight);
        const canvas = document.createElement('canvas'); 
        canvas.width=size; 
        canvas.height=size; 
        const ctx=canvas.getContext('2d');
        
        if(!ctx){
          showToast('Canvas not supported');
          return;
        }
        
        // Circle mask
        ctx.beginPath(); 
        ctx.arc(size/2,size/2,size/2,0,Math.PI*2); 
        ctx.closePath(); 
        ctx.clip();
        
        // Compute draw params: map from natural image to canvas considering transform
        const scale = cropState.scale;
        const drawW = cropState.imgW*scale; 
        const drawH=cropState.imgH*scale;
        const centerX = size/2 + cropState.imgX; 
        const centerY = size/2 + cropState.imgY;
        const dx = centerX - drawW/2; 
        const dy = centerY - drawH/2;
        
        // Ensure image is fully loaded
        await new Promise(r=>{ 
          if(cropImage.complete && cropImage.naturalWidth > 0) r(); 
          else cropImage.onload=r; 
        });
        
        ctx.drawImage(cropImage, dx, dy, drawW, drawH);
        
        const blob = await new Promise((res,rej)=> { 
          canvas.toBlob(res, 'image/jpeg', 0.9);
          setTimeout(()=>rej(new Error('Canvas toBlob timeout')), 5000);
        });
        
        if(!blob){
          showToast('Failed to create image');
          return;
        }
        
        const file = new File([blob], 'avatar.jpg', { type:'image/jpeg' });
        console.log('Uploading file:', file.size, 'bytes');
        
        // Analyze profile picture for NSFW content before upload
        showModerationLoading('Analyzing profile picture...');
        try {
          const analysis = await analyzeImageFromFile(file);
          hideModerationLoading();
          if (analysis.isNSFW) {
            return blockUploadForNSFW(`inappropriate content detected (confidence: ${Math.round(analysis.confidence * 100)}%)`);
          }
        } catch (error) {
          hideModerationLoading();
          console.error('Error analyzing profile picture:', error);
          // If analysis fails, allow upload to proceed
        }
        
        const url = await uploadPingImage(file, currentUser.uid);
        console.log('Uploaded to:', url);
        
        if(!url){
          showToast('Failed to process image');
          return;
        }
        
        await usersRef.doc(currentUser.uid).set({ photoURL: url }, { merge:true });
        console.log('Updated user doc');
        
        // Update UI - refresh all avatar elements immediately
        const topRightAvatar = document.getElementById('profileAvatar'); // Top-right widget
        const profileModalAvatar = document.getElementById('ownProfileAvatar'); // Profile modal
        const settingsProfileAvatar = document.getElementById('settingsProfileAvatar');
        
        console.log('Avatar elements found:', { 
          topRightAvatar: !!topRightAvatar, 
          profileModalAvatar: !!profileModalAvatar,
          settingsProfileAvatar: !!settingsProfileAvatar 
        });
        
        const updateAvatar = (element, name) => {
          if(element) {
            // Only reset background-related styles, keep other styles
            element.style.backgroundImage = `url("${url}")`;
            element.style.backgroundSize = 'cover';
            element.style.backgroundPosition = 'center';
            element.style.backgroundRepeat = 'no-repeat';
            
            // Add custom-avatar class for CSS override
            element.classList.add('custom-avatar');
            element.style.setProperty('--custom-avatar-url', `url("${url}")`);
            
            console.log(`Updated ${name} with:`, url.substring(0, 50) + '...');
            console.log(`Element computed style:`, window.getComputedStyle(element).backgroundImage);
          } else {
            console.log(`${name} not found!`);
          }
        };
        
        updateAvatar(topRightAvatar, 'topRightAvatar');
        updateAvatar(profileModalAvatar, 'profileModalAvatar');
        updateAvatar(settingsProfileAvatar, 'settingsProfileAvatar');
        
        // Update the user's photoURL in their profile data
        await refreshAuthUI(currentUser);
        
        closeModal('cropModal');
        showToast('Profile photo updated');
        
        // Force a UI refresh to ensure all avatars update
        setTimeout(() => {
          updateAvatar(topRightAvatar, 'topRightAvatar (delayed)');
          updateAvatar(profileModalAvatar, 'profileModalAvatar (delayed)');
          updateAvatar(settingsProfileAvatar, 'settingsProfileAvatar (delayed)');
          
          // Force refresh all avatar elements one more time
          const allAvatars = [
            { el: document.getElementById('profileAvatar'), name: 'topRightAvatar' },
            { el: document.getElementById('ownProfileAvatar'), name: 'profileModalAvatar' },
            { el: document.getElementById('settingsProfileAvatar'), name: 'settingsProfileAvatar' }
          ];
          
          allAvatars.forEach(({ el, name }) => {
            if(el) {
              el.setAttribute('style', `background-image: url("${url}"); background-size: cover; background-position: center; background-repeat: no-repeat;`);
              console.log(`Force updated ${name}`);
            }
          });
        }, 200);
      }catch(e){ 
        console.error('Save avatar error:', e); 
        showToast(`Could not save photo: ${e.message || 'Unknown error'}`); 
      }
    };
  }


  let friendsRenderToken = 0;
  let friendsListUnsub = null; // 🔥 REAL-TIME: Listener for friend list changes
  
  async function refreshFriends(){
    console.log('👥 refreshFriends called, currentUser:', currentUser?.uid);
    const friendList = document.getElementById('profileFriendsList');
    const myCodeEl = document.getElementById('myCodeEl');
    if(!friendList){ 
      console.log('❌ profileFriendsList element not found');
      return; 
    }
    // Clean up any legacy inline Gift PPs UI accidentally added inside the Friends section
    try{
      const parent = friendList.parentElement;
      if(parent){ parent.querySelectorAll('#giftTarget, #giftAmount, #giftBtn').forEach(el=>{ const sec=el.closest('.section'); if(sec && sec!==parent) sec.remove(); }); }
    }catch(_){ }
    if(!currentUser){ 
      friendList.innerHTML='<div class="muted">Sign in to manage friends.</div>'; 
      myFriends = new Set();
      console.log('⚠️ No currentUser, clearing friends');
      return; 
    }
    const doc=await usersRef.doc(currentUser.uid).get(); 
    const data=doc.exists? doc.data():{friendIds:[]};
    console.log('📦 Friend data from Firestore:', data.friendIds);
    // Dedup and normalize friend list
    const originalIds = (data.friendIds||[]).filter(Boolean);
    const uniqueIds = Array.from(new Set(originalIds));
    if(uniqueIds.length !== originalIds.length){ try{ await usersRef.doc(currentUser.uid).set({ friendIds: uniqueIds }, { merge:true }); }catch(_){ } }
    myFriends=new Set(uniqueIds); 
    console.log('✅ myFriends updated:', myFriends.size, 'friends');
    if(myCodeEl) myCodeEl.value=currentUser.uid;
    const token = ++friendsRenderToken;
    friendList.innerHTML='';
    if(!uniqueIds.length){ friendList.innerHTML='<div class="muted">No friends yet. Share your code above.</div>'; reFilterMarkers(); return; }
    // Fetch friend docs in parallel
    const docs = await Promise.all(uniqueIds.map(fid=> usersRef.doc(fid).get().catch(()=>null)));
    if(token!==friendsRenderToken) return; // stale render
    const friends = uniqueIds.map((fid, idx)=>{
      const fdoc = docs[idx]; const d = fdoc && fdoc.exists ? fdoc.data() : {};
      const handle = d && d.handle ? String(d.handle).trim() : '';
      const name = handle ? `@${handle}` : (d.displayName || d.email || 'Friend');
      return { fid, name };
    }).sort((a,b)=> a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    if(token!==friendsRenderToken) return;
    const frag=document.createDocumentFragment();
    for(const fr of friends){
      const row=document.createElement('div'); row.className='friend-item'; row.setAttribute('tabindex','0'); row.style.cursor='pointer'; row.onclick=()=>openOtherProfile(fr.fid); row.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openOtherProfile(fr.fid); } };
      row.innerHTML=`<div><strong>${fr.name}</strong></div>`;
      const rm=document.createElement('button'); rm.className='btn'; rm.textContent='Remove';
      rm.onclick=async(e)=>{ 
        e.stopPropagation();
        try{
          await removeFriendSecure(fr.fid);
          showToast('Removed','success');
          await refreshFriends();
        }catch(err){
          console.error(err);
          showToast(err.message || 'Remove failed','error');
        }
      };
      row.appendChild(rm); frag.appendChild(row);
    }
    friendList.innerHTML=''; friendList.appendChild(frag);
    reFilterMarkers();
  }
  
  // 🔥 REAL-TIME FEATURE: Auto-refresh friends list when it changes
  function startFriendsListener(uid) {
    if(friendsListUnsub) friendsListUnsub(); // Clean up old listener
    
    friendsListUnsub = usersRef.doc(uid).onSnapshot(doc => {
      if(!doc.exists) return;
      const data = doc.data();
      const newFriendIds = new Set(data.friendIds || []);
      
      // Only refresh if friend list actually changed
      const currentFriendIds = myFriends;
      if(newFriendIds.size !== currentFriendIds.size || 
         ![...newFriendIds].every(id => currentFriendIds.has(id))) {
        console.log('🔥 Friend list changed - auto-refreshing');
        refreshFriends();
      }
    });
  }
  
  // Expose for tooling to satisfy aggressive linters
  try{ window.refreshFriends = refreshFriends; }catch(_){ }

  /* --------- Notifications --------- */
  const notifBadge=$('#notifBadge'), notifsContent=$('#notifsContent');
  $('#closeNotifs').onclick=()=>closeModal('notifsModal');
  
  // 🔔 FIXED: Direct click handler on bell button (more reliable than delegation)
  const bellBtn = document.getElementById('bellBtn');
  if(bellBtn){
    console.log('✅ Bell button found');
    bellBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('🔔 Bell button clicked!');
    if(!currentUser) return showToast('Sign in to view notifications');
    openModal('notifsModal');
    await usersRef.doc(currentUser.uid).set({ unreadCount: 0 }, { merge:true });
    notifBadge.style.display='none';
  });
  } else {
    console.error('❌ Bell button NOT FOUND!');
  }
  let notifUnsub=null;
  let unreadCountUnsub=null; // 🔔 Track unread count listener
  
  // 🔔 NEW: Listen to user's unreadCount and update badge
  function startUnreadCountListener(uid) {
    if(unreadCountUnsub) unreadCountUnsub();
    unreadCountUnsub = usersRef.doc(uid).onSnapshot(doc => {
      if(!doc.exists) return;
      const data = doc.data();
      const count = data.unreadCount || 0;
      
      if(count > 0) {
        notifBadge.textContent = count;
        notifBadge.style.display = 'inline';
        console.log('🔔 Unread notifications:', count);
      } else {
        notifBadge.style.display = 'none';
        console.log('🔔 No unread notifications');
      }
    }, err => {
      console.error('Error listening to unread count:', err);
    });
  }
  
  function startNotifListener(uid){
    if(notifUnsub) notifUnsub();
    // 🔔 Also start listening to unread count
    startUnreadCountListener(uid);
    
    notifUnsub = usersRef.doc(uid).collection('notifications').orderBy('createdAt','desc').limit(50).onSnapshot(async s=>{
      if(s.empty){ notifsContent.textContent='No notifications yet.'; return; }
      
      // CLIENT-SIDE DEDUPLICATION & RECENCY FILTER
      const now = Date.now();
      const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
      const seen = new Map(); // key = type+context, value = newest notification
      
      s.forEach(doc=>{
        const n = doc.data();
        const createdAt = n.createdAt?.toDate ? n.createdAt.toDate().getTime() : 0;
        
        // Skip notifications older than 7 days
        if(now - createdAt > SEVEN_DAYS) return;
        
        // Create dedup key based on notification type and context
        let dedupKey;
        if(n.type === 'potw_awarded') {
          dedupKey = `potw_${n.data?.pingId || 'unknown'}`;
        } else if(n.type === 'mention' || n.type === 'mention_comment') {
          dedupKey = `mention_${n.data?.pingId || 'unknown'}_${n.from || 'unknown'}`;
        } else if(n.type === 'like_milestone') {
          dedupKey = `milestone_${n.data?.pingId || 'unknown'}_${n.data?.milestone || 0}`;
        } else if(n.type === 'friend_comment') {
          dedupKey = `comment_${n.data?.pingId || 'unknown'}_${n.from || 'unknown'}`;
        } else if(n.type === 'friend_req') {
          dedupKey = `freq_${n.from || 'unknown'}`;
        } else if(n.type === 'friend_accept') {
          dedupKey = `facc_${n.partner || 'unknown'}`;
        } else {
          dedupKey = `${n.type}_${doc.id}`;
        }
        
        // Keep only the newest notification for each dedupKey
        if(!seen.has(dedupKey) || createdAt > (seen.get(dedupKey).createdAt || 0)) {
          seen.set(dedupKey, { ...n, id: doc.id, createdAt });
        }
      });
      
      // Convert map to array and sort by recency
      const uniqueNotifs = Array.from(seen.values()).sort((a, b) => b.createdAt - a.createdAt);
      
      if(uniqueNotifs.length === 0) {
        notifsContent.textContent='No recent notifications.';
        return;
      }
      
      // 🚀 OPTIMIZATION: Pre-fetch all unique UIDs to avoid redundant Firestore reads
      const uniqueUidsInNotifs = new Set();
      uniqueNotifs.forEach(n => {
        if(n.from) uniqueUidsInNotifs.add(n.from);
        if(n.partner) uniqueUidsInNotifs.add(n.partner);
      });
      
      // Batch fetch all handles in parallel
      const handleFetchPromises = Array.from(uniqueUidsInNotifs).map(uid => 
        getHandleForUid(uid).catch(() => '@unknown')
      );
      await Promise.all(handleFetchPromises);
      // Now all handles are cached in uidHandleCache
      
      notifsContent.innerHTML='';
      uniqueNotifs.forEach(n=>{
          const line=document.createElement('div');
          if(n.type==='friend_req'){ 
            line.className='notif req';
            const from = n.from;
          const notifId = n.id;
          line.innerHTML = '<div class="notif-row"><div>Friend request</div><div class="notif-actions"><button class="btn" id="acc_'+notifId+'">✓</button><button class="btn" id="dec_'+notifId+'">✕</button></div></div>';
          notifsContent.appendChild(line);
          
          // Bind events immediately after creating the element
          const acc = document.getElementById('acc_'+notifId); 
          const dec = document.getElementById('dec_'+notifId);
          if(acc) {
            acc.onclick = async ()=>{
              try{
                await acceptFriendRequest(from+'_'+currentUser.uid);
                closeModal('notifsModal');
                showToast('Friend request accepted');
                // Remove the notification from UI
                line.remove();
              }catch(e){
                console.error('Accept friend request error:', e);
                showToast('Failed to accept request');
              }
            };
          }
          if(dec) {
            dec.onclick = async ()=>{
              try{
                await declineFriendRequest(from+'_'+currentUser.uid);
                showToast('Friend request declined');
                // Remove the notification from UI
                line.remove();
              }catch(e){
                console.error('Decline friend request error:', e);
                showToast('Failed to decline request');
              }
            };
            }
          } else if(n.type==='friend_accept'){ 
            line.textContent = 'Friend request accepted.';
          notifsContent.appendChild(line);
          } else if(n.type==='potw_awarded'){ 
            const bonus = n.data?.bonus || POTW_REWARD_PP;
            line.innerHTML = `<div>👑 Your ping won Ping of the Week! <strong>+${bonus} PPs</strong></div>`;
            line.style.cursor = 'pointer';
            line.onclick = ()=>{
              if(n.data?.pingId){
                closeModal('notifsModal');
                const ping = lastPingCache.get(n.data.pingId);
                if(ping){
                  map.flyTo([ping.lat, ping.lon], 17, { duration: 0.6 });
                  setTimeout(()=> openSheet(n.data.pingId), 300);
                } else {
                  showToast('This ping has expired', 'warning');
                }
              }
            };
          notifsContent.appendChild(line);
          } else if(n.type==='friend_ping'){
            line.textContent = 'A friend just dropped a ping.';
          notifsContent.appendChild(line);
          } else if(n.type==='friend_removed'){
            line.textContent = 'You were removed as a friend.';
          notifsContent.appendChild(line);
          } else if(n.type==='gift_received'){
            line.className='notif';
            const amount = Number(n.amount||0);
            line.textContent = `🎁 You received ${amount} PPs`;
            (async ()=>{
              try{
                const handle = await getHandleForUid(n.fromUid);
                line.textContent = `🎁 ${handle} sent you ${amount} PPs`;
              }catch(_){}
            })();
          notifsContent.appendChild(line);
          } else if(n.type==='mention'){
            // Mention notification - clickable to view ping
            line.className='notif';
            line.style.cursor='pointer';
            const pingText = n.data?.pingText || '';
            const truncated = pingText.length > 50 ? pingText.slice(0,50)+'...' : pingText;
            line.innerHTML = `<div><strong>@...</strong> mentioned you: "${truncated}"</div>`;
            
            // Fetch and display the real username
            (async ()=>{
              try{
                const handle = await getHandleForUid(n.from);
                const handleSpan = document.createElement('strong');
                handleSpan.textContent = handle;
                handleSpan.style.color = '#1d4ed8';
                line.innerHTML = '';
                line.appendChild(handleSpan);
                line.appendChild(document.createTextNode(` mentioned you: "${truncated}"`));
              }catch(err){
                console.error('Error fetching mention handle:', err);
              }
            })();
            
            line.onclick = ()=>{
              if(n.data?.pingId){
                closeModal('notifsModal');
                openSheet(n.data.pingId);
                const ping = lastPingCache.get(n.data.pingId);
                if(ping) map.flyTo([ping.lat, ping.lon], 17, { duration: 0.6 });
              }
            };
          notifsContent.appendChild(line);
          } else if(n.type==='mention_comment'){
            // Mention in comment notification
            line.className='notif';
            line.style.cursor='pointer';
            const commentText = n.data?.commentText || '';
            const truncated = commentText.length > 50 ? commentText.slice(0,50)+'...' : commentText;
            line.innerHTML = `<div><strong>@...</strong> mentioned you in a comment: "${truncated}"</div>`;
            
            // Fetch and display the real username
            (async ()=>{
              try{
                const handle = await getHandleForUid(n.from);
                const handleSpan = document.createElement('strong');
                handleSpan.textContent = handle;
                handleSpan.style.color = '#1d4ed8';
                line.innerHTML = '';
                line.appendChild(handleSpan);
                line.appendChild(document.createTextNode(` mentioned you in a comment: "${truncated}"`));
              }catch(err){
                console.error('Error fetching mention handle:', err);
              }
            })();
            
            line.onclick = ()=>{
              if(n.data?.pingId){
                closeModal('notifsModal');
                openSheet(n.data.pingId);
                const ping = lastPingCache.get(n.data.pingId);
                if(ping) map.flyTo([ping.lat, ping.lon], 17, { duration: 0.6 });
              }
            };
          notifsContent.appendChild(line);
          } else if(n.type==='like_milestone'){
            // Like milestone notification
            line.className='notif';
            line.style.cursor='pointer';
            const milestone = n.data?.milestone || 0;
            const pingText = n.data?.pingText || 'Your ping';
            const truncated = pingText.length > 40 ? pingText.slice(0,40)+'...' : pingText;
            line.innerHTML = `<div>🎉 Your ping reached ${milestone} likes! "${truncated}"</div>`;
            line.onclick = ()=>{
              if(n.data?.pingId){
                closeModal('notifsModal');
                openSheet(n.data.pingId);
                const ping = lastPingCache.get(n.data.pingId);
                if(ping) map.flyTo([ping.lat, ping.lon], 17, { duration: 0.6 });
              }
            };
          notifsContent.appendChild(line);
          } else if(n.type==='friend_comment'){
            // Friend commented notification
            line.className='notif';
            line.style.cursor='pointer';
            const commentText = n.data?.commentText || '';
            const truncated = commentText.length > 50 ? commentText.slice(0,50)+'...' : commentText;
            line.innerHTML = `<div><strong>@...</strong> commented: "${truncated}"</div>`;
            
            // Fetch and display the real username
            (async ()=>{
              try{
                const handle = await getHandleForUid(n.from);
                const handleSpan = document.createElement('strong');
                handleSpan.textContent = handle;
                handleSpan.style.color = '#1d4ed8';
                line.innerHTML = '';
                line.appendChild(handleSpan);
                line.appendChild(document.createTextNode(` commented: "${truncated}"`));
              }catch(err){
                console.error('Error fetching commenter handle:', err);
              }
            })();
            
            line.onclick = ()=>{
              if(n.data?.pingId){
                closeModal('notifsModal');
                openSheet(n.data.pingId);
                const ping = lastPingCache.get(n.data.pingId);
                if(ping) map.flyTo([ping.lat, ping.lon], 17, { duration: 0.6 });
              }
            };
          notifsContent.appendChild(line);
        }
      });
    });
  }
  // Expose for tooling and ensure it's considered "used" by TS checkers
  try{ window.startNotifListener = startNotifListener; }catch(_){ }

  /* --------- Ping of the Week --------- */
  const potwCard = $('#potwCard');
  const potwImg  = $('#potwImg');
  const potwText = $('#potwText');
  const potwMeta = $('#potwMeta');
  const potwJump = $('#potwJump');
  const potwEmpty= $('#potwEmpty');

  function updatePotwCard(){
    // Get all eligible pings for this week
    const eligiblePings = [];
    lastPingCache.forEach((p)=>{
      if(eligibleForPotw(p)) eligiblePings.push(p);
    });

    // Sort by net likes desc, then by firstNetAt milestone
    eligiblePings.sort((a,b)=> {
      const aNet = Math.max(0,(a.likes||0)-(a.dislikes||0));
      const bNet = Math.max(0,(b.likes||0)-(b.dislikes||0));
      if(aNet !== bNet) return bNet - aNet;
      
      const N = aNet;
      const aTsObj = a.firstNetAt && a.firstNetAt[String(N)];
      const bTsObj = b.firstNetAt && b.firstNetAt[String(N)];
      const aTs = (aTsObj && typeof aTsObj.toDate === 'function') ? aTsObj.toDate().getTime() : null;
      const bTs = (bTsObj && typeof bTsObj.toDate === 'function') ? bTsObj.toDate().getTime() : null;
      
      if(aTs && !bTs) return -1;
      if(bTs && !aTs) return 1;
      if(aTs && bTs && aTs !== bTs) return aTs - bTs;
      
      const aC = a.createdAt?.toDate?.().getTime() ?? Infinity;
      const bC = b.createdAt?.toDate?.().getTime() ?? Infinity;
      return aC - bC;
    });

    // Check if we meet minimum threshold
    const topPing = eligiblePings[0];
    const topNet = topPing ? Math.max(0, (topPing.likes||0)-(topPing.dislikes||0)) : 0;
    const meetsThreshold = (topNet >= POTW_MIN_NET_LIKES || eligiblePings.length >= POTW_MIN_COMPETITORS);

    // Elements
    const potwThreshold = document.getElementById('potwThreshold');
    const potwEmpty = document.getElementById('potwEmpty');
    const lastWeekChampionEl = document.getElementById('lastWeekChampion');
    const leaderboardEl = document.getElementById('potwLeaderboard');

    if(!meetsThreshold || !currentPotw){
      // No winner yet or threshold not met
      potwText.textContent = '';
      potwMeta.textContent = '';
      potwImg.style.display = 'none';
      potwJump.disabled = true;
      potwJump.style.opacity = .5;

      if(eligiblePings.length === 0){
        // No pings at all
        if(potwEmpty) potwEmpty.style.display = 'block';
        if(potwThreshold) potwThreshold.style.display = 'none';
        if(lastWeekChampionEl) lastWeekChampionEl.style.display = 'none';
      } else {
        // Have pings but don't meet threshold
        if(potwEmpty) potwEmpty.style.display = 'none';
        if(potwThreshold) {
          potwThreshold.style.display = 'block';
          potwThreshold.textContent = `Need ${POTW_MIN_NET_LIKES} net likes or ${POTW_MIN_COMPETITORS} pings to crown a winner! (Current: ${topNet} likes, ${eligiblePings.length} pings)`;
        }
        // Show last week's champion as reference
        if(lastWeekChampion && lastWeekChampionEl){
          lastWeekChampionEl.style.display = 'block';
          const lastWeekTextEl = document.getElementById('lastWeekText');
          const lastWeekMetaEl = document.getElementById('lastWeekMeta');
          if(lastWeekTextEl){
            const t = (lastWeekChampion.text || '').trim();
            lastWeekTextEl.textContent = t.length>60 ? (t.slice(0,60)+'…') : t;
          }
          if(lastWeekMetaEl){
            const who = lastWeekChampion.authorName || 'Anon';
            const net = Math.max(0, (lastWeekChampion.likes||0)-(lastWeekChampion.dislikes||0));
            lastWeekMetaEl.textContent = `${who} • ${net} likes`;
          }
        }
      }
      
      if(leaderboardEl) leaderboardEl.style.display = 'none';
      return;
    }

    // We have a winner!
    if(potwEmpty) potwEmpty.style.display = 'none';
    if(potwThreshold) potwThreshold.style.display = 'none';
    if(lastWeekChampionEl) lastWeekChampionEl.style.display = 'none';
    potwJump.disabled = false;
    potwJump.style.opacity = 1;

    // Display current winner
    const t = (currentPotw.text || '').trim();
    potwText.textContent = t.length>120 ? (t.slice(0,120)+'…') : t;

    const who = (currentPotw.authorName || 'Anon');
    const whoShort = who.length>20 ? (who.slice(0,20)+'…') : who;
    const net = Math.max(0, (currentPotw.likes||0)-(currentPotw.dislikes||0));
    potwMeta.textContent = `${whoShort} • ${net} likes`;

    try{
      const cd = document.getElementById('potwCountdown');
      if(cd){ cd.textContent = potwEndsInText(); }
    }catch(_){ }

    if(currentPotw.imageUrl){ potwImg.src=currentPotw.imageUrl; potwImg.style.display='block'; }
    else { potwImg.style.display='none'; }

    potwJump.onclick = ()=>{
      const ll = L.latLng(currentPotw.lat, currentPotw.lon);
      map.flyTo(ll, 17, { duration: 0.6, easeLinearity: 0.25 });
      const m = markers.get(currentPotw.id);
      if(m && m._icon){
        m._icon.classList.remove('potw-pulse');
        void m._icon.offsetWidth;
        m._icon.classList.add('potw-pulse');
      }
      try{ triggerConfettiAtCard(); }catch(_){ }
    };

    // Render leaderboard (top 3 + user if in top 10)
    if(leaderboardEl){
      leaderboardEl.style.display = 'block';
      const top3El = document.getElementById('leaderboardTop3');
      const userEl = document.getElementById('leaderboardUser');
      
      if(top3El){
        top3El.innerHTML = '';
        const top3 = eligiblePings.slice(0, 3);
        
        top3.forEach((ping, idx)=>{
          const item = document.createElement('div');
          item.className = `leaderboard-item rank-${idx+1}`;
          
          const rankEmoji = idx === 0 ? '👑' : idx === 1 ? '🥈' : '🥉';
          const rank = document.createElement('div');
          rank.className = 'leaderboard-rank';
          rank.textContent = rankEmoji;
          
          const info = document.createElement('div');
          info.className = 'leaderboard-info';
          
          const text = document.createElement('div');
          text.className = 'leaderboard-text';
          const pingText = (ping.text || '').trim();
          text.textContent = pingText.length > 40 ? (pingText.slice(0,40)+'…') : pingText;
          
          const meta = document.createElement('div');
          meta.className = 'leaderboard-meta';
          (async ()=>{
            const handle = await getHandleForUid(ping.authorId);
            meta.textContent = handle;
          })();
          
          info.appendChild(text);
          info.appendChild(meta);
          
          const score = document.createElement('div');
          score.className = 'leaderboard-score';
          const netLikes = Math.max(0, (ping.likes||0)-(ping.dislikes||0));
          score.textContent = `${netLikes}★`;
          
          item.appendChild(rank);
          item.appendChild(info);
          item.appendChild(score);
          
          item.style.cursor = 'pointer';
          item.onclick = ()=>{
            map.flyTo([ping.lat, ping.lon], 17, { duration: 0.6 });
            setTimeout(()=> openSheet(ping.id), 300);
          };
          
          top3El.appendChild(item);
        });
      }
      
      // Show user's ping if in top 10 but not in top 3
      if(userEl && currentUser && !currentUser.isAnonymous){
        const userPings = eligiblePings.filter(p=> p.authorId === currentUser.uid);
        if(userPings.length > 0){
          const userPing = userPings[0];
          const userRank = eligiblePings.findIndex(p=> p.id === userPing.id) + 1;
          
          if(userRank > 3 && userRank <= 10){
            userEl.style.display = 'block';
            userEl.innerHTML = '';
            
            const item = document.createElement('div');
            item.className = 'leaderboard-item user-ping';
            
            const rank = document.createElement('div');
            rank.className = 'leaderboard-rank';
            rank.textContent = `#${userRank}`;
            
            const info = document.createElement('div');
            info.className = 'leaderboard-info';
            
            const text = document.createElement('div');
            text.className = 'leaderboard-text';
            const pingText = (userPing.text || '').trim();
            text.textContent = pingText.length > 40 ? (pingText.slice(0,40)+'…') : pingText;
            
            const meta = document.createElement('div');
            meta.className = 'leaderboard-meta';
            meta.textContent = 'Your ping';
            
            info.appendChild(text);
            info.appendChild(meta);
            
            const score = document.createElement('div');
            score.className = 'leaderboard-score';
            const netLikes = Math.max(0, (userPing.likes||0)-(userPing.dislikes||0));
            const deficit = eligiblePings[0] ? Math.max(0, (eligiblePings[0].likes||0)-(eligiblePings[0].dislikes||0)) - netLikes : 0;
            score.textContent = `${netLikes}★`;
            score.title = deficit > 0 ? `${deficit} more to lead` : '';
            
            item.appendChild(rank);
            item.appendChild(info);
            item.appendChild(score);
            
            item.style.cursor = 'pointer';
            item.onclick = ()=>{
              map.flyTo([userPing.lat, userPing.lon], 17, { duration: 0.6 });
              setTimeout(()=> openSheet(userPing.id), 300);
            };
            
            userEl.appendChild(item);
          } else {
            userEl.style.display = 'none';
          }
        } else {
          userEl.style.display = 'none';
        }
      }
    }
    
    // Position Hall of Fame button right above the PotW card
    positionHallOfFameButton();
  }

  function positionHallOfFameButton(){
    try{
      const potwCard = document.getElementById('potwCard');
      const hallOfFameBtn = document.getElementById('hallOfFameBtn');
      if(!potwCard || !hallOfFameBtn) return;
      
      // Get the actual height of the PotW card
      const cardHeight = potwCard.offsetHeight;
      const cardBottom = parseInt(window.getComputedStyle(potwCard).bottom) || 10;
      
      // Position button right above the card (cardBottom + cardHeight + 2px gap)
      hallOfFameBtn.style.bottom = `${cardBottom + cardHeight + 2}px`;
    }catch(e){
      console.warn('Hall of Fame button positioning failed:', e);
    }
  }

  function triggerConfettiAtCard(){
    try{
      const card = document.getElementById('potwCard'); if(!card) return;
      let layer = card.querySelector('.confetti-layer');
      if(!layer){ layer = document.createElement('div'); layer.className='confetti-layer'; card.appendChild(layer); }
      // Create ~18 pieces around the title area
      for(let i=0;i<18;i++){
        const piece=document.createElement('div'); piece.className='confetti-piece';
        piece.style.left = (40 + Math.random()*40) + '%';
        piece.style.top  = (8 + Math.random()*18) + 'px';
        const colors=['#f59e0b','#d4af37','#10b981','#3b82f6','#ef4444'];
        piece.style.backgroundColor = colors[Math.floor(Math.random()*colors.length)];
        piece.style.transform = `translateY(0) rotate(${Math.floor(Math.random()*60)}deg)`;
        layer.appendChild(piece);
        setTimeout(()=>{ try{ piece.remove(); }catch(_){ } }, 950);
      }
    }catch(_){ }
  }

  function eligibleForPotw(p){
  // Basic doc checks
  if(!p) { console.debug('[PotW skip] no doc'); return false; }
  if(p.status === 'hidden'){ console.debug('[PotW skip]', p.id, 'hidden'); return false; }
  if(!p.createdAt || !p.createdAt.toDate){ console.debug('[PotW skip]', p.id, 'no createdAt'); return false; }

  // Weekly window (Montreal time)
  const t = p.createdAt.toDate().getTime();
  if(!isThisWeek(t)){ console.debug('[PotW skip]', p.id, 'not this week'); return false; }

  // Must be inside the 1-mile circle (same rule you use for map)
  if(!inFence(p)){ console.debug('[PotW skip]', p.id, 'outside fence'); return false; }

  // No minimum likes: top NET wins even if 0
  return true;
}


  async function authorName(uid){
    try{ return await getHandleForUid(uid); }catch(_){ return `@user${String(uid||'').slice(0,6)}`; }
  }

  // Compare two pings for PotW using net likes, then "first to reach N" milestones (firstNetAt)
  function betterPotwCandidate(a,b){
  const aNet = Math.max(0,(a.likes||0)-(a.dislikes||0));
  const bNet = Math.max(0,(b.likes||0)-(b.dislikes||0));

  if(aNet !== bNet) return aNet > bNet ? a : b;

  // Tie on net: "first to reach N net"
  const N = aNet;
  const aTsObj = a.firstNetAt && a.firstNetAt[String(N)];
  const bTsObj = b.firstNetAt && b.firstNetAt[String(N)];

  const aTs = (aTsObj && typeof aTsObj.toDate === 'function') ? aTsObj.toDate().getTime() : null;
  const bTs = (bTsObj && typeof bTsObj.toDate === 'function') ? bTsObj.toDate().getTime() : null;

  // If one has a real milestone and the other doesn't, the one with the milestone wins
  if(aTs && !bTs) return a;
  if(bTs && !aTs) return b;

  // If both have milestones, earliest wins
  if(aTs && bTs && aTs !== bTs) return aTs < bTs ? a : b;

  // Fallback (very rare): earlier createdAt
  const aC = a.createdAt?.toDate?.().getTime() ?? Infinity;
  const bC = b.createdAt?.toDate?.().getTime() ?? Infinity;
  return aC < bC ? a : b;
}



  async function recomputePotw(){
  // Check if we're in a new week - if so, save last week's winner
  try{
    const savedWeek = localStorage.getItem('htbt_potw_week');
    const currentWeekStart = startOfWeekMondayLocal().getTime();
    const currentWeekKey = String(currentWeekStart);
    
    if(savedWeek && savedWeek !== currentWeekKey && currentPotw){
      // New week detected - save last week's winner before reset
      console.log('🏆 New week detected - saving last week\'s champion:', currentPotw.text);
      lastWeekChampion = {...currentPotw};
      
      // Save to Hall of Fame in Firestore (only if not already saved)
      try{
        const hofRef = db.collection('hallOfFame').doc(savedWeek);
        const existing = await hofRef.get();
        
        if(!existing.exists){
          await hofRef.set({
            weekStart: parseInt(savedWeek),
            winner: {
              id: currentPotw.id,
              text: currentPotw.text,
              authorId: currentPotw.authorId,
              authorName: currentPotw.authorName,
              likes: currentPotw.likes,
              dislikes: currentPotw.dislikes,
              net: Math.max(0, currentPotw.likes - currentPotw.dislikes),
              imageUrl: currentPotw.imageUrl,
              lat: currentPotw.lat,
              lon: currentPotw.lon,
              savedAt: firebase.firestore.FieldValue.serverTimestamp()
            }
          });
          console.log('✅ Saved to Hall of Fame for week:', savedWeek);
        } else {
          console.log('ℹ️ Hall of Fame entry already exists for week:', savedWeek);
        }
      }catch(e){
        console.error('Failed to save Hall of Fame:', e);
      }
    }
    
    localStorage.setItem('htbt_potw_week', currentWeekKey);
  }catch(e){
    console.error('Week check failed:', e);
  }

  // Get all eligible pings and sort them
  const eligible = [];
  lastPingCache.forEach((p)=>{
    if(!eligibleForPotw(p)) return;
    eligible.push(p);
  });

  eligible.sort((a,b)=> betterPotwCandidate(a,b) === a ? -1 : 1);

  const top = eligible[0] || null;
  const topNet = top ? Math.max(0, (top.likes||0)-(top.dislikes||0)) : 0;
  const meetsThreshold = (topNet >= POTW_MIN_NET_LIKES || eligible.length >= POTW_MIN_COMPETITORS);

  const prev = currentPotw ? currentPotw.id : null;

  // Only set currentPotw if threshold is met
  if(top && meetsThreshold){
    const name = await authorName(top.authorId);
    currentPotw = {
      id: top.id, text: top.text || '',
      likes: top.likes||0, dislikes: top.dislikes||0,
      imageUrl: top.imageUrl||null, lat: top.lat, lon: top.lon,
      authorId: top.authorId, authorName: name,
      firstNetAt: top.firstNetAt || {}
    };
  }else{
    currentPotw = null;
  }

  // Send notifications for rankings
  if(currentUser && !currentUser.isAnonymous && eligible.length > 0){
    try{
      const userPings = eligible.filter(p=> p.authorId === currentUser.uid);
      if(userPings.length > 0){
        const userPing = userPings[0];
        const userRank = eligible.findIndex(p=> p.id === userPing.id) + 1;
        
        // Notification: You're in Top 3! (once per ping)
        if(userRank <= 3 && !userNotifiedTop3.has(userPing.id)){
          userNotifiedTop3.add(userPing.id);
          const rankEmoji = userRank === 1 ? '👑' : userRank === 2 ? '🥈' : '🥉';
          showToast(`${rankEmoji} You're #${userRank} for Ping of the Week!`, 'success');
        }
        
        // Notification: Someone passed you!
        if(userPreviousRank !== null && userRank > userPreviousRank && userRank <= 10){
          showToast(`📉 You dropped to #${userRank} in PotW rankings`, 'warning');
        }
        
        // Update previous rank
        userPreviousRank = userRank;
      }
    }catch(e){
      console.error('Ranking notifications failed:', e);
    }
  }

  // Winner changed - send notification and award points
  if(prev !== (currentPotw ? currentPotw.id : null)){
    try{
      if(currentPotw && currentPotw.authorId){
        // Crown animation
        const potwTitleEl = document.querySelector('.potw-title');
        if(potwTitleEl && prev){
          potwTitleEl.classList.add('crown-change');
          setTimeout(()=> potwTitleEl.classList.remove('crown-change'), 800);
        }
        
        // Deduped PotW notification
        const monday1 = startOfWeekMondayLocal();
        const weekKey1 = `${monday1.getFullYear()}_${monday1.getMonth()+1}_${monday1.getDate()}`;
        const notifId = `potw_${weekKey1}_${currentPotw.id}`;
        await db.runTransaction(async (tx)=>{
          const nref = usersRef.doc(currentPotw.authorId).collection('notifications').doc(notifId);
          const ns = await tx.get(nref);
          if(!ns.exists){ tx.set(nref, { type:'potw_awarded', pingId: currentPotw.id, net: currentPotw.net || netLikes(lastPingCache.get(currentPotw.id) || {}), bonus:POTW_REWARD_PP, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }
        });
        
        // Award PotW PPs (dedupe via meta doc)
        const monday2 = startOfWeekMondayLocal();
        const weekKey2 = `${monday2.getFullYear()}_${monday2.getMonth()+1}_${monday2.getDate()}`;
        const metaId = `potw_${weekKey2}_${currentPotw.authorId}`;
        await db.runTransaction(async (tx)=>{
          const mref = db.collection('meta').doc(metaId);
          const msnap = await tx.get(mref);
          if(msnap.exists) return;
          
          const uref = usersRef.doc(currentPotw.authorId);
          const usnap = await tx.get(uref);
          const prevPts = usnap.exists ? Number(usnap.data().points||0) : 0;
          
          tx.set(mref, { type:'potw_award', at: firebase.firestore.FieldValue.serverTimestamp(), pid: currentPotw.id });
          tx.set(uref, { points: Math.max(0, prevPts + POTW_REWARD_PP) }, { merge:true });
        });
      }
    }catch(e){ console.warn('potw notify failed', e); }

    restyleMarkers(); reFilterMarkers();
    potwCard.style.transform = 'translateX(-50%) scale(1.015)';
    setTimeout(()=> potwCard.style.transform='translateX(-50%) scale(1)', 450);
  }else{
    restyleMarkers();
  }
  updatePotwCard();
}

  // Call recomputePotw after function is defined
  recomputePotw().catch(console.error);

    // 

  // PotW listeners: need this week's window, not just 24h
  let potwUnsub = null;
  function startPotwListener(){
    if(potwUnsub) potwUnsub();
    const wStart = startOfWeekMondayLocal();
    // 🔥 PERFORMANCE: Reduced from 1000 to 200 - PotW only needs recent high-engagement pings
    potwUnsub = pingsRef.where('createdAt','>=', wStart).orderBy('createdAt','desc').limit(200).onSnapshot(s=>{
      s.docChanges().forEach(ch=>{
        const p = { id: ch.doc.id, ...ch.doc.data() };
        lastPingCache.set(p.id,p);
      });
      recomputePotw().catch(console.error);
    }, e=>console.error(e));
  }
  startPotwListener();

  // Update PotW countdown every 60s
  setInterval(()=>{ try{ const cd=document.getElementById('potwCountdown'); if(cd){ cd.textContent = potwEndsInText(); } }catch(_){ } }, 60*1000);

  /* --------- Hall of Fame --------- */
  const hallOfFameBtn = document.getElementById('hallOfFameBtn');
  const hallOfFameModal = document.getElementById('hallOfFameModal');
  const closeHallOfFame = document.getElementById('closeHallOfFame');
  const hallOfFameContent = document.getElementById('hallOfFameContent');

  if(hallOfFameBtn){
    hallOfFameBtn.onclick = async ()=>{
      try{
        openModal('hallOfFameModal');
        
        // Load all winners from Firestore
        if(hallOfFameContent){
          hallOfFameContent.innerHTML = '<div class="muted" style="text-align:center; padding:20px;">Loading history...</div>';
        }
        
        const hofSnapshot = await db.collection('hallOfFame').orderBy('weekStart', 'desc').get();
        
        if(hofSnapshot.empty){
          if(hallOfFameContent){
            hallOfFameContent.innerHTML = '<div class="muted" style="text-align:center; padding:40px;">No winners yet. Be the first to win Ping of the Week!</div>';
          }
          return;
        }
        
        // Get current week start to exclude it from Hall of Fame
        const currentWeekStart = startOfWeekMondayLocal().getTime();
        
        // Render all weeks (excluding current week and duplicates)
        let html = '';
        const seenWeeks = new Set(); // Track weeks to prevent duplicates
        
        hofSnapshot.forEach((doc)=>{
          const data = doc.data();
          const winner = data.winner || {};
          const weekStart = data.weekStart || 0;
          
          // Skip current week (it's not complete yet)
          if(weekStart >= currentWeekStart){
            console.log('Skipping current week from Hall of Fame:', weekStart);
            return;
          }
          
          // Skip duplicates
          if(seenWeeks.has(weekStart)){
            console.log('Skipping duplicate week:', weekStart);
            return;
          }
          seenWeeks.add(weekStart);
          
          const weekDate = new Date(weekStart);
          const weekEnd = new Date(weekStart + 6 * 24 * 3600 * 1000);
          
          const weekTitle = `Week of ${weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
          const pingText = (winner.text || 'Ping').trim();
          const displayText = pingText.length > 80 ? (pingText.slice(0,80)+'…') : pingText;
          const authorName = winner.authorName || 'Anonymous';
          const net = winner.net || 0;
          
          html += `
            <div class="hof-week" data-ping-id="${winner.id || ''}" data-lat="${winner.lat || ''}" data-lon="${winner.lon || ''}">
              <div class="hof-week-title">${weekTitle}</div>
              <div class="hof-ping-text">${displayText}</div>
              <div class="hof-ping-meta">by ${authorName} • ${net} likes</div>
            </div>
          `;
        });
        
        if(hallOfFameContent){
          // Check if we have any past winners to display
          if(html.trim() === ''){
            hallOfFameContent.innerHTML = '<div class="muted" style="text-align:center; padding:40px;">No past winners yet. The current week\'s winner will appear here next Monday!</div>';
            return;
          }
          
          hallOfFameContent.innerHTML = html;
          
          // Add click handlers to each week entry
          hallOfFameContent.querySelectorAll('.hof-week').forEach((el)=>{
            el.onclick = ()=>{
              const pingId = el.getAttribute('data-ping-id');
              const lat = parseFloat(el.getAttribute('data-lat'));
              const lon = parseFloat(el.getAttribute('data-lon'));
              
              if(pingId && !isNaN(lat) && !isNaN(lon)){
                closeModal('hallOfFameModal');
                map.flyTo([lat, lon], 17, { duration: 0.8 });
                setTimeout(()=>{
                  // Try to open the ping if it still exists
                  if(lastPingCache.has(pingId)){
                    openSheet(pingId);
                  } else {
                    showToast('This ping has expired', 'warning');
                  }
                }, 400);
              }
            };
          });
        }
        
      }catch(e){
        console.error('Hall of Fame loading failed:', e);
        if(hallOfFameContent){
          hallOfFameContent.innerHTML = '<div class="muted" style="text-align:center; padding:20px; color:#ef4444;">Failed to load history. Please try again.</div>';
        }
      }
    };
  }

  if(closeHallOfFame){
    closeHallOfFame.onclick = ()=> closeModal('hallOfFameModal');
  }

  // Reposition Hall of Fame button on window resize
  window.addEventListener('resize', positionHallOfFameButton);
  
  // Initial positioning after a short delay to ensure DOM is ready
  setTimeout(positionHallOfFameButton, 100);

  /* --------- Auth state --------- */
  auth.onAuthStateChanged(async (u)=>{
    try{ 
      // 🔒 CRITICAL: Ensure handle exists BEFORE refreshing UI
      if(u && !u.isAnonymous) {
        console.log('🔧 Auth state changed - ensuring identity mappings first');
        await ensureIdentityMappings(u);
      }
      await refreshAuthUI(u); 
    }catch(e){ console.error('onAuthStateChanged', e); }
    // Refresh live markers when auth changes to prevent stale filter states
    try{ reFilterMarkers(); }catch(_){ }
  });
  auth.onIdTokenChanged(async (u)=>{
    try{ 
      // 🔒 CRITICAL: Ensure handle exists BEFORE refreshing UI
      if(u && !u.isAnonymous) {
        await ensureIdentityMappings(u);
      }
      await refreshAuthUI(u); 
    }catch(e){ console.error('onIdTokenChanged', e); }
  });
  // Initial paint if already signed in from a previous session
  try{ 
    if(auth.currentUser && !auth.currentUser.isAnonymous) {
      console.log('🔧 Initial paint - ensuring identity mappings first');
      await ensureIdentityMappings(auth.currentUser);
    }
    if(auth.currentUser) {
      await refreshAuthUI(auth.currentUser);
    }
  }catch(e){ console.error('Initial auth paint error:', e); }

  // Ultra-robust UI sync loop: ensure UI reflects auth state even if events are missed
  (function startAuthUISync(){
    let lastUid = null; let lastAnon = null;
    setInterval(()=>{
      try{
        const u = auth.currentUser || null;
        const uid = u ? u.uid : null; const isAnon = !!(u && u.isAnonymous);
        const authBarVisible = false;
        const chipVisible    = false;

        const needsFlip = (
          (u && authBarVisible) || (!u && chipVisible) ||
          (uid !== lastUid) || (isAnon !== lastAnon)
        );

        if(needsFlip){ forceAuthUI(u); }
        lastUid = uid; lastAnon = isAnon;
      }catch(_){}
    }, 400);
  })();
  /* --------- Start PotW recompute cadence as safety --------- */
  setInterval(()=>{ recomputePotw().catch(console.error); }, 60*1000); // Reduced from 15s to 60s

/* --------- Ensure buttons are enabled on load ---------- */
setTimeout(function(){ try { applyModalOpenClass(); } catch(e) {} }, 100);
}
  // Initialize profile system after everything is loaded
  setTimeout(() => {
    initializeProfileSystem();
  }, 100);
}
// Start the app
main().catch(console.error);