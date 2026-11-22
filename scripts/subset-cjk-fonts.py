"""Update-only tool: fonttools 4.65.0 + brotli 1.2.1; pass a directory of NotoSans{SC,JP,KR}.ttf files."""

import hashlib
import json
from pathlib import Path
import subprocess
import sys

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

root = Path(__file__).resolve().parents[1]
sources = Path(sys.argv[1])
helper = (root / 'scripts/lib/cjk-characters.mjs').as_uri()
characters = json.loads(subprocess.check_output([
    'node', '--input-type=module', '-e',
    f"import {{ localeCharacters }} from '{helper}'; console.log(JSON.stringify(await localeCharacters({json.dumps(str(root))})));",
], text=True))
stylesheets = []
provenance = {}
for code, suffix in [('zh', 'SC'), ('ja', 'JP'), ('ko', 'KR')]:
    faces = []
    original = sources / f'NotoSans{suffix}.ttf'
    provenance[code] = {
        'source': f'https://github.com/google/fonts/raw/main/ofl/notosans{suffix.lower()}/NotoSans{suffix}[wght].ttf',
        'sha256': hashlib.sha256(original.read_bytes()).hexdigest(),
    }
    font = TTFont(original, recalcTimestamp=False)
    missing = set(characters[code]) - set(font.getBestCmap())
    if missing:
        raise ValueError(f'{code}: source font lacks {missing}')
    options = subset.Options()
    options.flavor = 'woff2'
    options.recalc_timestamp = False
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=characters[code])
    subsetter.subset(font)
    ranges = ', '.join(f'U+{point:X}' for point in characters[code])
    for weight in [400, 500, 550, 600, 700]:
        target = f'noto-sans-{suffix.lower()}-cjk-{weight}.woff2'
        instance = instantiateVariableFont(font, {'wght': weight}, inplace=False)
        instance.flavor = 'woff2'
        instance.save(root / 'assets/fonts' / target)
        instance.close()
        faces.append(f"""@font-face {{
  font-family: 'Noto Sans {suffix}';
  font-style: normal;
  font-display: swap;
  font-weight: {weight};
  src: url(./{target}) format('woff2');
  unicode-range: {ranges};
}}""")
    font.close()
    stylesheet = f'cjk-{code}.css'
    (root / 'assets/fonts' / stylesheet).write_text('\n\n'.join(faces) + '\n')
    stylesheets.append(f"@import './{stylesheet}';")
    print(f'{code}: {len(characters[code])} code points, five static weights')
(root / 'assets/fonts/cjk.css').write_text('\n'.join(stylesheets) + '\n')
(root / 'assets/fonts/cjk-sources.json').write_text(json.dumps(provenance, indent=2) + '\n')
