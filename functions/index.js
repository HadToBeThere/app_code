const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

const db = admin.firestore();
const storage = admin.storage();
const FieldValue = admin.firestore.FieldValue;
const Timestamp = admin.firestore.Timestamp;

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
  MAX_PINGS_PER_DAY: 3,
  MIN_MILLIS_BETWEEN_PINGS: 5 * 60 * 1000, // 5 minutes
  FENCE_CENTER: { lat: 45.5017, lng: -73.5673 }, // Montreal
  RADIUS_M: 5000,
  MAX_COMMENT_LENGTH: 200,
  MAX_PING_TEXT_LENGTH: 140,
  AUTO_HIDE_REPORT_THRESHOLD: 3,
  PING_EXPIRY_HOURS: 24
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Calculate distance between two points in meters (Haversine formula)
 */
function getDistance(point1, point2) {
  const R = 6371e3; // Earth radius in meters
  const φ1 = point1.lat * Math.PI / 180;
  const φ2 = point2.lat * Math.PI / 180;
  const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
  const Δλ = (point2.lng - point1.lon) * Math.PI / 180;
  
  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  
  return R * c;
}

/**
 * Check if text contains potential real names
 */
function hasRealNames(text) {
  // Basic heuristic: two capitalized words in a row (e.g., "John Smith")
  return /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(text);
}

/**
 * Get today's date string in YYYY-MM-DD format (Montreal timezone)
 */
function getTodayString() {
  const now = new Date();
  // Simple UTC date - in production, consider timezone handling
  return now.toISOString().split('T')[0];
}

/**
 * Check if user is subscriber
 */
async function isSubscriber(uid) {
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) return false;
    const data = userDoc.data();
    return data.subscriptionStatus === 'active' || data.isUnlimited === true;
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
}

/**
 * Send notification to user
 */
async function sendNotification(toUid, type, data) {
  try {
    await db.collection('notifications').add({
      toUid,
      type,
      ...data,
      read: false,
      createdAt: FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}

// ============================================
// CALLABLE FUNCTIONS (Client-side calls)
// ============================================

/**
 * Create a new ping with server-side validation
 */
exports.createPing = functions.https.onCall(async (data, context) => {
  // 1. Authentication check
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in to create ping');
  }
  
  if (context.auth.token.firebase.sign_in_provider === 'anonymous') {
    throw new functions.https.HttpsError('permission-denied', 'Anonymous users cannot create pings');
  }
  
  const uid = context.auth.uid;
  
  try {
    // 2. Get user data
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }
    
    const userData = userDoc.data();
    const isSub = await isSubscriber(uid);
    
    // 3. Rate limiting - Check last ping time
    const lastPingAt = userData.lastPingAt?.toMillis ? userData.lastPingAt.toMillis() : 0;
    const timeSinceLastPing = Date.now() - lastPingAt;
    
    if (timeSinceLastPing < CONFIG.MIN_MILLIS_BETWEEN_PINGS) {
      const minutesLeft = Math.ceil((CONFIG.MIN_MILLIS_BETWEEN_PINGS - timeSinceLastPing) / 60000);
      throw new functions.https.HttpsError(
        'resource-exhausted', 
        `Please wait ${minutesLeft} more minute(s) before posting again`
      );
    }
    
    // 4. Daily quota check (skip for subscribers)
    if (!isSub) {
      const today = getTodayString();
      const quotaDoc = await db.collection('users').doc(uid).collection('quota').doc(today).get();
      const used = quotaDoc.exists ? (quotaDoc.data().used || 0) : 0;
      
      if (used >= CONFIG.MAX_PINGS_PER_DAY) {
        throw new functions.https.HttpsError('resource-exhausted', 'Daily ping limit reached');
      }
    }
    
    // 5. Input validation
    const { text, lat, lon, visibility, imageUrl, videoUrl, customPinUrl } = data;
    
    // Validate text
    if (!text || typeof text !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Text is required');
    }
    
    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      throw new functions.https.HttpsError('invalid-argument', 'Text cannot be empty');
    }
    
    if (trimmedText.length > CONFIG.MAX_PING_TEXT_LENGTH) {
      throw new functions.https.HttpsError('invalid-argument', 'Text too long');
    }
    
    // Check for real names
    if (hasRealNames(trimmedText)) {
      throw new functions.https.HttpsError('invalid-argument', 'Please do not use real names');
    }
    
    // Validate location
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid location coordinates');
    }
    
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid coordinate values');
    }
    
    // 6. Geofencing - ensure ping is within allowed area
    const distance = getDistance({ lat, lon }, CONFIG.FENCE_CENTER);
    if (distance > CONFIG.RADIUS_M) {
      throw new functions.https.HttpsError('invalid-argument', 'Location is outside the allowed area');
    }
    
    // 7. Validate visibility
    const validVisibility = ['public', 'private'];
    const finalVisibility = validVisibility.includes(visibility) ? visibility : 'public';
    
    // 8. Create ping document
    const pingRef = db.collection('pings').doc();
    const now = FieldValue.serverTimestamp();
    
    const pingData = {
      authorId: uid, // Use authorId for compatibility with existing app code
      text: trimmedText,
      lat,
      lon,
      visibility: finalVisibility,
      imageUrl: imageUrl || null,
      videoUrl: videoUrl || null,
      customPinUrl: (isSub && customPinUrl) ? customPinUrl : null,
      createdAt: now,
      likes: 0,
      dislikes: 0,
      flags: 0,
      status: 'live',
      authorIsSubscriber: isSub,
      reactions: {},
      commentCount: 0,
      firstNetAt: {}, // milestones map
      hidden: false
    };
    
    await pingRef.set(pingData);
    
    // 9. Update user quota and stats
    const today = getTodayString();
    const quotaRef = db.collection('users').doc(uid).collection('quota').doc(today);
    
    await quotaRef.set({
      used: FieldValue.increment(1),
      lastPingAt: now
    }, { merge: true });
    
    await userDoc.ref.update({
      lastPingAt: now,
      totalPings: FieldValue.increment(1)
    });
    
    console.log(`✅ Ping created: ${pingRef.id} by user ${uid}`);
    
    return { 
      success: true, 
      pingId: pingRef.id,
      message: 'Ping created successfully'
    };
    
  } catch (error) {
    console.error('Error creating ping:', error);
    
    // Re-throw HttpsErrors
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    // Wrap other errors
    throw new functions.https.HttpsError('internal', 'Failed to create ping');
  }
});

