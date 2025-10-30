# 🚀 Deployment Guide - Had to Be There

This guide will walk you through deploying your app securely to production.

## 📋 Pre-Deployment Checklist

Before deploying, ensure you have:

- [ ] Firebase CLI installed (`npm install -g firebase-tools`)
- [ ] Node.js 18+ installed
- [ ] Your Firebase project created
- [ ] Domain configured (optional but recommended)
- [ ] SSL certificate configured (Firebase Hosting provides this automatically)

## 🔐 Step 1: Security Rules Deployment

### 1.1 Test Security Rules Locally (IMPORTANT!)

```bash
# Start Firebase emulators to test rules
firebase emulators:start
```

Open the Emulator UI at http://localhost:4000 and test:
- Creating pings (should work when authenticated)
- Reading pings (should respect visibility)
- Attempting writes directly to Firestore (should fail)

### 1.2 Deploy Firestore Rules

```bash
# Deploy ONLY Firestore rules first
firebase deploy --only firestore:rules

# Verify deployment
firebase firestore:rules:get
```

### 1.3 Deploy Storage Rules

```bash
# Deploy storage rules
firebase deploy --only storage

# Test: Try uploading without auth (should fail)
# Test: Try uploading valid image when authenticated (should work)
```

## ⚡ Step 2: Cloud Functions Deployment

### 2.1 Install Function Dependencies

```bash
cd functions
npm install
cd ..
```

### 2.2 Test Functions Locally

```bash
# Start functions emulator
firebase emulators:start --only functions

# In another terminal, test functions
# Example: Create a test ping via the emulated function
```

### 2.3 Deploy Cloud Functions

```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific function
firebase deploy --only functions:createPing

# Monitor deployment
firebase functions:log
```

**⚠️ CRITICAL**: After deploying functions, your old client code that writes directly to Firestore will STOP WORKING. This is intentional and expected.

### 2.4 Verify Functions Are Working

```bash
# Check function logs
firebase functions:log --only createPing

# Should see successful invocations after users start creating pings
```

## 🌐 Step 3: Hosting Deployment

### 3.1 Prepare Hosting Files

Ensure your `firebase.json` is configured (already done ✅)

### 3.2 Deploy Hosting

```bash
# Deploy hosting
firebase deploy --only hosting

# Your app will be live at:
# https://YOUR_PROJECT_ID.web.app
# https://YOUR_PROJECT_ID.firebaseapp.com
```

### 3.3 Custom Domain (Optional)

```bash
# Add custom domain via Firebase Console
# Go to: Hosting → Add custom domain
# Follow DNS configuration instructions
```

## 🔒 Step 4: Environment Variables

### 4.1 For Cloud Functions

```bash
# Set Firebase config environment variables
firebase functions:config:set app.name="Had to Be There"
firebase functions:config:set app.url="https://yourdomain.com"

# If using Stripe
firebase functions:config:set stripe.secret="sk_live_YOUR_KEY"

# Re-deploy functions after config changes
firebase deploy --only functions
```

### 4.2 For Client (Firebase Hosting)

Firebase automatically injects your project config. No action needed!

## 📊 Step 5: Database Indexes

Cloud Firestore may require composite indexes for complex queries.

```bash
# Deploy indexes
firebase deploy --only firestore:indexes

# Check index status
# Visit: Firebase Console → Firestore → Indexes
```

If you see index errors in your logs:
1. Click the auto-generated link in the error
2. Wait for index to build (can take 5-15 minutes)
3. Retry the operation

## 🧪 Step 6: Post-Deployment Testing

### 6.1 Test Authentication

1. Visit your deployed app
2. Sign in with Google
3. Check Firebase Console → Authentication to see user

### 6.2 Test Ping Creation

1. Try creating a ping
2. Check Firestore console → pings collection
3. Verify it appears on the map

### 6.3 Test Security

Try these (should all FAIL):

```javascript
// Open browser console and try:
firebase.firestore().collection('pings').add({
  text: 'Hacking attempt',
  lat: 0,
  lon: 0
});
// Should get: "Missing or insufficient permissions"

firebase.firestore().collection('users').doc('someuid').update({
  pp: 9999999
});
// Should fail
```

