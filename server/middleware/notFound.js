import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const logoPath = join(dirname(fileURLToPath(import.meta.url)), '../assets/financial_app_logo.png');
const logoDataUri = `data:image/png;base64,${readFileSync(logoPath).toString('base64')}`;

const PAGE_STYLES = `
  :root {
    --bg: #ecf0f3;
    --shadow-light: #ffffff;
    --shadow-dark: #d1d9e6;
    --accent: rgb(74, 139, 194);
    --success: rgb(79, 226, 161);
    --text-primary: #2d3436;
    --text-secondary: #636e72;
    --glass-border: 1px solid rgba(255, 255, 255, 0.4);
    --radius-lg: 20px;
    --radius-xl: 24px;
    --radius-full: 9999px;
    --neo-out: 8px 8px 16px var(--shadow-dark), -8px -8px 16px var(--shadow-light);
    --neo-out-sm: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
    --neo-out-lg: 12px 12px 24px var(--shadow-dark), -12px -12px 24px var(--shadow-light);
    --neo-in: inset 4px 4px 8px var(--shadow-dark), inset -4px -4px 8px var(--shadow-light);
    --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    min-height: 100vh;
    font-family: var(--font-family);
    background: var(--bg);
    color: var(--text-primary);
  }

  .nf-shell {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: 24px;
  }

  .nf-panel {
    width: min(100%, 420px);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
    padding: 48px 32px;
    border-radius: var(--radius-xl);
    background: var(--bg);
    border: var(--glass-border);
    box-shadow: var(--neo-out-lg);
  }

  .nf-brand {
    width: 112px;
    height: 112px;
    display: grid;
    place-items: center;
    overflow: hidden;
    border-radius: 28px;
    background: var(--accent);
    box-shadow: var(--neo-out-sm);
  }

  .nf-brand img {
    width: 112%;
    height: 112%;
    object-fit: cover;
    display: block;
  }

  .nf-kicker {
    margin-top: 8px;
    color: var(--success);
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .nf-code {
    font-size: 5.5rem;
    line-height: 1;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: var(--text-primary);
    text-shadow: 6px 6px 12px var(--shadow-dark), -6px -6px 12px var(--shadow-light);
    user-select: none;
  }

  .nf-title {
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--text-primary);
  }

  .nf-text {
    max-width: 32ch;
    color: var(--text-secondary);
    font-size: 0.85rem;
    line-height: 1.55;
  }

  .nf-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 8px;
    padding: 14px 28px;
    border-radius: var(--radius-full);
    background: var(--accent);
    color: #ffffff;
    font-size: 0.85rem;
    font-weight: 700;
    text-decoration: none;
    box-shadow: var(--neo-out-sm);
    transition: filter 150ms ease, transform 150ms ease, box-shadow 150ms ease;
  }

  .nf-btn:hover {
    filter: brightness(1.07);
  }

  .nf-btn:active {
    transform: scale(0.97);
    box-shadow: var(--neo-in);
  }

  .nf-btn:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 3px;
  }

  @media (max-width: 480px) {
    .nf-panel { padding: 40px 24px; }
    .nf-brand { width: 96px; height: 96px; }
    .nf-code { font-size: 4.25rem; }
  }
`;

function getClientOrigin() {
  const firstOrigin = process.env.CLIENT_ORIGIN?.split(',')[0]?.trim();
  return firstOrigin || '/';
}

function escapeAttributeValue(value) {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderNotFoundPage() {
  const backTarget = escapeAttributeValue(getClientOrigin());
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>404 - Financial Tracker</title>
<style>${PAGE_STYLES}</style>
</head>
<body>
<main class="nf-shell">
  <section class="nf-panel" aria-labelledby="nf-title">
    <div class="nf-brand" aria-hidden="true">
      <img src="${logoDataUri}" alt="" width="112" height="112">
    </div>
    <p class="nf-kicker">Financial Tracker</p>
    <p class="nf-code" aria-hidden="true">404</p>
    <h1 id="nf-title" class="nf-title">Page not found</h1>
    <p class="nf-text">The page you are looking for does not exist or may have been moved.</p>
    <a class="nf-btn" href="${backTarget}">Back to FinTracker</a>
  </section>
</main>
</body>
</html>
`;
}

export function notFoundHandler(req, res) {
  if (req.path === '/api' || req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found.' });
  }

  return res
    .status(404)
    .set(
      'Content-Security-Policy',
      "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    )
    .type('html')
    .send(renderNotFoundPage());
}