/**
 * Add a comment to a ping
 */
exports.addComment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }
  
  const uid = context.auth.uid;
  const { pingId, text } = data;
  
  try {
    // Validate input
    if (!pingId || !text) {
      throw new functions.https.HttpsError('invalid-argument', 'pingId and text required');
    }
    
    const trimmedText = text.trim();
    if (trimmedText.length === 0 || trimmedText.length > CONFIG.MAX_COMMENT_LENGTH) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid comment length');
    }
    
    // Check ping exists and is accessible
    const pingDoc = await db.collection('pings').doc(pingId).get();
    if (!pingDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Ping not found');
    }
    
    const pingData = pingDoc.data();
    
    // Check if ping is hidden
    if (pingData.hidden) {
      throw new functions.https.HttpsError('permission-denied', 'Cannot comment on hidden ping');
    }
    
    // Check visibility permissions
    if (pingData.visibility === 'private' && pingData.authorId !== uid) {
      // Check if friends
      const friendDoc = await db.collection('users').doc(uid).collection('friends').doc(pingData.authorId).get();
      if (!friendDoc.exists) {
        throw new functions.https.HttpsError('permission-denied', 'Cannot access this ping');
      }
    }
    
    // Create comment
    const commentRef = db.collection('pings').doc(pingId).collection('comments').doc();
    await commentRef.set({
      authorId: uid, // Use authorId for compatibility
      text: trimmedText,
      createdAt: FieldValue.serverTimestamp()
    });
    
    // Increment comment count
    await pingDoc.ref.update({
      commentCount: FieldValue.increment(1)
    });
    
    // Send notification to ping author (if not commenting on own ping)
    if (pingData.authorId && pingData.authorId !== uid) {
      await sendNotification(pingData.authorId, 'comment', {
        fromUid: uid,
        pingId,
        commentText: trimmedText
      });
    }
    
    return { success: true, commentId: commentRef.id };
    
  } catch (error) {
    console.error('Error adding comment:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to add comment');
  }
});

/**
 * Toggle reaction on a ping
 */
