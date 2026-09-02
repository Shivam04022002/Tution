import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Debounces a value so typing in a search box does not fire a request per key. */
export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

/**
 * List state kept in the URL so a filtered table can be linked, bookmarked and
 * survives a reload — the standard expectation for an admin console.
 */
export function useListParams(defaults: Record<string, string> = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const get = useCallback(
    (key: string) => searchParams.get(key) ?? defaults[key] ?? '',
    [searchParams, defaults]
  );

  const set = useCallback(
    (updates: Record<string, string | number | undefined | null>, resetPage = true) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(updates)) {
            if (value === undefined || value === null || value === '') next.delete(key);
            else next.set(key, String(value));
          }
          if (resetPage && !('page' in updates)) next.delete('page');
          return next;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const page = Math.max(1, parseInt(get('page') || '1', 10) || 1);
  const setPage = useCallback((value: number) => set({ page: value }, false), [set]);

  return { get, set, page, setPage };
}

/** Closes a popover/menu on an outside click or Escape. */
export function useDismissable<T extends HTMLElement>(onDismiss: () => void, active: boolean) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;

    const onPointerDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [active, onDismiss]);

  return ref;
}

/** Persists a boolean preference (sidebar collapsed state) across sessions. */
export function usePersistentFlag(key: string, initial = false) {
  const [value, setValue] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored === null ? initial : stored === 'true';
    } catch {
      return initial;
    }
  });

  const update = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        localStorage.setItem(key, String(next));
      } catch {
        // Storage being unavailable must not break the toggle.
      }
    },
    [key]
  );

  return [value, update] as const;
}
