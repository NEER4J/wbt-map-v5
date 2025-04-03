// ConfirmModal.jsx
import React from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import './ConfirmModal.css';
const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, isLoading }) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="modal-header">
          <div className="modal-icon">
            <FaExclamationTriangle />
          </div>
          <h3>{title || 'Confirm Action'}</h3>
        </div>
        <div className="modal-body">
          <p>{message || 'Are you sure you want to proceed?'}</p>
          {isLoading && (
            <div className="modal-loader">
              <div className="loader-spinner"></div>
              <span>Deleting...</span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button 
            className="modal-button cancel-button" 
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            className="modal-button confirm-button" 
            onClick={onConfirm}
            disabled={isLoading}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
};
export default ConfirmModal;