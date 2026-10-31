import { describe, expect, it } from 'vitest';
import { createId } from './ids';

describe('createId', () => {
  it('creates valid version 4 UUIDs', () => {
    expect(createId()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('does not repeat', () => {
    const ids = new Set(Array.from({ length: 1000 }, createId));
    expect(ids.size).toBe(1000);
  });
});
