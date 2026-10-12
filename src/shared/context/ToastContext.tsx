import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

export type ToastType = 'error' | 'warning' | 'success' | 'info';

export interface ToastOptions {
  title?: string;
  duration?: number; // ms, defaults to 5000ms
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  duration: number;
  createdAt: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

type ToastSubscriber = (toast: ToastItem) => void;
type DismissSubscriber = (id: string) => void;
type ClearSubscriber = () => void;

class ToastManager {
  private toastSubscribers = new Set<ToastSubscriber>();
  private dismissSubscribers = new Set<DismissSubscriber>();
  private clearSubscribers = new Set<ClearSubscriber>();

  public subscribe(
    onToast: ToastSubscriber,
    onDismiss: DismissSubscriber,
    onClear: ClearSubscriber
  ) {
    this.toastSubscribers.add(onToast);
    this.dismissSubscribers.add(onDismiss);
    this.clearSubscribers.add(onClear);

    return () => {
      this.toastSubscribers.delete(onToast);
      this.dismissSubscribers.delete(onDismiss);
      this.clearSubscribers.delete(onClear);
    };
  }

  private emit(type: ToastType, message: string, options?: ToastOptions): string {
    const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const defaultTitles: Record<ToastType, string> = {
      error: 'Error',
      warning: 'Warning',
      success: 'Success',
      info: 'Notice'
    };

    const item: ToastItem = {
      id,
      type,
      title: options?.title || defaultTitles[type],
      message,
      duration: options?.duration !== undefined ? options.duration : 5000,
      createdAt: Date.now(),
      action: options?.action
    };

    this.toastSubscribers.forEach((sub) => sub(item));
    return id;
  }

  public error(message: string, options?: ToastOptions): string {
    return this.emit('error', message, options);
  }

  public warning(message: string, options?: ToastOptions): string {
    return this.emit('warning', message, options);
  }

  public success(message: string, options?: ToastOptions): string {
    return this.emit('success', message, options);
  }

  public info(message: string, options?: ToastOptions): string {
    return this.emit('info', message, options);
  }

  public dismiss(id: string): void {
    this.dismissSubscribers.forEach((sub) => sub(id));
  }

  public clearAll(): void {
    this.clearSubscribers.forEach((sub) => sub());
  }
}

export const toast = new ToastManager();

interface ToastContextValue {
  toasts: ToastItem[];
  dismiss: (id: string) => void;
  clearAll: () => void;
  error: (message: string, options?: ToastOptions) => string;
  warning: (message: string, options?: ToastOptions) => string;
  success: (message: string, options?: ToastOptions) => string;
  info: (message: string, options?: ToastOptions) => string;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    // If used outside provider, return static manager
    return {
      toasts: [],
      dismiss: toast.dismiss.bind(toast),
      clearAll: toast.clearAll.bind(toast),
      error: toast.error.bind(toast),
      warning: toast.warning.bind(toast),
      success: toast.success.bind(toast),
      info: toast.info.bind(toast)
    };
  }
  return ctx;
};

