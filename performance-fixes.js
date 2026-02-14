/**
 * CRITICAL PERFORMANCE FIXES
 * Addresses slow loading, crashes, and click responsiveness
 */

(function() {
  'use strict';
  
  console.log('⚡ Loading performance optimizations...');
  
  // ============================================
  // 1. FIX: Reduce initial ping load (800 is WAY too much)
  // ============================================
  window.PERFORMANCE_CONFIG = {
    // Reduce from 800 to reasonable limits
    MAX_PINGS_DESKTOP: 200,
    MAX_PINGS_MOBILE: 100,
    
    // Pagination
    LOAD_MORE_BATCH: 50,
    
    // Marker clustering threshold
    CLUSTER_AT_ZOOM: 13,
    
    // Debounce timings
    MAP_MOVE_DEBOUNCE: 300,
    FILTER_DEBOUNCE: 200,
    RESTYLE_DEBOUNCE: 500,
    
    // NSFW check optimization
    NSFW_CHECK_BATCH_SIZE: 5,
    NSFW_CHECK_DELAY: 100,
  };
  
  // Detect if mobile
  window.isMobileDevice = () => {
    return window.innerWidth < 768 || 
           /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  };
  
  // Get appropriate ping limit
  window.getOptimalPingLimit = () => {
    return window.isMobileDevice() ? 
      window.PERFORMANCE_CONFIG.MAX_PINGS_MOBILE : 
      window.PERFORMANCE_CONFIG.MAX_PINGS_DESKTOP;
  };
  
  // ============================================
  // 2. BATCH PROCESSING for expensive operations
  // ============================================
  window.batchProcess = function(items, processor, batchSize = 10, delay = 50) {
    return new Promise((resolve) => {
      let index = 0;
      
      function processBatch() {
        const batch = items.slice(index, index + batchSize);
        batch.forEach(processor);
        index += batchSize;
        
        if (index < items.length) {
          setTimeout(processBatch, delay);
        } else {
          resolve();
        }
      }
      
      processBatch();
    });
  };
  
  // ============================================
  // 3. DEBOUNCE with leading/trailing options
  // ============================================
  window.debounce = function(func, wait, options = {}) {
    let timeout;
    let lastCallTime = 0;
    
    const { leading = false, trailing = true, maxWait } = options;
    
    return function(...args) {
      const now = Date.now();
      const timeSinceLastCall = now - lastCallTime;
      
      const invokeFunc = () => {
        lastCallTime = now;
        func.apply(this, args);
      };
      
      clearTimeout(timeout);
      
      if (leading && timeSinceLastCall > wait) {
        invokeFunc();
      }
      
      if (trailing) {
        timeout = setTimeout(invokeFunc, wait);
      }
      
      if (maxWait && timeSinceLastCall >= maxWait) {
        invokeFunc();
      }
    };
  };
  
  // ============================================
  // 4. THROTTLE for frequent events
  // ============================================
  window.throttle = function(func, limit) {
    let inThrottle;
    return function(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  };
  
  // ============================================
  // 5. REQUEST ANIMATION FRAME wrapper
  // ============================================
  window.rafThrottle = function(func) {
    let rafId;
    return function(...args) {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        func.apply(this, args);
        rafId = null;
      });
    };
  };
  
  // ============================================
  // 6. MARKER POOLING (reuse instead of recreate)
  // ============================================
  window.MarkerPool = class {
    constructor(maxSize = 50) {
      this.pool = [];
      this.maxSize = maxSize;
    }
    
    acquire() {
      return this.pool.pop() || null;
    }
    
    release(marker) {
      if (this.pool.length < this.maxSize) {
        this.pool.push(marker);
      } else {
        // Destroy if pool is full
        if (marker.remove) marker.remove();
      }
    }
    
    clear() {
      this.pool.forEach(m => {
        if (m.remove) m.remove();
      });
      this.pool = [];
    }
  };
  
  // ============================================
  // 7. VISIBLE VIEWPORT DETECTION
  // ============================================
  window.isInViewport = function(lat, lon, map, padding = 0.1) {
    if (!map) return true;
    const bounds = map.getBounds();
    const latDiff = (bounds.getNorth() - bounds.getSouth()) * padding;
    const lngDiff = (bounds.getEast() - bounds.getWest()) * padding;
    
    return lat >= bounds.getSouth() - latDiff &&
           lat <= bounds.getNorth() + latDiff &&
           lon >= bounds.getWest() - lngDiff &&
           lon <= bounds.getEast() + lngDiff;
  };
  
  
  // ============================================
  // 9. MEMORY MONITORING & AUTO-CLEANUP
  // ============================================
  window.MemoryMonitor = class {
    constructor() {
      this.checks = 0;
      this.warnings = 0;
      this.startMonitoring();
    }
    
    startMonitoring() {
      setInterval(() => {
        this.checks++;
        
        if ('memory' in performance) {
          const mem = performance.memory;
          const usedMB = Math.round(mem.usedJSHeapSize / 1048576);
          const limitMB = Math.round(mem.jsHeapSizeLimit / 1048576);
          const usedPercent = (usedMB / limitMB) * 100;
          
          if (usedPercent > 85) {
            this.warnings++;
            console.warn(`⚠️  Memory: ${usedMB}MB / ${limitMB}MB (${usedPercent.toFixed(1)}%)`);
            
            // Trigger cleanup
            this.triggerCleanup();
            
            // Force reload if too many warnings
            if (this.warnings > 3) {
              console.error('💥 Memory critically low - reloading page...');
              localStorage.setItem('memoryReload', Date.now());
              setTimeout(() => location.reload(), 1000);
            }
          } else if (this.checks % 10 === 0) {
            console.log(`💚 Memory: ${usedMB}MB / ${limitMB}MB (${usedPercent.toFixed(1)}%)`);
            this.warnings = 0; // Reset warnings on good health
          }
        }
      }, 30000); // Every 30 seconds
    }
    
    triggerCleanup() {
      console.log('🧹 Triggering memory cleanup...');
      
      // Clear old cache entries
      if (window.lastPingCache && window.lastPingCache.size > 200) {
        const entriesToKeep = 150;
        const entries = Array.from(window.lastPingCache.entries());
        window.lastPingCache.clear();
        entries.slice(-entriesToKeep).forEach(([k, v]) => {
          window.lastPingCache.set(k, v);
        });
        console.log(`Reduced ping cache from ${entries.length} to ${entriesToKeep}`);
      }
      
      // Clear NSFW queue results

      
      // Force garbage collection (if available)
      if (window.gc) {
        window.gc();
      }
    }
  };
  
  // ============================================
  // 10. CLICK RESPONSIVENESS FIX
  // ============================================
  window.makeClickResponsive = function(element, callback, options = {}) {
    if (!element) return;
    
    const { delay = 0, preventDefault = true } = options;
    let touchStartTime = 0;
    let moved = false;
    
    element.addEventListener('touchstart', (e) => {
      touchStartTime = Date.now();
      moved = false;
    }, { passive: true });
    
    element.addEventListener('touchmove', () => {
      moved = true;
    }, { passive: true });
    
    element.addEventListener('touchend', (e) => {
      const touchDuration = Date.now() - touchStartTime;
      
      if (!moved && touchDuration < 500) {
        if (preventDefault) e.preventDefault();
        
        if (delay > 0) {
          setTimeout(() => callback(e), delay);
        } else {
          callback(e);
        }
      }
    }, { passive: !preventDefault });
    
    // Still support regular clicks for desktop
    element.addEventListener('click', callback);
  };
  
  // ============================================
  // 11. PROGRESSIVE LOADING
  // ============================================
  window.ProgressiveLoader = class {
    constructor(totalItems, batchSize = 20, delay = 100) {
      this.totalItems = totalItems;
      this.batchSize = batchSize;
      this.delay = delay;
      this.currentIndex = 0;
      this.paused = false;
    }
    
    async load(processor) {
      while (this.currentIndex < this.totalItems.length && !this.paused) {
        const batch = this.totalItems.slice(
          this.currentIndex,
          this.currentIndex + this.batchSize
        );
        
        await Promise.all(batch.map(processor));
        this.currentIndex += this.batchSize;
        
        // Yield to browser
        await new Promise(resolve => setTimeout(resolve, this.delay));
      }
    }
    
    pause() {
      this.paused = true;
    }
    
    resume() {
      this.paused = false;
    }
  };
  
  // ============================================
  // Initialize
  // ============================================
  
  // Start memory monitoring
  window.memoryMonitor = new window.MemoryMonitor();
  
  // Check if page was reloaded due to memory issues
  const lastReload = localStorage.getItem('memoryReload');
  if (lastReload && Date.now() - parseInt(lastReload) < 5000) {
    console.warn('⚠️  Page was recently reloaded due to memory issues');
    localStorage.removeItem('memoryReload');
  }
  
  // Optimize map interactions
  if (window.L && window.L.Map) {
    const originalOnAdd = window.L.Map.prototype.onAdd;
    window.L.Map.prototype.onAdd = function(...args) {
      const result = originalOnAdd.apply(this, args);
      
      // Throttle map move events
      this.on('moveend', window.throttle(() => {
        console.log('📍 Map moved');
      }, 500));
      
      return result;
    };
  }
  
  console.log('✅ Performance optimizations loaded');
  console.log('📊 Max pings:', window.getOptimalPingLimit());
  
})();

