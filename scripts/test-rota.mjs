// Teste de ponta a ponta do mapa do rolê (navegador Chromium com GPS simulado).
// Uso: node scripts/test-rota.mjs [pasta-para-prints]
// Precisa do Playwright instalado (npm i -g playwright) e de internet para as ruas do mapa.
// Simula: iniciar, andar, arrastar o mapa e centralizar, pausar, retomar, falha de GPS, finalizar,
// reabrir pelo histórico, rolê antigo sem GPS e mapa sem internet.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

// require (e não import) para achar também um Playwright instalado globalmente (NODE_PATH).
const { chromium } = createRequire(import.meta.url)('playwright');
const SHOTS = process.argv[2] || null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webmanifest': 'application/json' };
const server = createServer((req, res) => {
  const f = join(process.cwd(), decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[extname(f)] || 'application/octet-stream' }); res.end(readFileSync(f));
}).listen(0);
const URL0 = `http://localhost:${server.address().port}/index.html`;

let fails = 0;
const ok = (c, msg) => { console.log(`${c ? '✔' : '✘'} ${msg}`); if (!c) fails++; };
const dist = (a, b) => { const R = 6371000, r = Math.PI / 180, dLat = (b[0] - a[0]) * r, dLon = (b[1] - a[1]) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(x)); };

// GPS falso: o app chama watchPosition e o teste manda os pontos com o horário que quiser.
const fakeGps = () => {
  const subs = new Map(); let n = 0;
  const geo = {
    watchPosition(ok) { subs.set(++n, ok); return n; }, clearWatch(id) { subs.delete(id); },
    getCurrentPosition(ok, no) { no && no({ code: 2 }); }
  };
  Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
  window.__gps = (lat, lon, t, acc = 5) => subs.forEach(cb => cb({ coords: { latitude: lat, longitude: lon, accuracy: acc, speed: null }, timestamp: t }));
  window.__gpsOn = () => subs.size;
};

