// Versão do Moto KM. A fonte é o "version" do package.json.
//
//   node scripts/version.mjs sync         grava a versão no index.html (APP_VERSION) e no iOS (MARKETING_VERSION)
//   node scripts/version.mjs check        falha se o index.html ou o iOS tiverem outra versão
//   node scripts/version.mjs check --release   também exige a seção da versão no CHANGELOG.md
//   node scripts/version.mjs bump-build   soma 1 no build do iOS (CURRENT_PROJECT_VERSION), antes de distribuir
//   node scripts/version.mjs show         mostra versão e build
import { readFileSync, writeFileSync } from 'node:fs';

const PKG = 'package.json', HTML = 'index.html', PBX = 'ios/App/App.xcodeproj/project.pbxproj', LOG = 'CHANGELOG.md';
const version = JSON.parse(readFileSync(PKG, 'utf8')).version;
const RE_HTML = /const APP_VERSION = '([^']*)';/;
const RE_MKT = /MARKETING_VERSION = ([^;]+);/g;
const RE_BUILD = /CURRENT_PROJECT_VERSION = ([^;]+);/g;

if (!/^\d+\.\d+\.\d+$/.test(version)) fail(`package.json: versão "${version}" não está no formato MAJOR.MINOR.PATCH`);

const read = f => readFileSync(f, 'utf8');
const all = (re, txt) => [...txt.matchAll(re)].map(m => m[1].trim());
function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }

const [cmd = 'check', ...flags] = process.argv.slice(2);

if (cmd === 'sync') {
  let html = read(HTML);
  if (!RE_HTML.test(html)) fail(`${HTML}: não achei "const APP_VERSION = '...';"`);
  html = html.replace(RE_HTML, `const APP_VERSION = '${version}';`);
  writeFileSync(HTML, html);
  const pbx = read(PBX).replace(RE_MKT, `MARKETING_VERSION = ${version};`);
  writeFileSync(PBX, pbx);
  console.log(`✓ versão ${version} gravada em ${HTML} e ${PBX}`);
} else if (cmd === 'check') {
  const errs = [];
  const htmlV = read(HTML).match(RE_HTML)?.[1];
  if (htmlV !== version) errs.push(`${HTML} tem APP_VERSION ${htmlV ?? '(nenhuma)'}, package.json tem ${version}`);
  const mkt = all(RE_MKT, read(PBX));
  if (!mkt.length || mkt.some(v => v !== version)) errs.push(`${PBX} tem MARKETING_VERSION ${mkt.join(', ') || '(nenhuma)'}, package.json tem ${version}`);
  const builds = all(RE_BUILD, read(PBX));
  if (!builds.length || builds.some(b => !/^\d+$/.test(b)) || new Set(builds).size > 1) errs.push(`${PBX} tem CURRENT_PROJECT_VERSION inválido ou diferente entre Debug e Release: ${builds.join(', ')}`);
  if (flags.includes('--release') && !new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`, 'm').test(read(LOG)))
    errs.push(`${LOG} não tem a seção "## [${version}]"`);
  if (errs.length) fail(`versões divergentes:\n  - ${errs.join('\n  - ')}\nRode "npm run version:sync" (ou corrija o CHANGELOG) e tente de novo.`);
  console.log(`✓ versão ${version} (build ${builds[0]}) igual no package.json, ${HTML} e iOS`);
} else if (cmd === 'bump-build') {
  const pbx = read(PBX), builds = all(RE_BUILD, pbx).map(Number);
  if (!builds.length || builds.some(isNaN)) fail(`${PBX}: CURRENT_PROJECT_VERSION inválido`);
  const next = Math.max(...builds) + 1;
  writeFileSync(PBX, pbx.replace(RE_BUILD, `CURRENT_PROJECT_VERSION = ${next};`));
  console.log(`✓ build do iOS: ${next} (versão ${version} (${next}))`);
} else if (cmd === 'show') {
  console.log(`${version} (${all(RE_BUILD, read(PBX))[0]})`);
} else fail(`comando desconhecido: ${cmd}`);
