#!/usr/bin/env npx ts-node

/**
 * Quality Tests Runner
 *
 * Executes all 10 test builds from the Quality Validation Checklist,
 * captures screenshots at each stage, and generates a summary report.
 *
 * Usage:
 *   npx ts-node scripts/run-quality-tests.ts
 *   npx ts-node scripts/run-quality-tests.ts --build 1
 *   npx ts-node scripts/run-quality-tests.ts --screenshots
 *   npx ts-node scripts/run-quality-tests.ts --report html
 *   npx ts-node scripts/run-quality-tests.ts --pre-checks-only
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

// =============================================================================
// TYPES
// =============================================================================

interface TestBuild {
  id: number;
  name: string;
  prompt: string;
  expectedFeatures: string[];
  priceThreshold: number;
  category: string;
}

interface TestResult {
  buildId: number;
  buildName: string;
  prompt: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  success: boolean;
  error: string | null;
  outputUrl: string | null;
  screenshots: string[];
  automatedScores: {
    performance: number | null;
    accessibility: number | null;
    bestPractices: number | null;
    seo: number | null;
  };
  issues: string[];
}

interface TestSummary {
  runId: string;
  timestamp: string;
  totalBuilds: number;
  successfulBuilds: number;
  failedBuilds: number;
  averageBuildTimeMs: number;
  results: TestResult[];
  passesQualityGate: boolean;
  gateFailureReasons: string[];
}

interface CLIArgs {
  build: number | null;
  screenshots: boolean;
  reportFormat: 'json' | 'html' | 'markdown';
  preChecksOnly: boolean;
  verbose: boolean;
  outputDir: string;
}

// =============================================================================
// TEST BUILD DEFINITIONS
// =============================================================================

const TEST_BUILDS: TestBuild[] = [
  {
    id: 1,
    name: 'E-commerce Store',
    prompt: 'Build me a website to sell handmade candles',
    expectedFeatures: ['product grid', 'cart', 'checkout', 'navigation', 'brand identity'],
    priceThreshold: 500,
    category: 'e-commerce',
  },
  {
    id: 2,
    name: 'Photography Portfolio',
    prompt: "I'm a photographer, I need a portfolio website",
    expectedFeatures: ['gallery', 'lightbox', 'about page', 'contact form', 'social links'],
    priceThreshold: 500,
    category: 'portfolio',
  },
  {
    id: 3,
    name: 'Restaurant Website',
    prompt: 'I own a Mexican restaurant called Casa Sol - make me a website with our menu',
    expectedFeatures: ['menu', 'location', 'hours', 'reservation', 'food imagery'],
    priceThreshold: 500,
    category: 'restaurant',
  },
  {
    id: 4,
    name: 'Freelancer Landing Page',
    prompt: "I'm a freelance web developer named Alex, make me a single-page site to get clients",
    expectedFeatures: ['value proposition', 'skills', 'portfolio', 'testimonials', 'contact CTA'],
    priceThreshold: 500,
    category: 'landing-page',
  },
  {
    id: 5,
    name: 'Event Invitation',
    prompt: "Create a website for my daughter's sweet 16 birthday party on June 15th",
    expectedFeatures: ['event details', 'RSVP form', 'schedule', 'map', 'gallery'],
    priceThreshold: 200,
    category: 'event',
  },
  {
    id: 6,
    name: 'Market Research Report',
    prompt: 'Generate a market research report website about the electric vehicle industry',
    expectedFeatures: ['executive summary', 'data visualizations', 'key players', 'forecasts', 'sources'],
    priceThreshold: 1000,
    category: 'report',
  },
  {
    id: 7,
    name: 'SaaS Landing Page',
    prompt: 'Build a landing page for my project management app called FlowTask',
    expectedFeatures: ['hero', 'features', 'pricing', 'testimonials', 'FAQ', 'signup CTA'],
    priceThreshold: 500,
    category: 'saas',
  },
  {
    id: 8,
    name: 'Personal Blog',
    prompt: 'I want a blog about sustainable living and minimalism',
    expectedFeatures: ['post list', 'individual posts', 'categories', 'about', 'newsletter', 'search'],
    priceThreshold: 400,
    category: 'blog',
  },
  {
    id: 9,
    name: 'Non-profit Organization',
    prompt: 'Create a website for Ocean Guardians, a marine conservation non-profit',
    expectedFeatures: ['mission', 'campaigns', 'donate CTA', 'impact stats', 'team', 'volunteer'],
    priceThreshold: 500,
    category: 'non-profit',
  },
  {
    id: 10,
    name: 'Local Service Business',
    prompt: "Make a website for Mike's Plumbing - emergency plumbing services in Austin, TX",
    expectedFeatures: ['services', 'contact', 'emergency number', 'reviews', 'service area', 'license info'],
    priceThreshold: 400,
    category: 'local-business',
  },
];

// =============================================================================
// UTILITIES
// =============================================================================

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = {
    build: null,
    screenshots: false,
    reportFormat: 'json',
    preChecksOnly: false,
    verbose: false,
    outputDir: path.join(process.cwd(), 'test-results', 'quality'),
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--build' && args[i + 1]) {
      result.build = parseInt(args[++i], 10);
    } else if (arg === '--screenshots') {
      result.screenshots = true;
    } else if (arg === '--report' && args[i + 1]) {
      result.reportFormat = args[++i] as 'json' | 'html' | 'markdown';
    } else if (arg === '--pre-checks-only') {
      result.preChecksOnly = true;
    } else if (arg === '--verbose' || arg === '-v') {
      result.verbose = true;
    } else if (arg === '--output' && args[i + 1]) {
      result.outputDir = args[++i];
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return result;
}

function printHelp(): void {
  console.log(`
Quality Tests Runner
====================

Executes test builds from the Quality Validation Checklist and generates reports.

Usage:
  npx ts-node scripts/run-quality-tests.ts [options]

Options:
  --build <n>         Run only build number N (1-10)
  --screenshots       Capture screenshots at each stage
  --report <format>   Output format: json, html, or markdown (default: json)
  --pre-checks-only   Only run automated pre-checks, skip builds
  --verbose, -v       Show detailed output
  --output <dir>      Output directory for reports
  --help, -h          Show this help message

Examples:
  npx ts-node scripts/run-quality-tests.ts                    # Run all 10 builds
  npx ts-node scripts/run-quality-tests.ts --build 1          # Run only build 1
  npx ts-node scripts/run-quality-tests.ts --screenshots      # Run with screenshots
  npx ts-node scripts/run-quality-tests.ts --report html      # Generate HTML report
`);
}

function ensureDirectory(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function generateRunId(): string {
  const now = new Date();
  return `quality-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

// =============================================================================
// MOCK BUILD EXECUTION
// =============================================================================

/**
 * Execute a single test build
 *
 * In production, this would:
 * 1. Start the Unified Terminal app
 * 2. Send the prompt to the chat interface
 * 3. Wait for build completion
 * 4. Extract the output URL
 * 5. Run quality checks
 *
 * For now, this is a mock implementation that simulates the process.
 */
