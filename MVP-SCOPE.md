# VirtualOffice — MVP Scope (2care4 Pilot)

_Genereret af Hermes kanban-pipeline (t_8fd3f2a6) — 2026-06-04_

---

## 1. Analyse: Prototype vs Pitch

Prototypen er en ærlig UX-demo (1575 linjer HTML/JSX). Den implementerer faktisk alle
pitchede features — men på mock-niveau. Ingen backend, ingen rigtig audio, ingen auth.

| Feature | Prototype | Pitch/MVP |
|---------|-----------|-----------|
| 2D kontor-layout (3 varianter) | ✅ Fuldt implementeret | ✅ Beholdes |
| Spatial audio (visual sim) | ✅ Visuel simulation | ⚠️ Kræver LiveKit |
| Room booking (lokal state) | ✅ Fungerer visuelt | ⚠️ Kræver DB |
| Avatar movement + kollision | ✅ Fuldt implementeret | ✅ Beholdes |
| Avatar status-system | ✅ Fuldt implementeret | ✅ Beholdes |
| Azure AD SSO | ❌ Ikke implementeret | ✅ Kræves |
| Outlook/Graph sync | ❌ Dekorativ tag kun | 🚫 Ekskluderes (MVP) |
| Persistens/DB | ❌ Ingen | ✅ Kræves |
| Multi-tenant | ❌ Ingen | ⚠️ Schema fra dag 1, single-tenant pilot |
| Desk personalisering | ✅ Visuelt | ✅ Beholdes |
| Kamera/præsentation overlay | ✅ Visuelt | ⚠️ Kræver WebRTC |
| Theme switcher | ✅ Fuldt | ✅ Beholdes |

**Konklusion:** Prototype-til-MVP er et "mock-to-real" gap — ikke et feature-gap.
Alle pitchede features er korrekt beskrevet; pitchen over-claimede ikke.

---

## 2. MVP Scope — 2care4 Pilot (15 brugere, 6 uger)

### I scope

1. **Azure AD SSO** — login via NextAuth.js + Microsoft provider (2care4 bruger M365)
2. **Spatial audio** — LiveKit Cloud free tier (håndterer 15 brugere komfortabelt)
3. **Fixed single-floor layout** — Klassisk layout fra prototype (ingen map editor)
4. **Avatar presence + bevægelse** — port fra prototype, persistence via Pusher + DB
5. **Desk personalisering** — navn, farve, emoji (gemmes i DB)
6. **User management** — org_admin kan invite/deaktivere brugere
7. **Status management** — Available / Busy / Away / DND

### Ekskluderet fra MVP

| Feature | Begrundelse | Target |
|---------|-------------|--------|
| Map editor | Unødvendig kompleksitet | Q4 2026 |
| Outlook/Graph sync | API-integration, stor scope | Q3 2026 |
| Avatar interactions (coffee, wave) | Nice-to-have | Q3 2026 |
| Stripe / betaling | Pilot er gratis | Q4 2026 |
| Chat / DM | Teams dækker dette | 2027 |
| Gamification | Ikke forretningskritisk | 2027 |
| Multi-floor | 15 brugere = ét gulv | Q4 2026 |
| Room booking | Kompleks UI/UX | Q3 2026 |
| Mobile app | Web-first | 2027 |
| Custom branding | Enterprise feature | Q4 2026 |
| Video recording | Ikke i scope | 2027 |

---

## 3. Tech Stack

```
Frontend:   Next.js 15 (App Router) — mandated by DEVELOPMENT_STANDARDS.md
Auth:       NextAuth.js + Azure AD OIDC (2care4's M365 tenant)
Spatial:    LiveKit Cloud free tier (spatial audio, WebRTC)
Presence:   Pusher (non-audio presence sync — simplest for 15 users)
Database:   Vercel Postgres + Drizzle ORM
Storage:    Vercel Blob (avatars, assets)
Email:      Resend
Hosting:    Vercel Pro
```

**Åben beslutning:** LiveKit Cloud vs self-hosted.
- Cloud: nul ops, gratis til 15 brugere, risiko ved skalering
- Self-hosted: fuld kontrol, kræver infra-arbejde
- Anbefaling: Start med Cloud, evaluer ved 50+ brugere

---

## 4. Database Schema (6 aktive tabeller)

```sql
organizations   -- multi-tenant fra dag 1 (pilot = 1 org)
users           -- id, org_id, azure_oid, name, email, role
floors          -- id, org_id, layout_json
desks           -- id, floor_id, user_id, position_x, position_y, decoration
presence        -- id, user_id, floor_id, pos_x, pos_y, status, last_seen
rooms           -- id, floor_id, name, capacity, bounds_json
```

---

## 5. Brugerroller (2 for pilot)

| Rolle | Kan |
|-------|-----|
| org_admin | Invite/deaktiver brugere, se alle på gulvet |
| member | Login, bevæge avatar, tale med kolleger, personalisere desk |

(TDD definerer 5 roller — reduceret til 2 for pilot-simplificitet)

---

## 6. Pilot Aktiveringsplan (6 uger)

| Uge | Mål |
|-----|-----|
| 1 | Azure AD SSO + user management virker end-to-end |
| 2 | Avatar movement + presence på gulvet (Pusher live) |
| 3 | LiveKit spatial audio integreret |
| 4 | Desk personalisering + status |
| 5 | Pilot-onboarding: 15 2care4-brugere |
| 6 | Feedback-runde, prioritér iteration 2 |

---

## 7. Acceptance Criteria

### Teknisk (6)
- [ ] Azure AD login virker for alle @2care4.dk accounts
- [ ] Presence heartbeat opdaterer position < 200ms
- [ ] LiveKit audio aktiveres automatisk ved nærhed (< 150px)
- [ ] DB skriver korrekt i multi-tenant schema
- [ ] 15 samtidige brugere uden degraderet performance
- [ ] Avatar-position gemmes på tværs af reload

### UX (4)
- [ ] Ny bruger kan onboardes på < 2 minutter
- [ ] Avatar-bevægelse føles responsivt (tastatur + klik)
- [ ] Status-skift er synligt for alle på gulvet < 500ms
- [ ] Desk personalisering gemmes og vises korrekt

### Pilot Success Gates (3)
- [ ] 80% af pilot-brugere logger ind mindst 3× i uge 1
- [ ] Mindst 1 spontan samtale pr. bruger pr. uge (LiveKit session started)
- [ ] NPS ≥ 7 efter 3 uger

---

## 8. Risici

| Risiko | Sandsynlighed | Mitigation |
|--------|--------------|------------|
| LiveKit latency > 300ms | Medium | Test tidligt, self-hosted fallback |
| Azure AD app-godkendelse tager tid | Høj | Rasmus er IT-chef — ekspedér approval |
| 15 brugere adopterer ikke | Medium | Rasmus = intern champion, daglig reminder |
| Prototype-kode kan ikke ports direkte | Lav | App.jsx er ren React, 95% genanvendelig |
| Vercel Postgres connection limits | Lav | Drizzle connection pooling fra dag 1 |

---

## 9. Næste skridt

1. Opret Next.js 15 projekt i `/projects/virtual-office/` (app router)
2. Opsæt NextAuth.js med Azure AD provider
3. Port prototype canvas/avatar-logik til React Server Components + client hooks
4. Integrér LiveKit React SDK
5. Opsæt Vercel Postgres + Drizzle migrations
6. Deploy til Vercel preview URL → test med Rasmus

**Åbent:** Rasmus skal godkende Azure AD app-registrering i 2care4 tenant.
