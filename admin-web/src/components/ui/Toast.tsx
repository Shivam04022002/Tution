import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { IconAlert, IconCheck, IconClose } from './Icons';

type ToastKind = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATIONS: Record<ToastKind, number> = {
  success: 3500,
  info: 4000,
  // Failures stay longer — they usually carry an action the admin must read.
  error: 6500,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = nextId.current++;
      setItems((current) => [...current, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), DURATIONS[kind]);
    },
    [dismiss]
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message) => push('success', message),
      error: (message) => push('error', message),
      info: (message) => push('info', message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast toast-${item.kind}`}>
            <span
              style={{
                color:
                  item.kind === 'success'
                    ? 'var(--c-success)'
                    : item.kind === 'error'
                      ? 'var(--c-error)'
                      : 'var(--c-info)',
                marginTop: 1,
                flex: 'none',
              }}
            >
              {item.kind === 'success' ? <IconCheck size={15} /> : <IconAlert size={15} />}
            </span>
            <span className="toast-msg grow">{item.message}</span>
            <button
              type="button"
              className="btn btn-ghost btn-icon btn-sm"
              aria-label="Dismiss"
              onClick={() => dismiss(item.id)}
            >
              <IconClose size={13} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
