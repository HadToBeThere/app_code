window.addEventListener('load', async () => {
  /* --------- Splash --------- */
  const splash = document.getElementById('splash');
  const startGlobe = document.getElementById('startGlobe');
  const openCreateAccount = document.getElementById('openCreateAccount');
  const openSignIn = document.getElementById('openSignIn');
  const continueGuest = document.getElementById('continueGuest');
  startGlobe.addEventListener('click', () => { splash.style.opacity='0'; setTimeout(()=>splash.style.display='none',450); });
  openCreateAccount.onclick = ()=> openModal('createAcctModal');
  openSignIn.onclick = ()=> openModal('signInModal');
  continueGuest.onclick = ()=> enterGuest();

  /* --------- Config --------- */
  const DEFAULT_CENTER = [45.5048, -73.5772];
  const RADIUS_M = 1609; // 1 mile
  const MAX_PINGS_PER_DAY = 3;
  const MIN_MILLIS_BETWEEN_PINGS = 5*60*1000; // 5 minutes
  const LIVE_WINDOW_MS = 24*3600*1000;

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

  /* --------- Helpers --------- */
  const $ = s=>document.querySelector(s);
  const $$ = s=>document.querySelectorAll(s);
  const toastEl = $('#toast');
  const showToast=(msg)=>{ toastEl.textContent=msg; toastEl.classList.add('show'); setTimeout(()=>toastEl.classList.remove('show'),6000); };
  function openModal(id){ document.getElementById(id).classList.add('open'); }
  function closeModal(id){ document.getElementById(id).classList.remove('open'); }

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

  if(currentUser){
    // Hide auth bar, show chip
    authBar.style.display='none';
    userChip.style.display='inline-flex';
    userChip.textContent = currentUser.isAnonymous ? 'Guest' : (currentUser.displayName || 'Signed in');

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

    // Close splash if still visible
    if(splash && splash.style.display!=='none'){
      splash.style.opacity='0'; setTimeout(()=>splash.style.display='none',450);
    }
  } else {
    // Signed out
    authBar.style.display='flex'; userChip.style.display='none';
    myFriends = new Set();
    if(typeof notifUnsub === 'function') notifUnsub();
    notifBadge.style.display='none';
    disableColorZone();
    $('#quotaText').textContent=`0/${MAX_PINGS_PER_DAY} pings today`;
    reFilterMarkers();
  }

  // Re-evaluate PotW after any auth change (filters/me/friends may differ)
  recomputePotw().catch(console.error);
}


  // Montreal start-of-week (Monday 00:00)
  function startOfWeekMontreal(d=new Date()){
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
    const parts = fmt.formatToParts(d).reduce((o,p)=> (o[p.type]=p.value, o), {});
    const y = +parts.year, m = +parts.month, day = +parts.day;
    const todayMid = new Date(new Date(`${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}T00:00:00`).toLocaleString('en-CA', { timeZone: TZ }));
    const dow = new Date(todayMid.toLocaleString('en-CA', { timeZone: TZ })).getDay(); // 0=Sun
    const daysFromMon = (dow===0 ? 6 : dow-1);
    const ms = todayMid.getTime() - daysFromMon*ONE_DAY;
    return new Date(ms);
  }
  function isThisWeek(ts){
    const wStart = startOfWeekMontreal();
    return ts >= wStart.getTime();
  }

  /* --------- Auth UI --------- */
  const authBar=$('#authBar'), userChip=$('#userChip');
  $('#openSignInTop').onclick=()=>openModal('signInModal');
  $('#openCreateTop').onclick=()=>openModal('createAcctModal');
  $('#guestTop').onclick=()=>enterGuest();

  $('#closeSignIn').onclick=()=>closeModal('signInModal');
  $('#closeCreate').onclick=()=>closeModal('createAcctModal');

  // Email/password sign in
  $('#doSignIn').onclick = async ()=>{
    try{
      const email=$('#siEmail').value.trim(), pass=$('#siPass').value;
      await auth.signInWithEmailAndPassword(email, pass);
      closeModal('signInModal');
    }catch(e){ console.error(e); showToast(e.message||'Sign in failed'); }
  };

  // Google sign in (block brand-new accounts)
  $('#doGoogle').onclick = async ()=>{
    try{
      const provider = new firebase.auth.GoogleAuthProvider();
      const result = await auth.signInWithPopup(provider);
      if(result.additionalUserInfo && result.additionalUserInfo.isNewUser){
        try{ await result.user.delete(); }catch(_){} 
        await auth.signOut();
        showToast('This Google account isn’t linked here yet. Please Create account first.');
        return;
      }
      closeModal('signInModal');
    }catch(e){
      console.error(e);
      showToast(e.message || 'Google sign-in failed');
    }
  };

  // Create account
  // Google sign in — supports:
// 1) New users (creates their profile doc)
// 2) Upgrading an anonymous guest via linkWithPopup
// Google sign in — handles new users and upgrading a Guest via link
$('#doGoogle').onclick = async () => {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    let result;
    const userBefore = auth.currentUser;

    if (userBefore && userBefore.isAnonymous) {
      // Upgrade Guest to Google
      result = await userBefore.linkWithPopup(provider);
    } else {
      // Normal Google sign-in
      result = await auth.signInWithPopup(provider);
    }

    const user = result.user;
    if (!user) throw new Error('Google sign-in returned no user');

    // Create/merge user doc on first sign-in
    const isNew = !!(result.additionalUserInfo && result.additionalUserInfo.isNewUser);
    if (isNew) {
      await usersRef.doc(user.uid).set({
        displayName: user.displayName || 'Friend',
        email: user.email || null,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        friendIds: [],
        lastPingAt: null,
        unreadCount: 0,
        isSubscriber: false
      }, { merge: true });
    } else {
      await usersRef.doc(user.uid).set({
        displayName: user.displayName || 'Friend'
      }, { merge: true });
    }

    // Close the modal now
    document.getElementById('signInModal').classList.remove('open');

    // 🔑 Immediately refresh UI (even if onAuthStateChanged doesn't fire)
    await refreshAuthUI(user);

  } catch (e) {
    console.error(e);
    let msg = e && e.message ? e.message : 'Google sign-in failed';
    if (e.code === 'auth/unauthorized-domain') {
      msg = 'Unauthorized domain: add your dev origin to Firebase Auth → Settings → Authorized domains.';
    } else if (e.code === 'auth/operation-not-allowed') {
      msg = 'Enable the Google provider in Firebase Auth → Sign-in method.';
    } else if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user') {
      msg = 'Popup was blocked/closed. Allow popups and try again.';
    } else if (e.code === 'auth/credential-already-in-use') {
      msg = 'This Google account is already linked to another user. Sign out and use Sign in (not link).';
    }
    showToast(msg);
  }
};

        


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

  userChip.onclick = async ()=>{ try{ await auth.signOut(); showToast('Signed out'); }catch(e){ showToast('Sign out failed'); } };

  /* --------- Map --------- */
  const map = L.map('map',{ center:DEFAULT_CENTER, zoom:15, minZoom:0, maxZoom:22, zoomAnimation:true, markerZoomAnimation:true, fadeAnimation:true, zoomSnap:.5, wheelPxPerZoomLevel:45, wheelDebounceTime:40, scrollWheelZoom:true, doubleClickZoom:false, dragging:true, touchZoom:'center' });
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

  /* --------- Friends toggle ---------- */
  const leftbar = document.getElementById('leftbar');
  const friendsToggle = document.getElementById('friendsToggle');
  function updateFriendsToggle(){
    if(leftbar.classList.contains('hidden')){
      friendsToggle.textContent = 'Show Friends ▶';
      friendsToggle.style.top = '60px';
    }else{
      friendsToggle.textContent = 'Hide Friends ◀';
      friendsToggle.style.top = '112px';
    }
  }
  friendsToggle.onclick = ()=>{ leftbar.classList.toggle('hidden'); updateFriendsToggle(); };
  updateFriendsToggle();

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
    const since=Date.now()-LIVE_WINDOW_MS;
    unsubscribe=pingsRef.where('createdAt','>=',new Date(since))
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
  async function refreshQuota(uid){ const used=await todayCount(uid); $('#quotaText').textContent=`${Math.min(used,MAX_PINGS_PER_DAY)}/${MAX_PINGS_PER_DAY} pings today`; return used; }

  /* --------- S3 upload STUB (replace later) --------- */
  async function uploadImageToS3(file){
    return 'https://via.placeholder.com/800x600.png?text=Ping+Image';
  }

  /* --------- Create ping --------- */
  const attachInput = $('#pingImage');
  const subscribeBtn = $('#subscribeBtn');

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
  };
  $('#cancelCreate').onclick=()=>closeModal('createModal');

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
      if(Date.now()-lastAt < MIN_MILLIS_BETWEEN_PINGS) return showToast('Slow down—try again in a few minutes');
      const used=await refreshQuota(currentUser.uid);
      if(used>=MAX_PINGS_PER_DAY) return showToast('Daily limit reached');

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
        imageUrl = await uploadImageToS3(file); // replace later
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
  const reactBar=$('#reactBar'), commentsEl=$('#comments'), commentInput=$('#commentInput');
  let openId=null, openUnsub=null, openCommentsUnsub=null;

  function openSheet(id){
    if(openUnsub) openUnsub(); if(openCommentsUnsub) openCommentsUnsub();
    openId=id; sheet.classList.add('open');

    openUnsub = pingsRef.doc(id).onSnapshot(doc=>{
      if(!doc.exists){ sheet.classList.remove('open'); return; }
      const p={id:doc.id, ...doc.data()}; lastPingCache.set(p.id,p);
      const mins=p.createdAt?.toDate ? Math.floor((Date.now()-p.createdAt.toDate().getTime())/60000) : 0;
      sheetText.textContent=p.text; sheetMeta.textContent=`Near ${Number(p.lat).toFixed(5)}, ${Number(p.lon).toFixed(5)} • ${Math.max(0,mins)}m ago`;
      if(p.imageUrl){ sheetImgEl.src=p.imageUrl; sheetImage.style.display='block'; } else { sheetImage.style.display='none'; }
      renderVoteBar(p); upsertMarker(p);
    });

    openCommentsUnsub = pingsRef.doc(id).collection('comments').orderBy('createdAt','desc').limit(200).onSnapshot(s=>{
      commentsEl.innerHTML=''; s.forEach(d=>{
        const c=d.data(); const mins=c.createdAt?.toDate ? Math.floor((Date.now()-c.createdAt.toDate().getTime())/60000) : 0;
        const div=document.createElement('div'); div.className='comment'; div.innerHTML=`${c.text}<br/><small>${Math.max(0,mins)}m ago</small>`; commentsEl.appendChild(div);
      });
    });
  }
  $('#closeSheet').onclick=()=>{ sheet.classList.remove('open'); if(openUnsub) openUnsub(); if(openCommentsUnsub) openCommentsUnsub(); openId=null; };

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
      // Notify both
      usersRef.doc(fromUid).collection('notifications').add({ type:'friend_accept', partner: toUid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      usersRef.doc(toUid).collection('notifications').add({ type:'friend_accept', partner: fromUid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      await refreshFriends();
      return;
    }

    // Create pending request
    await db.collection('friendRequests').doc(fromUid+'_'+toUid).set({
      from: fromUid, to: toUid, status:'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    // Notify recipient
    usersRef.doc(toUid).collection('notifications').add({ type:'friend_req', from: fromUid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
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
    usersRef.doc(fromUid).collection('notifications').add({ type:'friend_accept', partner: currentUser.uid, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
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

  // Requests UI
  let reqInUnsub=null, reqOutUnsub=null;
  function startRequestsListeners(uid){
    if(reqInUnsub) reqInUnsub(); if(reqOutUnsub) reqOutUnsub();
    const inRef = db.collection('friendRequests').where('to','==',uid).where('status','==','pending').orderBy('createdAt','desc');
    const outRef= db.collection('friendRequests').where('from','==',uid).where('status','==','pending').orderBy('createdAt','desc');
    reqInUnsub = inRef.onSnapshot(()=>updateRequestsUI().catch(console.error));
    reqOutUnsub = outRef.onSnapshot(()=>updateRequestsUI().catch(console.error));
  }

  async function updateRequestsUI(){
    const cont = document.getElementById('requestsList'); if(!cont) return;
    if(!currentUser){ cont.innerHTML='<div class="muted">Sign in to see requests.</div>'; return; }
    const inSS  = await db.collection('friendRequests').where('to','==',currentUser.uid).where('status','==','pending').orderBy('createdAt','desc').get();
    const outSS = await db.collection('friendRequests').where('from','==',currentUser.uid).where('status','==','pending').orderBy('createdAt','desc').get();

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
/* --------- Friends (left bar) --------- */
  const friendList=$('#friendList'); const myCodeEl=$('#myCode');
  $('#refreshFriendsBtn').onclick=()=>refreshFriends();
  $('#copyCode').onclick=()=>{ myCodeEl.select(); document.execCommand('copy'); showToast('Copied code'); };

  $('#friendSearchBtn').onclick=async()=>{
    const q=$('#friendSearch').value.trim(); if(!q) return;
    try{
      let match=null;
      const qs = await usersRef.where('email','==',q).limit(1).get();
      if(!qs.empty){ match={ id:qs.docs[0].id, ...qs.docs[0].data() }; }
      if(!match && q.length>10){ const doc=await usersRef.doc(q).get(); if(doc.exists) match={ id:doc.id, ...doc.data() }; }
      if(match){ $('#addFriendInput').value = match.id; showToast(`Found: ${match.displayName||'Friend'}`); }
      else{ showToast('No match found'); }
    }catch(e){ console.error(e); showToast('Search failed'); }
  };

  
  $('#addFriendBtn').onclick=async()=>{
    const raw=$('#addFriendInput').value.trim(); if(!raw) return;
    if(!currentUser) return showToast('Sign in first');
    const q=raw.toLowerCase();
    try{
      const targetUid = await resolveUserByHandleOrEmail(q);
      if(!targetUid){ showToast('No user found'); return; }
      if(targetUid===currentUser.uid){ showToast('That’s you!'); return; }
      await sendFriendRequest(currentUser.uid, targetUid);
      $('#addFriendInput').value=''; showToast('Friend request sent'); await updateRequestsUI();
    }catch(e){ console.error(e); showToast('Could not send request'); }
  };


  async function refreshFriends(){
    if(!currentUser){ friendList.innerHTML='<div class="muted">Sign in to manage friends.</div>'; return; }
    const doc=await usersRef.doc(currentUser.uid).get(); const data=doc.exists? doc.data():{friendIds:[], isSubscriber:false};
    myFriends=new Set(data.friendIds||[]); myCodeEl.value=currentUser.uid; isSubscriber = !!data.isSubscriber;
    friendList.innerHTML='';
    if(!myFriends.size){ friendList.innerHTML='<div class="muted">No friends yet. Share your code above.</div>'; reFilterMarkers(); return; }
    for(const fid of myFriends){
      const fdoc=await usersRef.doc(fid).get(); const nm=fdoc.exists ? (fdoc.data().displayName||'Friend') : 'Friend';
      const row=document.createElement('div'); row.className='friend-item';
      row.innerHTML=`<div><strong>${nm}</strong><br/><small style="font-family:monospace">${fid}</small></div>`;
      const rm=document.createElement('button'); rm.className='btn'; rm.textContent='Remove';
      rm.onclick=async()=>{ await usersRef.doc(currentUser.uid).set({ friendIds: firebase.firestore.FieldValue.arrayRemove(fid) },{merge:true}); await usersRef.doc(fid).set({ friendIds: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) },{merge:true}); showToast('Removed'); refreshFriends(); };
      row.appendChild(rm); friendList.appendChild(row);
    }
    reFilterMarkers();
  }

  /* --------- Notifications --------- */
  const notifBadge=$('#notifBadge'), notifsModal=$('#notifsModal'), notifsContent=$('#notifsContent');
  $('#closeNotifs').onclick=()=>closeModal('notifsModal');
  $('#bellBtn').onclick=async()=>{
    if(!currentUser) return showToast('Sign in to view notifications');
    openModal('notifsModal');
    await usersRef.doc(currentUser.uid).set({ unreadCount: 0 }, { merge:true });
    notifBadge.style.display='none';
  };
  let notifUnsub=null;
  function startNotifListener(uid){
    if(notifUnsub) notifUnsub();
    notifUnsub = usersRef.doc(uid).collection('notifications').orderBy('createdAt','desc').limit(50).onSnapshot(s=>{
      if(s.empty){ notifsContent.textContent='No notifications yet.'; return; }
      notifsContent.innerHTML='';
      s.docChanges().forEach(ch=>{
        if(ch.type==='added'){
          const n=ch.doc.data();
          const line=document.createElement('div');
          if(n.type==='friend_req'){ 
            line.className='notif req';
            const from = n.from;
            line.innerHTML = '<div class="notif-row"><div>Friend request</div><div class="notif-actions"><button class="btn" id="acc_'+ch.doc.id+'">✓</button><button class="btn" id="dec_'+ch.doc.id+'">✕</button></div></div>';
            notifsContent.prepend(line);
            setTimeout(()=>{
              const acc = document.getElementById('acc_'+ch.doc.id); const dec = document.getElementById('dec_'+ch.doc.id);
              if(acc) acc.onclick=()=>acceptFriendRequest(from+'_'+currentUser.uid).then(()=>closeModal('notifsModal')).catch(console.error);
              if(dec) dec.onclick=()=>declineFriendRequest(from+'_'+currentUser.uid).catch(console.error);
            });
            if(!document.getElementById('notifsModal').classList.contains('open')){
              notifBadge.style.display='inline-block';
              notifBadge.textContent = String((Number(notifBadge.textContent||'0')||0)+1);
              showToast('🔔 New friend request');
            }
          } else if(n.type==='friend_accept'){ 
            line.textContent = 'Friend request accepted.';
            notifsContent.prepend(line);
            if(!document.getElementById('notifsModal').classList.contains('open')){
              notifBadge.style.display='inline-block';
              notifBadge.textContent = String((Number(notifBadge.textContent||'0')||0)+1);
              showToast('✅ Friend accepted');
            }
          } else if(n.type==='potw_awarded'){ 
            line.textContent = 'Your ping won Ping of the Week!';
            notifsContent.prepend(line);
            if(!document.getElementById('notifsModal').classList.contains('open')){
              notifBadge.style.display='inline-block';
              notifBadge.textContent = String((Number(notifBadge.textContent||'0')||0)+1);
              showToast('🏆 Ping of the Week!');
            }
          } else if(n.type==='friend_ping'){
            line.textContent = 'A friend just dropped a ping.';
            notifsContent.prepend(line);
            if(document.getElementById('notifsModal').classList.contains('open')===false){
              notifBadge.style.display='inline-block';
              const current = Number(notifBadge.textContent||'0') || 0;
              notifBadge.textContent = String(current+1);
              showToast('🔔 Friend pinged nearby');
            }
          }
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
      if(map.getBounds().contains(ll)){
        // already visible — pulse the marker once
        const m = markers.get(currentPotw.id);
        if(m && m._icon){
          m._icon.classList.remove('potw-pulse');
          // force reflow to restart animation
          void m._icon.offsetWidth;
          m._icon.classList.add('potw-pulse');
        }
      }else{
        map.flyTo(ll, 17, { duration: 0.6, easeLinearity: 0.25 });
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
    const wStart = startOfWeekMontreal();
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
  /* --------- Auth state --------- */

auth.onAuthStateChanged(async (u)=>{
  currentUser=u;
  if(u){
    authBar.style.display='none'; userChip.style.display='inline-flex';
    userChip.textContent = u.isAnonymous ? 'Guest' : (u.displayName || 'Signed in');

    enableColorZone();

    if(!u.isAnonymous){
      await usersRef.doc(u.uid).set({ displayName: u.displayName || 'Friend' }, { merge:true });
      await refreshQuota(u.uid);
      await refreshFriends();
      startNotifListener(u.uid);
      await ensureIdentityMappings(u);
startRequestsListeners(u.uid);

    }else{
      $('#quotaText').textContent=`0/${MAX_PINGS_PER_DAY} pings today`;
      await refreshFriends();
    }
  } else {
    authBar.style.display='flex'; userChip.style.display='none';
    myFriends=new Set(); if(notifUnsub) notifUnsub();
    notifBadge.style.display='none';
    disableColorZone();
    $('#quotaText').textContent=`0/${MAX_PINGS_PER_DAY} pings today`;
    reFilterMarkers();
  }
  recomputePotw().catch(console.error);
});


  /* --------- Start PotW recompute cadence as safety --------- */
  setInterval(()=>{ recomputePotw().catch(console.error); }, 15*1000);

  /* --------- Friends toggle initial ---------- */
  const toast = (m)=>showToast(m);
});

