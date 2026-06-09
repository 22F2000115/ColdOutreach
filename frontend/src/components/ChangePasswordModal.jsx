import { useState, useEffect } from 'react';
import { api } from '../App';

export default function ChangePasswordModal({ isOpen, onClose }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [apiError, setApiError] = useState('');

  const isNewPasswordShort = newPassword.length < 8;
  const isConfirmPasswordMismatched = newPassword !== confirmPassword;
  const showNewPasswordError = submitted && isNewPasswordShort;
  const showConfirmPasswordError = submitted && isConfirmPasswordMismatched;

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSubmitted(false);
      setSubmitting(false);
      setSuccessMsg('');
      setApiError('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCancel = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setSubmitted(false);
    setSubmitting(false);
    setSuccessMsg('');
    setApiError('');
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitted(true);
    setApiError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      return;
    }
    if (isNewPasswordShort || isConfirmPasswordMismatched) {
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/api/user/change-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      setSuccessMsg('Password updated successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSubmitted(false);

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      setApiError(err.response?.data?.detail || "Something went wrong. Please try again.");
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
        animation: 'fadeIn 0.2s var(--ease-smooth)'
      }}
      onClick={handleCancel}
    >
      <div
        className="modal-box"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow-lg)',
          maxWidth: '440px',
          width: '100%',
          overflowY: 'auto',
          animation: 'scaleIn 0.25s var(--ease-spring)',
          display: 'flex',
          flexDirection: 'column'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="modal-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)'
          }}
        >
          <h3 className="modal-title" style={{ margin: 0 }}>Change Password</h3>
          <button
            type="button"
            className="modal-close"
            onClick={handleCancel}
          >
            &times;
          </button>
        </div>

        <div className="modal-body" style={{ padding: '24px' }}>
          {successMsg ? (
            <div
              className="alert alert-success"
              style={{
                marginBottom: '16px',
                color: '#166534',
                borderColor: 'rgba(22, 163, 74, 0.18)',
                background: 'rgba(22, 163, 74, 0.06)'
              }}
            >
              <span>{successMsg}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Current Password</label>
              <input
                type="password"
                className="form-control"
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                required
                placeholder="Enter current password"
              />
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">New Password</label>
              <input
                type="password"
                className="form-control"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
                placeholder="At least 8 characters"
              />
              {showNewPasswordError && (
                <span style={{ color: 'var(--error)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                  Password must be at least 8 characters
                </span>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: '20px' }}>
              <label className="form-label">Confirm New Password</label>
              <input
                type="password"
                className="form-control"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                placeholder="Re-enter new password"
              />
              {showConfirmPasswordError && (
                <span style={{ color: 'var(--error)', fontSize: '0.78rem', marginTop: '4px', display: 'block' }}>
                  Passwords do not match
                </span>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleCancel}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? 'Updating...' : 'Update Password'}
              </button>
            </div>

            {apiError && (
              <div
                style={{
                  marginTop: '16px',
                  color: 'var(--error)',
                  fontSize: '0.88rem',
                  lineHeight: '1.4'
                }}
              >
                {apiError}
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