const browser = await chromium.launch();
async function run(dark) {
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: dark ? 'dark' : 'light', hasTouch: false });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(fakeGps);
  // Viagens antigas: uma sem campo route (versão antiga) e uma manual.
  await page.addInitScript(() => {
    if (localStorage.getItem('motokm:v1')) return;
    localStorage.setItem('motokm:v1', JSON.stringify({ trips: [
      { id: 1, start: Date.now() - 864e5 * 3, end: Date.now() - 864e5 * 3 + 1800e3, km: 7.2, movingSec: 1500, maxKmh: 41, dashStart: 5, dashEnd: 4, estKm: 0.8 },
      { id: 2, start: Date.now() - 864e5 * 2, end: Date.now() - 864e5 * 2, km: 3, movingSec: 0, maxKmh: 0, dashStart: 4, dashEnd: 4, route: [], manual: true }
    ] }));
  });
  await page.goto(URL0);
  const tag = dark ? 'escuro' : 'claro';
  console.log(`\n— Tema ${tag} —`);

  // 1. Começar rolê
  await page.click('#go');
  await page.waitForSelector('#liveMap.leaflet-container', { timeout: 10000 });
  ok(true, 'Bora rodar abre a tela Rodando com o mapa');
  await page.waitForFunction(() => window.__gpsOn() > 0);

  // 2. Andar ~25 m a cada 3 s por uma avenida (Av. Paulista, SP), ~30 km/h
  let t = Date.now(); const pts = [];
  let lat = -23.5614, lon = -46.6559;
  const step = async (dLat, dLon, dt = 3000, acc = 5) => { lat += dLat; lon += dLon; t += dt; pts.push([lat, lon]); await page.evaluate(([a, b, c, d]) => window.__gps(a, b, c, d), [lat, lon, t, acc]); };
  pts.push([lat, lon]); await page.evaluate(([a, b, c]) => window.__gps(a, b, c), [lat, lon, t]);
  for (let i = 0; i < 12; i++) await step(0.00016, 0.00016);
  await page.waitForTimeout(400);
  let expected = 0; for (let i = 1; i < pts.length; i++) expected += dist(pts[i - 1], pts[i]);
  const km1 = await page.evaluate(() => S.active.m);
  ok(Math.abs(km1 - expected) < 1, `distância medida igual à soma dos pontos (${km1.toFixed(1)} m ≈ ${expected.toFixed(1)} m)`);
  const live1 = await page.evaluate(() => ({ route: S.active.route.length, paths: document.querySelectorAll('#liveMap path.leaflet-interactive, #liveMap svg path').length,
    me: !!document.querySelector('#liveMap .me-dot'), center: (({ lat, lng }) => [lat, lng])(live.c.map.getCenter()), last: S.active.last }));
  ok(live1.route >= 12, `rota gravada com ${live1.route} pontos aceitos`);
  ok(live1.paths >= 2, 'linha verde (com contorno) desenhada no mapa ao vivo');
  ok(live1.me, 'marcador da posição atual aparece');
  await page.waitForTimeout(700);
  const c1 = await page.evaluate(() => (({ lat, lng }) => [lat, lng])(live.c.map.getCenter()));
  ok(dist(c1, live1.last) < 30, `mapa acompanha a posição (centro a ${dist(c1, live1.last).toFixed(0)} m)`);
  // ponto com precisão ruim é ignorado (mesma regra do app)
  const before = await page.evaluate(() => S.active.route.length);
  await page.evaluate(([a, b, c]) => window.__gps(a, b, c, 80), [lat + 0.001, lon, t + 3000]);
  ok(await page.evaluate(n => S.active.route.length === n && S.active.gps === 'fraco', before), 'ponto com sinal fraco não entra no trajeto');
  await page.waitForTimeout(3500);   // ruas carregarem
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/1-rodando-${tag}.png` });

  // 3. Arrastar o mapa: para de seguir e mostra Centralizar
  const box = await page.locator('#liveMap').boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down(); await page.mouse.move(box.x + 60, box.y + 40, { steps: 8 }); await page.mouse.up();
  ok(await page.isVisible('#recenter'), 'arrastar o mapa deixa explorar e mostra o botão Centralizar');
  await step(0.00016, 0.00016);
  await page.waitForTimeout(700);
  const c2 = await page.evaluate(() => (({ lat, lng }) => [lat, lng])(live.c.map.getCenter()));
  ok(dist(c2, [lat, lon]) > 60, 'mapa não puxa de volta enquanto a pessoa explora');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/2-explorando-${tag}.png` });
  await page.click('#recenter');
  await page.waitForTimeout(500);
  const c3 = await page.evaluate(() => (({ lat, lng }) => [lat, lng])(live.c.map.getCenter()));
  ok(!(await page.isVisible('#recenter')) && dist(c3, [lat, lon]) < 30, 'Centralizar volta a seguir a posição');
  ok(await page.isVisible('#end') && await page.isVisible('#pause'), 'Encerrar e Pausar visíveis com o mapa');

  // 4. Pausar: GPS desliga, pontos ignorados; mapa continua
  await page.click('#pause');
  await page.waitForSelector('#liveMap.leaflet-container');
  ok(await page.evaluate(() => window.__gpsOn() === 0), 'pausa desliga o GPS');
  ok(await page.isVisible('#resume') && await page.isVisible('#end'), 'Retomar e Encerrar visíveis na pausa');
  ok(await page.evaluate(() => !!document.querySelector('#liveMap .me-dot.paused')), 'marcador fica cinza na pausa');
  const mPause = await page.evaluate(() => S.active.m);
  // 5. Retomar longe dali (~250 m): não liga os pontos nem soma a distância da pausa
  await page.click('#resume');
  await page.waitForFunction(() => window.__gpsOn() > 0);
  t += 120000; lat += 0.0016; lon += 0.0016; pts.push([lat, lon]);
  await page.evaluate(([a, b, c]) => window.__gps(a, b, c), [lat, lon, t]);
  for (let i = 0; i < 6; i++) await step(0.00016, -0.00016);
  const afterResume = await page.evaluate(() => ({ m: S.active.m, breaks: S.active.breaks }));
  ok(afterResume.breaks?.some(b => b[1] === 'pausa'), 'trajeto marca o recomeço depois da pausa');
  ok(afterResume.m - mPause < 6 * 30, 'distância da pausa não foi somada');
  // 6. Falha de GPS: 60 s sem ponto e 400 m depois → somado em linha reta e marcado como estimado
  t += 60000; lat += 0.0036; pts.push([lat, lon]);
  await page.evaluate(([a, b, c]) => window.__gps(a, b, c), [lat, lon, t]);
  for (let i = 0; i < 5; i++) await step(0.00016, 0.00016);
  const st = await page.evaluate(() => ({ est: S.active.estM, breaks: S.active.breaks }));
  ok(st.est > 350 && st.breaks.some(b => b[1] === 'gps'), `trecho sem GPS estimado (${st.est.toFixed(0)} m) e marcado`);
  ok(await page.evaluate(() => [...document.querySelectorAll('#liveMap path')].some(p => p.getAttribute('stroke-dasharray'))), 'trecho estimado aparece pontilhado no mapa ao vivo');

  // 7. Finalizar
  const mFinal = await page.evaluate(() => S.active.m);
  await page.click('#end');
  await page.click('.sheet [data-pick="fim"][data-v="3"]');
  await page.click('.sheet [data-ok]');
  await page.waitForSelector('#sumMap.leaflet-container', { timeout: 10000 });
  const sum = await page.evaluate(() => { const t = S.trips[S.trips.length - 1]; return { t, start: !!document.querySelector('#sumMap .end-pin.start'), fin: !!document.querySelector('#sumMap .end-pin.finish'),
    dashed: [...document.querySelectorAll('#sumMap path')].some(p => p.getAttribute('stroke-dasharray')), key: !!document.querySelector('.map-key'),
    text: document.querySelector('#app').innerText }; });
  ok(Math.abs(sum.t.km * 1000 - mFinal) < 0.01, `rolê salvo com a mesma distância (${sum.t.km.toFixed(3)} km)`);
  ok(sum.start && sum.fin, 'mapa do rolê salvo tem marcadores de início e fim');
  ok(sum.dashed && sum.key, 'trecho estimado pontilhado e legenda no resumo');
  ok(/Duração/i.test(sum.text) && /Média/i.test(sum.text) && /Máxima/i.test(sum.text) && /Bateria/i.test(sum.text), 'duração, média, máxima e bateria continuam no resumo');
  ok(/estimados em linha reta/.test(sum.text), 'aviso de distância estimada continua');
  ok(sum.t.pausedSec > 0 && Math.abs((sum.t.end - sum.t.start) / 1000 - sum.t.pausedSec - await page.evaluate(() => tripSec(S.trips[S.trips.length - 1]))) < 0.01, 'tempo pausado fica fora da duração');
  const fit = await page.evaluate(() => { const m = maps[0].map, b = m.getBounds(), r = S.trips[S.trips.length - 1].route; return r.every(p => b.contains(p)); });
  ok(fit, 'mapa enquadra o percurso completo');
  await page.waitForTimeout(3500);
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/3-role-salvo-${tag}.png` });

  // 8. Fechar, reabrir pelo histórico
  await page.click('#closeSummary');
  await page.click('[data-tab="relatorio"]');
  await page.locator('.trip[data-trip]').first().click();
  await page.waitForSelector('#sumMap.leaflet-container', { timeout: 10000 });
  ok(await page.evaluate(() => document.querySelectorAll('#sumMap .end-pin').length === 2), 'reabrir pelo histórico mostra o mapa com o percurso salvo');
  await page.click('#closeSummary');
  ok(await page.evaluate(() => tab === 'relatorio'), 'Fechar volta para o histórico');
  // rolê antigo sem pontos de GPS
  await page.click('.trip[data-trip="1"]');
  const old = await page.evaluate(() => ({ map: !!document.querySelector('#sumMap'), txt: document.querySelector('#app').innerText }));
  ok(!old.map && /não tem pontos de GPS/.test(old.txt) && /7,20/.test(old.txt) && /estimados em linha reta/.test(old.txt), 'rolê antigo sem GPS: resumo preservado com mensagem');
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/4-role-antigo-sem-gps-${tag}.png` });
  await page.click('#closeSummary');
  await page.click('.trip[data-trip="2"]');
  ok(/adicionada à mão/.test(await page.innerText('#app')), 'viagem manual: mensagem própria');
  await page.click('#closeSummary');
  // aba Mapa continua funcionando
  await page.click('[data-tab="mapa"]');
  await page.waitForSelector('#map.leaflet-container', { timeout: 10000 });
  ok(await page.evaluate(() => document.querySelectorAll('#map path').length >= 2), 'aba Mapa continua mostrando os rolês');
  ok(errors.length === 0, `sem erros de JavaScript${errors.length ? ': ' + errors.join(' | ') : ''}`);
  await ctx.close();
}
await run(false);
await run(true);

