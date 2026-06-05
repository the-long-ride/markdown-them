<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-them/main/assets/markdown-them-logo.png" width="128" alt="Markdown Them Logo">
</p>

# Markdown Them

Konverter ulike dokumentfiler til Markdown (.md) fra en web-applikasjon, en Electron-skrivebordsapp, en VS Code-utvidelse eller en Node.js-pakke.

- **Web-app:** Dokumentkonverterer som kun kjører på klientsiden i nettleseren din. Vertet og distribuert direkte på GitHub Pages.
- **Skrivebordsapp:** En førsteklasses Electron-app for konvertering av lokale filer, mapper og tekstinndata med egne valg for utdatamappe. Tilgjengelig for Windows (Portable), Linux (.AppImage, .deb) og macOS (.dmg).
- **VS Code-utvidelse:** Høyreklikkmenyer i filutforskeren og side-by-side Markdown-forhåndsvisninger integrert i utviklerens arbeidsflyt.
- **Node.js-pakke:** Integrer den samme konverteringsmotoren i egne skript, CLI-verktøy og automatiseringer.

- **Støttede formater:** `.docx`, `.pdf`, `.html`, `.xlsx`, `.pptx`, `.odt`, `.odp`, `.ods`, `.rtf`.
- **Samtidig batch-prosessering:** Konverter dusinvis av filer samtidig med optimalisert ytelse.

## Markdown Them-varianter

Markdown Them kommer i fire varianter, slik at du kan bruke den samme konvertereren der den passer best i din arbeidsflyt:

