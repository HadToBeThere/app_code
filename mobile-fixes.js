/**
 * Mobile Performance & Stability Fixes
 * Addresses iPhone crashes, slow loading, and click responsiveness
 */

(function() {
  'use strict';
  
  console.log('📱 Loading mobile optimizations...');
  
  // 1. PREVENT DOUBLE-TAP ZOOM (causes accidental zooms on mobile)
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function(event) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, {passive: false});
  
  // 2. IMPROVE TOUCH RESPONSIVENESS
  // Remove 300ms click delay on mobile
  document.addEventListener('DOMContentLoaded', function() {
    if ('ontouchstart' in window) {
      document.body.style.touchAction = 'manipulation';
    }
  });
  
  // 3. PREVENT MEMORY LEAKS (iPhone crashes)
  // Clean up Leaflet markers periodically
  let markerCleanupInterval = null;
  
  function setupMarkerCleanup() {
    if (markerCleanupInterval) clearInterval(markerCleanupInterval);
    
    // Clean up every 5 minutes
    markerCleanupInterval = setInterval(() => {
      if (typeof window.map !== 'undefined' && window.map) {
        const markerCount = Object.keys(window.map._layers).length;
        console.log(`🧹 Marker cleanup check: ${markerCount} layers`);
        
        // If too many markers, force reload
        if (markerCount > 500) {
          console.warn('⚠️  Too many markers, refreshing map...');
          location.reload();
        }
      }
    }, 5 * 60 * 1000);
  }
  
  // 4. THROTTLE SCROLL EVENTS (reduces lag)
  function throttle(func, wait) {
    let timeout;
    return function(...args) {
      if (!timeout) {
        timeout = setTimeout(() => {
          timeout = null;
          func.apply(this, args);
        }, wait);
      }
    };
  }
  
  // 5. LAZY LOAD IMAGES
  function setupLazyLoading() {
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target;
            if (img.dataset.src) {
              img.src = img.dataset.src;
              img.removeAttribute('data-src');
              observer.unobserve(img);
            }
          }
        });
      }, {
        rootMargin: '50px'
      });
      
      // Observe all images with data-src
      document.querySelectorAll('img[data-src]').forEach(img => {
        imageObserver.observe(img);
      });
    }
  }
  
  // 6. DEBOUNCE MAP INTERACTIONS
  window.debouncedMapClick = function(callback, delay = 200) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => callback.apply(this, args), delay);
    };
  };
  
  // 7. DETECT LOW MEMORY (iPhone crash prevention)
  if ('memory' in performance) {
    setInterval(() => {
      const mem = performance.memory;
      const usedPercent = (mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100;
      
      if (usedPercent > 90) {
        console.warn('⚠️  Memory usage high:', usedPercent.toFixed(1) + '%');
        console.warn('💡 Consider refreshing the page if experiencing lag');
      }
    }, 30000); // Check every 30 seconds
  }
  
  // 8. OPTIMIZE FOR SAFARI
  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  if (isSafari) {
    console.log('🧭 Safari detected - applying optimizations');
    
    // Fix for Safari's aggressive memory management
    window.addEventListener('pagehide', function() {
      // Clean up before page is hidden
      if (markerCleanupInterval) clearInterval(markerCleanupInterval);
    });
    
    window.addEventListener('pageshow', function(event) {
      // Reload if coming back from bfcache
      if (event.persisted) {
        console.log('♻️  Page restored from cache, reloading...');
        location.reload();
      }
    });
  }
  
  // 9. FIX FOR VIEWPORT ISSUES ON iOS
  function fixiOSViewport() {
    const viewportMeta = document.querySelector('meta[name="viewport"]');
    if (viewportMeta) {
      viewportMeta.setAttribute('content', 
        'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no'
      );
    }
  }
  
  // 10. REDUCE MAP TILE LOADING (faster load times)
  window.optimizeMapForMobile = function(map) {
    if (!map) return;
    
    // Reduce tile loading for mobile
    if (window.innerWidth < 768) {
      map.options.zoomSnap = 0.5;
      map.options.zoomAnimation = false; // Faster on mobile
      map.options.markerZoomAnimation = false;
    }
  };
  
  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setupMarkerCleanup();
      setupLazyLoading();
      if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
        fixiOSViewport();
      }
    });
  } else {
    setupMarkerCleanup();
    setupLazyLoading();
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      fixiOSViewport();
    }
  }
  
  // 11. PREVENT iOS RUBBER BAND EFFECT ON MODALS
  document.addEventListener('touchmove', function(e) {
    if (e.target.closest('.modal.open')) {
      const modal = e.target.closest('.modal.open');
      const content = modal.querySelector('.content');
      
      if (content) {
        const isAtTop = content.scrollTop === 0;
        const isAtBottom = content.scrollHeight - content.scrollTop === content.clientHeight;
        
        if ((isAtTop && e.touches[0].clientY > content.getBoundingClientRect().top) ||
            (isAtBottom && e.touches[0].clientY < content.getBoundingClientRect().bottom)) {
          e.preventDefault();
        }
      }
    }
  }, {passive: false});
  
  console.log('✅ Mobile optimizations loaded');
  
})();

