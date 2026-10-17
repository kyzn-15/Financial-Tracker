import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, EyeOff, FileSpreadsheet, Lock, Repeat, Shield } from 'lucide-react';
import { appPath, registerPath } from '../paths';
import { getPublicExchangeRate } from '../app/services/api';
import { useLightCanvas } from './useLightCanvas';
import logo from '../assets/logo.svg';
import dashboardShot from '../../../docs/images/02-dashboard.png';
import emergencyShot from '../../../docs/images/05-emergency-fund.png';
import receiptShot from '../../../docs/images/07-receipts.png';
import './landing.css';

const githubUrl = 'https://github.com/kyzn-15/Financial-Tracker';
const liveUrl = 'https://financial-tracker-pied-delta.vercel.app/app';

const features: Array<{
  title: string;
  body: string;
  visual: ReactNode;
}> = [
  {
    title: 'Dashboard',
    body: 'See spending trends without opening a spreadsheet.',
    visual: (
      <figure className="landing-frame">
        <img src={dashboardShot} alt="Dashboard with masked MYR balance and spending chart" width={1200} height={750} />
      </figure>
    ),
  },
  {
    title: 'Recurring',
    body: 'Never lose the bills that hit every month.',
    visual: <RecurringPreview />,
  },
  {
    title: 'Receipts',
    body: 'Keep proof attached to the transaction.',
    visual: (
      <figure className="landing-frame">
        <img src={receiptShot} alt="Receipt list with files kept beside each expense" width={1200} height={750} />
      </figure>
    ),
  },
  {
    title: 'Emergency fund',
    body: 'Plan the buffer before you need it.',
    visual: (
      <figure className="landing-frame">
        <img src={emergencyShot} alt="Emergency fund planner with masked savings" width={1200} height={750} />
      </figure>
    ),
  },
  {
    title: 'Backup',
    body: 'XLSX export and restore when you want an exit.',
    visual: <BackupPreview />,
  },
];