exports.toggleReaction = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }
  
  const uid = context.auth.uid;
  const { pingId, emoji } = data;
  
  try {
    if (!pingId || !emoji) {
      throw new functions.https.HttpsError('invalid-argument', 'pingId and emoji required');
    }
    
    // Validate emoji (basic check)
    const validEmojis = ['👍', '❤️', '😂', '🔥', '👀'];
    if (!validEmojis.includes(emoji)) {
      throw new functions.https.HttpsError('invalid-argument', 'Invalid emoji');
    }
    
    const pingRef = db.collection('pings').doc(pingId);
    const pingDoc = await pingRef.get();
    
    if (!pingDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Ping not found');
    }
    
    // Use transaction to safely toggle reaction
    await db.runTransaction(async (transaction) => {
      const freshDoc = await transaction.get(pingRef);
      const reactions = freshDoc.data().reactions || {};
      const userReactions = reactions[uid] || [];
      
      let newUserReactions;
      if (userReactions.includes(emoji)) {
        // Remove reaction
        newUserReactions = userReactions.filter(e => e !== emoji);
      } else {
        // Add reaction
        newUserReactions = [...userReactions, emoji];
      }
      
      const newReactions = { ...reactions, [uid]: newUserReactions };
      transaction.update(pingRef, { reactions: newReactions });
    });
    
    return { success: true };
    
  } catch (error) {
    console.error('Error toggling reaction:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to toggle reaction');
  }
});

/**
 * Update username (with atomic handle management)
 */
exports.updateUsername = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }
  
  const uid = context.auth.uid;
  const { username } = data;
  
  try {
    // Validate username
    if (!username || typeof username !== 'string') {
      throw new functions.https.HttpsError('invalid-argument', 'Username required');
    }
    
    const cleanUsername = username.toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 24);
    
    if (cleanUsername.length < 3) {
      throw new functions.https.HttpsError('invalid-argument', 'Username too short (min 3 characters)');
    }
    
    if (cleanUsername === 'friends' || cleanUsername === 'admin' || cleanUsername === 'system') {
      throw new functions.https.HttpsError('invalid-argument', 'Username is reserved');
    }
    
    // Get current user data
    const userRef = db.collection('users').doc(uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }
    
    const userData = userDoc.data();
    const oldUsername = userData.handle || null;
    
    // Check if it's the same username
    if (oldUsername === cleanUsername) {
      return { success: true, message: 'Username unchanged' };
    }
    
    // Check cooldown (24 hours)
    const lastChange = userData.lastHandleChangeAt?.toMillis ? userData.lastHandleChangeAt.toMillis() : 0;
    const cooldownPeriod = 24 * 60 * 60 * 1000; // 24 hours
    
    if (Date.now() - lastChange < cooldownPeriod) {
      const hoursLeft = Math.ceil((cooldownPeriod - (Date.now() - lastChange)) / (60 * 60 * 1000));
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `You can change your username again in ${hoursLeft} hours`
      );
    }
    
    // Atomic transaction to update username
    await db.runTransaction(async (transaction) => {
      const handleRef = db.collection('handles').doc(cleanUsername);
      const handleDoc = await transaction.get(handleRef);
      
      // Check if username is taken by someone else
      if (handleDoc.exists && handleDoc.data().uid !== uid) {
        throw new functions.https.HttpsError('already-exists', 'Username is taken');
      }
      
      // Delete old handle
      if (oldUsername) {
        const oldHandleRef = db.collection('handles').doc(oldUsername);
        transaction.delete(oldHandleRef);
      }
      
      // Set new handle
      transaction.set(handleRef, {
        uid,
        updatedAt: FieldValue.serverTimestamp()
      });
      
      // Update user document
      transaction.update(userRef, {
        handle: cleanUsername,
        handleLC: cleanUsername,
        lastHandleChangeAt: FieldValue.serverTimestamp()
      });
    });
    
    return { success: true, username: cleanUsername };
    
  } catch (error) {
    console.error('Error updating username:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to update username');
  }
});

/**
 * Send friend request
 */
