/**
 * build-www.mjs — assemble the static web app into ./www for Capacitor.
 *
 * Capacitor copies `webDir` (./www) into the native projects. We keep the source
 * layout at the repo root (no bundler) and just copy the runtime assets into www
 * so native builds ship a clean tree without scaffolding/docs/scripts.
 *
 * Run via: npm run build:www   (then `npx cap copy`).
 * Cross-platform (pure Node) so it works on Windows, macOS, and Linux.
 */
import { rmSync, mkdirSync, cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const www = join(root, 'www');

// Runtime assets the app needs at load time. config.local.js is intentionally
// NOT copied — native builds provision per-station settings at runtime via the
// in-app SettingsScreen, so no key is baked into the package.
const ASSETS = [
  'index.html',
  'manifest.json',
  'styles.css',
  'sw.js',
  'app',
  'icons',
];

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

for (const a of ASSETS) {
  const src = join(root, a);
  if (!existsSync(src)) {
    console.warn(`[build-www] skip missing: ${a}`);
    continue;
  }
  cpSync(src, join(www, a), { recursive: true });
}

console.log('[build-www] www/ assembled');
