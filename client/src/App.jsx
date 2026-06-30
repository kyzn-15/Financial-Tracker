import React, { useState } from 'react';
import './App.css';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ExpenseForm from './components/ExpenseForm';
import ExpenseList from './components/ExpenseList';
import FilterBar from './components/FilterBar';
import Dashboard from './components/Dashboard';
import Modal from './components/Modal';
import Toast from './components/Toast';
import ReceiptSaver from './components/ReceiptSaver';
import { useExpenses } from './hooks/useExpenses';
import { useReceipts } from './hooks/useReceipts';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // Default to dashboard for better first impression
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
  } = useExpenses();

  const {
    receipts,
    loading: receiptsLoading,
    error: receiptsError,
    saveReceipt,
    removeReceipt,
  } = useReceipts(activeTab);

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

  return (
    <div className="app-layout">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <div className="main-content">
        <Header exchangeRate={exchangeRate} activeTab={activeTab} />

        {/* API Error Toast */}
        {error && (
          <div style={{ color: 'var(--danger)', padding: '16px', background: 'var(--danger-soft)', borderRadius: 'var(--radius)', marginBottom: '24px', fontWeight: 'bold' }}>
            ⚠️ Error fetching data: {error}
          </div>
        )}

        {activeTab === 'receipts' && receiptsError && (
          <div style={{ color: 'var(--danger)', padding: '16px', background: 'var(--danger-soft)', borderRadius: 'var(--radius)', marginBottom: '24px', fontWeight: 'bold' }}>
            ⚠️ Error fetching receipts: {receiptsError}
          </div>
        )}

        {/* Main Content Area */}
        <div className="tab-content">
          {activeTab === 'add' && (
            <div className="neo-card" style={{ maxWidth: '640px', margin: '0 auto', marginTop: 'var(--space-md)' }}>
              <ExpenseForm onSubmit={handleAddSubmit} submitText="Add Expense" />
            </div>
          )}

          {activeTab === 'dashboard' && (
            <Dashboard summary={summary} />
          )}

          {activeTab === 'history' && (
            <>
              <FilterBar
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
            onSubmit={handleEditSubmit}
            initialData={editingExpense}
            submitText="Save Changes"
            isCancelable
            onCancel={() => setEditingExpense(null)}
          />
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
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', marginBottom: '24px' }}>
              This action cannot be undone.
            </p>
            <div className="modal-content__actions">
              <button
                className="neo-btn neo-btn--danger"
                style={{ flex: 1 }}
                onClick={handleDeleteConfirm}
              >
                Yes, Delete
              </button>
              <button
                className="neo-btn neo-btn--secondary"
                style={{ flex: 1 }}
                onClick={() => setDeletingExpense(null)}
              >
                Cancel
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