### 6.4 Test Rate Limiting

1. Create 3 pings quickly
2. Try a 4th ping → Should be blocked
3. Wait 24 hours → Should work again

## 🔍 Step 7: Monitoring & Alerts

### 7.1 Enable Firebase App Check (Anti-Abuse)

```bash
# Enable App Check in Firebase Console
# Go to: App Check → Get started
# Register your web app
# Choose reCAPTCHA v3
```

Then add to your HTML:

```html
<script src="https://www.gstatic.com/firebasejs/10.12.0/firebase-app-check-compat.js"></script>
<script>
  const appCheck = firebase.appCheck();
  appCheck.activate('YOUR_RECAPTCHA_SITE_KEY', true);
</script>
```

### 7.2 Set Up Alerts

In Firebase Console → Alerts:
- Enable billing alerts
- Enable function error rate alerts
- Enable security rule violations alerts

### 7.3 Monitor Logs

```bash
# Stream Cloud Function logs
firebase functions:log --follow

# Filter by function
firebase functions:log --only createPing

# Check for errors
firebase functions:log --only createPing --severity ERROR
```

## 💰 Step 8: Billing & Quotas

### 8.1 Set Budget Alerts

1. Go to Google Cloud Console → Billing
2. Set up budget alerts (recommend $50/month to start)
3. Set alert at 50%, 80%, 100%

### 8.2 Monitor Usage

```bash
# View usage stats
firebase projects:list

# Check quotas: Firebase Console → Usage and billing
```

### 8.3 Optimize Costs

- Enable Cloud Storage lifecycle rules (delete old uploads)
- Set Firestore TTL on ephemeral collections
- Use Cloud Scheduler instead of keeping functions warm

## 🚨 Step 9: Security Audit

### Run This Security Checklist:

```bash
# Check security rules are deployed
firebase firestore:rules:get

# Verify no test data in production
# Go to Firestore Console and review data

# Check that dangerous functions are disabled
# Review Cloud Functions and ensure only your code is deployed

# Verify storage rules
firebase storage:rules:get

# Test that unauthenticated users CAN'T:
# - Create pings
# - Modify other users' data
# - Access private pings

# Test that authenticated users CAN:
# - Create pings (within quota)
# - View public pings
# - View private pings from friends
```

## 🔄 Step 10: Continuous Deployment (Optional)

### GitHub Actions Example:

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Firebase

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      
      - name: Install dependencies
        working-directory: ./functions
        run: npm ci
      
      - name: Deploy to Firebase
        uses: w9jds/firebase-action@master
        with:
          args: deploy --only hosting,functions,firestore:rules,storage
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
```

Get token: `firebase login:ci`

## 📝 Step 11: Documentation

### Update Your README

Include:
- Production URL
- API documentation (for future mobile app)
- Contact info for security issues

### Privacy Policy & Terms

**REQUIRED** for production apps:
1. Create privacy policy (use [TermsFeed](https://www.termsfeed.com/))
2. Create terms of service
3. Add links to your app footer
4. Update Firebase Auth settings with these URLs

## ✅ Deployment Complete!

Your app is now live at: `https://YOUR_PROJECT.web.app`

### Next Steps:

1. Monitor logs daily for first week
2. Watch for security rule violations
3. Check billing to ensure no surprises
4. Gather user feedback
5. Iterate and improve!

## 🆘 Troubleshooting

### "Permission denied" errors

- Check that security rules are deployed
- Verify user is authenticated
- Check Cloud Function logs

### Functions timing out

- Increase timeout in firebase.json
- Optimize function code
- Check for infinite loops

### High costs

- Review Cloud Functions invocations
- Check for runaway queries
- Enable Cloud Firestore TTL
- Review Storage usage

### Need Help?

- Firebase Support: https://firebase.google.com/support
- Stack Overflow: Tag with `firebase` and `google-cloud-firestore`
- Firebase Discord: https://discord.gg/firebase

---

**🎉 Congratulations on deploying your secure, production-ready app!**

