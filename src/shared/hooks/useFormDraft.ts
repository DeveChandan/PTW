import { useState, useEffect, useRef, useCallback } from 'react';

export interface StoredDraft<T> {
  data: T;
  timestamp: number;
  userId: string;
}

export interface UseFormDraftOptions {
  draftKey: string;
  userId?: string;
  debounceMs?: number;
  warnOnUnload?: boolean;
}

export interface UseFormDraftReturn<T> {
  hasDraft: boolean;
  lastSaved: Date | null;
  savedTimestamp: number | null;
  saveDraft: (data: T) => void;
  getSavedDraft: () => T | null;
  clearDraft: () => void;
  discardDraft: () => void;
}

/**
 * Reusable hook to auto-persist in-progress form drafts to localStorage,
 * allowing full restoration if the user is disconnected, closes the tab, or reloads.
 */
export function useFormDraft<T>({
  draftKey,
  userId = 'guest',
  debounceMs = 1200,
  warnOnUnload = true
}: UseFormDraftOptions): UseFormDraftReturn<T> {
  const scopedKey = `gfl_ptw_draft_${userId}_${draftKey}`;
  const [hasDraft, setHasDraft] = useState<boolean>(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [savedTimestamp, setSavedTimestamp] = useState<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const dirtyRef = useRef<boolean>(false);

  // Check if a saved draft exists on mount or when key/user changes
  useEffect(() => {
    try {
      const raw = localStorage.getItem(scopedKey);
      if (raw) {
        const parsed: StoredDraft<T> = JSON.parse(raw);
        if (parsed && parsed.data) {
          setHasDraft(true);
          setSavedTimestamp(parsed.timestamp);
          setLastSaved(new Date(parsed.timestamp));
        }
      } else {
        setHasDraft(false);
        setSavedTimestamp(null);
        setLastSaved(null);
      }
    } catch (e) {
      console.warn('[useFormDraft] Error reading draft from storage:', e);
      setHasDraft(false);
    }
  }, [scopedKey]);

  // Debounced auto-save
  const saveDraft = useCallback(
    (data: T) => {
      dirtyRef.current = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      timerRef.current = setTimeout(() => {
        try {
          const now = Date.now();
          const draftRecord: StoredDraft<T> = {
            data,
            timestamp: now,
            userId
          };
          localStorage.setItem(scopedKey, JSON.stringify(draftRecord));
          setLastSaved(new Date(now));
          setSavedTimestamp(now);
        } catch (e) {
          console.warn('[useFormDraft] Failed to write draft to storage:', e);
        }
      }, debounceMs);
    },
    [scopedKey, userId, debounceMs]
  );

  // Read draft data for restoration
  const getSavedDraft = useCallback((): T | null => {
    try {
      const raw = localStorage.getItem(scopedKey);
      if (raw) {
        const parsed: StoredDraft<T> = JSON.parse(raw);
        return parsed.data;
      }
    } catch (e) {
      console.warn('[useFormDraft] Error retrieving draft:', e);
    }
    return null;
  }, [scopedKey]);

  // Clear draft on successful submit
  const clearDraft = useCallback(() => {
    dirtyRef.current = false;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    try {
      localStorage.removeItem(scopedKey);
      setHasDraft(false);
      setLastSaved(null);
      setSavedTimestamp(null);
    } catch (e) {
      console.warn('[useFormDraft] Failed to clear draft:', e);
    }
  }, [scopedKey]);

  // Explicitly discard draft without restoring
  const discardDraft = useCallback(() => {
    clearDraft();
  }, [clearDraft]);

  // Optional beforeunload warning when dirty
  useEffect(() => {
    if (!warnOnUnload) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [warnOnUnload]);

  return {
    hasDraft,
    lastSaved,
    savedTimestamp,
    saveDraft,
    getSavedDraft,
    clearDraft,
    discardDraft
  };
}