export default function LandingPage() {
  useLightCanvas();
  const [quoteMyr, setQuoteMyr] = useState(true);
  const [exchangeRate, setExchangeRate] = useState<{ myrToIdr: number; idrToMyr: number } | null>(null);

  useEffect(() => {
    const root = document.querySelector('.landing');
    if (!root) return;
    root.classList.add('js-ready');
    const nodes = root.querySelectorAll<HTMLElement>('.landing-reveal');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      nodes.forEach((node) => node.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.01, rootMargin: '0px 0px 80px 0px' });
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let isActive = true;

    getPublicExchangeRate()
      .then((rate) => {
        if (isActive) setExchangeRate(rate);
      })
      .catch(() => {
        if (isActive) setExchangeRate(null);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const myrAmount = quoteMyr ? 1 : exchangeRate?.idrToMyr;
  const idrAmount = quoteMyr ? exchangeRate?.myrToIdr : 1;
  const formatAmount = (amount: number | undefined, fractionDigits: number) => (
    amount == null ? '—' : amount.toLocaleString('en-US', {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
  );

  return (
    <div className="landing">
      <a className="landing-skip" href="#main">Skip to content</a>
      <header className="landing-nav-wrap">
        <nav className="landing-nav" aria-label="Primary">
          <Link className="landing-brand" to="/">
            <img src={logo} alt="" width={32} height={32} />
            Financial Tracker
          </Link>
          <div className="landing-nav__links">
            <a href="#features">Features</a>
            <a href="#dual-currency">Dual currency</a>
            <a href="#security">Security</a>
          </div>
          <div className="landing-nav__actions">
            <Link className="landing-btn landing-btn--secondary" to={appPath}>Open app</Link>
            <Link className="landing-btn landing-btn--primary" to={registerPath}>Create account</Link>
          </div>
        </nav>
      </header>
      <main className="landing-main" id="main">
        <section className="landing-section" aria-labelledby="hero-title">
          <div className="landing-wrap landing-hero__grid">
            <div>
              <p className="landing-kicker">MYR and IDR</p>
              <h1 id="hero-title">Track MYR & IDR in one calm dashboard.</h1>
              <p className="landing-lead">
                Expenses, recurrings, receipts, and emergency planning — with balances you can mask and data you can export.
              </p>
              <div className="landing-hero__actions">
                <Link className="landing-btn landing-btn--primary" to={registerPath}>Create account</Link>
                <Link className="landing-btn landing-btn--secondary" to={appPath}>Open app</Link>
              </div>
              <p className="landing-note">Your balances stay private. Export anytime.</p>
            </div>
            <div className="landing-stage">
              <div className="landing-frame">
                <img
                  src={dashboardShot}
                  alt="Dashboard with masked MYR balance and spending chart"
                  width={1200}
                  height={750}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--tight" aria-label="Product facts">
          <p className="landing-wrap landing-trust">Built for MYR + IDR · Multi-user · Exportable</p>
        </section>

        <section className="landing-section landing-reveal" aria-labelledby="problem-title">
          <div className="landing-wrap">
            <h2 id="problem-title">Two currencies. One messy notebook.</h2>
            <div className="landing-cards">
              <article className="landing-card">
                <h3>The bill next month</h3>
                <p>Rent and subscriptions slip when they live in a spreadsheet you open late.</p>
              </article>
              <article className="landing-card">
                <h3>Proof in another app</h3>
                <p>The receipt sits in a camera roll while the total sits somewhere else.</p>
              </article>
              <article className="landing-card">
                <h3>MYR in your head</h3>
                <p>The charge is in ringgit. The money you think in is rupiah. Or the other way around.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--alt landing-features landing-reveal" id="features" aria-labelledby="features-title">
          <div className="landing-wrap">
            <h2 id="features-title">The ledger, in pieces you already use.</h2>
            <div className="landing-features__grid">
              {features.map((feature) => (
                <article className="landing-feature" key={feature.title}>
                  <div className="landing-copy">
                    <h3>{feature.title}</h3>
                    <p>{feature.body}</p>
                  </div>
                  <div className="landing-visual">{feature.visual}</div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="landing-section landing-reveal" id="dual-currency" aria-labelledby="currency-title">
          <div className="landing-wrap landing-split">
            <div className="landing-copy">
              <h2 id="currency-title">One ledger, two currencies.</h2>
              <p>Log a cost in MYR or IDR. The other amount is stored with the rate from that moment, so history does not drift when the rate moves.</p>
            </div>
            <div>
              <div className="landing-currency">
                <div className="landing-field">
                  <span id="landing-myr-label">MYR</span>
                  <output aria-labelledby="landing-myr-label">{formatAmount(myrAmount, quoteMyr ? 2 : 6)}</output>
                </div>
                <button
                  className="landing-swap"
                  type="button"
                  aria-label={quoteMyr ? 'Show the IDR to MYR conversion' : 'Show the MYR to IDR conversion'}
                  onClick={() => setQuoteMyr((value) => !value)}
                >
                  <ArrowLeftRight size={18} aria-hidden="true" />
                </button>
                <div className="landing-field">
                  <span id="landing-idr-label">IDR</span>
                  <output aria-labelledby="landing-idr-label">{formatAmount(idrAmount, 2)}</output>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-section landing-section--alt landing-reveal" id="security" aria-labelledby="security-title">
          <div className="landing-wrap">
            <h2 id="security-title">Private by default.</h2>
            <div className="landing-cards">
              <article className="landing-card">
                <div className="landing-icon" aria-hidden="true"><EyeOff size={20} /></div>
                <h3>Balance masking</h3>
                <p>Hide amounts on the dashboard until you want them on screen.</p>
              </article>
              <article className="landing-card">
                <div className="landing-icon" aria-hidden="true"><Lock size={20} /></div>
                <h3>Secure sessions</h3>
                <p>Sign-in stays in an HttpOnly cookie. A new sign-in ends the previous one.</p>
              </article>
              <article className="landing-card">
                <div className="landing-icon" aria-hidden="true"><FileSpreadsheet size={20} /></div>
                <h3>Your export</h3>
                <p>Download an XLSX backup, or restore one, when you want a copy outside the app.</p>
              </article>
            </div>
            <p className="landing-aside">
              Deleted expenses sit in a Recycle Bin you can restore. Reset and account deletion both ask you to confirm before anything is removed.
            </p>
          </div>
        </section>

        <section className="landing-section landing-reveal" aria-labelledby="proof-title">
          <div className="landing-wrap">
            <h2 id="proof-title">A real app, not a slide.</h2>
            <p className="landing-lead">React on the client. Express on the API. libSQL for the ledger. Each account keeps its own records.</p>
            <div className="landing-proof">
              <span className="landing-pill">React + Express + libSQL</span>
              <span className="landing-pill">Multi-user accounts</span>
              <a href={liveUrl}>Live deployment</a>
              <a href={githubUrl}>GitHub</a>
            </div>
          </div>
        </section>

        <section className="landing-section landing-final landing-reveal" aria-labelledby="final-title">
          <div className="landing-wrap">
            <h2 id="final-title">Start with a calm ledger.</h2>
            <p className="landing-lead">Create an account when you are ready. The source stays public.</p>
            <div className="landing-final__actions">
              <Link className="landing-btn landing-btn--primary" to={registerPath}>Create account</Link>
              <a className="landing-btn landing-btn--secondary" href={githubUrl}>View source</a>
            </div>
          </div>
        </section>
      </main>
      <footer className="landing-footer">
        <div className="landing-footer__inner">
          <p>© {new Date().getFullYear()} Financial Tracker</p>
          <nav aria-label="Footer">
            <Link to={appPath}>Live app</Link>
            <a href={githubUrl}>GitHub</a>
            <a href="#features">Features</a>
          </nav>
        </div>
      </footer>
      <div className="landing-mobile-cta">
        <Link className="landing-btn landing-btn--primary" to={registerPath}>Create account</Link>
      </div>
    </div>
  );
}

function RecurringPreview() {
  const rows = [
    ['Rent', 'Monthly'],
    ['Internet', 'Monthly'],
    ['Transport', 'Weekly'],
  ];
  return (
    <div className="landing-widget" aria-hidden="true">
      <div className="landing-icon"><Repeat size={20} /></div>
      {rows.map(([name, cadence]) => (
        <div className="landing-widget__row" key={name}>
          <span>
            <span className="landing-widget__name">{name}</span>
            <span className="landing-widget__meta"> · {cadence}</span>
          </span>
          <span className="landing-widget__amount">RM ***</span>
        </div>
      ))}
    </div>
  );
}

function BackupPreview() {
  return (
    <div className="landing-widget landing-widget--backup" aria-hidden="true">
      <div className="landing-icon"><Shield size={20} /></div>
      <div className="landing-widget__row">
        <span className="landing-widget__name">ledger.xlsx</span>
        <span className="landing-widget__meta">Ready to export</span>
      </div>
      <div className="landing-widget__row">
        <span className="landing-widget__name">Expenses, receipts, fund</span>
        <span className="landing-widget__amount">***</span>
      </div>
    </div>
  );
}
