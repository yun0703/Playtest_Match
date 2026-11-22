import {loadEnv} from 'vite';
import {build} from 'esbuild';
import {readFile,writeFile,mkdir,cp} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const dist=path.join(root,'dist');
const env=loadEnv('production',root,'VITE_');
if(process.env.VERCEL&&(!env.VITE_SUPABASE_URL||!env.VITE_SUPABASE_PUBLISHABLE_KEY))throw new Error('Vercel requires Supabase public environment variables.');
await mkdir(dist,{recursive:true});
const result=await build({
 define:{'import.meta.env.VITE_SUPABASE_URL':JSON.stringify(env.VITE_SUPABASE_URL||''),'import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY':JSON.stringify(env.VITE_SUPABASE_PUBLISHABLE_KEY||'')},
 absWorkingDir:root,entryPoints:['src/main.jsx'],outdir:'dist/assets',entryNames:'app-[hash]',bundle:true,format:'esm',minify:true,target:['es2022'],metafile:true,
 plugins:[{name:'local-site-assets',setup(plugin){
  plugin.onResolve({filter:/\.html\?raw$/},args=>({path:path.resolve(args.resolveDir,args.path.replace(/\?raw$/,'')),namespace:'raw-html'}));
  plugin.onLoad({filter:/.*/,namespace:'raw-html'},async args=>({contents:await readFile(args.path,'utf8'),loader:'text'}));
  plugin.onResolve({filter:/^\/assets\//},args=>({path:args.path,external:true}));
 }}],logLevel:'info'
});
await cp(path.join(root,'public'),dist,{recursive:true});
const outputs=Object.keys(result.metafile.outputs).map(p=>p.replaceAll('\\','/'));
const js=outputs.find(p=>p.endsWith('.js'));
const css=outputs.find(p=>p.endsWith('.css'));
let html=await readFile(path.join(root,'index.html'),'utf8');
html=html.replace(/<script type="module" src="\/src\/main\.jsx"><\/script>/,`<script type="module" src="/${js.replace(/^dist\//,'')}"></script>`);
if(css)html=html.replace('</head>',`<link rel="stylesheet" href="/${css.replace(/^dist\//,'')}"></head>`);
await writeFile(path.join(dist,'index.html'),html);
await mkdir(path.join(dist,'signup'),{recursive:true});
await writeFile(path.join(dist,'signup','index.html'),html);
console.log('Production build written to dist/');
