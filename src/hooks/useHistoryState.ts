import { useCallback, useRef, useState } from 'react';

interface HistoryStore<T> {
  past: T[];
  present: T;
  future: T[];
}

export interface HistoryStateController<T> {
  state: T;
  pastCount: number;
  futureCount: number;
  canUndo: boolean;
  canRedo: boolean;
  setState: (next: T | ((prev: T) => T)) => void;
  replaceState: (next: T | ((prev: T) => T)) => void;
  undo: () => boolean;
  redo: () => boolean;
  reset: (initialState: T) => void;
}

export function useHistoryState<T>(
  initialState: T,
  maxHistory = 20
): HistoryStateController<T> {
  const [history, setHistory] = useState<HistoryStore<T>>(() => ({
    past: [],
    present: initialState,
    future: [],
  }));

  const countsRef = useRef({ past: 0, future: 0 });
  countsRef.current = {
    past: history.past.length,
    future: history.future.length,
  };

  const setState = useCallback(
    (next: T | ((prev: T) => T)) => {
      setHistory((curr) => {
        const nextPresent =
          typeof next === 'function'
            ? (next as (prev: T) => T)(curr.present)
            : next;

        if (Object.is(nextPresent, curr.present)) {
          return curr;
        }

        const nextPast = [...curr.past, curr.present].slice(-maxHistory);
        return {
          past: nextPast,
          present: nextPresent,
          future: [],
        };
      });
    },
    [maxHistory]
  );

  const replaceState = useCallback((next: T | ((prev: T) => T)) => {
    setHistory((curr) => {
      const nextPresent =
        typeof next === 'function'
          ? (next as (prev: T) => T)(curr.present)
          : next;

      if (Object.is(nextPresent, curr.present)) {
        return curr;
      }

      return {
        ...curr,
        present: nextPresent,
      };
    });
  }, []);

  const undo = useCallback((): boolean => {
    if (countsRef.current.past === 0) return false;
    setHistory((curr) => {
      if (curr.past.length === 0) return curr;
      const previous = curr.past[curr.past.length - 1];
      const nextPast = curr.past.slice(0, -1);
      const nextFuture = [curr.present, ...curr.future].slice(0, maxHistory);
      return {
        past: nextPast,
        present: previous,
        future: nextFuture,
      };
    });
    return true;
  }, [maxHistory]);

  const redo = useCallback((): boolean => {
    if (countsRef.current.future === 0) return false;
    setHistory((curr) => {
      if (curr.future.length === 0) return curr;
      const next = curr.future[0];
      const nextFuture = curr.future.slice(1);
      const nextPast = [...curr.past, curr.present].slice(-maxHistory);
      return {
        past: nextPast,
        present: next,
        future: nextFuture,
      };
    });
    return true;
  }, [maxHistory]);

  const reset = useCallback((nextInitialState: T) => {
    setHistory({
      past: [],
      present: nextInitialState,
      future: [],
    });
  }, []);

  return {
    state: history.present,
    pastCount: history.past.length,
    futureCount: history.future.length,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    setState,
    replaceState,
    undo,
    redo,
    reset,
  };
}