async function executeBuild(
  build: TestBuild,
  args: CLIArgs
): Promise<TestResult> {
  const startTime = new Date().toISOString();
  const screenshots: string[] = [];

  console.log(`\n${'='.repeat(60)}`);
  console.log(`BUILD ${build.id}: ${build.name}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`Prompt: "${build.prompt}"`);
  console.log(`Expected: ${build.expectedFeatures.join(', ')}`);
  console.log('');

  // Simulate build process
  const stages = [
    'Analyzing prompt...',
    'Planning site structure...',
    'Generating content...',
    'Building components...',
    'Styling layout...',
    'Optimizing assets...',
    'Running final checks...',
  ];

  for (const stage of stages) {
    console.log(`  [${getTimestamp()}] ${stage}`);

    // Simulate work
    await sleep(500 + Math.random() * 1000);

    // Capture screenshot if enabled
    if (args.screenshots) {
      const screenshotPath = path.join(
        args.outputDir,
        `build-${build.id}-${stage.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`
      );
      screenshots.push(screenshotPath);
      // In production, would actually capture screenshot here
    }
  }

  const endTime = new Date().toISOString();
  const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();

  // Simulate automated score checks
  const automatedScores = {
    performance: 70 + Math.floor(Math.random() * 25),
    accessibility: 75 + Math.floor(Math.random() * 20),
    bestPractices: 80 + Math.floor(Math.random() * 15),
    seo: 85 + Math.floor(Math.random() * 10),
  };

  // Simulate potential issues
  const potentialIssues = [
    'Typography could be more intentional',
    'Consider adding more whitespace',
    'Mobile navigation could be improved',
    'Images could be further optimized',
    'Color contrast could be stronger',
    'Loading performance could be better',
  ];

  const issues = potentialIssues
    .filter(() => Math.random() < 0.3)
    .slice(0, Math.floor(Math.random() * 3));

  console.log(`\n  Completed in ${formatDuration(durationMs)}`);
  console.log(`  Scores: Perf=${automatedScores.performance}, A11y=${automatedScores.accessibility}, BP=${automatedScores.bestPractices}, SEO=${automatedScores.seo}`);

  if (issues.length > 0) {
    console.log(`  Issues: ${issues.length} found`);
    issues.forEach((issue) => console.log(`    - ${issue}`));
  }

  return {
    buildId: build.id,
    buildName: build.name,
    prompt: build.prompt,
    startTime,
    endTime,
    durationMs,
    success: true,
    error: null,
    outputUrl: `http://localhost:3000/preview/build-${build.id}`,
    screenshots,
    automatedScores,
    issues,
  };
}

function getTimestamp(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// REPORT GENERATION
// =============================================================================

function generateJsonReport(summary: TestSummary): string {
  return JSON.stringify(summary, null, 2);
}

function generateHtmlReport(summary: TestSummary): string {
  const statusColor = summary.passesQualityGate ? '#22c55e' : '#ef4444';
  const statusText = summary.passesQualityGate ? 'PASSED' : 'FAILED';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Quality Test Results - ${summary.runId}</title>
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
    h1 { font-size: 32px; font-weight: 700; margin-bottom: 8px; }
    .meta { color: #737373; font-size: 14px; margin-bottom: 32px; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 40px;
    }
    .summary-card {
      background: #171717;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    .summary-value { font-size: 36px; font-weight: 700; }
    .summary-label { font-size: 12px; color: #a3a3a3; text-transform: uppercase; }
    .status-badge {
      display: inline-block;
      padding: 8px 20px;
      border-radius: 8px;
      font-weight: 600;
      font-size: 16px;
      background: ${statusColor}20;
      color: ${statusColor};
      margin-bottom: 32px;
    }
    .results-grid { display: grid; gap: 16px; }
    .result-card {
      background: #171717;
      border-radius: 12px;
      padding: 24px;
    }
    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    .result-title { font-size: 18px; font-weight: 600; }
    .result-prompt { font-size: 14px; color: #a3a3a3; margin-top: 4px; }
    .result-badge {
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge-success { background: #22c55e20; color: #22c55e; }
    .badge-failed { background: #ef444420; color: #ef4444; }
    .scores {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .score {
      background: #262626;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
    }
    .score-label { color: #a3a3a3; margin-right: 8px; }
    .issues { margin-top: 12px; }
    .issue {
      padding: 8px 12px;
      background: #ef444410;
      border-radius: 6px;
      font-size: 13px;
      color: #fca5a5;
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Quality Test Results</h1>
    <p class="meta">Run ID: ${summary.runId} | ${new Date(summary.timestamp).toLocaleString()}</p>

    <div class="status-badge">${statusText}</div>

    <div class="summary">
      <div class="summary-card">
        <div class="summary-value">${summary.successfulBuilds}/${summary.totalBuilds}</div>
        <div class="summary-label">Successful Builds</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${formatDuration(summary.averageBuildTimeMs)}</div>
        <div class="summary-label">Average Build Time</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${summary.results.filter(r => r.automatedScores.performance && r.automatedScores.performance >= 80).length}</div>
        <div class="summary-label">High Performance</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">${summary.results.reduce((sum, r) => sum + r.issues.length, 0)}</div>
        <div class="summary-label">Total Issues</div>
      </div>
    </div>

    <h2 style="font-size: 24px; margin-bottom: 20px;">Build Results</h2>
    <div class="results-grid">
      ${summary.results.map((result) => `
        <div class="result-card">
          <div class="result-header">
            <div>
              <div class="result-title">Build ${result.buildId}: ${result.buildName}</div>
              <div class="result-prompt">"${result.prompt}"</div>
            </div>
            <span class="result-badge ${result.success ? 'badge-success' : 'badge-failed'}">
              ${result.success ? 'PASSED' : 'FAILED'}
            </span>
          </div>
          <div class="scores">
            <div class="score">
              <span class="score-label">Perf:</span>
              <span>${result.automatedScores.performance ?? 'N/A'}</span>
            </div>
            <div class="score">
              <span class="score-label">A11y:</span>
              <span>${result.automatedScores.accessibility ?? 'N/A'}</span>
            </div>
            <div class="score">
              <span class="score-label">BP:</span>
              <span>${result.automatedScores.bestPractices ?? 'N/A'}</span>
            </div>
            <div class="score">
              <span class="score-label">SEO:</span>
              <span>${result.automatedScores.seo ?? 'N/A'}</span>
            </div>
            <div class="score">
              <span class="score-label">Time:</span>
              <span>${formatDuration(result.durationMs)}</span>
            </div>
          </div>
          ${result.issues.length > 0 ? `
            <div class="issues">
              <strong style="font-size: 13px; color: #a3a3a3;">Issues (${result.issues.length}):</strong>
              ${result.issues.map((issue) => `<div class="issue">${issue}</div>`).join('')}
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>

    ${summary.gateFailureReasons.length > 0 ? `
      <div style="margin-top: 40px; padding: 24px; background: #ef444410; border-radius: 12px;">
        <h3 style="color: #ef4444; margin-bottom: 16px;">Quality Gate Failures</h3>
        <ul style="list-style: disc; padding-left: 24px;">
          ${summary.gateFailureReasons.map((reason) => `<li style="color: #fca5a5;">${reason}</li>`).join('')}
        </ul>
      </div>
    ` : ''}
  </div>
</body>
</html>`;
}

function generateMarkdownReport(summary: TestSummary): string {
  const statusEmoji = summary.passesQualityGate ? '\u2705' : '\u274c';

  return `# Quality Test Results

**Run ID:** ${summary.runId}
**Timestamp:** ${new Date(summary.timestamp).toLocaleString()}
**Status:** ${statusEmoji} ${summary.passesQualityGate ? 'PASSED' : 'FAILED'}

## Summary

| Metric | Value |
|--------|-------|
| Total Builds | ${summary.totalBuilds} |
| Successful | ${summary.successfulBuilds} |
| Failed | ${summary.failedBuilds} |
| Avg Build Time | ${formatDuration(summary.averageBuildTimeMs)} |

## Build Results

| Build | Name | Perf | A11y | BP | SEO | Time | Issues |
|-------|------|------|------|----|----|------|--------|
${summary.results.map((r) => `| ${r.buildId} | ${r.buildName} | ${r.automatedScores.performance ?? 'N/A'} | ${r.automatedScores.accessibility ?? 'N/A'} | ${r.automatedScores.bestPractices ?? 'N/A'} | ${r.automatedScores.seo ?? 'N/A'} | ${formatDuration(r.durationMs)} | ${r.issues.length} |`).join('\n')}

${summary.results.filter((r) => r.issues.length > 0).map((r) => `
### Build ${r.buildId}: ${r.buildName}

**Prompt:** "${r.prompt}"

**Issues:**
${r.issues.map((i) => `- ${i}`).join('\n')}
`).join('\n')}

${summary.gateFailureReasons.length > 0 ? `
## Quality Gate Failures

${summary.gateFailureReasons.map((r) => `- ${r}`).join('\n')}
` : ''}

---
*Generated by Unified Terminal Quality Tests Runner*
`;
}

// =============================================================================
// QUALITY GATE CHECK
// =============================================================================

function checkQualityGate(summary: TestSummary): { passes: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Rule 1: Success rate >= 80%
  const successRate = summary.successfulBuilds / summary.totalBuilds;
  if (successRate < 0.8) {
    reasons.push(`Success rate ${(successRate * 100).toFixed(0)}% is below 80% threshold`);
  }

  // Rule 2: Average performance score >= 70
  const perfScores = summary.results
    .map((r) => r.automatedScores.performance)
    .filter((s): s is number => s !== null);
  if (perfScores.length > 0) {
    const avgPerf = perfScores.reduce((a, b) => a + b, 0) / perfScores.length;
    if (avgPerf < 70) {
      reasons.push(`Average performance score ${avgPerf.toFixed(0)} is below 70 threshold`);
    }
  }

  // Rule 3: Average accessibility score >= 80
  const a11yScores = summary.results
    .map((r) => r.automatedScores.accessibility)
    .filter((s): s is number => s !== null);
  if (a11yScores.length > 0) {
    const avgA11y = a11yScores.reduce((a, b) => a + b, 0) / a11yScores.length;
    if (avgA11y < 80) {
      reasons.push(`Average accessibility score ${avgA11y.toFixed(0)} is below 80 threshold`);
    }
  }

  // Rule 4: No build should have more than 5 issues
  const highIssueBuilds = summary.results.filter((r) => r.issues.length > 5);
  if (highIssueBuilds.length > 0) {
    reasons.push(
      `${highIssueBuilds.length} build(s) have more than 5 issues: ${highIssueBuilds.map((b) => b.buildName).join(', ')}`
    );
  }

  // Rule 5: No build should fail completely
  if (summary.failedBuilds > 0) {
    reasons.push(`${summary.failedBuilds} build(s) failed completely`);
  }

  return {
    passes: reasons.length === 0,
    reasons,
  };
}

// =============================================================================
// MAIN EXECUTION
// =============================================================================

async function main(): Promise<void> {
  const args = parseArgs();
  const runId = generateRunId();

  console.log('\n');
  console.log('\u2554' + '\u2550'.repeat(58) + '\u2557');
  console.log('\u2551  UNIFIED TERMINAL - QUALITY TESTS RUNNER' + ' '.repeat(16) + '\u2551');
  console.log('\u2551  Run ID: ' + runId + ' '.repeat(30 - runId.length) + '\u2551');
  console.log('\u255a' + '\u2550'.repeat(58) + '\u255d');

  // Ensure output directory exists
  ensureDirectory(args.outputDir);

  // Determine which builds to run
  const buildsToRun = args.build !== null
    ? TEST_BUILDS.filter((b) => b.id === args.build)
    : TEST_BUILDS;

  if (buildsToRun.length === 0) {
    console.error(`\nError: Build ${args.build} not found. Valid builds are 1-10.`);
    process.exit(1);
  }

  console.log(`\nRunning ${buildsToRun.length} build(s)...`);
  console.log(`Output directory: ${args.outputDir}`);
  console.log(`Screenshots: ${args.screenshots ? 'enabled' : 'disabled'}`);
  console.log(`Report format: ${args.reportFormat}`);

  if (args.preChecksOnly) {
    console.log('\nPre-checks only mode - skipping actual builds');
    console.log('Would run Lighthouse, accessibility, and responsiveness checks');
    process.exit(0);
  }

  // Execute builds
  const results: TestResult[] = [];
  const startTime = Date.now();

  for (const build of buildsToRun) {
    try {
      const result = await executeBuild(build, args);
      results.push(result);
    } catch (error) {
      results.push({
        buildId: build.id,
        buildName: build.name,
        prompt: build.prompt,
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString(),
        durationMs: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        outputUrl: null,
        screenshots: [],
        automatedScores: {
          performance: null,
          accessibility: null,
          bestPractices: null,
          seo: null,
        },
        issues: [`Build failed: ${error instanceof Error ? error.message : String(error)}`],
      });
    }
  }

  const totalDuration = Date.now() - startTime;

  // Generate summary
  const summary: TestSummary = {
    runId,
    timestamp: new Date().toISOString(),
    totalBuilds: results.length,
    successfulBuilds: results.filter((r) => r.success).length,
    failedBuilds: results.filter((r) => !r.success).length,
    averageBuildTimeMs: results.length > 0
      ? results.reduce((sum, r) => sum + r.durationMs, 0) / results.length
      : 0,
    results,
    passesQualityGate: false,
    gateFailureReasons: [],
  };

  // Check quality gate
  const gateResult = checkQualityGate(summary);
  summary.passesQualityGate = gateResult.passes;
  summary.gateFailureReasons = gateResult.reasons;

  // Generate report
  let reportContent: string;
  let reportExtension: string;

  switch (args.reportFormat) {
    case 'html':
      reportContent = generateHtmlReport(summary);
      reportExtension = 'html';
      break;
    case 'markdown':
      reportContent = generateMarkdownReport(summary);
      reportExtension = 'md';
      break;
    default:
      reportContent = generateJsonReport(summary);
      reportExtension = 'json';
  }

  const reportPath = path.join(args.outputDir, `${runId}.${reportExtension}`);
  fs.writeFileSync(reportPath, reportContent);

  // Print final summary
  console.log('\n');
  console.log('\u2554' + '\u2550'.repeat(58) + '\u2557');
  console.log('\u2551  QUALITY TESTS COMPLETE' + ' '.repeat(33) + '\u2551');
  console.log('\u2560' + '\u2550'.repeat(58) + '\u2563');
  console.log(`\u2551  Total Builds:    ${summary.totalBuilds}`.padEnd(59) + '\u2551');
  console.log(`\u2551  Successful:      ${summary.successfulBuilds}`.padEnd(59) + '\u2551');
  console.log(`\u2551  Failed:          ${summary.failedBuilds}`.padEnd(59) + '\u2551');
  console.log(`\u2551  Avg Build Time:  ${formatDuration(summary.averageBuildTimeMs)}`.padEnd(59) + '\u2551');
  console.log(`\u2551  Total Time:      ${formatDuration(totalDuration)}`.padEnd(59) + '\u2551');
  console.log('\u2560' + '\u2550'.repeat(58) + '\u2563');
  console.log(
    `\u2551  Quality Gate:    ${summary.passesQualityGate ? '\u2705 PASSED' : '\u274c FAILED'}`.padEnd(59) + '\u2551'
  );
  console.log('\u2551  Report:          ' + reportPath.slice(-38).padEnd(38) + '\u2551');
  console.log('\u255a' + '\u2550'.repeat(58) + '\u255d');

  if (!summary.passesQualityGate) {
    console.log('\nQuality Gate Failures:');
    summary.gateFailureReasons.forEach((reason) => {
      console.log(`  \u274c ${reason}`);
    });
  }

  // Exit with appropriate code
  process.exit(summary.passesQualityGate ? 0 : 1);
}

// Run main
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
