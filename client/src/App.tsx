import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import './App.css';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ExpenseForm from './components/ExpenseForm';
import ExpenseList from './components/ExpenseList';
import FilterBar from './components/FilterBar';
import Dashboard from './components/Dashboard';
import LoginPage from './components/LoginPage';
import Modal from './components/Modal';
import Toast from './components/Toast';
import ReceiptSaver from './components/ReceiptSaver';
import EmergencyFundDashboard from './components/EmergencyFundDashboard';
import SettingsPage from './components/SettingsPage';
import { useRecurringExpenses } from './hooks/useRecurringExpenses';
import { useExpenses } from './hooks/useExpenses';
import { useReceipts } from './hooks/useReceipts';
import { useEmergencyFund } from './hooks/useEmergencyFund';
import { useCategories } from './hooks/useCategories';
import { useFolders } from './hooks/useFolders';
import { useRecycleBin } from './hooks/useRecycleBin';
import { PrivacyModeProvider } from './hooks/usePrivacyMode';
import * as api from './services/api';
import AppIcon from './components/AppIcon';
import type {
  AppTab,
  BackupPreferences,
  Currency,
  Expense,
  ExpenseInput,
  LoginCredentials,
  RecycleBinStore,
  Theme,
  ToastMessage,
  ToastType,
} from './types';
import { getErrorMessage } from './utils/errors';

const SESSION_HINT_KEY = 'financial-tracker-has-session';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [hasSessionHint] = useState(() => window.localStorage.getItem(SESSION_HINT_KEY) === 'true');
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [theme, setTheme] = useState<Theme>(() => (
    window.localStorage.getItem('financial-tracker-theme') === 'dark' ? 'dark' : 'light'
  ));

  useLayoutEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem('financial-tracker-theme', theme);
  }, [theme]);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      try {
        const session = await api.getSession();
        if (!isMounted) return;
        setIsAuthenticated(session.authenticated);
        setSessionExpiresAt(session.expiresAt ?? null);
        if (session.authenticated) {
          window.localStorage.setItem(SESSION_HINT_KEY, 'true');
        } else {
          window.localStorage.removeItem(SESSION_HINT_KEY);
        }
      } catch {
        if (!isMounted) return;
        setIsAuthenticated(false);
        setSessionExpiresAt(null);
        window.localStorage.removeItem(SESSION_HINT_KEY);
      } finally {
        if (isMounted) setIsCheckingSession(false);
      }
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!sessionExpiresAt) return undefined;

    const remainingSession = sessionExpiresAt - Date.now();
    if (remainingSession <= 0) {
      setIsAuthenticated(false);
      setSessionExpiresAt(null);
      window.localStorage.removeItem(SESSION_HINT_KEY);
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setIsAuthenticated(false);
      setSessionExpiresAt(null);
      window.localStorage.removeItem(SESSION_HINT_KEY);
    }, remainingSession);

    return () => window.clearTimeout(timeoutId);
  }, [sessionExpiresAt]);

  const handleLogin = async ({ username, pin }: LoginCredentials): Promise<void> => {
    await api.login(username, pin);
    const session = await api.getSession();
    setIsAuthenticated(session.authenticated);
    setSessionExpiresAt(session.expiresAt ?? null);
    if (session.authenticated) {
      window.localStorage.setItem(SESSION_HINT_KEY, 'true');
    } else {
      window.localStorage.removeItem(SESSION_HINT_KEY);
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Local state still resets so a stale client session cannot keep the app open.
    } finally {
      setIsAuthenticated(false);
      setSessionExpiresAt(null);
      window.localStorage.removeItem(SESSION_HINT_KEY);
    }
  };

  if (isCheckingSession) {
    return hasSessionHint ? <AppSkeleton /> : <LoginSkeleton />;
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <PrivacyModeProvider><AuthenticatedApp onLogout={handleLogout} sessionExpiresAt={sessionExpiresAt} theme={theme} onThemeChange={setTheme} /></PrivacyModeProvider>;
}

function SkeletonLine({ className = '' }: { className?: string }) {
  return <span className={`skeleton-line ${className}`} aria-hidden="true" />;
}

function LoginSkeleton() {
  return (
    <main className="login-shell" aria-busy="true" aria-label="Loading sign in">
      <section className="login-panel login-skeleton">
        <span className="login-skeleton__brand skeleton-block" aria-hidden="true" />
        <div className="login-skeleton__copy">
          <SkeletonLine className="skeleton-line--title login-skeleton__title" />
          <SkeletonLine className="skeleton-line--subtitle" />
        </div>
        <SkeletonLine className="login-skeleton__label" />
        <span className="login-skeleton__input skeleton-block" aria-hidden="true" />
        <span className="login-skeleton__button skeleton-block" aria-hidden="true" />
      </section>
    </main>
  );
}

