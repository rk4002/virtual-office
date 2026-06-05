/* Floor + Room + Desk + Avatar components for the VirtualOffice prototype. */
/* Exports to window so other Babel scripts can use them. */

const COLORS  = window.AVATAR_COLORS;

// All world coordinates are in raw pixels; the .vo-floor element is sized
// (in pixels) to the active layout's floor.w / floor.h, so children just use
// `left: ${x}px; top: ${y}px;`. NO percentage scaling — the original code
// used a fixed 1600×900 reference that didn't match larger layouts.
const px = (v) => `${v}px`;

function Room({ room, isYouHere, dimmed, door, locked, onToggleLock }) {
  const cls = ['vo-room', `vo-room--${room.type}`];
  if (isYouHere) cls.push('vo-room--here');
  if (dimmed)    cls.push('vo-room--dimmed');
  if (locked)    cls.push('vo-room--locked');
  const lockable = room.type === 'meeting' || room.type === 'focus';
  return (
    <div className={cls.join(' ')} style={{
      left: px(room.x),
      top: px(room.y),
      width: px(room.w),
      height: px(room.h),
    }}>
      <div className="vo-room__head">
        <span className="vo-room__name">
          {locked && <span className="vo-room__lock-ico" aria-label="Låst" title="Døren er låst">🔒</span>}
          {room.name}
        </span>
        {room.activeBooking && (
          <span className="vo-room__badge vo-room__badge--live">Live · indtil {room.activeBooking.until}</span>
        )}
      </div>
      <div className="vo-room__foot">
        {room.type === 'meeting' && <span>{room.capacity} pl.</span>}
        {room.type === 'focus' && <span>Auto-DND</span>}
        {room.type === 'social' && <span>Åben zone</span>}
        {room.activeBooking ? <span>{room.activeBooking.title}</span> : <span>Ledig</span>}
      </div>
      {lockable && isYouHere && (
        <button className={`vo-room__lock-btn ${locked ? 'is-locked' : ''}`}
                onClick={(e) => { e.stopPropagation(); onToggleLock && onToggleLock(room.id); }}
                title={locked ? 'Lås døren op' : 'Lås døren'}>
          {locked ? '🔒 Låst' : '🔓 Lås døren'}
        </button>
      )}
      {door && (
        <div className={`vo-room__door ${locked ? 'is-locked' : ''}`}
             data-side={door.side}
             style={doorStyle(door, room)}
             aria-hidden="true">
          <div className="vo-room__door-arc"></div>
          {locked && <div className="vo-room__door-lock">🔒</div>}
        </div>
      )}
    </div>
  );
}

// Compute inline style for a door overlay positioned on one wall of the room.
// Exact wall-thickness rectangle so it visually replaces that section of wall.
function doorStyle(door, room) {
  const t = 6;  // wall thickness in world px (matches CSS border)
  const W = door.width + 'px';
  if (door.side === 'top')    return { top:    -t + 'px', left: door.pos + 'px', width: W,            height: t + 'px' };
  if (door.side === 'bottom') return { bottom: -t + 'px', left: door.pos + 'px', width: W,            height: t + 'px' };
  if (door.side === 'left')   return { left:   -t + 'px', top:  door.pos + 'px', height: W,           width:  t + 'px' };
  return                             { right:  -t + 'px', top:  door.pos + 'px', height: W,           width:  t + 'px' };
}

function Desk({ desk, isYourDesk }) {
  return (
    <div className={`vo-desk ${isYourDesk ? 'vo-desk--mine' : ''} ${!desk.owner ? 'vo-desk--vacant' : ''}`}
         style={{
           left: px(desk.x),
           top: px(desk.y),
         }}>
      <div className="vo-desk__monitor"><div className="vo-desk__screen"></div></div>
      <div className="vo-desk__surface">
        <div className="vo-desk__keyboard"></div>
        <div className="vo-desk__mouse"></div>
        {isYourDesk && <div className="vo-desk__lamp"></div>}
        {!isYourDesk && desk.owner && <div className="vo-desk__mug"></div>}
      </div>
      <div className="vo-desk__chair"></div>
      {isYourDesk && <div className="vo-desk__tag">Dit bord</div>}
    </div>
  );
}

function Fixture({ type, x, y, label, w, h }) {
  const style = { left: px(x), top: px(y) };
  if (w) style.width  = px(w);
  if (h) style.height = px(h);
  return (
    <div className={`vo-fixture vo-fixture--${type}`} style={style}>
      {label && <div className="vo-fixture__label">{label}</div>}
    </div>
  );
}

function Zone({ zone }) {
  return (
    <div className={`vo-zone vo-zone--${zone.tone}`}
         style={{
           left: px(zone.x),
           top: px(zone.y),
           width: px(zone.w),
           height: px(zone.h),
         }}>
      <div className="vo-zone__label">{zone.name}</div>
    </div>
  );
}

