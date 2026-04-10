type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  tone = 'default',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <div className="modal-backdrop" role="presentation" onClick={onCancel}>
      <div className="confirm-dialog" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="icon-close-button" aria-label="Закрыть окно" onClick={onCancel}>×</button>
        <div className="confirm-dialog__content">
          <h3>{title}</h3>
          <p>{message}</p>
        </div>
        <div className="confirm-dialog__actions">
          <button type="button" className="ghost-button" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={tone === 'danger' ? 'danger-button' : 'primary-button'} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
