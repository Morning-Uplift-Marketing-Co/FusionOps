/**
 * Unit tests for alpha-monitor.js
 */

const fs = require('fs');
const path = require('path');
const { DateTime } = require('luxon');
const {
  fetchGoogleAdsStatus,
  detectStatusChange,
  calculateSeverity,
} = require('../alpha-monitor');

describe('alpha-monitor', () => {
  describe('fetchGoogleAdsStatus', () => {
    it('should return active status for day 0', async () => {
      const status = await fetchGoogleAdsStatus(
        'https://example.com',
        '2026-03-20',
        'alpha-astro-001'
      );

      expect(status).toHaveProperty('accountStatus');
      expect(status.accountStatus).toBe('active');
      expect(status.flagged).toBe(false);
      expect(status.suspended).toBe(false);
    });

    it('should detect flagged status for astro-001 on day 6', async () => {
      const status = await fetchGoogleAdsStatus(
        'https://example.com',
        '2026-03-26',
        'alpha-astro-001'
      );

      expect(status.flagged).toBe(true);
      expect(status.accountStatus).toBe('flagged');
    });

    it('should detect suspended status for astro-001 on day 10', async () => {
      const status = await fetchGoogleAdsStatus(
        'https://example.com',
        '2026-03-30',
        'alpha-astro-001'
      );

      expect(status.suspended).toBe(true);
      expect(status.accountStatus).toBe('suspended');
    });

    it('should detect HTML early (day 4)', async () => {
      const status = await fetchGoogleAdsStatus(
        'https://example.com',
        '2026-03-24',
        'alpha-html-001'
      );

      expect(status.flagged).toBe(true);
    });

    it('should keep vite-react-004 active beyond day 28', async () => {
      const status = await fetchGoogleAdsStatus(
        'https://example.com',
        '2026-04-18',
        'alpha-vite-react-004'
      );

      expect(status.accountStatus).toBe('active');
      expect(status.flagged).toBe(false);
    });

    it('should include bid reduction percentage when flagged', async () => {
      const status = await fetchGoogleAdsStatus(
        'https://example.com',
        '2026-03-26',
        'alpha-astro-001'
      );

      expect(status.bidReductionPercentage).toBeGreaterThan(0);
    });

    it('should set conversionTrackingStatus to disabled when suspended', async () => {
      const status = await fetchGoogleAdsStatus(
        'https://example.com',
        '2026-03-30',
        'alpha-astro-001'
      );

      expect(status.conversionTrackingStatus).toBe('disabled');
    });
  });

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
