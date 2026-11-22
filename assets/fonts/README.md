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
available, with their matching Unicode ranges. CJK, Greek and Cyrillic glyphs
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
