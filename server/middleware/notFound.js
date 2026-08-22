const PAGE_STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    min-height: 100vh;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #ecf0f3;
    color: #2d3436;
  }

  .nf-shell {
    min-height: 100vh;
    display: grid;
    place-items: center;
    padding: var(--space-lg, 24px);
  }

  .nf-panel {
    width: min(100%, 420px);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 16px;
    padding: 48px 32px;
    border-radius: 24px;
    background: #ecf0f3;
    border: 1px solid rgba(255, 255, 255, 0.4);
    box-shadow: 12px 12px 24px #d1d9e6, -12px -12px 24px #ffffff;
  }

  .nf-brand {
    width: 56px;
    height: 56px;
    display: grid;
    place-items: center;
    border-radius: 16px;
    background: rgb(74, 139, 194);
    color: #ffffff;
    font-size: 1.05rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    box-shadow: 4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff;
  }

  .nf-kicker {
    margin-top: 8px;
    color: rgb(79, 226, 161);
    font-size: 0.75rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .nf-code {
    font-size: 4rem;
    line-height: 1;
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #ecf0f3;
    text-shadow: 3px 3px 6px #ffffff, -3px -3px 6px #d1d9e6;
    user-select: none;
  }

  .nf-title {
    font-size: 1.5rem;
    font-weight: 800;
  }

  .nf-text {
    max-width: 32ch;
    color: #636e72;
    font-size: 0.85rem;
    line-height: 1.55;
  }

  .nf-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 8px;
    padding: 14px 28px;
    border-radius: 9999px;
    background: rgb(74, 139, 194);
    color: #ffffff;
    font-size: 0.85rem;
    font-weight: 700;
    text-decoration: none;
    box-shadow: 4px 4px 8px #d1d9e6, -4px -4px 8px #ffffff;
    transition: filter 150ms ease, transform 150ms ease, box-shadow 150ms ease;
  }

  .nf-btn:hover {
    filter: brightness(1.07);
  }

  .nf-btn:active {
    transform: scale(0.97);
    box-shadow: inset 4px 4px 8px rgba(0, 0, 0, 0.18), inset -4px -4px 8px rgba(255, 255, 255, 0.35);
  }

  .nf-btn:focus-visible {
    outline: 2px solid rgb(74, 139, 194);
    outline-offset: 3px;
  }

  @media (max-width: 480px) {
    .nf-panel { padding: 40px 24px; }
    .nf-code { font-size: 3.25rem; }
  }

  @media (prefers-color-scheme: dark) {
    body { background: #20252b; color: #edf2f7; }

    .nf-panel {
      background: #20252b;
      border: 1px solid rgba(255, 255, 255, 0.08);
      box-shadow: 12px 12px 24px #15191e, -12px -12px 24px #2c333b;
    }

    .nf-brand { background: #69aee4; box-shadow: 4px 4px 8px #15191e, -4px -4px 8px #2c333b; }
    .nf-kicker { color: #62e6ad; }

    .nf-code {
      color: #20252b;
      text-shadow: 3px 3px 6px #2c333b, -3px -3px 6px #15191e;
    }

    .nf-text { color: #bcc6cf; }
    .nf-btn { background: #69aee4; box-shadow: 4px 4px 8px #15191e, -4px -4px 8px #2c333b; }
    .nf-btn:focus-visible { outline-color: #69aee4; }
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
    <div class="nf-brand" aria-hidden="true">FT</div>
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
      "default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    )
    .type('html')
    .send(renderNotFoundPage());
}
