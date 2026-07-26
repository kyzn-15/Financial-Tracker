import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import * as api from './services/api';
import AppIcon from './components/AppIcon';

const SESSION_HINT_KEY = 'financial-tracker-has-session';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(null);
  const [theme, setTheme] = useState(() => (
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
        setSessionExpiresAt(session.expiresAt);
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

  const handleLogin = async ({ username, pin }) => {
    await api.login(username, pin);
    const session = await api.getSession();
    setIsAuthenticated(session.authenticated);
    setSessionExpiresAt(session.expiresAt);
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
    return (
      <main className="login-shell" aria-busy="true" aria-label="Checking session">
        <section className="login-panel">Checking session...</section>
      </main>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <AuthenticatedApp
      onLogout={handleLogout}
      sessionExpiresAt={sessionExpiresAt}
      theme={theme}
      onThemeChange={setTheme}
    />
  );
}

function AuthenticatedApp({ onLogout, sessionExpiresAt, theme, onThemeChange }) {
  const [activeTab, setActiveTab] = useState('dashboard'); // Default to dashboard for better first impression
  const [currency, setCurrency] = useState('MYR');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [pendingImportFile, setPendingImportFile] = useState(null);
  const importInputRef = useRef(null);
  const [backupPreferences, setBackupPreferences] = useState(null);
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
        if (isMounted) showToast(`Failed to load backup reminder: ${err.message}`, 'error');
      }
    }

    loadBackupPreferences();
    return () => {
      isMounted = false;
    };
  }, [sessionExpiresAt]);

  // Toast notifications state
  const [toasts, setToasts] = useState([]);
  
  // Modals state
  const [editingExpense, setEditingExpense] = useState(null);
  const [deletingExpense, setDeletingExpense] = useState(null);

  const showToast = (message, type = 'info') => {
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

  const handleCloseToast = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Form handlers
  const handleAddSubmit = async (data) => {
    try {
      const created = await addExpense(data);
      await recurringStore.refresh();
      await emergency.refresh();
      showToast(`Added expense "${created.name}" successfully!`, 'success');
      setActiveTab('history');
    } catch (err) {
      showToast(`Failed to add expense: ${err.message}`, 'error');
      throw err;
    }
  };

  const handleEditSubmit = async (data) => {
    try {
      const updated = await editExpense(editingExpense.id, data);
      await emergency.refresh();
      showToast(`Updated expense "${updated.name}" successfully!`, 'success');
      setEditingExpense(null);
    } catch (err) {
      showToast(`Failed to update expense: ${err.message}`, 'error');
      throw err;
    }
  };

  const handleDeleteConfirm = async () => {
    try {
      await removeExpense(deletingExpense.id);
      await emergency.refresh();
      showToast(`Deleted expense "${deletingExpense.name}" successfully!`, 'success');
      setDeletingExpense(null);
    } catch (err) {
      showToast(`Failed to delete expense: ${err.message}`, 'error');
    }
  };

  const handleReceiptUpload = async (file) => {
    try {
      await saveReceipt(file);
      showToast('Receipt saved! It will be removed automatically after 7 days.', 'success');
    } catch (err) {
      showToast(`Failed to save receipt: ${err.message}`, 'error');
      throw err;
    }
  };

  const handleReceiptDelete = async (id) => {
    try {
      await removeReceipt(id);
      showToast('Receipt deleted.', 'success');
    } catch (err) {
      showToast(`Failed to delete receipt: ${err.message}`, 'error');
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
      showToast(`Failed to export database backup: ${err.message}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportFileSelection = (event) => {
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
      showToast(`Database import stopped: ${err.message}`, 'error');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveBackupInterval = async (reminderIntervalDays) => {
    setIsSavingBackupPreferences(true);
    try {
      const preferences = await api.updateBackupPreferences(reminderIntervalDays);
      setBackupPreferences(preferences);
      return preferences;
    } finally {
      setIsSavingBackupPreferences(false);
    }
  };

  const handleResetLastBackup = async () => {
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

  const syncCategoryChange = async (mutation) => {
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

  const handleViewHeatmapExpenses = (date) => {
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
              <ExpenseForm categories={categoryStore.categories} onSubmit={handleAddSubmit} submitText="Add Expense" />
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
                  exchangeRate={exchangeRate}
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
                ? 'This removes only this occurrence. Future automated payments will continue from Settings.'
                : 'This action cannot be undone.'}
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
                Yes, Delete
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


