/* VirtualOffice — 3 office layouts, switchable from the topbar.
   All three use a 1600×900 logical floor. Each layout owns its own rooms,
   desks, members, screens, fixtures, zones (department labels) and plants. */

const C = window.AVATAR_COLORS;

// -------------------------------- LAYOUT 1: KLASSISK --------------------------------
// Departmentalized office: Engineering + Design pods, a boardroom, private offices,
// phone booths, kitchen and a small lounge.
const KLASSISK = {
  id: 'klassisk',
  name: 'Klassisk',
  description: 'Afdelinger, mødelokaler, og et privat kontor-fløj',
  floor: { w: 2400, h: 1350 },
  spawn: { x: 380, y: 700 },

  zones: [
    { id: 'eng',     name: 'Engineering', tone: 'warm', x: 40,   y: 460, w: 580, h: 350 },
    { id: 'design',  name: 'Design',      tone: 'cool', x: 640,  y: 460, w: 320, h: 350 },
    { id: 'lounge',  name: 'Lounge',      tone: 'sage', x: 980,  y: 460, w: 420, h: 290 },
    { id: 'sales',   name: 'Salg',        tone: 'warm', x: 1440, y: 460, w: 460, h: 350 },
    { id: 'mkt',     name: 'Marketing',   tone: 'cool', x: 1920, y: 460, w: 460, h: 350 },
  ],

  rooms: [
    // West wing
    { id: 'meeting-a', name: 'Mødelokale A', type: 'meeting',
      x: 60, y: 70, w: 240, h: 200, capacity: 8,
      activeBooking: { title: 'Sprint planning', until: '11:30',
        host: 'MN', attendees: ['MN','JL','SP','EC','RK'] } },
    { id: 'meeting-b', name: 'Mødelokale B', type: 'meeting',
      x: 320, y: 70, w: 180, h: 160, capacity: 4 },
    { id: 'focus-1', name: 'Fokus 1', type: 'focus',
      x: 520, y: 70, w: 120, h: 130 },
    { id: 'focus-2', name: 'Fokus 2', type: 'focus',
      x: 660, y: 70, w: 120, h: 130 },
    { id: 'boardroom', name: 'Bestyrelses­lokale', type: 'meeting',
      x: 800, y: 70, w: 320, h: 200, capacity: 12 },
    { id: 'office-dir', name: 'Direktør', type: 'focus',
      x: 1140, y: 70, w: 140, h: 130 },
    { id: 'office-hr', name: 'HR', type: 'focus',
      x: 1300, y: 70, w: 140, h: 130 },
    // East wing (right side)
    { id: 'training', name: 'Træning', type: 'meeting',
      x: 1460, y: 70, w: 240, h: 200, capacity: 14 },
    { id: 'brainstorm', name: 'Brainstorm', type: 'meeting',
      x: 1720, y: 70, w: 200, h: 200, capacity: 6 },
    { id: 'auditorium', name: 'Auditorium', type: 'meeting',
      x: 1940, y: 70, w: 420, h: 230, capacity: 60,
      activeBooking: { title: 'All-hands · Q2 review', until: '13:00',
        host: 'JB', attendees: ['JB','AT'] } },
    // South: phone booths, kitchen, cafeteria
    { id: 'phone-1', name: 'Telefon 1', type: 'focus',
      x: 40, y: 1180, w: 90, h: 140 },
    { id: 'phone-2', name: 'Telefon 2', type: 'focus',
      x: 150, y: 1180, w: 90, h: 140 },
    { id: 'phone-3', name: 'Telefon 3', type: 'focus',
      x: 260, y: 1180, w: 90, h: 140 },
    { id: 'kitchen', name: 'Kaffe + køkken', type: 'social',
      x: 1000, y: 880, w: 420, h: 240 },
    { id: 'cafeteria', name: 'Kantine', type: 'social',
      x: 1500, y: 880, w: 800, h: 380 },
  ],

  desks: [
    // Engineering pod 1
    { id: 'd-e1', x: 110, y: 560, owner: 'AB', label: "Anna's bord" },
    { id: 'd-e2', x: 220, y: 560, owner: 'DK', label: "Daniel's bord" },
    { id: 'd-e3', x: 110, y: 700, owner: 'PO', label: "Peter's bord" },
    { id: 'd-e4', x: 220, y: 700, owner: 'NB', label: "Nadia's bord" },
    // Engineering pod 2
    { id: 'd-e5', x: 380, y: 560, owner: 'LV', label: "Liva's bord" },
    { id: 'd-e6', x: 490, y: 560, owner: null },
    { id: 'd-e7', x: 380, y: 700, owner: 'YOU', label: "Dit bord" },
    { id: 'd-e8', x: 490, y: 700, owner: 'FK', label: "Frederik's bord" },
    // Design pod
    { id: 'd-d1', x: 710, y: 560, owner: 'KM', label: "Kira's bord" },
    { id: 'd-d2', x: 820, y: 560, owner: 'NM', label: "Noah's bord" },
    { id: 'd-d3', x: 710, y: 700, owner: null },
    { id: 'd-d4', x: 820, y: 700, owner: 'EH', label: "Esther's bord" },
    // Sales pod
    { id: 'd-s1', x: 1490, y: 560, owner: 'MK', label: "Mads's bord" },
    { id: 'd-s2', x: 1600, y: 560, owner: 'AS' },
    { id: 'd-s3', x: 1490, y: 700, owner: 'CL' },
    { id: 'd-s4', x: 1600, y: 700, owner: null },
    { id: 'd-s5', x: 1720, y: 560, owner: 'SY' },
    { id: 'd-s6', x: 1830, y: 560, owner: null },
    // Marketing pod
    { id: 'd-m1', x: 1970, y: 560, owner: 'TH', label: "Tobias's bord" },
    { id: 'd-m2', x: 2080, y: 560, owner: 'VP' },
    { id: 'd-m3', x: 1970, y: 700, owner: null },
    { id: 'd-m4', x: 2080, y: 700, owner: 'GR' },
    { id: 'd-m5', x: 2210, y: 560, owner: null },
    { id: 'd-m6', x: 2210, y: 700, owner: null },
  ],

  members: [
    { id: 'YOU', name: 'Du', initials: 'DU', color: 'terra', status: 'available', x: 380, y: 700, isPlayer: true },
    // In Mødelokale A (sprint planning)
    { id: 'MN', name: 'Mette Nielsen',   initials: 'MN', color: 'sage',  status: 'meeting', x: 110, y: 140, room: 'meeting-a', talking: true },
    { id: 'JL', name: 'Julie Lange',     initials: 'JL', color: 'amber', status: 'meeting', x: 200, y: 140, room: 'meeting-a' },
    { id: 'SP', name: 'Simon Poulsen',   initials: 'SP', color: 'navy',  status: 'meeting', x: 270, y: 145, room: 'meeting-a' },
    { id: 'EC', name: 'Emma Carlsen',    initials: 'EC', color: 'plum',  status: 'meeting', x: 140, y: 220, room: 'meeting-a' },
    { id: 'RK', name: 'Rasmus K.',       initials: 'RK', color: 'terra', status: 'meeting', x: 240, y: 220, room: 'meeting-a' },
    // Engineering
    { id: 'AB', name: 'Anna Bjerre',     initials: 'AB', color: 'sage',  status: 'available', x: 110, y: 585, sittingAt: 'd-e1' },
    { id: 'DK', name: 'Daniel K.',       initials: 'DK', color: 'navy',  status: 'available', x: 220, y: 585, sittingAt: 'd-e2' },
    { id: 'PO', name: 'Peter Ø.',        initials: 'PO', color: 'amber', status: 'busy',      x: 110, y: 725, sittingAt: 'd-e3' },
    { id: 'NB', name: 'Nadia Berg',      initials: 'NB', color: 'plum',  status: 'available', x: 220, y: 725, sittingAt: 'd-e4' },
    { id: 'LV', name: 'Liva V.',         initials: 'LV', color: 'sage',  status: 'available', x: 380, y: 585, sittingAt: 'd-e5' },
    { id: 'FK', name: 'Frederik K.',     initials: 'FK', color: 'navy',  status: 'available', x: 490, y: 725, sittingAt: 'd-e8' },
    // Design
    { id: 'KM', name: 'Kira Madsen',     initials: 'KM', color: 'amber', status: 'available', x: 710, y: 585, sittingAt: 'd-d1' },
    { id: 'NM', name: 'Noah Møller',     initials: 'NM', color: 'plum',  status: 'available', x: 820, y: 585, sittingAt: 'd-d2' },
    { id: 'EH', name: 'Esther H.',       initials: 'EH', color: 'sage',  status: 'busy',      x: 820, y: 725, sittingAt: 'd-d4' },
    // Focus + private offices
    { id: 'TM', name: 'Thomas Mølgaard', initials: 'TM', color: 'plum',  status: 'dnd', x: 580, y: 130, room: 'focus-1' },
    { id: 'JB', name: 'Jacob Bramsen',   initials: 'JB', color: 'navy',  status: 'meeting', x: 2150, y: 180, room: 'auditorium', talking: true },
    { id: 'AT', name: 'Anne Thomsen',    initials: 'AT', color: 'amber', status: 'meeting', x: 2050, y: 230, room: 'auditorium' },
    { id: 'DH', name: 'Daniel Hansen',   initials: 'DH', color: 'sage',  status: 'busy', x: 1200, y: 130, room: 'office-dir' },
    { id: 'AN', name: 'Anne N.',         initials: 'AN', color: 'amber', status: 'available', x: 1360, y: 130, room: 'office-hr' },
    // Lounge chatting
    { id: 'CH', name: 'Christine H.',    initials: 'CH', color: 'sage',  status: 'available', x: 1080, y: 550, talking: true },
    { id: 'IO', name: 'Ida Ø.',          initials: 'IO', color: 'amber', status: 'available', x: 1170, y: 590, talking: true },
    { id: 'BR', name: 'Bjørn R.',        initials: 'BR', color: 'navy',  status: 'available', x: 1110, y: 630, talking: true },
    // Sales
    { id: 'MK', name: 'Mads Kjær',       initials: 'MK', color: 'navy',  status: 'available', x: 1490, y: 585, sittingAt: 'd-s1' },
    { id: 'AS', name: 'Asger Sand',      initials: 'AS', color: 'sage',  status: 'busy',      x: 1600, y: 585, sittingAt: 'd-s2' },
    { id: 'CL', name: 'Camilla Lund',    initials: 'CL', color: 'amber', status: 'available', x: 1490, y: 725, sittingAt: 'd-s3' },
    { id: 'SY', name: 'Sofie Yde',       initials: 'SY', color: 'plum',  status: 'available', x: 1720, y: 585, sittingAt: 'd-s5' },
    // Marketing
    { id: 'TH', name: 'Tobias Holm',     initials: 'TH', color: 'plum',  status: 'available', x: 1970, y: 585, sittingAt: 'd-m1' },
    { id: 'VP', name: 'Vibeke P.',       initials: 'VP', color: 'terra', status: 'available', x: 2080, y: 585, sittingAt: 'd-m2' },
    { id: 'GR', name: 'Gustav R.',       initials: 'GR', color: 'navy',  status: 'busy',      x: 2080, y: 725, sittingAt: 'd-m4' },
    // Cafeteria
    { id: 'LH', name: 'Lærke Hansen',    initials: 'LH', color: 'sage',  status: 'available', x: 1700, y: 1020, talking: true },
    { id: 'MA', name: 'Magnus A.',       initials: 'MA', color: 'navy',  status: 'available', x: 1780, y: 1050, talking: true },
    { id: 'JK', name: 'Josefine K.',     initials: 'JK', color: 'amber', status: 'available', x: 1830, y: 1010, talking: true },
    // Wanderer
    { id: 'OS', name: 'Olivia S.',       initials: 'OS', color: 'plum',  status: 'available', x: 1400, y: 1000, wandering: true,
      wanderCenter: { x: 1400, y: 1000 }, wanderRadius: { x: 120, y: 60 } },
  ],

  screens: [
    { id: 'screen-a', label: 'Skærm A',  x: 90,   y: 110, w: 80, h: 14,
      content: { kicker: 'Sprint 23', title: 'Velocity & burndown', sub: 'Uge 21 · maj 2026' } },
    { id: 'screen-b', label: 'Skærm B',  x: 360,  y: 105, w: 70, h: 12,
      content: null },
    { id: 'screen-board', label: 'Bestyrelses-skærm', big: true,
      x: 880, y: 105, w: 130, h: 22,
      content: { kicker: 'Q2', title: 'Bestyrelses-præsentation', sub: 'CFO · slide 3 af 18' } },
    { id: 'screen-train', label: 'Trænings-skærm', x: 1500, y: 105, w: 100, h: 16,
      content: { kicker: 'Onboarding', title: 'Sikkerhed & GDPR', sub: 'Modul 2 af 4' } },
    { id: 'screen-aud', label: 'Auditorium-skærm', big: true,
      x: 2010, y: 115, w: 200, h: 32,
      content: { kicker: 'All-hands · Live', title: 'Q2 highlights', sub: 'CEO · slide 4 af 22' } },
    { id: 'screen-main', label: 'Stor skærm', big: true,
      x: 1100, y: 920, w: 150, h: 26,
      content: { kicker: 'God morgen', title: 'Velkommen til 2care4', sub: 'Tirsdag · 20. maj' } },
    { id: 'screen-cafe', label: 'Kantine-skærm', big: true,
      x: 1900, y: 920, w: 200, h: 30,
      content: { kicker: 'Frokost', title: 'Tirsdag: kylling & grøntsager', sub: 'Vegetar · linsesalat' } },
  ],

  fixtures: [
    // ---- Meeting room interiors ----
    // Mødelokale A — long conference table with chairs around
    { type: 'conf-table', x: 110, y: 155, w: 140, h: 50 },
    { type: 'chair', x: 130, y: 145 }, { type: 'chair', x: 180, y: 145 }, { type: 'chair', x: 230, y: 145 },
    { type: 'chair', x: 130, y: 215 }, { type: 'chair', x: 180, y: 215 }, { type: 'chair', x: 230, y: 215 },
    { type: 'big-plant', x: 80, y: 250, w: 22, h: 22 },
    // Mødelokale B — small round huddle table
    { type: 'huddle-table', x: 410, y: 150, w: 60, h: 60 },
    { type: 'chair', x: 410, y: 110 }, { type: 'chair', x: 410, y: 190 },
    { type: 'chair', x: 370, y: 150 }, { type: 'chair', x: 450, y: 150 },
    // Fokus 1 — single desk + chair
    { type: 'flex-desk', x: 545, y: 160, w: 70, h: 28 },
    { type: 'chair', x: 580, y: 195 },
    // Fokus 2 — single desk + chair
    { type: 'flex-desk', x: 685, y: 160, w: 70, h: 28 },
    { type: 'chair', x: 720, y: 195 },
    // Bestyrelses-lokale — long conference table
    { type: 'conf-table', x: 845, y: 150, w: 220, h: 60 },
    { type: 'chair', x: 880, y: 140 }, { type: 'chair', x: 930, y: 140 },
    { type: 'chair', x: 980, y: 140 }, { type: 'chair', x: 1030, y: 140 },
    { type: 'chair', x: 880, y: 220 }, { type: 'chair', x: 930, y: 220 },
    { type: 'chair', x: 980, y: 220 }, { type: 'chair', x: 1030, y: 220 },
    { type: 'big-plant', x: 1100, y: 245, w: 22, h: 22 },
    // Direktør & HR offices — exec desks
    { type: 'flex-desk', x: 1170, y: 110, w: 80, h: 32 },
    { type: 'chair', x: 1210, y: 155 },
    { type: 'shelf', x: 1145, y: 175, w: 70, h: 16 },
    { type: 'flex-desk', x: 1330, y: 110, w: 80, h: 32 },
    { type: 'chair', x: 1370, y: 155 },
    { type: 'shelf', x: 1305, y: 175, w: 70, h: 16 },
    // Træning — long table with chairs in rows
    { type: 'conf-table', x: 1495, y: 160, w: 170, h: 40 },
    { type: 'chair', x: 1520, y: 150 }, { type: 'chair', x: 1580, y: 150 }, { type: 'chair', x: 1640, y: 150 },
    { type: 'chair', x: 1520, y: 210 }, { type: 'chair', x: 1580, y: 210 }, { type: 'chair', x: 1640, y: 210 },
    { type: 'whiteboard-stand', x: 1690, y: 105, w: 12, h: 38 },
    // Brainstorm — round table + standing whiteboards
    { type: 'huddle-table', x: 1820, y: 175, w: 70, h: 70 },
    { type: 'chair', x: 1820, y: 130 }, { type: 'chair', x: 1820, y: 220 },
    { type: 'chair', x: 1770, y: 175 }, { type: 'chair', x: 1870, y: 175 },
    { type: 'whiteboard-stand', x: 1900, y: 105, w: 12, h: 50 },
    // Auditorium — small stage + rows of seats
    { type: 'stage', x: 2150, y: 105, w: 220, h: 22 },
    // Rows of chairs (3 rows × 7 chairs)
    { type: 'chair', x: 2010, y: 155 }, { type: 'chair', x: 2055, y: 155 },
    { type: 'chair', x: 2100, y: 155 }, { type: 'chair', x: 2155, y: 155 },
    { type: 'chair', x: 2200, y: 155 }, { type: 'chair', x: 2245, y: 155 }, { type: 'chair', x: 2290, y: 155 },
    { type: 'chair', x: 2010, y: 195 }, { type: 'chair', x: 2055, y: 195 },
    { type: 'chair', x: 2100, y: 195 }, { type: 'chair', x: 2155, y: 195 },
    { type: 'chair', x: 2200, y: 195 }, { type: 'chair', x: 2245, y: 195 }, { type: 'chair', x: 2290, y: 195 },
    { type: 'chair', x: 2010, y: 235 }, { type: 'chair', x: 2055, y: 235 },
    { type: 'chair', x: 2100, y: 235 }, { type: 'chair', x: 2155, y: 235 },
    { type: 'chair', x: 2200, y: 235 }, { type: 'chair', x: 2245, y: 235 }, { type: 'chair', x: 2290, y: 235 },
    // ---- Reception (just inside main entrance, north of door) ----
    { type: 'reception', x: 1140, y: 1240, w: 200, h: 40 },
    { type: 'chair', x: 1240, y: 1295 },
    { type: 'big-plant', x: 1100, y: 1240, w: 24, h: 24 },
    { type: 'big-plant', x: 1360, y: 1240, w: 24, h: 24 },
    // ---- Lounge (mid-floor, social) ----
    { type: 'rug',    x: 1090, y: 510, w: 250, h: 130 },
    { type: 'sofa',   x: 1090, y: 540, w: 110, h: 32 },
    { type: 'sofa',   x: 1220, y: 540, w: 110, h: 32 },
    { type: 'table',  x: 1155, y: 600, w: 90, h: 38 },
    { type: 'big-plant', x: 1340, y: 490, w: 24, h: 24 },
    // ---- Kitchen ----
    { type: 'coffee',  x: 1040, y: 960 },
    { type: 'cooler',  x: 1090, y: 960 },
    { type: 'counter', x: 1240, y: 960 },
    { type: 'shelf',   x: 1020, y: 905, w: 100, h: 12 },
    // ---- Cafeteria ----
    { type: 'counter', x: 1600, y: 960, w: 200, h: 32 },
    { type: 'coffee',  x: 1950, y: 960 },
    { type: 'cooler',  x: 2000, y: 960 },
    { type: 'table',   x: 1700, y: 1080, w: 180, h: 50 },
    { type: 'chair', x: 1700, y: 1055 }, { type: 'chair', x: 1790, y: 1055 }, { type: 'chair', x: 1880, y: 1055 },
    { type: 'chair', x: 1700, y: 1155 }, { type: 'chair', x: 1790, y: 1155 }, { type: 'chair', x: 1880, y: 1155 },
    { type: 'table',   x: 1980, y: 1080, w: 180, h: 50 },
    { type: 'chair', x: 1980, y: 1055 }, { type: 'chair', x: 2070, y: 1055 }, { type: 'chair', x: 2160, y: 1055 },
    { type: 'chair', x: 1980, y: 1155 }, { type: 'chair', x: 2070, y: 1155 }, { type: 'chair', x: 2160, y: 1155 },
    { type: 'big-plant', x: 1530, y: 920, w: 24, h: 24 },
    { type: 'big-plant', x: 2300, y: 920, w: 24, h: 24 },
    // ---- Engineering pod dividers + plant accents ----
    { type: 'divider', x: 320, y: 580, w: 6, h: 120 },
    { type: 'big-plant', x: 320, y: 750, w: 22, h: 22 },
    { type: 'big-plant', x: 620, y: 750, w: 22, h: 22 },
    // ---- Design pod ----
    { type: 'divider', x: 920, y: 580, w: 6, h: 120 },
    { type: 'big-plant', x: 920, y: 750, w: 22, h: 22 },
    // ---- Sales / Marketing pods ----
    { type: 'big-plant', x: 1450, y: 750, w: 22, h: 22 },
    { type: 'big-plant', x: 1900, y: 750, w: 22, h: 22 },
    { type: 'big-plant', x: 2370, y: 750, w: 22, h: 22 },
    { type: 'divider', x: 1900, y: 580, w: 6, h: 120 },
    // ---- Bookshelves along outer walls (north section) ----
    { type: 'shelf', x: 30, y: 320, w: 18, h: 120 },
    { type: 'shelf', x: 30, y: 460, w: 18, h: 120 },
    { type: 'shelf', x: 2370, y: 320, w: 18, h: 120 },
  ],

  plants: [
    { x: 30,   y: 850 },
    { x: 620,  y: 850 },
    { x: 970,  y: 750 },
    { x: 1450, y: 850 },
    { x: 30,   y: 1100 },
    { x: 980,  y: 1300 },
    { x: 1450, y: 750 },
    { x: 1900, y: 850 },
    { x: 2380, y: 850 },
    { x: 1450, y: 1300 },
    { x: 2380, y: 1300 },
    { x: 1010, y: 460 },
    { x: 1380, y: 460 },
    { x: 1940, y: 320 },
  ],
};

