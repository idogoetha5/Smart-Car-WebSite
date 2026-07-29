import { describe, it, expect } from 'vitest';
import { mapRow, VEHICLE_COLUMNS } from '../db/vehicles';

/**
 * The vehicle reads run through the service-role client, which RLS does not
 * constrain. `select('*')` therefore pulled every column — including
 * `license_plate` — and left mapRow as the only thing between the table and
 * the public JSON.
 *
 * These pin the two together. The list is only safe while it matches what
 * mapRow actually consumes: a column in the list that mapRow ignores is
 * fetched for nothing, and a column mapRow reads that is missing from the
 * list silently becomes undefined in the API response.
 */

const declared = VEHICLE_COLUMNS.split(',').map(c => c.trim()).filter(Boolean);

/** Records which properties mapRow touches, without assuming their types. */
function columnsReadByMapRow(): Set<string> {
  const accessed = new Set<string>();
  const spy = new Proxy(
    {},
    {
      get(_target, prop) {
        if (typeof prop === 'string') accessed.add(prop);
        return undefined;
      },
    },
  );
  mapRow(spy);
  return accessed;
}

describe('vehicle column allowlist', () => {
  it('never asks the database for the licence plate', () => {
    expect(declared).not.toContain('license_plate');
  });

  it('declares every column mapRow reads', () => {
    // A column mapRow reads but the query does not fetch comes back
    // undefined, which is a silently broken field rather than an error.
    const missing = [...columnsReadByMapRow()].filter(c => !declared.includes(c));
    expect(missing).toEqual([]);
  });

  it('does not fetch columns nothing maps', () => {
    const read = columnsReadByMapRow();
    const unused = declared.filter(c => !read.has(c));
    expect(unused).toEqual([]);
  });

  it('drops anything the query happens to return anyway', () => {
    // Belt and braces: even handed a row containing operational columns,
    // the mapped object must not carry them.
    const mapped = mapRow({
      id: 'v1',
      make: 'Toyota',
      model: 'Aygo X',
      license_plate: '12-345-67',
      internal_cost: 999,
    });
    expect(JSON.stringify(mapped)).not.toContain('12-345-67');
    expect(JSON.stringify(mapped)).not.toContain('999');
  });

  it('is a comma-separated list PostgREST can take verbatim', () => {
    expect(declared.length).toBeGreaterThan(0);
    for (const col of declared) expect(col).toMatch(/^[a-z_][a-z0-9_]*$/);
  });
});
