import { Link } from 'react-router-dom';
import { appPath, homePath } from '../paths';
import { useLightCanvas } from './useLightCanvas';
import './landing.css';

export default function NotFoundPage() {
  useLightCanvas();

  return (
    <div className="landing">
      <main className="landing-missing">
        <div className="landing-missing__card">
          <p className="landing-kicker">404</p>
          <h1>This page is not on the map.</h1>
          <p>The ledger lives in the app. The introduction lives on the home page.</p>
          <div className="landing-missing__actions">
            <Link className="landing-btn landing-btn--secondary" to={homePath}>Back home</Link>
            <Link className="landing-btn landing-btn--primary" to={appPath}>Open app</Link>
          </div>
        </div>
      </main>
    </div>
  );
}