exports.sendFriendRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }
  
  const fromUid = context.auth.uid;
  const { identifier } = data; // Can be username or email
  
  try {
    if (!identifier) {
      throw new functions.https.HttpsError('invalid-argument', 'Username or email required');
    }
    
    // Find target user
    let toUid = null;
    
    // Check if it's a username
    if (identifier.startsWith('@')) {
      const username = identifier.slice(1).toLowerCase();
      const handleDoc = await db.collection('handles').doc(username).get();
      if (handleDoc.exists) {
        toUid = handleDoc.data().uid;
      }
    } else {
      // Try as email
      const usersQuery = await db.collection('users').where('email', '==', identifier).limit(1).get();
      if (!usersQuery.empty) {
        toUid = usersQuery.docs[0].id;
      }
    }
    
    if (!toUid) {
      throw new functions.https.HttpsError('not-found', 'User not found');
    }
    
    if (toUid === fromUid) {
      throw new functions.https.HttpsError('invalid-argument', 'Cannot send friend request to yourself');
    }
    
    // Check if already friends
    const friendDoc = await db.collection('users').doc(fromUid).collection('friends').doc(toUid).get();
    if (friendDoc.exists) {
      throw new functions.https.HttpsError('already-exists', 'Already friends');
    }
    
    // Check if request already exists
    const existingRequest = await db.collection('friendRequests')
      .where('from', '==', fromUid)
      .where('to', '==', toUid)
      .limit(1)
      .get();
    
    if (!existingRequest.empty) {
      throw new functions.https.HttpsError('already-exists', 'Friend request already sent');
    }
    
    // Create friend request
    await db.collection('friendRequests').add({
      from: fromUid,
      to: toUid,
      status: 'pending',
      createdAt: FieldValue.serverTimestamp()
    });
    
    // Send notification
    await sendNotification(toUid, 'friendRequest', { fromUid });
    
    return { success: true };
    
  } catch (error) {
    console.error('Error sending friend request:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to send friend request');
  }
});

/**
 * Accept friend request
 */
exports.acceptFriendRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }
  
  const uid = context.auth.uid;
  const { requestId } = data;
  
  try {
    const requestRef = db.collection('friendRequests').doc(requestId);
    const requestDoc = await requestRef.get();
    
    if (!requestDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Request not found');
    }
    
    const requestData = requestDoc.data();
    
    if (requestData.to !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'Not your request');
    }
    
    const fromUid = requestData.from;
    
    // Add friends in both directions
    await db.collection('users').doc(uid).collection('friends').doc(fromUid).set({
      addedAt: FieldValue.serverTimestamp()
    });
    
    await db.collection('users').doc(fromUid).collection('friends').doc(uid).set({
      addedAt: FieldValue.serverTimestamp()
    });
    
    // Delete request
    await requestRef.delete();
    
    // Send notification
    await sendNotification(fromUid, 'friendAccepted', { byUid: uid });
    
    return { success: true };
    
  } catch (error) {
    console.error('Error accepting friend request:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to accept request');
  }
});

/**
 * Reject friend request
 */
exports.rejectFriendRequest = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be signed in');
  }
  
  const uid = context.auth.uid;
  const { requestId } = data;
  
  try {
    const requestRef = db.collection('friendRequests').doc(requestId);
    const requestDoc = await requestRef.get();
    
    if (!requestDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Request not found');
    }
    
    const requestData = requestDoc.data();
    
    if (requestData.to !== uid) {
      throw new functions.https.HttpsError('permission-denied', 'Not your request');
    }
    
    await requestRef.delete();
    
    return { success: true };
    
  } catch (error) {
    console.error('Error rejecting friend request:', error);
    if (error instanceof functions.https.HttpsError) throw error;
    throw new functions.https.HttpsError('internal', 'Failed to reject request');
  }
});

// ============================================
// BACKGROUND FUNCTIONS (Triggers)
// ============================================

/**
 * Auto-moderate content based on reports
 */
exports.processReport = functions.firestore
  .document('reports/{reportId}')
  .onCreate(async (snap, context) => {
    const report = snap.data();
    const { pingId, reportedBy, reason } = report;
    
    try {
      console.log(`📋 Processing report for ping ${pingId} by user ${reportedBy}`);
      
      // Count total reports for this ping
      const reportsQuery = await db.collection('reports')
        .where('pingId', '==', pingId)
        .get();
      
      const reportCount = reportsQuery.size;
      
      console.log(`Total reports for ping ${pingId}: ${reportCount}`);
      
      // Auto-hide if threshold reached
      if (reportCount >= CONFIG.AUTO_HIDE_REPORT_THRESHOLD) {
        const pingRef = db.collection('pings').doc(pingId);
        await pingRef.update({
          hidden: true,
          hiddenAt: FieldValue.serverTimestamp(),
          hiddenReason: 'multiple_reports',
          reportCount
        });
        
        console.log(`🚫 Auto-hid ping ${pingId} due to ${reportCount} reports`);
        
        // TODO: Send notification to admin/moderators
      }
      
      return null;
    } catch (error) {
      console.error('Error processing report:', error);
      return null;
    }
  });

/**
 * Clean up expired pings (24 hours old)
 */
