# Automatic Deployment Setup

## ✅ What's Done

GitHub Actions workflow created! It will automatically deploy to Firebase when you push to `main`.

## 🔑 Setup Required: Add Firebase Token

You need to add a Firebase token to GitHub secrets:

### Step 1: Get Firebase Token

Run this in your terminal:
```bash
firebase login:ci
```

This will open a browser to authenticate. After successful login, you'll get a token that looks like:
```
1//aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890
```

### Step 2: Add Token to GitHub Secrets

1. Go to your GitHub repository: https://github.com/HadToBeThere/app_code
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Name: `FIREBASE_TOKEN`
5. Value: Paste the token from Step 1
6. Click **Add secret**

### Step 3: Test It

After adding the secret, push any change:
```bash
git add .github/workflows/deploy.yml
git commit -m "Add automatic deployment"
git push origin main
```

Then check: https://github.com/HadToBeThere/app_code/actions

You should see a workflow running that deploys to Firebase!

---

## 🎯 How It Works

- **Every push to `main`** → Automatically deploys to Firebase
- **Deploys everything**: Hosting, Functions, Firestore rules, Storage rules
- **Takes ~2-3 minutes** per deployment

## 🛑 Want to Skip Deployment?

If you push to `main` but don't want to deploy (e.g., WIP commits):
- Push to a different branch first
- Or comment out the workflow temporarily

## 📊 View Deployment Status

- GitHub Actions: https://github.com/HadToBeThere/app_code/actions
- Firebase Console: https://console.firebase.google.com/project/had-to-be-there-18cd7/hosting

---

**Note:** The first deployment after setup might take longer as it installs dependencies.