// -------------------------------- LAYOUT 2: OPEN STUDIO --------------------------------
// Single big open floor: huge central lounge, long bench desks along walls,
// many phone booths, almost no closed rooms.
const STUDIO = {
  id: 'studio',
  name: 'Open studio',
  description: 'Stort fælleslounge, lange bench-borde, flere telefon-booths, færre vægge',
  floor: { w: 2400, h: 1350 },
  spawn: { x: 800, y: 700 },

  zones: [
    { id: 'bench-l', name: 'Bench L',    tone: 'warm', x: 40,   y: 80,   w: 280, h: 1190 },
    { id: 'bench-r', name: 'Bench R',    tone: 'warm', x: 2080, y: 80,   w: 280, h: 1190 },
    { id: 'lounge',  name: 'Stort fælleslounge', tone: 'sage', x: 360, y: 460, w: 1700, h: 460 },
    { id: 'standup', name: 'Standup-zone', tone: 'cool', x: 600, y: 80,  w: 800, h: 320 },
    { id: 'makerspace', name: 'Maker space', tone: 'plum', x: 1440, y: 100, w: 580, h: 300 },
  ],

  rooms: [
    { id: 'meeting-a', name: 'Mødelokale', type: 'meeting',
      x: 360, y: 80, w: 220, h: 320, capacity: 8,
      activeBooking: { title: 'Roadmap-review', until: '12:00',
        host: 'SP', attendees: ['SP','MN','RK'] } },
    { id: 'podcast', name: 'Podcast-booth', type: 'focus',
      x: 2040, y: 80, w: 200, h: 200 },
    { id: 'workshop', name: 'Workshop', type: 'meeting',
      x: 1440, y: 420, w: 580, h: 80, capacity: 12 },
    { id: 'phone-1',  name: 'Telefon 1', type: 'focus', x: 380,  y: 1150, w: 90, h: 160 },
    { id: 'phone-2',  name: 'Telefon 2', type: 'focus', x: 480,  y: 1150, w: 90, h: 160 },
    { id: 'phone-3',  name: 'Telefon 3', type: 'focus', x: 580,  y: 1150, w: 90, h: 160 },
    { id: 'phone-4',  name: 'Telefon 4', type: 'focus', x: 680,  y: 1150, w: 90, h: 160 },
    { id: 'phone-5',  name: 'Telefon 5', type: 'focus', x: 780,  y: 1150, w: 90, h: 160 },
    { id: 'phone-6',  name: 'Telefon 6', type: 'focus', x: 880,  y: 1150, w: 90, h: 160 },
    { id: 'kitchen',  name: 'Kaffebar',  type: 'social', x: 1000, y: 1100, w: 1040, h: 230 },
  ],

  desks: [
    // Bench L (long bench down left wall)
    { id: 'd-l1', x: 105, y: 130, owner: 'AB', label: "Anna's plads" },
    { id: 'd-l2', x: 105, y: 220, owner: 'DK' },
    { id: 'd-l3', x: 105, y: 310, owner: 'PO' },
    { id: 'd-l4', x: 105, y: 400, owner: 'NB' },
    { id: 'd-l5', x: 105, y: 490, owner: 'YOU', label: "Dit bord" },
    { id: 'd-l6', x: 105, y: 580, owner: 'LV' },
    { id: 'd-l7', x: 105, y: 670, owner: null },
    { id: 'd-l8', x: 105, y: 760, owner: 'FK' },
    { id: 'd-l9', x: 105, y: 850, owner: 'KM' },
    { id: 'd-l10', x: 220, y: 130, owner: 'NM' },
    { id: 'd-l11', x: 220, y: 220, owner: 'EH' },
    { id: 'd-l12', x: 220, y: 310, owner: null },
    { id: 'd-l13', x: 220, y: 400, owner: null },
    // Bench R (long bench down right wall)
    { id: 'd-r1', x: 2150, y: 320, owner: 'MK' },
    { id: 'd-r2', x: 2150, y: 410, owner: 'AS' },
    { id: 'd-r3', x: 2150, y: 500, owner: 'CL' },
    { id: 'd-r4', x: 2150, y: 590, owner: null },
    { id: 'd-r5', x: 2150, y: 680, owner: 'TH' },
    { id: 'd-r6', x: 2150, y: 770, owner: null },
    { id: 'd-r7', x: 2260, y: 320, owner: null },
    { id: 'd-r8', x: 2260, y: 410, owner: 'VP' },
  ],

  members: [
    { id: 'YOU', name: 'Du', initials: 'DU', color: 'terra', status: 'available', x: 800, y: 700, isPlayer: true },
    // Meeting room
    { id: 'MN', name: 'Mette Nielsen',   initials: 'MN', color: 'sage',  status: 'meeting', x: 410, y: 170, room: 'meeting-a', talking: true },
    { id: 'SP', name: 'Simon Poulsen',   initials: 'SP', color: 'navy',  status: 'meeting', x: 510, y: 170, room: 'meeting-a' },
    { id: 'RK', name: 'Rasmus K.',       initials: 'RK', color: 'terra', status: 'meeting', x: 460, y: 270, room: 'meeting-a' },
    { id: 'JL', name: 'Julie Lange',     initials: 'JL', color: 'amber', status: 'meeting', x: 450, y: 350, room: 'meeting-a' },
    // Podcast booth
    { id: 'TM', name: 'Thomas Mølgaard', initials: 'TM', color: 'plum',  status: 'dnd', x: 2140, y: 180, room: 'podcast' },
    // Bench L
    { id: 'AB', name: 'Anna Bjerre',     initials: 'AB', color: 'sage',  status: 'available', x: 105, y: 155, sittingAt: 'd-l1' },
    { id: 'DK', name: 'Daniel K.',       initials: 'DK', color: 'navy',  status: 'available', x: 105, y: 245, sittingAt: 'd-l2' },
    { id: 'PO', name: 'Peter Ø.',        initials: 'PO', color: 'amber', status: 'busy',      x: 105, y: 335, sittingAt: 'd-l3' },
    { id: 'NB', name: 'Nadia Berg',      initials: 'NB', color: 'plum',  status: 'available', x: 105, y: 425, sittingAt: 'd-l4' },
    { id: 'LV', name: 'Liva V.',         initials: 'LV', color: 'sage',  status: 'available', x: 105, y: 605, sittingAt: 'd-l6' },
    { id: 'FK', name: 'Frederik K.',     initials: 'FK', color: 'navy',  status: 'available', x: 105, y: 785, sittingAt: 'd-l8' },
    { id: 'KM', name: 'Kira Madsen',     initials: 'KM', color: 'amber', status: 'available', x: 105, y: 875, sittingAt: 'd-l9' },
    { id: 'NM', name: 'Noah Møller',     initials: 'NM', color: 'plum',  status: 'available', x: 220, y: 155, sittingAt: 'd-l10' },
    { id: 'EH', name: 'Esther H.',       initials: 'EH', color: 'sage',  status: 'busy',      x: 220, y: 245, sittingAt: 'd-l11' },
    // Bench R
    { id: 'MK', name: 'Mads Kjær',       initials: 'MK', color: 'navy',  status: 'available', x: 2150, y: 345, sittingAt: 'd-r1' },
    { id: 'AS', name: 'Asger Sand',      initials: 'AS', color: 'sage',  status: 'busy',      x: 2150, y: 435, sittingAt: 'd-r2' },
    { id: 'CL', name: 'Camilla Lund',    initials: 'CL', color: 'amber', status: 'available', x: 2150, y: 525, sittingAt: 'd-r3' },
    { id: 'TH', name: 'Tobias Holm',     initials: 'TH', color: 'plum',  status: 'available', x: 2150, y: 705, sittingAt: 'd-r5' },
    { id: 'VP', name: 'Vibeke P.',       initials: 'VP', color: 'terra', status: 'available', x: 2260, y: 435, sittingAt: 'd-r8' },
    // Lounge — chatting clusters
    { id: 'CH', name: 'Christine H.',    initials: 'CH', color: 'sage',  status: 'available', x: 700, y: 660, talking: true },
    { id: 'IO', name: 'Ida Ø.',          initials: 'IO', color: 'amber', status: 'available', x: 760, y: 680, talking: true },
    { id: 'BR', name: 'Bjørn R.',        initials: 'BR', color: 'navy',  status: 'available', x: 730, y: 740, talking: true },
    { id: 'LH', name: 'Lærke Hansen',    initials: 'LH', color: 'plum',  status: 'available', x: 1300, y: 760, talking: true },
    { id: 'MA', name: 'Magnus A.',       initials: 'MA', color: 'sage',  status: 'available', x: 1380, y: 800, talking: true },
    // Stand-up zone
    { id: 'JB', name: 'Jacob Bramsen',   initials: 'JB', color: 'plum',  status: 'available', x: 750, y: 240 },
    { id: 'AT', name: 'Anne Thomsen',    initials: 'AT', color: 'sage',  status: 'available', x: 870, y: 240 },
    { id: 'JK', name: 'Josefine K.',     initials: 'JK', color: 'amber', status: 'available', x: 990, y: 240 },
    // Wanderer
    { id: 'OS', name: 'Olivia S.',       initials: 'OS', color: 'amber', status: 'available', x: 1700, y: 900, wandering: true,
      wanderCenter: { x: 1700, y: 900 }, wanderRadius: { x: 140, y: 80 } },
  ],

  screens: [
    { id: 'screen-a', label: 'Skærm', x: 430, y: 130, w: 80, h: 14,
      content: { kicker: 'Q2 OKRs', title: 'Roadmap-review', sub: 'Sprint 23' } },
    { id: 'screen-main', label: 'Stor skærm', big: true,
      x: 740, y: 500, w: 220, h: 36,
      content: { kicker: 'Standup', title: 'Daglig kl. 09:30', sub: 'Alle teams · 15 min' } },
    { id: 'screen-maker', label: 'Maker-skærm',
      x: 1500, y: 120, w: 200, h: 28,
      content: { kicker: 'Prototype', title: 'Skitser uge 21', sub: 'Live · 3 deltagere' } },
    { id: 'screen-bar', label: 'Bar-skærm', big: true,
      x: 1300, y: 1140, w: 220, h: 36,
      content: { kicker: 'Kaffebar', title: 'Liva\'s playlist', sub: 'Lo-fi · 2 timer tilbage' } },
  ],

  fixtures: [
    { type: 'sofa',   x: 500, y: 600, w: 130, h: 36 },
    { type: 'sofa',   x: 800, y: 600, w: 130, h: 36 },
    { type: 'sofa',   x: 500, y: 780, w: 130, h: 36 },
    { type: 'sofa',   x: 800, y: 780, w: 130, h: 36 },
    { type: 'table',  x: 650, y: 690, w: 110, h: 40 },
    { type: 'sofa',   x: 1200, y: 600, w: 130, h: 36 },
    { type: 'sofa',   x: 1500, y: 600, w: 130, h: 36 },
    { type: 'sofa',   x: 1200, y: 780, w: 130, h: 36 },
    { type: 'sofa',   x: 1500, y: 780, w: 130, h: 36 },
    { type: 'table',  x: 1350, y: 690, w: 140, h: 40 },
    { type: 'sofa',   x: 1800, y: 690, w: 130, h: 36 },
    { type: 'coffee', x: 1100, y: 1170 },
    { type: 'cooler', x: 1150, y: 1170 },
    { type: 'counter', x: 1300, y: 1170, w: 200, h: 32 },
    { type: 'standup-table', x: 870, y: 240, w: 280, h: 26 },
    { type: 'standup-table', x: 1700, y: 220, w: 280, h: 26 },
  ],

  plants: [
    { x: 360,  y: 1000 },
    { x: 2060, y: 1000 },
    { x: 30,   y: 1300 },
    { x: 2380, y: 1300 },
    { x: 30,   y: 60 },
    { x: 2380, y: 60 },
    { x: 550,  y: 60 },
    { x: 1050, y: 60 },
    { x: 1450, y: 60 },
    { x: 360,  y: 460 },
    { x: 2060, y: 460 },
    { x: 1430, y: 480 },
    { x: 2010, y: 480 },
  ],
};

