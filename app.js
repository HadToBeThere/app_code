window.addEventListener('load', async () => {
  /* --------- Splash --------- */
  const splash = document.getElementById('splash');
  const startGlobe = document.getElementById('startGlobe');
  // Splash: block all interactions until PRESS START
  startGlobe.addEventListener('click', () => { splash.style.opacity='0'; setTimeout(()=>splash.style.display='none',450); });

  /* --------- Config --------- */
  const DEFAULT_CENTER = [45.5048, -73.5772];
  const RADIUS_M = 1609; // 1 mile
  const MAX_PINGS_PER_DAY = 3;
  const MIN_MILLIS_BETWEEN_PINGS = 5*60*1000; // 5 minutes
  const LIVE_WINDOW_MS = 24*3600*1000;
  // Dev/test: unlimited ping whitelist by email
  const UNLIMITED_EMAILS = new Set(['tobias.dicker@mail.mcgill.ca']);

  // Size curve constants
  const BASE_RADIUS = 10;                 // px at 0 net likes
  const MIN_RADIUS  = 6;                  // hard minimum px
  const MAX_RADIUS  = 36;                 // hard cap for normal pins
  const POTW_CAP    = 42;                 // slightly bigger cap for PotW display
  const L_LINEAR    = 50;                 // linear up to this net-like count
  const A_SLOPE     = 0.30;               // px per like (0..50)
  const B_SQRT      = 0.15;               // px * sqrt(likes-50) after 50

  const TZ = 'America/Toronto'; // Montreal time IANA
  const ONE_DAY = 24*3600*1000;

  /* --------- Firebase --------- */
  const firebaseConfig = {
    apiKey: "AIzaSyBpxljomYywVNB_v126yM1FFzaS_n_PaDA",
    authDomain: "had-to-be-there-18cd7.firebaseapp.com",
    projectId: "had-to-be-there-18cd7",
    storageBucket: "had-to-be-there-18cd7.appspot.com",
    messagingSenderId: "162997813310",
    appId: "1:162997813310:web:e27cf250f1f516d759916f",
    measurementId: "G-H4X4ENJ3FJ"
  };
  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db   = firebase.firestore();
  // Ensure session persists across reloads
  try{ await auth.setPersistence(firebase.auth.Auth.Persistence.NONE); }catch(e){ console.warn('persistence', e); }

  /* --------- Helpers --------- */
  const $ = s=>document.querySelector(s);
  const $$ = s=>document.querySelectorAll(s);
  const toastEl = $('#toast');
  const showToast=(msg)=>{ toastEl.textContent=msg; toastEl.classList.add('show'); setTimeout(()=>toastEl.classList.remove('show'),6000); };
  function isUnlimited(){
    try{
      const e = (auth.currentUser && auth.currentUser.email || '').toLowerCase();
      return !!(e && UNLIMITED_EMAILS.has(e));
    }catch(_){ return false; }
  }
  function anyModalOpen(){ return document.querySelector('.modal.open') || document.querySelector('.sheet.open'); }
  function applyModalOpenClass(){ 
    try{ 
      const hasModal = anyModalOpen();
      if(hasModal){ 
        document.body.classList.add('modal-open'); 
      } else { 
        document.body.classList.remove('modal-open'); 
      }
      // Don't disable buttons - they should always be clickable
      const profileWidget = document.getElementById('profileWidget');
      const bellBtn = document.getElementById('bellBtn');
      if(profileWidget) profileWidget.style.pointerEvents = 'auto';
      if(bellBtn) bellBtn.style.pointerEvents = 'auto';
    }catch(_){ } 
  }
  function openModal(id){ document.getElementById(id).classList.add('open'); applyModalOpenClass(); }
  function closeModal(id){ document.getElementById(id).classList.remove('open'); applyModalOpenClass(); }

  // Unified time-ago formatter: s (<60), m (<60), h (<24), then d
  function timeAgo(input){
    try{
      let ts = input;
      if(!ts) return '0s ago';
      if(typeof ts.toDate === 'function') ts = ts.toDate().getTime();
      else if(ts instanceof Date) ts = ts.getTime();
      ts = Number(ts)||0;
      const diff = Math.max(0, Date.now() - ts);
      const secs = Math.floor(diff/1000);
      if(secs < 60) return `${secs}s ago`;
      const mins = Math.floor(secs/60);
      if(mins < 60) return `${mins}m ago`;
      const hours = Math.floor(mins/60);
      if(hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours/24);
      return `${days}d ago`;
    }catch(_){ return '0s ago'; }
  }

  function enableColorZone() {
    const pane = document.querySelector('.leaflet-pane.inner-pane');
    const hole = document.querySelector('.desat-hole');
    if (pane) pane.classList.remove('gray-all');   // stop full-gray
    if (hole) hole.style.display = 'block';        // outside-gray only
    if (typeof updateMask === 'function') updateMask();
  }
  function disableColorZone() {
    const pane = document.querySelector('.leaflet-pane.inner-pane');
    const hole = document.querySelector('.desat-hole');
    if (pane) pane.classList.add('gray-all');      // full-gray everywhere
    if (hole) hole.style.display = 'none';         // hide mask
  }
  // Central place to refresh UI after sign-in / link / state change
async function refreshAuthUI(user){
  currentUser = user || auth.currentUser || null;

  // Update profile widget (avatar + name)
  try{
    const w = document.getElementById('profileWidget');
    const av = document.getElementById('profileAvatar');
    const nm = document.getElementById('profileName');
    const signInTop = document.getElementById('signInTop');
    if(currentUser){
      // Prefer handle for display; never auto-use Google photo
      let handle = null, uploadedPhoto = null;
      try{ const udoc = await usersRef.doc(currentUser.uid).get(); if(udoc.exists){ handle = udoc.data().handle||null; uploadedPhoto = udoc.data().photoURL || null; } }catch(_){ }
      if(nm) nm.textContent = handle ? handle : (currentUser.displayName || 'Friend');
      if(av){ 
        if(uploadedPhoto){ 
          av.style.backgroundImage = `url("${uploadedPhoto}")`; 
          av.style.backgroundSize = 'cover';
          av.style.backgroundPosition = 'center';
          av.style.backgroundRepeat = 'no-repeat';
          av.classList.add('custom-avatar');
          console.log('Updated profile avatar with:', uploadedPhoto.substring(0, 50) + '...');
        } else { 
          av.style.backgroundImage=''; 
          av.classList.remove('custom-avatar');
        } 
      }
      
      // Also update the profile modal avatar
      const profileModalAvatar = document.getElementById('ownProfileAvatar');
      if(profileModalAvatar) {
        if(uploadedPhoto) {
          profileModalAvatar.style.backgroundImage = `url("${uploadedPhoto}")`;
          profileModalAvatar.style.backgroundSize = 'cover';
          profileModalAvatar.style.backgroundPosition = 'center';
          profileModalAvatar.style.backgroundRepeat = 'no-repeat';
          profileModalAvatar.classList.add('custom-avatar');
          console.log('Updated profile modal avatar with:', uploadedPhoto.substring(0, 50) + '...');
        } else {
          profileModalAvatar.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='%23cccccc'/%3E%3Cpath d='M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8' fill='%23e6e6e6'/%3E%3C/svg%3E")`;
          profileModalAvatar.style.backgroundSize = 'cover';
          profileModalAvatar.style.backgroundPosition = 'center';
          profileModalAvatar.style.backgroundRepeat = 'no-repeat';
          profileModalAvatar.classList.remove('custom-avatar');
        }
      }
      
      // Set default silhouettes for any avatar elements that don't have custom images
      const allAvatars = document.querySelectorAll('.profile-avatar');
      allAvatars.forEach(avatar => {
        if (!avatar.classList.contains('custom-avatar')) {
          avatar.style.backgroundImage = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='8' r='4' fill='%23cccccc'/%3E%3Cpath d='M4 20c0-4.418 3.582-8 8-8s8 3.582 8 8' fill='%23e6e6e6'/%3E%3C/svg%3E")`;
          avatar.style.backgroundSize = 'cover';
          avatar.style.backgroundPosition = 'center';
          avatar.style.backgroundRepeat = 'no-repeat';
        }
      });
      if(w) w.style.display = 'flex';
      if(signInTop) signInTop.style.display = 'none';
      enableColorZone();
    }else{
      if(nm) nm.textContent = 'Sign in';
      if(av){ av.style.backgroundImage=''; }
      if(w) w.style.display = 'none';
      if(signInTop) signInTop.style.display = 'inline-flex';
      // Close any open profile/settings modals
      try{ document.getElementById('profileModal').classList.remove('open'); }catch(_){ }
    }
  }catch(_){ }

  if(currentUser){
    enableColorZone();
    try{
      if(!currentUser.isAnonymous){
        // Ensure user doc exists & has display name
        await usersRef.doc(currentUser.uid).set({
          displayName: currentUser.displayName || 'Friend'
        }, { merge:true });
        await refreshQuota(currentUser.uid);
        await refreshFriends();
        startNotifListener(currentUser.uid);
        await ensureIdentityMappings(currentUser);
startRequestsListeners(currentUser.uid);


      }else{
        $('#quotaText').textContent=`0/${MAX_PINGS_PER_DAY} pings today`;
        await refreshFriends();
      }
    }catch(e){ console.error('refreshAuthUI:', e); }

    // Do not auto-close splash; only PRESS START hides it
  } else {
    // Signed out
    myFriends = new Set();
    if(typeof notifUnsub === 'function') notifUnsub();
    notifBadge.style.display='none';
    disableColorZone();
    $('#quotaText').textContent=`0/${MAX_PINGS_PER_DAY} pings today`;
    // Reset filters to All so pings remain visible when signed out
    try{
      filterMode = 'all';
      document.querySelectorAll('#filterSeg button').forEach(b=>b.classList.remove('active'));
      const btnAll = document.querySelector('#filterSeg button[data-mode="all"]'); if(btnAll) btnAll.classList.add('active');
    }catch(_){ }
    reFilterMarkers();
  }

  // Re-evaluate PotW after any auth change (filters/me/friends may differ)
  recomputePotw().catch(console.error);
}

  // Hard UI flip helper (in case listeners/races delay refresh)
  function forceAuthUI(user){
    try{ refreshAuthUI(user); }catch(_){ }
  }


  // Week start (Monday 00:00) robust to TZ issues
  function startOfWeekMondayLocal(now = new Date()){
    const local = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const dow = local.getDay(); // 0=Sun,1=Mon,...
    const daysFromMon = (dow === 0 ? 6 : dow - 1);
    return new Date(local.getTime() - daysFromMon * ONE_DAY);
  }
  function isThisWeek(ts){
    const wStart = startOfWeekMondayLocal();
    return ts >= wStart.getTime();
  }

  /* --------- Auth UI --------- */
  const profileWidget = document.getElementById('profileWidget');
  const profileAvatar = document.getElementById('profileAvatar');
  const profileName = document.getElementById('profileName');
  // If returning from Google redirect, apply UI immediately
  // Do not auto open or redirect into sign-in; only when user clicks
  try{ const rr = await auth.getRedirectResult(); if(rr && rr.user){ /* keep splash until user presses start */ await refreshAuthUI(rr.user); } }catch(e){ console.warn('redirect result', e); }
  // Use event delegation for profile widget
  document.addEventListener('click', (e) => {
    if(e.target.id === 'profileWidget' || e.target.closest('#profileWidget')){
      e.stopPropagation(); // Prevent map click handler from firing
      const u = auth.currentUser || null;
      if(!u){ openModal('signInModal'); return; }
      // Open modal immediately; load data after
      try{ openModal('profileModal'); }catch(_){ }
      openOwnProfile().catch((e)=>{ console.error('openOwnProfile failed', e); /* keep modal open even if data load fails */ });
    }
  });
  const signInTopBtn = document.getElementById('signInTop');
  if(signInTopBtn){ signInTopBtn.onclick = ()=> openModal('signInModal'); }

  $('#closeSignIn').onclick=()=>closeModal('signInModal');

  // Central Google sign-in flow (also supports upgrading Guest)
  async function signInWithGoogle(){
    try{
      const provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const isEmbedded = (()=>{ try{ return window.self !== window.top; }catch(_){ return true; } })();
      const isHttp = (location.protocol === 'http:' || location.protocol === 'https:');
      if(!isHttp || isEmbedded){
        await auth.signInWithRedirect(provider);
        return;
      }
      let result;
      const userBefore = auth.currentUser;
      if(userBefore && userBefore.isAnonymous){
        result = await userBefore.linkWithPopup(provider);
      }else{
        result = await auth.signInWithPopup(provider);
      }
      const user = result.user; if(!user) throw new Error('Google sign-in returned no user');
      const isNew = !!(result.additionalUserInfo && result.additionalUserInfo.isNewUser);
      if(isNew){
        // Create with default random handle
        const base = (user.displayName || (user.email ? user.email.split('@')[0] : 'user')).toLowerCase().replace(/[^a-z0-9_.]/g,'');
        let attempt = (base.slice(0,12) || 'user') + (Math.floor(Math.random()*9000)+1000);
        let finalHandle = attempt;
        try{
          for(let i=0;i<30;i++){
            const doc = await db.collection('handles').doc(finalHandle).get();
            if(!doc.exists){ break; }
            finalHandle = (base.slice(0,10) || 'user') + (Math.floor(Math.random()*900000)+100000);
          }
          await db.collection('handles').doc(finalHandle).set({ uid:user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
        }catch(_){ }
        await usersRef.doc(user.uid).set({
          displayName: user.displayName || 'Friend',
          email: user.email || null,
          handle: finalHandle,
          handleLC: finalHandle.toLowerCase(),
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          friendIds: [], lastPingAt: null, unreadCount: 0, isSubscriber:false
        }, { merge:true });
      }else{
        await usersRef.doc(user.uid).set({ displayName: user.displayName || 'Friend' }, { merge:true });
        await ensureIdentityMappings(user);
      }
      try{ document.getElementById('signInModal').classList.remove('open'); }catch{}
      // Immediate forced UI flip, then full refresh
      forceAuthUI(user);
      await refreshAuthUI(user);
      // Extra safety: run a delayed refresh and ensure visible change
      setTimeout(()=>{ try{ forceAuthUI(auth.currentUser); refreshAuthUI(auth.currentUser); }catch(e){} }, 80);
    }catch(e){
      console.error(e);
      // If linking Guest -> Google fails because Google account already exists, sign in with that credential
      try{
        const userBefore = auth.currentUser;
        if(userBefore && userBefore.isAnonymous && e && e.code==='auth/credential-already-in-use' && e.credential){
          const cred = e.credential; // OAuthCredential
          const signed = await auth.signInWithCredential(cred);
          const user = signed && signed.user ? signed.user : auth.currentUser;
          if(user){
            await usersRef.doc(user.uid).set({ displayName: user.displayName || 'Friend', email: user.email || null }, { merge:true });
            forceAuthUI(user);
            await refreshAuthUI(user);
            setTimeout(()=>{ try{ forceAuthUI(auth.currentUser); refreshAuthUI(auth.currentUser); }catch(_){ } }, 80);
            return;
          }
        }
      }catch(err){ console.error('credential-in-use recovery failed', err); }
      // Fallback to redirect in environments where popups are blocked or unsupported
      if(e && (e.code==='auth/popup-blocked' || e.code==='auth/operation-not-supported-in-this-environment')){
        try{ const provider = new firebase.auth.GoogleAuthProvider(); provider.setCustomParameters({ prompt: 'select_account' }); await auth.signInWithRedirect(provider); return; }catch(err){ console.error('redirect failed', err); }
      }
      let msg = e && e.message ? e.message : 'Google sign-in failed';
      if(e.code==='auth/unauthorized-domain') msg='Unauthorized domain: add this origin in Firebase Auth → Settings → Authorized domains.';
      else if(e.code==='auth/operation-not-allowed') msg='Enable Google provider in Firebase Auth → Sign-in method.';
      else if(e.code==='auth/popup-blocked' || e.code==='auth/popup-closed-by-user') msg='Popup blocked/closed. Allow popups and try again.';
      else if(e.code==='auth/credential-already-in-use') msg='This Google account is already linked. Signing you into that account failed—try again.';
      showToast(msg);
    }
  }
  $('#doGoogle').onclick = ()=>signInWithGoogle();


        


  // Guest (anonymous)
  async function enterGuest(){
    try{
      await auth.signInAnonymously();
      enableColorZone();
      splash.style.opacity='0'; 
      setTimeout(()=>splash.style.display='none',450);
      showToast('Browsing as Guest (no posting or reacting)');
    }catch(e){ console.error(e); showToast('Guest sign-in failed'); }
  }

  // Sign out can be added inside profile if needed

  /* --------- Map --------- */
  const map = L.map('map',{ center:DEFAULT_CENTER, zoom:15, minZoom:0, maxZoom:22, zoomAnimation:true, markerZoomAnimation:true, fadeAnimation:true, zoomSnap:.5, wheelPxPerZoomLevel:45, wheelDebounceTime:40, scrollWheelZoom:true, doubleClickZoom:false, dragging:true, touchZoom:'center', zoomControl:false });
  const innerPane = map.createPane('inner'); innerPane.style.zIndex=401; innerPane.classList.add('inner-pane','gray-all');
  L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',{ attribution:'© OpenStreetMap', maxZoom:22, pane:'inner' }).addTo(map);

  let FENCE_CENTER = L.latLng(DEFAULT_CENTER);
  let userPos = null;

  const fenceCircle = L.circle(FENCE_CENTER,{ radius:RADIUS_M, color:'#16a34a', weight:2, opacity:.9, dashArray:'6 4', fillOpacity:0 }).addTo(map);
  function updateViewConstraints(){ const fit = map.getBoundsZoom(fenceCircle.getBounds(), true); map.setMinZoom(fit); if(map.getZoom()<fit) map.setZoom(fit); }
  updateViewConstraints();

  const EPS=.8;
  const clampToCircle=(center, pt, r)=>{ const d=center.distanceTo(pt); if(d<=r) return pt; const k=r/d; return L.latLng(center.lat+(pt.lat-center.lat)*k, center.lng+(pt.lng-center.lng)*k); };
  function enforceLock(){ const c=map.getCenter(); if(FENCE_CENTER.distanceTo(c)>RADIUS_M+EPS){ map.setView(clampToCircle(FENCE_CENTER,c,RADIUS_M), map.getZoom(), {animate:false}); } }
  map.on('moveend', enforceLock);
  map.on('zoomend', ()=>{ enforceLock(); try{ restyleMarkers(); }catch(e){} });

  const des = document.querySelector('.desat-hole');
  function updateMask(){
    const lat=FENCE_CENTER.lat,lng=FENCE_CENTER.lng; const mPerDegLon=111320*Math.cos(lat*Math.PI/180);
    const degLon=RADIUS_M/mPerDegLon; const c=map.latLngToContainerPoint(FENCE_CENTER); const ex=map.latLngToContainerPoint([lat,lng+degLon]);
    const rPx=Math.max(40, Math.abs(ex.x-c.x)); des.style.setProperty('--cx', Math.round(c.x)+'px'); des.style.setProperty('--cy',Math.round(c.y)+'px'); des.style.setProperty('--r', rPx+'px');
  }
  map.on('move zoom resize', updateMask); updateMask();

  if(navigator.geolocation){
    navigator.geolocation.getCurrentPosition(pos=>{
      userPos=L.latLng(pos.coords.latitude, pos.coords.longitude);
      if(userPos.distanceTo(FENCE_CENTER)<=RADIUS_M){ map.setView(userPos, Math.max(map.getZoom(),16), {animate:false});
        const latEl=$('#lat'),lonEl=$('#lon'); if(latEl&&lonEl){ latEl.value=userPos.lat.toFixed(6); lonEl.value=userPos.lng.toFixed(6); } }
      updateViewConstraints(); enforceLock(); updateMask();
    },()=>{}, {enableHighAccuracy:true, maximumAge:15000, timeout:8000});
  }

  /* --------- Firestore --------- */
  const pingsRef = db.collection('pings');
  const votesRef = db.collection('votes');
  const usersRef = db.collection('users');

  /* --------- Leftbar contains only Filters now ---------- */
  const leftbar = document.getElementById('leftbar');

  /* --------- Filter (All / Friends+Me / Me) --------- */
  let filterMode = 'all'; // 'all' | 'friends' | 'me'
  $$('#filterSeg button').forEach(btn=>{
    btn.onclick=()=>{ $$('#filterSeg button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); filterMode=btn.dataset.mode; reFilterMarkers(); };
  });

  /* --------- Pin icons & sizing --------- */
  function netLikes(p){ return Math.max(0, (p.likes||0) - (p.dislikes||0)); }
  // Zoom scaling: double size every ~3 zooms; clamp to [0.7, 2.2]
  function zoomFactor(){
    try{
      const z = map && typeof map.getZoom==='function' ? map.getZoom() : 14;
      const f = Math.pow(2, (z - 14)/3);
      return Math.min(2.2, Math.max(0.7, f));
    }catch(e){ return 1; }
  }


  function radiusFromNet(net){
    const n = Math.max(0, Number(net)||0);
    let r = BASE_RADIUS;
    if(n <= L_LINEAR){
      r = BASE_RADIUS + A_SLOPE * n;
    }else{
      r = BASE_RADIUS + A_SLOPE * L_LINEAR + B_SQRT * Math.sqrt(n - L_LINEAR);
    }
    return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, r));
  }

  function balloonSVG(color, sizePx, opts={}){
    const w=Math.max(18,Math.min(56,Math.round(sizePx))), h=Math.round(w*1.5);
    const stroke='rgba(0,0,0,0.35)';
    const M = opts.drawM ? `<text x="12" y="15" text-anchor="middle" font-family="ui-rounded, system-ui, -apple-system, Segoe UI, Inter, Roboto, Arial, sans-serif" font-size="10" font-weight="900" fill="#c01631">M</text>` : `<path d="M9 6 C7.8 6.4,7 7.5,7 8.6" stroke="rgba(255,255,255,0.6)" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
    const svg=`<svg width="${w}" height="${h}" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
      <defs><filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="rgba(0,0,0,0.35)"/></filter></defs>
      <path d="M12 2 C7 2, 4 5.5, 4 10 c0 6, 8 12, 8 12 s8-6, 8-12 c0-4.5-3-8-8-8z" fill="${color}" stroke="${stroke}" stroke-width="1.5" filter="url(#pinShadow)"/>
      ${M}
    </svg>`;
    return {html:svg, size:[w,h], anchor:[w/2,h]};
  }
  function mIcon(px){ return L.divIcon({className:'pin-icon', ...balloonSVG('#ffffff', px, {drawM:true})}); }

  function colorForPing(p){
    const mine = (currentUser && p.authorId === currentUser.uid);
    if (mine) return { kind:'mine', color:'#16a34a' };
    const friend = myFriends.has(p.authorId);
    if (friend) return { kind:'friend', color:'#f59e0b' };
    if (p.authorIsSubscriber) return { kind:'subM', color:'#ffffff' };
    return { kind:'other', color:'#0ea5e9' };
  }

  function iconForPing(p, isPotw=false){
    const n = netLikes(p);
    // Normal size
    let r = radiusFromNet(n);
    // PotW appears as size of a ping with 2x its NET likes
    if(isPotw){
      const twoN = n*2;
      let potwR;
      if(twoN <= L_LINEAR){
        potwR = BASE_RADIUS + A_SLOPE * twoN;
      }else{
        potwR = BASE_RADIUS + A_SLOPE * L_LINEAR + B_SQRT * Math.sqrt(twoN - L_LINEAR);
      }
      r = Math.min(POTW_CAP, Math.max(MIN_RADIUS, potwR));
    }
    const px = r*2.2 * zoomFactor();

    const style = colorForPing(p);
    let inner;
    if(style.kind==='subM' && !myFriends.has(p.authorId) && !(currentUser && p.authorId===currentUser.uid)){
      inner = mIcon(px);
    }else{
      const {html,size,anchor}=balloonSVG(style.color,px);
      inner = L.divIcon({className:'pin-icon', html, iconSize:size, iconAnchor:anchor});
    }

    if(!isPotw) return inner;

    // Wrap with banner + ring
    const wrap = document.createElement('div');
    wrap.className='potw-wrap';
    wrap.style.position='relative';
    wrap.innerHTML = inner.options.html;

    const ring = document.createElement('div');
    ring.className='potw-ring';
    ring.style.width = '100%';
    ring.style.height = 'auto';

    const banner = document.createElement('div');
    banner.className='potw-banner';
    banner.textContent='PING OF THE WEEK';

    wrap.appendChild(ring);
    wrap.appendChild(banner);

    return L.divIcon({
      className:'pin-icon',
      html:wrap.outerHTML,
      iconSize:inner.options.iconSize,
      iconAnchor:inner.options.iconAnchor
    });
  }

  /* --------- Live markers --------- */
  const markers=new Map(); const lastPingCache=new Map(); let unsubscribe=null;
  let currentUser=null, myFriends=new Set();
  let isSubscriber=false;

  function isMine(p){ return currentUser && p.authorId===currentUser.uid; }
  function isFriend(p){ return myFriends.has(p.authorId); }
  function inFence(p){ return L.latLng(p.lat,p.lon).distanceTo(FENCE_CENTER) <= RADIUS_M; }

  function shouldShow(p){
    // PotW always shows (overrides TTL and filters) while it's current
    if (currentPotw && currentPotw.id===p.id) return true;
    // 24h TTL
    const ts = p.createdAt?.toDate ? p.createdAt.toDate().getTime() : 0;
    if (!ts || Date.now()-ts > LIVE_WINDOW_MS) return false;
    if(!inFence(p)) return false;
    if(p.status==='hidden') return false;
    if(filterMode==='me') return isMine(p);
    if(filterMode==='friends') return isMine(p) || isFriend(p);
    return true;
  }

  function upsertMarker(p){
    if(typeof p.lat!=='number' || typeof p.lon!=='number') return;
    const isPotw = !!(currentPotw && currentPotw.id===p.id);
    if(!shouldShow(p)){ removeMarker(p.id); return; }
    const icon=iconForPing(p, isPotw);
    if(!markers.has(p.id)){
      const m=L.marker([p.lat,p.lon],{icon}).addTo(map).on('click',()=>openSheet(p.id));
      markers.set(p.id,m);
    } else {
      markers.get(p.id).setIcon(icon);
    }
  }
  function removeMarker(id){ const m=markers.get(id); if(m){ map.removeLayer(m); markers.delete(id); } }
  function reFilterMarkers(){ lastPingCache.forEach((p,id)=>{ const allowed=shouldShow(p); const on=markers.has(id); if(allowed&&!on) upsertMarker(p); else if(!allowed&&on) removeMarker(id); }); }
  function restyleMarkers(){ markers.forEach((m,id)=>{ const p=lastPingCache.get(id); if(!p) return; const isPotw=!!(currentPotw && currentPotw.id===id); m.setIcon(iconForPing(p, isPotw)); }); }

  function startLive(){
    if(unsubscribe) unsubscribe();
    // Avoid depending on client clock (can hide recent pings if clock is wrong)
    unsubscribe = pingsRef
  .orderBy('createdAt','desc').limit(800)
  .onSnapshot(s=>{
    s.docChanges().forEach(ch=>{
      const p={id:ch.doc.id, ...ch.doc.data()};
      lastPingCache.set(p.id,p);
      if(ch.type==='removed'){ removeMarker(p.id); lastPingCache.delete(p.id); return; }
      if(!shouldShow(p)){ removeMarker(p.id); return; }
      upsertMarker(p);
    });
    // 🔑 Ensure PotW is re-evaluated on every live update
    recomputePotw().catch(console.error);
  }, e=>{ console.error(e); showToast((e.code||'error')+': '+(e.message||'live error')); });

  }
  startLive();

  setInterval(()=>{ const now=Date.now(); lastPingCache.forEach((p,id)=>{ if(currentPotw && currentPotw.id===id) return; const ts=p.createdAt?.toDate? p.createdAt.toDate().getTime():0; if(ts && now-ts>LIVE_WINDOW_MS){ removeMarker(id); lastPingCache.delete(id); } }); },60*1000);

  /* --------- Quota & rate limits --------- */
  async function todayCount(uid){
    const start=new Date(); start.setHours(0,0,0,0);
    try{ const qs=await pingsRef.where('authorId','==',uid).where('createdAt','>=',start).get(); return qs.size; }
    catch{ const qs=await pingsRef.where('authorId','==',uid).get(); let c=0; qs.forEach(d=>{ const t=d.data().createdAt?.toDate?.(); if(t && t>=start) c++; }); return c; }
  }
  async function refreshQuota(uid){
    if(isUnlimited()){ $('#quotaText').textContent=`∞/${MAX_PINGS_PER_DAY} pings today`; return 0; }
    const used=await todayCount(uid);
    $('#quotaText').textContent=`${Math.min(used,MAX_PINGS_PER_DAY)}/${MAX_PINGS_PER_DAY} pings today`;
    return used;
  }

  /* --------- Image upload (Firebase Storage) --------- */
  async function uploadPingImage(file, uid){
    // Compress large images to avoid oversized data URLs in local dev
    async function compressToDataUrl(file, maxWidth=1600, quality=0.85){
      return new Promise((resolve)=>{
        const img=new Image(); const reader=new FileReader();
        reader.onload=()=>{ img.src=reader.result; };
        img.onload=()=>{
          const scale=Math.min(1, maxWidth/Math.max(img.width, img.height));
          const w=Math.round(img.width*scale), h=Math.round(img.height*scale);
          const c=document.createElement('canvas'); c.width=w; c.height=h; const ctx=c.getContext('2d');
          ctx.drawImage(img,0,0,w,h);
          // Try jpeg first, fallback to png if needed
          let url=c.toDataURL('image/jpeg', quality);
          // Guard: Firestore field limit is 1,048,487 bytes; aim smaller
          if(url.length>950000){ url=c.toDataURL('image/jpeg', 0.7); }
          if(url.length>950000){ url=c.toDataURL('image/jpeg', 0.6); }
          resolve(url);
        };
        reader.readAsDataURL(file);
      });
    }
    // For local development, always use data URL to avoid CORS issues
    if(location.hostname === 'localhost' || location.hostname === '127.0.0.1'){
      console.log('Local development detected, compressing to data URL');
      return await compressToDataUrl(file);
    }
    
    try{
      const storage = firebase.storage();
      const extGuess = (file && file.name && file.name.includes('.')) ? file.name.split('.').pop().toLowerCase() : 'jpg';
      const ext = (extGuess || 'jpg').replace(/[^a-z0-9]/g,'').slice(0,5) || 'jpg';
      const path = `pings/${uid}/${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
      const ref = storage.ref().child(path);
      
      const metadata = {
        contentType: file.type || 'image/jpeg',
        cacheControl: 'public, max-age=31536000'
      };
      
      const snap = await ref.put(file, metadata);
      const url = await snap.ref.getDownloadURL();
      return url;
    }catch(e){ 
      console.error('uploadPingImage', e); 
      // Fallback: compress to data URL
      console.log('Upload failed, compressing to data URL fallback');
      return await compressToDataUrl(file);
    }
  }

  /* --------- Create ping --------- */
  const attachInput = $('#pingImage');
  const subscribeBtn = $('#subscribeBtn');
  const attachPreview = document.getElementById('attachPreview');
  const attachPreviewImg = document.getElementById('attachPreviewImg');

  subscribeBtn.onclick = ()=>{
    if(!currentUser || currentUser.isAnonymous) return showToast('Sign in to subscribe');
    openModal('subscribeModal');
  };
  $('#closeSub').onclick = ()=> closeModal('subscribeModal');
  $('#confirmSub').onclick = async ()=>{
    try{
      if(!currentUser || currentUser.isAnonymous) return showToast('Sign in first');
      await usersRef.doc(currentUser.uid).set({ isSubscriber: true }, { merge:true });
      isSubscriber = true;
      closeModal('subscribeModal');
      showToast('Subscribed! You can attach images now.');
    }catch(e){ console.error(e); showToast('Subscription failed'); }
  };

  $('#addBtn').onclick=()=>{
    if(!currentUser) return showToast('Sign in first');
    if(currentUser.isAnonymous) return showToast('Guests can’t post. Create an account to drop pings.');
    const latEl=$('#lat'), lonEl=$('#lon');
    const base=(userPos && userPos.distanceTo(FENCE_CENTER)<=RADIUS_M) ? userPos : FENCE_CENTER;
    latEl.value=base.lat.toFixed(6); lonEl.value=base.lng.toFixed(6);
    openModal('createModal');
    // Disable attach for non-subscribers
    try{
      const lbl = document.getElementById('attachLabel');
      if(attachInput) attachInput.disabled = !isSubscriber;
      if(lbl){
        if(!isSubscriber){ lbl.classList.add('muted'); lbl.style.pointerEvents='none'; lbl.title='Subscribe to attach images'; }
        else { lbl.classList.remove('muted'); lbl.style.pointerEvents='auto'; lbl.title='Attach Image'; }
      }
      // Reset preview and show attach label on open
      const prev = document.getElementById('attachPreview');
      if(prev) prev.style.display = 'none';
      if(lbl) lbl.style.display = 'inline-flex';
      if(attachInput) attachInput.value = '';
    }catch(_){ }
  };
  $('#cancelCreate').onclick=()=>{ try{ const prev=document.getElementById('attachPreview'); const lbl=document.getElementById('attachLabel'); if(prev) prev.style.display='none'; if(lbl) lbl.style.display='inline-flex'; if(attachInput) attachInput.value=''; }catch(_){ } closeModal('createModal'); };
  if(attachInput){
    attachInput.onchange = ()=>{
      try{
        const f = attachInput.files && attachInput.files[0];
        if(f){
          const url = URL.createObjectURL(f);
          if(attachPreviewImg) attachPreviewImg.src = url;
          if(attachPreview) attachPreview.style.display = 'block';
          const lbl = document.getElementById('attachLabel'); if(lbl) lbl.style.display = 'none';
        } else {
          if(attachPreview) attachPreview.style.display = 'none';
          const lbl = document.getElementById('attachLabel'); if(lbl) lbl.style.display = 'inline-flex';
        }
      }catch(_){ }
    };
  }

  map.on('click', e=>{
    if(!currentUser || currentUser.isAnonymous) return;
    const clamped=clampToCircle(FENCE_CENTER, e.latlng, RADIUS_M);
    $('#lat').value=clamped.lat.toFixed(6); $('#lon').value=clamped.lng.toFixed(6);
    openModal('createModal');
  });

  function validText(s){ if(!s) return false; if(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(s)) return false; return true; }
  async function getUserDoc(uid){ const d=await usersRef.doc(uid).get(); return d.exists? d.data() : null; }

  $('#submitPing').onclick=async()=>{
    try{
      if(!currentUser) return showToast('Sign in first');
      if(currentUser.isAnonymous) return showToast('Guests can’t post. Create an account.');
      const udoc = await getUserDoc(currentUser.uid) || {};
      const lastAt = udoc.lastPingAt?.toDate ? udoc.lastPingAt.toDate().getTime() : 0;
      if(!isUnlimited()){
        if(Date.now()-lastAt < MIN_MILLIS_BETWEEN_PINGS) return showToast('Slow down—try again in a few minutes');
        const used=await refreshQuota(currentUser.uid);
        if(used>=MAX_PINGS_PER_DAY) return showToast('Daily limit reached');
      } else {
        await refreshQuota(currentUser.uid);
      }

      const text=($('#pingText').value||'').trim();
      let lat=parseFloat($('#lat').value), lon=parseFloat($('#lon').value);
      if(!validText(text)) return showToast('Add text (no real names)');
      if(Number.isNaN(lat)||Number.isNaN(lon)){ const base=(userPos && userPos.distanceTo(FENCE_CENTER)<=RADIUS_M)? userPos : FENCE_CENTER; lat=base.lat; lon=base.lng; }
      if(L.latLng(lat,lon).distanceTo(FENCE_CENTER)>RADIUS_M) return showToast('Outside the circle');

      let imageUrl = null;
      const file = attachInput.files && attachInput.files[0];
      if(file){
        if(!isSubscriber){ return showToast('Subscribe to attach images'); }
        if(file.size > 10*1024*1024) return showToast('Image must be ≤ 10MB');
        imageUrl = await uploadPingImage(file, currentUser.uid);
      }

      const ref = await pingsRef.add({
        text, lat, lon,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        authorId: currentUser.uid,
        authorIsSubscriber: !!isSubscriber,
        likes:0, dislikes:0, flags:0, status:'live',
        imageUrl: imageUrl || null,
        firstNetAt: {} // milestones map (N -> timestamp) starts empty
      });
      await usersRef.doc(currentUser.uid).set({ lastPingAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });

      const temp = { id:ref.id, text, lat, lon, createdAt:{toDate:()=>new Date()}, authorId:currentUser.uid, authorIsSubscriber:!!isSubscriber, likes:0, dislikes:0, flags:0, status:'live', imageUrl, firstNetAt:{} };
      lastPingCache.set(ref.id,temp); upsertMarker(temp);

      closeModal('createModal'); $('#pingText').value=''; $('#lat').value=''; $('#lon').value=''; attachInput.value='';
      await refreshQuota(currentUser.uid);
      showToast('Ping posted');
    }catch(e){ console.error(e); showToast((e.code||'error')+': '+(e.message||'Error posting')); }
  };

  /* --------- Sheet / votes / comments / reports --------- */
  const sheet=$('#pingSheet'), sheetText=$('#sheetText'), sheetMeta=$('#sheetMeta');
  const sheetImage=$('#sheetImage'), sheetImgEl=$('#sheetImgEl');
  const viewImageBtn=$('#viewImageBtn');
  const reactBar=$('#reactBar'), commentsEl=$('#comments'), commentInput=$('#commentInput');
  let openId=null, openUnsub=null, openCommentsUnsub=null;

  function openSheet(id){
    if(openUnsub) openUnsub(); if(openCommentsUnsub) openCommentsUnsub();
    openId=id; sheet.classList.add('open'); applyModalOpenClass();

    openUnsub = pingsRef.doc(id).onSnapshot(doc=>{
      if(!doc.exists){ sheet.classList.remove('open'); return; }
      const p={id:doc.id, ...doc.data()}; lastPingCache.set(p.id,p);
      sheetText.textContent=p.text; const created = p.createdAt?.toDate ? p.createdAt.toDate().getTime() : null; sheetMeta.textContent=`Near ${Number(p.lat).toFixed(5)}, ${Number(p.lon).toFixed(5)} • ${timeAgo(created)}`;
      if(p.imageUrl){
        // Do not show image by default; show a View button that only opens lightbox
        sheetImgEl.src=p.imageUrl;
        sheetImage.style.display='none';
        if(viewImageBtn){ viewImageBtn.style.display='inline-flex'; viewImageBtn.onclick=()=>{ if(sheetImgEl && sheetImgEl.src){ const lb=document.getElementById('lightboxImg'); if(lb){ lb.src=sheetImgEl.src; openModal('imageLightbox'); } } } }
      } else {
        sheetImage.style.display='none';
        if(viewImageBtn){ viewImageBtn.style.display='none'; viewImageBtn.onclick=null; }
      }
      renderVoteBar(p); upsertMarker(p);
    });

    openCommentsUnsub = pingsRef.doc(id).collection('comments').orderBy('createdAt','desc').limit(200).onSnapshot(s=>{
      commentsEl.innerHTML=''; s.forEach(d=>{
        const c=d.data(); const when=c.createdAt||null;
        const div=document.createElement('div'); div.className='comment'; div.innerHTML=`${c.text}<br/><small>${timeAgo(when)}</small>`; commentsEl.appendChild(div);
      });
    });
  }
  $('#closeSheet').onclick=()=>{ sheet.classList.remove('open'); if(openUnsub) openUnsub(); if(openCommentsUnsub) openCommentsUnsub(); openId=null; applyModalOpenClass(); };

  // Image lightbox behavior
  try{
    sheetImgEl.onclick = ()=>{ const lb=document.getElementById('lightboxImg'); if(sheetImgEl && sheetImgEl.src && lb){ lb.src = sheetImgEl.src; openModal('imageLightbox'); } };
    document.getElementById('closeLightbox').onclick = ()=> closeModal('imageLightbox');
  }catch(_){ }

  // Remove attached image in create modal
  try{
    const removeAttachBtn = document.getElementById('removeAttachBtn');
    if(removeAttachBtn){
      removeAttachBtn.onclick = ()=>{
        try{
          if(attachPreviewImg) attachPreviewImg.src='';
          if(attachPreview) attachPreview.style.display='none';
          const lbl = document.getElementById('attachLabel'); if(lbl) lbl.style.display='inline-flex';
          if(attachInput) attachInput.value='';
        }catch(_){ }
      };
    }
  }catch(_){ }

  function renderVoteBar(p){
    reactBar.innerHTML='';
    const disabled = (!currentUser || currentUser.isAnonymous);
    const mk=(type,label,count)=>{ const b=document.createElement('button'); b.className='react'; b.textContent=`${label} ${count||0}`; if(disabled){ b.disabled=true; b.style.opacity=.6; b.title='Sign in to react'; } else { b.onclick=()=>setVote(p.id,type).catch(console.error); } return b; };
    reactBar.appendChild(mk('like','👍',p.likes)); reactBar.appendChild(mk('dislike','👎',p.dislikes));
  }

  // Vote transaction with NET-like milestones (firstNetAt.{N})
  async function setVote(pingId,type){
    if(!currentUser) return showToast('Sign in first');
    if(currentUser.isAnonymous) return showToast('Guests can’t react');
    const vid=`${pingId}_${currentUser.uid}`;
    await db.runTransaction(async tx=>{
      const pRef=pingsRef.doc(pingId), vRef=votesRef.doc(vid);
      const [pSnap,vSnap]=await Promise.all([tx.get(pRef), tx.get(vRef)]);
      if(!pSnap.exists) return;
      let p=pSnap.data(), prev=vSnap.exists? vSnap.data().type:null;

      // Compute new like/dislike tallies
      if(prev==='like') p.likes=Math.max(0,(p.likes||0)-1);
      if(prev==='dislike') p.dislikes=Math.max(0,(p.dislikes||0)-1);

      let newPrev = prev===type ? null : type;
      if(prev===type){
        tx.delete(vRef);
      }else{
        tx.set(vRef,{pingId,userId:currentUser.uid,type,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
        if(type==='like') p.likes=(p.likes||0)+1; else p.dislikes=(p.dislikes||0)+1;
      }

      const beforeNet = Math.max(0, (pSnap.data().likes||0) - (pSnap.data().dislikes||0));
      const afterNet  = Math.max(0, (p.likes||0) - (p.dislikes||0));

      // Record firstNetAt milestones for net like counts we just crossed upwards (cap at 200)
      const maxMilestone = 200;
      const updates = {};
      const mapNow = p.firstNetAt || {};
      if(afterNet > beforeNet){
        for(let k = beforeNet+1; k <= Math.min(afterNet, maxMilestone); k++){
          if(!mapNow[String(k)]){
            mapNow[String(k)] = firebase.firestore.FieldValue.serverTimestamp();
          }
        }
      }
      updates.firstNetAt = mapNow;
      updates.likes = p.likes||0; updates.dislikes = p.dislikes||0;

      tx.update(pRef, updates);
    }).catch(e=>console.error(e));
  }

  $('#sendComment').onclick=async()=>{
    if(!openId) return; if(!currentUser) return showToast('Sign in first');
    if(currentUser.isAnonymous) return showToast('Guests can’t comment');
    const t=(commentInput.value||'').trim(); if(!t) return; if(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(t)) return showToast('No real names');
    await pingsRef.doc(openId).collection('comments').add({ text:t, authorId:currentUser.uid, createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    commentInput.value='';
  };

  // Reporting: 1 per user per ping; hide at 3
  $('#reportReason').onchange=async(e)=>{
    const reason=e.target.value; if(!openId || !reason) return;
    if(!currentUser || currentUser.isAnonymous) return showToast('Sign in to report');
    try{
      const ref=pingsRef.doc(openId);
      await db.runTransaction(async tx=>{
        const snap=await tx.get(ref); if(!snap.exists) return;
        const rptRef=ref.collection('reports').doc(currentUser.uid);
        const rptSnap=await tx.get(rptRef); if(rptSnap.exists) return;
        const prev=snap.data().flags||0;
        tx.set(rptRef,{ userId:currentUser.uid, reason, createdAt:firebase.firestore.FieldValue.serverTimestamp() });
        const next=prev+1;
        tx.update(ref,{ flags:next, status: next>=3 ? 'hidden':'live' });
      });
      showToast('Thanks—report submitted');
      e.target.value='';
    }catch(err){ console.error(err); showToast('Report failed'); }
  };

  
  // ---- Friend identity helpers ----
  async function sha256Hex(str){
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }

  async function resolveUserByHandleOrEmail(q){
    // handle: starts with @ or contains only allowed chars
    let handle = null, email = null;
    if(q.includes('@') && q.includes('.')){ email = q; }
    else { handle = q.startsWith('@') ? q.slice(1) : q; }

    if(email){
      const h = await sha256Hex(email.trim().toLowerCase());
      const doc = await db.collection('emailHashes').doc(h).get();
      if(doc.exists) return doc.data().uid || null;
    }
    if(handle){
      const hdl = handle.trim().toLowerCase();
      const doc = await db.collection('handles').doc(hdl).get();
      if(doc.exists) return doc.data().uid || null;
    }
    return null;
  }

  async function ensureIdentityMappings(user){
    // Ensure handle
    try{
      const uref = usersRef.doc(user.uid);
      const udoc = await uref.get();
      let handle = udoc.exists ? (udoc.data().handle||null) : null;
      if(!handle){
        const base = (user.displayName || (user.email ? user.email.split('@')[0] : 'user')).toLowerCase().replace(/[^a-z0-9_.]/g,'');
        let attempt = base.slice(0,16) || 'user';
        let i=0;
        while(i<50){
          const doc = await db.collection('handles').doc(attempt).get();
          if(!doc.exists){ 
            await db.collection('handles').doc(attempt).set({ uid:user.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            handle = attempt; break;
          }
          i++; attempt = (base.slice(0,12) || 'user') + (Math.floor(Math.random()*9000)+1000);
        }
        await uref.set({ handle, handleLC: handle.toLowerCase() }, { merge:true });
      }
    }catch(e){ console.warn('ensure handle failed', e); }
    // Ensure email hash map
    try{
      if(user.email){
        const h = await sha256Hex(user.email.trim().toLowerCase());
        await db.collection('emailHashes').doc(h).set({ uid:user.uid, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      }
    }catch(e){ console.warn('ensure email hash failed', e); }
  }

  // ---- Friend requests ----
  async function sendFriendRequest(fromUid, toUid){
    // spam guard: limit 20/day
    const since = Date.now() - 24*3600*1000;
    const q = await db.collection('friendRequests').where('from','==',fromUid).where('createdAt','>=', new Date(since)).get().catch(()=>null);
    if(q && q.size>=20) throw new Error('limit');

    const myDoc = await db.collection('friendRequests').doc(fromUid+'_'+toUid).get();
    if(myDoc.exists){
      const st = (myDoc.data().status||'pending');
      if(st==='pending') throw new Error('already pending');
      if(st==='accepted') throw new Error('already friends');
    }

    // Cross-request auto-accept
    const cross = await db.collection('friendRequests').doc(toUid+'_'+fromUid).get();
    if(cross.exists && (cross.data().status||'pending')==='pending'){
      // Accept
      await db.runTransaction(async (tx)=>{
        const aRef = usersRef.doc(fromUid), bRef = usersRef.doc(toUid);
        tx.update(aRef, { friendIds: firebase.firestore.FieldValue.arrayUnion(toUid) });
        tx.update(bRef, { friendIds: firebase.firestore.FieldValue.arrayUnion(fromUid) });
        tx.set(db.collection('friendRequests').doc(toUid+'_'+fromUid), { status:'accepted', acceptedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
      });
      // Notify both (dedupe)
      try{
        await Promise.all([
          db.runTransaction(async tx=>{ const nref=usersRef.doc(fromUid).collection('notifications').doc('friend_accept_'+toUid); const snap=await tx.get(nref); if(!snap.exists){ tx.set(nref,{ type:'friend_accept', partner: toUid, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); } }),
          db.runTransaction(async tx=>{ const nref=usersRef.doc(toUid).collection('notifications').doc('friend_accept_'+fromUid); const snap=await tx.get(nref); if(!snap.exists){ tx.set(nref,{ type:'friend_accept', partner: fromUid, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); } })
        ]);
      }catch(_){ }
      await refreshFriends();
      return;
    }

    // Create pending request (dedupe by id)
    await db.collection('friendRequests').doc(fromUid+'_'+toUid).set({
      from: fromUid, to: toUid, status:'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // Notify recipient (dedupe via fixed doc id)
    try{
      await db.runTransaction(async tx=>{
        const nref = usersRef.doc(toUid).collection('notifications').doc('friend_req_'+fromUid);
        const snap = await tx.get(nref);
        if(!snap.exists){ tx.set(nref,{ type:'friend_req', from: fromUid, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }
      });
    }catch(_){ }
  }

  async function acceptFriendRequest(reqId){
    const [fromUid,toUid] = reqId.split('_'); if(toUid!==currentUser.uid) throw new Error('not recipient');
    await db.runTransaction(async (tx)=>{
      const rRef = db.collection('friendRequests').doc(reqId);
      const rdoc = await tx.get(rRef);
      if(!rdoc.exists || rdoc.data().status!=='pending') return;
      const aRef = usersRef.doc(fromUid), bRef = usersRef.doc(toUid);
      tx.update(aRef, { friendIds: firebase.firestore.FieldValue.arrayUnion(toUid) });
      tx.update(bRef, { friendIds: firebase.firestore.FieldValue.arrayUnion(fromUid) });
      tx.update(rRef, { status:'accepted', acceptedAt: firebase.firestore.FieldValue.serverTimestamp() });
    });
    // Notify sender (dedupe via fixed doc id)
    try{
      await db.runTransaction(async tx=>{
        const nref = usersRef.doc(fromUid).collection('notifications').doc('friend_accept_'+currentUser.uid);
        const snap = await tx.get(nref);
        if(!snap.exists){ tx.set(nref,{ type:'friend_accept', partner: currentUser.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }
      });
    }catch(_){ }
    await refreshFriends();
  }
  async function declineFriendRequest(reqId){
    const rRef = db.collection('friendRequests').doc(reqId);
    await rRef.set({ status:'declined', decidedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
  }
  async function cancelFriendRequest(reqId){
    const rRef = db.collection('friendRequests').doc(reqId);
    const doc = await rRef.get(); if(!doc.exists) return;
    if(doc.data().from!==currentUser.uid) throw new Error('not sender');
    await rRef.set({ status:'canceled', decidedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
  }

  // Requests UI (Profile modal)
  let reqInUnsub=null, reqOutUnsub=null;
  function startRequestsListeners(uid){
    if(reqInUnsub) reqInUnsub(); if(reqOutUnsub) reqOutUnsub();
    // Simplified queries to avoid index requirements
    const inRef = db.collection('friendRequests').where('to','==',uid).where('status','==','pending');
    const outRef= db.collection('friendRequests').where('from','==',uid).where('status','==','pending');
    reqInUnsub = inRef.onSnapshot(()=>updateRequestsUI().catch(console.error));
    reqOutUnsub = outRef.onSnapshot(()=>updateRequestsUI().catch(console.error));
  }

  async function updateRequestsUI(){
    const cont = document.getElementById('requestsList'); if(!cont) return;
    if(!currentUser){ cont.innerHTML='<div class="muted">Sign in to see requests.</div>'; return; }
    // Simplified queries to avoid index requirements
    const inSS  = await db.collection('friendRequests').where('to','==',currentUser.uid).where('status','==','pending').get();
    const outSS = await db.collection('friendRequests').where('from','==',currentUser.uid).where('status','==','pending').get();

    const items=[];
    for(const doc of inSS.docs){ items.push({ id:doc.id, dir:'in', ...doc.data() }); }
    for(const doc of outSS.docs){ items.push({ id:doc.id, dir:'out', ...doc.data() }); }
    if(!items.length){ cont.innerHTML='<div class="muted">No pending requests.</div>'; return; }

    cont.innerHTML='';
    for(const it of items){
      const other = (it.dir==='in' ? it.from : it.to);
      const ud = await usersRef.doc(other).get();
      const nm = ud.exists ? (ud.data().displayName||ud.data().handle||'Friend') : 'Friend';
      const row = document.createElement('div'); row.className='req-card';
      row.innerHTML = '<div><strong>'+nm+'</strong><br/><small style="font-family:monospace">'+other+'</small></div>';
      const actions = document.createElement('div'); actions.className='req-actions';
      if(it.dir==='in'){
        const acc=document.createElement('button'); acc.className='btn'; acc.textContent='✓';
        acc.onclick=()=>acceptFriendRequest(it.id).catch(console.error);
        const dec=document.createElement('button'); dec.className='btn'; dec.textContent='✕';
        dec.onclick=()=>declineFriendRequest(it.id).catch(console.error);
        actions.appendChild(acc); actions.appendChild(dec);
      }else{
        const canc=document.createElement('button'); canc.className='btn'; canc.textContent='Cancel';
        canc.onclick=()=>cancelFriendRequest(it.id).catch(console.error);
        actions.appendChild(canc);
      }
      row.appendChild(actions); cont.appendChild(row);
    }
  }
/* --------- Profile modal friend actions --------- */
  const addFriendInputProfile = document.getElementById('addFriendInputProfile');
  const addFriendBtnProfile = document.getElementById('addFriendBtnProfile');
  if(addFriendBtnProfile){
    addFriendBtnProfile.onclick = async ()=>{
      const raw = (addFriendInputProfile && addFriendInputProfile.value || '').trim(); if(!raw) return;
      if(!currentUser) return showToast('Sign in first');
      const q = raw.toLowerCase();
      try{
        const targetUid = await resolveUserByHandleOrEmail(q);
        if(!targetUid){ showToast('No user found'); return; }
        if(targetUid===currentUser.uid){ showToast('That’s you!'); return; }
        await sendFriendRequest(currentUser.uid, targetUid);
        if(addFriendInputProfile) addFriendInputProfile.value=''; showToast('Friend request sent'); await updateRequestsUI();
      }catch(e){ console.error(e); showToast('Could not send request'); }
    };
  }

  // Profile modal elements and behaviors
  const profileModal = document.getElementById('profileModal');
  const closeProfileBtn = document.getElementById('closeProfile');
  if(closeProfileBtn){ closeProfileBtn.onclick = ()=> closeModal('profileModal'); }
  // Sign out button inside profile modal
  const signOutInProfile = document.getElementById('signOutInProfile');
  if(signOutInProfile){ signOutInProfile.onclick = async ()=>{ try{ await auth.signOut(); closeModal('profileModal'); showToast('Signed out'); }catch(e){ showToast('Sign out failed'); } }; }
  const ownAvatar = document.getElementById('ownProfileAvatar');
  const emailDisplay = document.getElementById('emailDisplay');
  const handleInput = document.getElementById('handleInput');
  const saveHandle = document.getElementById('saveHandle');
  // Legacy button (may not exist): define to avoid ReferenceError
  const saveProfilePhoto = document.getElementById('saveProfilePhoto');
  const openSettingsBtn = document.getElementById('openSettings');
  const backToProfileBtn = document.getElementById('backToProfile');
  const openChangePicBtn = document.getElementById('openChangePic');
  const settingsImageInput = document.getElementById('settingsImageInput');

  const cropModal = document.getElementById('cropModal');
  const cropImage = document.getElementById('cropImage');
  const cropZoom = document.getElementById('cropZoom');
  const closeCrop = document.getElementById('closeCrop');
  const saveCroppedAvatar = document.getElementById('saveCroppedAvatar');

  async function openOwnProfile(){
    if(!currentUser){ openModal('signInModal'); return; }
    try{
      document.getElementById('profileModalTitle').textContent='Your Profile';
      document.getElementById('ownProfileSection').style.display='block';
      document.getElementById('otherProfileSection').style.display='none';
      const gear = document.getElementById('openSettings'); if(gear) gear.style.display='inline-flex';
      const back = document.getElementById('backToProfile'); if(back) back.style.display='none';
      const settings = document.getElementById('settingsSection'); if(settings) settings.style.display='none';
      const actions = document.getElementById('profileActions'); if(actions) actions.style.display='flex';
      const signOutBtn = document.getElementById('signOutInProfile'); if(signOutBtn) signOutBtn.style.display='inline-flex';
    }catch(_){ }
    try{
      // Load avatar from our Firestore user doc, not auth provider
      if(ownAvatar){
        try{
          const d = await usersRef.doc(currentUser.uid).get();
          const url = d.exists ? (d.data().photoURL || '') : '';
          if(url){
            ownAvatar.style.backgroundImage = `url("${url}")`;
            ownAvatar.style.backgroundSize = 'cover';
            ownAvatar.style.backgroundPosition = 'center';
            ownAvatar.style.backgroundRepeat = 'no-repeat';
            ownAvatar.classList.add('custom-avatar');
          } else {
            ownAvatar.style.backgroundImage = '';
            ownAvatar.classList.remove('custom-avatar');
          }
        }catch(_){ }
      }
      if(handleInput){
        try{ const d=await usersRef.doc(currentUser.uid).get(); const h=d.exists? (d.data().handle||'') : ''; handleInput.value = h || ''; }catch(_){ }
      }
      if(emailDisplay){ const d=await usersRef.doc(currentUser.uid).get(); const em = d.exists? (d.data().email||currentUser.email||''): (currentUser.email||''); emailDisplay.textContent = em || 'No email'; }
    }catch(_){ }
    await refreshFriends();
    openModal('profileModal');
  }

  async function openOtherProfile(uid){
    try{
      const d = await usersRef.doc(uid).get(); const u = d.exists? d.data():{};
      document.getElementById('profileModalTitle').textContent='Profile';
      document.getElementById('ownProfileSection').style.display='none';
      document.getElementById('otherProfileSection').style.display='block';
      const gear = document.getElementById('openSettings'); if(gear) gear.style.display='none';
      const back = document.getElementById('backToProfile'); if(back) back.style.display='none';
      const settings = document.getElementById('settingsSection'); if(settings) settings.style.display='none';
      const actions = document.getElementById('profileActions'); if(actions) actions.style.display='none';
      const av = document.getElementById('otherProfileAvatar'); if(av){ const url = u.photoURL||''; av.style.backgroundImage = url ? `url("${url}")` : ''; }
      const nm = document.getElementById('otherProfileName');
      if(nm){
        const handle = (u && u.handle) ? String(u.handle).trim() : '';
        const display = handle ? `@${handle}` : (u.displayName || u.email || 'Friend');
        nm.textContent = display;
      }
      openModal('profileModal');
    }catch(e){ console.error(e); showToast('Could not load profile'); }
  }
  // Use event delegation for dynamic buttons
  document.addEventListener('click', (e) => {
    if(e.target.id === 'openSettings'){
      try{
        document.getElementById('profileModalTitle').textContent='Settings';
        document.getElementById('ownProfileSection').style.display='none';
        document.getElementById('otherProfileSection').style.display='none';
        const settings = document.getElementById('settingsSection'); if(settings) settings.style.display='block';
        const back = document.getElementById('backToProfile'); if(back) back.style.display='inline-flex';
        const gear = document.getElementById('openSettings'); if(gear) gear.style.display='none';
        const actions = document.getElementById('profileActions'); if(actions) actions.style.display='none';
        
        // Update settings profile avatar with current photo
        const settingsProfileAvatar = document.getElementById('settingsProfileAvatar');
        if(settingsProfileAvatar && currentUser) {
          // Get current photo from user data
          usersRef.doc(currentUser.uid).get().then(doc => {
            if(doc.exists) {
              const photoURL = doc.data().photoURL;
              if(photoURL) {
                settingsProfileAvatar.style.backgroundImage = `url("${photoURL}")`;
                settingsProfileAvatar.style.backgroundSize = 'cover';
                settingsProfileAvatar.style.backgroundPosition = 'center';
                settingsProfileAvatar.style.backgroundRepeat = 'no-repeat';
                settingsProfileAvatar.classList.add('custom-avatar');
              } else {
                settingsProfileAvatar.style.backgroundImage = '';
                settingsProfileAvatar.classList.remove('custom-avatar');
              }
            }
          }).catch(console.error);
        }
      }catch(_){ }
    }
    if(e.target.id === 'backToProfile') openOwnProfile();
  });

  if(saveHandle){
    saveHandle.onclick = async ()=>{
      try{
        if(!currentUser) return showToast('Sign in first');
        let raw = (handleInput && handleInput.value || '').trim();
        if(!raw) return;
        raw = raw.toLowerCase().replace(/[^a-z0-9_.]/g,'').slice(0,24);
        if(!raw) return showToast('Invalid username');
        // Check availability
        const exists = await db.collection('handles').doc(raw).get();
        if(exists.exists){ showToast('Name taken'); return; }
        // Move previous handle if any
        const uref = usersRef.doc(currentUser.uid); const ud = await uref.get(); const prev = ud.exists? (ud.data().handle||null) : null;
        await db.runTransaction(async tx=>{
          if(prev){ tx.delete(db.collection('handles').doc(prev)); }
          tx.set(db.collection('handles').doc(raw), { uid: currentUser.uid, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
          tx.set(uref, { handle: raw, handleLC: raw.toLowerCase() }, { merge:true });
        });
        await refreshAuthUI(currentUser);
        showToast('Username updated');
      }catch(e){ console.error(e); showToast('Update failed'); }
    };
  }

  if(saveProfilePhoto){
    saveProfilePhoto.onclick = async ()=>{
      try{
        if(!currentUser) return showToast('Sign in first');
        // Deprecated path; handled by Change profile pic flow
        showToast('Use "Change profile pic"');
      }catch(e){ console.error(e); showToast('Photo update failed'); }
    };
  }

  // Settings: Change profile pic with simple circle crop (zoom & pan)
  let cropState = { startX:0, startY:0, imgX:0, imgY:0, dragging:false, scale:1, imgW:0, imgH:0 };
  function openCropperWith(file){
    try{
      cropImage.style.visibility = 'hidden';
      cropState = { startX:0,startY:0,imgX:0,imgY:0,dragging:false,scale:1,imgW:0,imgH:0 };
      cropZoom.value = '1';
      
      // Try URL.createObjectURL first, fallback to FileReader
      const loadImage = (src) => {
        cropImage.src = src;
        cropImage.onload = ()=>{
          cropState.imgW = cropImage.naturalWidth; cropState.imgH = cropImage.naturalHeight;
          renderCropTransform();
          cropImage.style.visibility = 'visible';
        };
        cropImage.onerror = ()=>{
          cropImage.style.visibility = 'visible';
          showToast('Could not load image');
        };
      };
      
      try {
        const objectUrl = URL.createObjectURL(file);
        loadImage(objectUrl);
        // Clean up after load
        cropImage.onload = ()=>{
          cropState.imgW = cropImage.naturalWidth; cropState.imgH = cropImage.naturalHeight;
          renderCropTransform();
          cropImage.style.visibility = 'visible';
          URL.revokeObjectURL(objectUrl);
        };
      } catch(e) {
        // Fallback to FileReader
        const reader = new FileReader();
        reader.onload = (e) => loadImage(e.target.result);
        reader.readAsDataURL(file);
      }
      
      openModal('cropModal');
    }catch(e){ 
      console.error('openCropperWith error:', e);
      openModal('cropModal'); 
    }
  }
  function renderCropTransform(){
    cropImage.style.transform = `translate(calc(-50% + ${cropState.imgX}px), calc(-50% + ${cropState.imgY}px)) scale(${cropState.scale})`;
  }
  // Remove the onclick handler since we're using a label now
  // The label will handle the file picker opening automatically
  if(settingsImageInput){
    settingsImageInput.onchange = ()=>{ const f=settingsImageInput.files&&settingsImageInput.files[0]; if(!f) return; if(f.size>10*1024*1024) return showToast('Image must be ≤ 10MB'); openCropperWith(f); };
  }
  if(closeCrop){ closeCrop.onclick = ()=> closeModal('cropModal'); }
  if(cropZoom){ cropZoom.oninput = (e)=>{ cropState.scale = Number(e.target.value||'1'); renderCropTransform(); }; }
  // Basic drag to pan
  function addDrag(el){
    el.addEventListener('pointerdown', (e)=>{ cropState.dragging=true; cropState.startX=e.clientX; cropState.startY=e.clientY; el.setPointerCapture(e.pointerId); });
    el.addEventListener('pointermove', (e)=>{ if(!cropState.dragging) return; const dx=e.clientX-cropState.startX, dy=e.clientY-cropState.startY; cropState.imgX+=dx; cropState.imgY+=dy; cropState.startX=e.clientX; cropState.startY=e.clientY; renderCropTransform(); });
    el.addEventListener('pointerup', ()=>{ cropState.dragging=false; });
    el.addEventListener('pointercancel', ()=>{ cropState.dragging=false; });
  }
  if(cropImage){ addDrag(cropImage); }

  if(saveCroppedAvatar){
    saveCroppedAvatar.onclick = async ()=>{
      try{
        if(!currentUser) return showToast('Sign in first');
        
        // Check if image is loaded
        if(!cropImage.complete || !cropImage.naturalWidth){
          showToast('Image not loaded yet, please wait');
          return;
        }
        
        const frame = document.getElementById('cropFrame');
        const size = Math.min(frame.clientWidth, frame.clientHeight);
        const canvas = document.createElement('canvas'); 
        canvas.width=size; 
        canvas.height=size; 
        const ctx=canvas.getContext('2d');
        
        if(!ctx){
          showToast('Canvas not supported');
          return;
        }
        
        // Circle mask
        ctx.beginPath(); 
        ctx.arc(size/2,size/2,size/2,0,Math.PI*2); 
        ctx.closePath(); 
        ctx.clip();
        
        // Compute draw params: map from natural image to canvas considering transform
        const scale = cropState.scale;
        const drawW = cropState.imgW*scale; 
        const drawH=cropState.imgH*scale;
        const centerX = size/2 + cropState.imgX; 
        const centerY = size/2 + cropState.imgY;
        const dx = centerX - drawW/2; 
        const dy = centerY - drawH/2;
        
        // Ensure image is fully loaded
        await new Promise(r=>{ 
          if(cropImage.complete && cropImage.naturalWidth > 0) r(); 
          else cropImage.onload=r; 
        });
        
        ctx.drawImage(cropImage, dx, dy, drawW, drawH);
        
        const blob = await new Promise((res,rej)=> { 
          canvas.toBlob(res, 'image/jpeg', 0.9);
          setTimeout(()=>rej(new Error('Canvas toBlob timeout')), 5000);
        });
        
        if(!blob){
          showToast('Failed to create image');
          return;
        }
        
        const file = new File([blob], 'avatar.jpg', { type:'image/jpeg' });
        console.log('Uploading file:', file.size, 'bytes');
        
        const url = await uploadPingImage(file, currentUser.uid);
        console.log('Uploaded to:', url);
        
        if(!url){
          showToast('Failed to process image');
          return;
        }
        
        await usersRef.doc(currentUser.uid).set({ photoURL: url }, { merge:true });
        console.log('Updated user doc');
        
        // Update UI - refresh all avatar elements immediately
        const topRightAvatar = document.getElementById('profileAvatar'); // Top-right widget
        const profileModalAvatar = document.getElementById('ownProfileAvatar'); // Profile modal
        const settingsProfileAvatar = document.getElementById('settingsProfileAvatar');
        
        console.log('Avatar elements found:', { 
          topRightAvatar: !!topRightAvatar, 
          profileModalAvatar: !!profileModalAvatar,
          settingsProfileAvatar: !!settingsProfileAvatar 
        });
        
        const updateAvatar = (element, name) => {
          if(element) {
            // Only reset background-related styles, keep other styles
            element.style.backgroundImage = `url("${url}")`;
            element.style.backgroundSize = 'cover';
            element.style.backgroundPosition = 'center';
            element.style.backgroundRepeat = 'no-repeat';
            
            // Add custom-avatar class for CSS override
            element.classList.add('custom-avatar');
            element.style.setProperty('--custom-avatar-url', `url("${url}")`);
            
            console.log(`Updated ${name} with:`, url.substring(0, 50) + '...');
            console.log(`Element computed style:`, window.getComputedStyle(element).backgroundImage);
          } else {
            console.log(`${name} not found!`);
          }
        };
        
        updateAvatar(topRightAvatar, 'topRightAvatar');
        updateAvatar(profileModalAvatar, 'profileModalAvatar');
        updateAvatar(settingsProfileAvatar, 'settingsProfileAvatar');
        
        // Update the user's photoURL in their profile data
        await refreshAuthUI(currentUser);
        
        closeModal('cropModal');
        showToast('Profile photo updated');
        
        // Force a UI refresh to ensure all avatars update
        setTimeout(() => {
          updateAvatar(topRightAvatar, 'topRightAvatar (delayed)');
          updateAvatar(profileModalAvatar, 'profileModalAvatar (delayed)');
          updateAvatar(settingsProfileAvatar, 'settingsProfileAvatar (delayed)');
          
          // Force refresh all avatar elements one more time
          const allAvatars = [
            { el: document.getElementById('profileAvatar'), name: 'topRightAvatar' },
            { el: document.getElementById('ownProfileAvatar'), name: 'profileModalAvatar' },
            { el: document.getElementById('settingsProfileAvatar'), name: 'settingsProfileAvatar' }
          ];
          
          allAvatars.forEach(({ el, name }) => {
            if(el) {
              el.setAttribute('style', `background-image: url("${url}"); background-size: cover; background-position: center; background-repeat: no-repeat;`);
              console.log(`Force updated ${name}`);
            }
          });
        }, 200);
      }catch(e){ 
        console.error('Save avatar error:', e); 
        showToast(`Could not save photo: ${e.message || 'Unknown error'}`); 
      }
    };
  }


  async function refreshFriends(){
    const friendList = document.getElementById('profileFriendsList');
    const myCodeEl = document.getElementById('myCodeEl');
    if(!friendList){ return; }
    if(!currentUser){ friendList.innerHTML='<div class="muted">Sign in to manage friends.</div>'; return; }
    const doc=await usersRef.doc(currentUser.uid).get(); const data=doc.exists? doc.data():{friendIds:[], isSubscriber:false};
    myFriends=new Set(data.friendIds||[]); if(myCodeEl) myCodeEl.value=currentUser.uid; isSubscriber = !!data.isSubscriber;
    friendList.innerHTML='';
    if(!myFriends.size){ friendList.innerHTML='<div class="muted">No friends yet. Share your code above.</div>'; reFilterMarkers(); return; }
    for(const fid of myFriends){
      const fdoc=await usersRef.doc(fid).get();
      const data=fdoc.exists ? fdoc.data() : {};
      const handle = data && data.handle ? String(data.handle).trim() : '';
      const displayName = handle ? `@${handle}` : (data.displayName || data.email || 'Friend');
      const row=document.createElement('div'); row.className='friend-item'; row.setAttribute('tabindex','0'); row.style.cursor='pointer'; row.onclick=()=>openOtherProfile(fid); row.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openOtherProfile(fid); } };
      row.innerHTML=`<div><strong>${displayName}</strong><br/><small style="font-family:monospace">${fid}</small></div>`;
      const rm=document.createElement('button'); rm.className='btn'; rm.textContent='Remove';
      rm.onclick=async(e)=>{ e.stopPropagation(); await usersRef.doc(currentUser.uid).set({ friendIds: firebase.firestore.FieldValue.arrayRemove(fid) },{merge:true}); await usersRef.doc(fid).set({ friendIds: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) },{merge:true}); showToast('Removed'); refreshFriends(); };
      row.appendChild(rm); friendList.appendChild(row);
    }
    reFilterMarkers();
  }

  /* --------- Notifications --------- */
  const notifBadge=$('#notifBadge'), notifsModal=$('#notifsModal'), notifsContent=$('#notifsContent');
  $('#closeNotifs').onclick=()=>closeModal('notifsModal');
  // Use event delegation for notification button
  document.addEventListener('click', async (e) => {
    if(e.target.id === 'bellBtn' || e.target.closest('#bellBtn')){
      e.stopPropagation(); // Prevent map click handler from firing
      if(!currentUser) return showToast('Sign in to view notifications');
      openModal('notifsModal');
      await usersRef.doc(currentUser.uid).set({ unreadCount: 0 }, { merge:true });
      notifBadge.style.display='none';
    }
  });
  let notifUnsub=null;
  function startNotifListener(uid){
    if(notifUnsub) notifUnsub();
    notifUnsub = usersRef.doc(uid).collection('notifications').orderBy('createdAt','desc').limit(50).onSnapshot(s=>{
      if(s.empty){ notifsContent.textContent='No notifications yet.'; return; }
      notifsContent.innerHTML='';
      s.forEach(doc=>{
        const n=doc.data();
        const line=document.createElement('div');
        if(n.type==='friend_req'){ 
          line.className='notif req';
          const from = n.from;
          const notifId = doc.id;
          line.innerHTML = '<div class="notif-row"><div>Friend request</div><div class="notif-actions"><button class="btn" id="acc_'+notifId+'">✓</button><button class="btn" id="dec_'+notifId+'">✕</button></div></div>';
          notifsContent.appendChild(line);
          
          // Bind events immediately after creating the element
          const acc = document.getElementById('acc_'+notifId); 
          const dec = document.getElementById('dec_'+notifId);
          if(acc) {
            acc.onclick = async ()=>{
              try{
                await acceptFriendRequest(from+'_'+currentUser.uid);
                closeModal('notifsModal');
                showToast('Friend request accepted');
                // Remove the notification from UI
                line.remove();
              }catch(e){
                console.error('Accept friend request error:', e);
                showToast('Failed to accept request');
              }
            };
          }
          if(dec) {
            dec.onclick = async ()=>{
              try{
                await declineFriendRequest(from+'_'+currentUser.uid);
                showToast('Friend request declined');
                // Remove the notification from UI
                line.remove();
              }catch(e){
                console.error('Decline friend request error:', e);
                showToast('Failed to decline request');
              }
            };
          }
        } else if(n.type==='friend_accept'){ 
          line.textContent = 'Friend request accepted.';
          notifsContent.appendChild(line);
        } else if(n.type==='potw_awarded'){ 
          line.textContent = 'Your ping won Ping of the Week!';
          notifsContent.appendChild(line);
        } else if(n.type==='friend_ping'){
          line.textContent = 'A friend just dropped a ping.';
          notifsContent.appendChild(line);
        } else if(n.type==='friend_removed'){
          line.textContent = 'You were removed as a friend.';
          notifsContent.appendChild(line);
        }
      });
    });
  }

  /* --------- Ping of the Week --------- */
  let currentPotw = null; // { id, text, net, likes, dislikes, imageUrl, lat, lon, authorId, authorName }

  const potwCard = $('#potwCard');
  const potwImg  = $('#potwImg');
  const potwText = $('#potwText');
  const potwMeta = $('#potwMeta');
  const potwJump = $('#potwJump');
  const potwEmpty= $('#potwEmpty');

  function updatePotwCard(){
    if(!currentPotw){
      // No winner yet: show encouragement, hide jump & details
      potwText.textContent = '';
      potwMeta.textContent = '';
      potwImg.style.display = 'none';
      potwEmpty.style.display = 'block';
      potwJump.disabled = true;
      potwJump.style.opacity = .5;
      return;
    }
    potwEmpty.style.display = 'none';
    potwJump.disabled = false;
    potwJump.style.opacity = 1;

    // Truncate message (120 chars)
    const t = (currentPotw.text || '').trim();
    potwText.textContent = t.length>120 ? (t.slice(0,120)+'…') : t;

    // Truncate author (20 chars)
    const who = (currentPotw.authorName || 'Anon');
    const whoShort = who.length>20 ? (who.slice(0,20)+'…') : who;

    const net = Math.max(0, (currentPotw.likes||0)-(currentPotw.dislikes||0));
    potwMeta.textContent = `${whoShort} • ${net} likes`;

    if(currentPotw.imageUrl){ potwImg.src=currentPotw.imageUrl; potwImg.style.display='block'; }
    else { potwImg.style.display='none'; }

    potwJump.onclick = ()=>{
      const ll = L.latLng(currentPotw.lat, currentPotw.lon);
      // Always fly to and zoom, regardless of visibility
      map.flyTo(ll, 17, { duration: 0.6, easeLinearity: 0.25 });
      // Pulse marker (if already rendered)
      const m = markers.get(currentPotw.id);
      if(m && m._icon){
        m._icon.classList.remove('potw-pulse');
        void m._icon.offsetWidth; // restart animation
        m._icon.classList.add('potw-pulse');
      }
    };
  }

  function eligibleForPotw(p){
  // Basic doc checks
  if(!p) { console.debug('[PotW skip] no doc'); return false; }
  if(p.status === 'hidden'){ console.debug('[PotW skip]', p.id, 'hidden'); return false; }
  if(!p.createdAt || !p.createdAt.toDate){ console.debug('[PotW skip]', p.id, 'no createdAt'); return false; }

  // Weekly window (Montreal time)
  const t = p.createdAt.toDate().getTime();
  if(!isThisWeek(t)){ console.debug('[PotW skip]', p.id, 'not this week'); return false; }

  // Must be inside the 1-mile circle (same rule you use for map)
  if(!inFence(p)){ console.debug('[PotW skip]', p.id, 'outside fence'); return false; }

  // No minimum likes: top NET wins even if 0
  return true;
}


  async function authorName(uid){
    try{
      const d = await usersRef.doc(uid).get();
      return d.exists ? (d.data().displayName || 'Anon') : 'Anon';
    }catch{ return 'Anon'; }
  }

  // Compare two pings for PotW using net likes, then "first to reach N" milestones (firstNetAt)
  function betterPotwCandidate(a,b){
  const aNet = Math.max(0,(a.likes||0)-(a.dislikes||0));
  const bNet = Math.max(0,(b.likes||0)-(b.dislikes||0));

  if(aNet !== bNet) return aNet > bNet ? a : b;

  // Tie on net: "first to reach N net"
  const N = aNet;
  const aTsObj = a.firstNetAt && a.firstNetAt[String(N)];
  const bTsObj = b.firstNetAt && b.firstNetAt[String(N)];

  const aTs = (aTsObj && typeof aTsObj.toDate === 'function') ? aTsObj.toDate().getTime() : null;
  const bTs = (bTsObj && typeof bTsObj.toDate === 'function') ? bTsObj.toDate().getTime() : null;

  // If one has a real milestone and the other doesn’t, the one with the milestone wins
  if(aTs && !bTs) return a;
  if(bTs && !aTs) return b;

  // If both have milestones, earliest wins
  if(aTs && bTs && aTs !== bTs) return aTs < bTs ? a : b;

  // Fallback (very rare): earlier createdAt
  const aC = a.createdAt?.toDate?.().getTime() ?? Infinity;
  const bC = b.createdAt?.toDate?.().getTime() ?? Infinity;
  return aC < bC ? a : b;
}



  async function recomputePotw(){
  let top = null, eligible = 0;

  lastPingCache.forEach((p)=>{
    if(!eligibleForPotw(p)) return;
    eligible++;
    top = top ? betterPotwCandidate(top,p) : p;
  });

  const prev = currentPotw ? currentPotw.id : null;

  if(top){
    const name = await authorName(top.authorId);
    currentPotw = {
      id: top.id, text: top.text || '',
      likes: top.likes||0, dislikes: top.dislikes||0,
      imageUrl: top.imageUrl||null, lat: top.lat, lon: top.lon,
      authorId: top.authorId, authorName: name,
      firstNetAt: top.firstNetAt || {}
    };
  }else{
    currentPotw = null;
  }

  // Debug: one concise line so we can see what's happening
  try{
    const net = top ? Math.max(0,(top.likes||0)-(top.dislikes||0)) : null;
    console.log('[PotW]', {eligible, winner: top?.id || '(none)', net});
  }catch{}

  if(prev !== (currentPotw ? currentPotw.id : null)){
    // Notify PotW winner when a new winner is set
    try{
      if(currentPotw && currentPotw.authorId){
        usersRef.doc(currentPotw.authorId).collection('notifications').add({
          type:'potw_awarded',
          pingId: currentPotw.id,
          net: currentPotw.net || netLikes(lastPingCache.get(currentPotw.id) || {}),
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
    }catch(e){ console.warn('potw notify failed', e); }

    restyleMarkers(); reFilterMarkers();
    potwCard.style.transform = 'translateX(-50%) scale(1.015)';
    setTimeout(()=> potwCard.style.transform='translateX(-50%) scale(1)', 450);
  }else{
    restyleMarkers();
  }
  updatePotwCard();
}

    // 

  // PotW listeners: need this week's window, not just 24h
  let potwUnsub = null;
  function startPotwListener(){
    if(potwUnsub) potwUnsub();
    const wStart = startOfWeekMondayLocal();
    potwUnsub = pingsRef.where('createdAt','>=', wStart).orderBy('createdAt','desc').limit(1000).onSnapshot(s=>{
      s.docChanges().forEach(ch=>{
        const p = { id: ch.doc.id, ...ch.doc.data() };
        lastPingCache.set(p.id,p);
      });
      recomputePotw().catch(console.error);
    }, e=>console.error(e));
  }
  startPotwListener();

  /* --------- Auth state --------- */
  auth.onAuthStateChanged(async (u)=>{
    try{ await refreshAuthUI(u); }catch(e){ console.error('onAuthStateChanged', e); }
    // Refresh live markers when auth changes to prevent stale filter states
    try{ reFilterMarkers(); }catch(_){ }
  });
  auth.onIdTokenChanged(async (u)=>{
    try{ await refreshAuthUI(u); }catch(e){ console.error('onIdTokenChanged', e); }
  });
  // Initial paint if already signed in from a previous session
  try{ if(auth.currentUser){ await refreshAuthUI(auth.currentUser); } }catch(e){ }

  // Ultra-robust UI sync loop: ensure UI reflects auth state even if events are missed
  (function startAuthUISync(){
    let lastUid = null; let lastAnon = null;
    setInterval(()=>{
      try{
        const u = auth.currentUser || null;
        const uid = u ? u.uid : null; const isAnon = !!(u && u.isAnonymous);
        const authBarVisible = false;
        const chipVisible    = false;

        const needsFlip = (
          (u && authBarVisible) || (!u && chipVisible) ||
          (uid !== lastUid) || (isAnon !== lastAnon)
        );

        if(needsFlip){ forceAuthUI(u); }
        lastUid = uid; lastAnon = isAnon;
      }catch(_){}
    }, 400);
  })();


  /* --------- Start PotW recompute cadence as safety --------- */
  setInterval(()=>{ recomputePotw().catch(console.error); }, 15*1000);

  /* --------- Ensure buttons are enabled on load ---------- */
  setTimeout(() => {
    applyModalOpenClass();
  }, 100);

  /* --------- Friends toggle initial ---------- */
  const toast = (m)=>showToast(m);
});

