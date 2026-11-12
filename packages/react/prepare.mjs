import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
const root=dirname(fileURLToPath(import.meta.url));
const manifest=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const required=['src/index.js','src/index.d.ts','LICENSE','README.md'];
if(manifest.name==='@dom-director/core')required.push('src/schema.generated.js','src/script.generated.d.ts');
for(const file of required)if(!existsSync(join(root,file)))throw Error(`Missing ${file}; run the repository schema/type build before packing.`);
if(manifest.private!==true)throw Error('Registry publication needs a separate explicit release decision.');
