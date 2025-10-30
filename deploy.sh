#!/bin/bash

# Deployment script for Had to Be There
# This script safely deploys your app to Firebase

set -e  # Exit on error

echo "🚀 Starting deployment for Had to Be There"
echo "=========================================="

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Installing..."
    npm install -g firebase-tools
fi

# Check if logged in
if ! firebase projects:list &> /dev/null; then
    echo "🔐 Please log in to Firebase:"
    firebase login
fi

# Ensure we're in the right project
echo "📋 Current Firebase project:"
firebase use

read -p "Is this the correct project? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled. Run 'firebase use <project-id>' first."
    exit 1
fi

# Install function dependencies
echo "📦 Installing Cloud Function dependencies..."
cd functions
npm install
cd ..

# Test locally first (optional)
read -p "🧪 Run local tests with emulator? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting Firebase emulators..."
    echo "⚠️  Press Ctrl+C when done testing"
    firebase emulators:start
fi

# Deploy security rules FIRST (most important)
echo "🔒 Deploying security rules..."
firebase deploy --only firestore:rules,storage

echo "✅ Security rules deployed!"
echo "⏳ Waiting 5 seconds for rules to propagate..."
sleep 5

# Deploy Cloud Functions
echo "⚡ Deploying Cloud Functions..."
firebase deploy --only functions

echo "✅ Cloud Functions deployed!"

# Deploy Firestore indexes
echo "📊 Deploying Firestore indexes..."
firebase deploy --only firestore:indexes

# Deploy hosting last
echo "🌐 Deploying website..."
firebase deploy --only hosting

echo ""
echo "=========================================="
echo "🎉 Deployment complete!"
echo ""
echo "Your app is live at:"
firebase hosting:channel:list --json | grep -o '"url":"[^"]*' | cut -d'"' -f4 | head -1 || echo "Check Firebase Console for URL"
echo ""
echo "📝 Next steps:"
echo "1. Test your live app thoroughly"
echo "2. Monitor Cloud Function logs: firebase functions:log"
echo "3. Check for errors in Firebase Console"
echo "4. Set up monitoring alerts"
echo ""
echo "✅ Deployment successful!"

