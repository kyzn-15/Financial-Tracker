import { useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { formatDateTime } from '../utils/formatters';
import { getReceiptImageUrl } from '../services/api';
import AppIcon from './AppIcon';
import type { Receipt } from '../types';
import { getErrorMessage } from '../utils/errors';

function daysUntilExpiry(expiresAt: string): number {
  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

interface ReceiptSaverProps {
  receipts: Receipt[];
  loading: boolean;
  onUpload: (file: File) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export default function ReceiptSaver({
  receipts,
  loading,
  onUpload,
  onDelete,
}: ReceiptSaverProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const clearPreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValidationError('');
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setValidationError('Please choose an image file.');
      clearPreview();
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setValidationError('Image must be 10 MB or smaller.');
      clearPreview();
      return;
    }

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setValidationError('Take or choose a receipt photo first.');
      return;
    }

    setUploading(true);
    setValidationError('');
    try {
      await onUpload(selectedFile);
      clearPreview();
    } catch (err) {
      setValidationError(getErrorMessage(err, 'Could not save receipt.'));
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (receipt: Receipt) => {
    setDeletingId(receipt.id);
    try {
      await onDelete(receipt.id);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="receipt-saver">
      <div className="neo-card receipt-saver__upload">
        <h3 className="neo-card__title">Save a Receipt</h3>
        <p className="receipt-saver__hint">
          Snap a photo to remember what you bought. Receipts are kept for 7 days, then removed automatically.
        </p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="receipt-saver__file-input"
          onChange={handleFileChange}
        />

        <div className="receipt-saver__actions">
          <button
            type="button"
            className="neo-btn neo-btn--secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            <AppIcon name="camera" /> Take / Choose Photo
          </button>
          {selectedFile && (
            <button
              type="button"
              className="neo-btn neo-btn--primary"
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? 'Saving…' : 'Save Receipt'}
            </button>
          )}
        </div>

        {validationError && (
          <p className="receipt-saver__error">{validationError}</p>
        )}

        {previewUrl && (
          <div className="receipt-saver__preview">
            <img src={previewUrl} alt="Receipt preview" />
            <button type="button" className="neo-btn neo-btn--sm neo-btn--secondary" onClick={clearPreview}>
              Clear
            </button>
          </div>
        )}
      </div>

      <div className="receipt-saver__list-section">
        <h3 className="neo-card__title">Saved Receipts</h3>

        {loading && receipts.length === 0 ? (
          <div className="loading-spinner">
            <div className="loading-spinner__circle"></div>
          </div>
        ) : receipts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon"><AppIcon name="receipt" size={28} /></div>
            <p className="empty-state__text">No saved receipts yet.</p>
            <p className="empty-state__subtext">Upload a photo above to reference it when adding expenses later.</p>
          </div>
        ) : (
          <div className="receipt-grid">
            {receipts.map((receipt) => {
              const daysLeft = daysUntilExpiry(receipt.expires_at);
              return (
                <article key={receipt.id} className="neo-card receipt-card">
                  <a
                    href={getReceiptImageUrl(receipt.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="receipt-card__image-link"
                  >
                    <img
                      src={getReceiptImageUrl(receipt.id)}
                      alt={`Receipt uploaded ${formatDateTime(receipt.uploaded_at)}`}
                      className="receipt-card__image"
                      loading="lazy"
                    />
                  </a>
                  <div className="receipt-card__meta">
                    <p className="receipt-card__date">
                      Uploaded {formatDateTime(receipt.uploaded_at)}
                    </p>
                    <p className="receipt-card__expiry">
                      {daysLeft === 0 ? 'Expires today' : `Auto-deletes in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="neo-btn neo-btn--danger neo-btn--sm neo-btn--full"
                    onClick={() => handleDelete(receipt)}
                    disabled={deletingId === receipt.id}
                  >
                    {deletingId !== receipt.id && <AppIcon name="trash" size={16} />}
                    {deletingId === receipt.id ? 'Deleting…' : 'Delete'}
                  </button>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
