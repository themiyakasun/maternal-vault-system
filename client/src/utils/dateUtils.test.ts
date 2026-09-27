import { describe, it, expect } from 'vitest';
import { formatDisplayDate, formatDbDate } from './dateUtils';

describe('5. Frontend Date Utilities', () => {
  describe('formatDisplayDate()', () => {
    it('formats ISO database date to "DD MMM YYYY"', () => {
      expect(formatDisplayDate('2026-09-24')).toBe('24 Sep 2026');
      expect(formatDisplayDate('2026-01-05')).toBe('05 Jan 2026');
    });

    it('formats JavaScript Date instances', () => {
      const date = new Date(2026, 7, 15); // Aug 15, 2026
      expect(formatDisplayDate(date)).toBe('15 Aug 2026');
    });

    it('returns "—" for empty or undefined inputs', () => {
      expect(formatDisplayDate('')).toBe('—');
      expect(formatDisplayDate(null)).toBe('—');
      expect(formatDisplayDate(undefined)).toBe('—');
    });
  });

  describe('formatDbDate()', () => {
    it('normalizes dates to "YYYY-MM-DD"', () => {
      expect(formatDbDate('2026-09-24')).toBe('2026-09-24');
      expect(formatDbDate('24 Sep 2026')).toBe('2026-09-24');
    });

    it('returns today in YYYY-MM-DD if input is empty', () => {
      const today = new Date();
      const expectedPrefix = `${today.getFullYear()}-`;
      expect(formatDbDate('')).toContain(expectedPrefix);
    });
  });
});
