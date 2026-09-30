'use client';

import { compressImage } from '@/lib/image-compress';
import { createClient } from '@/lib/supabase/client';
import type { DamageKind, DamageView, SidePhotoView } from '@/lib/inspection-damage';
import type { Checklist } from '@/lib/inspection-checklist';

/**
 * Offline-safe inspection submission. Before anything goes over the
 * network the whole inspection (fields + compressed video + photos) is
 * saved on the phone in IndexedDB. Sending then runs create → photos →
 * video → complete; if there's no signal it stays saved and is retried
 * automatically when the connection returns (or when the app is reopened).
 * Steps already done are remembered, so a retry never creates a second
 * inspection.
 */

const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
const DB_NAME = 'smartcar-driver';
const STORE = 'pending-inspections';

export interface DraftMark {
  view: DamageView;
  x: number;
  y: number;
  kind: DamageKind;
  note: string;
  photo: Blob | null;
}

export interface InspectionDraft {
  localId: string;
  createdAt: number;
  apiBase: string;
  bookingId: string;
  type: 'pickup' | 'return';
  customerLabel: string;
  odometerKm: number;
  fuelEighths: number;
  video: Blob | null;
  videoExt: string;
  videoType: string;
  marks: DraftMark[];
  noDamage: boolean;
  sidePhotos: Partial<Record<SidePhotoView, Blob>>;
  checklist: Checklist;
  /** Return only: handover inspection it's compared with. */
  handoverInspectionId?: string | null;
  /** Filled once the server created the inspection — retries reuse it. */
  created?: {
    inspectionId: string;
    bucket: string;
    video: { path: string; uploadEndpoint: string; uploadToken: string } | null;
    photos: Array<{ key: string; path: string; token: string }>;
    expiresAt: string;
  };
  photosDone?: string[];
  videoDone?: boolean;
  lastError?: string;
}

export type SendStage = 'creating' | 'photos' | 'uploading' | 'finishing';

export class OfflineError extends Error {}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'localId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export async function saveDraft(draft: InspectionDraft): Promise<void> {
  try {
    await tx('readwrite', (s) => s.put(draft));
  } catch (err) {
    // Private mode / storage blocked: sending still works, just not offline.
    console.warn('[inspection-outbox] could not save draft:', err);
  }
}

export async function deleteDraft(localId: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(localId));
  } catch {
    /* ignore */
  }
}

export async function listDrafts(): Promise<InspectionDraft[]> {
  try {
    const all = await tx<InspectionDraft[]>('readonly', (s) => s.getAll() as IDBRequest<InspectionDraft[]>);
    return all.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

function isNetworkError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const msg = String((err as Error)?.message ?? err);
  return err instanceof TypeError || /network|failed to fetch|load failed|offline|timeout/i.test(msg);
}

async function postJson(url: string, body?: unknown) {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new OfflineError(String((err as Error)?.message ?? err));
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

/**
 * Sends a saved draft. Resumes from wherever a previous attempt stopped.
 * Throws OfflineError when the network is the problem (draft stays saved).
 * Returns the inspection id on success (the draft is deleted).
 */
export async function sendDraft(
  draft: InspectionDraft,
  onProgress: (stage: SendStage, percent: number) => void
): Promise<string> {
  try {
    // 1. Create (skipped if a previous attempt got this far and tokens are still valid).
    if (!draft.created || new Date(draft.created.expiresAt).getTime() < Date.now() + 5 * 60 * 1000) {
      if (draft.created) {
        // Tokens expired: start a fresh inspection record.
        draft.created = undefined;
        draft.photosDone = [];
        draft.videoDone = false;
      }
      onProgress('creating', 0);
      const created = await postJson(draft.apiBase, {
        bookingId: draft.bookingId,
        type: draft.type,
        odometerKm: draft.odometerKm,
        fuelEighths: draft.fuelEighths,
        hasVideo: Boolean(draft.video),
        videoExt: draft.videoExt,
        damageMarks: draft.marks.map((m) => ({ view: m.view, x: m.x, y: m.y, kind: m.kind, note: m.note, hasPhoto: Boolean(m.photo) })),
        noDamage: draft.noDamage && draft.marks.length === 0,
        sidePhotoViews: Object.keys(draft.sidePhotos),
        checklist: draft.checklist,
        handoverInspectionId: draft.handoverInspectionId ?? null,
      });
      draft.created = created;
      draft.photosDone = [];
      draft.videoDone = false;
      await saveDraft(draft);
    }
    const created = draft.created!;

    // 2. Photos (small) — resized to JPEG, each uploaded once.
    const photos = created.photos ?? [];
    if (photos.length) {
      const supabase = createClient();
      const done = new Set(draft.photosDone ?? []);
      for (const p of photos) {
        if (done.has(p.key)) continue;
        onProgress('photos', Math.round((done.size / photos.length) * 100));
        let blob: Blob | null = null;
        if (p.key.startsWith('mark-')) blob = draft.marks[Number(p.key.slice(5)) - 1]?.photo ?? null;
        else if (p.key.startsWith('side-')) blob = draft.sidePhotos[p.key.slice(5) as SidePhotoView] ?? null;
        if (!blob) throw new Error('תמונה חסרה');
        const jpeg = await compressImage(blob instanceof File ? blob : new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' }));
        const { error } = await supabase.storage.from(created.bucket).uploadToSignedUrl(p.path, p.token, jpeg, { contentType: 'image/jpeg' });
        if (error) throw isNetworkError(error) ? new OfflineError(error.message) : new Error(`העלאת תמונה נכשלה: ${error.message}`);
        done.add(p.key);
        draft.photosDone = Array.from(done);
        await saveDraft(draft);
      }
      onProgress('photos', 100);
    }

    // 3. Video — resumable TUS upload with the server-issued signed token.
    if (draft.video && created.video && !draft.videoDone) {
      onProgress('uploading', 0);
      const fileToSend = draft.video instanceof File ? draft.video : new File([draft.video], `video.${draft.videoExt}`, { type: draft.videoType });
      const tus = await import('tus-js-client');
      await new Promise<void>((resolve, reject) => {
        const upload = new tus.Upload(fileToSend, {
          endpoint: created.video!.uploadEndpoint,
          retryDelays: [0, 3000, 5000, 10000, 20000],
          chunkSize: 6 * 1024 * 1024,
          headers: { apikey: SUPABASE_ANON_KEY, 'x-signature': created.video!.uploadToken },
          uploadDataDuringCreation: true,
          storeFingerprintForResuming: false,
          metadata: {
            bucketName: created.bucket,
            objectName: created.video!.path,
            contentType: (draft.videoType || 'video/mp4').split(';')[0],
          },
          onError: (err) => reject(isNetworkError(err) ? new OfflineError(err.message) : err),
          onProgress: (uploaded, total) => onProgress('uploading', Math.round((uploaded / total) * 100)),
          onSuccess: () => resolve(),
        });
        upload.start();
      });
      draft.videoDone = true;
      await saveDraft(draft);
    }

    // 4. Complete — server verifies every file is there.
    onProgress('finishing', 0);
    await postJson(`${draft.apiBase}/${created.inspectionId}/complete`);
    await deleteDraft(draft.localId);
    return created.inspectionId;
  } catch (err) {
    const offline = err instanceof OfflineError || isNetworkError(err);
    draft.lastError = offline ? 'אין קליטה' : String((err as Error)?.message ?? err);
    await saveDraft(draft);
    if (offline) throw err instanceof OfflineError ? err : new OfflineError(String((err as Error)?.message ?? err));
    throw err;
  }
}

export function newLocalId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
