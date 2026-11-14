import { AlertCircle, CheckCircle2, Info } from 'lucide-react';
import type { ToastItem } from '../types/pdf';

interface ToastContainerProps {
  toasts: ToastItem[];
}

export function ToastContainer({ toasts }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[90] flex flex-col gap-2 pointer-events-none max-w-sm">
      {toasts.map((toast) => {
        const tone =
          toast.type === 'error'
            ? 'bg-red-600 text-white'
            : toast.type === 'success'
            ? 'bg-emerald-600 text-white'
            : 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900';

        return (
          <div
            key={toast.id}
            role="status"
            className={`${tone} px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 text-xs sm:text-sm font-medium pointer-events-auto`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <Info className="w-4 h-4 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
        );
      })}
    </div>
  );
}
