/* UI chrome — TopBar, Sidebar, MeetingPanel, BookingModal, HearToast, Hint */

const UI_COLORS = window.AVATAR_COLORS;

function AvatarFocusCard({ member, isPlayer, camStream, rooms, audibleVolume, onClose, onGoTo, onSayHi, onGiveCoffee }) {
  if (!member) return null;
  const videoRef = React.useRef(null);
  React.useEffect(() => {
    if (videoRef.current && camStream && isPlayer) {
      videoRef.current.srcObject = camStream;
    }
  }, [camStream, isPlayer]);

  const bg = UI_COLORS[member.color] || UI_COLORS.terra;
  const where = member.room ? ((rooms || []).find(r => r.id === member.room)?.name || 'rum') :
                member.sittingAt ? 'ved skrivebord' :
                member.talking ? 'taler med kolleger' : 'på gulvet';

  const statusLabel = {
    available: 'Available',
    busy: 'Optaget',
    dnd: 'Forstyr ikke',
    meeting: 'I møde',
    offline: 'Offline',
  }[member.status] || member.status;
  const statusDot = {
    available: '#5B7A5B',
    busy: '#D5A04A',
    dnd: '#C25A3A',
    meeting: '#7A4A6A',
    offline: '#8B8578',
  }[member.status] || '#8B8578';

  return (
    <div className="vo-modal-bg" onClick={onClose}>
      <div className="vo-focus" onClick={e => e.stopPropagation()}>
        <button className="vo-focus__x" onClick={onClose} aria-label="Luk">×</button>

        <div className="vo-focus__viewport" style={{ background: bg }}>
          {isPlayer && camStream ? (
            <video ref={videoRef} className="vo-focus__cam" autoPlay muted playsInline></video>
          ) : (
            <div className="vo-focus__initials">{member.initials}</div>
          )}
          {audibleVolume > 0.05 && !isPlayer && (
            <div className="vo-focus__vol">
              <span></span><span></span><span></span>
              <em>{Math.round(audibleVolume * 100)}%</em>
            </div>
          )}
          <div className="vo-focus__statbadge">
            <span className="vo-focus__statdot" style={{ background: statusDot }}></span>
            {statusLabel}
          </div>
        </div>

        <div className="vo-focus__body">
          <div className="vo-focus__kicker">{isPlayer ? 'Det er dig' : 'Kollega'}</div>
          <div className="vo-focus__name">{member.name}</div>
          <div className="vo-focus__where">{where}{member.color ? ` · ${member.color}-team` : ''}</div>

          <div className="vo-focus__meta">
            <div className="vo-focus__meta-row">
              <span className="vo-focus__meta-lab">Status</span>
              <span>{statusLabel}</span>
            </div>
            <div className="vo-focus__meta-row">
              <span className="vo-focus__meta-lab">Hvor</span>
              <span>{where}</span>
            </div>
            {!isPlayer && (
              <div className="vo-focus__meta-row">
                <span className="vo-focus__meta-lab">Kan høre dig</span>
                <span>{audibleVolume > 0.05 ? `Ja · ${Math.round(audibleVolume * 100)}%` : 'Nej — gå tættere på'}</span>
              </div>
            )}
            {isPlayer && (
              <div className="vo-focus__meta-row">
                <span className="vo-focus__meta-lab">Kamera</span>
                <span>{camStream ? 'Tændt — kollegerne ser dig' : 'Slukket'}</span>
              </div>
            )}
          </div>

          {!isPlayer && (
            <div className="vo-focus__actions">
              <button className="vo-btn vo-btn--primary" onClick={() => { onGoTo && onGoTo(member); onClose(); }}>
                Gå hen til
              </button>
              <button className="vo-btn vo-btn--ghost" onClick={() => onSayHi && onSayHi(member)}>
                Sig hej 👋
              </button>
              <button className="vo-btn vo-btn--ghost" onClick={() => onGiveCoffee && onGiveCoffee(member)}>
                Giv kaffe ☕
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({ status, onClick }) {
  const meta = {
    available: { label: 'Available', color: '#5B7A5B' },
    busy:      { label: 'Optaget',   color: '#D5A04A' },
    dnd:       { label: 'Forstyr ikke', color: '#C25A3A' },
  }[status];
  return (
    <button className="vo-pill vo-pill--status" onClick={onClick}>
      <span className="vo-pill__dot" style={{ background: meta.color }}></span>
      {meta.label}
      <svg width="10" height="6" viewBox="0 0 10 6" style={{ marginLeft: 6, opacity: .6 }}>
        <path d="M1 1l4 4 4-4" stroke="currentColor" fill="none" strokeWidth="1.4" />
      </svg>
    </button>
  );
}

function CameraToggle({ on, onToggle, error }) {
  return (
    <button className={`vo-cam-btn ${on ? 'vo-cam-btn--on' : ''}`}
            onClick={onToggle}
            title={error || (on ? 'Sluk kamera' : 'Tænd kamera')}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <rect x="1" y="3.5" width="9" height="7" rx="1.5" fill="currentColor"/>
        <path d="M10 5.7l3.2-1.6v5.8L10 8.3z" fill="currentColor"/>
      </svg>
      <span>{on ? 'Kamera tændt' : 'Tænd kamera'}</span>
      {on && <span className="vo-cam-btn__live"></span>}
    </button>
  );
}

function PresentationOverlay({ screen, source, onChangeSource, onStop, camStream }) {
  if (!screen) return null;
  const videoRef = React.useRef(null);
  React.useEffect(() => {
    if (videoRef.current && camStream && source === 'cam') {
      videoRef.current.srcObject = camStream;
    }
  }, [source, camStream]);

  const sources = [
    { id: 'cam',    label: 'Webcam',         enabled: !!camStream },
    { id: 'slide',  label: 'Slides',         enabled: true },
    { id: 'screen', label: 'Skærm-deling',   enabled: true },
  ];

  return (
    <div className="vo-present">
      <div className="vo-present__chrome">
        <div className="vo-present__head">
          <div>
            <div className="vo-present__kicker">Du præsenterer til</div>
            <div className="vo-present__title">{screen.label}</div>
            <div className="vo-present__sub">{screen.content?.title || 'Ny præsentation'}</div>
          </div>
          <div className="vo-present__src">
            {sources.map(s => (
              <button key={s.id}
                      className={`vo-present__src-opt ${source === s.id ? 'vo-present__src-opt--active' : ''}`}
                      disabled={!s.enabled}
                      onClick={() => onChangeSource(s.id)}>
                {s.label}
                {!s.enabled && <em>· slukket</em>}
              </button>
            ))}
          </div>
          <button className="vo-btn vo-btn--ghost vo-btn--sm" onClick={onStop}>Afslut</button>
        </div>

        <div className="vo-present__stage">
          {source === 'cam' && camStream && (
            <video ref={videoRef} className="vo-present__cam" autoPlay muted playsInline></video>
          )}
          {source === 'cam' && !camStream && (
            <div className="vo-present__placeholder">
              <div className="vo-present__placeholder-icon">📷</div>
              <div>Webcam er slukket</div>
              <div className="vo-present__hint">Tænd kamera øverst, eller vælg Slides nedenfor</div>
            </div>
          )}
          {source === 'slide' && (
            <div className="vo-present__slide">
              <div className="vo-present__slide-kicker">{screen.content?.kicker || 'Slide'}</div>
              <div className="vo-present__slide-title">{screen.content?.title || 'Q2 Roadmap'}</div>
              <div className="vo-present__slide-sub">{screen.content?.sub || 'Sprint 23 · uge 21'}</div>
              <div className="vo-present__slide-bullets">
                <div>MVP er stabil i 2care4-pilot</div>
                <div>Outlook-sync ankommer i V2 (Q4)</div>
                <div>Mini-games launches i Q1 2027</div>
              </div>
              <div className="vo-present__slide-foot">VirtualOffice · 2care4</div>
            </div>
          )}
          {source === 'screen' && (
            <div className="vo-present__sharemock">
              <div className="vo-present__sharemock-bar">
                <span></span><span></span><span></span>
                <div className="vo-present__sharemock-url">2care4.virtualoffice.app/admin/dashboard</div>
              </div>
              <div className="vo-present__sharemock-body">
                <div className="vo-present__sharemock-card">12 aktive brugere</div>
                <div className="vo-present__sharemock-card">3 mødelokaler booket</div>
                <div className="vo-present__sharemock-card">5 trofæer givet i dag</div>
              </div>
            </div>
          )}
        </div>

        <div className="vo-present__foot">
          <span className="vo-tag vo-tag--accent"><span className="vo-tag__live-dot"></span>LIVE · synlig for alle nær {screen.label}</span>
          <span className="vo-tag">LiveKit room · presenter</span>
          <span className="vo-tag">Esc for at afslutte</span>
        </div>
      </div>
    </div>
  );
}
function ThemeSwitcher({ theme, onChange }) {
  const themes = [
    { id: 'hygge',  label: 'Hygge',  swatch: ['#F1ECDF', '#C25A3A'] },
    { id: 'nordic', label: 'Nordic', swatch: ['#E5E9EC', '#3D6B8F'] },
    { id: 'studio', label: 'Studio', swatch: ['#E8DECE', '#8E4A2A'] },
  ];
  return (
    <div className="vo-theme">
      <span className="vo-theme__lab">Tema</span>
      {themes.map(t => (
        <button key={t.id}
                className={`vo-theme__opt ${theme === t.id ? 'vo-theme__opt--active' : ''}`}
                onClick={() => onChange(t.id)}
                title={t.label}
                aria-label={t.label}>
          <span className="vo-theme__sw" style={{ background: t.swatch[0] }}></span>
          <span className="vo-theme__sw" style={{ background: t.swatch[1] }}></span>
        </button>
      ))}
    </div>
  );
}

function LayoutSwitcher({ layouts, layoutId, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const onClickOut = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClickOut);
    return () => document.removeEventListener('mousedown', onClickOut);
  }, []);
  const current = layouts[layoutId];
  const items = Object.values(layouts);
  return (
    <div className="vo-layout" ref={ref}>
      <button className="vo-pill vo-pill--layout" onClick={() => setOpen(o => !o)}>
        <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <rect x="1.5" y="2" width="11" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M5 2v10M9 2v10M1.5 7h11" stroke="currentColor" strokeWidth="1.2"/>
        </svg>
        <span><strong>Indretning</strong> · {current.name}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" style={{ marginLeft: 4, opacity: .5 }}>
          <path d="M1 1l4 4 4-4" stroke="currentColor" fill="none" strokeWidth="1.4" />
        </svg>
      </button>
      {open && (
        <div className="vo-layout__menu">
          {items.map(l => (
            <button key={l.id}
                    className={`vo-layout__item ${l.id === layoutId ? 'vo-layout__item--active' : ''}`}
                    onClick={() => { onChange(l.id); setOpen(false); }}>
              <div className="vo-layout__item-name">{l.name}</div>
              <div className="vo-layout__item-desc">{l.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TopBar({ you, status, onCycleStatus, currentRoom, onlineCount, theme, onThemeChange, camOn, camError, onToggleCam, layouts, layoutId, onLayoutChange }) {
  return (
    <div className="vo-topbar">
      <div className="vo-topbar__brand">
        <span className="vo-logo"></span>
        <span className="vo-topbar__title">VirtualOffice</span>
        <span className="vo-topbar__sep">·</span>
        <span className="vo-topbar__org">2care4</span>
        {layouts && <LayoutSwitcher layouts={layouts} layoutId={layoutId} onChange={onLayoutChange} />}
      </div>

      <div className="vo-topbar__loc">
        {currentRoom
          ? <><strong>{currentRoom.name}</strong> · {currentRoom.type === 'meeting' ? 'lyd-isoleret' : currentRoom.type === 'focus' ? 'fokuszone, auto-DND' : 'social zone'}</>
          : <>Åbent kontor · Stueetage</>
        }
      </div>

      <div className="vo-topbar__right">
        <ThemeSwitcher theme={theme} onChange={onThemeChange} />
        <CameraToggle on={camOn} error={camError} onToggle={onToggleCam} />
        <StatusPill status={status} onClick={onCycleStatus} />
      </div>
    </div>
  );
}

function MemberRow({ m, isPlayer, isAudible, onFocus, rooms }) {
  const bg = UI_COLORS[m.color] || UI_COLORS.terra;
  const where = m.room ? ((rooms || []).find(r => r.id === m.room)?.name || 'rum') :
                m.sittingAt ? 'ved skrivebord' :
                m.talking ? 'taler med kolleger' : 'på gulvet';
  return (
    <div className={`vo-member ${isPlayer ? 'vo-member--you' : ''} ${isAudible ? 'vo-member--audible' : ''}`}
         onClick={() => onFocus && onFocus(m)}>
      <div className="vo-member__avatar" style={{ background: bg }}>{m.initials}</div>
      <div className="vo-member__info">
        <div className="vo-member__name">{m.name}{isPlayer && <span className="vo-member__you">DIG</span>}</div>
        <div className="vo-member__where">{where}</div>
      </div>
      <span className={`vo-member__stat vo-member__stat--${m.status}`}></span>
    </div>
  );
}

function Sidebar({ members, audibleMap, you, onFocusMember, rooms }) {
  const inMeeting   = members.filter(m => m.status === 'meeting');
  const inFocus     = members.filter(m => m.status === 'dnd');
  const available   = members.filter(m => m.status === 'available' || m.status === 'busy');

  return (
    <aside className="vo-sidebar">
      <div className="vo-sidebar__head">
        <div className="vo-sidebar__kicker">Til stede</div>
        <div className="vo-sidebar__count">{members.length}</div>
      </div>

      {inMeeting.length > 0 && <>
        <div className="vo-sidebar__group">I møde</div>
        {inMeeting.map(m => (
          <MemberRow key={m.id} m={m} isPlayer={m.isPlayer}
                     isAudible={(audibleMap[m.id] || 0) > 0.05}
                     onFocus={onFocusMember}
                     rooms={rooms} />
        ))}
      </>}

      {available.length > 0 && <>
        <div className="vo-sidebar__group">Tilgængelige</div>
        {available.map(m => (
          <MemberRow key={m.id} m={m} isPlayer={m.isPlayer}
                     isAudible={(audibleMap[m.id] || 0) > 0.05}
                     onFocus={onFocusMember}
                     rooms={rooms} />
        ))}
      </>}

      {inFocus.length > 0 && <>
        <div className="vo-sidebar__group">Fokus / DND</div>
        {inFocus.map(m => (
          <MemberRow key={m.id} m={m} isPlayer={m.isPlayer}
                     isAudible={false}
                     onFocus={onFocusMember}
                     rooms={rooms} />
        ))}
      </>}

      <div className="vo-sidebar__foot">
        <div className="vo-keyhelp">
          <div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> eller piletaster</div>
          <div>Klik på gulvet for at gå derhen</div>
          <div>Klik på et rum for at gå ind</div>
          <div>Klik på en skærm for at præsentere</div>
        </div>
      </div>
    </aside>
  );
}

function MeetingPanel({ room, onLeave, allMembers }) {
  if (!room) return null;
  const members = allMembers || [];
  const participants = (room.activeBooking?.attendees || [])
    .map(id => members.find(m => m.id === id))
    .filter(Boolean);

  return (
    <div className="vo-meeting-panel">
      <div className="vo-meeting-panel__head">
        <div>
          <div className="vo-meeting-panel__kicker">Lyd-isoleret</div>
          <div className="vo-meeting-panel__title">{room.activeBooking?.title || room.name}</div>
          <div className="vo-meeting-panel__sub">{room.name} · indtil {room.activeBooking?.until || '—'}</div>
        </div>
        <button className="vo-btn vo-btn--ghost" onClick={onLeave}>Forlad rum</button>
      </div>
      <div className="vo-meeting-panel__participants">
        {participants.map(p => (
          <div key={p.id} className="vo-meeting-panel__p">
            <div className="vo-meeting-panel__pavatar" style={{ background: UI_COLORS[p.color] }}>{p.initials}</div>
            <div>
              <div className="vo-meeting-panel__pname">{p.name}</div>
              <div className="vo-meeting-panel__pwave">
                <span></span><span></span><span></span><span></span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="vo-meeting-panel__foot">
        <span className="vo-tag">LiveKit room · {room.id}</span>
        <span className="vo-tag vo-tag--accent">Synket til Outlook</span>
      </div>
    </div>
  );
}

function BookingModal({ room, onClose, onConfirm }) {
  if (!room) return null;
  const [title, setTitle] = React.useState('');
  const [duration, setDuration] = React.useState(30);

  return (
    <div className="vo-modal-bg" onClick={onClose}>
      <div className="vo-modal" onClick={e => e.stopPropagation()}>
        <div className="vo-modal__kicker">Book mødelokale</div>
        <div className="vo-modal__title">{room.name}</div>
        <div className="vo-modal__sub">{room.capacity} pladser · synkroniseres til Outlook</div>

        <label className="vo-field">
          <span>Titel</span>
          <input type="text" placeholder="Fx. Roadmap review"
                 value={title} onChange={e => setTitle(e.target.value)} autoFocus />
        </label>

        <div className="vo-field">
          <span>Varighed</span>
          <div className="vo-segment">
            {[15, 30, 45, 60].map(d => (
              <button key={d}
                      className={`vo-segment__opt ${duration === d ? 'vo-segment__opt--active' : ''}`}
                      onClick={() => setDuration(d)}>
                {d} min
              </button>
            ))}
          </div>
        </div>

        <div className="vo-modal__actions">
          <button className="vo-btn vo-btn--ghost" onClick={onClose}>Annuller</button>
          <button className="vo-btn vo-btn--primary"
                  disabled={!title.trim()}
                  onClick={() => onConfirm({ title: title.trim(), duration })}>
            Book · starter nu
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ children, kind }) {
  return <div className={`vo-toast vo-toast--${kind || 'info'}`}>{children}</div>;
}

function HearToast({ audibleList }) {
  if (audibleList.length === 0) return null;
  const top = audibleList.slice(0, 3);
  return (
    <div className="vo-hear">
      <div className="vo-hear__icon">
        <span></span><span></span><span></span>
      </div>
      <div>
        <div className="vo-hear__lab">Du hører</div>
        <div className="vo-hear__names">
          {top.map((m, i) => (
            <span key={m.id}>
              {i > 0 && ', '}
              {m.name.split(' ')[0]} <em>· {Math.round(m.volume * 100)}%</em>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function OnboardingHint({ show, onDismiss }) {
  if (!show) return null;
  return (
    <div className="vo-hint">
      <div className="vo-hint__kicker">Velkommen</div>
      <div className="vo-hint__title">Prøv at gå rundt</div>
      <p>Brug <kbd>WASD</kbd> eller piletasterne. Gå hen til kollegerne ved kaffemaskinen — så hører du dem snakke.</p>
      <button className="vo-btn vo-btn--ghost vo-btn--sm" onClick={onDismiss}>Forstået</button>
    </div>
  );
}

Object.assign(window, {
  TopBar, Sidebar, MeetingPanel, BookingModal, HearToast, OnboardingHint, Toast, ThemeSwitcher,
  CameraToggle, PresentationOverlay, LayoutSwitcher, AvatarFocusCard, ZoomControls,
});

function ZoomControls({ zoom, onIn, onOut, onReset }) {
  const pct = Math.round(zoom * 100);
  return (
    <div className="vo-zoom" role="group" aria-label="Zoom">
      <button className="vo-zoom__btn" onClick={onIn} aria-label="Zoom ind" title="Zoom ind (+)">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M7 2v10M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </button>
      <button className="vo-zoom__pct" onClick={onReset} title="Nulstil (0)">{pct}%</button>
      <button className="vo-zoom__btn" onClick={onOut} aria-label="Zoom ud" title="Zoom ud (−)">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2 7h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}
