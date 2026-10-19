"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { z } from "zod";
import {
  decodeQuoteDraft,
  encodeQuoteDraft,
  QUOTE_DRAFT_PREFIX,
} from "@/lib/quote-drafts";

const failedKeys = new Set<string>();
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
function storageFailure(key: string) {
  if (failedKeys.has(key)) return;
  failedKeys.add(key);
  listeners.forEach((listener) => listener());
}

/** Latest draft stays on this device only; no prices/messages are sent by autosave. */
export function useQuoteDraft<T>(
  key: string,
  value: T,
  schema: z.ZodType<T>,
  restore: (saved: T) => void,
  enabled: boolean,
) {
  const ready = useRef(false);
  const skipFirstSave = useRef(false);
  const disabled = useRef(false);
  const latest = useRef(value);
  const storageKey = QUOTE_DRAFT_PREFIX + key;
  const snapshot = useCallback(() => failedKeys.has(storageKey), [storageKey]);
  const storageError = useSyncExternalStore(subscribe, snapshot, () => false);

  useEffect(() => {
    if (!enabled) return;
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = decodeQuoteDraft(raw, schema);
      if (saved) {
        latest.current = saved;
        skipFirstSave.current = true;
        restore(saved);
      } else if (raw) localStorage.removeItem(storageKey);
    } catch {
      storageFailure(storageKey);
    }
    ready.current = true;
  }, [enabled, storageKey, schema, restore]);

  useEffect(() => {
    if (!enabled || !ready.current || disabled.current) return;
    if (skipFirstSave.current) {
      skipFirstSave.current = false;
      return;
    }
    latest.current = value;
    try {
      localStorage.setItem(storageKey, encodeQuoteDraft(value, schema));
    } catch {
      storageFailure(storageKey);
    }
  }, [value, storageKey, enabled, schema]);

  useEffect(() => {
    if (!enabled) return;
    const save = () => {
      if (!ready.current || disabled.current) return;
      try {
        localStorage.setItem(
          storageKey,
          encodeQuoteDraft(latest.current, schema),
        );
      } catch {
        storageFailure(storageKey);
      }
    };
    window.addEventListener("pagehide", save);
    const onLogout = () => {
      disabled.current = true;
    };
    window.addEventListener("smartcar:clear-office-drafts", onLogout);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") save();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      save();
      window.removeEventListener("pagehide", save);
      window.removeEventListener("smartcar:clear-office-drafts", onLogout);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, storageKey, schema]);

  const discard = useCallback(() => {
    disabled.current = true;
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* Reload still starts a fresh form where storage is unavailable. */
    }
  }, [storageKey]);
  return { discard, storageError };
}
