/* Main App — state, game loop, keyboard handling */

const { useState, useEffect, useRef, useMemo, useCallback } = React;

function distance(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function rectContains(r, p) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

// ----- Walls + door collision -----

// Player collision radius (avatar bubble is 52px; collision a bit smaller so
// the bubble can sit right against a wall without overlapping).
const PLAYER_R = 20;
// Wall thickness in world units (matches the 6px room border in CSS).
const WALL_T = 6;

// Default door for an enclosed room: on the side that faces into the building
// (so top-row rooms get doors on their bottom, bottom-row rooms on their top).
function defaultDoor(room, floor) {
  if (room.door) return room.door;
  const isUpper = (room.y + room.h / 2) < floor.h / 2;
  const side = isUpper ? 'bottom' : 'top';
  const w = 64;
  const pos = (side === 'top' || side === 'bottom')
    ? room.w / 2 - w / 2
    : room.h / 2 - w / 2;
  return { side, pos, width: w };
}

// Walls only exist for meeting + focus rooms; social rooms are open zones.
function isWalled(room) {
  return room.type === 'meeting' || room.type === 'focus';
}

// Returns array of AABB wall rectangles for one room, with the door cut out
// when the door is "open" (= not locked, or player is currently inside).
function wallRectsFor(room, doorOpen, floor) {
  if (!isWalled(room)) return [];
  const t = WALL_T;
  const door = defaultDoor(room, floor);
  const segs = [];
  const cutHoriz = (yWall, side) => {
    if (doorOpen && door.side === side) {
      if (door.pos > 0)
        segs.push({ x: room.x, y: yWall, w: door.pos, h: t });
      if (door.pos + door.width < room.w)
        segs.push({ x: room.x + door.pos + door.width, y: yWall,
                    w: room.w - (door.pos + door.width), h: t });
    } else {
      segs.push({ x: room.x, y: yWall, w: room.w, h: t });
    }
  };
  const cutVert = (xWall, side) => {
    if (doorOpen && door.side === side) {
      if (door.pos > 0)
        segs.push({ x: xWall, y: room.y, w: t, h: door.pos });
      if (door.pos + door.width < room.h)
        segs.push({ x: xWall, y: room.y + door.pos + door.width,
                    w: t, h: room.h - (door.pos + door.width) });
    } else {
      segs.push({ x: xWall, y: room.y, w: t, h: room.h });
    }
  };
  cutHoriz(room.y,            'top');
  cutHoriz(room.y + room.h - t, 'bottom');
  cutVert (room.x,            'left');
  cutVert (room.x + room.w - t, 'right');
  return segs;
}

// Apply axis-separated collision: tries to move along X first (with current Y),
// then Y. If a wall is in the way, clamp to just outside it so the player can
// slide along walls instead of getting stuck.
function applyCollision(prev, next, rooms, lockedRooms, floor) {
  // Build list of wall rects from all walled rooms.
  // The room the player is CURRENTLY inside always has its door open
  // (so a locked room you're inside still lets you leave).
  const insideId = (rooms.find(r => isWalled(r) && rectContains(r, prev)) || {}).id;
  const allRects = [];
  for (const r of rooms) {
    if (!isWalled(r)) continue;
    const open = (!lockedRooms[r.id]) || (r.id === insideId);
    const rects = wallRectsFor(r, open, floor);
    for (const w of rects) allRects.push(w);
  }

  const R = PLAYER_R;
  const tryAxis = (px, py, dx, dy) => {
    // Test player AABB at (px+dx, py+dy) against each wall expanded by R.
    let nx = px + dx, ny = py + dy;
    for (const w of allRects) {
      // Player as AABB: [nx-R, nx+R] × [ny-R, ny+R]
      const ax = nx - R, ay = ny - R, aw = 2 * R, ah = 2 * R;
      // Overlap test
      if (ax < w.x + w.w && ax + aw > w.x &&
          ay < w.y + w.h && ay + ah > w.y) {
        // Resolve along the moved axis only — push back to just outside the wall.
        if (dx !== 0) {
          nx = (dx > 0) ? w.x - R - 0.01 : w.x + w.w + R + 0.01;
        } else if (dy !== 0) {
          ny = (dy > 0) ? w.y - R - 0.01 : w.y + w.h + R + 0.01;
        }
      }
    }
    return { x: nx, y: ny };
  };

  // Move X then Y so the player can slide along walls.
  const afterX = tryAxis(prev.x, prev.y, next.x - prev.x, 0);
  const afterY = tryAxis(afterX.x, afterX.y, 0, next.y - prev.y);
  return afterY;
}

function App() {
  const FLOOR_W = window.FLOOR_W, FLOOR_H = window.FLOOR_H;

  // Active layout selection
  const [layoutId, setLayoutId] = useState(window.DEFAULT_LAYOUT || 'klassisk');
  const layout = window.LAYOUTS[layoutId];

  // Keep a live ref to the active layout so the rAF game loop always
  // clamps player movement to the CURRENT floor (2400×1350 etc) rather
  // than the stale 1600×900 globals — otherwise WASD can't reach the
  // bottom of larger maps.
  const layoutRef = useRef(layout);
  useEffect(() => { layoutRef.current = layout; }, [layout]);

  const ROOMS = layout.rooms;
  const DESKS = layout.desks;
  const SCREENS = layout.screens;

  // Player state — re-initialized when layout changes
  const initialPlayer = layout.members.find(m => m.isPlayer);
  const [you, setYou] = useState(layout.spawn || { x: initialPlayer.x, y: initialPlayer.y });
  // Live position ref — updated every frame (60fps) so we can stay smooth
  // while the React `you` state itself is throttled to ~25fps for derived
  // computations (audible map, current room, etc). CSS transitions on
  // .vo-floor + .vo-avatar--you visually interpolate between state updates.
  const youRef = useRef(you);
  useEffect(() => { youRef.current = you; }, [layoutId]);
  const [status, setStatus] = useState('available');

  // NPC positions (mutable for wanderer) — re-initialized when layout changes
  const [npcs, setNpcs] = useState(() => layout.members.filter(m => !m.isPlayer));

  // Re-init player + npcs when switching layouts
  useEffect(() => {
    setYou(layout.spawn || { x: layout.members.find(m => m.isPlayer).x, y: layout.members.find(m => m.isPlayer).y });
    setNpcs(layout.members.filter(m => !m.isPlayer));
    setBookedRooms({});
    setPresentingScreen(null);
    setTarget(null);
  }, [layoutId]);

  // Movement target (click-to-move)
  const [target, setTarget] = useState(null);
  // Currently-held keys
  const keysDown = useRef(new Set());

  // UI state
  const [bookingRoom, setBookingRoom] = useState(null);
  const [showHint, setShowHint] = useState(true);
  const [toast, setToast] = useState(null);
  const [bookedRooms, setBookedRooms] = useState({});
  const [theme, setTheme] = useState('hygge');
  const [zoom, setZoom] = useState(0.8);
  const [lockedRooms, setLockedRooms] = useState({});
  // Effective lock: manual lock OR an active booking the player isn't invited to
  // (auto-lock keeps non-invitees from walking into someone else's meeting).
  const effectiveLocks = useMemo(() => {
    const out = { ...lockedRooms };
    for (const r of layout.rooms) {
      if (r.activeBooking) {
        const invited = (r.activeBooking.attendees || []).includes('YOU');
        if (!invited) out[r.id] = true;
      }
    }
    return out;
  }, [lockedRooms, layout]);
  const lockedRef = useRef(effectiveLocks);
  useEffect(() => { lockedRef.current = effectiveLocks; }, [effectiveLocks]);
  const roomsRef = useRef(layout.rooms);
  useEffect(() => { roomsRef.current = layout.rooms; }, [layout]);
  const toggleLock = useCallback((roomId) => {
    setLockedRooms(prev => ({ ...prev, [roomId]: !prev[roomId] }));
  }, []);
  const zoomIn  = useCallback(() => setZoom(z => Math.min(1.8, Math.round((z * 1.15) * 100) / 100)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(0.4, Math.round((z / 1.15) * 100) / 100)), []);
  const zoomReset = useCallback(() => setZoom(0.8), []);

  // Camera + presentation
  const [camStream, setCamStream] = useState(null);
  const [camError, setCamError] = useState(null);
  const [presentingScreen, setPresentingScreen] = useState(null);
  const [presentationSource, setPresentationSource] = useState('slide');

  // Focused avatar (clicked on the floor)
  const [focusedAvatar, setFocusedAvatar] = useState(null);

  // Derived: current room (the one player is inside)
  const currentRoom = useMemo(() => {
    return ROOMS.find(r => rectContains(r, you)) || null;
  }, [you.x, you.y]);

  // Auto-unlock manual locks when the player leaves the room they locked,
  // so they can never lock themselves out of their own room.
  const prevRoomIdRef = useRef(currentRoom?.id || null);
  useEffect(() => {
    const prevId = prevRoomIdRef.current;
    const currId = currentRoom?.id || null;
    if (prevId && prevId !== currId && lockedRooms[prevId]) {
      setLockedRooms(s => ({ ...s, [prevId]: false }));
    }
    prevRoomIdRef.current = currId;
  }, [currentRoom, lockedRooms]);

  // Keyboard
  useEffect(() => {
    const onDown = e => {
      const k = e.key.toLowerCase();
      if (['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)) {
        e.preventDefault();
        keysDown.current.add(k);
        setTarget(null); // cancel click-to-move when user takes manual control
      }
      if (k === 'escape') {
        setBookingRoom(null);
      }
      if (k === '+' || k === '=') { e.preventDefault(); setZoom(z => Math.min(1.8, Math.round((z * 1.15) * 100) / 100)); }
      if (k === '-' || k === '_') { e.preventDefault(); setZoom(z => Math.max(0.4, Math.round((z / 1.15) * 100) / 100)); }
      if (k === '0')              { e.preventDefault(); setZoom(0.8); }
    };
    const onUp = e => {
      keysDown.current.delete(e.key.toLowerCase());
    };
    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    };
  }, []);

  // Game loop — runs ONCE (no dep on target). Uses refs for hot-path state so
  // we don't have to recreate the loop on every state change, and throttles
  // React state updates to 25fps (40ms) for derived computations. The visual
  // position is updated every frame via CSS transitions on the world transform
  // + player avatar (interpolates smoothly between the throttled jumps).
  const targetRef = useRef(target);
  useEffect(() => { targetRef.current = target; }, [target]);

  useEffect(() => {
    let raf, last = performance.now(), lastSet = 0;
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      let cur = youRef.current;
      let dx = 0, dy = 0;
      const keys = keysDown.current;
      if (keys.has('w') || keys.has('arrowup'))    dy -= 1;
      if (keys.has('s') || keys.has('arrowdown'))  dy += 1;
      if (keys.has('a') || keys.has('arrowleft'))  dx -= 1;
      if (keys.has('d') || keys.has('arrowright')) dx += 1;

      let moved = false;
      if (dx !== 0 || dy !== 0) {
        const norm = Math.sqrt(dx * dx + dy * dy);
        dx /= norm; dy /= norm;
        const speed = 280; // logical units/sec
        let nx = cur.x + dx * speed * dt;
        let ny = cur.y + dy * speed * dt;
        const lf = layoutRef.current.floor;
        nx = Math.max(PLAYER_R, Math.min(lf.w - PLAYER_R, nx));
        ny = Math.max(PLAYER_R, Math.min(lf.h - PLAYER_R, ny));
        cur = applyCollision(cur, { x: nx, y: ny },
                              roomsRef.current, lockedRef.current, lf);
        moved = true;
      } else if (targetRef.current) {
        const t = targetRef.current;
        const dxT = t.x - cur.x;
        const dyT = t.y - cur.y;
        const dT = Math.sqrt(dxT * dxT + dyT * dyT);
        if (dT < 4) {
          targetRef.current = null;
          setTarget(null);
        } else {
          const speed = 320;
          const stepX = (dxT / dT) * speed * dt;
          const stepY = (dyT / dT) * speed * dt;
          const lf = layoutRef.current.floor;
          cur = applyCollision(cur,
            { x: cur.x + stepX, y: cur.y + stepY },
            roomsRef.current, lockedRef.current, lf);
          moved = true;
        }
      }

      if (moved) {
        youRef.current = cur;
        // Throttled React state update — 25fps is enough for currentRoom /
        // audibleMap / hint dismissal. The visual is smoothed by CSS transitions.
        if (now - lastSet >= 40) {
          setYou({ x: cur.x, y: cur.y });
          lastSet = now;
        }
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Wanderer NPC tiny drift — throttled to ~10fps; the wanderer doesn't
  // need 60fps updates and was a meaningful chunk of the per-frame React work.
  useEffect(() => {
    let stop = false;
    const interval = setInterval(() => {
      if (stop) return;
      const now = performance.now();
      setNpcs(curr => curr.map(n => {
        if (!n.wandering) return n;
        const t = now / 1000;
        const center = n.wanderCenter || { x: n.x, y: n.y };
        const radius = n.wanderRadius || { x: 80, y: 40 };
        return { ...n,
          x: center.x + Math.sin(t * 0.4) * radius.x,
          y: center.y + Math.cos(t * 0.3) * radius.y,
        };
      }));
    }, 100);
    return () => { stop = true; clearInterval(interval); };
  }, []);

  // Hide hint after first movement
  useEffect(() => {
    if (!showHint) return;
    const dx = you.x - initialPlayer.x, dy = you.y - initialPlayer.y;
    if (Math.sqrt(dx * dx + dy * dy) > 80) {
      setShowHint(false);
    }
  }, [you.x, you.y, showHint]);

  // Audio computation: distance + room isolation
  const audibleMap = useMemo(() => {
    const out = {};
    const FULL = window.AUDIO_FULL_DISTANCE;
    const CUT  = window.AUDIO_CUTOFF_DISTANCE;
    // Social zones extend audio rather than isolating it (per spec §6.3).
    const isolatingRoom = currentRoom && currentRoom.type !== 'social' ? currentRoom : null;
    // Inside a social zone? Audio radius is wider.
    const inSocial = currentRoom && currentRoom.type === 'social';
    const full = inSocial ? FULL * 1.5 : FULL;
    const cut  = inSocial ? CUT * 1.5  : CUT;

    npcs.forEach(n => {
      // Isolation: meeting/focus rooms cut audio from everyone outside that room
      if (isolatingRoom) {
        if (n.room === isolatingRoom.id) { out[n.id] = 1.0; return; }
        out[n.id] = 0; return;
      }
      // NPC inside a meeting/focus room → isolated from you (you're outside)
      const npcRoom = n.room ? ROOMS.find(r => r.id === n.room) : null;
      if (npcRoom && npcRoom.type !== 'social') { out[n.id] = 0; return; }
      // DND: not audible
      if (n.status === 'dnd') { out[n.id] = 0; return; }
      // Only NPCs who are "talking" produce audio in this mock
      if (!n.talking) { out[n.id] = 0; return; }

      const d = distance(you, n);
      if (d <= full) out[n.id] = 1.0;
      else if (d >= cut) out[n.id] = 0;
      else out[n.id] = 1 - (d - full) / (cut - full);
    });
    return out;
  }, [you.x, you.y, npcs, currentRoom]);

  // Build "audible list" for the toast
  const audibleList = useMemo(() => {
    return npcs
      .map(n => ({ ...n, volume: audibleMap[n.id] || 0 }))
      .filter(n => n.volume > 0.05)
      .sort((a, b) => b.volume - a.volume);
  }, [audibleMap, npcs]);

  // Talking set — NPCs with talking:true plus YOU if anyone is audible nearby
  const talkingSet = useMemo(() => {
    const s = new Set(npcs.filter(n => n.talking).map(n => n.id));
    if (audibleList.length > 0) s.add('YOU');
    return s;
  }, [npcs, audibleList]);

  // Status cycle
  const cycleStatus = () => {
    setStatus(s => s === 'available' ? 'busy' : s === 'busy' ? 'dnd' : 'available');
  };

  // Camera toggle (getUserMedia)
  const toggleCam = useCallback(async () => {
    if (camStream) {
      camStream.getTracks().forEach(t => t.stop());
      setCamStream(null);
      setCamError(null);
      // If we were presenting via cam, fall back to slide
      if (presentationSource === 'cam') setPresentationSource('slide');
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      setCamStream(s);
      setCamError(null);
      setToast({ kind: 'ok', text: 'Kamera tændt — andre ser dig i din avatar.' });
      setTimeout(() => setToast(null), 2800);
    } catch (e) {
      const msg = e?.name === 'NotAllowedError'
        ? 'Kamera-adgang afvist'
        : (e?.message || 'Kamera ikke tilgængeligt');
      setCamError(msg);
      setToast({ kind: 'warn', text: `Kunne ikke tænde kamera: ${msg}` });
      setTimeout(() => setToast(null), 4000);
    }
  }, [camStream, presentationSource]);

  // Stop the stream on unmount
  useEffect(() => () => { if (camStream) camStream.getTracks().forEach(t => t.stop()); }, []);

  // Screens: clicking a screen starts a presentation (memoized).
  const handleScreenClick = useCallback((screen) => {
    setPresentingScreen(screen);
    setPresentationSource(camStream ? 'cam' : 'slide');
    setToast({ kind: 'ok', text: `Du præsenterer nu til ${screen.label}` });
    setTimeout(() => setToast(null), 2600);
  }, [camStream]);

  // Esc closes presentation
  useEffect(() => {
    if (!presentingScreen) return;
    const onKey = e => { if (e.key === 'Escape') setPresentingScreen(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presentingScreen]);

  // Esc closes focused avatar
  useEffect(() => {
    if (!focusedAvatar) return;
    const onKey = e => { if (e.key === 'Escape') setFocusedAvatar(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusedAvatar]);

  const handleAvatarClick = useCallback((member) => {
    setFocusedAvatar(member);
  }, []);

  const handleSayHi = (member) => {
    setToast({ kind: 'ok', text: `👋 Du sagde hej til ${member.name.split(' ')[0]}` });
    setTimeout(() => setToast(null), 2500);
  };

  const handleGiveCoffee = (member) => {
    setToast({ kind: 'ok', text: `☕ Kaffe sendt til ${member.name.split(' ')[0]}` });
    setTimeout(() => setToast(null), 2500);
  };

  // Click handlers
  const handleFloorClick = useCallback((p) => setTarget(p), []);

  const handleRoomClick = useCallback((room) => {
    // If the room has an active booking and you're not in it, you can't enter unless you're invited.
    if (room.activeBooking && currentRoom?.id !== room.id) {
      const isInvited = (room.activeBooking.attendees || []).includes('YOU');
      if (!isInvited) {
        setToast({ kind: 'warn', text: `${room.name} er optaget — ${room.activeBooking.title}` });
        setTimeout(() => setToast(null), 2500);
        return;
      }
    }
    // For empty bookable meeting rooms → open booking modal
    if (room.type === 'meeting' && !room.activeBooking && !bookedRooms[room.id]) {
      setBookingRoom(room);
      return;
    }
    // Otherwise walk to room center
    setTarget({ x: room.x + room.w / 2, y: room.y + room.h / 2 });
  }, [currentRoom, bookedRooms]);

  const handleDeskClick = useCallback((desk) => {
    if (desk.owner === 'YOU') {
      setTarget({ x: desk.x, y: desk.y + 8 });
      setToast({ kind: 'info', text: 'Du er ved dit eget bord.' });
      setTimeout(() => setToast(null), 2200);
    } else {
      setTarget({ x: desk.x, y: desk.y - 28 });
    }
  }, []);

  const handleConfirmBooking = ({ title, duration }) => {
    if (!bookingRoom) return;
    const end = new Date(Date.now() + duration * 60 * 1000);
    const hh = String(end.getHours()).padStart(2, '0');
    const mm = String(end.getMinutes()).padStart(2, '0');
    setBookedRooms(prev => ({ ...prev, [bookingRoom.id]: { title, until: `${hh}:${mm}` } }));
    setToast({ kind: 'ok', text: `Booket: ${title} · ${bookingRoom.name} · indtil ${hh}:${mm}` });
    setTimeout(() => setToast(null), 3500);
    setBookingRoom(null);
    // Walk into the room
    setTarget({ x: bookingRoom.x + bookingRoom.w / 2, y: bookingRoom.y + bookingRoom.h / 2 });
  };

  const handleFocusMember = (m) => {
    if (m.isPlayer) return;
    // Walk towards member (but stop at a polite distance)
    const dx = m.x - you.x, dy = m.y - you.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 1) return;
    const stop = Math.max(d - 50, 0);
    setTarget({ x: you.x + (dx / d) * stop, y: you.y + (dy / d) * stop });
  };

  // Apply runtime bookings into a rendered rooms array, and inject the door spec
  // so the Floor can render door openings + collision boundaries.
  const renderedRooms = useMemo(() => {
    return ROOMS.map(r => {
      const door = isWalled(r) ? defaultDoor(r, layout.floor) : null;
      const base = { ...r, door };
      if (bookedRooms[r.id]) {
        return { ...base, activeBooking: { ...bookedRooms[r.id], host: 'YOU', attendees: ['YOU'] } };
      }
      return base;
    });
  }, [bookedRooms, layout]);

  // Members merged: player + npcs
  const allMembers = useMemo(() => [{
    ...initialPlayer, x: you.x, y: you.y, status,
    room: currentRoom?.id,
  }, ...npcs], [you.x, you.y, status, npcs, currentRoom]);

  const onlineCount = allMembers.length;

  return (
    <div className="vo-app" data-theme={theme}>
      <TopBar you={initialPlayer} status={status}
              onCycleStatus={cycleStatus}
              currentRoom={currentRoom}
              onlineCount={onlineCount}
              theme={theme}
              onThemeChange={setTheme}
              camOn={!!camStream}
              camError={camError}
              onToggleCam={toggleCam}
              layouts={window.LAYOUTS}
              layoutId={layoutId}
              onLayoutChange={setLayoutId} />

      <div className="vo-shell">
        <Sidebar members={allMembers}
                 audibleMap={audibleMap}
                 you={you}
                 onFocusMember={handleFocusMember}
                 rooms={renderedRooms} />

        <main className="vo-main">
          <div className="vo-floor-wrap">
            <Floor layout={layout}
                   rooms={renderedRooms}
                   desks={DESKS}
                   members={allMembers}
                   you={you}
                   currentRoom={currentRoom}
                   audibleMap={audibleMap}
                   talkingSet={talkingSet}
                   screens={SCREENS}
                   presentingScreenId={presentingScreen?.id}
                   camStream={camStream}
                   zoom={zoom}
                   lockedRooms={effectiveLocks}
                   onToggleLock={toggleLock}
                   onZoomIn={zoomIn}
                   onZoomOut={zoomOut}
                   onFloorClick={handleFloorClick}
                   onRoomClick={handleRoomClick}
                   onDeskClick={handleDeskClick}
                   onScreenClick={handleScreenClick}
                   onAvatarClick={handleAvatarClick} />

            <ZoomControls zoom={zoom} onIn={zoomIn} onOut={zoomOut} onReset={zoomReset} />

            <HearToast audibleList={audibleList} />
            <OnboardingHint show={showHint} onDismiss={() => setShowHint(false)} />
            {toast && <Toast kind={toast.kind}>{toast.text}</Toast>}
          </div>

          {currentRoom && currentRoom.type === 'meeting' && currentRoom.activeBooking && (
            <MeetingPanel room={currentRoom}
                          allMembers={allMembers}
                          onLeave={() => setTarget({ x: currentRoom.x + currentRoom.w / 2,
                                                      y: currentRoom.y + currentRoom.h + 60 })} />
          )}
        </main>
      </div>

      {bookingRoom && (
        <BookingModal room={bookingRoom}
                      onClose={() => setBookingRoom(null)}
                      onConfirm={handleConfirmBooking} />
      )}

      {presentingScreen && (
        <PresentationOverlay screen={presentingScreen}
                             source={presentationSource}
                             onChangeSource={setPresentationSource}
                             onStop={() => setPresentingScreen(null)}
                             camStream={camStream} />
      )}

      {focusedAvatar && (
        <AvatarFocusCard member={allMembers.find(m => m.id === focusedAvatar.id) || focusedAvatar}
                         isPlayer={focusedAvatar.isPlayer}
                         camStream={camStream}
                         rooms={renderedRooms}
                         audibleVolume={audibleMap[focusedAvatar.id] || 0}
                         onClose={() => setFocusedAvatar(null)}
                         onGoTo={handleFocusMember}
                         onSayHi={handleSayHi}
                         onGiveCoffee={handleGiveCoffee} />
      )}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
