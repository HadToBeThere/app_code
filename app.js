async function main(){
  /* --------- Splash --------- */
  const splash = document.getElementById('splash');
  const startGlobe = document.getElementById('startGlobe');
  const appRoot = document.getElementById('app');
  // Splash: animate earth mask to map, then hide
  // Subtle scale/fade on the small globe, zoom the map behind, then fade splash
  startGlobe.addEventListener('click', ()=>{
    try{
      // Remove container scaling; use native map zoom animation only
      try{ if(appRoot){ appRoot.classList.remove('scale-in'); appRoot.classList.remove('prestart-scale'); } }catch(_){ }
      // Instantly fade out the splash text/UI (keep globe slower)
      ['.apptitle','.bigq','.tagline','.logo-pin'].forEach(sel=>{ try{ const el=document.querySelector(sel); if(el){ el.style.transition='opacity .25s ease, transform .25s ease'; el.style.opacity='0'; el.style.transform='translateY(-6px)'; } }catch(_){ } });
      // Scale the globe strongly with a cinematic blur (kept)
      startGlobe.style.transform='scale(18)';
      startGlobe.style.filter='blur(6px)';
      startGlobe.style.opacity='0.0';
      const lbl=document.querySelector('.start-label'); if(lbl){ lbl.style.opacity='0'; lbl.style.transform='translateY(-6px)'; }
      // Fade splash while globe scales
      splash.style.transition='opacity 1.2s ease';
      splash.style.opacity='0';
      // Leaflet zoom animation in sync with globe (zoom OUT->IN)
      try{
        if(typeof map!=='undefined' && typeof FENCE_CENTER!=='undefined'){
          const centerCandidate = (typeof userPos!== 'undefined' && userPos && userPos.distanceTo(FENCE_CENTER) <= RADIUS_M) ? userPos : FENCE_CENTER;
          // Temporarily relax min zoom constraint so we can start wide
          try{ if(typeof map.setMinZoom==='function'){ map.setMinZoom(0); } }catch(_){ }
          // Ensure we start wide first, then zoom in to 16
          try{ map.setZoom(12, {animate:false}); }catch(_){ }
          map.flyTo(centerCandidate, 16, { animate:true, duration:1.2, easeLinearity:.25 });
        }
      }catch(_){ }
    }catch(_){ }
    // Fully remove splash after fade completes; minor settle pan/zoom after
    setTimeout(()=>{
      splash.style.display='none';
      // Restore normal view constraints after the zoom
      try{ updateViewConstraints(); }catch(_){ }
      // Enable hotspots only after intro animation completes
      try{ if(typeof enableHotspots==='function') enableHotspots(); }catch(_){ }
    }, 1250);
  });

  /* --------- Config --------- */
  const DEFAULT_CENTER = [45.5048, -73.5772];
  const RADIUS_M = 3219; // 2 miles
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
  // Persist session across reloads without changing splash behavior
  try{ await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); }catch(e){ console.warn('persistence', e); }

  /* --------- Helpers --------- */
  const $ = s=>document.querySelector(s);
  const $$ = s=>document.querySelectorAll(s);
  const toastEl = $('#toast');
  // Toast system with types and queue
  const toastQueue = [];
  let toastShowing = false;
  function showToast(message, type='info'){
    try{
      const duration = type==='error' ? 5000 : type==='warning' ? 4000 : 3000;
      toastQueue.push({ message:String(message||''), type, duration });
      if(!toastShowing) dequeueToast();
    }catch(_){ }
  }
  function styleToast(kind){
    try{
      toastEl.className = 'toast show';
      // Basic color coding by type without changing layout
      if(kind==='success'){ toastEl.style.background='#111'; toastEl.style.border='1px solid #16a34a'; }
      else if(kind==='error'){ toastEl.style.background='#111'; toastEl.style.border='1px solid #ef4444'; }
      else if(kind==='warning'){ toastEl.style.background='#111'; toastEl.style.border='1px solid #f59e0b'; }
      else { toastEl.style.background='#111'; toastEl.style.border='1px solid #e6e6e6'; }
    }catch(_){ }
  }
  function dequeueToast(){
    if(!toastQueue.length){ toastShowing=false; try{ toastEl.classList.remove('show'); }catch(_){ } return; }
    toastShowing = true;
    const { message, type, duration } = toastQueue.shift();
    try{ toastEl.textContent = message; styleToast(type); }catch(_){ }
    setTimeout(()=>{
      try{ toastEl.classList.remove('show'); }catch(_){ }
      setTimeout(()=>{ dequeueToast(); }, 120);
    }, duration);
  }
  function montrealNow(){ try{ return new Date(new Date().toLocaleString('en-US', { timeZone: TZ })); }catch(_){ return new Date(); } }
  function dateKey(d){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const day=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${day}`; }

  // Reverse geocoding (OSM Nominatim) with simple localStorage cache
  const GEOCODE_CACHE_KEY = 'htbt_geocode_cache_v1';
  let geocodeCache = {};
  try{ const raw=localStorage.getItem(GEOCODE_CACHE_KEY); if(raw) geocodeCache=JSON.parse(raw)||{}; }catch(_){ geocodeCache={}; }
  function saveGeocodeCache(){ try{ localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(geocodeCache)); }catch(_){ } }
  function geokey(lat, lon){ return `${lat.toFixed(4)},${lon.toFixed(4)}`; }
  function pickArea(addr){ return addr.neighbourhood||addr.suburb||addr.city_district||addr.borough||addr.village||addr.town||addr.city||addr.county||''; }
  function formatPlace(addr){
    try{
      const road = addr.road || addr.pedestrian || addr.residential || addr.footway || addr.path || addr.cycleway || '';
      const area = pickArea(addr);
      if(road && area) return `${road}, ${area}`;
      if(area) return `${area}`;
      const disp = addr.display_name || '';
      if(disp) return disp.split(',').slice(0,3).join(', ').trim();
    }catch(_){ }
    return '';
  }
  async function reverseGeocode(lat, lon){
    const key = geokey(lat, lon);
    const cached = geocodeCache[key];
    const now = Date.now();
    if(cached && (now - (cached.ts||0) < 14*24*3600*1000) && cached.label){ return cached.label; }
    try{
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&zoom=17&addressdetails=1&accept-language=en`;
      const res = await fetch(url, { headers:{ 'Accept':'application/json' } });
      if(!res.ok) throw new Error('geocode http');
      const j = await res.json();
      const addr = j && (j.address||{});
      const label = formatPlace(addr) || (j.display_name ? String(j.display_name).split(',').slice(0,3).join(', ').trim() : '');
      if(label){ geocodeCache[key] = { label, ts: now }; saveGeocodeCache(); return label; }
    }catch(_){ }
    return '';
  }

  // ---------- Mentions helpers ----------
  const uidHandleCache = new Map();
  async function getHandleForUid(uid){
    if(!uid) return '@user';
    if(uidHandleCache.has(uid)) return uidHandleCache.get(uid);
    try{
      const d = await usersRef.doc(uid).get();
      const u = d.exists ? d.data() : null;
      const h = u && u.handle ? String(u.handle).trim() : '';
      if(h){
        const display = `@${h}`;
        uidHandleCache.set(uid, display);
        return display;
      }
      // Do not cache fallback to avoid masking later real handle
      return `@user${String(uid).slice(0,6)}`;
    }catch(_){
      return `@user${String(uid).slice(0,6)}`;
    }
  }

  const HANDLE_RE = /(^|[^a-z0-9_.])@([a-z0-9_.]{2,24})\b/i;
  function extractSingleMention(text){
    if(!text) return { kind:'none' };
    const m = text.match(HANDLE_RE);
    if(!m) return { kind:'none' };
    const handle = m[2];
    if(handle.toLowerCase()==='friends') return { kind:'friends', start: m.index + m[1].length, end: (m.index + m[0].length), raw:`@${m[2]}` };
    // Ensure there isn't a second @handle
    const rest = text.slice((m.index||0) + m[0].length);
    if(HANDLE_RE.test(rest)) return { kind:'invalid_multi' };
    return { kind:'handle', handleLC: handle.toLowerCase(), start: m.index + m[1].length, end: (m.index + m[0].length), raw:`@${m[2]}` };
  }

  async function resolveHandleToUid(handleLC){
    try{
      const doc = await db.collection('handles').doc(handleLC).get();
      const uid = doc.exists ? (doc.data().uid||null) : null;
      if(!uid) return null;
      // Validate that the user doc still claims this handle. If not, treat as unused.
      try{
        const u = await usersRef.doc(uid).get();
        const h = u && u.exists ? String(u.data().handle||'').trim().toLowerCase() : '';
        if(h !== handleLC) return null;
      }catch(_){ return null; }
      return uid;
    }catch(_){ return null; }
  }

  async function incMentionQuotaOrFail(senderUid){
    try{
      const day = dateKey(montrealNow());
      const id = `mention_quota_${senderUid}_${day}`;
      let ok = false;
      await db.runTransaction(async (tx)=>{
        const ref = db.collection('meta').doc(id);
        const snap = await tx.get(ref);
        const count = snap.exists ? Number(snap.data().count||0) : 0;
        if(count >= 20){ ok=false; return; }
        tx.set(ref, { count: count+1, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
        ok = true;
      });
      return ok;
    }catch(_){ return false; }
  }

  async function notifyMention(recipientUid, payload){
    try{
      if(!recipientUid) return;
      const dedupeId = payload.kind+ '_' + payload.key;
      await db.runTransaction(async (tx)=>{
        const nref = usersRef.doc(recipientUid).collection('notifications').doc(dedupeId);
        const ns = await tx.get(nref);
        if(ns.exists) return;
        tx.set(nref, { type:'mention', from: payload.from, pingId: payload.pingId||null, commentId: payload.commentId||null, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
      });
    }catch(_){ }
  }

  function renderTextWithMentions(container, text, mentions){
    try{
      container.textContent='';
      if(!text){ return; }
      const parts = [];
      if(!Array.isArray(mentions) || mentions.length===0){ container.textContent = text; return; }
      // assume at most one mention; still robust for many
      let idx=0;
      const sorted = [...mentions].sort((a,b)=> (Number(a.start||0)) - (Number(b.start||0)));
      for(const m of sorted){
        const s = Number(m.start||0), e = Number(m.end||s);
        if(s>idx){ parts.push({ kind:'text', text: text.slice(idx,s) }); }
        parts.push({ kind:'mention', uid: m.uid, raw: text.slice(s,e) });
        idx = e;
      }
      if(idx < text.length){ parts.push({ kind:'text', text: text.slice(idx) }); }
      const frag = document.createDocumentFragment();
      let pendingResolves = [];
      for(const p of parts){
        if(p.kind==='text'){ frag.appendChild(document.createTextNode(p.text)); }
        else if(p.kind==='mention'){ const span=document.createElement('button'); span.className='btn'; span.style.padding='0 6px'; span.style.borderRadius='8px'; span.style.margin='0 2px'; span.style.fontWeight='800'; span.title='Open profile'; span.setAttribute('data-uid', p.uid||''); span.onclick=()=>{ if(p.uid) openOtherProfile(p.uid); }; span.textContent=p.raw||'@user'; frag.appendChild(span); pendingResolves.push({ el:span, uid:p.uid }); }
      }
      container.appendChild(frag);
      // Resolve display labels
      pendingResolves.forEach(async ({el,uid})=>{ const disp=await getHandleForUid(uid); if(disp){ el.textContent = disp; } });
    }catch(e){ try{ container.textContent = text; }catch(_){ } }
  }
  // Points (PPs) helpers
  async function awardPoints(uid, delta, reason){
    if(!uid || !Number.isFinite(delta) || delta===0) return;
    try{
      await db.runTransaction(async (tx)=>{
        const uref = usersRef.doc(uid);
        const usnap = await tx.get(uref);
        const prev = usnap.exists ? Number(usnap.data().points||0) : 0;
        const next = Math.max(0, prev + delta);
        tx.set(uref, { points: next }, { merge:true });
      });
    }catch(e){ console.warn('awardPoints failed', reason||'', e); }
  }

  // Once-per-day login award (+2 PPs), signed-in users only
  async function maybeAwardDailyLogin(uid){
    try{
      const todayKey = dateKey(montrealNow());
      await db.runTransaction(async (tx)=>{
        const ref = usersRef.doc(uid);
        const snap = await tx.get(ref);
        const last = snap.exists ? (snap.data().lastLoginDay || '') : '';
        if(last === todayKey) return; // already awarded
        const prev = snap.exists ? Number(snap.data().points||0) : 0;
        const next = Math.max(0, prev + 2);
        tx.set(ref, { points: next, lastLoginDay: todayKey }, { merge:true });
      });
    }catch(e){ console.warn('daily login award failed', e); }
  }

  // On first ping of the day: update ping streak and award floor(streak/2), cap 25; toast
  async function awardOnFirstPingOfDay(uid){
    try{
      const today = montrealNow();
      const todayKey = dateKey(today);
      const yesterday = new Date(today.getTime() - ONE_DAY);
      const yesterdayKey = dateKey(yesterday);
      await db.runTransaction(async (tx)=>{
        const ref = usersRef.doc(uid);
        const snap = await tx.get(ref);
        const data = snap.exists ? snap.data() : {};
        const lastPingDay = data.lastPingDay || '';
        let streak = Number(data.streakDays||0);
        let firstPingToday = false;
        if(lastPingDay === todayKey){
          // already pinged today: no streak change, no streak award
        }else if(lastPingDay === yesterdayKey){
          streak = Math.max(1, streak + 1);
          firstPingToday = true;
        }else{
          streak = 1; // reset
          firstPingToday = true;
        }
        // Always update lastPingDay on any ping
        const update = { lastPingDay: todayKey, streakDays: streak };
        // Streak award only once on first ping of the day
        if(firstPingToday){
          const alreadyAwardedDay = data.lastStreakAwardDay || '';
          if(alreadyAwardedDay !== todayKey){
            const bonus = Math.min(25, Math.floor(streak/2));
            const prevPts = Number(data.points||0);
            const nextPts = Math.max(0, prevPts + bonus);
            update.points = nextPts;
            update.lastStreakAwardDay = todayKey;
            // Toast after transaction commits (outside)
            tx.set(ref, update, { merge:true });
            throw { __postCommitToast: `🔥 +${bonus} PPs — streak ${streak} days` };
          }
        }
        tx.set(ref, update, { merge:true });
      });
    }catch(e){
      if(e && e.__postCommitToast){ showToast(e.__postCommitToast); return; }
      if(e && e.message && String(e.message).includes('__postCommitToast')){ return; }
      // normal errors
    }
  }
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
  function openModal(id){
    document.getElementById(id).classList.add('open');
    applyModalOpenClass();
    // Ensure profile modal shows own-profile chrome when opening as the signed-in user
    if(id==='profileModal'){
      try{ if(typeof applyProfileView==='function') applyProfileView(PROFILE_VIEW.OWN); }catch(_){ }
    }
  }
  function closeModal(id){ document.getElementById(id).classList.remove('open'); applyModalOpenClass(); }

  // Notifications elements (needed by refreshAuthUI even when signed out)
  const notifBadge = $('#notifBadge'), notifsModal = $('#notifsModal'), notifsContent = $('#notifsContent');

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
      if(nm) nm.textContent = handle ? `@${handle}` : `@user${String(currentUser.uid||'').slice(0,6)}`;
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
      try{ await maybeAwardDailyLogin(currentUser.uid); }catch(_){ }
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
  if(typeof recomputePotw === 'function') recomputePotw().catch(console.error);
}

  // Hard UI flip helper (in case listeners/races delay refresh)
  function forceAuthUI(user){
    try{ refreshAuthUI(user); }catch(_){ }
  }


  // Week start (Monday 00:00) in Montreal time
  function startOfWeekMondayLocal(now = new Date()){
    try{
      // Represent "now" in Montreal local time
      const tzNow = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
      const midnight = new Date(tzNow.getFullYear(), tzNow.getMonth(), tzNow.getDate(), 0, 0, 0, 0);
      const dow = tzNow.getDay(); // 0=Sun,1=Mon,... in Montreal
      const daysFromMon = (dow === 0 ? 6 : dow - 1);
      const tzMonday = new Date(midnight.getTime() - daysFromMon * ONE_DAY);
      // Convert back to real epoch by removing the same offset we added via toLocaleString
      const offset = tzNow.getTime() - now.getTime();
      return new Date(tzMonday.getTime() - offset);
    }catch(_){
      // Fallback to local timezone Monday if TZ logic fails
      const local = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const dow = local.getDay();
      const daysFromMon = (dow === 0 ? 6 : dow - 1);
      return new Date(local.getTime() - daysFromMon * ONE_DAY);
    }
  }
  function isThisWeek(ts){
    const wStart = startOfWeekMondayLocal();
    return ts >= wStart.getTime();
  }

  function endOfCurrentWeekLocal(){
    const start = startOfWeekMondayLocal();
    return new Date(start.getTime() + 7*ONE_DAY);
  }

  function potwEndsInText(){
    try{
      const end = endOfCurrentWeekLocal().getTime();
      const now = Date.now();
      const diff = Math.max(0, end - now);
      const hours = Math.floor(diff / (3600*1000));
      const days = Math.floor(hours / 24);
      const remH = hours % 24;
      if(days > 0) return `Ends in ${days}d ${remH}h`;
      const mins = Math.floor((diff % (3600*1000)) / (60*1000));
      if(hours > 0) return `Ends in ${hours}h ${mins}m`;
      const secs = Math.floor((diff % (60*1000)) / 1000);
      return `Ends in ${mins}m ${secs}s`;
    }catch(_){ return ''; }
  }

  /* --------- Auth UI --------- */
  const profileWidget = document.getElementById('profileWidget');
  const profileAvatar = document.getElementById('profileAvatar');
  const profileName = document.getElementById('profileName');
  // If returning from Google redirect, apply UI immediately
  // Do not auto open or redirect into sign-in; only when user clicks
  try{ const rr = await auth.getRedirectResult(); if(rr && rr.user){ /* keep splash until user presses start */ await refreshAuthUI(rr.user); } }catch(e){ console.warn('redirect result', e); }
  // Use event delegation for profile widget
  document.addEventListener('click', async (e) => {
    if(e.target.id === 'profileWidget' || e.target.closest('#profileWidget')){
      e.stopPropagation(); // Prevent map click handler from firing
        const u = auth.currentUser || null;
        if(!u){ openModal('signInModal'); return; }
        // Open modal and then flip to own profile reliably
        try{ openModal('profileModal'); }catch(_){ }
        try{ if(typeof applyProfileView==='function') applyProfileView(PROFILE_VIEW.OWN); }catch(_){ }
        // Load stats, avatar, friends (await to render before user interacts)
        try{ if(typeof openOwnProfile==='function') await openOwnProfile(); }catch(_){ }
        forceOwnProfileHeader();
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
        // Only initialize base fields; do NOT set handle here to avoid accidental resets
        try{
          await usersRef.doc(user.uid).set({
            email: user.email || null,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            friendIds: [], lastPingAt: null, unreadCount: 0
          }, { merge:true });
        }catch(_){ }
        // Ensure a handle exists if missing
        await ensureIdentityMappings(user);
      }else{
        // Do not overwrite custom profile fields on re-login except to backfill missing displayName
        try{
          const uref = usersRef.doc(user.uid); const snap = await uref.get();
          if(!snap.exists || !snap.data().email){ await uref.set({ email: user.email || null }, { merge:true }); }
        }catch(_){ }
        await ensureIdentityMappings(user);
      }
      try{ document.getElementById('signInModal').classList.remove('open'); }catch(e){}
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
            // Do not overwrite existing profile fields like handle on recovery
            try{ await usersRef.doc(user.uid).set({ email: user.email || null }, { merge:true }); }catch(_){ }
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
  const map = L.map('map',{ center:DEFAULT_CENTER, zoom:12, minZoom:0, maxZoom:22, zoomAnimation:true, markerZoomAnimation:true, fadeAnimation:true, zoomSnap:.5, wheelPxPerZoomLevel:45, wheelDebounceTime:40, scrollWheelZoom:true, doubleClickZoom:false, dragging:true, touchZoom:'center', zoomControl:false });
  // Hotspot overlay pane (below markers, above inner overlay)
  const HOTSPOT_RADIUS_M = 100;
  const HOTSPOT_MIN_CENTER_SEP_M = 150;
  const HOTSPOT_MAX_CLUSTERS = 3;
  try{ map.createPane('hotspotPane'); map.getPane('hotspotPane').style.zIndex = 500; }catch(_){ }
  let hotspotLayers=[], hotspotData=[], hotspotTimer=null;
  // Gate: do not render hotspots until intro animation completes
  let hotspotsEnabled = false;
  function enableHotspots(){ hotspotsEnabled = true; updateHotspotVisibility(); }

  function saveHotspot(dataArr){ try{ localStorage.setItem('hadToBeThere_hotspot', JSON.stringify({ list:dataArr, savedAt:Date.now() })); }catch(_){ } }
  function loadHotspot(){ try{ const s=localStorage.getItem('hadToBeThere_hotspot'); if(!s) return []; const parsed=JSON.parse(s); const arr=Array.isArray(parsed)? parsed : (Array.isArray(parsed.list)? parsed.list: []); return arr.filter(d=>d && typeof d.lat==='number' && typeof d.lon==='number'); }catch(_){ return []; } }

  function clearHotspot(){ if(hotspotLayers&&hotspotLayers.length){ hotspotLayers.forEach(l=>{ try{ map.removeLayer(l); }catch(_){ } }); } hotspotLayers=[]; }
  function updateHotspotVisibility(){ if(!hotspotsEnabled){ clearHotspot(); return; } if(filterMode!=='all'){ clearHotspot(); return; } if(hotspotData && hotspotData.length){ drawHotspots(hotspotData); } else { clearHotspot(); } }

  function drawHotspots(list){ if(!hotspotsEnabled){ return; } if(filterMode!=='all'){ clearHotspot(); return; } clearHotspot(); if(!list || !list.length) return;
    list.forEach((data,idx)=>{
      if(typeof data.lat!== 'number' || typeof data.lon!== 'number') return;
      const circle = L.circle([data.lat, data.lon], { radius: HOTSPOT_RADIUS_M, color:'#1d4ed8', weight:2, opacity:.9, fillColor:'#1d4ed8', fillOpacity:.18, pane:'hotspotPane' }).addTo(map);
      hotspotLayers.push(circle);
      const labelHtml = `<div class=\"hotspot-label\">Hotspot ${idx+1} (${data.count||0})</div>`;
      const icon = L.divIcon({ className:'', html:labelHtml, iconSize:null });
      const label = L.marker([data.lat, data.lon], { icon, pane:'hotspotPane', interactive:false }).addTo(map);
      hotspotLayers.push(label);
    });
  }

  function hotspotEligible(p){
    const ts = p.createdAt?.toDate ? p.createdAt.toDate().getTime() : 0; if (!ts || Date.now()-ts > LIVE_WINDOW_MS) return false; // 24h
    if(p.status==='hidden') return false;
    // Exclude private pings from global hotspot computation
    if(p.visibility==='private') return false;
    if(!inFence(p)) return false; return true;
  }

  function scheduleHotspotRecompute(){ if(hotspotTimer) clearTimeout(hotspotTimer); hotspotTimer=setTimeout(recomputeHotspot, 250); }
  function recomputeHotspot(){
    hotspotTimer=null;
    // Collect eligible pings (always consider All, independent of current filter selection)
    const seen=new Set(); const arr=[]; lastPingCache.forEach((p,id)=>{ if(seen.has(id)) return; seen.add(id); if(hotspotEligible(p)) arr.push(p); });
    if(arr.length===0){ hotspotData=[]; updateHotspotVisibility(); return; }
    // Helper to evaluate a center candidate over provided set
    function evaluateCenter(centerPing, pool){
      const cLL=L.latLng(centerPing.lat,centerPing.lon); const members=[];
      for(let j=0;j<pool.length;j++){ const q=pool[j]; const d=cLL.distanceTo([q.lat,q.lon]); if(d<=HOTSPOT_RADIUS_M) members.push(q); }
      const count=members.length; if(count===0) return null;
      let sumLat=0,sumLon=0; for(const m of members){ sumLat+=m.lat; sumLon+=m.lon; }
      const centLat=sumLat/count, centLon=sumLon/count;
      const centLL=L.latLng(centLat,centLon); let sumD=0; for(const m of members){ sumD+=centLL.distanceTo([m.lat,m.lon]); }
      const avgDist=sumD/count; return { lat:centLat, lon:centLon, count, avgDist };
    }
    // Greedily pick up to HOTSPOT_MAX_CLUSTERS separated cluster centers
    const selected=[];
    for(let k=0;k<HOTSPOT_MAX_CLUSTERS;k++){
      let best=null;
      for(let i=0;i<arr.length;i++){
        const cand=evaluateCenter(arr[i], arr); if(!cand) continue;
        let tooClose=false; for(const prev of selected){ const d=L.latLng(prev.lat,prev.lon).distanceTo([cand.lat,cand.lon]); if(d < HOTSPOT_MIN_CENTER_SEP_M){ tooClose=true; break; } }
        if(tooClose) continue;
        if(!best || cand.count>best.count || (cand.count===best.count && cand.avgDist<best.avgDist)) best=cand;
      }
      if(best) selected.push(best); else break;
    }
    hotspotData=selected; saveHotspot(selected); updateHotspotVisibility();
  }

  // On load, read saved hotspots but don't render until enabled after intro
  try{ const saved=loadHotspot(); if(saved && saved.length){ hotspotData=saved; if(hotspotsEnabled) drawHotspots(saved); } }catch(_){ }
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
      if(userPos.distanceTo(FENCE_CENTER)<=RADIUS_M){
        // Keep initial wide zoom; just center to user without changing zoom
        map.panTo(userPos, {animate:false});
        const latEl=$('#lat'),lonEl=$('#lon'); if(latEl&&lonEl){ latEl.value=userPos.lat.toFixed(6); lonEl.value=userPos.lng.toFixed(6); }
      }
      updateViewConstraints(); enforceLock(); updateMask();
    },()=>{}, {enableHighAccuracy:true, maximumAge:15000, timeout:8000});
  }

  /* --------- Firestore --------- */
  const pingsRef = db.collection('pings');
  const votesRef = db.collection('votes');
  const usersRef = db.collection('users');

  /* --------- Leftbar contains only Filters now ---------- */
  const leftbar = document.getElementById('leftbar');

  /* --------- Filter (All / Friends+Me / Me) + Time window --------- */
  let filterMode = 'all'; // 'all' | 'friends' | 'me'
  let timeWindow = 'any'; // 'any' | '30m' | '2h' | '8h' | '24h'
  $$('#filterSeg button').forEach(btn=>{
    btn.onclick=()=>{ $$('#filterSeg button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); filterMode=btn.dataset.mode; reFilterMarkers(); };
  });
  $$('#timeSeg button').forEach(btn=>{
    btn.onclick=()=>{ $$('#timeSeg button').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); timeWindow=btn.dataset.time||'any'; reFilterMarkers(); };
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
    const pinD = `M12 2 C7 2, 4 5.5, 4 10 c0 6, 8 12, 8 12 s8-6, 8-12 c0-4.5-3-8-8-8z`;
    const uid = Math.random().toString(36).slice(2,8);
    let innerPath = `<path d="M9 6 C7.8 6.4,7 7.5,7 8.6" stroke="rgba(255,255,255,0.6)" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
    if(opts.variant==='alien'){ innerPath = `<circle cx="12" cy="11" r="4" fill="#a7f3d0"/><ellipse cx="10.5" cy="10" rx="1.6" ry="2.2" fill="#111"/><ellipse cx="13.5" cy="10" rx="1.6" ry="2.2" fill="#111"/>`; }
    if(opts.variant==='galactic'){
      innerPath = `
        <defs>
          <radialGradient id="galGlow_${uid}" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stop-color="#a78bfa"/>
            <stop offset="60%" stop-color="#1e293b"/>
            <stop offset="100%" stop-color="#0f172a"/>
          </radialGradient>
          <linearGradient id="shoot_${uid}" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="100%" stop-color="#60a5fa" stop-opacity="0"/>
          </linearGradient>
        </defs>
        <circle cx="12" cy="11" r="5.8" fill="url(#galGlow_${uid})"/>
        <circle cx="12" cy="11" r="4.6" fill="none" stroke="#334155" stroke-width="0.8"/>
        <path d="M6.2 10.6 a6.2 6.2 0 0 1 11.6 0" fill="none" stroke="#64748b" stroke-width="0.8"/>
        <circle cx="16.4" cy="8.9" r="1.1" fill="#f59e0b"/>
        <circle cx="8.1" cy="13.3" r="0.9" fill="#e879f9"/>
        <circle cx="14.2" cy="14.4" r="0.8" fill="#22d3ee"/>
        <!-- shooting star -->
        <path d="M7 8.4 L11 9.6" stroke="url(#shoot_${uid})" stroke-width="1.4" stroke-linecap="round"/>
        <circle cx="11.1" cy="9.6" r="0.9" fill="#ffffff"/>
        <!-- tiny stars -->
        <circle cx="10.1" cy="12.1" r="0.4" fill="#93c5fd"/>
        <circle cx="13.8" cy="10.3" r="0.35" fill="#fde68a"/>
        <circle cx="9.2" cy="9.7" r="0.3" fill="#f472b6"/>
      `;
    }
    if(opts.variant==='nuke'){
      innerPath = `
        <defs>
          <radialGradient id="nukeGlow_${uid}" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stop-color="#fff7ad"/>
            <stop offset="60%" stop-color="#fde047"/>
            <stop offset="100%" stop-color="#facc15"/>
          </radialGradient>
          <radialGradient id="waste_${uid}" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stop-color="#a3e635"/>
            <stop offset="100%" stop-color="#16a34a"/>
          </radialGradient>
        </defs>
        <!-- glowing core -->
        <circle cx="12" cy="11" r="6" fill="url(#nukeGlow_${uid})"/>
        <!-- radiation trefoil -->
        <g fill="#111">
          <path d="M12 11 l0 -3 a3 3 0 0 1 2.6 1.5 L12 11 z"/>
          <g transform="rotate(120 12 11)"><path d="M12 11 l0 -3 a3 3 0 0 1 2.6 1.5 L12 11 z"/></g>
          <g transform="rotate(240 12 11)"><path d="M12 11 l0 -3 a3 3 0 0 1 2.6 1.5 L12 11 z"/></g>
          <circle cx="12" cy="11" r="1.1" fill="#111"/>
        </g>
        <!-- toxic puddle + bubbles -->
        <ellipse cx="12" cy="18.6" rx="6.2" ry="2.1" fill="url(#waste_${uid})" stroke="#166534" stroke-width="0.6" opacity="0.95"/>
        <circle cx="10.0" cy="17.6" r="0.55" fill="#bbf7d0" stroke="#166534" stroke-width="0.3"/>
        <circle cx="14.1" cy="16.8" r="0.45" fill="#bbf7d0" stroke="#166534" stroke-width="0.3"/>
        <circle cx="11.6" cy="16.0" r="0.4" fill="#bbf7d0" stroke="#166534" stroke-width="0.3"/>
      `;
    }
    const clipId = `pinClip_${Math.random().toString(36).slice(2,8)}`;
    let svg;
    if(opts.image){
      // Solid, fully-opaque pin: draw a white base under the clipped image, then outline
      svg = `<svg width="${w}" height="${h}" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="rgba(0,0,0,0.35)"/></filter>
          <clipPath id="${clipId}"><path d="${pinD}"/></clipPath>
        </defs>
        <path d="${pinD}" fill="#ffffff"/>
        <image href="${opts.image}" x="2" y="1" width="20" height="22" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>
        <path d="${pinD}" fill="none" stroke="${stroke}" stroke-width="1.5" filter="url(#pinShadow)"/>
      </svg>`;
    }else{
      svg = `<svg width="${w}" height="${h}" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
        <defs><filter id="pinShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="1.6" flood-color="rgba(0,0,0,0.35)"/></filter></defs>
        <path d="${pinD}" fill="${color}" stroke="${stroke}" stroke-width="1.5" filter="url(#pinShadow)"/>
        ${innerPath}
      </svg>`;
    }
    return {html:svg, size:[w,h], anchor:[w/2,h]};
  }
  function mIcon(px){ return L.divIcon({className:'pin-icon', ...balloonSVG('#ffffff', px, {drawM:true})}); }

  function colorForPing(p){
    const mine = (currentUser && p.authorId === currentUser.uid);
    if (mine) return { kind:'mine', color:'#16a34a' };
    const friend = myFriends.has(p.authorId);
    if (friend) return { kind:'friend', color:'#f59e0b' };
    return { kind:'other', color:'#0ea5e9' };
  }

  async function iconForPing(p, isPotw=false){
    const n = netLikes(p);
    // Normal size
    let r = radiusFromNet(n);
    // PotW appears as size of a ping with 2x its NET likes
    if(isPotw){
      const fourN = n*4; // PotW size = size of a ping with 4x NET likes
      let potwR;
      if(fourN <= L_LINEAR){
        potwR = BASE_RADIUS + A_SLOPE * fourN;
      }else{
        potwR = BASE_RADIUS + A_SLOPE * L_LINEAR + B_SQRT * Math.sqrt(fourN - L_LINEAR);
      }
      r = Math.min(POTW_CAP, Math.max(MIN_RADIUS, potwR));
    }
    const px = r*2.2 * zoomFactor();

    // Determine custom ping style for self and non-friends
    let style = colorForPing(p);
    try{
      const u = await awaitCachedUser(p.authorId);
      if(u && u.selectedPingTier){
        const tier = Number(u.selectedPingTier||0);
        // Use customUrl for 1000-tier only
        style = { kind: style.kind, color: style.color, customTier: tier, customUrl: u.customPingUrl };
      }
    }catch(_){ }
    let inner;
    if(isPotw){
      // PotW marker is always gold, regardless of author relationship
      const {html,size,anchor}=balloonSVG('#d4af37',px);
      inner = L.divIcon({className:'pin-icon', html, iconSize:size, iconAnchor:anchor});
    }else{
      if(style.customTier){
        let color = style.color;
        let variant=null, image=null;
        if(style.customTier===100){ color = '#7c3aed'; }
        if(style.customTier===200){ variant='alien'; color='#0ea5e9'; }
        if(style.customTier===300){ variant='galactic'; color='#0f172a'; }
        if(style.customTier===500){ variant='nuke'; color='#fde047'; }
        if(style.customTier===1000 && style.customUrl){ image=style.customUrl; }
        const {html,size,anchor}=balloonSVG(color,px,{variant,image});
        inner = L.divIcon({className:'pin-icon', html, iconSize:size, iconAnchor:anchor});
      } else {
        const {html,size,anchor}=balloonSVG(style.color,px);
        inner = L.divIcon({className:'pin-icon', html, iconSize:size, iconAnchor:anchor});
      }
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
  // Hoist PotW state so functions below can reference it before recompute
  let currentPotw = null; // { id, text, net, likes, dislikes, imageUrl, lat, lon, authorId, authorName }
  const markers=new Map(); const lastPingCache=new Map(); let unsubscribe=null;
  let currentUser=null, myFriends=new Set();
  // Simple user doc cache for rendering custom pings
  const userDocCache = new Map();
  async function awaitCachedUser(uid){
    if(userDocCache.has(uid)) return userDocCache.get(uid);
    try{ const snap=await usersRef.doc(uid).get(); const data=snap.exists? snap.data():null; userDocCache.set(uid,data); return data; }catch(_){ return null; }
  }

  function isMine(p){ return currentUser && p.authorId===currentUser.uid; }
  function isFriend(p){ return myFriends.has(p.authorId); }
  function inFence(p){ return L.latLng(p.lat,p.lon).distanceTo(FENCE_CENTER) <= RADIUS_M; }

  function shouldShow(p){
    // PotW always shows (overrides TTL and filters) while it's current
    if (currentPotw && currentPotw.id===p.id) return true;
    // 24h TTL
    const ts = p.createdAt?.toDate ? p.createdAt.toDate().getTime() : 0;
    if (!ts || Date.now()-ts > LIVE_WINDOW_MS) return false;
    // Time window filter
    if(timeWindow && timeWindow!=='any'){
      const now=Date.now();
      const limitMs = timeWindow==='30m' ? 30*60*1000 : timeWindow==='2h' ? 2*3600*1000 : timeWindow==='8h' ? 8*3600*1000 : 24*3600*1000;
      if(now-ts > limitMs) return false;
    }
    if(!inFence(p)) return false;
    if(p.status==='hidden' || p.status==='deleted') return false;
    // Respect visibility: private pings are visible to author and friends only
    if(p.visibility==='private'){
      if(isMine(p)) return true;
      if(isFriend(p)) return true;
      return false;
    }
    if(filterMode==='me') return isMine(p);
    if(filterMode==='friends') return isMine(p) || isFriend(p);
    return true;
  }

  async function upsertMarker(p){
    if(typeof p.lat!=='number' || typeof p.lon!=='number') return;
    const isPotw = !!(currentPotw && currentPotw.id===p.id);
    if(!shouldShow(p)){ removeMarker(p.id); return; }
    const icon=await iconForPing(p, isPotw);
    if(!markers.has(p.id)){
      const m=L.marker([p.lat,p.lon],{icon}).addTo(map).on('click',()=>openSheet(p.id));
      markers.set(p.id,m);
    } else {
      markers.get(p.id).setIcon(icon);
    }
    // Hotspot may need recomputing when markers change (always based on All)
    scheduleHotspotRecompute();
  }
  function removeMarker(id){ const m=markers.get(id); if(m){ map.removeLayer(m); markers.delete(id); } }
  function reFilterMarkers(){ lastPingCache.forEach((p,id)=>{ const allowed=shouldShow(p); const on=markers.has(id); if(allowed&&!on) upsertMarker(p); else if(!allowed&&on) removeMarker(id); }); updateHotspotVisibility(); }
  function restyleMarkers(){ markers.forEach(async (m,id)=>{ try{ const p=lastPingCache.get(id); if(!p) return; const isPotw=!!(currentPotw && currentPotw.id===id); const icon = await iconForPing(p, isPotw); m.setIcon(icon); }catch(_){ } }); }

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
    if(typeof recomputePotw === 'function') recomputePotw().catch(console.error);
    // 🔥 Recompute hotspot after snapshot processed
    scheduleHotspotRecompute();
  }, e=>{ console.error(e); showToast((e.code||'error')+': '+(e.message||'live error')); });

  }
  startLive();

  /* --------- What You Missed (>=12h idle) --------- */
  const MISSED_LAST_SEEN_KEY = 'htbt_last_seen_ts';
  const MISSED_THRESHOLD_MS = 12*3600*1000;
  const missedCard = document.getElementById('missedCard');
  const missedText = document.getElementById('missedText');
  const missedMeta = document.getElementById('missedMeta');
  const missedView = document.getElementById('missedView');
  const missedClose = document.getElementById('missedClose');

  function markSeen(){ try{ localStorage.setItem(MISSED_LAST_SEEN_KEY, String(Date.now())); }catch(_){ } }
  function getLastSeen(){ try{ const v=Number(localStorage.getItem(MISSED_LAST_SEEN_KEY)||'0'); return Number.isFinite(v)? v:0; }catch(_){ return 0; } }

  async function showWhatYouMissedIfAny(){
    try{
      const lastSeen = getLastSeen();
      if(!lastSeen) { markSeen(); return; }
      if(Date.now()-lastSeen < MISSED_THRESHOLD_MS) return;
      // Collect candidate pings since lastSeen from cache (already live-limited to 24h)
      const list = [];
      lastPingCache.forEach((p)=>{
        const ts=p.createdAt?.toDate? p.createdAt.toDate().getTime():0; if(!ts) return;
        if(ts<=lastSeen) return;
        // Respect visibility; reuse shouldShow minus timeWindow constraint
        const keepTime = timeWindow; timeWindow='any'; const ok=shouldShow(p); timeWindow=keepTime; if(!ok) return;
        list.push(p);
      });
      if(!list.length) { markSeen(); return; }
      // Sort by net likes desc, then recency
      list.sort((a,b)=>{ const an=Math.max(0,(a.likes||0)-(a.dislikes||0)); const bn=Math.max(0,(b.likes||0)-(b.dislikes||0)); if(bn!==an) return bn-an; const at=a.createdAt?.toDate? a.createdAt.toDate().getTime():0; const bt=b.createdAt?.toDate? b.createdAt.toDate().getTime():0; return bt-at; });
      const top = list.slice(0,3);
      const lines = top.map((p,i)=> `${i+1}. ${String(p.text||'Ping')} (${Math.max(0,(p.likes||0)-(p.dislikes||0))}★)`);
      if(missedText) missedText.textContent = lines.join('  ');
      if(missedMeta){ const diff=Math.round((Date.now()-lastSeen)/3600000); missedMeta.textContent = `${diff}h since your last visit`; }
      if(missedView){ missedView.disabled=false; missedView.onclick=()=>{ try{ if(top[0]){ map.setView([top[0].lat, top[0].lon], 16, { animate:true }); openSheet(top[0].id); } }catch(_){ } if(missedCard) missedCard.style.display='none'; markSeen(); } }
      if(missedClose){ missedClose.onclick=()=>{ if(missedCard) missedCard.style.display='none'; markSeen(); }; }
      if(missedCard) missedCard.style.display='block';
    }catch(_){ markSeen(); }
  }
  // Run shortly after live starts
  setTimeout(showWhatYouMissedIfAny, 1200);
  // Mark seen on first interaction
  ['click','keydown','touchstart','wheel'].forEach(evt=>{ window.addEventListener(evt, ()=>{ markSeen(); }, { once:true, passive:true }); });

  setInterval(()=>{ const now=Date.now(); lastPingCache.forEach((p,id)=>{ if(currentPotw && currentPotw.id===id) return; const ts=p.createdAt?.toDate? p.createdAt.toDate().getTime():0; if(ts && now-ts>LIVE_WINDOW_MS){ removeMarker(id); lastPingCache.delete(id); } }); },60*1000);

  /* --------- Quota & rate limits --------- */
  async function todayCount(uid){
    const start=new Date(); start.setHours(0,0,0,0);
    try{ const qs=await pingsRef.where('authorId','==',uid).where('createdAt','>=',start).get(); return qs.size; }
    catch(e){ const qs=await pingsRef.where('authorId','==',uid).get(); let c=0; qs.forEach(d=>{ const t=d.data().createdAt?.toDate?.(); if(t && t>=start) c++; }); return c; }
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

  // Video upload (Firebase Storage)
  async function uploadPingVideo(file, uid){
    // Local development fallback: return an object URL so posting works without Storage
    try{
      if(location.hostname === 'localhost' || location.hostname === '127.0.0.1'){
        try{ console.log('Local development detected, using object URL for video'); }catch(_){ }
        return URL.createObjectURL(file);
      }
      const storage = firebase.storage();
      const extGuess = (file && file.name && file.name.includes('.')) ? file.name.split('.').pop().toLowerCase() : 'mp4';
      const ext = (extGuess || 'mp4').replace(/[^a-z0-9]/g,'').slice(0,5) || 'mp4';
      const path = `pings/${uid}/vid_${Date.now()}_${Math.random().toString(36).slice(2,8)}.${ext}`;
      const ref = storage.ref().child(path);
      const metadata = {
        contentType: file.type || 'video/mp4',
        cacheControl: 'public, max-age=31536000'
      };
      const snap = await ref.put(file, metadata);
      const url = await snap.ref.getDownloadURL();
      return url;
    }catch(e){ console.error('uploadPingVideo', e); throw e; }
  }

  /* --------- Create ping --------- */
  const attachInput = document.getElementById('pingMedia');
  const pingTextInput = document.getElementById('pingText');
  const mentionSuggest = document.getElementById('mentionSuggest');
  const attachPreview = document.getElementById('attachPreview');
  const attachPreviewImg = document.getElementById('attachPreviewImg');
  const attachVideoPreview = document.getElementById('attachVideoPreview');
  const attachPreviewVid = document.getElementById('attachPreviewVid');

  // Subscriber UI removed

  $('#addBtn').onclick=()=>{
    if(!currentUser) return showToast('Sign in first');
    if(currentUser.isAnonymous) return showToast("Guests can't post. Create an account to drop pings.");
    const latEl=$('#lat'), lonEl=$('#lon');
    const base=(userPos && userPos.distanceTo(FENCE_CENTER)<=RADIUS_M) ? userPos : FENCE_CENTER;
    latEl.value=base.lat.toFixed(6); lonEl.value=base.lng.toFixed(6);
    openModal('createModal');
    // Reset preview and ensure attach is enabled for all users
    try{
      const lbl = document.getElementById('attachMediaLabel');
      if(attachInput) attachInput.disabled = false;
      if(lbl){ lbl.classList.remove('muted'); lbl.style.pointerEvents='auto'; lbl.title='Attach Media'; }
      const prev = document.getElementById('attachPreview');
      if(prev) prev.style.display = 'none';
      if(lbl) lbl.style.display = 'inline-flex';
      if(attachInput) attachInput.value = '';
      if(attachVideoPreview) attachVideoPreview.style.display = 'none';
    }catch(_){ }
  };
  $('#cancelCreate').onclick=()=>{ try{ const prev=document.getElementById('attachPreview'); const lbl=document.getElementById('attachMediaLabel'); if(prev) prev.style.display='none'; if(lbl) lbl.style.display='inline-flex'; if(attachInput) attachInput.value=''; const vp=document.getElementById('attachVideoPreview'); if(vp) vp.style.display='none'; if(attachPreviewVid){ attachPreviewVid.pause(); attachPreviewVid.src=''; } }catch(_){ } closeModal('createModal'); };
  // Visibility toggle element
  const pingVisibility = document.getElementById('pingVisibility');
  if(attachInput){
    attachInput.onchange = ()=>{
      try{
        const f = attachInput.files && attachInput.files[0];
        if(!f){ if(attachPreview) attachPreview.style.display='none'; if(attachVideoPreview) attachVideoPreview.style.display='none'; const lbl=document.getElementById('attachMediaLabel'); if(lbl) lbl.style.display='inline-flex'; return; }
        const isVideo = (f.type||'').startsWith('video/');
        const isImage = (f.type||'').startsWith('image/');
        const lbl = document.getElementById('attachMediaLabel'); if(lbl) lbl.style.display='none';
        if(isImage){
          const url = URL.createObjectURL(f);
          if(attachPreviewVid){ attachPreviewVid.pause(); attachPreviewVid.src=''; }
          if(attachVideoPreview) attachVideoPreview.style.display='none';
          if(attachPreviewImg) attachPreviewImg.src=url;
          if(attachPreview) attachPreview.style.display='block';
        } else if(isVideo){
          const url = URL.createObjectURL(f);
          if(attachPreviewImg) attachPreviewImg.src=''; if(attachPreview) attachPreview.style.display='none';
          if(attachPreviewVid) attachPreviewVid.src=url;
          if(attachVideoPreview) attachVideoPreview.style.display='block';
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
      if(currentUser.isAnonymous) return showToast("Guests can't post. Create an account.");
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

      let imageUrl = null, videoUrl = null;
      const mediaFile = attachInput && attachInput.files && attachInput.files[0];
      if(mediaFile){
        const isVideo = (mediaFile.type||'').startsWith('video/');
        const isImage = (mediaFile.type||'').startsWith('image/');
        if(isImage){
          if(mediaFile.size > 10*1024*1024) return showToast('Image must be ≤ 10MB');
          imageUrl = await uploadPingImage(mediaFile, currentUser.uid);
        } else if(isVideo){
          if(mediaFile.size > 50*1024*1024) return showToast('Video must be ≤ 50MB');
          videoUrl = await uploadPingVideo(mediaFile, currentUser.uid);
        }
      }

      const visibility = (pingVisibility && pingVisibility.value==='private') ? 'private' : 'public';
      // Mentions: parse up to 10 handles; @friends counts as 1
      let storedMentions = [];
      try{
        const parsed = parseMentionsFromText(text);
        const { finalRanges, targetUids } = await buildMentionTargets({ text, ranges: parsed.ranges, handles: parsed.handles, hasFriends: parsed.hasFriends, pingDoc: { authorId: currentUser.uid }, visibility });
        storedMentions = finalRanges; // for rendering stability
        // Send notifications (respect daily cap and dedupe)
        await sendMentionNotifications('mention_ping', 'temp', null, targetUids); // temp pingId replaced below after add
      }catch(err){
        const msg = String(err&&err.message||err||'').toLowerCase();
        if(msg.startsWith('invalid:')) return showToast('No such user');
        if(msg.includes('too_many')) return showToast('Max 10 mentions');
      }

      const ref = await pingsRef.add({
        text, lat, lon,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        authorId: currentUser.uid,
        authorIsSubscriber: false,
        likes:0, dislikes:0, flags:0, status:'live',
        visibility,
        imageUrl: imageUrl || null,
        firstNetAt: {}, // milestones map (N -> timestamp) starts empty
        mentions: storedMentions,
        videoUrl: videoUrl || null
      });
      try{ await usersRef.doc(currentUser.uid).collection('ledger').add({ ts: firebase.firestore.FieldValue.serverTimestamp(), type:'award', amount:0, reason:'post' }); }catch(_){ }
      // Award ping PPs and possibly streak bonus (first ping of day)
      try{
        await awardPoints(currentUser.uid, 5, 'ping');
        await awardOnFirstPingOfDay(currentUser.uid);
      }catch(_){ }
      await usersRef.doc(currentUser.uid).set({ lastPingAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });

      const temp = { id:ref.id, text, lat, lon, createdAt:{toDate:()=>new Date()}, authorId:currentUser.uid, authorIsSubscriber:false, likes:0, dislikes:0, flags:0, status:'live', visibility, imageUrl, videoUrl, firstNetAt:{} };
      lastPingCache.set(ref.id,temp); upsertMarker(temp);

      closeModal('createModal'); $('#pingText').value=''; $('#lat').value=''; $('#lon').value=''; if(attachInput) attachInput.value='';
      await refreshQuota(currentUser.uid);
      // Mentions notifications (now that we have real pingId)
      try{
        if(storedMentions && storedMentions.length){ const targets = storedMentions.map(m=>m.uid).filter(Boolean); await sendMentionNotifications('mention_ping', ref.id, null, targets); }
        else {
          const parsed = parseMentionsFromText(text); if(parsed.hasFriends && myFriends){ const list = Array.from(myFriends); await sendMentionNotifications('mention_ping', ref.id, null, list); }
        }
      }catch(_){ }
      showToast('Ping posted');
    }catch(e){ console.error(e); showToast((e.code||'error')+': '+(e.message||'Error posting')); }
  };

  /* --------- Sheet / votes / comments / reports --------- */
  const sheet=$('#pingSheet'), sheetText=$('#sheetText'), sheetMeta=$('#sheetMeta');
  const sheetImage=$('#sheetImage'), sheetImgEl=$('#sheetImgEl');
  const sheetVideo=$('#sheetVideo'), sheetVidEl=$('#sheetVidEl');
  const viewMediaBtn=$('#viewMediaBtn');
  const authorRow=document.getElementById('authorRow');
  const authorAvatar=document.getElementById('authorAvatar');
  const authorNameLine=document.getElementById('authorNameLine');
  const authorStatsLine=document.getElementById('authorStatsLine');
  const authorAddFriendBtn=document.getElementById('authorAddFriendBtn');
  const reactBar=$('#reactBar'), commentsEl=$('#comments'), commentInput=$('#commentInput');
  const openInMapsBtn=document.getElementById('openInMapsBtn');
  let openId=null, openUnsub=null, openCommentsUnsub=null;

  function openSheet(id){
    if(openUnsub) openUnsub(); if(openCommentsUnsub) openCommentsUnsub();
    openId=id; sheet.classList.add('open'); applyModalOpenClass();

    openUnsub = pingsRef.doc(id).onSnapshot(doc=>{
      if(!doc.exists){ sheet.classList.remove('open'); return; }
      const p={id:doc.id, ...doc.data()}; lastPingCache.set(p.id,p);
      // Populate author row (visible to everyone for public; private limited by shouldShow)
      (async ()=>{
        try{
          const uid = p.authorId;
          const you = currentUser && uid===currentUser.uid;
          const uDoc = await usersRef.doc(uid).get();
          const u = uDoc.exists ? uDoc.data() : {};
          const handle = (u && u.handle) ? String(u.handle).trim() : '';
          const displayBase = handle ? `@${handle}` : (u.email || 'Friend');
          const name = you ? 'You' : displayBase;
          const pts = Number(u.points||0);
          const streak = Number(u.streakDays||0);
          if(authorNameLine){ authorNameLine.textContent = name; }
          if(authorStatsLine){ authorStatsLine.textContent = `${pts} PPs • 🔥 ${streak}`; }
          if(authorAvatar){ if(u.photoURL){ authorAvatar.style.backgroundImage=`url("${u.photoURL}")`; authorAvatar.classList.add('custom-avatar'); } else { authorAvatar.style.backgroundImage=''; authorAvatar.classList.remove('custom-avatar'); } }
          if(authorRow){ authorRow.onclick = ()=> openOtherProfile(uid); }
          // Friend CTA inline
          try{
            if(authorAddFriendBtn){
              const isFriend = myFriends && myFriends.has && myFriends.has(uid);
              if(!you && !isFriend){ authorAddFriendBtn.style.display='inline-flex'; authorAddFriendBtn.onclick = async (e)=>{ e.stopPropagation(); try{ if(!currentUser) return showToast('Sign in first'); await sendFriendRequest(currentUser.uid, uid); authorAddFriendBtn.style.display='none'; showToast('Friend request sent'); }catch(err){ console.error(err); showToast('Could not send request'); } }; }
              else { authorAddFriendBtn.style.display='none'; authorAddFriendBtn.onclick=null; }
            }
          }catch(_){ }
          // Lightbox bylines
          try{ const imgBy=document.getElementById('imageByline'); if(imgBy){ imgBy.textContent = `by ${displayBase}`; } }catch(_){ }
          try{ const vidBy=document.getElementById('videoByline'); if(vidBy){ vidBy.textContent = `by ${displayBase}`; } }catch(_){ }
        }catch(e){ console.warn('author row', e); }
      })();
      // Open in Maps button
      try{
        if(openInMapsBtn){
          const lat = Number(p.lat), lon = Number(p.lon);
          const valid = Number.isFinite(lat) && Number.isFinite(lon);
          openInMapsBtn.style.display = valid ? 'inline-flex' : 'none';
          openInMapsBtn.onclick = ()=>{
            if(!valid) return;
            const isApple = /Mac|iPhone|iPad|iPod/i.test(navigator.platform) || /Safari\//.test(navigator.userAgent) && !/Chrome\//.test(navigator.userAgent);
            // Prefer directions from current location
            const apple = `https://maps.apple.com/?daddr=${lat},${lon}&dirflg=d`;
            const google = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=walking`;
            const href = isApple ? apple : google;
            try{ window.open(href, (isApple? '_self' : '_blank')); }catch(_){ location.href = href; }
          };
        }
      }catch(_){ }
      // Render ping text with mentions if present
      try{
        if(Array.isArray(p.mentions) && p.mentions.length){ renderTextWithMentions(sheetText, String(p.text||''), p.mentions); }
        else { sheetText.textContent = p.text; }
      }catch(_){ sheetText.textContent = p.text; }
      const created = p.createdAt?.toDate ? p.createdAt.toDate().getTime() : null;
      // Build meta: place label • distance (if available) • time ago
      (async ()=>{
        const parts=[];
        try{
          const label = await reverseGeocode(Number(p.lat), Number(p.lon));
          if(label) parts.push(label); else parts.push('Nearby');
        }catch(_){ parts.push('Nearby'); }
        try{
          if(userPos){
            const d=L.latLng(p.lat,p.lon).distanceTo(userPos);
            const distTxt = (d<1000) ? `${Math.round(d)} m away` : `${(d/1000).toFixed(1)} km away`;
            parts.push(distTxt);
          }
        }catch(_){ }
        parts.push(timeAgo(created));
        sheetMeta.textContent = parts.join(' • ');
      })();
      try{ const titleEl=document.getElementById('pingSheetTitle'); if(titleEl){ titleEl.innerHTML = p.visibility==='private' ? 'Ping <span class="private-badge">Private</span>' : 'Ping'; } }catch(_){ }
      // Media handling: hide inline; show a single View button and set byline
      let hasMedia=false; let mediaType=null;
      if(p.imageUrl){ sheetImgEl.src=p.imageUrl; sheetImage.style.display='none'; hasMedia=true; mediaType='image'; }
      else { sheetImage.style.display='none'; }
      if(p.videoUrl){ if(sheetVidEl) sheetVidEl.src=p.videoUrl; if(sheetVideo) sheetVideo.style.display='none'; hasMedia=true; mediaType= mediaType || 'video'; }
      else { if(sheetVideo) sheetVideo.style.display='none'; }
      if(viewMediaBtn){
        if(hasMedia){
          viewMediaBtn.style.display='inline-flex';
          viewMediaBtn.onclick=()=>{
            if(p.videoUrl){ const vl=document.getElementById('lightboxVideo'); if(vl){ try{ vl.pause(); }catch(_){ } vl.removeAttribute('src'); vl.load(); vl.src=p.videoUrl; try{ vl.currentTime=0; }catch(_){ } setTimeout(()=>{ try{ vl.play(); }catch(_){ } }, 50); openModal('videoLightbox'); } return; }
            if(p.imageUrl){ const lb=document.getElementById('lightboxImg'); if(lb){ lb.src=p.imageUrl; openModal('imageLightbox'); } }
          };
        } else { viewMediaBtn.style.display='none'; viewMediaBtn.onclick=null; }
      }
      // Toggle Delete button visibility if author
      try{
        const delBtn=document.getElementById('deletePingBtn');
        if(delBtn){
          const mine = (currentUser && p.authorId===currentUser.uid);
          delBtn.style.display = mine ? 'inline-flex' : 'none';
          if(mine){
            delBtn.onclick = async ()=>{
              try{
                if(!confirm('Delete this ping?')) return;
                await pingsRef.doc(p.id).set({ status:'deleted', deletedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
                showToast('Ping deleted');
                sheet.classList.remove('open'); applyModalOpenClass();
              }catch(e){ console.error(e); showToast('Delete failed'); }
            };
          } else {
            delBtn.onclick = null;
          }
        }
      }catch(_){ }

      renderVoteBar(p); upsertMarker(p);
    });

    openCommentsUnsub = pingsRef.doc(id).collection('comments').orderBy('createdAt','desc').limit(200).onSnapshot(s=>{
      commentsEl.innerHTML=''; s.forEach(d=>{
        const c=d.data(); const when=c.createdAt||null;
        const div=document.createElement('div'); div.className='comment';
        const textSpan=document.createElement('span');
        // Render mentions if present
        if(Array.isArray(c.mentions) && c.mentions.length){ renderTextWithMentions(textSpan, String(c.text||''), c.mentions); }
        else { textSpan.textContent=String(c.text||''); }
        const br=document.createElement('br');
        const small=document.createElement('small'); small.textContent=timeAgo(when);
        div.appendChild(textSpan); div.appendChild(br); div.appendChild(small);
        // Delete for own comment
        try{
          if(currentUser && c.authorId===currentUser.uid){
            const del=document.createElement('button'); del.className='btn'; del.textContent='Delete'; del.style.marginLeft='8px';
            del.onclick = async ()=>{
              try{ await pingsRef.doc(openId).collection('comments').doc(d.id).delete(); showToast('Comment deleted'); }
              catch(e){ console.error(e); showToast('Delete failed'); }
            };
            div.appendChild(del);
          }
        }catch(_){ }
        commentsEl.appendChild(div);
      });
      try{ commentsEl.scrollTo({ top: 0, behavior: 'smooth' }); }catch(_){ }
    });
  }
  $('#closeSheet').onclick=()=>{ sheet.classList.remove('open'); if(openUnsub) openUnsub(); if(openCommentsUnsub) openCommentsUnsub(); openId=null; applyModalOpenClass(); };

  // Image lightbox behavior
  try{
    sheetImgEl.onclick = ()=>{ const lb=document.getElementById('lightboxImg'); if(sheetImgEl && sheetImgEl.src && lb){ lb.src = sheetImgEl.src; openModal('imageLightbox'); } };
    document.getElementById('closeLightbox').onclick = ()=> closeModal('imageLightbox');
  }catch(_){ }

  // Video lightbox behavior
  try{
    const closeV = document.getElementById('closeVideoLightbox');
    if(closeV){ closeV.onclick = ()=>{ try{ const vl=document.getElementById('lightboxVideo'); if(vl){ vl.pause(); vl.removeAttribute('src'); vl.load(); } }catch(_){ } closeModal('videoLightbox'); }; }
  }catch(_){ }

  // Remove attached image in create modal
  try{
    const removeAttachBtn = document.getElementById('removeAttachBtn');
    const removeVideoBtn = document.getElementById('removeVideoBtn');
    const clearAll = ()=>{
      try{
        if(attachPreviewImg) attachPreviewImg.src=''; if(attachPreview) attachPreview.style.display='none';
        if(attachPreviewVid){ attachPreviewVid.pause(); attachPreviewVid.src=''; }
        if(attachVideoPreview) attachVideoPreview.style.display='none';
        const lbl = document.getElementById('attachMediaLabel'); if(lbl) lbl.style.display='inline-flex';
        if(attachInput) attachInput.value='';
      }catch(_){ }
    };
    if(removeAttachBtn){ removeAttachBtn.onclick = clearAll; }
    if(removeVideoBtn){ removeVideoBtn.onclick = clearAll; }
  }catch(_){ }

  function renderVoteBar(p){
    reactBar.innerHTML='';
    const disabled = (!currentUser || currentUser.isAnonymous);
    const mk=(type,label,count)=>{
      const b=document.createElement('button'); b.className='react';
      const n = Number(count)||0; b.textContent = n>0 ? `${label} ${n}` : label;
      if(disabled){ b.disabled=true; b.style.opacity=.6; b.title='Sign in to react'; }
      else { b.onclick=()=>setVote(p.id,type).catch(console.error); }
      return b;
    };
    reactBar.appendChild(mk('like','👍',p.likes)); reactBar.appendChild(mk('dislike','👎',p.dislikes));
  }

  // Vote transaction with NET-like milestones (firstNetAt.{N})
  async function setVote(pingId,type){
    if(!currentUser) return showToast('Sign in first');
    if(currentUser.isAnonymous) return showToast("Guests can't react");
    const vid=`${pingId}_${currentUser.uid}`;
    let awardResult=null;
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
      // Compute milestone crossings for PP awards (up) and penalties (down)
      const beforeMil = Math.floor(beforeNet/3);
      const afterMil  = Math.floor(afterNet/3);
      const up   = Math.max(0, afterMil - beforeMil);
      const down = Math.max(0, beforeMil - afterMil);
      awardResult = { authorId: p.authorId || pSnap.data().authorId || null, up, down };
    }).catch(e=>console.error(e));
    // Apply PP delta based on milestone crossings
    try{
      if(awardResult && awardResult.authorId){
        const delta = (awardResult.up||0) - (awardResult.down||0);
        if(delta!==0){ await awardPoints(awardResult.authorId, delta, 'like_milestones'); }
      }
    }catch(_){ }
  }

  $('#sendComment').onclick=async()=>{
    if(!openId) return; if(!currentUser) return showToast('Sign in first');
    if(currentUser.isAnonymous) return showToast("Guests can't comment");
    const t=(commentInput.value||'').trim(); if(!t) return; if(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/.test(t)) return showToast('No real names');
    // Mentions in comments
    let storedMentions = [];
    try{
      // Load ping to know visibility and author/friends
      const pingSnap = await pingsRef.doc(openId).get();
      const pingDoc = pingSnap.exists ? pingSnap.data() : null;
      const vis = pingDoc && pingDoc.visibility || 'public';
      const parsed = parseMentionsFromText(t);
      const { finalRanges, targetUids } = await buildMentionTargets({ text:t, ranges:parsed.ranges, handles:parsed.handles, hasFriends:parsed.hasFriends, pingDoc, visibility: vis });
      storedMentions = finalRanges;
      // Save comment with mentions
      await pingsRef.doc(openId).collection('comments').doc(currentUser.uid).set({ text:t, authorId:currentUser.uid, createdAt:firebase.firestore.FieldValue.serverTimestamp(), mentions: storedMentions });
      // Send notifications
      await sendMentionNotifications('mention_comment', openId, currentUser.uid, targetUids);
    }catch(err){
      const msg = String(err&&err.message||err||'').toLowerCase();
      if(msg.startsWith('invalid:')) return showToast('No such user');
      if(msg.includes('too_many')) return showToast('Max 10 mentions');
      // Fallback: save comment without mentions
      await pingsRef.doc(openId).collection('comments').doc(currentUser.uid).set({ text:t, authorId:currentUser.uid, createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    }
    commentInput.value='';
    try{ commentsEl.scrollTo({ top: 0, behavior: 'smooth' }); }catch(_){ }
  };

  // Enter to send, Shift+Enter for newline
  try{
    if(commentInput){
      commentInput.addEventListener('keydown', (e)=>{
        if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); const btn=document.getElementById('sendComment'); if(btn) btn.click(); }
      });
    }
  }catch(_){ }

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

  // ---- Mentions helpers ----
  const mentionHandleRegex = /(^|[^a-z0-9_.])@([a-z0-9_.]+)/ig;
  const mentionsCache = new Map(); // uid -> { handle, photoURL }
  async function resolveUidByHandle(handleLC){
    try{ const doc = await db.collection('handles').doc(handleLC).get(); return doc.exists ? (doc.data().uid||null) : null; }catch(_){ return null; }
  }
  async function getUserBasics(uid){
    if(!uid) return { handle:null, photoURL:null, displayName:'Friend' };
    if(mentionsCache.has(uid)) return mentionsCache.get(uid);
    try{ const d=await usersRef.doc(uid).get(); const handle=d.exists? (d.data().handle||null):null; const photoURL=d.exists? (d.data().photoURL||null):null; const displayName = handle? ('@'+handle) : ('@user'+String(uid).slice(0,6)); const out = { handle, photoURL, displayName }; mentionsCache.set(uid,out); return out; }catch(_){ return { handle:null, photoURL:null, displayName:'Friend' }; }
  }
  function parseMentionsFromText(text){
    const handles = [];
    const ranges = [];
    if(!text) return { handles, ranges, hasFriends:false };
    let m; mentionHandleRegex.lastIndex = 0;
    const lower = String(text);
    while((m = mentionHandleRegex.exec(lower))){
      const full = m[0], prefix = m[1]||'', handle = m[2]||'';
      const start = m.index + prefix.length;
      const end = start + 1 + handle.length;
      if(handle.toLowerCase()==='friends') continue; // handle separately
      handles.push(handle.toLowerCase());
      ranges.push({ start, end, handleLC: handle.toLowerCase() });
      if(handles.length >= 30) break; // safety
    }
    const hasFriends = /(^|[^a-z0-9_.])@friends(?![a-z0-9_.])/i.test(lower);
    return { handles, ranges, hasFriends };
  }

  // Mention suggestions (handles + @friends)
  function hideMentionSuggest(){ if(mentionSuggest){ mentionSuggest.style.display='none'; mentionSuggest.innerHTML=''; } }
  function showMentionSuggest(items, anchorEl){
    if(!mentionSuggest || !anchorEl) return; if(!items || !items.length){ hideMentionSuggest(); return; }
    const rect = anchorEl.getBoundingClientRect();
    mentionSuggest.innerHTML='';
    items.forEach(it=>{
      const row=document.createElement('div'); row.className='mi';
      const av=document.createElement('div'); av.className='av'; if(it.photoURL){ av.style.backgroundImage=`url("${it.photoURL}")`; av.style.backgroundSize='cover'; av.style.border='1px solid #e6e6e6'; }
      const nm=document.createElement('div'); nm.className='nm'; nm.textContent = it.label;
      row.appendChild(av); row.appendChild(nm);
      row.onclick = ()=>{ try{
        let el = null;
        if(mentionTarget){
          if(mentionTarget.type==='comment') el = commentInput;
          else if(mentionTarget.type==='addfriend') el = addFriendInputProfile;
          else if(mentionTarget.type==='gift') el = document.getElementById('giftWho');
          else el = pingTextInput;
        } else {
          el = pingTextInput;
        }
        if(!el) return;
        // For Add Friend/gift fields, replace entire field with handle (no '@' search)
        if(mentionTarget && (mentionTarget.type==='addfriend' || mentionTarget.type==='gift')){
          el.value = it.insert;
          el.focus(); const ev=new Event('input', {bubbles:true}); el.dispatchEvent(ev);
          hideMentionSuggest(); return;
        }
        const val = el.value; const at = val.lastIndexOf('@'); if(at>=0){ el.value = val.slice(0,at) + it.insert + ' '; el.focus(); const ev=new Event('input', {bubbles:true}); el.dispatchEvent(ev); }
        hideMentionSuggest();
      }catch(_){ } };
      mentionSuggest.appendChild(row);
    });
    // Prefer positioning above the input to save space on small screens
    const spaceBelow = window.innerHeight - rect.bottom;
    const popH = Math.min(220, Math.max(140, items.length*32 + 12));
    const showAbove = spaceBelow < popH + 16 && rect.top > popH + 16;
    mentionSuggest.style.left = Math.max(8, rect.left) + 'px';
    mentionSuggest.style.top  = showAbove ? (rect.top - popH - 6) + 'px' : (rect.bottom + 6) + 'px';
    mentionSuggest.style.display='block';
  }

  async function buildMentionCandidates(prefixLC){
    const list=[];
    // @friends option when matches prefix
    if('friends'.startsWith(prefixLC)) list.push({ label:'@friends', insert:'@friends', photoURL:'' });
    // friends handles
    try{
      const ids = myFriends ? Array.from(myFriends).slice(0,50) : [];
      const snaps = await Promise.all(ids.map(id=> usersRef.doc(id).get().catch(()=>null)));
      snaps.forEach(d=>{
        if(d && d.exists){ const u=d.data(); const h=u && u.handle ? String(u.handle).trim() : ''; if(h && h.toLowerCase().startsWith(prefixLC)){ list.push({ label:'@'+h, insert:'@'+h, photoURL: u.photoURL||'' }); } }
      });
    }catch(_){ }
    // if few results, try global handle lookup by prefix
    if(list.length<5){
      try{
        const q = await db.collection('handles').where(firebase.firestore.FieldPath.documentId(), '>=', prefixLC).where(firebase.firestore.FieldPath.documentId(), '<=', prefixLC+'\uf8ff').limit(10).get();
        q.forEach(doc=>{ const h=doc.id; if(!h) return; if(list.find(x=>x.insert==='@'+h)) return; list.push({ label:'@'+h, insert:'@'+h, photoURL:'' }); });
      }catch(_){ }
    }
    // Clean up: remove empties and dedupe labels; put @friends first, then alpha
    const seen = new Set();
    const cleaned = [];
    for(const it of list){ if(!it || !it.label) continue; if(it.label==='@') continue; if(seen.has(it.label.toLowerCase())) continue; seen.add(it.label.toLowerCase()); cleaned.push(it); }
    cleaned.sort((a,b)=>{ const af=(a.label==='@friends')?0:1, bf=(b.label==='@friends')?0:1; if(af!==bf) return af-bf; return a.label.toLowerCase().localeCompare(b.label.toLowerCase()); });
    return cleaned.slice(0,10);
  }

  let mentionSuggestReq = 0; let mentionTarget = null; // {type:'ping'|'comment'}
  if(pingTextInput){
    pingTextInput.addEventListener('input', async ()=>{
      const req = ++mentionSuggestReq;
      try{
        const val = pingTextInput.value||''; const at = val.lastIndexOf('@'); if(at<0){ hideMentionSuggest(); return; }
        const prefix = val.slice(at+1).toLowerCase().replace(/[^a-z0-9_.]/g,'');
        mentionTarget={type:'ping'};
        if(prefix.length===0){ if(req===mentionSuggestReq) showMentionSuggest([{ label:'@friends', insert:'@friends', photoURL:'' }], pingTextInput); return; }
        const items = await buildMentionCandidates(prefix);
        if(req===mentionSuggestReq) showMentionSuggest(items, pingTextInput);
      }catch(_){ }
    });
    document.addEventListener('click', (e)=>{ if(!mentionSuggest) return; if(e.target===mentionSuggest || mentionSuggest.contains(e.target)) return; hideMentionSuggest(); });
  }

  // Comment @-suggest (reuse existing commentInput declared earlier)
  if(commentInput){
    commentInput.addEventListener('input', async ()=>{
      const req = ++mentionSuggestReq;
      try{
        const val = commentInput.value||''; const at = val.lastIndexOf('@'); if(at<0){ hideMentionSuggest(); return; }
        const prefix = val.slice(at+1).toLowerCase().replace(/[^a-z0-9_.]/g,'');
        mentionTarget={type:'comment'};
        if(prefix.length===0){ if(req===mentionSuggestReq) showMentionSuggest([{ label:'@friends', insert:'@friends', photoURL:'' }], commentInput); return; }
        const items = await buildMentionCandidates(prefix);
        if(req===mentionSuggestReq) showMentionSuggest(items, commentInput);
      }catch(_){ }
    });
  }

  // Reverted: remove Add Friend suggestions
  async function buildMentionTargets({ text, ranges, handles, hasFriends, pingDoc, visibility }){
    // Resolve explicit handles to UIDs
    const mapHandleToUid = new Map();
    for(const h of handles){ if(!mapHandleToUid.has(h)){ const uid = await resolveUidByHandle(h); mapHandleToUid.set(h, uid); } }
    // Validate: all handles must resolve
    const invalid = [...mapHandleToUid.entries()].filter(([h,uid])=>!uid).map(([h])=>'@'+h);
    if(invalid.length){ throw new Error('invalid:'+invalid[0]); }
    // Enforce mention count limit (explicit + friends token as 1)
    const countItems = (hasFriends?1:0) + [...new Set(handles)].length;
    if(countItems>10) throw new Error('too_many');
    // Private restriction: only mention viewers
    let viewerSet = null;
    if(visibility==='private' && pingDoc){
      try{ const author = pingDoc.authorId; const d = await usersRef.doc(author).get(); const f = d.exists ? (d.data().friendIds||[]) : []; viewerSet = new Set([author, ...f]); }catch(_){ viewerSet = new Set([pingDoc.authorId]); }
    }
    const currentUid = currentUser ? currentUser.uid : null;
    // Resolve explicit mention ranges to uids and filter rules (ignore self, private viewers)
    const finalRanges = [];
    const targetUids = new Set();
    for(const r of ranges){ const uid = mapHandleToUid.get(r.handleLC)||null; if(!uid) continue; if(uid===currentUid) continue; if(viewerSet && !viewerSet.has(uid)) continue; finalRanges.push({ start:r.start, end:r.end, uid }); targetUids.add(uid); }
    // Expand @friends within allowed viewers
    if(hasFriends && currentUid){
      const myF = myFriends ? new Set([...myFriends]) : new Set();
      let friendTargets = [...myF];
      if(viewerSet){ friendTargets = friendTargets.filter(uid=>viewerSet.has(uid)); }
      friendTargets.forEach(uid=>{ if(uid!==currentUid) targetUids.add(uid); });
    }
    return { finalRanges, targetUids: [...targetUids] };
  }
  async function sendMentionNotifications(kind, pingId, commentId, targetUids){
    if(!targetUids || !targetUids.length || !currentUser) return;
    // Daily cap
    try{
      const todayKey = dateKey(montrealNow()).replace(/-/g,'');
      await db.runTransaction(async (tx)=>{
        const qref = db.collection('meta').doc('mention_quota_'+currentUser.uid+'_'+todayKey);
        const snap = await tx.get(qref);
        const sent = snap.exists ? Number(snap.data().sent||0) : 0;
        const budget = Math.max(0, 50 - sent);
        const sendList = targetUids.slice(0, budget);
        // Read all first, then perform writes to satisfy Firestore transaction rules
        const pending = [];
        for(const uid of sendList){
          const nref = usersRef.doc(uid).collection('notifications').doc(kind+'_'+pingId+(commentId?('_'+commentId):''));
          const nsnap = await tx.get(nref);
          if(!nsnap.exists){ pending.push(nref); }
        }
        pending.forEach(nref=>{ tx.set(nref, { type:kind, from: currentUser.uid, pingId, commentId: commentId||null, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); });
        tx.set(qref, { sent: sent + pending.length, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
      });
    }catch(_){ }
  }
  async function renderTextWithMentions(el, text, mentionRanges){
    try{
      el.textContent=''; const frag=document.createDocumentFragment();
      const ranges = Array.isArray(mentionRanges) ? [...mentionRanges].sort((a,b)=>a.start-b.start) : [];
      let idx=0;
      for(const r of ranges){
        const before = text.slice(idx, r.start); if(before) frag.appendChild(document.createTextNode(before));
        const chip=document.createElement('span'); chip.className='mention';
        const basics = await getUserBasics(r.uid);
        const label = basics.handle ? '@'+basics.handle : '@friend';
        chip.textContent = label;
        chip.onclick = ()=> openOtherProfile(r.uid);
        frag.appendChild(chip);
        idx = r.end;
      }
      const tail = text.slice(idx); if(tail) frag.appendChild(document.createTextNode(tail));
      el.appendChild(frag);
    }catch(_){ el.textContent = text||''; }
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

    const reqId = fromUid+'_'+toUid;
    const myDoc = await db.collection('friendRequests').doc(reqId).get();
    if(myDoc.exists){
      const st = (myDoc.data().status||'pending');
      if(st==='pending') throw new Error('already pending');
      if(st==='accepted'){
        // Check real friend state; if removed, reset to pending
        const [a,b] = await Promise.all([usersRef.doc(fromUid).get(), usersRef.doc(toUid).get()]);
        const aHas = a.exists && Array.isArray(a.data().friendIds) && a.data().friendIds.includes(toUid);
        const bHas = b.exists && Array.isArray(b.data().friendIds) && b.data().friendIds.includes(fromUid);
        if(aHas && bHas){ throw new Error('already friends'); }
        // Stale accepted doc — overwrite as pending
        await db.collection('friendRequests').doc(reqId).set({ from: fromUid, to: toUid, status:'pending', createdAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
      }
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
    // Award PPs to both friends once (dedupe via meta doc)
    try{
      const [fromUid,toUid] = reqId.split('_');
      const metaId = `friend_award_${[fromUid,toUid].sort().join('_')}`;
      await db.runTransaction(async (tx)=>{
        const mref = db.collection('meta').doc(metaId);
        const msnap = await tx.get(mref);
        if(msnap.exists) return;
        tx.set(mref, { type:'friend_award', at: firebase.firestore.FieldValue.serverTimestamp() });
        const aRef = usersRef.doc(fromUid), bRef = usersRef.doc(toUid);
        const [aSnap,bSnap] = await Promise.all([tx.get(aRef), tx.get(bRef)]);
        const aPts = Math.max(0, Number(aSnap.exists ? aSnap.data().points||0 : 0) + 5);
        const bPts = Math.max(0, Number(bSnap.exists ? bSnap.data().points||0 : 0) + 5);
        tx.set(aRef, { points: aPts }, { merge:true });
        tx.set(bRef, { points: bPts }, { merge:true });
      });
      showToast('+5 PPs — friend connected');
    }catch(_){ }
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
    // Clean up stale reverse request if exists and not accepted
    try{ const [a,b]=reqId.split('_'); const rev=db.collection('friendRequests').doc(b+'_'+a); const doc=await rev.get(); if(doc.exists && (doc.data().status||'pending')!=='accepted'){ await rev.delete(); } }catch(_){ }
  }
  async function cancelFriendRequest(reqId){
    const rRef = db.collection('friendRequests').doc(reqId);
    const doc = await rRef.get(); if(!doc.exists) return;
    if(doc.data().from!==currentUser.uid) throw new Error('not sender');
    await rRef.set({ status:'canceled', decidedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
    // Clean up reverse pending request
    try{ const [a,b]=reqId.split('_'); const rev=db.collection('friendRequests').doc(b+'_'+a); const d=await rev.get(); if(d.exists && (d.data().status||'pending')!=='accepted'){ await rev.delete(); } }catch(_){ }
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
    // Initial paint in case there are existing requests
    updateRequestsUI().catch(console.error);
  }

  async function updateRequestsUI(){
    const cont = document.getElementById('requestsList'); if(!cont) return;
    if(!currentUser){ cont.innerHTML='<div class="muted">Sign in to see requests.</div>'; return; }
    // Simplified queries to avoid index requirements
    const inSS  = await db.collection('friendRequests').where('to','==',currentUser.uid).where('status','==','pending').get();
    const outSS = await db.collection('friendRequests').where('from','==',currentUser.uid).where('status','==','pending').get();

    const items=[];
    const seen = new Set();
    for(const doc of inSS.docs){ if(!seen.has(doc.id)){ items.push({ id:doc.id, dir:'in', ...doc.data() }); seen.add(doc.id); } }
    for(const doc of outSS.docs){ if(!seen.has(doc.id)){ items.push({ id:doc.id, dir:'out', ...doc.data() }); seen.add(doc.id); } }
    if(!items.length){ cont.innerHTML='<div class="muted">No pending requests.</div>'; return; }

    cont.innerHTML='';
    for(const it of items){
      const other = (it.dir==='in' ? it.from : it.to);
      let label='Unknown user';
      try{
        const ud = await usersRef.doc(other).get();
        if(ud.exists){
          const h = ud.data().handle||''; const disp = ud.data().displayName||ud.data().email||'';
          label = h ? '@'+String(h).trim() : String(disp||'Friend');
        }
      }catch(_){ }
      const row = document.createElement('div'); row.className='req-card';
      row.innerHTML = '<div><strong>'+label+'</strong></div>';
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
        if(targetUid===currentUser.uid){ showToast("That's you!"); return; }
        await sendFriendRequest(currentUser.uid, targetUid);
        if(addFriendInputProfile) addFriendInputProfile.value=''; showToast('Friend request sent'); await updateRequestsUI();
      }catch(e){ console.error(e); showToast('Could not send request'); }
    };
  // Autosuggest for Add Friend (friends-only)
  if(addFriendInputProfile){
    addFriendInputProfile.addEventListener('input', async ()=>{
      try{
        const val=(addFriendInputProfile.value||'').toLowerCase().replace(/[^a-z0-9_.]/g,'');
        if(!val){ hideMentionSuggest(); return; }
        // Search both friends and global handles by prefix
        const items=[];
        try{
          const q = await db.collection('handles')
            .where(firebase.firestore.FieldPath.documentId(), '>=', val)
            .where(firebase.firestore.FieldPath.documentId(), '<=', val+'\uf8ff')
            .limit(10)
            .get();
          q.forEach(d=>{ const h=d.id; if(!h) return; items.push({ label:'@'+h, insert:'@'+h, photoURL:'' }); });
        }catch(_){ }
        // De-dupe and include top friends first
        try{
          const ids = myFriends ? Array.from(myFriends).slice(0,50) : [];
          const snaps = await Promise.all(ids.map(id=> usersRef.doc(id).get().catch(()=>null)));
          snaps.forEach(s=>{ if(!s||!s.exists) return; const u=s.data(); const h=u&&u.handle? String(u.handle).trim().toLowerCase():''; if(h && h.startsWith(val)){ if(!items.find(it=>it.insert==='@'+h)) items.unshift({ label:'@'+h, insert:'@'+h, photoURL:u.photoURL||'' }); } });
        }catch(_){ }
        // Limit and show
        showMentionSuggest(items.slice(0,10), addFriendInputProfile);
        mentionTarget={type:'addfriend'};
      }catch(_){ }
    });
  }

  // Profile modal elements and behaviors
  const PROFILE_VIEW = {
    OWN: 'own',
    OTHER: 'other',
    SETTINGS: 'settings'
  };
  let currentProfileView = PROFILE_VIEW.OWN;

  function applyProfileView(view){
    try{
      currentProfileView = view;
      const own = document.getElementById('ownProfileSection');
      const other = document.getElementById('otherProfileSection');
      const settings = document.getElementById('settingsSection');
      const title = document.getElementById('profileModalTitle');
      const actions = document.getElementById('profileActions');
      const signOutBtn = document.getElementById('signOutInProfile');
      const gear = document.getElementById('openSettings');
      const back = document.getElementById('backToProfile');
      const storeBtn = document.getElementById('openStore');

      if(view===PROFILE_VIEW.OWN){
        if(title) title.textContent = 'Your Profile';
        if(own) own.style.display = 'block';
        if(other) other.style.display = 'none';
        if(settings) settings.style.display = 'none';
        if(actions) actions.style.display = 'flex';
        if(signOutBtn) signOutBtn.style.display = 'inline-flex';
        if(gear) gear.style.display = 'inline-flex';
        if(back) back.style.display = 'none';
        if(storeBtn) storeBtn.style.display = 'inline-flex';
      } else if(view===PROFILE_VIEW.OTHER){
        if(title) title.textContent = 'Profile';
        if(own) own.style.display = 'none';
        if(other) other.style.display = 'block';
        if(settings) settings.style.display = 'none';
        if(actions) actions.style.display = 'flex';
        if(signOutBtn) signOutBtn.style.display = 'none';
        if(gear) gear.style.display = 'inline-flex';
        if(back) back.style.display = 'none';
        if(storeBtn) storeBtn.style.display = 'none';
      } else if(view===PROFILE_VIEW.SETTINGS){
        if(title) title.textContent = 'Settings';
        if(own) own.style.display = 'none';
        if(other) other.style.display = 'none';
        if(settings) settings.style.display = 'block';
        if(actions) actions.style.display = 'flex';
        if(signOutBtn) signOutBtn.style.display = 'inline-flex';
        if(gear) gear.style.display = 'none';
        if(back) back.style.display = 'inline-flex';
        if(storeBtn) storeBtn.style.display = 'inline-flex';
      }
    }catch(_){ }
  }
  function forceOwnProfileHeader(){
    try{
      const title = document.getElementById('profileModalTitle'); if(title) title.textContent='Your Profile';
      const gear = document.getElementById('openSettings'); if(gear) gear.style.display='inline-flex';
      const back = document.getElementById('backToProfile'); if(back) back.style.display='none';
      const storeBtn = document.getElementById('openStore'); if(storeBtn) storeBtn.style.display='inline-flex';
      const actions = document.getElementById('profileActions'); if(actions) actions.style.display='flex';
      const signOutBtn = document.getElementById('signOutInProfile'); if(signOutBtn) signOutBtn.style.display='inline-flex';
    }catch(_){ }
  }
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
  const handleCooldownHint = document.getElementById('handleCooldownHint');

  async function updateHandleCooldownUI(){
    try{
      if(!handleCooldownHint || !currentUser) return;
      const uref = usersRef.doc(currentUser.uid); const ud = await uref.get();
      const prev = ud.exists? (ud.data().handle||null) : null;
      // No cooldown: always allow changes
      handleCooldownHint.textContent = prev ? 'You can change your username now.' : 'Pick your username.';
    }catch(_){ }
  }
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
      applyProfileView(PROFILE_VIEW.OWN);
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
      if(handleInput){ try{ const d=await usersRef.doc(currentUser.uid).get(); const h=d.exists? (d.data().handle||'') : ''; handleInput.value = h || ''; }catch(_){ } }
      if(emailDisplay){ try{ const d=await usersRef.doc(currentUser.uid).get(); const em = d.exists? (d.data().email||currentUser.email||''): (currentUser.email||''); emailDisplay.textContent = em || 'No email'; }catch(_){ } }
      try{ await updateHandleCooldownUI(); }catch(_){ }
      // Stats line: PPs and streak
      try{
        const s=document.getElementById('ownStatsLine');
        const d=await usersRef.doc(currentUser.uid).get();
        const pts = d.exists ? Number(d.data().points||0) : 0;
        const streak = d.exists ? Number(d.data().streakDays||0) : 0;
        if(s) s.textContent = `${pts} PPs • 🔥 ${streak}`;
      }catch(_){ }
    }catch(_){ }
    await refreshFriends();
  }

  async function openOtherProfile(uid){
    try{
      const d = await usersRef.doc(uid).get(); const u = d.exists? d.data():{};
      applyProfileView(PROFILE_VIEW.OTHER);
      const av = document.getElementById('otherProfileAvatar');
      if(av){
        const url = u.photoURL||'';
        if(url){
          av.style.backgroundImage = `url("${url}")`;
          av.style.backgroundSize = 'cover';
          av.style.backgroundPosition = 'center';
          av.style.backgroundRepeat = 'no-repeat';
          av.classList.add('custom-avatar');
        } else {
          av.style.backgroundImage = '';
          av.classList.remove('custom-avatar');
        }
      }
      const nm = document.getElementById('otherProfileName');
      if(nm){
        const handle = (u && u.handle) ? String(u.handle).trim() : '';
        const display = handle ? `@${handle}` : `@user${String(uid||'').slice(0,6)}`;
        nm.textContent = display;
      }
      try{
        const s=document.getElementById('otherStatsLine');
        const pts = Number(u.points||0);
        const streak = Number(u.streakDays||0);
        if(s) s.textContent = `${pts} PPs • 🔥 ${streak}`;
      }catch(_){ }
      openModal('profileModal');
    }catch(e){ console.error(e); showToast('Could not load profile'); }
  }
  // Use event delegation for dynamic buttons
  document.addEventListener('click', async (e) => {
    if(e.target.id === 'openSettings'){
    try{
      if(typeof applyProfileView==='function') applyProfileView(PROFILE_VIEW.SETTINGS);
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
      try{ renderCustomPingUI(); }catch(_){ }
    }catch(_){ }
    }
    if(e.target.id === 'backToProfile') { await openOwnProfile(); }
    if(e.target.id === 'openGift'){ openModal('giftModal'); }
  });

  // Ledger button
  const ledgerBtn = document.getElementById('ledgerBtn');
  if(ledgerBtn){ ledgerBtn.onclick = async ()=>{ try{ if(!currentUser) return showToast('Sign in to view'); openModal('ledgerModal'); await renderLedger(); }catch(_){ } }; }
  const closeLedger = document.getElementById('closeLedger'); if(closeLedger){ closeLedger.onclick = ()=> closeModal('ledgerModal'); }
  const closeGift = document.getElementById('closeGift'); if(closeGift){ closeGift.onclick = ()=> closeModal('giftModal'); }
  const closeStore = document.getElementById('closeStore'); if(closeStore){ closeStore.onclick = ()=> closeModal('storeModal'); }
  const sendGift = document.getElementById('sendGift');
  if(sendGift){ sendGift.onclick = async ()=>{
    try{
      if(!currentUser) return showToast('Sign in first','error');
      const who=(document.getElementById('giftWho').value||'').trim().toLowerCase();
      const amt=Number(document.getElementById('giftAmt').value||'0');
      if(!who || !Number.isFinite(amt) || amt<=0) return showToast('Enter friend and amount','warning');
      const targetUid = await resolveUserByHandleOrEmail(who);
      if(!targetUid) return showToast('No such user','error');
      if(targetUid===currentUser.uid) return showToast('You cannot gift yourself','warning');
      if(!myFriends || !myFriends.has(targetUid)) return showToast('Only gift to friends','warning');
      await db.runTransaction(async tx=>{
        const fromRef=usersRef.doc(currentUser.uid); const toRef=usersRef.doc(targetUid);
        const [fromSnap,toSnap]=await Promise.all([tx.get(fromRef), tx.get(toRef)]);
        const fromPts = Math.max(0, Number(fromSnap.exists? fromSnap.data().points||0 : 0));
        if(fromPts < amt) throw new Error('insufficient');
        tx.set(fromRef, { points: fromPts - amt }, { merge:true });
        const toPts = Math.max(0, Number(toSnap.exists? toSnap.data().points||0 : 0));
        tx.set(toRef, { points: toPts + amt }, { merge:true });
        // Ledger entries
        const now=firebase.firestore.FieldValue.serverTimestamp();
        tx.set(fromRef.collection('ledger').doc(), { ts:now, type:'gift_out', amount:amt, to:targetUid });
        tx.set(toRef.collection('ledger').doc(), { ts:now, type:'gift_in', amount:amt, from:currentUser.uid });
      });
      showToast(`Gifted ${amt} PPs`,'success');
      closeModal('giftModal');
    }catch(e){ if(String(e&&e.message||'').includes('insufficient')) showToast('Not enough PPs','error'); else { console.error(e); showToast('Gift failed','error'); } }
  }; }

  // Autosuggest for Gift PPs friend input (friends-only)
  const giftWho = document.getElementById('giftWho');
  if(giftWho){
    giftWho.addEventListener('input', async ()=>{
      try{
        const val=(giftWho.value||'').toLowerCase().replace(/[^a-z0-9_.]/g,'');
        if(!val){ hideMentionSuggest(); return; }
        const ids = myFriends ? Array.from(myFriends).slice(0,100) : [];
        const snaps = await Promise.all(ids.map(id=> usersRef.doc(id).get().catch(()=>null)));
        const items=[]; snaps.forEach(s=>{ if(!s||!s.exists) return; const u=s.data(); const h=u&&u.handle? String(u.handle).trim().toLowerCase():''; if(h && h.startsWith(val)) items.push({ label:'@'+h, insert:h, photoURL:u.photoURL||'' }); });
        showMentionSuggest(items, giftWho); mentionTarget={type:'gift'};
      }catch(_){ }
    });
  }

  // Close pin preview modal
  (function(){ const closeBtn=document.getElementById('closePinPreview'); if(closeBtn){ closeBtn.onclick=()=> closeModal('pinPreviewModal'); }})();

  async function renderLedger(){
    try{
      const el=document.getElementById('ledgerContent'); if(!el) return;
      el.innerHTML='<div class="muted">Loading…</div>';
      const qs = await usersRef.doc(currentUser.uid).collection('ledger').orderBy('ts','desc').limit(100).get();
      if(qs.empty){ el.innerHTML='<div class="muted">No activity</div>'; return; }
      const frag=document.createDocumentFragment();
      // Group by day for neatness
      const groups=new Map();
      qs.forEach(doc=>{ const d=doc.data(); const dt=d.ts&&d.ts.toDate? d.ts.toDate():new Date(); const key=dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); if(!groups.has(key)) groups.set(key, []); groups.get(key).push({dt,d}); });
      for(const [day,items] of groups){ const h=document.createElement('div'); h.style.fontWeight='900'; h.style.marginTop='6px'; h.textContent=day; frag.appendChild(h); let net=0; items.forEach(({d,dt})=>{ const row=document.createElement('div'); row.className='req-card'; let line=''; if(d.type==='gift_in'){ net+=Number(d.amount||0); line=`+${d.amount} from ${d.from}`; } else if(d.type==='gift_out'){ net-=Number(d.amount||0); line=`-${d.amount} to ${d.to}`; } else if(d.type==='unlock_ping'){ net-=Number(d.amount||0); line=`-${d.amount} unlock ${d.tier}`; } else if(d.type==='award'){ net+=Number(d.amount||0); line=`+${d.amount} ${d.reason||''}`; } else { line=`${d.type||'activity'} ${d.amount||''}`; } row.textContent=`${line}`; frag.appendChild(row); }); const sum=document.createElement('div'); sum.className='muted'; sum.textContent=`Net: ${net>0?'+':''}${net} PPs`; frag.appendChild(sum); }
      el.innerHTML=''; el.appendChild(frag);
    }catch(_){ }
  }

  if(saveHandle){
    saveHandle.onclick = async ()=>{
      if(!currentUser) return showToast('Sign in first');
      let raw = (handleInput && handleInput.value || '').trim();
      if(!raw) return;
      raw = raw.toLowerCase().replace(/[^a-z0-9_.]/g,'').slice(0,24);
      if(!raw) return showToast('Invalid username');
      if(raw === 'friends') return showToast('That name is reserved');
      // Check availability (allow if it's already mine)
      try{
        const hRef = db.collection('handles').doc(raw);
        const exists = await hRef.get();
        if(exists.exists && exists.data() && exists.data().uid !== currentUser.uid){ showToast('Name taken'); return; }
        const uref = usersRef.doc(currentUser.uid); const ud = await uref.get(); const prev = ud.exists? (ud.data().handle||null) : null;
        if(prev === raw){
          try{ await refreshAuthUI(currentUser); }catch(_){ }
          try{ await updateHandleCooldownUI(); }catch(_){ }
          showToast('Username saved');
          return;
        }
        const now=firebase.firestore.FieldValue.serverTimestamp();
        await hRef.set({ uid: currentUser.uid, updatedAt: now });
        await uref.set({ handle: raw, handleLC: raw, lastHandleChangeAt: now }, { merge:true });
        try{ if(prev && prev !== raw){ await db.collection('handles').doc(prev).delete(); } }catch(_){ }
        try{ await uref.collection('ledger').add({ ts: now, type:'handle_change', amount:0 }); }catch(_){ }
        // Post-write UI updates should not flip success status
        try{ await refreshAuthUI(currentUser); }catch(_){ }
        try{ await updateHandleCooldownUI(); }catch(_){ }
        showToast('Username updated');
      }catch(e){ console.error(e); showToast('Username update failed'); }
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
  // Custom Ping UI setup
  const customPingOptions = document.getElementById('customPingOptions');
  const customPingInput = document.getElementById('customPingInput');
  // Accessed via openModal/closeModal by id; no local reference needed
  const pingCropImage = document.getElementById('pingCropImage');
  const pingCropZoom = document.getElementById('pingCropZoom');
  const closePingCrop = document.getElementById('closePingCrop');
  const savePingCrop = document.getElementById('savePingCrop');
  const pingPreview = document.getElementById('pingPreview');
  const pingCropState = { startX:0,startY:0,imgX:0,imgY:0,dragging:false,scale:1,imgW:0,imgH:0 };
  function renderPingCropTransform(){
    if(!pingCropImage) return;
    const s=Math.max(0.2, Math.min(5, pingCropState.scale));
    pingCropImage.style.transform = `translate(calc(-50% + ${pingCropState.imgX}px), calc(-50% + ${pingCropState.imgY}px)) scale(${s})`;
    // Also render live preview
    try{
      const canvas = pingPreview; if(!canvas) return; const ctx=canvas.getContext('2d'); if(!ctx) return; if(canvas.width!==120) canvas.width=120; if(canvas.height!==160) canvas.height=160; ctx.clearRect(0,0,canvas.width,canvas.height);
      // Draw pin path and clip
      ctx.save();
      ctx.scale(canvas.width/100, canvas.height/100);
      const path=new Path2D('M50 10c17 0 30 13 30 30 0 22-30 50-30 50S20 62 20 40c0-17 13-30 30-30z');
      ctx.clip(path);
      ctx.setTransform(1,0,0,1,0,0);
      const img=pingCropImage; if(!img || !img.naturalWidth) { ctx.restore(); return; }
      // Match overlay scale (CSS uses center/70% 70% for the pin mask)
      const CLIP_SCALE = 0.70;
      const effW = canvas.width * CLIP_SCALE;
      const effH = canvas.height * CLIP_SCALE;
      // Base contains to visible clip area, then apply user scale and pan
      const base=Math.min(effW/img.naturalWidth, effH/img.naturalHeight);
      const drawS = s*base; const drawW=img.naturalWidth*drawS, drawH=img.naturalHeight*drawS;
      const frameEl=document.getElementById('pingCropFrame'); const offX=(pingCropState.imgX/frameEl.clientWidth)*effW; const offY=(pingCropState.imgY/frameEl.clientHeight)*effH;
      const dx=canvas.width/2 - drawW/2 + offX; const dy=canvas.height/2 - drawH/2 + offY;
      ctx.drawImage(img, dx, dy, drawW, drawH);
      ctx.restore();
      // Outline
      ctx.save(); ctx.scale(canvas.width/100, canvas.height/100); ctx.strokeStyle='rgba(0,0,0,.35)'; ctx.lineWidth=1.8; ctx.stroke(path); ctx.restore();
      // Hint the clip with a subtle shadow so edges are clear
      ctx.save(); ctx.scale(canvas.width/100, canvas.height/100); ctx.shadowColor='rgba(0,0,0,.08)'; ctx.shadowBlur=6; ctx.stroke(path); ctx.restore();
    }catch(_){ }
  }
  function addPingDrag(el){ el.addEventListener('pointerdown', (e)=>{ pingCropState.dragging=true; pingCropState.startX=e.clientX; pingCropState.startY=e.clientY; el.setPointerCapture(e.pointerId); }); el.addEventListener('pointermove', (e)=>{ if(!pingCropState.dragging) return; const dx=e.clientX-pingCropState.startX, dy=e.clientY-pingCropState.startY; pingCropState.imgX+=dx; pingCropState.imgY+=dy; pingCropState.startX=e.clientX; pingCropState.startY=e.clientY; renderPingCropTransform(); }); el.addEventListener('pointerup', ()=>{ pingCropState.dragging=false; }); el.addEventListener('pointercancel', ()=>{ pingCropState.dragging=false; }); }
  if(pingCropImage){ addPingDrag(pingCropImage); }
  if(pingCropZoom){ pingCropZoom.oninput=(e)=>{ pingCropState.scale=Number(e.target.value||'1'); renderPingCropTransform(); }; }
  if(closePingCrop){ closePingCrop.onclick = ()=> closeModal('pingCropModal'); }
  const TIERS=[{tier:0,label:'Default',price:0},{tier:100,label:'Purple',price:100},{tier:200,label:'Alien',price:200},{tier:300,label:'Galactic',price:300},{tier:500,label:'Nuke',price:500},{tier:1000,label:'Custom Image (sub only)',price:1000}];
  async function renderCustomPingUI(){
    try{
      if(!customPingOptions || !currentUser) return;
      const snap=await usersRef.doc(currentUser.uid).get(); const u=snap.exists? snap.data():{};
      const owned=u.ownedPings||{}; const sel=Number(u.selectedPingTier||0);
      customPingOptions.innerHTML=''; customPingOptions.classList.add('ping-grid');
      TIERS.forEach(t=>{
        const row=document.createElement('div'); row.className='ping-card';
        let ownedFlag = !!owned[t.tier] || t.tier===0;
        const price = t.price;
        const preview=document.createElement('div'); preview.className='pin-preview';
        let svg = balloonSVG(t.tier===0? '#16a34a' : (t.tier===100?'#7c3aed': t.tier===200?'#0ea5e9': t.tier===300?'#0f172a': t.tier===500?'#fde047':'#e5e7eb'), 42, { variant: t.tier===200?'alien': t.tier===300?'galactic': t.tier===500?'nuke': null });
        if(t.tier===1000){ svg = balloonSVG('#e5e7eb',42,{ image: (u.customPingUrl||null) }); }
        preview.innerHTML=svg.html;
        // Click to open big preview modal
        preview.style.cursor='zoom-in';
        preview.onclick=()=>{
          try{
            const big=document.getElementById('pinPreviewBig'); if(!big) return; const bigSvg = (t.tier===1000) ? balloonSVG('#e5e7eb', 480, { image:(u.customPingUrl||null) }) : balloonSVG((t.tier===0?'#16a34a': t.tier===100?'#7c3aed': t.tier===200?'#0ea5e9': t.tier===300?'#0f172a': t.tier===500?'#fde047':'#e5e7eb'), 480, { variant: t.tier===200?'alien': t.tier===300?'galactic': t.tier===500?'nuke': null });
            big.innerHTML=bigSvg.html;
            try{ const svgEl = big.querySelector('svg'); if(svgEl){ svgEl.style.width='min(680px, 90%)'; svgEl.style.height='auto'; } }catch(_){ }
            openModal('pinPreviewModal');
          }catch(_){ }
        };
        const label=document.createElement('div'); label.className='ping-label'; label.textContent = `${t.label}${price?` — ${price} PPs`:''}`; label.style.fontWeight='900';
        const btn=document.createElement('button'); btn.className='btn'; btn.textContent = ownedFlag? (sel===t.tier?'Selected':'Select') : 'Unlock'; btn.style.minWidth='76px';
        
        if(!ownedFlag && t.tier!==0){ btn.onclick = async ()=>{
          try{
            await db.runTransaction(async tx=>{
              const ref=usersRef.doc(currentUser.uid); const s=await tx.get(ref); const prev=s.exists? Number(s.data().points||0):0; if(prev < price) throw new Error('insufficient');
              const now=firebase.firestore.FieldValue.serverTimestamp();
              const ownedNext=Object.assign({}, s.exists? (s.data().ownedPings||{}):{}); ownedNext[t.tier]=true;
              tx.set(ref,{ points: prev-price, ownedPings: ownedNext, selectedPingTier:t.tier },{merge:true});
              tx.set(ref.collection('ledger').doc(), { ts:now, type:'unlock_ping', amount:price, tier:t.tier });
            });
            showToast('Unlocked','success');
            renderCustomPingUI();
          }catch(e){ if(String(e&&e.message||'').includes('insufficient')) showToast('Not enough PPs','error'); else { console.error(e); showToast('Unlock failed','error'); } }
        }; } else {
          btn.onclick = async ()=>{ try{ await usersRef.doc(currentUser.uid).set({ selectedPingTier:t.tier }, { merge:true }); showToast('Selected','success'); renderCustomPingUI(); try{ userDocCache.delete(currentUser.uid); }catch(_){ } try{ restyleMarkers(); }catch(_){ } }catch(_){ showToast('Select failed','error'); } };
        }
        row.appendChild(preview); row.appendChild(label); row.appendChild(btn);
        const lock=document.createElement('div'); lock.className='lock'; lock.textContent = ownedFlag? '' : '🔒'; row.appendChild(lock);
        if(t.tier===1000){
          const up=document.createElement('label');
          up.className='btn';
          up.textContent='Upload Image';
          up.htmlFor='customPingInput';
          up.style.padding='10px 14px';
          // place upload button right before the Select/Unlock button
          row.insertBefore(up, btn);
        }
        customPingOptions.appendChild(row);
      });
    }catch(_){ }
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

  // Initialize custom ping UI when opening settings
  document.addEventListener('click', (e)=>{
    if(e.target && e.target.id==='openSettings'){
      applyProfileView(PROFILE_VIEW.SETTINGS);
      setTimeout(()=>{ try{ renderCustomPingUI(); }catch(_){ } }, 0);
    }
    if(e.target && e.target.id==='backToProfile'){
      applyProfileView(PROFILE_VIEW.OWN);
    }
    if(e.target && e.target.id==='openStore'){ try{ openModal('storeModal'); renderStore(); }catch(_){ } }
  });

  // Store: PPs bundles + subscription
  const ppBundles = [
    { amount:100, price:1.49 },
    { amount:300, price:3.99 },
    { amount:700, price:7.99 },
    { amount:1500, price:14.99 }
  ];
  function fmt(n){ return n.toLocaleString(); }
  async function renderStore(){
    try{
      const cont=document.getElementById('ppBundles'); if(cont){ cont.innerHTML=''; }
      ppBundles.forEach(b=>{
        const btn=document.createElement('button'); btn.className='btn'; btn.textContent = `${fmt(b.amount)} PPs — $${b.price.toFixed(2)}`;
        btn.onclick = async ()=>{
          try{
            if(!currentUser) return showToast('Sign in first');
            await usersRef.doc(currentUser.uid).set({ points: firebase.firestore.FieldValue.increment(b.amount) }, { merge:true });
            await usersRef.doc(currentUser.uid).collection('ledger').add({ ts: firebase.firestore.FieldValue.serverTimestamp(), type:'buy_pps', amount:b.amount, price:b.price });
            showToast(`Added ${fmt(b.amount)} PPs`, 'success');
            try{ await refreshTopProfileStats(); }catch(_){ }
          }catch(e){ console.error(e); showToast('Purchase failed'); }
        };
        if(cont) cont.appendChild(btn);
      });
      const subBtn=document.getElementById('subscribeBtn');
      const subStatus=document.getElementById('subStatus');
      if(subBtn){
        subBtn.onclick = async ()=>{
          try{
            if(!currentUser) return showToast('Sign in first');
            const ref = usersRef.doc(currentUser.uid);
            await ref.set({ subActive:true, subStartedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
            await ref.set({ points: firebase.firestore.FieldValue.increment(100) }, { merge:true });
            await ref.collection('ledger').add({ ts: firebase.firestore.FieldValue.serverTimestamp(), type:'subscribe', price:1.99, bonusPPs:100 });
            showToast('Subscribed! +100 PPs', 'success');
            if(subStatus) subStatus.textContent = 'Active — $1.99/mo';
            try{ await refreshTopProfileStats(); }catch(_){ }
            try{ renderCustomPingUI(); }catch(_){ }
          }catch(e){ console.error(e); showToast('Subscription failed'); }
        };
      }
      try{
        if(currentUser){
          const d=await usersRef.doc(currentUser.uid).get(); const u=d.exists? d.data():{};
          if(subStatus) subStatus.textContent = u.subActive ? 'Active — $1.99/mo' : 'Not active';
        }
      }catch(_){ }
    }catch(_){ }
  }

  async function refreshTopProfileStats(){ try{ if(currentUser){ const d=await usersRef.doc(currentUser.uid).get(); const u=d.exists? d.data():{}; const ownStatsLine=document.getElementById('ownStatsLine'); if(ownStatsLine){ const pts=Number(u.points||0); const streak=Number(u.streakDays||0); ownStatsLine.textContent = `${pts} PPs • 🔥 ${streak}`; } } }catch(_){ } }
  


  // Handle custom ping image upload (1000-tier)
  if(customPingInput){
    customPingInput.onchange = ()=>{
      try{
        const f=customPingInput.files && customPingInput.files[0]; if(!f) return; if(f.size>5*1024*1024) return showToast('Image must be ≤ 5MB','warning');
        // Load image into ping crop modal (independent of avatar)
        const url = URL.createObjectURL(f);
        pingCropState.imgX=0; pingCropState.imgY=0; pingCropState.scale=1;
        if(pingCropZoom){ try{ pingCropZoom.value='1'; }catch(_){ } }
        if(pingCropImage){ pingCropImage.src=url; pingCropImage.onload=()=>{ URL.revokeObjectURL(url); renderPingCropTransform(); }; }
        openModal('pingCropModal');
        // Save handler for pin-shaped export
        if(savePingCrop){ savePingCrop.onclick = async ()=>{
          try{
            if(!currentUser) return;
            const ownedSnap=await usersRef.doc(currentUser.uid).get(); const owned=(ownedSnap.exists? ownedSnap.data().ownedPings||{}:{});
            if(!owned[1000]){ showToast('Unlock Custom Image ping first'); return; }
            // Use the same aspect as the live preview canvas so saved output matches what user sees
            const previewCanvas = document.getElementById('pingPreview');
            const outScale = 3; // export at higher resolution for quality
            const outW = (previewCanvas? previewCanvas.width : 120) * outScale;
            const outH = (previewCanvas? previewCanvas.height: 160) * outScale;
            const canvas=document.createElement('canvas'); canvas.width=outW; canvas.height=outH; const ctx=canvas.getContext('2d');
            const img=pingCropImage; if(!img || !img.naturalWidth){ showToast('Image not ready'); return; }
            // Define pin clip in normalized coords; keep clip active across drawing
            ctx.save();
            ctx.scale(canvas.width/100, canvas.height/100);
            const path=new Path2D('M50 10c17 0 30 13 30 30 0 22-30 50-30 50S20 62 20 40c0-17 13-30 30-30z');
            ctx.clip(path);
            // Reset transform but keep clip
            ctx.setTransform(1,0,0,1,0,0);
            // Scale image to CONTAIN canvas initially, then apply user zoom + pan
            const frameEl = document.getElementById('pingCropFrame');
            // Match the clip scale (70%) used by the overlay for visual alignment
            const CLIP_SCALE = 0.70;
            const effW = canvas.width * CLIP_SCALE;
            const effH = canvas.height * CLIP_SCALE;
            const base = Math.min(effW / img.naturalWidth, effH / img.naturalHeight);
            const s = Math.max(0.2, Math.min(5, pingCropState.scale)) * base;
            const drawW = img.naturalWidth * s;
            const drawH = img.naturalHeight * s;
            const offX = (pingCropState.imgX / frameEl.clientWidth) * effW;
            const offY = (pingCropState.imgY / frameEl.clientHeight) * effH;
            const dx = canvas.width/2 - drawW/2 + offX;
            const dy = canvas.height/2 - drawH/2 + offY;
            ctx.drawImage(img, dx, dy, drawW, drawH);
            // Fill background to ensure no transparency, then restore
            ctx.globalCompositeOperation='destination-over';
            ctx.fillStyle='#ffffff';
            ctx.fillRect(0,0,canvas.width,canvas.height);
            // Restore after draw (clip no longer needed)
            ctx.restore();
            const dataUrl = canvas.toDataURL('image/png');
            await usersRef.doc(currentUser.uid).set({ customPingUrl:dataUrl, selectedPingTier:1000 }, { merge:true });
            // Refresh cache and markers immediately
            try{ userDocCache.delete(currentUser.uid); }catch(_){ }
            try{ // Update icons synchronously for best UX
              markers.forEach((m,id)=>{ const p=lastPingCache.get(id); if(!p) return; if(p.authorId===currentUser.uid){ iconForPing(p,false).then(ic=>{ try{ m.setIcon(ic); }catch(_){ } }); } });
            }catch(_){ }
            try{ renderCustomPingUI(); }catch(_){ }
            closeModal('pingCropModal'); showToast('Custom ping image set','success');
          }catch(_){ showToast('Save failed'); }
        }; }
      }catch(_){ }
    };
  }

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


  let friendsRenderToken = 0;
  async function refreshFriends(){
    const friendList = document.getElementById('profileFriendsList');
    const myCodeEl = document.getElementById('myCodeEl');
    if(!friendList){ return; }
    // Clean up any legacy inline Gift PPs UI accidentally added inside the Friends section
    try{
      const parent = friendList.parentElement;
      if(parent){ parent.querySelectorAll('#giftTarget, #giftAmount, #giftBtn').forEach(el=>{ const sec=el.closest('.section'); if(sec && sec!==parent) sec.remove(); }); }
    }catch(_){ }
    if(!currentUser){ friendList.innerHTML='<div class="muted">Sign in to manage friends.</div>'; return; }
    const doc=await usersRef.doc(currentUser.uid).get(); const data=doc.exists? doc.data():{friendIds:[]};
    // Dedup and normalize friend list
    const originalIds = (data.friendIds||[]).filter(Boolean);
    const uniqueIds = Array.from(new Set(originalIds));
    if(uniqueIds.length !== originalIds.length){ try{ await usersRef.doc(currentUser.uid).set({ friendIds: uniqueIds }, { merge:true }); }catch(_){ } }
    myFriends=new Set(uniqueIds); if(myCodeEl) myCodeEl.value=currentUser.uid;
    const token = ++friendsRenderToken;
    friendList.innerHTML='';
    if(!uniqueIds.length){ friendList.innerHTML='<div class="muted">No friends yet. Share your code above.</div>'; reFilterMarkers(); return; }
    // Fetch friend docs in parallel
    const docs = await Promise.all(uniqueIds.map(fid=> usersRef.doc(fid).get().catch(()=>null)));
    if(token!==friendsRenderToken) return; // stale render
    const friends = uniqueIds.map((fid, idx)=>{
      const fdoc = docs[idx]; const d = fdoc && fdoc.exists ? fdoc.data() : {};
      const handle = d && d.handle ? String(d.handle).trim() : '';
      const name = handle ? `@${handle}` : (d.displayName || d.email || 'Friend');
      return { fid, name };
    }).sort((a,b)=> a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    if(token!==friendsRenderToken) return;
    const frag=document.createDocumentFragment();
    for(const fr of friends){
      const row=document.createElement('div'); row.className='friend-item'; row.setAttribute('tabindex','0'); row.style.cursor='pointer'; row.onclick=()=>openOtherProfile(fr.fid); row.onkeydown=(e)=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); openOtherProfile(fr.fid); } };
      row.innerHTML=`<div><strong>${fr.name}</strong></div>`;
      const rm=document.createElement('button'); rm.className='btn'; rm.textContent='Remove';
      rm.onclick=async(e)=>{ 
        e.stopPropagation(); 
        await usersRef.doc(currentUser.uid).set({ friendIds: firebase.firestore.FieldValue.arrayRemove(fr.fid) },{merge:true}); 
        await usersRef.doc(fr.fid).set({ friendIds: firebase.firestore.FieldValue.arrayRemove(currentUser.uid) },{merge:true});
        // Clean up any accepted/pending request docs between these two users
        try {
          const ids=[currentUser.uid, fr.fid];
          const pair=[ids[0]+'_'+ids[1], ids[1]+'_'+ids[0]];
          for(const id of pair){
            const r= db.collection('friendRequests').doc(id);
            const rd=await r.get();
            if(rd.exists){
              const st=rd.data().status||'pending';
              if(st!=='accepted'){
                await r.delete();
              } else {
                await r.set({ status:'canceled', decidedAt: firebase.firestore.FieldValue.serverTimestamp() }, { merge:true });
              }
            }
          }
        } catch(_) { }
        showToast('Removed'); 
        refreshFriends(); 
      };
      row.appendChild(rm); frag.appendChild(row);
    }
    friendList.innerHTML=''; friendList.appendChild(frag);
    reFilterMarkers();
  }
  // Expose for tooling to satisfy aggressive linters
  try{ window.refreshFriends = refreshFriends; }catch(_){ }

  /* --------- Notifications --------- */
  const notifBadge=$('#notifBadge'), notifsContent=$('#notifsContent');
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
  // Expose for tooling and ensure it's considered "used" by TS checkers
  try{ window.startNotifListener = startNotifListener; }catch(_){ }

  /* --------- Ping of the Week --------- */

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

    // Countdown to week end (Montreal time)
    try{
      const cd = document.getElementById('potwCountdown');
      if(cd){ cd.textContent = potwEndsInText(); }
    }catch(_){ }

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
      // Subtle confetti burst near the card
      try{ triggerConfettiAtCard(); }catch(_){ }
    };
  }

  function triggerConfettiAtCard(){
    try{
      const card = document.getElementById('potwCard'); if(!card) return;
      let layer = card.querySelector('.confetti-layer');
      if(!layer){ layer = document.createElement('div'); layer.className='confetti-layer'; card.appendChild(layer); }
      // Create ~18 pieces around the title area
      for(let i=0;i<18;i++){
        const piece=document.createElement('div'); piece.className='confetti-piece';
        piece.style.left = (40 + Math.random()*40) + '%';
        piece.style.top  = (8 + Math.random()*18) + 'px';
        const colors=['#f59e0b','#d4af37','#10b981','#3b82f6','#ef4444'];
        piece.style.backgroundColor = colors[Math.floor(Math.random()*colors.length)];
        piece.style.transform = `translateY(0) rotate(${Math.floor(Math.random()*60)}deg)`;
        layer.appendChild(piece);
        setTimeout(()=>{ try{ piece.remove(); }catch(_){ } }, 950);
      }
    }catch(_){ }
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
    try{ return await getHandleForUid(uid); }catch(_){ return `@user${String(uid||'').slice(0,6)}`; }
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

  // If one has a real milestone and the other doesn't, the one with the milestone wins
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
  }catch(e){}

  if(prev !== (currentPotw ? currentPotw.id : null)){
    // Notify PotW winner when a new winner is set
    try{
      if(currentPotw && currentPotw.authorId){
        // Deduped PotW notification: write to fixed doc id per week+winner
        const monday1 = startOfWeekMondayLocal();
        const weekKey1 = `${monday1.getFullYear()}_${monday1.getMonth()+1}_${monday1.getDate()}`;
        const notifId = `potw_${weekKey1}_${currentPotw.id}`;
        await db.runTransaction(async (tx)=>{
          const nref = usersRef.doc(currentPotw.authorId).collection('notifications').doc(notifId);
          const ns = await tx.get(nref);
          if(!ns.exists){ tx.set(nref, { type:'potw_awarded', pingId: currentPotw.id, net: currentPotw.net || netLikes(lastPingCache.get(currentPotw.id) || {}), bonus:75, createdAt: firebase.firestore.FieldValue.serverTimestamp() }); }
        });
        // Award PotW PPs once per week per winner (client-side dedupe via meta)
        const monday2 = startOfWeekMondayLocal();
        const weekKey2 = `${monday2.getFullYear()}_${monday2.getMonth()+1}_${monday2.getDate()}`;
        const metaId = `potw_${weekKey2}_${currentPotw.authorId}`;
        await db.runTransaction(async (tx)=>{
          const mref = db.collection('meta').doc(metaId);
          const msnap = await tx.get(mref);
          if(msnap.exists) return;
          tx.set(mref, { type:'potw_award', at: firebase.firestore.FieldValue.serverTimestamp(), pid: currentPotw.id });
          const uref = usersRef.doc(currentPotw.authorId);
          const usnap = await tx.get(uref);
          const prevPts = usnap.exists ? Number(usnap.data().points||0) : 0;
          tx.set(uref, { points: Math.max(0, prevPts + 75) }, { merge:true });
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

  // Update PotW countdown every 60s
  setInterval(()=>{ try{ const cd=document.getElementById('potwCountdown'); if(cd){ cd.textContent = potwEndsInText(); } }catch(_){ } }, 60*1000);

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
setTimeout(function(){ try { applyModalOpenClass(); } catch(e) {} }, 100);
}
}
// Start the app
main().catch(console.error);