function Carpet({ x, y, w, h, tone }) {
  return (
    <div className={`vo-carpet vo-carpet--${tone}`}
         style={{
           left: px(x),
           top: px(y),
           width: px(w),
           height: px(h),
         }}></div>
  );
}

function AudioWaves({ active }) {
  return (
    <div className={`vo-waves ${active ? 'vo-waves--on' : ''}`} aria-hidden="true">
      <span></span><span></span><span></span>
    </div>
  );
}

function SpeechBubble() {
  return (
    <div className="vo-speech" aria-hidden="true">
      <span></span><span></span><span></span>
    </div>
  );
}

function Avatar({ member, isPlayer, audibleVolume, dimmed, isTalking, camStream, onClick }) {
  const bg = COLORS[member.color] || COLORS.terra;
  const statusDot = {
    available: '#5B7A5B',
    busy: '#D5A04A',
    dnd: '#C25A3A',
    meeting: '#7A4A6A',
    offline: '#8B8578',
  }[member.status] || '#8B8578';

  const videoRef = React.useRef(null);
  React.useEffect(() => {
    if (videoRef.current && camStream) {
      videoRef.current.srcObject = camStream;
    }
  }, [camStream]);

  const camOn = isPlayer && !!camStream;

  return (
    <div className={`vo-avatar ${isPlayer ? 'vo-avatar--you' : ''} ${dimmed ? 'vo-avatar--dim' : ''} ${isTalking ? 'vo-avatar--talking' : ''} ${camOn ? 'vo-avatar--cam' : ''}`}
         style={{
           left: px(member.x),
           top: px(member.y),
         }}
         onClick={(e) => { e.stopPropagation(); onClick && onClick(member); }}>
      {isPlayer && <div className="vo-avatar__pulse"></div>}
      <div className="vo-avatar__bubble" style={{ background: bg }}>
        {camOn ? (
          <video ref={videoRef} className="vo-avatar__video" autoPlay muted playsInline></video>
        ) : (
          <span>{member.initials}</span>
        )}
        <span className="vo-avatar__status" style={{ background: statusDot }}></span>
        {camOn && <span className="vo-avatar__cam-ind" aria-label="Kamera tændt"></span>}
      </div>
      {isTalking && <SpeechBubble />}
      <div className="vo-avatar__name">{member.name}</div>
      {audibleVolume > 0 && !isPlayer && (
        <div className="vo-avatar__vol">{Math.round(audibleVolume * 100)}%</div>
      )}
    </div>
  );
}

function Screen({ screen, isPresenting, onClick }) {
  return (
    <div className={`vo-screen ${isPresenting ? 'vo-screen--live' : ''} ${screen.big ? 'vo-screen--big' : ''}`}
         style={{
           left: px(screen.x),
           top: px(screen.y),
           width: px(screen.w),
           height: px(screen.h),
         }}
         onClick={e => { e.stopPropagation(); onClick(screen); }}>
      <div className="vo-screen__display">
        {screen.content?.title ? (
          <span className="vo-screen__title">{screen.content.title}</span>
        ) : (
          <span className="vo-screen__off"></span>
        )}
      </div>
      <div className="vo-screen__label">{screen.label}</div>
      {isPresenting && <div className="vo-screen__live"><span className="vo-screen__live-dot"></span>LIVE</div>}
    </div>
  );
}

function HearLine({ from, to }) {
  // Subtle dashed connector from player to audible NPC.
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  return (
    <div className="vo-hearline" style={{
      left: px(from.x),
      top: px(from.y),
      width: px(length),
      transform: `rotate(${angle}deg)`,
    }}></div>
  );
}

function Plant({ x, y }) {
  return <div className="vo-plant" style={{ left: px(x), top: px(y) }}></div>;
}

function FloorGrid() {
  return <div className="vo-floor__grid" aria-hidden="true"></div>;
}


// Memoize child components so the rAF game loop (which updates the player position
// every frame) doesn't re-render hundreds of static elements on every tick.
const RoomM    = React.memo(Room);
const DeskM    = React.memo(Desk);
const FixtureM = React.memo(Fixture);
const ZoneM    = React.memo(Zone);
const PlantM   = React.memo(Plant);
const ScreenM  = React.memo(Screen);
const AvatarM  = React.memo(Avatar);