| Variant | Best for | Lokal-/personvernmodell | Hvor du starter |
|---|---|---|---|
| **Web-app** | Nettleserbasert konvertering uten installasjon | Kun på klientsiden; ingen dokumenter lastes opp, ingen eksterne forespørsler. Distribuert på GitHub Pages. | `npm run start:web` |
| **Skrivebordsapp** | Konvertering av lokale filer, mapper og tekst ved hjelp av et app-skall | Electron-app som kjører på datamaskinen din; støtte for valg av utdatamappe. Installere bygget for Windows, Linux og macOS. | `npm run start:desktop` |
| **VS Code-utvidelse** | Utforskerens høyreklikkmeny, aktive forhåndsvisninger i editor, utvikler-arbeidsflyt | Kjører lokalt i VS Code på din maskin | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them) eller [Open VSX](https://open-vsx.org/extension/the-long-ride/markdown-them) |
| **Node.js-pakke** | Skript, CLI, automatisering og verktøy på serversiden som du kontrollerer | Kjører i din Node.js-prosess | [`@the-long-ride/markdown-them`](https://www.npmjs.com/package/@the-long-ride/markdown-them) |

---

## Web- og Skrivebordsapper

Dette repositoriet inkluderer et delt React-grensesnitt for en lokal web-app og en Electron-skrivebordsapp.

- **Web-app:** Kun konvertering på klientsiden. Godtar flere filer eller tekstinndata, og sender aldri filer til en ekstern server. Distribuert til GitHub Pages.
- **Skrivebordsapp:** Electron-skall med tilpassede vinduskontroller. Godtar tekst, enkeltfiler, flere filer eller hele mapper. Konverterte filer lagres ved siden av originalfilene.

### Lokale oppstartskommandoer:

```bash
npm run start:web
npm run start:desktop
npm run preview:desktop
```

### Kommandoer for bygging:

```bash
npm run build:web
npm run build:desktop
npm run build:apps
```

### Distribusjonsflyt for skrivebordsapp:

Bygg produksjonsklare installasjonsfiler (Windows Portable `.exe`, Linux `.AppImage`/`.deb`, macOS `.dmg`) ved hjelp av `electron-builder`:

```bash
# Bygg for Windows (Portable exe)
npm run dist:desktop:win

# Bygg for Linux (AppImage & deb)
npm run dist:desktop:linux

# Bygg for macOS (dmg)
npm run dist:desktop:mac

# Bygg for alle plattformer samtidig
npm run dist:desktop:all
```

De genererte filene vil bli plassert i mappen `dist/installers`.

---

## VS Code-utvidelse

### Bruk

#### 1. Konverter flere filer samtidig (Batch)
1. I **Explorer**-sidelinjen i VS Code, velg én eller flere filer.
2. Høyreklikk og velg **Convert to Markdown**.
3. Filene vil bli konvertert **samtidig** (opp til den definerte grensen). Du vil se varsler etter hvert som hver fil fullføres.

#### 2. Konverter aktiv fil
- Mens du viser et dokument, trykker du `Ctrl+M Ctrl+D` (eller `Cmd+M Ctrl+D` på Mac).
- En Markdown-forhåndsvisning vil åpne i et nytt vindu ved siden av din gjeldende editor.

#### 3. Endre grensen for antall samtidige konverteringer
- Bruk kommandopaletten (`Ctrl+Shift+P`) og søk etter **Markdown Them: Set Max Concurrent Conversions**.
- Eller gå til **File > Preferences > Settings** og søk etter `Markdown Them`.

> [!NOTE]
> Konvertering av `.pptx`, `.odt` og `.odp` trekker ut strukturert tekst og hovedbilder som innebygde Base64-data URI-er der dette er tilgjengelig. Bakgrunner, gjentatte logoer og små dekorative ikoner blir filtrert ut for å holde Markdown-teksten lesbar. `.ods` trekker ut ark som Markdown-tabeller, og `.rtf` bevarer vanlig tekstformatering, overskrifter og punktlister.

#### 4. Feilsøking
Hvis en fil ikke kan konverteres, kan du se detaljerte feillogger og stakkesporing (stack traces) ved å åpne **Developer: Toggle Developer Tools** (fra kommandopaletten) og sjekke fanen **Console**.

### Konfigurasjon

| Innstilling | Type | Standard | Område | Beskrivelse |
|---|---|---|---|---|
| `markdown-them.maxConcurrentConversions` | `integer` | `6` | `1` – `16` | Maksimalt antall filer som kan konverteres samtidig under en batch-prosessering med "Convert to Markdown". |

Du kan endre dette på tre måter:

**1. Kommandopalett** — Kjør `Markdown Them: Set Max Concurrent Conversions` (`Ctrl+Shift+P`) for å åpne en interaktiv inndataboks fylt med gjeldende verdi.

**2. Innstillinger (UI)** — Åpne **Settings** (`Ctrl+,`) og søk etter `Markdown Them`.

**3. `settings.json`** — Legg til konfigurasjonsnøkkelen direkte:

```jsonc
{
  // Konverter opptil 4 filer samtidig
  "markdown-them.maxConcurrentConversions": 4
}
```

---

## Node.js-pakke

Fra og med v1.2.0 er den delte konvertereren også pakket for Node.js-utviklere som `@the-long-ride/markdown-them`:

```bash
npm i @the-long-ride/markdown-them
pnpm add @the-long-ride/markdown-them
```

```ts
import { convertFileToMarkdown, generateMarkdown } from "@the-long-ride/markdown-them";

const outputPath = await convertFileToMarkdown("./docs/report.docx");
const markdown = await generateMarkdown("./docs/report.docx");
```

### Lokale byggekommandoer:

```bash
npm run pack:vsix
npm run pack:node-package
```

Push av utgivelsestagger publiserer automatisk pakken til npm. Konfigurer denne GitHub-hemmeligheten (secret) før du pusher en `v*` tag:

```text
NPM_TOKEN
```

---

## Kildekodestruktur

- `src/core`: Delt dokument-til-Markdown konverteringslogikk.
- `src/app`: Delt React-grensesnitt og adapter for nettleserkonvertering.
- `src/electron`: Hovedprosess og preload-skript for Electron-skrivebordsappen.
- `src/shared`: Delte formatmetadata og filnavnhjelpere.
- `src/vscode`: VS Code kommandoer og editor-integrasjon.
- `src/nodejs-package`: Eksport-inngangspunkt for Node.js-pakken.
- `scripts`: Skript for bygging og lokal kjøring av applikasjoner.
- `nodejs-package`: Distribuerbar npm-pakke metadata, README, lisens og generert `dist`.

---

## Støttet Av Sikre Biblioteker

Jeg bryr meg om sikkerhet og lisensiering for kommersiell bruk, så jeg valgte populære pakker med permissive åpen kildekode- eller standardlisenser.
Spesiell takk til forfatterne og bidragsyterne til disse fantastiske bibliotekene som gjør dette prosjektet mulig:

- [`react`](https://github.com/facebook/react) / [`react-dom`](https://github.com/facebook/react) (MIT-lisens): Interaktiv grensesnittstruktur.
- [`gsap`](https://github.com/greensock/GSAP) / [`@gsap/react`](https://github.com/greensock/react) (GreenSock Standard-lisens): Førsteklasses animasjoner for sideoverganger.
- [`lucide-react`](https://github.com/lucide-icons/lucide) (ISC-lisens): Elegante grensesnittikoner.
- [`mammoth`](https://github.com/mwilliamson/mammoth.js) (BSD-2-Clause-lisens): Robust konvertering av `.docx`-dokumenter.
- [`@opendocsg/pdf2md`](https://github.com/opendocsg/pdf2md) (MIT-lisens): Pålitelig tekstuttrekk fra `.pdf`-filer.
- [`jszip`](https://github.com/Stuk/jszip) (MIT- eller GPL-3.0-lisens): Zip-utpakking av filer.
- [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser) (MIT-lisens): Lett XML-parsing for Office-dokumenter.
- [`turndown`](https://github.com/mixmark-io/turndown) (MIT-lisens): Ren konvertering av HTML-innhold til Markdown.
- [`officeparser`](https://github.com/harshankur/officeParser) (MIT-lisens): Reserveløsning for tekstuttrekk fra uvanlige Office/OpenDocument-filer.

---

## Lenker og bidrag
[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them) 
| [Open VSX](https://open-vsx.org/extension/the-long-ride/markdown-them) 
| [GitHub Repository](https://github.com/the-long-ride/markdown-them) 
| [Endringslogg](https://github.com/the-long-ride/markdown-them/blob/main/CHANGELOG.md) 
| [Bidragsyter-retningslinjer](https://github.com/the-long-ride/markdown-them/blob/main/GUIDELINE.md)

## Lisens
[MIT (med restriksjoner på bruk av tema)](https://github.com/the-long-ride/markdown-them/blob/main/LICENSE)
