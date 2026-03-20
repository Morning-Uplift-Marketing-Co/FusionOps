#!/usr/bin/env node

/**
 * Performance Benchmarking for Phase 3 Vector Pipeline
 *
 * Tests build time overhead and memory usage at varying concurrency levels.
 *
 * Usage:
 *   node scripts/benchmark.js
 *   node scripts/benchmark.js --levels 20,40,50,60
 */

import { JavaScriptObfuscator } from '../src/services/obfuscation-transform.js';
import { NetworkRandomizer } from '../src/services/network-randomization.js';
import { EventRandomizer } from '../src/services/event-randomization.js';
import fs from 'fs';

/**
 * Sample HTML for benchmarking
 */
const sampleHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Benchmark Test</title>
  <script>
    const config = {
      apiUrl: 'https://api.example.com',
      trackingId: 'test-123',
      features: ['feature1', 'feature2', 'feature3']
    };

    function initTracking() {
      console.log('Initializing tracking');
      window.trackingEvents = [];
    }

    function trackEvent(name, data) {
      window.trackingEvents.push({ name, data, timestamp: Date.now() });
      navigator.sendBeacon('/tracking', JSON.stringify({ name, data }));
    }

    initTracking();
  </script>
</head>
<body>
  <h1>Landing Page</h1>
  <p>This is a test landing page for benchmarking</p>

  <form id="main-form" data-form="true">
    <input type="email" name="email" placeholder="Enter email" data-validate="email" />
    <input type="text" name="name" placeholder="Your name" />
    <textarea name="message" placeholder="Message"></textarea>
    <button type="submit" data-submit="true">Submit</button>
  </form>

  <div class="social-proof" data-pixel="true" data-tracking="conversion">
    <h3>Recent Conversions</h3>
    <ul id="conversions-list"></ul>
  </div>

  <script>
    document.getElementById('main-form').addEventListener('submit', function(e) {
      e.preventDefault();
      trackEvent('form_submit', {
        email: this.email.value,
        name: this.name.value
      });
      this.submit();
    });

    document.querySelectorAll('[data-pixel]').forEach(el => {
      el.addEventListener('click', () => {
        trackEvent('pixel_click', { element: el.className });
      });
    });

    trackEvent('page_view', {});
  </script>
</body>
</html>
`;

/**
 * Benchmark concurrent vector transformations
 */
async function benchmarkConcurrentTransforms(concurrencyLevel) {
  const startTime = performance.now();
  const startMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB

  const promises = [];

  for (let i = 0; i < concurrencyLevel; i++) {
    const siteId = `benchmark-site-${i}`;

    // Create a promise chain that applies all vectors
    const transformPromise = (async () => {
      let html = sampleHtml;

      // Apply obfuscation
      const obfuscResult = await JavaScriptObfuscator.transform(html, siteId, {
        level: 'moderate'
      });
      html = obfuscResult.html;

      // Apply network jitter
      const networkResult = NetworkRandomizer.transform(html, siteId, {
        min: 50,
        max: 500
      });
      html = networkResult.html;

      // Apply event randomization
      const eventResult = await EventRandomizer.transform(html, siteId, {
        enabled: true
      });
      html = eventResult.html;

      return {
        siteId,
        size: html.length,
        success: true
      };
    })();

    promises.push(transformPromise);
  }

  const results = await Promise.all(promises);

  const endTime = performance.now();
  const endMemory = process.memoryUsage().heapUsed / 1024 / 1024; // MB
  const totalTime = endTime - startTime;

  return {
    concurrency: concurrencyLevel,
    totalTime: totalTime,
    avgTimePerBuild: totalTime / concurrencyLevel,
    avgOutputSize: results.reduce((sum, r) => sum + r.size, 0) / results.length,
    memoryUsed: endMemory - startMemory,
    memoryPeakPercent: (endMemory / 1024) * 100 // Assume 1GB total available
  };
}

/**
 * Run comprehensive benchmarks
 */
async function runBenchmarks() {
  console.log('=== Phase 3 Vector Pipeline Performance Benchmarking ===\n');
  console.log(`Baseline HTML size: ${sampleHtml.length} bytes`);
  console.log(`Vectors: JavaScript obfuscation + Network jitter + Event randomization\n`);

  const levels = [20, 40, 50];
  const results = [];

  console.log('Running benchmarks...\n');

  for (const level of levels) {
    console.log(`Testing ${level} concurrent builds...`);
    try {
      const result = await benchmarkConcurrentTransforms(level);
      results.push(result);

      console.log(`  Total time: ${result.totalTime.toFixed(0)}ms`);
      console.log(`  Avg per build: ${result.avgTimePerBuild.toFixed(0)}ms`);
      console.log(`  Avg output size: ${result.avgOutputSize.toFixed(0)} bytes`);
      console.log(`  Memory delta: ${result.memoryUsed.toFixed(2)}MB`);
      console.log(`  Peak memory: ${result.memoryPeakPercent.toFixed(1)}%`);
      console.log('');

      // Alert if peak memory >90%
      if (result.memoryPeakPercent > 90) {
        console.warn(`  ⚠️  Peak memory >90%! Consider implementing build queue.`);
      }
    } catch (error) {
      console.error(`  ✗ Benchmark failed: ${error.message}`);
      results.push({
        concurrency: level,
        error: error.message
      });
    }
  }

  // Summary
  console.log('=== Benchmark Summary ===\n');
  console.log('Performance Targets:');
  console.log(`  Build time overhead: <15% increase from baseline`);
  console.log(`  Peak memory usage: <90% of available\n`);

  const successfulResults = results.filter(r => !r.error);
  const allMemoryOk = successfulResults.every(r => r.memoryPeakPercent < 90);
  const allTimeOk = successfulResults.every(r => r.totalTime < sampleHtml.length * 0.15);

  if (allMemoryOk) {
    console.log('✓ Memory usage: All tests passed (<90% peak)');
  } else {
    console.log('✗ Memory usage: Some tests exceeded 90% peak');
  }

  if (allTimeOk) {
    console.log('✓ Build time: All tests within target overhead');
  } else {
    console.log('✗ Build time: Some tests exceeded target overhead');
  }

  console.log('');

  // Output results to file
  const benchmarkResults = {
    timestamp: new Date().toISOString(),
    baselineHtmlSize: sampleHtml.length,
    vectors: {
      obfuscate: true,
      networkJitter: true,
      eventRandomization: true
    },
    results: successfulResults.map(r => ({
      concurrency: r.concurrency,
      totalTimeMs: r.totalTime,
      avgTimePerBuildMs: r.avgTimePerBuild,
      avgOutputSizeBytes: r.avgOutputSize,
      memoryDeltaMB: r.memoryUsed,
      peakMemoryPercent: r.memoryPeakPercent
    })),
    targets: {
      maxBuildTimeOverhead: '15%',
      maxPeakMemoryPercent: 90
    },
    summary: {
      memoryPassed: allMemoryOk,
      timingPassed: allTimeOk,
      overallPassed: allMemoryOk && allTimeOk
    }
  };

  const resultsPath = '.planning/alpha-test/benchmark-results-phase3.json';
  fs.writeFileSync(resultsPath, JSON.stringify(benchmarkResults, null, 2));
  console.log(`Benchmark results saved to: ${resultsPath}\n`);

  // Return success/failure
  return benchmarkResults.summary.overallPassed ? 0 : 1;
}

// Run benchmarks
runBenchmarks()
  .then(exitCode => process.exit(exitCode))
  .catch(error => {
    console.error('Benchmarking failed:', error);
    process.exit(1);
  });
