import { AlertTriangle } from 'lucide-react'
import Modal from './Modal.jsx'
import Button from './Button.jsx'

export default function ConfirmDialog({
  open, onClose, onConfirm,
  title = 'Confirm Action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'danger', loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <div className="flex items-start gap-4">
        <div className="p-2.5 bg-red-50 dark:bg-red-900/20 rounded-xl flex-shrink-0">
          <AlertTriangle size={18} className="text-red-500" />
        </div>
        <p className="text-[13px] leading-relaxed pt-0.5" style={{ color: 'var(--text-secondary)' }}>{message}</p>
      </div>
    </Modal>
  )
}
