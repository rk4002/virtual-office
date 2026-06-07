-- VirtualOffice — Demo seed script
-- Klar til 2care4 pilot-præsentation
-- Kør mod Vercel Postgres, fx: psql $POSTGRES_URL -f seed-demo-users.sql
--
-- KRAV: DATABASE_URL / POSTGRES_URL skal sættes først.
-- Se README.md → Setup → Environment variables.

-- 1. Sørg for at skemaet eksisterer (idempotent)
CREATE TABLE IF NOT EXISTS presence (
  user_id   TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  email     TEXT NOT NULL,
  x         FLOAT8 NOT NULL DEFAULT 0,
  y         FLOAT8 NOT NULL DEFAULT 0,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now(),
  online    BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS office_layouts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  floor_width  INTEGER NOT NULL DEFAULT 2400,
  floor_height INTEGER NOT NULL DEFAULT 1350,
  rooms_json   JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope        TEXT NOT NULL CHECK (scope IN ('room','private')),
  room_id      TEXT,
  sender_id    TEXT NOT NULL,
  sender_name  TEXT NOT NULL,
  recipient_id TEXT,
  text         TEXT NOT NULL,
  x            FLOAT8,
  y            FLOAT8,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ
);

-- 2. Ryd eventuelle gamle demo-data
DELETE FROM presence   WHERE user_id LIKE 'demo-%';
DELETE FROM chat_messages WHERE sender_id LIKE 'demo-%';
DELETE FROM office_layouts WHERE name = '2care4 Demo Layout';

-- 3. Indsæt 7 demo-brugere med realistiske positioner på kontoret
-- Positioner er baseret på ROOMS defineret i src/lib/office-layout.ts:
--   eng-pod:   x:40-620,  y:460-810  (Engineering open plan)
--   sales-pod: x:1440-1900, y:460-810 (Salg open plan)
--   meeting-a: x:60-300,  y:70-270   (Mødelokale A)
--   lounge:    x:1000-1420, y:500-700 (Lounge / social)
--   kitchen:   x:1000-1420, y:880-1120 (Køkken)
INSERT INTO presence (user_id, name, email, x, y, last_seen, online) VALUES
  -- IT-afdelingen (Engineering pod)
  ('demo-rasmus',   'Rasmus K. (IT)',     'rka@2care4.dk',        300, 620, now(), TRUE),
  ('demo-mette',    'Mette L. (IT)',      'ml@2care4.dk',         180, 580, now(), TRUE),
  ('demo-thomas',   'Thomas B. (IT)',     'tb@2care4.dk',         420, 650, now(), TRUE),

  -- Salgs-team (Sales pod)
  ('demo-louise',   'Louise H. (Salg)',   'lh@2care4.dk',        1600, 550, now(), TRUE),
  ('demo-jakob',    'Jakob S. (Salg)',    'js@2care4.dk',        1750, 600, now(), TRUE),

  -- HR & Administration
  ('demo-anne',     'Anne M. (HR)',       'am@2care4.dk',        1300, 100, now(), TRUE),

  -- Ledelse — i mødelokale A til demo-start
  ('demo-ceo',      'Sune P. (Direktør)', 'sp@2care4.dk',         160, 170, now(), TRUE)
ON CONFLICT (user_id) DO UPDATE SET
  name      = EXCLUDED.name,
  email     = EXCLUDED.email,
  x         = EXCLUDED.x,
  y         = EXCLUDED.y,
  last_seen = now(),
  online    = TRUE;

