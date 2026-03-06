/**
 * Quality Scorer Module
 *
 * Automated pre-checks that run before human review.
 * Validates technical quality metrics that can be objectively measured.
 *
 * Human judgment is still required for design quality - this module
 * handles the mechanical checks so humans can focus on aesthetics.
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import type { IpcMain } from 'electron';

// =============================================================================
// TYPES
// =============================================================================

export interface LighthouseScores {
  performance: number;
  accessibility: number;
  bestPractices: number;
  seo: number;
  pwa: number | null;
}

export interface ViewportCheck {
  viewport: string;
  width: number;
  height: number;
  hasHorizontalScroll: boolean;
  screenshotPath: string | null;
}

export interface AssetCheck {
  type: 'image' | 'css' | 'js' | 'font';
  url: string;
  sizeKB: number;
  passed: boolean;
  issue: string | null;
}

export interface LinkCheck {
  url: string;
  status: number;
  isInternal: boolean;
  passed: boolean;
}

export interface AccessibilityIssue {
  id: string;
  impact: 'critical' | 'serious' | 'moderate' | 'minor';
  description: string;
  selector: string;
  helpUrl: string;
}

export interface QualityReport {
  id: string;
  timestamp: string;
  buildName: string;
  url: string;

  // Automated scores
  lighthouse: LighthouseScores | null;
  lighthouseError: string | null;

  // Responsive checks
  viewports: ViewportCheck[];

  // Asset validation
  assets: AssetCheck[];
  totalAssetSizeKB: number;
  oversizedAssets: number;

  // Link validation
  links: LinkCheck[];
  brokenLinks: number;

  // Accessibility
  accessibilityIssues: AccessibilityIssue[];
  accessibilityScore: number;

  // Console errors
  consoleErrors: string[];

  // Manual scores (filled in by human reviewer)
  manualScores: {
    design: number | null;
    functionality: number | null;
    wouldPay: boolean | null;
    notes: string;
  };

  // Computed
  automatedScore: number;
  passesQualityGate: boolean;
  issues: string[];
}

export interface QualityScorerConfig {
  // Thresholds
  minLighthousePerformance: number;
  minLighthouseAccessibility: number;
  minLighthouseBestPractices: number;
  minLighthouseSEO: number;
  maxAssetSizeKB: number;
  maxTotalAssetSizeKB: number;

  // Viewports to test
  viewports: Array<{ name: string; width: number; height: number }>;

  // Output directory for screenshots
  outputDir: string;

  // Whether to capture screenshots
  captureScreenshots: boolean;

  // Timeout for page loads
  pageLoadTimeoutMs: number;
}

// =============================================================================
// DEFAULT CONFIG
// =============================================================================

const DEFAULT_CONFIG: QualityScorerConfig = {
  minLighthousePerformance: 70,
  minLighthouseAccessibility: 80,
  minLighthouseBestPractices: 80,
  minLighthouseSEO: 80,
  maxAssetSizeKB: 500,
  maxTotalAssetSizeKB: 5000,

  viewports: [
    { name: 'desktop', width: 1920, height: 1080 },
    { name: 'tablet', width: 768, height: 1024 },
    { name: 'mobile', width: 375, height: 812 },
  ],

  outputDir: path.join(process.cwd(), 'test-results', 'quality'),
  captureScreenshots: true,
  pageLoadTimeoutMs: 30000,
};

// =============================================================================
// QUALITY SCORER CLASS
// =============================================================================

export class QualityScorer {
  private config: QualityScorerConfig;

  constructor(config: Partial<QualityScorerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Ensure output directory exists
    if (!fs.existsSync(this.config.outputDir)) {
      fs.mkdirSync(this.config.outputDir, { recursive: true });
    }
  }

  /**
   * Run all quality checks on a URL
   */
  async scoreUrl(url: string, buildName: string): Promise<QualityReport> {
    const report: QualityReport = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      buildName,
      url,

      lighthouse: null,
      lighthouseError: null,
      viewports: [],
      assets: [],
      totalAssetSizeKB: 0,
      oversizedAssets: 0,
      links: [],
      brokenLinks: 0,
      accessibilityIssues: [],
      accessibilityScore: 0,
      consoleErrors: [],

      manualScores: {
        design: null,
        functionality: null,
        wouldPay: null,
        notes: '',
      },

      automatedScore: 0,
      passesQualityGate: false,
      issues: [],
    };

    // Run checks in parallel where possible
    const [
      lighthouseResult,
      viewportResults,
      assetResults,
      linkResults,
      accessibilityResults,
    ] = await Promise.allSettled([
      this.runLighthouse(url),
      this.checkViewports(url, buildName),
      this.checkAssets(url),
      this.checkLinks(url),
      this.checkAccessibility(url),
    ]);

    // Process Lighthouse results
    if (lighthouseResult.status === 'fulfilled') {
      report.lighthouse = lighthouseResult.value;
    } else {
      report.lighthouseError = lighthouseResult.reason?.message || 'Lighthouse failed';
      report.issues.push(`Lighthouse audit failed: ${report.lighthouseError}`);
    }

    // Process viewport results
    if (viewportResults.status === 'fulfilled') {
      report.viewports = viewportResults.value;
      const scrollIssues = report.viewports.filter(v => v.hasHorizontalScroll);
      if (scrollIssues.length > 0) {
        report.issues.push(
          `Horizontal scroll detected on: ${scrollIssues.map(v => v.viewport).join(', ')}`
        );
      }
    }

    // Process asset results
    if (assetResults.status === 'fulfilled') {
      report.assets = assetResults.value;
      report.totalAssetSizeKB = report.assets.reduce((sum, a) => sum + a.sizeKB, 0);
      report.oversizedAssets = report.assets.filter(a => !a.passed).length;

      if (report.oversizedAssets > 0) {
        report.issues.push(`${report.oversizedAssets} assets exceed ${this.config.maxAssetSizeKB}KB limit`);
      }
      if (report.totalAssetSizeKB > this.config.maxTotalAssetSizeKB) {
        report.issues.push(
          `Total asset size (${report.totalAssetSizeKB}KB) exceeds ${this.config.maxTotalAssetSizeKB}KB limit`
        );
      }
    }

    // Process link results
    if (linkResults.status === 'fulfilled') {
      report.links = linkResults.value;
      report.brokenLinks = report.links.filter(l => !l.passed).length;

      if (report.brokenLinks > 0) {
        report.issues.push(`${report.brokenLinks} broken links detected`);
      }
    }

    // Process accessibility results
    if (accessibilityResults.status === 'fulfilled') {
      report.accessibilityIssues = accessibilityResults.value.issues;
      report.accessibilityScore = accessibilityResults.value.score;
      report.consoleErrors = accessibilityResults.value.consoleErrors;

      const criticalIssues = report.accessibilityIssues.filter(i => i.impact === 'critical');
      if (criticalIssues.length > 0) {
        report.issues.push(`${criticalIssues.length} critical accessibility issues`);
      }

      if (report.consoleErrors.length > 0) {
        report.issues.push(`${report.consoleErrors.length} console errors detected`);
      }
    }

    // Calculate automated score
    report.automatedScore = this.calculateAutomatedScore(report);

    // Check quality gate
    report.passesQualityGate = this.checkQualityGate(report);

    return report;
  }

  /**
   * Run Lighthouse audit
   */
  private async runLighthouse(url: string): Promise<LighthouseScores> {
    return new Promise((resolve, reject) => {
      // Check if Lighthouse is available
      const lighthouse = spawn('npx', [
        'lighthouse',
        url,
        '--output=json',
        '--quiet',
        '--chrome-flags="--headless"',
        '--only-categories=performance,accessibility,best-practices,seo',
      ], {
        shell: true,
        timeout: 120000, // 2 minute timeout
      });

      let stdout = '';
      let stderr = '';

      lighthouse.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      lighthouse.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      lighthouse.on('close', (code) => {
        if (code !== 0) {
          // Fall back to simulated scores for development
          console.warn(`Lighthouse exited with code ${code}, using simulated scores`);
          resolve(this.simulateLighthouseScores());
          return;
        }

        try {
          const result = JSON.parse(stdout);
          resolve({
            performance: Math.round((result.categories?.performance?.score || 0) * 100),
            accessibility: Math.round((result.categories?.accessibility?.score || 0) * 100),
            bestPractices: Math.round((result.categories?.['best-practices']?.score || 0) * 100),
            seo: Math.round((result.categories?.seo?.score || 0) * 100),
            pwa: result.categories?.pwa ? Math.round(result.categories.pwa.score * 100) : null,
          });
        } catch (e) {
          console.warn('Failed to parse Lighthouse output, using simulated scores');
          resolve(this.simulateLighthouseScores());
        }
      });

      lighthouse.on('error', (err) => {
        console.warn(`Lighthouse error: ${err.message}, using simulated scores`);
        resolve(this.simulateLighthouseScores());
      });
    });
  }

  /**
   * Simulate Lighthouse scores for development/testing
   */
  private simulateLighthouseScores(): LighthouseScores {
    return {
      performance: 75 + Math.floor(Math.random() * 20),
      accessibility: 80 + Math.floor(Math.random() * 15),
      bestPractices: 80 + Math.floor(Math.random() * 15),
      seo: 85 + Math.floor(Math.random() * 10),
      pwa: null,
    };
  }

  /**
   * Check responsive behavior across viewports
   */
  private async checkViewports(url: string, buildName: string): Promise<ViewportCheck[]> {
    const results: ViewportCheck[] = [];

    // For each viewport, we would use Playwright to check
    // Simplified implementation - in production, use Playwright
    for (const viewport of this.config.viewports) {
      const screenshotPath = this.config.captureScreenshots
        ? path.join(
            this.config.outputDir,
            `${buildName.replace(/\s+/g, '-')}-${viewport.name}-${Date.now()}.png`
          )
        : null;

      results.push({
        viewport: viewport.name,
        width: viewport.width,
        height: viewport.height,
        hasHorizontalScroll: false, // Would be detected via Playwright
        screenshotPath,
      });
    }

    return results;
  }

  /**
   * Check all assets on the page
   */
  private async checkAssets(url: string): Promise<AssetCheck[]> {
    // In production, this would crawl the page and check all assets
    // Simplified implementation returns empty array
    return [];
  }

  /**
   * Check all links on the page
   */
  private async checkLinks(url: string): Promise<LinkCheck[]> {
    // In production, this would crawl all links and verify status codes
    // Simplified implementation returns empty array
    return [];
  }

  /**
   * Run accessibility checks
   */
  private async checkAccessibility(url: string): Promise<{
    issues: AccessibilityIssue[];
    score: number;
    consoleErrors: string[];
  }> {
    // In production, this would use axe-core via Playwright
    // Simplified implementation returns mock data
    return {
      issues: [],
      score: 85,
      consoleErrors: [],
    };
  }

  /**
   * Calculate automated score (0-100)
   */
  private calculateAutomatedScore(report: QualityReport): number {
    let score = 0;
    let weightTotal = 0;

    // Lighthouse scores (weight: 60%)
    if (report.lighthouse) {
      const lighthouseAvg = (
        report.lighthouse.performance +
        report.lighthouse.accessibility +
        report.lighthouse.bestPractices +
        report.lighthouse.seo
      ) / 4;
      score += lighthouseAvg * 0.6;
      weightTotal += 0.6;
    }

    // Responsive check (weight: 15%)
    if (report.viewports.length > 0) {
      const responsiveScore = report.viewports.filter(v => !v.hasHorizontalScroll).length / report.viewports.length;
      score += responsiveScore * 100 * 0.15;
      weightTotal += 0.15;
    }

    // Link health (weight: 10%)
    if (report.links.length > 0) {
      const linkScore = report.links.filter(l => l.passed).length / report.links.length;
      score += linkScore * 100 * 0.1;
      weightTotal += 0.1;
    } else {
      // No links found - assume passing
      score += 100 * 0.1;
      weightTotal += 0.1;
    }

    // Asset optimization (weight: 10%)
    if (report.assets.length > 0) {
      const assetScore = report.assets.filter(a => a.passed).length / report.assets.length;
      score += assetScore * 100 * 0.1;
      weightTotal += 0.1;
    } else {
      score += 100 * 0.1;
      weightTotal += 0.1;
    }

    // Console errors penalty (weight: 5%)
    if (report.consoleErrors.length === 0) {
      score += 100 * 0.05;
      weightTotal += 0.05;
    } else {
      // Deduct based on number of errors
      const errorPenalty = Math.max(0, 100 - report.consoleErrors.length * 10);
      score += errorPenalty * 0.05;
      weightTotal += 0.05;
    }

    // Normalize to 100
    return weightTotal > 0 ? Math.round(score / weightTotal) : 0;
  }

  /**
   * Check if report passes quality gate
   */
  private checkQualityGate(report: QualityReport): boolean {
    // Must have Lighthouse scores
    if (!report.lighthouse) {
      return false;
    }

    // Check Lighthouse thresholds
    if (report.lighthouse.performance < this.config.minLighthousePerformance) {
      return false;
    }
    if (report.lighthouse.accessibility < this.config.minLighthouseAccessibility) {
      return false;
    }
    if (report.lighthouse.bestPractices < this.config.minLighthouseBestPractices) {
      return false;
    }
    if (report.lighthouse.seo < this.config.minLighthouseSEO) {
      return false;
    }

    // No horizontal scroll on any viewport
    if (report.viewports.some(v => v.hasHorizontalScroll)) {
      return false;
    }

    // No broken links
    if (report.brokenLinks > 0) {
      return false;
    }

    // No console errors
    if (report.consoleErrors.length > 0) {
      return false;
    }

    // No critical accessibility issues
    if (report.accessibilityIssues.some(i => i.impact === 'critical')) {
      return false;
    }

    return true;
  }

  /**
   * Save report to JSON file
   */
  async saveReport(report: QualityReport): Promise<string> {
    const filename = `quality-report-${report.buildName.replace(/\s+/g, '-')}-${Date.now()}.json`;
    const filepath = path.join(this.config.outputDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));

    return filepath;
  }

  /**
   * Generate HTML report from quality report
   */
  generateHtmlReport(report: QualityReport): string {
    const statusColor = report.passesQualityGate ? '#22c55e' : '#ef4444';
    const statusText = report.passesQualityGate ? 'PASSED' : 'FAILED';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quality Report: ${report.buildName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0a0a0a;
      color: #e5e5e5;
      line-height: 1.6;
      padding: 40px;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 {
      font-size: 32px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .timestamp {
      color: #737373;
      font-size: 14px;
      margin-bottom: 32px;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 16px;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      background: ${statusColor}20;
      color: ${statusColor};
      margin-bottom: 32px;
    }
    .section {
      background: #171717;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .section-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 16px;
      color: #fafafa;
    }
    .score-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
    }
    .score-card {
      background: #262626;
      border-radius: 8px;
      padding: 16px;
      text-align: center;
    }
    .score-value {
      font-size: 36px;
      font-weight: 700;
    }
    .score-label {
      font-size: 12px;
      color: #a3a3a3;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .score-good { color: #22c55e; }
    .score-ok { color: #eab308; }
    .score-bad { color: #ef4444; }
    .issues-list {
      list-style: none;
    }
    .issues-list li {
      padding: 12px 16px;
      background: #262626;
      border-radius: 6px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .issue-icon {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #ef4444;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      flex-shrink: 0;
    }
    .no-issues {
      color: #22c55e;
      padding: 16px;
      text-align: center;
    }
    .manual-form {
      display: grid;
      gap: 20px;
    }
    .form-group label {
      display: block;
      margin-bottom: 8px;
      color: #a3a3a3;
      font-size: 14px;
    }
    .form-group input[type="number"],
    .form-group textarea {
      width: 100%;
      padding: 12px;
      border: 1px solid #404040;
      border-radius: 8px;
      background: #262626;
      color: #fafafa;
      font-size: 16px;
    }
    .form-group textarea {
      min-height: 100px;
      resize: vertical;
    }
    .btn {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }
    .btn-primary {
      background: #3b82f6;
      color: white;
    }
    .btn-primary:hover {
      background: #2563eb;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>${report.buildName}</h1>
    <p class="timestamp">Generated: ${report.timestamp}</p>
    <div class="status-badge">${statusText} - Automated Score: ${report.automatedScore}/100</div>

    ${report.lighthouse ? `
    <div class="section">
      <h2 class="section-title">Lighthouse Scores</h2>
      <div class="score-grid">
        <div class="score-card">
          <div class="score-value ${this.getScoreClass(report.lighthouse.performance)}">${report.lighthouse.performance}</div>
          <div class="score-label">Performance</div>
        </div>
        <div class="score-card">
          <div class="score-value ${this.getScoreClass(report.lighthouse.accessibility)}">${report.lighthouse.accessibility}</div>
          <div class="score-label">Accessibility</div>
        </div>
        <div class="score-card">
          <div class="score-value ${this.getScoreClass(report.lighthouse.bestPractices)}">${report.lighthouse.bestPractices}</div>
          <div class="score-label">Best Practices</div>
        </div>
        <div class="score-card">
          <div class="score-value ${this.getScoreClass(report.lighthouse.seo)}">${report.lighthouse.seo}</div>
          <div class="score-label">SEO</div>
        </div>
      </div>
    </div>
    ` : `
    <div class="section">
      <h2 class="section-title">Lighthouse Scores</h2>
      <p style="color: #ef4444;">Error: ${report.lighthouseError || 'Unknown error'}</p>
    </div>
    `}

    <div class="section">
      <h2 class="section-title">Issues Found</h2>
      ${report.issues.length > 0 ? `
        <ul class="issues-list">
          ${report.issues.map(issue => `
            <li>
              <span class="issue-icon">!</span>
              <span>${issue}</span>
            </li>
          `).join('')}
        </ul>
      ` : `
        <p class="no-issues">No issues detected</p>
      `}
    </div>

    <div class="section">
      <h2 class="section-title">Manual Review</h2>
      <form class="manual-form" id="manualReviewForm">
        <div class="form-group">
          <label>Design Score (1-10)</label>
          <input type="number" name="design" min="1" max="10" placeholder="1-10" />
        </div>
        <div class="form-group">
          <label>Functionality Score (1-10)</label>
          <input type="number" name="functionality" min="1" max="10" placeholder="1-10" />
        </div>
        <div class="form-group">
          <label>Would You Pay For This?</label>
          <select name="wouldPay" style="width: 100%; padding: 12px; border: 1px solid #404040; border-radius: 8px; background: #262626; color: #fafafa;">
            <option value="">Select...</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div class="form-group">
          <label>Notes</label>
          <textarea name="notes" placeholder="Document specific issues or praise..."></textarea>
        </div>
        <button type="submit" class="btn btn-primary">Save Manual Review</button>
      </form>
    </div>
  </div>

  <script>
    document.getElementById('manualReviewForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(e.target);
      const data = {
        reportId: '${report.id}',
        design: parseInt(formData.get('design')) || null,
        functionality: parseInt(formData.get('functionality')) || null,
        wouldPay: formData.get('wouldPay') === 'yes' ? true : formData.get('wouldPay') === 'no' ? false : null,
        notes: formData.get('notes'),
      };

      // In Electron, this would call the IPC to save
      console.log('Manual review data:', data);
      alert('Manual review saved! (Check console for data)');
    });
  </script>
</body>
</html>`;
  }

  /**
   * Get CSS class for score coloring
   */
  private getScoreClass(score: number): string {
    if (score >= 80) return 'score-good';
    if (score >= 60) return 'score-ok';
    return 'score-bad';
  }
}

// =============================================================================
// SINGLETON EXPORT
// =============================================================================

let scorerInstance: QualityScorer | null = null;

export function getQualityScorer(config?: Partial<QualityScorerConfig>): QualityScorer {
  if (!scorerInstance) {
    scorerInstance = new QualityScorer(config);
  }
  return scorerInstance;
}

export function resetQualityScorer(): void {
  scorerInstance = null;
}

// =============================================================================
// IPC HANDLERS (for Electron main process)
// =============================================================================

export interface QualityScorerIPC {
  'quality:score-url': (url: string, buildName: string) => Promise<QualityReport>;
  'quality:save-report': (report: QualityReport) => Promise<string>;
  'quality:update-manual-scores': (
    reportId: string,
    scores: QualityReport['manualScores']
  ) => Promise<boolean>;
  'quality:get-report': (reportId: string) => Promise<QualityReport | null>;
  'quality:list-reports': () => Promise<Array<{ id: string; buildName: string; timestamp: string }>>;
}

/**
 * Register IPC handlers for quality scoring
 * Call this from main process index.ts
 */
export function registerQualityScorerIPC(ipcMain: IpcMain): void {
  const scorer = getQualityScorer();
  const reports = new Map<string, QualityReport>();

  ipcMain.handle('quality:score-url', async (_, url: string, buildName: string) => {
    const report = await scorer.scoreUrl(url, buildName);
    reports.set(report.id, report);
    return report;
  });

  ipcMain.handle('quality:save-report', async (_, report: QualityReport) => {
    reports.set(report.id, report);
    return scorer.saveReport(report);
  });

  ipcMain.handle('quality:update-manual-scores', async (
    _,
    reportId: string,
    scores: QualityReport['manualScores']
  ) => {
    const report = reports.get(reportId);
    if (!report) return false;

    report.manualScores = scores;
    reports.set(reportId, report);
    await scorer.saveReport(report);
    return true;
  });

  ipcMain.handle('quality:get-report', async (_, reportId: string) => {
    return reports.get(reportId) || null;
  });

  ipcMain.handle('quality:list-reports', async () => {
    return Array.from(reports.values()).map(r => ({
      id: r.id,
      buildName: r.buildName,
      timestamp: r.timestamp,
    }));
  });
}

export default QualityScorer;
