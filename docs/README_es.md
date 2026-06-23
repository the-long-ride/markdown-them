<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-them/main/assets/markdown-them-logo.png" width="128" alt="Markdown Them Logo">
</p>

# Markdown Them

Convierte varios archivos de documentos a Markdown (.md) desde una aplicación web, una aplicación de escritorio de Electron, una extensión de VS Code o un paquete de Node.js.

- **Aplicación Web:** Convertidor de documentos solo del lado del cliente que se ejecuta completamente en tu navegador. Alojado y desplegado directamente en GitHub Pages.
- **Aplicación de Escritorio:** Una aplicación premium de Electron para convertir archivos locales, carpetas e inserciones de texto con opciones de directorio de salida personalizadas. Disponible para Windows (Portable), Linux (.AppImage, .deb) y macOS (.dmg).
- **Extensión de VS Code:** Menús contextuales con clic derecho en el explorador de archivos y vistas previas de Markdown de doble panel para flujos de trabajo de desarrollo.
- **Paquete de Node.js:** Integra el mismo motor de conversión en tus scripts, CLIs y automatizaciones personalizadas.

- **Formatos compatibles:** `.docx`, `.doc`, `.pdf`, `.html`, `.xlsx`, `.xls`, `.xlm`, `.pptx`, `.odt`, `.odp`, `.ods`, `.rtf` (Nota: Los formatos heredados `.doc`, `.xls`, `.xlm` usan emulación de cambio de nombre y a veces no se convertirán correctamente).
- **Procesamiento concurrente por lotes:** Convierte docenas de archivos a la vez con un rendimiento optimizado.

## Variantes de Markdown Them

Markdown Them viene en cuatro variantes para que puedas utilizar el mismo convertidor donde mejor se adapte a tu flujo de trabajo:

