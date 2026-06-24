import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadEnv } from 'vite';

const ROOT = process.cwd();

function applyEnvFiles() {
  const mode = process.env.MODE ?? process.env.NODE_ENV ?? 'production';
  const env = loadEnv(mode, ROOT, '');

  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

applyEnvFiles();
const DIST_INDEX = join(ROOT, 'dist/index.html');
const DIST_OG_IMAGE = join(ROOT, 'dist/og-image.png');
const SERVER_ENTRY = join(ROOT, 'dist/server/entry-server.js');

function getPngDimensions(filePath) {
  const buffer = readFileSync(filePath);
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function normalizeSiteUrl(value) {
  return value.trim().replace(/\/+$/, '');
}

function resolveSiteUrl() {
  if (process.env.SITE_URL?.trim()) {
    return normalizeSiteUrl(process.env.SITE_URL);
  }

  if (process.env.VERCEL !== '1') {
    return '';
  }

  const host =
    process.env.VERCEL_ENV === 'production'
      ? process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
      : process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL;

  if (!host) {
    return '';
  }

  return normalizeSiteUrl(host.startsWith('http') ? host : `https://${host}`);
}

function injectDehydratedState(html, dehydratedState) {
  const stateScript = `<script>window.__REACT_QUERY_STATE__=${JSON.stringify(dehydratedState).replace(/</g, '\\u003c')}</script>`;
  return html.replace('<!--ssr-state-->', stateScript);
}

function injectAppHtml(html, appHtml) {
  if (html.includes('<!--ssr-outlet-->')) {
    return html.replace('<!--ssr-outlet-->', appHtml);
  }

  return html.replace('<div id="root"></div>', `<div id="root">${appHtml}</div>`);
}

async function prerender() {
  if (!existsSync(DIST_INDEX)) {
    console.error('dist/index.html not found. Run vite build first.');
    process.exit(1);
  }

  if (!existsSync(SERVER_ENTRY)) {
    console.error('dist/server/entry-server.js not found. Run vite build --ssr first.');
    process.exit(1);
  }

  const { render } = await import(pathToFileURL(SERVER_ENTRY).href);
  const { appHtml, dehydratedState } = await render();

  const siteUrl = resolveSiteUrl();

  let html = readFileSync(DIST_INDEX, 'utf8');
  html = injectAppHtml(html, appHtml);
  html = injectDehydratedState(html, dehydratedState);
  html = html.replaceAll('__SITE_URL__', siteUrl);

  if (existsSync(DIST_OG_IMAGE)) {
    const { width, height } = getPngDimensions(DIST_OG_IMAGE);
    html = html.replace(
      '<!-- OG_IMAGE_DIMENSIONS -->',
      [
        `<meta property="og:image:width" content="${width}" />`,
        `<meta property="og:image:height" content="${height}" />`,
      ].join('\n    ')
    );
  } else {
    html = html.replace('<!-- OG_IMAGE_DIMENSIONS -->', '');
  }

  writeFileSync(DIST_INDEX, html);

  console.log('Prerendered dist/index.html with SSR markup');

  if (siteUrl) {
    const source = process.env.SITE_URL?.trim()
      ? 'SITE_URL'
      : `Vercel (${process.env.VERCEL_ENV ?? 'unknown'})`;
    console.log(`Resolved site URL: ${siteUrl} [${source}]`);
  } else {
    console.warn(
      'No site URL resolved — OG and canonical URLs stay relative. Set SITE_URL locally, or deploy on Vercel.'
    );
  }

  process.exit(0);
}

prerender().catch((error) => {
  console.error(error);
  process.exit(1);
});