function AppSkeleton() {
  return (
    <div className="app-layout app-skeleton" aria-busy="true" aria-label="Loading dashboard">
      <aside className="sidebar app-skeleton__sidebar">
        <div className="sidebar__brand">
          <span className="app-skeleton__logo skeleton-block" aria-hidden="true" />
          <div className="app-skeleton__brand-copy">
            <SkeletonLine className="skeleton-line--brand" />
            <SkeletonLine className="skeleton-line--small" />
          </div>
        </div>
        <div className="app-skeleton__nav">
          {Array.from({ length: 4 }).map((_, index) => <SkeletonLine key={index} />)}
        </div>
      </aside>
      <main className="main-content app-skeleton__content">
        <header className="app-skeleton__header">
          <div><SkeletonLine className="skeleton-line--title" /><SkeletonLine className="skeleton-line--subtitle" /></div>
          <SkeletonLine className="app-skeleton__header-action" />
        </header>
        <section className="app-skeleton__summary">
          {Array.from({ length: 3 }).map((_, index) => (
            <article className="neo-card app-skeleton__summary-card" key={index}>
              <SkeletonLine className="skeleton-line--small" />
              <SkeletonLine className="skeleton-line--amount" />
              <SkeletonLine className="skeleton-line--small" />
            </article>
          ))}
        </section>
        <section className="app-skeleton__charts">
          <article className="neo-card app-skeleton__chart"><SkeletonLine className="skeleton-line--section" /><span className="app-skeleton__chart-shape skeleton-block" /></article>
          <article className="neo-card app-skeleton__chart"><SkeletonLine className="skeleton-line--section" /><span className="app-skeleton__chart-shape skeleton-block" /></article>
        </section>
      </main>
    </div>
  );
}

interface AuthenticatedAppProps {
  onLogout: () => Promise<void>;
  sessionExpiresAt: number | null;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
}

