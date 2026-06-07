# VirtualOffice — Demo-script til 2care4 salgspræsentation

**Varighed:** 15-20 minutter  
**Målgruppe:** Beslutningstager(e) hos 2care4 (IT-ledelse, HR, direktion)  
**Format:** Live demo + dialog  
**Demonstrant:** Rasmus K. eller salgsrepræsentant

---

## Forberedelse (10 min før)

1. Åbn terminalen og start dev-server:
   ```
   cd /Users/bh32_mac_mini/projects/virtual-office
   npm run dev
   ```
2. Åbn Chrome på http://localhost:3000
3. Kør seed-script (kræver POSTGRES_URL):
   ```
   python demo/seed-demo.py
   ```
4. Åbn 2-3 ekstra browser-faner som forskellige brugere for at simulere et levende kontor
5. Test audio (headset / højttalere)
6. Skjul alle andre apps — brug kun browseren under demo

---

## Scene 1: Hook (0-2 min)

**Mål:** Skabe genkendelighed og følelsesmæssig forbindelse

**Fortæl:**
> "I dag mødes vi i et virtuelt mødelokale. Men hvad sker der bagefter?
> Alle logger af. Ingen slutter op ved kaffemaskinen. Ingen popper ind
> til hinanden. Den energi, som et rigtigt kontor skaber — den er væk.
> VirtualOffice giver den energi tilbage — uden at tvinge nogen på kontoret."

**Vis:** Den tomme office-canvas med de 7 demo-avatarer allerede placeret.

**Spørgsmål til publikum:**
> "Savner I at man kan gå hen til en kollega og bare sige 'hey, hurtigt spørgsmål'?"

---

## Scene 2: Tilstedeværelse er synlig (2-5 min)

**Mål:** Vis presence-systemet i aktion

**Demo-flow:**
1. Peg på de 7 avatarer: "Her ser I 7 af jeres kolleger akkurat nu — hvem der er online, og hvad de laver."
2. Zoom ind på Engineering-podzonen: Rasmus, Mette og Thomas er samlet.
3. Klik på chat-ikonet — vis de eksisterende chat-beskeder:
   - "Rasmus spørger om sprint review"
   - "Mette har deployet"
   - "Thomas tester"
4. "Dette er ikke en Slack-tråd fra i går aftes. Det sker lige nu, live."

**Fortæl:**
> "Presence er ikke et status-ikon. Det er et fuldt overblik over hvem
> der er tilgængelig, hvem der er i møde, og hvem der sidder alene og
> måske godt kan bruge en snak."

---

## Scene 3: Spatial audio — "gå hen og tal" (5-9 min)

**Mål:** Live demo af kernefeature — proximity audio

**Demo-flow:**
1. Log ind som én avatar (fx demo-rasmus) i hovedvinduet.
2. Åbn en anden fane som demo-mette.
3. I begge faner: klik "Gå til kontoret" med headset på.
4. Flyt demo-rasmus-avataren LANGT fra demo-mette.
   - Fortæl: "Mettes mikrofon er åben, men I hører hende slet ikke — for afstanden er for stor."
5. Flyt langsomt demo-rasmus hen mod demo-mette.
   - "Læg mærke til — lyden stiger gradvist jo tættere vi kommer."
6. Stå inden for 72px: "Nu hører vi hinanden fuldstændigt — som at stå ved siden af hinanden."

**Fortæl:**
> "Ingen kalenderinvitation. Ingen 'kan du ta' et møde?'. Du går bare hen.
> Det er præcis som et rigtigt kontor — og det virker, fordi hjernen
> forbinder nærhed med fortrolighed."

---

## Scene 4: Chat + rum-kontekst (9-11 min)

**Mål:** Vis tekst-chat som supplement til audio

**Demo-flow:**
1. Vis ChatPanel (højre sidebar).
2. Skriv en besked i Engineering-rummet.
3. Skift til anden fane — vis at beskeden dukker op i realtid.
4. Vis at Salgs-teamets beskeder er adskilte: "Salgs-rummet ser kun Salgs-beskeder."

**Fortæl:**
> "Chat er rum-baseret. Ingeniørerne ser ikke hvad salgsteamet skriver —
> ligesom på det rigtige kontor. Men alle kan stadig se hvem der er online."

---

## Scene 5: Layout — jeres eget kontor (11-13 min)

**Mål:** Vis at platformen er tilpasselig til 2care4

**Demo-flow:**
1. Åbn /editor i ny fane (Layout Editor).
2. Vis at rummene kan flyttes og omdøbes.
3. Fortæl: "Vi kan sætte dette op til at afspejle jeres faktiske kontorlayout
   — Glostrup-etagen, HR-området, IT-bunkeren."

**Fortæl:**
> "Piloten starter med 15 brugere. Vi sætter det op på en eftermiddag,
> og I er kørende samme dag. Ingen IT-projekt på 6 måneder."

---

## Scene 6: Microsoft SSO + sikkerhed (13-15 min)

**Mål:** Adressér IT-sikkerhedsperspektivet

**Demo-flow:**
1. Vis login-siden: "Jeres kolleger logger ind med deres normale M365-konto."
2. Ingen ny adgangskode. Ingen ny app-installation. Browser-baseret.

**Fortæl:**
> "Login sker via Azure Active Directory — jeres eksisterende M365-tenant.
> Data ligger i Stockholm-regionen (GDPR). Ingen data forlader EU."

---

## Scene 7: Call to action (15-17 min)

**Mål:** Book næste skridt

**Fortæl:**
> "Vi foreslår en 30-dages pilot med 15 brugere fra IT og én anden afdeling.
> Vi sætter det op. I tester det. Og vi evaluerer sammen om det skaber
> den tilstedeværelse I savner."

**Spørgsmål til publikum:**
- "Hvilke teams ville have mest gavn af det?"
- "Er der specifikke integrationer I mangler? (Teams-kalender, Outlook)"
- "Hvornår kan vi starte?"

---

## Mulige spørgsmål og svar

| Spørgsmål | Svar |
|-----------|------|
| "Hvad koster det?" | Piloten er gratis. Team-plan (~kr/bruger/md) diskuterer vi bagefter. |
| "Skal vi installere noget?" | Nej — ren browser. Virker på Chrome, Edge, Safari. |
| "Hvad med vores Teams-aftaler?" | VirtualOffice erstatter ikke Teams-møder. Det er det der sker IMELLEM møderne. |
| "Er det GDPR-compliant?" | Ja. Data i EU (Stockholm). Ingen tredjeparts tracking. Ingen persistens af audiostrøm. |
| "Hvad hvis folk ikke vil bruge det?" | Adoption er frivillig. Erfaringen viser at 1-2 early adopters skaber pull. |
| "Kan vi integrere med Outlook-kalender?" | På roadmap til Q4 2026. Piloten viser status-ikon baseret på Azure AD. |
| "Hvad med mobil?" | Browser-baseret, virker på mobile browsere. Dedikeret app er på roadmap. |

---

## Demo-tjekliste

- [ ] Dev-server kørende på localhost:3000
- [ ] Seed-script kørt (7 brugere online)
- [ ] Headset tilsluttet og testet
- [ ] 2 browser-faner åbne som forskellige brugere
- [ ] Skærm delt (eller projektor)
- [ ] .env.local med POSTGRES_URL og LIVEKIT nøgler
- [ ] Backup: skærmbilleder/video hvis audio fejler
