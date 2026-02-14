/**
 * Client-side wrapper for secure Cloud Functions
 * All database writes must go through these functions for security
 */

// Initialize Firebase Functions (lazy-loaded to avoid initialization errors)
let functions = null;

function getFunctions() {
  if (!functions) {
    try {
      // Initialize with explicit region
      functions = firebase.app().functions('us-central1');
      // For local development, uncomment this line:
      // functions.useFunctionsEmulator('http://localhost:5001');
    } catch (error) {
      console.error('❌ Error initializing Firebase Functions:', error);
      throw error;
    }
  }
  return functions;
}

/**
 * Create a new ping (server-side validation)
 */
async function createPingSecure(data) {
  try {
    const functionsInstance = getFunctions();
    const createPing = functionsInstance.httpsCallable('createPing');
    const result = await createPing({
      text: data.text,
      lat: data.lat,
      lon: data.lon,
      visibility: data.visibility || 'public',
      imageUrl: data.imageUrl || null,
      videoUrl: data.videoUrl || null,
      customPinUrl: data.customPinUrl || null,
      ttlHours: data.ttlHours || 24
    });
    
    return result.data;
  } catch (error) {
    console.error('❌ Error creating ping:', error);
    
    // Extract user-friendly error message
    if (error.code === 'unauthenticated') {
      throw new Error('Please sign in to create pings');
    } else if (error.code === 'permission-denied') {
      throw new Error('You do not have permission to create pings');
    } else if (error.code === 'resource-exhausted') {
      throw new Error(error.message || 'Rate limit reached');
    } else if (error.code === 'invalid-argument') {
      throw new Error(error.message || 'Invalid ping data');
    } else {
      throw new Error(error.message || 'Failed to create ping');
    }
  }
}

/**
 * Add a comment to a ping (server-side validation)
 */
async function addCommentSecure(pingId, text) {
  try {
    const addComment = getFunctions().httpsCallable('addComment');
    const result = await addComment({ pingId, text });
    return result.data;
  } catch (error) {
    console.error('❌ Error adding comment:', error);
    
    if (error.code === 'permission-denied') {
      throw new Error('Cannot comment on this ping');
    } else if (error.code === 'not-found') {
      throw new Error('Ping not found');
    } else {
      throw new Error(error.message || 'Failed to add comment');
    }
  }
}

/**
 * Toggle reaction on a ping (server-side)
 */
async function toggleReactionSecure(pingId, emoji) {
  try {
    const toggleReaction = getFunctions().httpsCallable('toggleReaction');
    const result = await toggleReaction({ pingId, emoji });
    return result.data;
  } catch (error) {
    console.error('❌ Error toggling reaction:', error);
    throw new Error(error.message || 'Failed to toggle reaction');
  }
}

/**
 * Update username (atomic operation)
 */
async function updateUsernameSecure(username) {
  try {
    const updateUsername = getFunctions().httpsCallable('updateUsername');
    const result = await updateUsername({ username });
    return result.data;
  } catch (error) {
    console.error('❌ Error updating username:', error);
    
    if (error.code === 'already-exists') {
      throw new Error('Username is already taken');
    } else if (error.code === 'resource-exhausted') {
      throw new Error(error.message || 'Please wait before changing username again');
    } else {
      throw new Error(error.message || 'Failed to update username');
    }
  }
}

/**
 * Send friend request
 */
async function sendFriendRequestSecure(identifier) {
  try {
    const sendFriendRequest = getFunctions().httpsCallable('sendFriendRequest');
    const result = await sendFriendRequest({ identifier });
    return result.data;
  } catch (error) {
    console.error('❌ Error sending friend request:', error);
    
    if (error.code === 'not-found') {
      throw new Error('User not found');
    } else if (error.code === 'already-exists') {
      throw new Error('Friend request already sent');
    } else {
      throw new Error(error.message || 'Failed to send friend request');
    }
  }
}

/**
 * Accept friend request
 */
async function acceptFriendRequestSecure(requestId) {
  try {
    const acceptFriendRequest = getFunctions().httpsCallable('acceptFriendRequest');
    const result = await acceptFriendRequest({ requestId });
    return result.data;
  } catch (error) {
    console.error('❌ Error accepting friend request:', error);
    throw new Error(error.message || 'Failed to accept friend request');
  }
}

/**
 * Reject friend request
 */
async function rejectFriendRequestSecure(requestId) {
  try {
    const rejectFriendRequest = getFunctions().httpsCallable('rejectFriendRequest');
    const result = await rejectFriendRequest({ requestId });
    return result.data;
  } catch (error) {
    console.error('❌ Error rejecting friend request:', error);
    throw new Error(error.message || 'Failed to reject friend request');
  }
}

/**
 * Remove friend (atomic - removes from both users)
 */
/**
 * Cancel outgoing friend request
 */
async function cancelFriendRequestSecure(requestId) {
  try {
    const cancelFriendRequest = getFunctions().httpsCallable('cancelFriendRequest');
    const result = await cancelFriendRequest({ requestId });
    return result.data;
  } catch (error) {
    console.error('Error cancelling friend request:', error);
    throw new Error(error.message || 'Failed to cancel request');
  }
}

/**
 * Gift points to a friend
 */
async function giftPointsSecure(data) {
  try {
    const giftPoints = getFunctions().httpsCallable('giftPoints');
    const result = await giftPoints(data);
    return result.data;
  } catch (error) {
    console.error('Error gifting points:', error);
    throw new Error(error.message || 'Failed to gift points');
  }
}

async function removeFriendSecure(friendUid) {
  try {
    const removeFriend = getFunctions().httpsCallable('removeFriend');
    const result = await removeFriend({ friendUid });
    return result.data;
  } catch (error) {
    console.error('Error removing friend:', error);
    throw new Error(error.message || 'Failed to remove friend');
  }
}


