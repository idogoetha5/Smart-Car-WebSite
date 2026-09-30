import { describe, expect, it } from 'vitest';
import {
  evidenceError,
  parseDamageMarks,
  parseSidePhotoViews,
  photoKeyToPath,
  markPhotoPath,
  sidePhotoPath,
} from '../inspection-damage';
import { renderCarViewSvg, renderCarDiagramHtml } from '../car-diagram-shapes';

describe('evidenceError', () => {
  const base = { hasVideo: false, markCount: 0, noDamage: false, sidePhotoViews: [] as string[] };

  it('accepts a video alone', () => {
    expect(evidenceError({ ...base, hasVideo: true })).toBeNull();
  });
  it('accepts marked damage without a video', () => {
    expect(evidenceError({ ...base, markCount: 2 })).toBeNull();
  });
  it('accepts video and marks together', () => {
    expect(evidenceError({ ...base, hasVideo: true, markCount: 1 })).toBeNull();
  });
  it('rejects nothing at all', () => {
    expect(evidenceError(base)).toMatch(/סרטון/);
  });
  it('requires all 4 side photos for "no damage" without video', () => {
    expect(evidenceError({ ...base, noDamage: true, sidePhotoViews: ['front', 'rear'] })).toMatch(/צד ימין|צד שמאל/);
    expect(evidenceError({ ...base, noDamage: true, sidePhotoViews: ['front', 'rear', 'left', 'right'] })).toBeNull();
  });
  it('accepts "no damage" with a video and no photos', () => {
    expect(evidenceError({ ...base, hasVideo: true, noDamage: true })).toBeNull();
  });
  it('rejects marks together with "no damage"', () => {
    expect(evidenceError({ ...base, markCount: 1, noDamage: true })).not.toBeNull();
  });
});

describe('parseDamageMarks', () => {
  it('renumbers, clamps and trims', () => {
    const out = parseDamageMarks([
      { view: 'left', x: 1.4, y: -0.2, kind: 'dent', note: '  מכה בדלת  ', hasPhoto: true },
      { view: 'top', x: 0.5, y: 0.5, kind: 'scratch' },
    ]);
    expect(out).toEqual([
      { n: 1, view: 'left', x: 1, y: 0, kind: 'dent', note: 'מכה בדלת', hasPhoto: true },
      { n: 2, view: 'top', x: 0.5, y: 0.5, kind: 'scratch', note: '', hasPhoto: false },
    ]);
  });
  it('treats missing as empty', () => {
    expect(parseDamageMarks(undefined)).toEqual([]);
  });
  it('rejects bad view/kind/coords', () => {
    expect(parseDamageMarks([{ view: 'roof', x: 0, y: 0, kind: 'dent' }])).toBeNull();
    expect(parseDamageMarks([{ view: 'left', x: 0, y: 0, kind: 'fire' }])).toBeNull();
    expect(parseDamageMarks([{ view: 'left', x: 'a', y: 0, kind: 'dent' }])).toBeNull();
    expect(parseDamageMarks('nope')).toBeNull();
  });
});

describe('parseSidePhotoViews', () => {
  it('dedupes and validates', () => {
    expect(parseSidePhotoViews(['front', 'front', 'rear'])).toEqual(['front', 'rear']);
    expect(parseSidePhotoViews(['top'])).toBeNull();
  });
});

describe('photoKeyToPath', () => {
  const inspection = {
    id: 'c1',
    damage_marks: [
      { n: 1, view: 'left' as const, x: 0, y: 0, kind: 'dent' as const, note: '', photo_path: markPhotoPath('c1', 1) },
      { n: 2, view: 'top' as const, x: 0, y: 0, kind: 'dent' as const, note: '', photo_path: null },
    ],
    side_photos: { front: sidePhotoPath('c1', 'front') },
  };
  it('resolves only photos that belong to the inspection', () => {
    expect(photoKeyToPath(inspection, 'mark-1')).toBe('c1/marks/1.jpg');
    expect(photoKeyToPath(inspection, 'mark-2')).toBeNull();
    expect(photoKeyToPath(inspection, 'mark-9')).toBeNull();
    expect(photoKeyToPath(inspection, 'side-front')).toBe('c1/sides/front.jpg');
    expect(photoKeyToPath(inspection, 'side-rear')).toBeNull();
    expect(photoKeyToPath(inspection, '../other/video.mp4')).toBeNull();
  });
});

describe('car diagram svg', () => {
  it('draws numbered dots on the right view only', () => {
    const svg = renderCarViewSvg('left', [
      { n: 3, view: 'left', x: 0.5, y: 0.5, kind: 'dent', note: '' },
      { n: 4, view: 'rear', x: 0.5, y: 0.5, kind: 'dent', note: '' },
    ]);
    expect(svg).toContain('>3</text>');
    expect(svg).not.toContain('>4</text>');
  });
  it('renders all five views', () => {
    const html = renderCarDiagramHtml([]);
    expect(html.match(/<svg/g)?.length).toBe(5);
  });
});

import { parseChecklist, checklistRegressions, checklistEntries } from '../inspection-checklist';

describe('checklist', () => {
  it('keeps only known items with ok/bad, nothing required', () => {
    expect(parseChecklist({ lights: 'ok', gps: 'ok', tires: 'bad', mirrors: 'maybe' })).toEqual({ lights: 'ok', tires: 'bad' });
    expect(parseChecklist(undefined)).toEqual({});
    expect(parseChecklist(['x'])).toEqual({});
  });
  it('does not include GPS, antenna or service sticker', () => {
    const ids = checklistEntries(parseChecklist({ gps: 'ok', antenna: 'ok', service_sticker: 'ok' }));
    expect(ids).toEqual([]);
  });
  it('flags items that were ok at pickup and bad at return', () => {
    expect(checklistRegressions({ lights: 'ok', tires: 'ok', audio: 'bad' }, { lights: 'bad', tires: 'ok', audio: 'bad' })).toEqual(['lights']);
    expect(checklistRegressions(null, { lights: 'bad' })).toEqual([]);
  });
});
