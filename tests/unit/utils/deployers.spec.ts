import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DEPLOY_TARGETS,
  getAvailableTargets,
  getDeploymentHistory,
  getDeploymentStats,
  saveDeployConfig,
  getDeployConfig,
} from '../../../src/utils/deployers';
import { LS } from '../../../src/utils';

// Mock the fetch API
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Deployers Module', () => {
  afterEach(() => {
    // Only clear fetch mock between tests
    mockFetch.mockReset();
  });

  describe('DEPLOY_TARGETS', () => {
    it('should have all expected deploy targets', () => {
      expect(DEPLOY_TARGETS).toHaveLength(7);
    });

    it('should have required target IDs', () => {
      const targetIds = DEPLOY_TARGETS.map(t => t.id);
      expect(targetIds).toContain('cf-pages');
      expect(targetIds).toContain('netlify');
      expect(targetIds).toContain('vercel');
      expect(targetIds).toContain('cf-workers');
      expect(targetIds).toContain('s3-cloudfront');
      expect(targetIds).toContain('vps-ssh');
      expect(targetIds).toContain('git-push');
    });

    it('should have unique priorities', () => {
      const priorities = DEPLOY_TARGETS.map(t => t.priority);
      const uniquePriorities = new Set(priorities);
      expect(uniquePriorities.size).toBe(7);
    });
  });

  describe('getAvailableTargets()', () => {
    it('should return all targets with configured flag', () => {
      const settings = {};
      const available = getAvailableTargets(settings);
      expect(available).toHaveLength(7);
      available.forEach(target => {
        expect(target).toHaveProperty('configured');
        expect(typeof target.configured).toBe('boolean');
      });
    });

    it('should detect Cloudflare Pages config', () => {
      const settings = {
        cfApiToken: 'test-token',
        cfAccountId: 'test-account',
      };
      const available = getAvailableTargets(settings);
      const cfPages = available.find(t => t.id === 'cf-pages');
      expect(cfPages?.configured).toBe(true);
    });

    it('should detect Netlify config', () => {
      const settings = { netlifyToken: 'test-token' };
      const available = getAvailableTargets(settings);
      const netlify = available.find(t => t.id === 'netlify');
      expect(netlify?.configured).toBe(true);
    });

    it('should detect Vercel config', () => {
      const settings = { vercelToken: 'test-token' };
      const available = getAvailableTargets(settings);
      const vercel = available.find(t => t.id === 'vercel');
      expect(vercel?.configured).toBe(true);
    });

    it('should detect S3 + CloudFront config', () => {
      const settings = {
        awsAccessKey: 'test-key',
        awsSecretKey: 'test-secret',
        s3Bucket: 'test-bucket',
      };
      const available = getAvailableTargets(settings);
      const s3 = available.find(t => t.id === 's3-cloudfront');
      expect(s3?.configured).toBe(true);
    });

    it('should detect VPS SSH config', () => {
      const settings = {
        vpsHost: 'test.com',
        vpsUser: 'user',
        vpsPath: '/var/www',
        workerBaseUrl: 'https://worker.com',
      };
      const available = getAvailableTargets(settings);
      const vps = available.find(t => t.id === 'vps-ssh');
      expect(vps?.configured).toBe(true);
    });

    it('should detect Git Push config', () => {
      const settings = {
        githubRepoOwner: 'owner',
        githubRepoName: 'repo',
      };
      const available = getAvailableTargets(settings);
      const gitPush = available.find(t => t.id === 'git-push');
      expect(gitPush?.configured).toBe(true);
    });

    it('should return all unconfigured when settings empty', () => {
      const settings = {};
      const available = getAvailableTargets(settings);
      available.forEach(target => {
        expect(target.configured).toBe(false);
      });
    });
  });

  describe('getDeploymentHistory()', () => {
    beforeEach(() => {
      localStorage.clear();
      const mockHistory = [
        {
          id: 'deploy-1',
          timestamp: '2024-01-01T12:00:00Z',
          domain: 'test.com',
          siteId: 'site-1',
          target: 'cf-pages',
          status: 'success',
          url: 'https://test.com',
          duration: 5000,
        },
        {
          id: 'deploy-2',
          timestamp: '2024-01-02T12:00:00Z',
          domain: 'example.com',
          siteId: 'site-2',
          target: 'netlify',
          status: 'failed',
          error: 'Deployment failed',
          duration: 3000,
        },
      ];
      LS.set('lpf2-deploy-history', mockHistory);
    });

    it('should return deployment history', async () => {
      const history = await getDeploymentHistory();
      expect(history).toHaveLength(2);
    });

    it('should filter by domain', async () => {
      const history = await getDeploymentHistory('test.com');
      expect(history).toHaveLength(1);
      expect(history[0].domain).toBe('test.com');
    });

    it('should filter by target', async () => {
      const history = await getDeploymentHistory(null, 'cf-pages');
      expect(history).toHaveLength(1);
      expect(history[0].target).toBe('cf-pages');
    });

    it('should filter by status', async () => {
      const history = await getDeploymentHistory(null, null, 'success');
      expect(history).toHaveLength(1);
      expect(history[0].status).toBe('success');
    });

    it('should limit results', async () => {
      const history = await getDeploymentHistory(null, null, null, 1);
      expect(history.length).toBeLessThanOrEqual(1);
    });

    it('should return empty array when no history', async () => {
      LS.set('lpf2-deploy-history', []);
      const history = await getDeploymentHistory();
      expect(history).toEqual([]);
    });

    it('should handle localStorage errors gracefully', async () => {
      const spy = vi.spyOn(LS, 'get').mockReturnValue(null);
      const history = await getDeploymentHistory();
      expect(Array.isArray(history)).toBe(true);
      spy.mockRestore();
    });
  });

  describe('getDeploymentStats()', () => {
    beforeEach(() => {
      localStorage.clear();
      const now = Date.now();
      const mockHistory = [
        {
          id: 'deploy-1',
          timestamp: new Date(now - 1000).toISOString(),
          domain: 'test.com',
          target: 'cf-pages',
          status: 'success',
          duration: 5000,
        },
        {
          id: 'deploy-2',
          timestamp: new Date(now - 86400000).toISOString(),
          domain: 'test.com',
          target: 'netlify',
          status: 'success',
          duration: 3000,
        },
        {
          id: 'deploy-3',
          timestamp: new Date(now - 172800000).toISOString(),
          domain: 'test.com',
          target: 'vercel',
          status: 'failed',
          duration: 2000,
        },
      ];
      LS.set('lpf2-deploy-history', mockHistory);
    });

    it('should calculate total deployments', async () => {
      const stats = await getDeploymentStats();
      expect(stats.total).toBe(3);
    });

    it('should calculate successful deployments', async () => {
      const stats = await getDeploymentStats();
      expect(stats.successful).toBe(2);
    });

    it('should calculate failed deployments', async () => {
      const stats = await getDeploymentStats();
      expect(stats.failed).toBe(1);
    });

    it('should calculate success rate', async () => {
      const stats = await getDeploymentStats();
      expect(stats.successRate).toBe(67);
    });

    it('should calculate average duration', async () => {
      const stats = await getDeploymentStats();
      expect(stats.avgDurationMs).toBe(3333);
    });

    it('should count deployments by target', async () => {
      const stats = await getDeploymentStats();
      expect(stats.byTarget['cf-pages']).toBe(1);
      expect(stats.byTarget['netlify']).toBe(1);
      expect(stats.byTarget['vercel']).toBe(1);
    });

    it('should return zero stats for empty history', async () => {
      LS.set('lpf2-deploy-history', []);
      const stats = await getDeploymentStats();
      expect(stats.total).toBe(0);
      expect(stats.successful).toBe(0);
      expect(stats.failed).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.avgDurationMs).toBe(0);
    });
  });

  describe('saveDeployConfig()', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('should save config to localStorage fallback on API error', async () => {
      mockFetch.mockRejectedValue(new Error('API unavailable'));

      await saveDeployConfig('site-1', 'cf-pages', {
        branch: 'main',
        root: true,
      });

      const configs = LS.get('lpf2-deploy-configs');
      expect(configs).toBeTruthy();
      expect(configs['site-1-cf-pages']).toMatchObject({
        branch: 'main',
        root: true,
      });
    });

    it('should call API with correct parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await saveDeployConfig('site-1', 'netlify', {
        siteId: 'netlify-site',
      });

      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs[0]).toContain('/api/ops/deploy-configs');
    });
  });

  describe('getDeployConfig()', () => {
    beforeEach(() => {
      localStorage.clear();
      LS.set('lpf2-deploy-configs', {
        'site-1-cf-pages': {
          branch: 'main',
          root: true,
          updatedAt: '2024-01-01T00:00:00Z',
        },
      });
    });

    it('should retrieve config from localStorage fallback', async () => {
      mockFetch.mockRejectedValue(new Error('API unavailable'));

      const config = await getDeployConfig('site-1', 'cf-pages');

      expect(config).toMatchObject({
        branch: 'main',
        root: true,
      });
    });

    it('should return null for non-existent config', async () => {
      mockFetch.mockRejectedValue(new Error('API unavailable'));

      const config = await getDeployConfig('site-999', 'vercel');

      expect(config).toBeNull();
    });

    it('should handle malformed localStorage data', async () => {
      LS.set('lpf2-deploy-configs', null);
      mockFetch.mockRejectedValue(new Error('API unavailable'));

      const config = await getDeployConfig('site-1', 'cf-pages');

      expect(config).toBeNull();
    });
  });
});
