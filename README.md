# 🗺️ Had to Be There - Secure Production-Ready App

A location-based social app with ephemeral pings that vanish after 24 hours.

## 🔐 Security Features

This app has been hardened for production with:

✅ **Firestore Security Rules** - All database writes require authentication and validation
✅ **Storage Security Rules** - File uploads are size-limited and type-validated  
✅ **Cloud Functions** - Server-side validation for all critical operations
✅ **Rate Limiting** - 3 pings per day, 5-minute cooldown between pings
✅ **XSS Protection** - All user input is sanitized before display
✅ **Content Moderation** - NSFW image detection before upload
✅ **Input Validation** - Real name detection, length limits, geofencing
✅ **Secure Authentication** - Google OAuth only, no anonymous posting
✅ **HTTPS Only** - Enforced via Firebase Hosting

## 📁 Project Structure

```
app_code-1/
├── index_1-2.html          # Main HTML file
├── app.js                  # Main application logic (7000+ lines)
├── app.css                 # Styles
├── xss-protection.js       # XSS sanitization
├── cloud-functions-client.js  # Cloud Function wrappers
├── moderation-heuristics.js   # Content moderation
│
├── functions/              # Cloud Functions (Backend)
│   ├── index.js           # All Cloud Functions
│   └── package.json       # Dependencies
│
├── firestore.rules         # Database security rules
├── storage.rules           # File storage security rules
├── firebase.json           # Firebase configuration
├── .firebaserc            # Firebase project config
│
└── DEPLOYMENT.md          # Deployment guide
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project (create at https://console.firebase.google.com)

### Local Development

```bash
# 1. Install Firebase CLI
npm install -g firebase-tools

# 2. Login to Firebase
firebase login

# 3. Set your Firebase project
firebase use YOUR_PROJECT_ID

# 4. Install Cloud Function dependencies
cd functions
npm install
cd ..

# 5. Start emulators for local testing
firebase emulators:start
```

Visit http://localhost:5000 to see your app.

### Deploy to Production

```bash
# Easy deployment with script
./deploy.sh

# Or manual deployment
firebase deploy
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## 🔒 Security Architecture

### Defense in Depth

1. **Client-Side Validation** (First line of defense)
   - XSS protection
   - Input sanitization
   - Content moderation

2. **Cloud Functions** (Second line of defense)
   - Server-side validation
   - Rate limiting
   - Quota enforcement
   - Geofencing

3. **Security Rules** (Final line of defense)
   - Firestore rules block all direct writes
   - Storage rules validate file types/sizes
   - Authentication requirements

### Data Flow

```
User Input → XSS Sanitization → Cloud Function → Validation → Firestore
                                       ↓
                                Security Rules Check
                                       ↓
                                  Database
```

## 📊 Monitoring

### View Logs

```bash
# All function logs
firebase functions:log

# Specific function
firebase functions:log --only createPing

# Follow live logs
firebase functions:log --follow
```

### Check Security

```bash
# View current security rules
firebase firestore:rules:get
firebase storage:rules:get

# Test security rules
firebase emulators:start
# Then run tests in browser console
```

## 💰 Cost Optimization

Expected costs for 1000 daily active users:
- Firestore: ~$5-15/month
- Cloud Functions: ~$10-20/month
- Storage: ~$5-10/month
- Hosting: FREE
- **Total: ~$20-45/month**

### Reduce Costs

1. Enable Firestore TTL for expired pings
2. Set Storage lifecycle rules
3. Optimize Cloud Function memory/timeout
4. Use Cloud CDN for media

## 🛡️ Security Best Practices

### DO:
✅ Keep Firebase config in environment variables
✅ Monitor logs for suspicious activity
✅ Update dependencies regularly
✅ Set up billing alerts
✅ Enable Firebase App Check
✅ Use HTTPS only

### DON'T:
❌ Never disable security rules
❌ Never commit `.env` files
❌ Never use admin SDK on client
❌ Never trust client-side validation alone
❌ Never store secrets in code

## 📝 API Documentation

### Cloud Functions

#### `createPing`
Creates a new ping with server-side validation.

**Input:**
```javascript
{
  text: string (1-140 chars),
  lat: number,
  lon: number,
  visibility: 'public' | 'private',
  imageUrl?: string,
  videoUrl?: string
}
```

**Returns:**
```javascript
{
  success: boolean,
  pingId: string,
  message: string
}
```

#### `addComment`
Adds a comment to a ping.

**Input:**
```javascript
{
  pingId: string,
  text: string (1-200 chars)
}
```

#### `toggleReaction`
Toggles a reaction on a ping.

**Input:**
```javascript
{
  pingId: string,
  emoji: '👍' | '❤️' | '😂' | '🔥' | '👀'
}
```

#### `updateUsername`
Updates username atomically (prevents duplicates).

**Input:**
```javascript
{
  username: string (3-24 chars, alphanumeric + _ .)
}
```

#### `sendFriendRequest`
Sends a friend request.

**Input:**
```javascript
{
  identifier: string (username or email)
}
```

#### `acceptFriendRequest`
Accepts a friend request.

**Input:**
```javascript
{
  requestId: string
}
```

## 🐛 Troubleshooting

### "Permission denied" errors
- Ensure security rules are deployed
- Check that user is authenticated
- Verify quota hasn't been exceeded

### Functions timing out
- Check function logs: `firebase functions:log`
- Increase timeout in `firebase.json`
- Optimize database queries

### High costs
- Review Cloud Functions invocations
- Check for runaway queries
- Enable TTL on Firestore
- Review Storage usage

## 📧 Support

- **Security Issues**: Create a GitHub issue with [SECURITY] prefix
- **Bug Reports**: Open a GitHub issue
- **Questions**: Check Firebase documentation or Stack Overflow

## 📄 License

[Your License Here]

## 🙏 Acknowledgments

- Firebase for backend infrastructure
- Leaflet for mapping
- MapLibre for vector tiles

---

**Built with security and privacy in mind** 🔐