// -------------------------------- LAYOUT 3: ENTERPRISE --------------------------------
// Corridor with multiple meeting rooms, separate department pods, executive suite,
// formal cafeteria.
const ENTERPRISE = {
  id: 'enterprise',
  name: 'Enterprise',
  description: 'Korridor med private kontorer, separate afdelinger, conference-fløj',
  floor: { w: 2400, h: 1350 },
  spawn: { x: 320, y: 540 },

  zones: [
    { id: 'eng',     name: 'Engineering', tone: 'warm', x: 40,   y: 380, w: 360, h: 320 },
    { id: 'sales',   name: 'Salg',        tone: 'cool', x: 420,  y: 380, w: 280, h: 320 },
    { id: 'fin',     name: 'Finans',      tone: 'sage', x: 720,  y: 380, w: 280, h: 320 },
    { id: 'compl',   name: 'Compliance',  tone: 'plum', x: 1020, y: 380, w: 300, h: 320 },
    { id: 'mkt',     name: 'Marketing',   tone: 'cool', x: 1340, y: 380, w: 320, h: 320 },
    { id: 'exec',    name: 'Ledelse',     tone: 'plum', x: 1680, y: 380, w: 700, h: 320 },
  ],

  rooms: [
    // Top conference wing (extended)
    { id: 'meeting-a',  name: 'Conference A', type: 'meeting',
      x: 60, y: 60, w: 220, h: 200, capacity: 10,
      activeBooking: { title: 'Q2 board prep', until: '11:30',
        host: 'JB', attendees: ['JB','AT','SP'] } },
    { id: 'meeting-b',  name: 'Conference B', type: 'meeting',
      x: 300, y: 60, w: 220, h: 200, capacity: 8 },
    { id: 'meeting-c',  name: 'Huddle 1', type: 'meeting',
      x: 540, y: 60, w: 140, h: 150, capacity: 4 },
    { id: 'meeting-d',  name: 'Huddle 2', type: 'meeting',
      x: 700, y: 60, w: 140, h: 150, capacity: 4 },
    { id: 'focus-1',    name: 'Fokus 1', type: 'focus',
      x: 860, y: 60, w: 130, h: 150 },
    { id: 'boardroom',  name: 'Boardroom', type: 'meeting',
      x: 1010, y: 60, w: 320, h: 240, capacity: 18,
      activeBooking: { title: 'Strategi 2027', until: '14:00',
        host: 'CE', attendees: ['CE','JB'] } },
    { id: 'training',   name: 'Training', type: 'meeting',
      x: 1350, y: 60, w: 260, h: 200, capacity: 12 },
    { id: 'meeting-e',  name: 'Conference C', type: 'meeting',
      x: 1630, y: 60, w: 220, h: 200, capacity: 8 },
    { id: 'office-ceo', name: 'CEO', type: 'focus',
      x: 1870, y: 60, w: 210, h: 140 },
    { id: 'office-cfo', name: 'CFO', type: 'focus', x: 2100, y: 60, w: 130, h: 90 },
    { id: 'office-cto', name: 'CTO', type: 'focus', x: 2240, y: 60, w: 130, h: 90 },
    { id: 'office-coo', name: 'COO', type: 'focus', x: 2100, y: 160, w: 130, h: 90 },
    { id: 'office-cmo', name: 'CMO', type: 'focus', x: 2240, y: 160, w: 130, h: 90 },
    // Cafeteria at bottom-right
    { id: 'cafe', name: 'Kantine', type: 'social',
      x: 1020, y: 740, w: 1340, h: 320 },
    // Phone booths bottom-left
    { id: 'phone-1', name: 'Telefon 1', type: 'focus', x: 60,  y: 760, w: 100, h: 140 },
    { id: 'phone-2', name: 'Telefon 2', type: 'focus', x: 180, y: 760, w: 100, h: 140 },
    { id: 'phone-3', name: 'Telefon 3', type: 'focus', x: 300, y: 760, w: 100, h: 140 },
    { id: 'phone-4', name: 'Telefon 4', type: 'focus', x: 420, y: 760, w: 100, h: 140 },
    { id: 'library', name: 'Bibliotek', type: 'focus', x: 60, y: 920, w: 460, h: 400 },
  ],

  desks: [
    // Engineering pod
    { id: 'd-eng-1', x: 100, y: 460, owner: 'AB' },
    { id: 'd-eng-2', x: 210, y: 460, owner: 'DK' },
    { id: 'd-eng-3', x: 100, y: 600, owner: 'YOU', label: "Dit bord" },
    { id: 'd-eng-4', x: 210, y: 600, owner: 'PO' },
    { id: 'd-eng-5', x: 330, y: 460, owner: 'NB' },
    { id: 'd-eng-6', x: 330, y: 600, owner: 'LV' },
    // Sales pod
    { id: 'd-sales-1', x: 470, y: 460, owner: 'KM' },
    { id: 'd-sales-2', x: 580, y: 460, owner: 'NM' },
    { id: 'd-sales-3', x: 470, y: 600, owner: 'EH' },
    { id: 'd-sales-4', x: 580, y: 600, owner: 'FK' },
    // Finance pod
    { id: 'd-fin-1', x: 770, y: 460, owner: 'CH' },
    { id: 'd-fin-2', x: 880, y: 460, owner: 'IO' },
    { id: 'd-fin-3', x: 770, y: 600, owner: 'BR' },
    { id: 'd-fin-4', x: 880, y: 600, owner: null },
    // Compliance pod
    { id: 'd-cmp-1', x: 1060, y: 460, owner: 'JK' },
    { id: 'd-cmp-2', x: 1180, y: 460, owner: 'LH' },
    { id: 'd-cmp-3', x: 1060, y: 600, owner: 'MA' },
    { id: 'd-cmp-4', x: 1180, y: 600, owner: null },
    // Marketing pod
    { id: 'd-mkt-1', x: 1390, y: 460, owner: 'TH' },
    { id: 'd-mkt-2', x: 1500, y: 460, owner: 'VP' },
    { id: 'd-mkt-3', x: 1390, y: 600, owner: 'GR' },
    { id: 'd-mkt-4', x: 1500, y: 600, owner: 'SY' },
    // Exec assistants
    { id: 'd-ex-1',  x: 1740, y: 480, owner: 'JS', label: "Direktion-asst." },
    { id: 'd-ex-2',  x: 1740, y: 600, owner: 'RD' },
    { id: 'd-ex-3',  x: 1880, y: 480, owner: null },
    { id: 'd-ex-4',  x: 1880, y: 600, owner: null },
  ],

  members: [
    { id: 'YOU', name: 'Du', initials: 'DU', color: 'terra', status: 'available', x: 320, y: 540, isPlayer: true },
    // Conference A — board prep
    { id: 'JB', name: 'Jacob Bramsen',   initials: 'JB', color: 'navy',  status: 'meeting', x: 110, y: 140, room: 'meeting-a', talking: true },
    { id: 'AT', name: 'Anne Thomsen',    initials: 'AT', color: 'amber', status: 'meeting', x: 200, y: 140, room: 'meeting-a' },
    { id: 'SP', name: 'Simon Poulsen',   initials: 'SP', color: 'plum',  status: 'meeting', x: 160, y: 220, room: 'meeting-a' },
    // Boardroom — Strategi 2027
    { id: 'CE', name: 'Cecilie Egeskov', initials: 'CE', color: 'navy',  status: 'meeting', x: 1100, y: 130, room: 'boardroom', talking: true },
    { id: 'MN', name: 'Mette Nielsen',   initials: 'MN', color: 'sage',  status: 'meeting', x: 1200, y: 140, room: 'boardroom' },
    { id: 'RK', name: 'Rasmus K.',       initials: 'RK', color: 'terra', status: 'meeting', x: 1150, y: 220, room: 'boardroom' },
    // Focus
    { id: 'TM', name: 'Thomas Mølgaard', initials: 'TM', color: 'plum',  status: 'dnd', x: 920, y: 130, room: 'focus-1' },
    // C-suite in offices
    { id: 'DH', name: 'Daniel Hansen',   initials: 'DH', color: 'navy',  status: 'busy', x: 2160, y: 100, room: 'office-cfo' },
    { id: 'AN', name: 'Anne N.',         initials: 'AN', color: 'sage',  status: 'busy', x: 2300, y: 100, room: 'office-cto' },
    { id: 'MR', name: 'Mette Rytter',    initials: 'MR', color: 'amber', status: 'available', x: 2160, y: 200, room: 'office-coo' },
    { id: 'JU', name: 'Jens Urban',      initials: 'JU', color: 'plum',  status: 'busy', x: 2300, y: 200, room: 'office-cmo' },
    // Engineering
    { id: 'AB', name: 'Anna Bjerre',     initials: 'AB', color: 'sage',  status: 'available', x: 100, y: 485, sittingAt: 'd-eng-1' },
    { id: 'DK', name: 'Daniel K.',       initials: 'DK', color: 'navy',  status: 'available', x: 210, y: 485, sittingAt: 'd-eng-2' },
    { id: 'PO', name: 'Peter Ø.',        initials: 'PO', color: 'amber', status: 'busy',      x: 210, y: 625, sittingAt: 'd-eng-4' },
    { id: 'NB', name: 'Nadia Berg',      initials: 'NB', color: 'plum',  status: 'available', x: 330, y: 485, sittingAt: 'd-eng-5' },
    { id: 'LV', name: 'Liva V.',         initials: 'LV', color: 'sage',  status: 'available', x: 330, y: 625, sittingAt: 'd-eng-6' },
    // Sales
    { id: 'KM', name: 'Kira Madsen',     initials: 'KM', color: 'amber', status: 'available', x: 470, y: 485, sittingAt: 'd-sales-1' },
    { id: 'NM', name: 'Noah Møller',     initials: 'NM', color: 'plum',  status: 'busy',      x: 580, y: 485, sittingAt: 'd-sales-2' },
    { id: 'EH', name: 'Esther H.',       initials: 'EH', color: 'sage',  status: 'available', x: 470, y: 625, sittingAt: 'd-sales-3' },
    { id: 'FK', name: 'Frederik K.',     initials: 'FK', color: 'navy',  status: 'available', x: 580, y: 625, sittingAt: 'd-sales-4' },
    // Finance
    { id: 'CH', name: 'Christine H.',    initials: 'CH', color: 'sage',  status: 'available', x: 770, y: 485, sittingAt: 'd-fin-1' },
    { id: 'IO', name: 'Ida Ø.',          initials: 'IO', color: 'amber', status: 'busy',      x: 880, y: 485, sittingAt: 'd-fin-2' },
    { id: 'BR', name: 'Bjørn R.',        initials: 'BR', color: 'navy',  status: 'available', x: 770, y: 625, sittingAt: 'd-fin-3' },
    // Compliance
    { id: 'JK', name: 'Josefine K.',     initials: 'JK', color: 'plum',  status: 'available', x: 1060, y: 485, sittingAt: 'd-cmp-1' },
    { id: 'LH', name: 'Lærke Hansen',    initials: 'LH', color: 'sage',  status: 'available', x: 1180, y: 485, sittingAt: 'd-cmp-2' },
    { id: 'MA', name: 'Magnus A.',       initials: 'MA', color: 'navy',  status: 'busy',      x: 1060, y: 625, sittingAt: 'd-cmp-3' },
    // Marketing
    { id: 'TH', name: 'Tobias Holm',     initials: 'TH', color: 'plum',  status: 'available', x: 1390, y: 485, sittingAt: 'd-mkt-1' },
    { id: 'VP', name: 'Vibeke P.',       initials: 'VP', color: 'terra', status: 'available', x: 1500, y: 485, sittingAt: 'd-mkt-2' },
    { id: 'GR', name: 'Gustav R.',       initials: 'GR', color: 'navy',  status: 'busy',      x: 1390, y: 625, sittingAt: 'd-mkt-3' },
    { id: 'SY', name: 'Sofie Yde',       initials: 'SY', color: 'sage',  status: 'available', x: 1500, y: 625, sittingAt: 'd-mkt-4' },
    // Exec assistants
    { id: 'JS', name: 'Jeanette S.',     initials: 'JS', color: 'plum',  status: 'available', x: 1740, y: 505, sittingAt: 'd-ex-1' },
    { id: 'RD', name: 'Rikke D.',        initials: 'RD', color: 'amber', status: 'available', x: 1740, y: 625, sittingAt: 'd-ex-2' },
    // Cafeteria
    { id: 'JL', name: 'Julie Lange',     initials: 'JL', color: 'amber', status: 'available', x: 1300, y: 880, talking: true },
    { id: 'EC', name: 'Emma Carlsen',    initials: 'EC', color: 'plum',  status: 'available', x: 1380, y: 900, talking: true },
    { id: 'AS', name: 'Asger Sand',      initials: 'AS', color: 'sage',  status: 'available', x: 1360, y: 950, talking: true },
    { id: 'CL', name: 'Camilla Lund',    initials: 'CL', color: 'amber', status: 'available', x: 1900, y: 880, talking: true },
    { id: 'MK', name: 'Mads Kjær',       initials: 'MK', color: 'navy',  status: 'available', x: 1960, y: 920, talking: true },
    // Wanderer
    { id: 'OS', name: 'Olivia S.',       initials: 'OS', color: 'plum',  status: 'available', x: 700, y: 780, wandering: true,
      wanderCenter: { x: 700, y: 780 }, wanderRadius: { x: 120, y: 40 } },
  ],

  screens: [
    { id: 'screen-a', label: 'Skærm A', x: 100, y: 100, w: 80, h: 14,
      content: { kicker: 'Board prep', title: 'Q2 P&L', sub: 'CFO · slide 7 af 24' } },
    { id: 'screen-b', label: 'Skærm B', x: 350, y: 100, w: 70, h: 14,
      content: null },
    { id: 'screen-board', label: 'Boardroom-skærm', big: true,
      x: 1080, y: 100, w: 160, h: 28,
      content: { kicker: 'Bestyrelse', title: 'Strategi 2027', sub: 'Forretningsenhed · slide 12' } },
    { id: 'screen-train', label: 'Trænings-skærm', x: 1400, y: 100, w: 100, h: 16,
      content: { kicker: 'Onboarding', title: 'Sikkerhed & GDPR', sub: 'Modul 2 af 4' } },
    { id: 'screen-conf-c', label: 'Skærm C', x: 1680, y: 100, w: 80, h: 14,
      content: null },
    { id: 'screen-cafe', label: 'Kantine-skærm', big: true,
      x: 1700, y: 760, w: 200, h: 30,
      content: { kicker: 'Frokost-menu', title: 'Tirsdag: Karry + ris', sub: 'Vegetar · grøntsagspie' } },
  ],

  fixtures: [
    { type: 'counter', x: 1180, y: 790, w: 100, h: 28 },
    { type: 'coffee',  x: 1330, y: 800 },
    { type: 'cooler',  x: 1380, y: 800 },
    { type: 'table',   x: 1300, y: 950, w: 150, h: 40 },
    { type: 'table',   x: 1500, y: 950, w: 150, h: 40 },
    { type: 'table',   x: 1700, y: 950, w: 150, h: 40 },
    { type: 'table',   x: 1900, y: 950, w: 150, h: 40 },
    { type: 'table',   x: 2100, y: 950, w: 150, h: 40 },
    { type: 'sofa',    x: 180, y: 1050, w: 120, h: 36 },
    { type: 'sofa',    x: 320, y: 1050, w: 120, h: 36 },
    { type: 'table',   x: 250, y: 1130, w: 100, h: 40 },
  ],

  plants: [
    { x: 30,   y: 360 },
    { x: 410,  y: 360 },
    { x: 710,  y: 360 },
    { x: 1010, y: 360 },
    { x: 1330, y: 360 },
    { x: 1670, y: 360 },
    { x: 2380, y: 360 },
    { x: 30,   y: 920 },
    { x: 540,  y: 920 },
    { x: 1000, y: 720 },
    { x: 2380, y: 720 },
    { x: 1000, y: 1300 },
    { x: 2380, y: 1300 },
  ],
};

window.LAYOUTS = { klassisk: KLASSISK, studio: STUDIO, enterprise: ENTERPRISE };
window.DEFAULT_LAYOUT = 'klassisk';
