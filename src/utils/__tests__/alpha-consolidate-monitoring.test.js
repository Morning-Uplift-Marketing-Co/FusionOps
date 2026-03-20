/**
 * Unit tests for alpha-consolidate-monitoring.js
 */

import {
  groupByDomain,
  analyzeDomainTimeline,
  calculateStatistics,
  groupByTemplate,
  calculateTemplateStats,
} from '../../../scripts/alpha-consolidate-monitoring.js';

describe('alpha-consolidate-monitoring', () => {
  const mockMonitoringData = [
    {
      date: '2026-03-20',
      domainId: 'alpha-astro-001',
      status: { accountStatus: 'active', flagged: false, suspended: false },
    },
    {
      date: '2026-03-26',
      domainId: 'alpha-astro-001',
      status: { accountStatus: 'flagged', flagged: true, suspended: false },
    },
    {
      date: '2026-03-30',
      domainId: 'alpha-astro-001',
      status: { accountStatus: 'suspended', flagged: true, suspended: true },
    },
    {
      date: '2026-03-20',
      domainId: 'alpha-html-001',
      status: { accountStatus: 'active', flagged: false, suspended: false },
    },
    {
      date: '2026-03-24',
      domainId: 'alpha-html-001',
      status: { accountStatus: 'flagged', flagged: true, suspended: false },
    },
  ];

  const mockDetectionEvents = {
    events: [
      {
        domainId: 'alpha-astro-001',
        daysToFlag: 6,
        severity: 'medium',
        changeTypes: ['flagged'],
      },
      {
        domainId: 'alpha-html-001',
        daysToFlag: 4,
        severity: 'medium',
        changeTypes: ['flagged'],
      },
    ],
  };

  describe('groupByDomain', () => {
    it('should group monitoring data by domain', () => {
      const grouped = groupByDomain(mockMonitoringData);

      expect(Object.keys(grouped)).toContain('alpha-astro-001');
      expect(Object.keys(grouped)).toContain('alpha-html-001');
      expect(grouped['alpha-astro-001'].length).toBe(3);
      expect(grouped['alpha-html-001'].length).toBe(2);
    });
  });

  describe('analyzeDomainTimeline', () => {
    it('should analyze timeline for domain with detection', () => {
      const records = mockMonitoringData.filter(r => r.domainId === 'alpha-astro-001');
      const analysis = analyzeDomainTimeline('alpha-astro-001', records, mockDetectionEvents);

      expect(analysis.domainId).toBe('alpha-astro-001');
      expect(analysis.firstFlagDate).toBe('2026-03-26');
      expect(analysis.firstSuspendDate).toBe('2026-03-30');
      expect(analysis.finalStatus).toBe('suspended');
      expect(analysis.detectionEvent).toBeTruthy();
    });

    it('should have status timeline with transitions', () => {
      const records = mockMonitoringData.filter(r => r.domainId === 'alpha-astro-001');
      const analysis = analyzeDomainTimeline('alpha-astro-001', records, mockDetectionEvents);

      expect(analysis.statusTimeline.length).toBeGreaterThan(0);
      expect(analysis.statusTimeline[0].status).toBe('flagged');
    });
  });

  describe('calculateStatistics', () => {
    it('should calculate aggregate statistics', () => {
      const analyses = [
        analyzeDomainTimeline('alpha-astro-001', mockMonitoringData.filter(r => r.domainId === 'alpha-astro-001'), mockDetectionEvents),
        analyzeDomainTimeline('alpha-html-001', mockMonitoringData.filter(r => r.domainId === 'alpha-html-001'), mockDetectionEvents),
      ];

      const stats = calculateStatistics(analyses);

      expect(stats.totalDomains).toBe(2);
      expect(stats.flaggedCount).toBe(2);
      expect(stats.suspendedCount).toBe(1);
      expect(stats.activeCount).toBe(0);
    });

    it('should calculate days-to-flag statistics', () => {
      const analyses = [
        analyzeDomainTimeline('alpha-astro-001', mockMonitoringData.filter(r => r.domainId === 'alpha-astro-001'), mockDetectionEvents),
        analyzeDomainTimeline('alpha-html-001', mockMonitoringData.filter(r => r.domainId === 'alpha-html-001'), mockDetectionEvents),
      ];

      const stats = calculateStatistics(analyses);

      expect(stats.daysToFlagStats).toBeTruthy();
      expect(stats.daysToFlagStats.mean).toBe(5);
      expect(stats.daysToFlagStats.min).toBe(4);
      expect(stats.daysToFlagStats.max).toBe(6);
    });
  });

  describe('groupByTemplate', () => {
    it('should group domains by template type', () => {
      const analyses = [
        { domainId: 'alpha-astro-001', finalStatus: 'suspended' },
        { domainId: 'alpha-astro-002', finalStatus: 'active' },
        { domainId: 'alpha-vite-react-001', finalStatus: 'flagged' },
        { domainId: 'alpha-html-001', finalStatus: 'suspended' },
      ];

      const grouped = groupByTemplate(analyses);

      expect(Object.keys(grouped)).toContain('astro');
      expect(Object.keys(grouped)).toContain('vite-react');
      expect(Object.keys(grouped)).toContain('html');
      expect(grouped.astro.length).toBe(2);
      expect(grouped['vite-react'].length).toBe(1);
      expect(grouped.html.length).toBe(1);
    });
  });

  describe('calculateTemplateStats', () => {
    it('should calculate template-specific statistics', () => {
      const analyses = [
        {
          domainId: 'alpha-astro-001',
          finalStatus: 'suspended',
          firstFlagDate: '2026-03-26',
          detectionEvent: { daysToFlag: 6 },
        },
        {
          domainId: 'alpha-astro-002',
          finalStatus: 'active',
          firstFlagDate: null,
          detectionEvent: null,
        },
        {
          domainId: 'alpha-html-001',
          finalStatus: 'flagged',
          firstFlagDate: '2026-03-24',
          detectionEvent: { daysToFlag: 4 },
        },
      ];

      const grouped = groupByTemplate(analyses);
      const stats = calculateTemplateStats(grouped);

      expect(stats.astro).toBeTruthy();
      expect(stats.astro.count).toBe(2);
      expect(stats.astro.flaggedCount).toBe(1);
      expect(stats.astro.flaggingRate).toBe(50);
    });
  });
});