function AuthenticatedApp({ onLogout, sessionExpiresAt, theme, onThemeChange }: AuthenticatedAppProps) {
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard'); // Default to dashboard for better first impression
  const [currency, setCurrency] = useState<Currency>('MYR');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [backupPreferences, setBackupPreferences] = useState<BackupPreferences | null>(null);
  const [isBackupReminderOpen, setIsBackupReminderOpen] = useState(false);
  const [isSavingBackupPreferences, setIsSavingBackupPreferences] = useState(false);
  const {
    expenses,
    summary,
    exchangeRate,
    loading,
    error,
    filters,
    addExpense,
    editExpense,
    removeExpense,
    updateFilters,
    updateSort,
    clearFilters,
    refresh: refreshExpenses,
  } = useExpenses();

  const categoryStore = useCategories();
  const folderStore = useFolders();
  const categoryNames = categoryStore.categories.map((category) => category.name);
  const recurringStore = useRecurringExpenses();

  const {
    receipts,
    loading: receiptsLoading,
    error: receiptsError,
    saveReceipt,
    removeReceipt,
    refreshReceipts,
  } = useReceipts(activeTab);

  const emergency = useEmergencyFund(activeTab);
  const recycleBin = useRecycleBin();

  // Recycle Bin restores/purges change active data, so refresh affected features.
  const recycleBinStore = useMemo<RecycleBinStore>(() => ({
    ...recycleBin,
    restoreExpense: async (id: number) => {
      await recycleBin.restoreExpense(id);
      await Promise.all([refreshExpenses(), emergency.refresh()]);
    },
    purgeExpense: async (id: number) => {
      await recycleBin.purgeExpense(id);
      await Promise.all([refreshExpenses(), emergency.refresh()]);
    },
    restoreReceipt: (id: number) => recycleBin.restoreReceipt(id),
    purgeReceipt: async (id: number) => {
      await recycleBin.purgeReceipt(id);
      await refreshReceipts();
    },
    emptyBin: async () => {
      const result = await recycleBin.emptyBin();
      await Promise.all([refreshExpenses(), emergency.refresh()]);
      return result;
    },
  }), [recycleBin, refreshExpenses, refreshReceipts, emergency]);

  useEffect(() => {
    let isMounted = true;
    const reminderSessionKey = `financial-tracker-backup-reminder-dismissed:${sessionExpiresAt}`;

    async function loadBackupPreferences() {
      try {
        const preferences = await api.getBackupPreferences();
        if (!isMounted) return;
        setBackupPreferences(preferences);
        setIsBackupReminderOpen(
          preferences.reminder_due && !window.sessionStorage.getItem(reminderSessionKey)
        );
      } catch (err) {
        if (isMounted) showToast(`Failed to load backup reminder: ${getErrorMessage(err, 'Unknown error')}`, 'error');
      }
    }

    loadBackupPreferences();
    return () => {
      isMounted = false;
    };
  }, [sessionExpiresAt]);

  // Toast notifications state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  
  // Modals state
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<Expense | null>(null);

  const showToast = (message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type, isExiting: false }]);
    
    // Trigger slide-out animation 300ms before removing
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isExiting: true } : t))
      );
    }, 3700);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const handleCloseToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Form handlers
  const handleAddSubmit = async (data: ExpenseInput): Promise<void> => {
    try {
      const created = await addExpense(data);
      await recurringStore.refresh();
      await emergency.refresh();
      showToast(`Added expense "${created.name}" successfully!`, 'success');
      setActiveTab('history');
    } catch (err) {
      showToast(`Failed to add expense: ${getErrorMessage(err, 'Unknown error')}`, 'error');
      throw err;
    }
  };

  const handleEditSubmit = async (data: ExpenseInput): Promise<void> => {
    if (!editingExpense) return;
    try {
      const updated = await editExpense(editingExpense.id, data);
      await emergency.refresh();
      showToast(`Updated expense "${updated.name}" successfully!`, 'success');
      setEditingExpense(null);
    } catch (err) {
      showToast(`Failed to update expense: ${getErrorMessage(err, 'Unknown error')}`, 'error');
      throw err;
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingExpense) return;
    try {
      await removeExpense(deletingExpense.id);
      await emergency.refresh();
      showToast(`"${deletingExpense.name}" moved to the Recycle Bin. It will be permanently deleted after 7 days.`, 'success');
      setDeletingExpense(null);
    } catch (err) {
      showToast(`Failed to delete expense: ${getErrorMessage(err, 'Unknown error')}`, 'error');
    }
  };

  const handleReceiptUpload = async (file: File): Promise<void> => {
    try {
      await saveReceipt(file);
      showToast('Receipt saved! It will be removed automatically after 7 days.', 'success');
    } catch (err) {
      showToast(`Failed to save receipt: ${getErrorMessage(err, 'Unknown error')}`, 'error');
      throw err;
    }
  };

  const handleReceiptDelete = async (id: number): Promise<void> => {
    try {
      await removeReceipt(id);
      showToast('Receipt moved to the Recycle Bin. It will be permanently deleted after 7 days.', 'success');
    } catch (err) {
      showToast(`Failed to delete receipt: ${getErrorMessage(err, 'Unknown error')}`, 'error');
      throw err;
    }
  };

  const handleExportRecords = async () => {
    setIsExporting(true);
    try {
      const { blob, filename } = await api.exportRecords();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      const preferences = await api.recordBackup();
      setBackupPreferences(preferences);
      setIsBackupReminderOpen(false);
      showToast('Exported database backup successfully.', 'success');
    } catch (err) {
      showToast(`Failed to export database backup: ${getErrorMessage(err, 'Unknown error')}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      showToast('Choose an XLSX database backup created by Financial Tracker.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('Database backup must be 10 MB or smaller.', 'error');
      return;
    }
    setPendingImportFile(file);
  };

  const handleImportConfirm = async () => {
    if (!pendingImportFile) return;
    setIsImporting(true);
    try {
      const result = await api.importRecords(pendingImportFile);
      setPendingImportFile(null);
      clearFilters();
      const refreshResults = await Promise.allSettled([
        refreshExpenses(),
        categoryStore.refresh(),
        recurringStore.refresh(),
        refreshReceipts(),
        emergency.refresh(),
        api.getBackupPreferences(),
      ]);
      const preferencesResult = refreshResults[5];
      if (preferencesResult.status === 'fulfilled') {
        setBackupPreferences(preferencesResult.value);
      }
      setIsBackupReminderOpen(false);
      showToast(`Imported ${result.row_count} database rows from ${result.table_count} tables.`, 'success');
    } catch (err) {
      showToast(`Database import stopped: ${getErrorMessage(err, 'Unknown error')}`, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveBackupInterval = async (reminderIntervalDays: number): Promise<BackupPreferences> => {
    setIsSavingBackupPreferences(true);
    try {
      const preferences = await api.updateBackupPreferences(reminderIntervalDays);
      setBackupPreferences(preferences);
      return preferences;
    } finally {
      setIsSavingBackupPreferences(false);
    }
  };

  const handleResetLastBackup = async (): Promise<BackupPreferences> => {
    setIsSavingBackupPreferences(true);
    try {
      const preferences = await api.resetLastBackup();
      setBackupPreferences(preferences);
      setIsBackupReminderOpen(false);
      return preferences;
    } finally {
      setIsSavingBackupPreferences(false);
    }
  };

  const handleResetApp = async (resetToken: string, pin: string): Promise<void> => {
    await api.resetAppData(resetToken, pin);
    window.sessionStorage.removeItem(`financial-tracker-backup-reminder-dismissed:${sessionExpiresAt}`);
    window.localStorage.removeItem('financial-tracker-theme');
    onThemeChange('light');
    await onLogout();
  };

  const syncCategoryChange = async <T,>(mutation: () => Promise<T>): Promise<T> => {
    const result = await mutation();
    updateFilters({ category: '' });
    await Promise.all([refreshExpenses(), emergency.refresh()]);
    return result;
  };

  const handleRemindLater = () => {
    const reminderSessionKey = `financial-tracker-backup-reminder-dismissed:${sessionExpiresAt}`;
    window.sessionStorage.setItem(reminderSessionKey, 'true');
    setIsBackupReminderOpen(false);
  };

  const handleViewHeatmapExpenses = (date: string) => {
    updateFilters({
      name: '',
      category: '',
      startDate: `${date}T00:00:00+08:00`,
      endDate: `${date}T23:59:59+08:00`,
    });
    setActiveTab('history');
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    window.sessionStorage.removeItem(`financial-tracker-backup-reminder-dismissed:${sessionExpiresAt}`);
    await onLogout();
  };

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="main-content">
        <Header
          exchangeRate={exchangeRate}
          activeTab={activeTab}
          currency={currency}
          onCurrencyChange={setCurrency}
          onLogout={handleLogout}
          isLoggingOut={isLoggingOut}
        />

        {/* API Error Toast */}
        {error && (
          <div style={{ color: 'var(--danger)', padding: '16px', background: 'var(--danger-soft)', borderRadius: 'var(--radius)', marginBottom: '24px', fontWeight: 'bold' }}>
            <AppIcon name="alert" size={18} /> Error fetching data: {error}
          </div>
        )}

        {activeTab === 'receipts' && receiptsError && (
          <div style={{ color: 'var(--danger)', padding: '16px', background: 'var(--danger-soft)', borderRadius: 'var(--radius)', marginBottom: '24px', fontWeight: 'bold' }}>
            <AppIcon name="alert" size={18} /> Error fetching receipts: {receiptsError}
          </div>
        )}

        {/* Main Content Area */}
        <div className="tab-content">
          {activeTab === 'add' && (
            <div className="neo-card" style={{ maxWidth: '640px', margin: '0 auto', marginTop: 'var(--space-md)' }}>
              <ExpenseForm
                categories={categoryStore.categories}
                folders={folderStore.folders}
                exchangeRate={exchangeRate}
                onCreateFolder={folderStore.createFolder}
                onSubmit={handleAddSubmit}
                submitText="Add Expense"
              />
            </div>
          )}

          {activeTab === 'dashboard' && (
            <Dashboard
              summary={summary}
              currency={currency}
              exchangeRate={exchangeRate}
              onViewHeatmapExpenses={handleViewHeatmapExpenses}
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'history' && (
            <>
              <div className="history-actions">
                <input
                  ref={importInputRef}
                  className="sr-only"
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleImportFileSelection}
                />
                <button
                  className="neo-btn neo-btn--secondary"
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  disabled={isExporting || isImporting}
                >
                  {isImporting ? 'Importing...' : 'Import Database'}
                </button>
                <button className="neo-btn neo-btn--secondary" type="button" onClick={handleExportRecords} disabled={isExporting || isImporting}>
                  {isExporting ? 'Exporting...' : 'Export Database'}
                </button>
              </div>
              <FilterBar
                categories={categoryNames}
                folders={folderStore.folders}
                filters={filters}
                onChange={updateFilters}
                onClear={clearFilters}
              />
              {loading && expenses.length === 0 ? (
                <div className="loading-spinner">
                  <div className="loading-spinner__circle"></div>
                </div>
              ) : (
                <ExpenseList
                  expenses={expenses}
                  filters={filters}
                  currency={currency}
                  onSort={updateSort}
                  onEdit={setEditingExpense}
                  onDelete={setDeletingExpense}
                />
              )}
            </>
          )}

          {activeTab === 'receipts' && (
            <ReceiptSaver
              receipts={receipts}
              loading={receiptsLoading}
              onUpload={handleReceiptUpload}
              onDelete={handleReceiptDelete}
            />
          )}

          {activeTab === 'emergency' && (
            <EmergencyFundDashboard
              emergency={emergency}
              currency={currency}
              exchangeRate={exchangeRate}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsPage
              theme={theme}
              onThemeChange={onThemeChange}
              categoryStore={categoryStore}
              onAddCategory={(name) => syncCategoryChange(() => categoryStore.addCategory(name))}
              onRenameCategory={(id, name) => syncCategoryChange(() => categoryStore.renameCategory(id, name))}
              onRemoveCategory={(id) => syncCategoryChange(() => categoryStore.removeCategory(id))}
              onReorderCategories={(ids) => syncCategoryChange(() => categoryStore.reorderCategories(ids))}
              onUpdateCategoryAutomation={(id, enabled, frequency) => categoryStore.updateAutomation(id, enabled, frequency)}
              backupPreferences={backupPreferences}
              onSaveBackupInterval={handleSaveBackupInterval}
              onResetLastBackup={handleResetLastBackup}
              isSavingBackupPreferences={isSavingBackupPreferences}
              emergency={emergency}
              currency={currency}
              exchangeRate={exchangeRate}
              recurringStore={recurringStore}
              recycleBin={recycleBinStore}
              onCreateResetIntent={api.createResetIntent}
              onResetApp={handleResetApp}
              onNotify={showToast}
            />
          )}

        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        title="Edit Expense"
      >
        {editingExpense && (
          <ExpenseForm
            categories={categoryStore.categories}
            folders={folderStore.folders}
            exchangeRate={exchangeRate}
            onCreateFolder={folderStore.createFolder}
            onSubmit={handleEditSubmit}
            initialData={editingExpense}
            submitText="Save Changes"
            isCancelable
            onCancel={() => setEditingExpense(null)}
          />
        )}
      </Modal>

      <Modal
        isOpen={isBackupReminderOpen}
        onClose={() => setIsBackupReminderOpen(false)}
        title="Back up your data"
        showClose={false}
        dismissOnOverlayClick={false}
      >
        <div className="backup-reminder">
          <p>Your database is due for a manual backup. Export the XLSX file and store it somewhere safe.</p>
          <div className="modal-content__actions backup-reminder__actions">
            <button className="neo-btn neo-btn--primary" type="button" onClick={handleExportRecords} disabled={isExporting}>
              {isExporting ? 'Exporting...' : 'Export database now'}
            </button>
            <button className="neo-btn neo-btn--secondary" type="button" onClick={handleRemindLater} disabled={isExporting}>
              Remind me next time
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={!!pendingImportFile}
        onClose={() => {
          if (!isImporting) setPendingImportFile(null);
        }}
        title="Import Database Backup"
        dismissOnOverlayClick={!isImporting}
      >
        {pendingImportFile && (
          <div className="confirm-dialog">
            <p className="confirm-dialog__text">
              Import <span className="confirm-dialog__name">"{pendingImportFile.name}"</span>?
            </p>
            <p className="confirm-dialog__note">
              This replaces all current database records. The server will reject incompatible or modified workbook structures before changing any data.
            </p>
            <div className="confirm-dialog__actions">
              <button
                className="neo-btn neo-btn--secondary"
                type="button"
                onClick={() => setPendingImportFile(null)}
                disabled={isImporting}
              >
                Cancel
              </button>
              <button
                className="neo-btn neo-btn--danger"
                type="button"
                onClick={handleImportConfirm}
                disabled={isImporting}
              >
                {isImporting ? 'Importing...' : 'Replace Database'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deletingExpense}
        onClose={() => setDeletingExpense(null)}
        title="Delete Expense"
      >
        {deletingExpense && (
          <div className="confirm-dialog">
            <p className="confirm-dialog__text">
              Are you sure you want to delete the expense <span className="confirm-dialog__name">"{deletingExpense.name}"</span>?
            </p>
            <p className="confirm-dialog__note">
              {deletingExpense.recurring_rule_id
                ? 'This moves only this occurrence to the Recycle Bin. Future automated payments will continue from Settings.'
                : `"${deletingExpense.name}" will be moved to the Recycle Bin and can be restored for 7 days before it is permanently deleted.`}
            </p>
            <div className="confirm-dialog__actions">
              <button
                className="neo-btn neo-btn--secondary"
                type="button"
                onClick={() => setDeletingExpense(null)}
              >
                Cancel
              </button>
              <button
                className="neo-btn neo-btn--danger"
                type="button"
                onClick={handleDeleteConfirm}
              >
                Move to Recycle Bin
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Notifications Toast */}
      <Toast toasts={toasts} onClose={handleCloseToast} />
    </div>
  );
}