exports.cleanupExpiredPings = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    try {
      const cutoffTime = new Date(Date.now() - CONFIG.PING_EXPIRY_HOURS * 60 * 60 * 1000);
      const cutoffTimestamp = Timestamp.fromDate(cutoffTime);
      
      console.log(`🧹 Cleaning up pings older than ${cutoffTime.toISOString()}`);
      
      // Query expired pings
      const expiredQuery = await db.collection('pings')
        .where('createdAt', '<', cutoffTimestamp)
        .limit(500) // Batch size
        .get();
      
      if (expiredQuery.empty) {
        console.log('No expired pings to clean up');
        return null;
      }
      
      // Delete in batch
      const batch = db.batch();
      let deleteCount = 0;
      
      for (const doc of expiredQuery.docs) {
        batch.delete(doc.ref);
        deleteCount++;
        
        // TODO: Also delete associated media from Storage
        const pingData = doc.data();
        if (pingData.imageUrl || pingData.videoUrl) {
          // Schedule storage cleanup
          // This would need a separate function to handle storage deletion
        }
      }
      
      await batch.commit();
      
      console.log(`✅ Deleted ${deleteCount} expired pings`);
      
      return null;
    } catch (error) {
      console.error('Error cleaning up expired pings:', error);
      return null;
    }
  });

/**
 * Update Ping of the Week
 */
exports.updatePingOfTheWeek = functions.pubsub
  .schedule('every 1 hours')
  .onRun(async (context) => {
    try {
      console.log('🏆 Updating Ping of the Week...');
      
      // Get current week identifier
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay()); // Start of week (Sunday)
      weekStart.setHours(0, 0, 0, 0);
      
      const weekId = weekStart.toISOString().split('T')[0];
      
      // Find ping with most likes this week
      const weekStartTimestamp = Timestamp.fromDate(weekStart);
      
      const pingsQuery = await db.collection('pings')
        .where('createdAt', '>=', weekStartTimestamp)
        .where('visibility', '==', 'public')
        .where('hidden', '==', false)
        .limit(100)
        .get();
      
      if (pingsQuery.empty) {
        console.log('No eligible pings this week');
        return null;
      }
      
      // Calculate scores (likes - dislikes, or custom scoring)
      let topPing = null;
      let topScore = -Infinity;
      
      for (const doc of pingsQuery.docs) {
        const pingData = doc.data();
        const reactions = pingData.reactions || {};
        
        // Count likes
        let score = 0;
        Object.values(reactions).forEach(userReactions => {
          score += userReactions.length; // Simple count of all reactions
        });
        
        if (score > topScore) {
          topScore = score;
          topPing = { id: doc.id, ...pingData, score };
        }
      }
      
      if (topPing && topScore > 0) {
        // Update POTW document
        await db.collection('potw').doc('current').set({
          pingId: topPing.id,
          weekId,
          score: topScore,
          updatedAt: FieldValue.serverTimestamp()
        });
        
        console.log(`✅ Updated POTW: ${topPing.id} with score ${topScore}`);
      }
      
      return null;
    } catch (error) {
      console.error('Error updating POTW:', error);
      return null;
    }
  });

/**
 * Log user creation for analytics
 */
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
  try {
    console.log(`👤 New user created: ${user.uid}`);
    
    // Create user document if it doesn't exist
    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();
    
    if (!userDoc.exists) {
      await userRef.set({
        uid: user.uid,
        email: user.email,
        createdAt: FieldValue.serverTimestamp(),
        totalPings: 0,
        pp: 0 // Ping Points
      });
    }
    
    return null;
  } catch (error) {
    console.error('Error processing user creation:', error);
    return null;
  }
});

/**
 * Cleanup on user deletion
 */
exports.onUserDeleted = functions.auth.user().onDelete(async (user) => {
  try {
    console.log(`🗑️ User deleted: ${user.uid}`);
    
    // Delete user data (GDPR compliance)
    const batch = db.batch();
    
    // Delete user document
    batch.delete(db.collection('users').doc(user.uid));
    
    // Delete user's pings
    const pingsQuery = await db.collection('pings').where('uid', '==', user.uid).get();
    pingsQuery.docs.forEach(doc => batch.delete(doc.ref));
    
    // Delete notifications
    const notifsQuery = await db.collection('notifications').where('toUid', '==', user.uid).get();
    notifsQuery.docs.forEach(doc => batch.delete(doc.ref));
    
    await batch.commit();
    
    console.log(`✅ Cleaned up data for user ${user.uid}`);
    
    return null;
  } catch (error) {
    console.error('Error cleaning up user data:', error);
    return null;
  }
});

console.log('🚀 Cloud Functions loaded successfully');