| Variante | Ideal para | Modelo local/privacidad | Dónde empezar |
|---|---|---|---|
| **Aplicación web** | Conversión basada en navegador sin necesidad de instalación | Solo del lado del cliente; sin subidas de archivos ni peticiones de conversión externas. Desplegado en GitHub Pages. | `npm run start:web` |
| **Aplicación de escritorio** | Conversión local de archivos, carpetas y texto en un contenedor de escritorio | Aplicación de Electron que se ejecuta en tu computadora; soporte para seleccionar la carpeta de salida. Instaladores compilados para Windows, Linux y macOS. | `npm run start:desktop` |
| **Extensión de VS Code** | Menú contextual del Explorador, vistas previas del editor activo, flujos de desarrollo | Se ejecuta dentro de VS Code en tu máquina local | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them) o [Open VSX](https://open-vsx.org/extension/the-long-ride/markdown-them) |
| **Paquete de Node.js** | Scripts, CLIs, automatización y herramientas del lado del servidor bajo tu control | Se ejecuta directamente dentro de tu proceso de Node.js | [`@the-long-ride/markdown-them`](https://www.npmjs.com/package/@the-long-ride/markdown-them) |

---

## Aplicaciones de Escritorio y Web

Este repositorio también incluye un código de interfaz React compartido para la aplicación web local y la aplicación de escritorio de Electron.

- **Aplicación web:** Conversión del lado del cliente únicamente. Acepta múltiples archivos o texto, y nunca envía archivos a un servidor. Desplegado en GitHub Pages.
- **Aplicación de escritorio:** Contenedor de Electron con controles de ventana personalizados. Acepta texto, uno o múltiples archivos, y carpetas. Los archivos convertidos se guardan al lado de los originales.

![Aplicación Web](../media/demo-pics/Markdown-them-Online-web-app.png)
![Aplicación de Escritorio](../media/demo-pics/Markdown-them-Desktop-app.png)


### Comandos de ejecución local:

```bash
npm run start:web
npm run start:desktop
npm run preview:desktop
```

### Comandos de construcción:

```bash
npm run build:web
npm run build:desktop
npm run build:apps
```

### Canalización de Empaquetado de Escritorio:

Genera instaladores y ejecutables listos para producción (Windows Portable `.exe`, Linux `.AppImage`/`.deb`, macOS `.dmg`) utilizando la herramienta `electron-builder`:

```bash
# Compilar para Windows (Portable exe)
npm run dist:desktop:win

# Compilar para Linux (AppImage & deb)
npm run dist:desktop:linux

# Compilar para macOS (dmg)
npm run dist:desktop:mac

# Compilar para todas las plataformas a la vez
npm run dist:desktop:all
```

Los instaladores resultantes se guardarán en el directorio `dist/installers`.

---

## Extensión de VS Code

### Uso

#### 1. Convertir múltiples archivos (Lotes)
1. En la barra lateral del **Explorador** de VS Code, selecciona uno o más archivos.
2. Haz clic derecho y elige **Convert to Markdown**.
3. Los archivos se convertirán **concurrentemente** (hasta el límite definido). Verás notificaciones a medida que se complete cada archivo.

#### 2. Convertir el archivo activo
- Mientras visualizas un documento, presiona `Ctrl+M Ctrl+D` (o `Cmd+M Ctrl+D` en Mac).
- Se abrirá una vista previa de markdown en un panel nuevo al lado de tu editor actual.

#### 3. Cambiar el límite de concurrencia
- Abre la paleta de comandos (`Ctrl+Shift+P`) y busca **Markdown Them: Set Max Concurrent Conversions**.
- O ve a **Archivo > Preferencias > Configuración** y busca `Markdown Them`.

> [!NOTE]
> La conversión de `.pptx`, `.odt` y `.odp` extrae texto estructurado e imágenes del contenido principal como URI de datos Base64 incrustados cuando estén disponibles. Los fondos, logos repetitivos y pequeños iconos decorativos se filtran para mantener el Markdown legible. `.ods` extrae las hojas como tablas de Markdown, y `.rtf` preserva los estilos comunes de texto, encabezados y viñetas.

#### 4. Resolución de problemas
Si un archivo no se puede convertir, puedes ver registros detallados de errores abriendo el comando **Developer: Toggle Developer Tools** (desde la paleta de comandos) y revisando la pestaña **Console**.

### Configuración

| Ajuste | Tipo | Predeterminado | Rango | Descripción |
|---|---|---|---|---|
| `markdown-them.maxConcurrentConversions` | `integer` | `6` | `1` – `16` | Número máximo de archivos convertidos simultáneamente durante una operación de conversión por lotes "Convert to Markdown". |

Puedes cambiar esto de tres formas:

**1. Paleta de comandos** — Ejecuta `Markdown Them: Set Max Concurrent Conversions` (`Ctrl+Shift+P`) para abrir un cuadro de entrada interactivo con el valor actual.

**2. Interfaz de Configuración** — Abre la **Configuración** (`Ctrl+,`) y busca `Markdown Them`.

**3. `settings.json`** — Agrega la clave de configuración directamente:

```jsonc
{
  // Convierte hasta 4 archivos al mismo tiempo
  "markdown-them.maxConcurrentConversions": 4
}
```

---

## Paquete de Node.js

A partir de la versión v1.2.0, el convertidor compartido también se distribuye para desarrolladores de Node.js bajo el nombre `@the-long-ride/markdown-them`:

```bash
npm i @the-long-ride/markdown-them
pnpm add @the-long-ride/markdown-them
```

```ts
import { convertFileToMarkdown, generateMarkdown } from "@the-long-ride/markdown-them";

const outputPath = await convertFileToMarkdown("./docs/report.docx");
const markdown = await generateMarkdown("./docs/report.docx");
```

### Comandos de empaquetado local:

```bash
npm run pack:vsix
npm run pack:node-package
```

El envío de etiquetas (tags) de lanzamiento automatiza la publicación del paquete en npm. Configura esta clave secreta de GitHub antes de subir etiquetas `v*`:

```text
NPM_TOKEN
```

---

## Estructura de Directorios

- `src/core`: Lógica de conversión compartida de documentos a Markdown.
- `src/app`: Interfaz React compartida y adaptador de conversión del lado del cliente.
- `src/electron`: Proceso principal y de pre-carga para la aplicación de Electron.
- `src/shared`: Metadatos de formato compartidos y funciones auxiliares para archivos.
- `src/vscode`: Registro de comandos de VS Code e integración del editor.
- `src/nodejs-package`: Punto de entrada de exportación para el paquete de Node.js.
- `scripts`: Scripts de desarrollo y comandos para ejecución del proyecto.
- `nodejs-package`: Metadatos para publicación del paquete en npm, README, licencia y compilación final `dist`.

---

## Respaldado Por Bibliotecas Seguras

Nos importa la seguridad y las licencias para el uso comercial, por lo que elegimos paquetes de software conocidos que tienen licencias libres o estándar permisivas.
Agradecemos enormemente a los autores y colaboradores de estas increíbles bibliotecas que hacen posible este proyecto:

- [`react`](https://github.com/facebook/react) / [`react-dom`](https://github.com/facebook/react) (Licencia MIT): Estructura de la interfaz interactiva.
- [`gsap`](https://github.com/greensock/GSAP) / [`@gsap/react`](https://github.com/greensock/react) (Licencia Estándar de GreenSock): Animaciones premium para transiciones de páginas.
- [`lucide-react`](https://github.com/lucide-icons/lucide) (Licencia ISC): Iconos elegantes de la interfaz.
- [`mammoth`](https://github.com/mwilliamson/mammoth.js) (Licencia BSD-2-Clause): Conversión robusta de documentos `.docx`.
- [`@opendocsg/pdf2md`](https://github.com/opendocsg/pdf2md) (Licencia MIT): Extracción de texto de archivos `.pdf`.
- [`jszip`](https://github.com/Stuk/jszip) (Licencia MIT o GPL-3.0): Descompresión de archivos zip.
- [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser) (Licencia MIT): Analizador XML ligero para documentos de Office.
- [`turndown`](https://github.com/mixmark-io/turndown) (Licencia MIT): Conversión limpia de HTML a Markdown.
- [`officeparser`](https://github.com/harshankur/officeParser) (Licencia MIT): Extractor de texto alternativo para archivos inusuales de Office o OpenDocument.

---

## Créditos y Enlaces
[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them) 
| [Open VSX](https://open-vsx.org/extension/the-long-ride/markdown-them) 
| [Repositorio en GitHub](https://github.com/the-long-ride/markdown-them) 
| [Registro de Cambios](https://github.com/the-long-ride/markdown-them/blob/main/CHANGELOG.md) 
| [Guía de Contribución](https://github.com/the-long-ride/markdown-them/blob/main/GUIDELINE.md)

## Licencia
[MIT (Con restricciones de uso de tema)](https://github.com/the-long-ride/markdown-them/blob/main/LICENSE)