-- 4. Seed demo office layout (matcher src/lib/office-layout.ts ROOMS)
INSERT INTO office_layouts (name, floor_width, floor_height, rooms_json) VALUES (
  '2care4 Demo Layout',
  2400,
  1350,
  '[
    {"id":"meeting-a",  "name":"Mødelokale A",       "type":"meeting", "x":60,   "y":70,  "w":240, "h":200},
    {"id":"meeting-b",  "name":"Mødelokale B",       "type":"meeting", "x":320,  "y":70,  "w":180, "h":160},
    {"id":"focus-1",    "name":"Fokus 1",            "type":"focus",   "x":520,  "y":70,  "w":120, "h":130},
    {"id":"focus-2",    "name":"Fokus 2",            "type":"focus",   "x":660,  "y":70,  "w":120, "h":130},
    {"id":"boardroom",  "name":"Bestyrelseslokale",  "type":"meeting", "x":800,  "y":70,  "w":320, "h":200},
    {"id":"office-dir", "name":"Direktør",           "type":"focus",   "x":1140, "y":70,  "w":140, "h":130},
    {"id":"office-hr",  "name":"HR",                 "type":"focus",   "x":1300, "y":70,  "w":140, "h":130},
    {"id":"training",   "name":"Træning",            "type":"meeting", "x":1460, "y":70,  "w":240, "h":200},
    {"id":"brainstorm", "name":"Brainstorm",         "type":"meeting", "x":1720, "y":70,  "w":200, "h":200},
    {"id":"auditorium", "name":"Auditorium",         "type":"meeting", "x":1940, "y":70,  "w":420, "h":230},
    {"id":"kitchen",    "name":"Køkken",             "type":"social",  "x":1000, "y":880, "w":420, "h":240},
    {"id":"cafeteria",  "name":"Kantine",            "type":"social",  "x":1500, "y":880, "w":800, "h":380},
    {"id":"lounge",     "name":"Lounge",             "type":"social",  "x":1000, "y":500, "w":420, "h":200},
    {"id":"eng-pod",    "name":"Engineering",        "type":"open",    "x":40,   "y":460, "w":580, "h":350},
    {"id":"sales-pod",  "name":"Salg",              "type":"open",    "x":1440, "y":460, "w":460, "h":350}
  ]'::jsonb
);

-- 5. Seed demo chat-beskeder (viser platform i brug — 5 min TTL)
-- Bemærk: i produktion udløber beskeder automatisk efter 5 min.
-- Disse demo-beskeder sættes til 60 min TTL så de er synlige under præsentationen.
INSERT INTO chat_messages (scope, room_id, sender_id, sender_name, text, x, y, created_at, expires_at) VALUES
  ('room', 'eng-pod',   'demo-rasmus', 'Rasmus K. (IT)',
   'God morgen alle! Er I klar til sprint review kl. 10?',
   300, 620, now() - interval '4 minutes', now() + interval '56 minutes'),

  ('room', 'eng-pod',   'demo-mette', 'Mette L. (IT)',
   'Ja! Jeg har deployet den nye build i nat 🚀',
   180, 580, now() - interval '3 minutes', now() + interval '57 minutes'),

  ('room', 'eng-pod',   'demo-thomas', 'Thomas B. (IT)',
   'Nice, jeg tester lige nu. Ser godt ud!',
   420, 650, now() - interval '2 minutes', now() + interval '58 minutes'),

  ('room', 'sales-pod', 'demo-louise', 'Louise H. (Salg)',
   'Reminder: kundemøde med Novo kl. 14 — hvem er med?',
   1600, 550, now() - interval '5 minutes', now() + interval '55 minutes'),

  ('room', 'sales-pod', 'demo-jakob', 'Jakob S. (Salg)',
   'Jeg er med! Sender præsentation i Brainstorm-rummet om lidt',
   1750, 600, now() - interval '1 minute', now() + interval '59 minutes');

-- 6. Verificer data
SELECT 'Presence brugere:' AS check, count(*) AS antal FROM presence WHERE online = TRUE;
SELECT 'Demo layout:' AS check, name FROM office_layouts WHERE name = '2care4 Demo Layout';
SELECT 'Chat beskeder:' AS check, count(*) AS antal FROM chat_messages WHERE sender_id LIKE 'demo-%';
