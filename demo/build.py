#!/usr/bin/env python3
"""Bundle this demo into a single offline-capable HTML document; no dependencies."""
from pathlib import Path
import base64, json
ROOT=Path(__file__).resolve().parent

def main():
    template=(ROOT/'src/index.html').read_text()
    cues=json.loads((ROOT/'assets/cues.json').read_text())
    audio='data:audio/mpeg;base64,'+base64.b64encode((ROOT/'assets/narration.mp3').read_bytes()).decode()
    inserts={
        '/*__CSS__*/':(ROOT/'src/style.css').read_text(),
        '/*__MODEL__*/':(ROOT/'src/model.js').read_text(),
        '/*__APP__*/':(ROOT/'src/app.js').read_text(),
        '/*__DATA__*/':'const DEMO_DATA = '+json.dumps(cues).replace('<','\\u003c')+';\nconst DEMO_AUDIO = '+json.dumps(audio)+';'
    }
    for marker,value in inserts.items():
        assert template.count(marker)==1, marker
        template=template.replace(marker,value)
    (ROOT/'index.html').write_text(template)
    print(f'Built {ROOT / "index.html"}: {len(template.encode()):,} bytes (including narration)')
if __name__=='__main__':main()