function Floor({
  layout,                 // { floor:{w,h}, zones, plants, fixtures }
  rooms, desks, members, you, currentRoom,
  audibleMap,             // npcId -> volume 0..1
  talkingSet,             // Set of member ids currently "speaking"
  screens, presentingScreenId,
  camStream,
  zoom = 1,
  lockedRooms,            // { [roomId]: bool }
  onToggleLock,
  onZoomIn, onZoomOut,
  onFloorClick,
  onRoomClick,
  onDeskClick,
  onScreenClick,
  onAvatarClick,
}) {
  const viewportRef = React.useRef(null);
  const worldRef = React.useRef(null);

  const wW = layout?.floor?.w || window.FLOOR_W;
  const wH = layout?.floor?.h || window.FLOOR_H;

  // Camera: world is anchored at (left:50%, top:50%) of the viewport.
  // transform: scale(z) translate(-x,-y) — translate is in WORLD units (pre-scale),
  // so world point (you.x, you.y) lands exactly at the viewport center at any zoom.

  function handleClick(e) {
    if (!worldRef.current) return;
    if (e.target.closest('.vo-room') || e.target.closest('.vo-desk') ||
        e.target.closest('.vo-avatar') || e.target.closest('.vo-screen') ||
        e.target.closest('.vo-zoom')) return;
    const rect = worldRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width)  * wW;
    const y = ((e.clientY - rect.top)  / rect.height) * wH;
    onFloorClick({ x, y });
  }

  // Wheel-zoom — attach as non-passive native listener so preventDefault works.
  // Throttle so a fast trackpad scroll doesn't fly straight to max zoom.
  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    let last = 0;
    const onWheel = (e) => {
      e.preventDefault();
      const now = performance.now();
      if (now - last < 60) return;
      last = now;
      if (e.deltaY < 0) onZoomIn && onZoomIn();
      else if (e.deltaY > 0) onZoomOut && onZoomOut();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onZoomIn, onZoomOut]);

  function handleRoomClick(e, room) {
    e.stopPropagation();
    onRoomClick(room);
  }

  return (
    <div className="vo-floor-viewport" ref={viewportRef} onClick={handleClick}>
      <div className="vo-floor" ref={worldRef}
           style={{
             width: wW, height: wH,
             left: '50%', top: '50%',
             transformOrigin: '0 0',
             transform: `scale(${zoom}) translate(${-you.x}px, ${-you.y}px)`,
           }}>
      <FloorGrid />

      <div className="vo-floor__door" aria-hidden="true">
        <div className="vo-floor__door-label">INDGANG</div>
      </div>

      <div className="vo-floor__stamp vo-floor__stamp--l">2care4 · Stueetage</div>
      <div className="vo-floor__stamp vo-floor__stamp--r">{layout.name}</div>

      {(layout?.zones || []).map(z => (
        <ZoneM key={z.id} zone={z} />
      ))}

      {rooms.map(r => (
        <div key={r.id} onClick={e => handleRoomClick(e, r)} className="vo-room-wrap">
          <RoomM room={r}
                isYouHere={currentRoom?.id === r.id}
                dimmed={currentRoom && currentRoom.id !== r.id}
                door={r.door}
                locked={!!(lockedRooms && lockedRooms[r.id])}
                onToggleLock={onToggleLock} />
          {r.type === 'meeting' && (
            <div className="vo-whiteboard"
                 style={{
                   left: px(r.x + r.w - 56),
                   top:  px(r.y + 28),
                 }}></div>
          )}
        </div>
      ))}

      {(layout?.fixtures || []).map((f, i) => (
        <FixtureM key={`fx-${i}`} type={f.type} x={f.x} y={f.y} w={f.w} h={f.h} label={f.label} />
      ))}

      {(layout?.plants || []).map((p, i) => (
        <PlantM key={`pl-${i}`} x={p.x} y={p.y} />
      ))}

      {desks.map(d => (
        <div key={d.id} onClick={e => { e.stopPropagation(); onDeskClick(d); }}>
          <DeskM desk={d} isYourDesk={d.owner === 'YOU'} />
        </div>
      ))}

      {members.filter(m => !m.isPlayer && (audibleMap[m.id] || 0) > 0.05).map(m => (
        <HearLine key={`line-${m.id}`} from={you} to={m} />
      ))}

      {members.map(m => (
        <AvatarM key={m.id}
                member={m}
                isPlayer={m.isPlayer}
                audibleVolume={audibleMap[m.id] || 0}
                isTalking={talkingSet && talkingSet.has(m.id)}
                camStream={m.isPlayer ? camStream : null}
                onClick={onAvatarClick}
                dimmed={currentRoom && m.room !== currentRoom.id && !m.isPlayer && currentRoom.type !== 'social'} />
      ))}

      {(screens || []).map(s => (
        <ScreenM key={s.id} screen={s}
                isPresenting={presentingScreenId === s.id}
                onClick={onScreenClick} />
      ))}
      </div>
    </div>
  );
}

Object.assign(window, { Floor, Room, Desk, Avatar, AudioWaves, Screen, Zone, Fixture });
