// Netlify build step: saves the live catalog as dist/catalog.json, the copy first-time visitors browse
// while the API is asleep (see src/lib/catalogCopy.ts). Never fails the build: without the API the
// deploy just ships without a copy, and visitors wait for the API as before.
import { writeFile } from 'node:fs/promises';

const source = process.env.CATALOG_COPY_URL ?? 'https://kafeshop-api.onrender.com/api/catalog/copy';
const target = new URL('../dist/catalog.json', import.meta.url);
const deadline = Date.now() + 4 * 60_000; // a sleeping API needs ~1 minute; a deploy in progress longer

for (let attempt = 1; ; attempt++) {
  try {
    const response = await fetch(source, { signal: AbortSignal.timeout(90_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const copy = JSON.parse(text);
    if (!Array.isArray(copy.products) || copy.products.length === 0) throw new Error('no products');
    await writeFile(target, text);
    console.log(`Catalog copy: ${copy.products.length} products (sync ${copy.lastSyncAt}).`);
    break;
  } catch (error) {
    if (Date.now() > deadline) {
      console.warn(`Catalog copy skipped: ${error.message}. The shop works without it.`);
      break;
    }
    console.log(`Catalog copy attempt ${attempt} failed (${error.message}); retrying...`);
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
}
