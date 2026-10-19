import { access, cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const project = fileURLToPath(new URL('../', import.meta.url));
const dist = join(project, 'dist');
const site = join(project, '.pages-site');
await access(join(dist, 'index.html'));
await rm(site, { recursive: true, force: true });
const gamePath = join(site, 'DY', 'wanhu-simulator');
await mkdir(gamePath, { recursive: true });
await cp(dist, gamePath, { recursive: true });
await writeFile(join(site, '.nojekyll'), '');
await writeFile(join(site, 'index.html'), `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/svg+xml" href="./DY/wanhu-simulator/favicon.svg">
<title>DY · 万户模拟器</title><style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#0c1b22;color:#eee9da;font-family:system-ui,sans-serif}main{padding:32px}p{color:#9caaa8;line-height:1.8}a{display:inline-block;padding:12px 20px;border-radius:8px;background:#c4d7ba;color:#152830;text-decoration:none}</style></head>
<body><main><p>DY / WANHU FLIGHT LAB</p><h1>万户模拟器 · 向天而行</h1><p>从一把木椅，到无垠星海。</p><a href="./DY/wanhu-simulator/">进入游戏 →</a></main></body></html>\n`);
console.log('Pages site prepared at .pages-site/; game route: DY/wanhu-simulator/');
