import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-3 sm:left-4 z-[80] max-w-[calc(100vw-24px)] flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-xs font-extrabold text-neutral-950 shadow-lg border border-amber-600/30"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>
        Mode hors ligne — Les outils PDF locaux restent utilisables.
      </span>
    </div>
  );
}
