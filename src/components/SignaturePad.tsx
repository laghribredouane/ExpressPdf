import { useCallback, useEffect, useRef, useState } from 'react';
import { History, PenTool, Redo2, RotateCcw, Trash2, Type, Undo2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useHistoryState } from '../hooks/useHistoryState';

const SAVED_SIGNATURE_KEY = 'pdfexpress-last-signature';

interface SignaturePadProps {
  onSignatureChange: (dataUrl: string | null) => void;
  onResetAll?: () => void;
}

const INK_COLORS = [
  { id: 'black', label: 'Noir', hex: '#0f172a' },
  { id: 'blue', label: 'Bleu encre', hex: '#1d4ed8' },
  { id: 'red', label: 'Rouge', hex: '#dc2626' },
] as const;

interface Point {
  x: number;
  y: number;
}

export function SignaturePad({
  onSignatureChange,
  onResetAll,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pointsRef = useRef<Point[]>([]);
  const baseImageRef = useRef<ImageData | null>(null);

  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [typedText, setTypedText] = useState('');
  const [inkColor, setInkColor] = useState<string>('#0f172a');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [cursorSpot, setCursorSpot] = useState<{ x: number; y: number } | null>(
    null
  );
  const [savedSignature, setSavedSignature] = useState<string | null>(() => {
    try {
      return localStorage.getItem(SAVED_SIGNATURE_KEY);
    } catch {
      return null;
    }
  });
  const strokeHistory = useHistoryState<string | null>(null, 20);
  const pendingRestoreRef = useRef(false);

  const restoreCanvasFromDataUrl = useCallback(
    (dataUrl: string | null) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (dataUrl) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          };
          img.src = dataUrl;
        }
      }
      onSignatureChange(dataUrl);
    },
    [onSignatureChange]
  );

  useEffect(() => {
    if (!pendingRestoreRef.current) return;
    pendingRestoreRef.current = false;
    restoreCanvasFromDataUrl(strokeHistory.state);
  }, [strokeHistory.state, restoreCanvasFromDataUrl]);

  const persistSignature = useCallback(
    (dataUrl: string | null, pushHistory = true) => {
      onSignatureChange(dataUrl);
      if (pushHistory) {
        strokeHistory.setState(dataUrl);
      }
      if (dataUrl) {
        try {
          localStorage.setItem(SAVED_SIGNATURE_KEY, dataUrl);
          setSavedSignature(dataUrl);
        } catch {
          // Ignore storage quota errors
        }
      }
    },
    [onSignatureChange, strokeHistory]
  );

  const renderTypedToCanvas = useCallback(
    (text: string, color: string) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const trimmed = text.trim();
      if (!trimmed) {
        onSignatureChange(null);
        return;
      }

      let fontSize = 46;
      ctx.font = `italic ${fontSize}px "Dancing Script", cursive`;
      while (
        ctx.measureText(trimmed).width > canvas.width - 28 &&
        fontSize > 20
      ) {
        fontSize -= 2;
        ctx.font = `italic ${fontSize}px "Dancing Script", cursive`;
      }

      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(trimmed, canvas.width / 2, canvas.height / 2);
      persistSignature(canvas.toDataURL('image/png'), false);
    },
    [onSignatureChange, persistSignature]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.strokeStyle = inkColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (mode === 'type') {
      renderTypedToCanvas(typedText, inkColor);
    }
  }, [inkColor, strokeWidth, mode, typedText, renderTypedToCanvas]);

  const getCoords = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      canvasPoint: {
        x: (clientX - rect.left) * (canvas.width / rect.width),
        y: (clientY - rect.top) * (canvas.height / rect.height),
      },
      cssPoint: {
        x: clientX - rect.left,
        y: clientY - rect.top,
      },
    };
  };

  const drawSmoothStroke = (
    ctx: CanvasRenderingContext2D,
    pts: Point[],
    color: string,
    width: number
  ) => {
    if (pts.length === 0) return;
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, width / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length - 1; i++) {
      const midX = (pts[i].x + pts[i + 1].x) / 2;
      const midY = (pts[i].y + pts[i + 1].y) / 2;
      ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
    }
    const last = pts[pts.length - 1];
    ctx.lineTo(last.x, last.y);
    ctx.stroke();
    ctx.restore();
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (mode !== 'draw') return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    baseImageRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { canvasPoint, cssPoint } = getCoords(e);
    pointsRef.current = [canvasPoint];
    drawSmoothStroke(ctx, pointsRef.current, inkColor, strokeWidth);
    setCursorSpot(cssPoint);
    setIsDrawing(true);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing || mode !== 'draw') return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const { canvasPoint, cssPoint } = getCoords(e);
    pointsRef.current.push(canvasPoint);
    setCursorSpot(cssPoint);

    if (baseImageRef.current) {
      ctx.putImageData(baseImageRef.current, 0, 0);
    }
    drawSmoothStroke(ctx, pointsRef.current, inkColor, strokeWidth);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    setCursorSpot(null);
    baseImageRef.current = null;
    pointsRef.current = [];
    const canvas = canvasRef.current;
    if (canvas) {
      persistSignature(canvas.toDataURL('image/png'));
    }
  };

  const handleClearSignature = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setTypedText('');
    if (mode === 'draw' && strokeHistory.state !== null) {
      strokeHistory.setState(null);
    }
    onSignatureChange(null);
  };

  const handleUndoStroke = () => {
    if (!strokeHistory.canUndo) return;
    pendingRestoreRef.current = true;
    strokeHistory.undo();
  };

  const handleRedoStroke = () => {
    if (!strokeHistory.canRedo) return;
    pendingRestoreRef.current = true;
    strokeHistory.redo();
  };

  const handleReuseSaved = () => {
    if (!savedSignature) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    setMode('draw');
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const scale = Math.min(
        canvas.width / img.width,
        canvas.height / img.height
      );
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
      const rendered = canvas.toDataURL('image/png');
      strokeHistory.setState(rendered);
      onSignatureChange(rendered);
    };
    img.src = savedSignature;
  };

  const handleForgetSaved = () => {
    try {
      localStorage.removeItem(SAVED_SIGNATURE_KEY);
    } catch {
      // Ignore storage errors
    }
    setSavedSignature(null);
  };

  const switchMode = (nextMode: 'draw' | 'type') => {
    if (nextMode === mode) return;
    setMode(nextMode);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (nextMode === 'type') {
      renderTypedToCanvas(typedText, inkColor);
    } else {
      strokeHistory.reset(null);
      onSignatureChange(null);
    }
  };

  return (
    <div className="space-y-3">
      {/* Dernière signature mémorisée dans localStorage */}
      <AnimatePresence>
        {savedSignature && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="p-2.5 rounded-xl bg-neutral-50 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700 flex items-center justify-between gap-2.5"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-16 h-9 rounded-lg checkerboard border border-neutral-200 dark:border-neutral-600 flex items-center justify-center overflow-hidden shrink-0">
                <img
                  src={savedSignature}
                  alt="Signature mémorisée"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-neutral-700 dark:text-neutral-200 flex items-center gap-1 truncate">
                  <History className="w-3 h-3 text-sky-600 dark:text-sky-400 shrink-0" />
                  <span>Dernière signature</span>
                </p>
                <p className="text-[10px] text-neutral-400 truncate">
                  Mémorisée localement
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleReuseSaved}
                className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-bold transition-colors"
              >
                Réutiliser
              </button>
              <button
                type="button"
                onClick={handleForgetSaved}
                title="Oublier la signature mémorisée"
                aria-label="Oublier la signature mémorisée"
                className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-2">
        <label className="block text-xs font-bold uppercase text-neutral-500 dark:text-neutral-400">
          1. Créer votre signature
        </label>
        <div className="flex items-center gap-1.5">
          {INK_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              title={c.label}
              aria-label={`Couleur ${c.label}`}
              onClick={() => setInkColor(c.hex)}
              className={`w-5 h-5 rounded-full border-2 transition-transform ${
                inkColor === c.hex
                  ? 'border-neutral-900 dark:border-white scale-110'
                  : 'border-transparent opacity-70 hover:opacity-100'
              }`}
              style={{ backgroundColor: c.hex }}
            />
          ))}
        </div>
      </div>

      {/* Mode Dessiner / Taper */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-neutral-100 dark:bg-neutral-800">
        <button
          type="button"
          onClick={() => switchMode('draw')}
          className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
            mode === 'draw'
              ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <PenTool className="w-3.5 h-3.5" />
          <span>Dessiner</span>
        </button>
        <button
          type="button"
          onClick={() => switchMode('type')}
          className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
            mode === 'type'
              ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span>Taper</span>
        </button>
      </div>

      {/* Curseur dynamique d'épaisseur du trait en mode Dessiner */}
      {mode === 'draw' && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-neutral-500 dark:text-neutral-400">
              Épaisseur du trait
            </label>
            <div className="flex items-center gap-2">
              <span
                className="rounded-full transition-all"
                style={{
                  width: `${Math.max(4, strokeWidth * 2.2)}px`,
                  height: `${Math.max(4, strokeWidth * 2.2)}px`,
                  backgroundColor: inkColor,
                }}
              />
              <span className="text-xs font-mono font-semibold text-neutral-600 dark:text-neutral-300 tabular-nums">
                {strokeWidth.toFixed(1)} px
              </span>
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={8}
            step={0.5}
            value={strokeWidth}
            onChange={(e) => setStrokeWidth(Number(e.target.value))}
            aria-label="Épaisseur du trait de signature"
            className="w-full accent-sky-600"
          />
        </div>
      )}

      {mode === 'type' && (
        <div>
          <input
            type="text"
            value={typedText}
            onChange={(e) => setTypedText(e.target.value)}
            placeholder="Tapez votre nom ou signature..."
            aria-label="Saisir votre signature"
            className="w-full px-3 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-sm outline-none focus:border-brand-red"
          />
        </div>
      )}

      {/* Canvas de dessin avec animation fluide au tracé */}
      <motion.div
        animate={{
          scale: isDrawing ? 1.01 : 1,
          borderColor: isDrawing ? '#0284c7' : undefined,
        }}
        transition={{ duration: 0.15 }}
        className={`border-2 border-dashed rounded-xl overflow-hidden checkerboard relative transition-shadow ${
          isDrawing
            ? 'border-sky-500 shadow-md shadow-sky-500/15'
            : 'border-neutral-300 dark:border-neutral-600'
        }`}
      >
        <canvas
          ref={canvasRef}
          width={340}
          height={130}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className={`w-full h-32 block touch-none ${
            mode === 'draw' ? 'cursor-crosshair' : 'cursor-default'
          }`}
        />
        {isDrawing && cursorSpot && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute rounded-full -translate-x-1/2 -translate-y-1/2 opacity-40 animate-ping"
            style={{
              left: `${cursorSpot.x}px`,
              top: `${cursorSpot.y}px`,
              width: `${Math.max(12, strokeWidth * 3.5)}px`,
              height: `${Math.max(12, strokeWidth * 3.5)}px`,
              backgroundColor: inkColor,
            }}
          />
        )}
        {mode === 'draw' && !isDrawing && (
          <span className="pointer-events-none absolute bottom-1.5 right-2.5 text-[10px] font-medium text-neutral-400">
            Tracez ici
          </span>
        )}
      </motion.div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {mode === 'draw' && (
            <div className="inline-flex items-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 p-0.5 mr-1">
              <button
                type="button"
                disabled={!strokeHistory.canUndo}
                onClick={handleUndoStroke}
                title="Annuler le trait (Ctrl+Z)"
                aria-label="Annuler le dernier trait"
                className="p-1.5 rounded-md text-neutral-700 dark:text-neutral-200 hover:bg-white dark:hover:bg-neutral-700 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!strokeHistory.canRedo}
                onClick={handleRedoStroke}
                title="Rétablir le trait (Ctrl+Y)"
                aria-label="Rétablir le trait"
                className="p-1.5 rounded-md text-neutral-700 dark:text-neutral-200 hover:bg-white dark:hover:bg-neutral-700 disabled:opacity-35 disabled:cursor-not-allowed transition-colors"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={handleClearSignature}
            className="text-xs font-bold text-neutral-600 dark:text-neutral-300 hover:text-red-600 dark:hover:text-red-400 transition-colors inline-flex items-center gap-1 py-1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Effacer</span>
          </button>
        </div>
        {onResetAll && (
          <button
            type="button"
            onClick={() => {
              handleClearSignature();
              onResetAll();
            }}
            className="text-xs font-bold text-red-600 dark:text-red-400 hover:underline py-1"
          >
            Tout réinitialiser
          </button>
        )}
      </div>
    </div>
  );
}