// 9. Sem internet para as ruas, e sem a biblioteca do mapa
{
  const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(fakeGps);
  await page.addInitScript(() => localStorage.setItem('motokm:v1', JSON.stringify({ trips: [
    { id: 5, start: Date.now() - 3600e3, end: Date.now() - 1800e3, km: 1.2, movingSec: 900, maxKmh: 30, dashStart: 5, dashEnd: 4,
      route: [[-23.5614, -46.6559], [-23.5600, -46.6545], [-23.5590, -46.6530], [-23.5580, -46.6520]] }] })));
  await page.route(/openfreemap|openstreetmap/, r => r.abort());
  await page.goto(URL0);
  await page.click('.trip-open');
  await page.waitForSelector('#sumMap.leaflet-container');
  await page.waitForSelector('.map-note', { timeout: 10000 }).catch(() => {});
  ok(await page.isVisible('.map-note') && await page.evaluate(() => document.querySelectorAll('#sumMap .end-pin').length === 2), 'sem internet: aviso das ruas, trajeto e marcadores continuam');
  console.log('\n— Sem a biblioteca do mapa —');
  const p2 = await ctx.newPage();
  await p2.addInitScript(fakeGps);
  await p2.route(/vendor\/leaflet\/leaflet\.js/, r => r.abort());
  await p2.goto(URL0);
  await p2.click('.trip-open');
  await p2.waitForSelector('.sum-msg', { timeout: 10000 });
  const txt = await p2.innerText('#app');
  ok(/Não deu para carregar o mapa/.test(txt) && /1,20/.test(txt) && /Duração/i.test(txt), 'mapa não carrega: resumo do rolê preservado com mensagem');
  await p2.click('#closeSummary'); await p2.click('#go');
  await p2.waitForSelector('.live-msg', { timeout: 10000 });
  ok(await p2.isVisible('#end'), 'viagem continua medindo sem o mapa');
  await ctx.close();
}
await browser.close(); server.close();
console.log(fails ? `\n${fails} falha(s)` : '\nTudo certo');
process.exit(fails ? 1 : 0);
