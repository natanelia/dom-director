import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
import {mkdirSync,writeFileSync} from 'node:fs';
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,'..');
const common={bundle:true,logLevel:'info',nodePaths:[resolve(here,'node_modules')],alias:{
  '@dom-director/core':resolve(root,'packages/core/src/index.js'),
  '@dom-director/react':resolve(root,'packages/react/src/index.js')},define:{'process.env.NODE_ENV':'"development"'}};
mkdirSync(resolve(here,'dist'),{recursive:true});
await build({...common,entryPoints:[resolve(here,'fixture.jsx')],outfile:resolve(here,'dist/fixture.js'),platform:'browser',format:'iife'});
await build({...common,entryPoints:[resolve(here,'hydrate.jsx')],outfile:resolve(here,'dist/hydrate.js'),platform:'browser',format:'iife'});
await build({...common,entryPoints:[resolve(here,'ssr.test.jsx')],outfile:resolve(here,'dist/ssr.test.cjs'),platform:'node',format:'cjs'});
writeFileSync(resolve(here,'dist/index.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>React lifecycle fixture</title><style>
body{font:16px system-ui;margin:24px}button{padding:8px}#viewport{position:relative;width:720px;height:360px;overflow:hidden;border:1px solid}#scene{position:relative;width:1000px;height:600px;background:#edf3e6}#target{position:absolute;left:450px;top:210px;width:180px;height:70px}#overlay{position:fixed;inset:0;pointer-events:none}#portal-root{position:fixed;right:10px;top:10px}#react-controls{max-width:760px}
</style><div id="root"></div><div id="portal-root"></div><script src="./fixture.js"></script></html>`);
