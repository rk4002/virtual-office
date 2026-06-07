# VirtualOffice — Demo-pakke: Hvad er her og hvad mangler

Genereret: 2026-06-06
Workspace: t_c0ca1731

---

## Indhold i denne mappe

| Fil | Formål | Status |
|-----|--------|--------|
| seed-demo-users.sql | SQL-script: 7 demo-brugere + layout + chat | Klar (mangler DB) |
| seed-demo.py | Python-wrapper til at køre SQL mod Vercel Postgres | Klar (mangler DB) |
| demo-script-salgspraesentation.md | 15-min demo-guide til salgspræsentation | Klar til brug |
| walkthrough-video-script.md | 3-min video walkthrough script + optagetips | Klar til brug |

---

## For at køre database-seeding (KRÆVER POSTGRES_URL)

1. Få POSTGRES_URL fra Vercel dashboard:
   https://vercel.com → Project → Settings → Environment Variables

2. Tilføj til .env.local:
   POSTGRES_URL=postgres://...

3. Kør seed:
   cd /Users/bh32_mac_mini/projects/virtual-office
   python demo/seed-demo.py
   # ELLER:
   psql "$POSTGRES_URL" -f demo/seed-demo-users.sql

---

## Demo-brugere der seedes

| Navn | Email | Position | Rolle |
|------|-------|----------|-------|
| Rasmus K. (IT) | rka@2care4.dk | Engineering pod | IT-leder |
| Mette L. (IT) | ml@2care4.dk | Engineering pod | IT |
| Thomas B. (IT) | tb@2care4.dk | Engineering pod | IT |
| Louise H. (Salg) | lh@2care4.dk | Sales pod | Sælger |
| Jakob S. (Salg) | js@2care4.dk | Sales pod | Sælger |
| Anne M. (HR) | am@2care4.dk | HR-kontor | HR |
| Sune P. (Direktør) | sp@2care4.dk | Mødelokale A | CEO |

---

## Manglende credentials (blokerer fuld demo)

Disse skal sættes i .env.local:

| Variabel | Formål | Hvor finder man den |
|----------|--------|---------------------|
| POSTGRES_URL | Database | Vercel dashboard → Postgres integration |
| POSTGRES_URL_NON_POOLING | SSE-forbindelser | Vercel dashboard → Postgres integration |
| AUTH_MICROSOFT_ENTRA_ID_ID | Azure AD login | Azure Portal → App registrations |
| AUTH_MICROSOFT_ENTRA_ID_SECRET | Azure AD login | Azure Portal → App registrations |
| AUTH_MICROSOFT_ENTRA_ID_ISSUER | Azure AD tenant | https://login.microsoftonline.com/{tenant-id}/v2.0 |
| LIVEKIT_API_KEY | Spatial audio | https://cloud.livekit.io → API Keys |
| LIVEKIT_API_SECRET | Spatial audio | https://cloud.livekit.io → API Keys |
| NEXT_PUBLIC_LIVEKIT_URL | Spatial audio WS | wss://PROJEKT.livekit.cloud |

Uden POSTGRES_URL virker presence, chat og layouts ikke.
Uden LiveKit-nøgler virker spatial audio ikke (men chat og presence virker).
Uden Azure AD virker login ikke i produktion (dev kan bypass med direkte URL).
