import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';

// Test the upload artifacts, including vendor code and every generated chunk.
// Run with npm run test:bsp to build the artifacts first.
const dist = resolve('dist');
const assets = await readdir(resolve(dist, 'assets'));

test('BSP scripts and styles survive legacy charset decoding', async () => {
  const textAssets = assets.filter(name => /\.(js|css)$/.test(name));
  assert.ok(textAssets.some(name => name.endsWith('.js')));
  assert.ok(textAssets.some(name => name.endsWith('.css')));
  for (const name of textAssets) {
    const bytes = await readFile(resolve(dist, 'assets', name));
    const nonAscii = bytes.findIndex(byte => byte > 127);
    assert.equal(nonAscii, -1, `${name} has a charset-sensitive byte at ${nonAscii}`);
    assert.equal(bytes.toString('utf8'), bytes.toString('latin1'), name);
  }
  const scripts = (await Promise.all(textAssets.filter(name => name.endsWith('.js'))
    .map(name => readFile(resolve(dist, 'assets', name), 'utf8')))).join('\n');
  // The screenshot's bullet, middle dot, and missing-equipment dash remain present.
  for (const code of ['2022', 'b7', '2014']) {
    assert.match(scripts, new RegExp(`\\\\(?:u0*${code}|x${code})(?![a-f0-9])`, 'i'));
  }
});

test('icons ship locally and asset URLs stay inside the nested BSP application', async () => {
  const html = await readFile(resolve(dist, 'index.html'), 'utf8');
  assert.doesNotMatch(html, /fonts\.googleapis\.com[^"']*Material\+Symbols/i);
  const base = new URL('https://sap.example/sap/bc/bsp/sap/zptw_app/');
  const htmlPaths = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"?]+)"/g)]
    .map(match => [match[1], base]);
  assert.ok(htmlPaths.length >= 2);
  const cssPaths = [];
  for (const name of assets.filter(name => name.endsWith('.css'))) {
    const css = await readFile(resolve(dist, 'assets', name), 'utf8');
    assert.match(css, /font-family:["']?Material Symbols Outlined/);
    assert.match(css, /font-feature-settings:["']liga["']/);
    const fontPaths = [...css.matchAll(/url\(["']?([^\)"']+\.woff2)["']?\)/g)];
    assert.ok(fontPaths.length > 0, 'Local icon font must be emitted');
    for (const match of fontPaths) {
      cssPaths.push([match[1], new URL(`assets/${name}`, base)]);
    }
  }
  for (const [path, parent] of [...htmlPaths, ...cssPaths]) {
    const url = new URL(path, parent);
    assert.ok(url.href.startsWith(base.href), `Asset escapes BSP path: ${path}`);
    const localPath = resolve(dist, url.pathname.slice(base.pathname.length));
    const bytes = await readFile(localPath);
    if (path.endsWith('.woff2')) {
      assert.equal(bytes.subarray(0, 4).toString('ascii'), 'wOF2');
    }
  }
});

test('SAP upload rules classify the icon font and logo as binary', async () => {
  const rules = (await readFile(resolve(dist, '.Ui5RepositoryBinaryFiles'), 'utf8'))
    .split(/\r?\n/).filter(line => line.trim()).map(line => new RegExp(line));
  const binaryFiles = [
    ...assets.filter(name => name.endsWith('.woff2')).map(name => `assets/${name}`),
    'GFL-Logo.webp',
  ];
  assert.ok(binaryFiles.some(name => name.endsWith('.woff2')));
  for (const name of binaryFiles) {
    await readFile(resolve(dist, name));
    // The filesystem uploader can supply Windows paths; OData archives use '/'.
    for (const path of [name, `D:\\App\\PTW\\dist\\${name.replaceAll('/', '\\')}`]) {
      assert.ok(rules.some(rule => rule.test(path)), `SAP would skip ${path}`);
    }
  }
  for (const name of ['index.html', 'assets/index.js', 'assets/index.css']) {
    assert.ok(!rules.some(rule => rule.test(name)), `Text must not be uploaded as binary: ${name}`);
  }
});
