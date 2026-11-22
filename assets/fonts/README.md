# Local fonts

Vendored from the following Fontsource npm packages (normal style):

| Package                             | Version | Weights            |
| ----------------------------------- | ------- | ------------------ |
| @fontsource/be-vietnam-pro          | 5.3.0   | 400, 500, 600, 700 |
| @fontsource-variable/jetbrains-mono | 5.3.0   | 100–800            |
| @fontsource-variable/noto-sans-jp   | 5.3.1   | 100–900            |
| @fontsource-variable/noto-sans-kr   | 5.3.1   | 100–900            |
| @fontsource-variable/noto-sans-sc   | 5.3.1   | 100–900            |
| @fontsource-variable/orbitron       | 5.3.0   | 400–900            |
| @fontsource-variable/outfit         | 5.3.0   | 100–900            |

The unmodified WOFF2 files retain Fontsource's Unicode subsets. CSS uses the
application's existing family names and local URLs; large families are grouped
into small Unicode-subset stylesheets. Browsers load only subsets needed by the text.
All seven families use the SIL Open Font License 1.1; the corresponding upstream
license and copyright notices are included as `*-LICENSE.txt`.

`fonts.css` is the stylesheet entry point. Production builds and the development
server copy this directory into `dist/web/assets/fonts`. No npm font package or
font service is needed at runtime. To update, obtain the listed packages, retain
their license notices, and update the WOFF2 files and matching Unicode-range CSS
together.
