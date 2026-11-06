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
    const filePath = path.join(__dirname, cleanPath);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
      return;
    }

    const stat = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
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

export async function testCircuit(expId, port) {
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
  await page.waitForFunction(() => window.T && window.T.nodes && window.T.nodes.length > 0, { timeout: 20000 });

  const result = await page.evaluate(async (targetId) => {
    const lchip = document.getElementById('lchip');
    lchip.click();
    const item = document.querySelector(`[data-ex="${targetId}"]`);
    if (!item) return { ok: false, error: 'Experiment not found in modal: ' + targetId };
    item.click();

    // Close modal if open
    const closeBtn = document.querySelector('#wm .ft button');
    if (closeBtn) closeBtn.click();

    const T = window.T;
    const nodes = T.nodes;
    const nodeByKey = k => nodes.find(n => n.key === k);
    const swNode = idx => nodes.find(n => n.r && n.r[0] === 'sw' && n.r[1] === idx);
    const ledNode = idx => nodes.find(n => n.r && n.r[0] === 'led' && n.r[1] === idx);
    const v5Node = nodes.find(n => n.r && n.r[0] === 'v5');
    const gndNode = nodes.find(n => n.r && n.r[0] === 'gnd');

    // Breadboard spot for IC: B0_col20_A-E
    const icSpot = nodeByKey('B0_col20_A-E');
    if (!icSpot) return { ok: false, error: 'icSpot B0_col20_A-E not found' };

    if (targetId === 'sopnand') {
      T.addIC(7400, icSpot);
      const ic = T.ics[0];
      const pinNode = p => nodeByKey(T.pinKey(ic, p));

      // Power
      T.addWire(pinNode(14), v5Node);
      T.addWire(pinNode(7), gndNode);

      // Gate 1: x2 -> pin 1, x0 -> pin 2
      // Switches: x2 is switch 0, x1 is switch 1, x0 is switch 2
      T.addWire(swNode(0), pinNode(1));
      T.addWire(swNode(2), pinNode(2));

      // Verify guide successfully verified both wires and advanced past Step 3
      const gdText = document.getElementById('gd')?.innerText || '';
      if (!gdText.includes('Gate 2') && !gdText.includes('Step 4')) {
        return { ok: false, error: 'Guide failed to verify x0 wire on Step 3: ' + gdText.slice(0, 200) };
      }

      // Gate 2: x1 -> pin 4, pin 3 -> pin 5, pin 6 -> LED 0
      T.addWire(swNode(1), pinNode(4));
      T.addWire(pinNode(3), pinNode(5));
      T.addWire(pinNode(6), ledNode(0));

    } else if (targetId === 'posnor') {
      T.addIC(7402, icSpot);
      const ic = T.ics[0];
      const pinNode = p => nodeByKey(T.pinKey(ic, p));

      // Power
      T.addWire(pinNode(14), v5Node);
      T.addWire(pinNode(7), gndNode);

      // Gate 1 (inverter): x1 -> pin 2 and pin 3
      T.addWire(swNode(1), pinNode(2));
      T.addWire(pinNode(2), pinNode(3));

      // Gate 2: pin 1 -> pin 6, x0 -> pin 5
      T.addWire(pinNode(1), pinNode(6));
      T.addWire(swNode(2), pinNode(5));

      // Gate 3: pin 1 -> pin 8, x2 -> pin 9
      T.addWire(pinNode(1), pinNode(8));
      T.addWire(swNode(0), pinNode(9));

      // Gate 4: pin 4 -> pin 11, pin 10 -> pin 12, pin 13 -> LED 0
      T.addWire(pinNode(4), pinNode(11));
      T.addWire(pinNode(10), pinNode(12));
      T.addWire(pinNode(13), ledNode(0));
    }

    // Power ON
    T.pwr(true);

    // Wait a tick and run check
    await new Promise(r => setTimeout(r, 100));

    // Open check modal
    lchip.click();
    const chkBtn = document.querySelector('[data-act="check"]');
    if (chkBtn) chkBtn.click();
    else return { ok: false, error: 'Check button not found' };

    await new Promise(r => setTimeout(r, 100));

    const wm = document.getElementById('wm');
    const title = wm ? wm.querySelector('.hd span')?.textContent : '';
    const sub = wm ? wm.querySelector('.hd .s')?.textContent : '';
    const rows = wm ? wm.querySelectorAll('.bd tr').length : 0;
    const ok = (title.includes('verified') || sub.includes('verified')) && sub.includes('All 8 truth-table rows');

    return {
      ok,
      title,
      sub,
      rows,
      wmDisplay: wm ? wm.style.display : 'none'
    };
  }, expId);

  await browser.close();
  return { expId, result, errors };
}

async function runAll() {
  const { server, port } = await createStaticServer();
  console.log(`Static server running at http://127.0.0.1:${port}`);

  try {
    console.log('--- Testing SOP (NAND) Circuit ---');
    const sop = await testCircuit('sopnand', port);
    console.log('SOP Result:', JSON.stringify(sop, null, 2));

    console.log('--- Testing POS (NOR) Circuit ---');
    const pos = await testCircuit('posnor', port);
    console.log('POS Result:', JSON.stringify(pos, null, 2));

    if (!sop.result.ok || !pos.result.ok || sop.errors.length > 0 || pos.errors.length > 0) {
      console.error('VERIFICATION FAILED!');
      process.exit(1);
    }
    console.log('ALL CIRCUITS VERIFIED SUCCESSFULLY!');
  } finally {
    server.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runAll().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
