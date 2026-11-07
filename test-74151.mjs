import { chromium } from 'playwright';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createStaticServer() {
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.glb': 'model/gltf-binary',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css'
  };

  const server = http.createServer((req, res) => {
    let cleanPath = req.url.split('?')[0];
    if (cleanPath === '/') cleanPath = '/index.html';
    if (cleanPath === '/_vercel/insights/script.js') {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end('/* vercel analytics mock */');
      return;
    }
    const filePath = path.join(__dirname, cleanPath);
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
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

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
    });
  });
}

async function run74151Tests() {
  const { server, port } = await createStaticServer();
  console.log(`Test server running at http://127.0.0.1:${port}`);

  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--enable-webgl', '--use-gl=angle']
  });

  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', err => errors.push(err.message));

  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.T && window.T.nodes?.length > 0, { timeout: 35000 });

  const testResults = await page.evaluate(async () => {
    const T = window.T;
    const nodes = T.nodes;
    const nodeByKey = k => nodes.find(n => n.key === k);
    const swNode = idx => nodes.find(n => n.r && n.r[0] === 'sw' && n.r[1] === idx);
    const ledNode = idx => nodes.find(n => n.r && n.r[0] === 'led' && n.r[1] === idx);
    const v5Node = nodes.find(n => n.r && n.r[0] === 'v5');
    const gndNode = nodes.find(n => n.r && n.r[0] === 'gnd');

    // 1. Check Toolbar button
    const btn74151 = document.querySelector('button[data-t="74151"]');
    if (!btn74151) return { ok: false, error: '74151 button not found in DOM' };
    const btnText = btn74151.textContent.trim();
    if (!btnText.includes('74151') || !btnText.includes('8-MUX')) {
      return { ok: false, error: '74151 button text invalid: ' + btnText };
    }

    // 2. Add 74151 IC on breadboard
    const spot = nodeByKey('B0_col20_A-E');
    T.addIC(74151, spot);
    const ic = T.ics[0];
    if (!ic || ic.t !== 74151) return { ok: false, error: 'Failed to place 74151 IC' };

    // Verify 16 pins mapping
    const pinKeys = [];
    for (let p = 1; p <= 16; p++) {
      pinKeys.push(T.pinKey(ic, p));
    }
    // Pin 1: col 60 - 20 = 40 on F-J
    // Pin 8: col 60 - 20 - 7 = 33 on F-J
    // Pin 9: col 20 + 16 - 9 = 27 on A-E
    // Pin 16: col 20 + 16 - 16 = 20 on A-E
    if (pinKeys[0] !== 'B0_col40_F-J') return { ok: false, error: 'Pin 1 mismatch: ' + pinKeys[0] };
    if (pinKeys[7] !== 'B0_col33_F-J') return { ok: false, error: 'Pin 8 mismatch: ' + pinKeys[7] };
    if (pinKeys[8] !== 'B0_col27_A-E') return { ok: false, error: 'Pin 9 mismatch: ' + pinKeys[8] };
    if (pinKeys[15] !== 'B0_col20_A-E') return { ok: false, error: 'Pin 16 mismatch: ' + pinKeys[15] };

    const pinNode = p => nodeByKey(T.pinKey(ic, p));

    // Power pins: Pin 16 (+5V), Pin 8 (GND)
    T.addWire(pinNode(16), v5Node);
    T.addWire(pinNode(8), gndNode);

    // Strobe / Enable: Pin 7 -> Switch 3
    T.addWire(pinNode(7), swNode(3));

    // Select pins:
    // S0 / A (pin 11) -> Switch 0
    // S1 / B (pin 10) -> Switch 1
    // S2 / C (pin 9)  -> Switch 2
    T.addWire(pinNode(11), swNode(0));
    T.addWire(pinNode(10), swNode(1));
    T.addWire(pinNode(9), swNode(2));

    // Data inputs test pattern: [D0..D7] = [1, 0, 1, 0, 0, 1, 0, 1]
    // D0 (pin 4)  = 1 (v5)
    // D1 (pin 3)  = 0 (gnd)
    // D2 (pin 2)  = 1 (v5)
    // D3 (pin 1)  = 0 (gnd)
    // D4 (pin 15) = 0 (gnd)
    // D5 (pin 14) = 1 (v5)
    // D6 (pin 13) = 0 (gnd)
    // D7 (pin 12) = 1 (v5)
    const dataPattern = [1, 0, 1, 0, 0, 1, 0, 1];
    const dataPins = [4, 3, 2, 1, 15, 14, 13, 12];
    dataPins.forEach((pin, i) => {
      T.addWire(pinNode(pin), dataPattern[i] ? v5Node : gndNode);
    });

    // Outputs:
    // Y (pin 5) -> LED 0
    // W (pin 6) -> LED 1
    T.addWire(pinNode(5), ledNode(0));
    T.addWire(pinNode(6), ledNode(1));

    // Power ON
    T.pwr(true);

    const stepResults = [];

    // Test 1: Strobe Low (Enabled) for all 8 combinations of select inputs
    T.sw[3] = 0; // Strobe active (LOW)
    for (let sel = 0; sel < 8; sel++) {
      const s0 = sel & 1;
      const s1 = (sel >> 1) & 1;
      const s2 = (sel >> 2) & 1;
      T.sw[0] = s0;
      T.sw[1] = s1;
      T.sw[2] = s2;
      T.sim();

      const y = ic.o['5'];
      const w = ic.o['6'];
      const expectedY = dataPattern[sel];
      const expectedW = 1 - expectedY;
      const pass = (y === expectedY) && (w === expectedW);
      stepResults.push({
        mode: 'enabled',
        sel,
        s2, s1, s0,
        expectedY, y,
        expectedW, w,
        pass
      });
      if (!pass) {
        return { ok: false, error: `Mismatch at sel=${sel}: expected Y=${expectedY}, W=${expectedW}; got Y=${y}, W=${w}`, stepResults };
      }
    }

    // Test 2: Strobe High (Disabled, G=1): Y must be 0, W must be 1 regardless of select
    T.sw[3] = 1; // Strobe disabled (HIGH)
    for (let sel = 0; sel < 8; sel++) {
      T.sw[0] = sel & 1;
      T.sw[1] = (sel >> 1) & 1;
      T.sw[2] = (sel >> 2) & 1;
      T.sim();

      const y = ic.o['5'];
      const w = ic.o['6'];
      const pass = (y === 0) && (w === 1);
      stepResults.push({
        mode: 'disabled',
        sel,
        expectedY: 0, y,
        expectedW: 1, w,
        pass
      });
      if (!pass) {
        return { ok: false, error: `Strobe disable failed at sel=${sel}: got Y=${y}, W=${w}`, stepResults };
      }
    }

    return {
      ok: true,
      pinKeys,
      btnText,
      totalSteps: stepResults.length,
      allPassed: stepResults.every(s => s.pass)
    };
  });

  console.log('74151 Logic Test Results:', JSON.stringify(testResults, null, 2));

  await browser.close();
  server.close();

  if (!testResults.ok || !testResults.allPassed || errors.length > 0) {
    console.error('74151 TESTS FAILED!', errors);
    process.exit(1);
  }
  console.log('74151 LOGIC AND PINOUT VERIFIED 100%!');
}

run74151Tests().catch(err => {
  console.error(err);
  process.exit(1);
});