// Single Toast Card Component
const ToastCard: React.FC<{
  item: ToastItem;
  onDismiss: (id: string) => void;
}> = ({ item, onDismiss }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [progress, setProgress] = useState(100);
  const progressIntervalRef = useRef<number | null>(null);
  const remainingTimeRef = useRef(item.duration);
  const lastTickRef = useRef(Date.now());

  useEffect(() => {
    if (item.duration <= 0) return;

    const intervalMs = 25;
    lastTickRef.current = Date.now();

    progressIntervalRef.current = window.setInterval(() => {
      if (!isHovered) {
        const now = Date.now();
        const delta = now - lastTickRef.current;
        lastTickRef.current = now;
        remainingTimeRef.current -= delta;

        if (remainingTimeRef.current <= 0) {
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          onDismiss(item.id);
        } else {
          setProgress(Math.max(0, (remainingTimeRef.current / item.duration) * 100));
        }
      } else {
        lastTickRef.current = Date.now();
      }
    }, intervalMs);

    return () => {
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    };
  }, [item.id, item.duration, isHovered, onDismiss]);

  const config = {
    error: {
      bg: 'bg-gradient-to-r from-rose-50/95 via-white/95 to-white/95',
      border: 'border-rose-300/90 shadow-[0_12px_32px_-6px_rgba(225,29,72,0.18)]',
      iconBg: 'bg-rose-600 text-white shadow-sm shadow-rose-600/30',
      icon: 'error',
      titleColor: 'text-rose-950',
      messageColor: 'text-rose-900/90',
      progressBar: 'bg-rose-500'
    },
    warning: {
      bg: 'bg-gradient-to-r from-amber-50/95 via-white/95 to-white/95',
      border: 'border-amber-300/90 shadow-[0_12px_32px_-6px_rgba(217,119,6,0.18)]',
      iconBg: 'bg-amber-500 text-white shadow-sm shadow-amber-500/30',
      icon: 'warning',
      titleColor: 'text-amber-950',
      messageColor: 'text-amber-900/90',
      progressBar: 'bg-amber-500'
    },
    success: {
      bg: 'bg-gradient-to-r from-emerald-50/95 via-white/95 to-white/95',
      border: 'border-emerald-300/90 shadow-[0_12px_32px_-6px_rgba(5,150,105,0.18)]',
      iconBg: 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30',
      icon: 'check_circle',
      titleColor: 'text-emerald-950',
      messageColor: 'text-emerald-900/90',
      progressBar: 'bg-emerald-500'
    },
    info: {
      bg: 'bg-gradient-to-r from-sky-50/95 via-white/95 to-white/95',
      border: 'border-sky-300/90 shadow-[0_12px_32px_-6px_rgba(0,99,152,0.18)]',
      iconBg: 'bg-[#006398] text-white shadow-sm shadow-[#006398]/30',
      icon: 'info',
      titleColor: 'text-slate-900',
      messageColor: 'text-slate-700',
      progressBar: 'bg-[#006398]'
    }
  }[item.type];

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="alert"
      className={`pointer-events-auto relative w-full overflow-hidden rounded-2xl border p-4 backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-top-3 sm:slide-in-from-right-4 ${config.bg} ${config.border}`}
    >
      <div className="flex items-start gap-3.5">
        {/* Type Icon Badge */}
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${config.iconBg}`}
        >
          <span className="material-symbols-outlined text-[20px]">{config.icon}</span>
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className={`text-xs font-bold font-display tracking-tight ${config.titleColor}`}>
              {item.title}
            </h4>
            <span className="text-[10px] font-mono text-slate-400 shrink-0">
              {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
          <p className={`mt-0.5 text-xs font-sans leading-relaxed break-words ${config.messageColor}`}>
            {item.message}
          </p>

          {/* Action button if defined */}
          {item.action && (
            <button
              type="button"
              onClick={() => {
                item.action?.onClick();
                onDismiss(item.id);
              }}
              className="mt-2.5 px-3 py-1 rounded-lg bg-slate-900 text-white text-[11px] font-mono font-bold hover:bg-slate-800 transition-colors shadow-xs"
            >
              {item.action.label}
            </button>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={() => onDismiss(item.id)}
          aria-label="Dismiss notification"
          className="shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>

      {/* Countdown Progress Bar */}
      {item.duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-200/50 overflow-hidden">
          <div
            className={`h-full transition-all duration-75 ${config.progressBar}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((toastItem: ToastItem) => {
    setToasts((prev) => {
      // Limit to 5 most recent toasts
      const filtered = prev.filter((t) => t.id !== toastItem.id);
      return [toastItem, ...filtered].slice(0, 5);
    });
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  // Connect to static ToastManager
  useEffect(() => {
    const unsubscribe = toast.subscribe(addToast, dismiss, clearAll);
    return () => unsubscribe();
  }, [addToast, dismiss, clearAll]);

  // Global exception & promise rejection handlers
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      let message = 'An unexpected asynchronous error occurred.';
      if (event.reason instanceof Error) {
        message = event.reason.message;
      } else if (typeof event.reason === 'string') {
        message = event.reason;
      }

      // Ignore standard user cancellations or AbortSignal cancellations
      if (
        message.toLowerCase().includes('canceled') ||
        message.toLowerCase().includes('cancelled') ||
        message.toLowerCase().includes('aborted')
      ) {
        return;
      }

      toast.error(message, {
        title: 'System Exception'
      });
    };

    const handleWindowError = (event: ErrorEvent) => {
      // Don't report external extension errors or cross-origin script errors
      if (!event.message || event.message === 'Script error.') return;

      toast.error(event.message, {
        title: 'Application Error'
      });
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleWindowError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleWindowError);
    };
  }, []);

  const contextValue: ToastContextValue = {
    toasts,
    dismiss,
    clearAll,
    error: (msg, opts) => toast.error(msg, opts),
    warning: (msg, opts) => toast.warning(msg, opts),
    success: (msg, opts) => toast.success(msg, opts),
    info: (msg, opts) => toast.info(msg, opts)
  };

  return (
    <ToastContext.Provider value={contextValue}>
      {children}

      {/* Floating Toast Container */}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed top-4 right-4 sm:top-6 sm:right-6 z-[99999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-[calc(100vw-2rem)] sm:w-full pointer-events-none"
      >
        {toasts.map((item) => (
          <ToastCard key={item.id} item={item} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export default ToastProvider;
