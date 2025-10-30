/**
 * XSS Protection and Input Sanitization
 * 
 * This module provides client-side protection against XSS attacks
 * by sanitizing user-generated content before displaying it.
 */

/**
 * Sanitize HTML to prevent XSS attacks
 * Strips dangerous tags and attributes while allowing safe formatting
 */
function sanitizeHTML(html) {
  if (!html) return '';
  
  // Create a temporary div to parse HTML
  const temp = document.createElement('div');
  temp.textContent = html; // This escapes HTML entities automatically
  
  return temp.innerHTML;
}

/**
 * Sanitize text for display (convert to plain text)
 * This is the strictest sanitization - no HTML allowed
 */
function sanitizeText(text) {
  if (!text) return '';
  
  // Convert to string and escape HTML entities
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

/**
 * Sanitize URL to prevent javascript: and data: URIs
 */
function sanitizeURL(url) {
  if (!url) return '';
  
  const urlString = String(url).trim().toLowerCase();
  
  // Block dangerous protocols
  if (urlString.startsWith('javascript:') ||
      urlString.startsWith('data:') ||
      urlString.startsWith('vbscript:') ||
      urlString.startsWith('file:')) {
    console.warn('🚨 Blocked potentially dangerous URL:', url);
    return '';
  }
  
  // Only allow http, https, and mailto
  if (urlString.startsWith('http://') ||
      urlString.startsWith('https://') ||
      urlString.startsWith('mailto:') ||
      urlString.startsWith('/') ||
      urlString.startsWith('#')) {
    return url;
  }
  
  // If no protocol specified, assume https
  return 'https://' + url;
}

/**
 * Sanitize attribute value
 * Removes quotes and special characters that could break out of attributes
 */
function sanitizeAttribute(value) {
  if (!value) return '';
  
  return String(value)
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Safe innerHTML setter
 * Use this instead of directly setting innerHTML
 */
function safeSetInnerHTML(element, html) {
  if (!element) return;
  
  // Sanitize the HTML
  element.textContent = html; // This automatically escapes
}

/**
 * Safe attribute setter
 * Use this for setting data attributes and other attributes
 */
function safeSetAttribute(element, attr, value) {
  if (!element || !attr) return;
  
  // For href and src, sanitize URLs
  if (attr === 'href' || attr === 'src') {
    value = sanitizeURL(value);
  } else {
    value = sanitizeAttribute(value);
  }
  
  element.setAttribute(attr, value);
}

/**
 * Create safe text node
 */
function createSafeTextNode(text) {
  return document.createTextNode(String(text || ''));
}

/**
 * Sanitize user input before submission
 * Remove potentially dangerous patterns
 */
function sanitizeUserInput(input) {
  if (!input) return '';
  
  let cleaned = String(input).trim();
  
  // Remove null bytes
  cleaned = cleaned.replace(/\0/g, '');
  
  // Limit length for safety
  if (cleaned.length > 10000) {
    cleaned = cleaned.substring(0, 10000);
  }
  
  return cleaned;
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  if (!email) return false;
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email).toLowerCase());
}

/**
 * Validate username format
 * Only alphanumeric, underscore, and period allowed
 */
function isValidUsername(username) {
  if (!username) return false;
  
  const usernameRegex = /^[a-z0-9_.]{3,24}$/i;
  return usernameRegex.test(username);
}

/**
 * Content Security Policy helper
 * Log CSP violations
 */
if (typeof document !== 'undefined') {
  document.addEventListener('securitypolicyviolation', (e) => {
    console.error('🚨 CSP Violation:', {
      blocked: e.blockedURI,
      violated: e.violatedDirective,
      original: e.originalPolicy
    });
    
    // In production, you might want to report this to your server
    // for monitoring and analysis
  });
}

// Export functions for use in other scripts
window.sanitizeHTML = sanitizeHTML;
window.sanitizeText = sanitizeText;
window.sanitizeURL = sanitizeURL;
window.sanitizeAttribute = sanitizeAttribute;
window.safeSetInnerHTML = safeSetInnerHTML;
window.safeSetAttribute = safeSetAttribute;
window.createSafeTextNode = createSafeTextNode;
window.sanitizeUserInput = sanitizeUserInput;
window.isValidEmail = isValidEmail;
window.isValidUsername = isValidUsername;

console.log('✅ XSS protection loaded');

