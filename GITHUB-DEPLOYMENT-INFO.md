# 🔗 GitHub Deployment Links

## 🚀 How It Works

Your GitHub repository is now connected to Firebase! Here's what happens:

### Production (Main Branch)
- **When**: Every push to `main` branch
- **Link**: https://had-to-be-there-18cd7.web.app
- **What**: Full deployment (Hosting + Functions + Rules)

### Preview Channels (Pull Requests)
- **When**: Every pull request to `main`
- **Link**: `https://had-to-be-there-18cd7--pr-[NUMBER].web.app`
- **What**: Preview deployment (Hosting only, no functions)
- **Expires**: After 7 days

---

## 📋 Links

| Type | URL | When Active |
|------|-----|-------------|
| **Production** | https://had-to-be-there-18cd7.web.app | Always (from `main`) |
| **GitHub Actions** | https://github.com/HadToBeThere/app_code/actions | Shows deployment status |
| **Firebase Console** | https://console.firebase.google.com/project/had-to-be-there-18cd7/hosting | Manage deployments |

---

## ✅ Setup Checklist

1. **Firebase Token** (One-time setup):
   ```bash
   firebase login:ci
   ```
   Then add the token to GitHub:
   - Go to: https://github.com/HadToBeThere/app_code/settings/secrets/actions
   - Add secret: `FIREBASE_TOKEN` with the token value

2. **Test It**:
   - Make a small change
   - Push to `main`: `git push origin main`
   - Check: https://github.com/HadToBeThere/app_code/actions

---

## 🔍 How to View Preview Links

1. Create a pull request
2. Check the PR comments - the bot will post the preview URL
3. Or check GitHub Actions logs

**Preview URL Format:**
```
https://had-to-be-there-18cd7--pr-123.web.app
```
(Where `123` is the PR number)

---

## 🎯 Current Status

- ✅ Workflow created: `.github/workflows/deploy.yml`
- ✅ Connected to: `had-to-be-there-18cd7` Firebase project
- ⏳ **Action Required**: Add `FIREBASE_TOKEN` to GitHub secrets

---

## 💡 Tips

**To test without deploying to production:**
- Create a branch
- Make changes
- Create a pull request
- Preview link will be created automatically

**To manually trigger deployment:**
- Go to: https://github.com/HadToBeThere/app_code/actions
- Click "Deploy to Firebase"
- Click "Run workflow"

