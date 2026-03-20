/**
 * Unit tests for alpha-monitor.js
 */

import {
  fetchGoogleAdsStatus,
  detectStatusChange,
  calculateSeverity,
} from '../../../scripts/alpha-monitor.js';

describe('alpha-monitor', () => {
  describe('detectStatusChange', () => {
    it('should detect active to flagged transition', () => {
      const previous = {
        accountStatus: 'active',
        flagged: false,
        suspended: false,
        bidReductionPercentage: 0,
      };
      const current = {
        accountStatus: 'flagged',
        flagged: true,
        suspended: false,
        bidReductionPercentage: 50,
      };

      const changes = detectStatusChange(previous, current);
      expect(changes).toContain('flagged');
    });

    it('should detect flagged to suspended transition', () => {
      const previous = {
        accountStatus: 'flagged',
        flagged: true,
        suspended: false,
        bidReductionPercentage: 50,
      };
      const current = {
        accountStatus: 'suspended',
        flagged: true,
        suspended: true,
        bidReductionPercentage: 100,
      };

      const changes = detectStatusChange(previous, current);
      expect(changes).toContain('suspended');
      expect(changes).toContain('bid_reduction');
    });

    it('should detect bid reduction', () => {
      const previous = {
        accountStatus: 'flagged',
        flagged: true,
        suspended: false,
        bidReductionPercentage: 50,
      };
      const current = {
        accountStatus: 'flagged',
        flagged: true,
        suspended: false,
        bidReductionPercentage: 75,
      };

      const changes = detectStatusChange(previous, current);
      expect(changes).toContain('bid_reduction');
    });

    it('should return null when no changes detected', () => {
      const previous = {
        accountStatus: 'active',
        flagged: false,
        suspended: false,
        bidReductionPercentage: 0,
      };
      const current = {
        accountStatus: 'active',
        flagged: false,
        suspended: false,
        bidReductionPercentage: 0,
      };

      const changes = detectStatusChange(previous, current);
      expect(changes).toBeNull();
    });
  });

  describe('calculateSeverity', () => {
    it('should return critical for suspension', () => {
      const severity = calculateSeverity(['suspended']);
      expect(severity).toBe('critical');
    });

    it('should return medium for flagging', () => {
      const severity = calculateSeverity(['flagged']);
      expect(severity).toBe('medium');
    });

    it('should return low for bid reduction', () => {
      const severity = calculateSeverity(['bid_reduction']);
      expect(severity).toBe('low');
    });

    it('should prioritize suspension over flagging', () => {
      const severity = calculateSeverity(['flagged', 'suspended']);
      expect(severity).toBe('critical');
    });

    it('should return info for no changes', () => {
      const severity = calculateSeverity(null);
      expect(severity).toBe('info');
    });
  });
});
