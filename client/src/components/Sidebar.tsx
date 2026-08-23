import AppIcon from './AppIcon';
import type { AppTab } from '../types';

interface SidebarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__icon"><AppIcon name="wallet" size={24} /></div>
        <div>
          <h1 className="sidebar__title">FinTracker</h1>
          <p className="sidebar__subtitle">Personal Manager</p>
        </div>
      </div>
      
      <nav className="sidebar__nav">
        <button
          className={`sidebar__nav-item sidebar__nav-item--cta ${activeTab === 'add' ? 'sidebar__nav-item--active' : ''}`}
          onClick={() => setActiveTab('add')}
        >
          <span className="sidebar__nav-icon"><AppIcon name="plus" /></span>
          <span>Add Expense</span>
        </button>
        <button
          className={`sidebar__nav-item ${activeTab === 'dashboard' ? 'sidebar__nav-item--active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <span className="sidebar__nav-icon"><AppIcon name="trend" /></span>
          <span>Dashboard</span>
        </button>
        <button
          className={`sidebar__nav-item ${activeTab === 'history' ? 'sidebar__nav-item--active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          <span className="sidebar__nav-icon"><AppIcon name="clipboard" /></span>
          <span>History</span>
        </button>
        <button
          className={`sidebar__nav-item ${activeTab === 'settings' ? 'sidebar__nav-item--active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <span className="sidebar__nav-icon"><AppIcon name="settings" /></span>
          <span>Settings</span>
        </button>
      </nav>
    </aside>
  );
}

