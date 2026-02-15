import React from 'react';
import { useFlowStore, type Toast } from '../../stores/flowStore';
import { useUIStore } from '../../stores/uiStore';

function ToastItem({ toast }: { toast: Toast }) {
  const { dismissToast } = useFlowStore();
  const { setView } = useUIStore();

  const colorMap = {
    success: 'var(--green-success, #00ff88)',
    info: 'var(--cyan-glow, #00c8ff)',
    warning: 'var(--amber-alert, #ff9f1c)',
    error: 'var(--red-alert, #ff3344)',
  };

  const color = colorMap[toast.type];

  const handleAction = () => {
    if (toast.action?.view) {
      setView(toast.action.view);
    }
    if (toast.action?.callback) {
      toast.action.callback();
    }
    dismissToast(toast.id);
  };

  return (
    <div style={{
      ...toastStyles.toast,
      borderLeftColor: color,
      animation: 'fade-in-up 0.3s ease-out',
    }}>
      <div style={toastStyles.toastContent}>
        <span style={{ ...toastStyles.toastTitle, color }}>{toast.title}</span>
        <span style={toastStyles.toastMessage}>{toast.message}</span>
      </div>
      {toast.action && (
        <button onClick={handleAction} style={{ ...toastStyles.toastAction, color }}>
          {toast.action.label}
        </button>
      )}
      <button onClick={() => dismissToast(toast.id)} style={toastStyles.toastDismiss}>{'\u2715'}</button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts } = useFlowStore();

  if (toasts.length === 0) return null;

  return (
    <div style={toastStyles.container}>
      {toasts.map(toast => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

const toastStyles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 60,
    right: 16,
    zIndex: 800,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    maxWidth: 360,
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 14px',
    background: 'rgba(13, 19, 33, 0.95)',
    border: '1px solid rgba(0, 200, 255, 0.2)',
    borderLeft: '3px solid',
    backdropFilter: 'blur(8px)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4)',
  },
  toastContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  toastTitle: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '2px',
  },
  toastMessage: {
    fontFamily: "var(--font-body, 'Rajdhani', sans-serif)",
    fontSize: '12px',
    fontWeight: 500,
    color: 'var(--text-secondary, #7a8ba8)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  toastAction: {
    fontFamily: "var(--font-display, 'Orbitron', sans-serif)",
    fontSize: '8px',
    fontWeight: 700,
    letterSpacing: '1.5px',
    border: '1px solid currentColor',
    background: 'transparent',
    padding: '4px 10px',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'all 0.15s ease',
  },
  toastDismiss: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary, #7a8ba8)',
    fontSize: '10px',
    cursor: 'pointer',
    opacity: 0.5,
    padding: '4px',
    flexShrink: 0,
  },
};
