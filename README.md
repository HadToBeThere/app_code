# Had to Be There 📍

Ephemeral, hyper-local social moments. Share what's happening right now within your circle — no real names, no harassment. Every ping vanishes after 24 hours.

## 🚀 Quick Setup

### 1. Clone the Repository
```bash
git clone <your-repo-url>
cd app_code-1
```

### 2. Configure Firebase (Required)
**Create your private configuration file:**
```bash
cp config.example.js config.js
```

**Edit `config.js` with your Firebase credentials:**
- Go to [Firebase Console](https://console.firebase.google.com/)
- Select your project
- Go to Project Settings → General
- Scroll to "Your apps" → Web app → Config
- Copy your Firebase configuration into `config.js`

⚠️ **Security Note**: `config.js` is excluded from git and contains your private API keys. Never commit this file!

### 3. Install Firebase Tools
```bash
npm install -g firebase-tools
firebase login
```

### 4. Install Cloud Functions Dependencies
```bash
cd functions
npm install
cd ..
```

### 5. Deploy
```bash
firebase deploy
```

Or for local development:
```bash
firebase emulators:start
```

## 📁 Project Structure

```
app_code-1/
├── config.js              # 🔒 Your Firebase keys (private, not in git)
├── config.example.js      # Template for configuration
├── index_1-2.html         # Main HTML
├── app.js                 # Application logic
├── app.css                # Styling
├── cloud-functions-client.js  # Firebase function wrappers
├── functions/
│   └── index.js           # Cloud Functions (backend)
├── firestore.rules        # Database security rules
├── storage.rules          # Storage security rules
└── firebase.json          # Firebase configuration
```

## 🔒 Security Features

- ✅ API keys kept private (not in git)
- ✅ All writes through secure Cloud Functions
- ✅ XSS protection with DOMPurify
- ✅ Rate limiting (3 pings/day, 5 min between pings)
- ✅ Content moderation system
- ✅ Server-side validation

## 📚 Documentation

- **[START-HERE.md](START-HERE.md)** - Complete production guide
- **[SETUP-AUTO-DEPLOY.md](SETUP-AUTO-DEPLOY.md)** - GitHub Actions CI/CD setup

## 🛠️ Development

### Local Testing
```bash
firebase emulators:start
```
Then visit http://localhost:5000

### Deploy to Production
```bash
firebase deploy
```

### Deploy Only Specific Parts
```bash
firebase deploy --only hosting   # Just the web app
firebase deploy --only functions # Just Cloud Functions
firebase deploy --only firestore:rules  # Just Firestore rules
```

## ⚡ Performance

- Mobile: Loads max 100 pings (prevents crashes)
- Desktop: Loads max 200 pings
- Memory monitoring & auto-cleanup
- Debounced map updates

## 📱 Features

- 🗺️ Real-time location-based pings
- 👥 Friend system (private pings)
- 💬 Comments & reactions
- 🏆 Ping of the Week competition
- ⏰ 24-hour auto-expiration
- 📸 Image/video support
- 🎨 Custom ping markers (subscribers)

## 🔧 Troubleshooting

**"Firebase config not found" error:**
- Make sure you created `config.js` from `config.example.js`
- Check that `config.js` is in the root directory

**403 Forbidden errors:**
- Set Cloud Functions IAM permissions (see START-HERE.md)

**Permission denied in Firestore:**
- Deploy security rules: `firebase deploy --only firestore:rules`

## 📄 License

[Your License Here]

## 🤝 Contributing

This is a public repository with private configuration. To contribute:
1. Fork the repo
2. Create your own `config.js` with your Firebase project
3. Make your changes
4. Submit a pull request

---

**Status:** ✅ Production Ready


