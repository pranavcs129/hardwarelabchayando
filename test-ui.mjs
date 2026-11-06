import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let cleanPath = req.url.split('?')[0];
  if (cleanPath === '/') cleanPath = '/index.html';
  const filePath = path.join(__dirname, cleanPath);
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end();
    return;
  }
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Access-Control-Allow-Origin': '*'
  });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle']
  });

  console.log('--- 1. Testing Quality Toggle and LocalStorage ---');
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.T && window.T.nodes?.length > 0, { timeout: 35000 });

  const qTest = await page.evaluate(async () => {
    const qbtn = document.getElementById('qbtn');
    const initialText = qbtn.textContent;
    const initialLS = localStorage.getItem('trainer_quality');

    // 1st click -> medium
    qbtn.click();
    const text1 = qbtn.textContent;
    const ls1 = localStorage.getItem('trainer_quality');
    const pr1 = window.__pr;
    const shadowMapSize1 = window.__keyLight ? window.__keyLight.shadow.mapSize.x : null;

    // 2nd click -> low
    qbtn.click();
    const text2 = qbtn.textContent;
    const ls2 = localStorage.getItem('trainer_quality');
    const pr2 = window.__pr;
    const castShadow2 = window.__keyLight ? window.__keyLight.castShadow : null;

    // 3rd click -> high
    qbtn.click();
    const text3 = qbtn.textContent;
    const ls3 = localStorage.getItem('trainer_quality');
    const pr3 = window.__pr;
    const shadowMapSize3 = window.__keyLight ? window.__keyLight.shadow.mapSize.x : null;

    return {
      initialText,
      initialLS,
      step1: { text: text1, ls: ls1, pr: pr1, shadowMapSize: shadowMapSize1 },
      step2: { text: text2, ls: ls2, pr: pr2, castShadow: castShadow2 },
      step3: { text: text3, ls: ls3, pr: pr3, shadowMapSize: shadowMapSize3 }
    };
  });
  console.log('Quality Toggle Results:', JSON.stringify(qTest, null, 2));

  console.log('--- 2. Testing Help Button and Modal ---');
  const helpTest = await page.evaluate(async () => {
    const helpbtn = document.getElementById('helpbtn');
    helpbtn.click();
    const wm = document.getElementById('wm');
    const visible = wm.style.display !== 'none';
    const title = wm.querySelector('.hd span')?.textContent;
    const body = wm.querySelector('.bd')?.innerHTML || '';

    // Close it
    const closeBtn = wm.querySelector('.ft button');
    closeBtn.click();
    const hiddenAfterClose = wm.style.display === 'none';

    return {
      visible,
      title,
      hiddenAfterClose,
      mentionsWire: body.includes('Wire Tool'),
      mentionsChips: body.includes('Logic ICs'),
      mentionsStorage: body.includes('Component Storage'),
      mentionsRemove: body.includes('Delete Tool'),
      mentionsUndo: body.includes('Undo Wire'),
      mentionsClear: body.includes('Clear All'),
      mentionsLab: body.includes('Lab Mode')
    };
  });
  console.log('Help Modal Results:', JSON.stringify(helpTest, null, 2));

  console.log('--- 2b. Testing Desktop Dock Centering and Fit ---');
  const desktopDock = await page.evaluate(() => {
    const bar = document.getElementById('bar');
    const r = bar.getBoundingClientRect();
    const chips = document.getElementById('bxchips');
    const lastChip = chips.lastElementChild;
    const lr = lastChip.getBoundingClientRect();
    const leftMargin = Math.round(r.left);
    const rightMargin = Math.round(window.innerWidth - r.right);
    return {
      barWidth: Math.round(r.width),
      leftMargin,
      rightMargin,
      unusedSpaceOnRight: Math.round(r.right - lr.right),
      isCentered: Math.abs(leftMargin - rightMargin) <= 3,
      noExcessSpace: (r.right - lr.right) < 20
    };
  });
  console.log('Desktop Dock Results:', JSON.stringify(desktopDock, null, 2));

  console.log('--- 3. Testing Mobile 400x800 Viewport ---');
  await page.setViewportSize({ width: 400, height: 800 });
  await page.waitForTimeout(200);

  const mobileLayout = await page.evaluate(() => {
    const bar = document.getElementById('bar');
    const r = bar.getBoundingClientRect();
    const st = document.getElementById('st');
    const qbtn = document.getElementById('qbtn');
    const helpbtn = document.getElementById('helpbtn');
    const lchip = document.getElementById('lchip');
    const leftMargin = Math.round(r.left);
    const rightMargin = Math.round(window.innerWidth - r.right);
    return {
      barVisible: !!bar && bar.offsetHeight > 0,
      isCentered: Math.abs(leftMargin - rightMargin) <= 2,
      stVisible: !!st && st.offsetHeight > 0,
      qbtnVisible: !!qbtn && qbtn.offsetWidth > 0,
      helpbtnVisible: !!helpbtn && helpbtn.offsetWidth > 0,
      lchipVisible: !!lchip && lchip.offsetWidth > 0,
      stText: st.textContent.trim(),
      barButtons: Array.from(bar.querySelectorAll('button')).map(b => b.textContent.trim())
    };
  });
  console.log('Mobile Layout Check (400x800):', JSON.stringify(mobileLayout, null, 2));

  console.log('--- 4. Checking Metadata and Manifest ---');
  const meta = await page.evaluate(() => {
    return {
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content,
      themeColor: document.querySelector('meta[name="theme-color"]')?.content,
      ogTitle: document.querySelector('meta[property="og:title"]')?.content,
      ogImage: document.querySelector('meta[property="og:image"]')?.content,
      manifest: document.querySelector('link[rel="manifest"]')?.getAttribute('href'),
      faviconSvg: document.querySelector('link[rel="icon"]')?.getAttribute('href')
    };
  });
  console.log('Page Meta:', JSON.stringify(meta, null, 2));

  const allPassed =
    qTest.step1.ls === 'medium' &&
    qTest.step2.ls === 'low' &&
    qTest.step3.ls === 'high' &&
    helpTest.visible &&
    helpTest.hiddenAfterClose &&
    helpTest.mentionsWire &&
    helpTest.mentionsChips &&
    helpTest.mentionsStorage &&
    helpTest.mentionsRemove &&
    helpTest.mentionsUndo &&
    helpTest.mentionsClear &&
    desktopDock.isCentered &&
    desktopDock.noExcessSpace &&
    mobileLayout.isCentered &&
    mobileLayout.barVisible &&
    mobileLayout.qbtnVisible &&
    mobileLayout.helpbtnVisible;

  if (!allPassed) {
    console.error('SOME CHECKS FAILED!');
    process.exit(1);
  }

  await browser.close();
  server.close();
  console.log('ALL FEATURE TESTS PASSED SUCCESSFULLY!');
});
