# Local fonts

Vendored from the following Fontsource npm packages (normal style):

| Package                             | Version | Weights                 |
| ----------------------------------- | ------- | ----------------------- |
| @fontsource/be-vietnam-pro          | 5.3.0   | 400, 500, 600, 700      |
| @fontsource-variable/jetbrains-mono | 5.3.0   | 400, 500, 550, 600, 700 |
| @fontsource-variable/noto-sans-jp   | 5.3.1   | 400, 500, 550, 600, 700 |
| @fontsource-variable/noto-sans-kr   | 5.3.1   | 400, 500, 550, 600, 700 |
| @fontsource-variable/noto-sans-sc   | 5.3.1   | 400, 500, 550, 600, 700 |
| @fontsource-variable/orbitron       | 5.3.0   | 400, 600                |
| @fontsource-variable/outfit         | 5.3.0   | 600                     |

Only Fontsource's latin, latin-ext and vietnamese subsets are retained where
available, with their matching Unicode ranges. Greek and Cyrillic glyphs
use the application's existing system-font fallbacks instead of bundled fonts.
CSS uses the application's existing family names and local URLs.

Be Vietnam Pro's static WOFF2 files are unmodified. Variable fonts were instantiated
at the listed CSS weights using fonttools 4.65.0 and brotli 1.2.1:
`fonttools varLib.instancer input.woff2 wght=550 --output output.woff2`
(repeat for each retained weight/subset). No unused weight ranges are shipped.
400 covers normal/inherited text, 500/550/600/700 cover the mono/body styles,
display uses 400/600, and the brand name uses 600.
All seven families use the SIL Open Font License 1.1; the corresponding upstream
license and copyright notices are included as `*-LICENSE.txt`.

`fonts.css` is the stylesheet entry point. Production builds and the development
server copy this directory into `dist/web/assets/fonts`. No npm font package or
font service is needed at runtime. To update, obtain the listed packages, retain
their license notices, instantiate only the listed weights, and update the WOFF2
files and matching Unicode-range CSS together. Font tooling is needed only when
updating these assets, not when building or running the application.

## App-specific CJK coverage

Main's Google Fonts CSS2 URL requested Noto Sans SC, JP and KR at weights
400/500/600/700, without a `text=` restriction. The language-specific rules in
`theme.css` select SC for zh, JP for ja and KR for ko. These same families are
self-hosted here; their CJK subsets contain only characters extracted from the
locale source files, support-prompt translations and language-menu labels:

| Locale | Family       | Code points | Weights                 |
| ------ | ------------ | ----------- | ----------------------- |
| zh     | Noto Sans SC | 380         | 400, 500, 550, 600, 700 |
| ja     | Noto Sans JP | 338         | 400, 500, 550, 600, 700 |
| ko     | Noto Sans KR | 291         | 400, 500, 550, 600, 700 |

`cjk-sources.json` records upstream Google Fonts source URLs and SHA-256 hashes.
The upstream CJK SIL license/copyright notice is included as `noto-cjk-LICENSE.txt`.
Each WOFF2 has an exact matching
`unicode-range` in `cjk-{zh,ja,ko}.css`; Latin text does not load these fonts.
Opening the language menu loads the fonts needed for its native-language labels,
even when the current locale is English. Arbitrary CJK text outside the app's
translations (for example, a document filename) still needs system-font fallbacks.

To regenerate after changing translations, download the three upstream variable
TTF files named `NotoSansSC.ttf`, `NotoSansJP.ttf`, `NotoSansKR.ttf` into a working
directory, then run with fonttools/brotli installed and Node available:

```sh
python3 scripts/subset-cjk-fonts.py /path/to/source-fonts
npx prettier --write 'assets/fonts/cjk*.css' assets/fonts/cjk-sources.json
```

The tool uses fonttools' `Subsetter` (the `pyftsubset` implementation), then
instantiates only the five CSS weights. Normal web/desktop builds require no
Python tooling: a Node-only build gate reads each WOFF2's actual Unicode cmap
and CSS range, and rejects missing or unused locale characters. `npm test` runs
the same gate plus a regression proving a newly added escaped CJK character
fails until the assets are regenerated.
