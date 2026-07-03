import type { Finding } from '../ai/schema.js';
import { formatMarkdownToHtml, type PerformanceReport } from './output.js';

/** Escapes model-generated text before it lands in HTML. */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function scoreColor(score: number): string {
  return score >= 90 ? 'var(--green)' : score >= 50 ? 'var(--amber)' : 'var(--red)';
}

/** Parses the tool's own "Label: value" metrics block from lighthouse.ts. */
function parseMetrics(metrics: string): { score: number | null; rows: [string, string][] } {
  let score: number | null = null;
  const rows: [string, string][] = [];
  for (const line of metrics.split('\n')) {
    const i = line.indexOf(':');
    if (i === -1) continue;
    const label = line.slice(0, i).trim();
    const value = line.slice(i + 1).trim();
    if (!label || !value) continue;
    if (label === 'Performance Score') {
      score = parseInt(value, 10);
    } else {
      rows.push([label, value]);
    }
  }
  return { score: Number.isNaN(score) ? null : score, rows };
}

function scoreRing(score: number | null): string {
  if (score === null) return '';
  const C = 2 * Math.PI * 52;
  const offset = C * (1 - Math.min(score, 100) / 100);
  const color = scoreColor(score);
  return `
      <div class="score" role="img" aria-label="Performance score ${score} out of 100">
        <svg viewBox="0 0 120 120" width="132" height="132">
          <circle cx="60" cy="60" r="52" fill="none" stroke="var(--surface2)" stroke-width="8"/>
          <circle cx="60" cy="60" r="52" fill="none" stroke="${color}" stroke-width="8"
            stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}"
            stroke-dashoffset="${offset.toFixed(1)}" transform="rotate(-90 60 60)"/>
        </svg>
        <div class="score-value" style="color:${color}">${score}</div>
        <div class="score-label">performance</div>
      </div>`;
}

const SEVERITY_META = {
  critical: { label: 'critical', var: '--red' },
  warning: { label: 'warning', var: '--amber' },
  suggestion: { label: 'suggestion', var: '--blue' },
} as const;

function findingCard(finding: Finding): string {
  const meta = SEVERITY_META[finding.severity];
  return `
      <article class="finding" data-severity="${finding.severity}" style="--sev:var(${meta.var})">
        <div class="finding-head">
          <span class="chip sev">${meta.label}</span>
          <code class="chip loc">${esc(finding.file)}:${finding.startLine}–${finding.endLine}</code>
        </div>
        <h3 class="finding-title">${esc(finding.title)}</h3>
        <p class="finding-desc">${esc(finding.description)}</p>
        <dl class="finding-meta">
          <div><dt>Impact</dt><dd>${esc(finding.impact)}</dd></div>
          <div><dt>Fix</dt><dd>${esc(finding.solution)}</dd></div>
        </dl>
        ${finding.codeExample ? `<pre class="finding-code"><code>${esc(finding.codeExample)}</code></pre>` : ''}
      </article>`;
}

/** Fallback rendering when only preformatted string findings are available. */
function legacyFindings(blocks: string[], severity: keyof typeof SEVERITY_META): string {
  return blocks
    .map(
      block => `
      <article class="finding" data-severity="${severity}" style="--sev:var(${SEVERITY_META[severity].var})">
        <div class="prose">${formatMarkdownToHtml(block)}</div>
      </article>`
    )
    .join('');
}

function detailsSection(title: string, markdown: string, open = false): string {
  if (!markdown?.trim()) return '';
  return `
      <details class="panel"${open ? ' open' : ''}>
        <summary>${title}</summary>
        <div class="prose">${formatMarkdownToHtml(markdown)}</div>
      </details>`;
}

/**
 * Generates a self-contained HTML report — dark, monospace-forward dev-tool
 * aesthetic. No external assets, no framework; one small script for filtering.
 */
export function generateHtmlReport(data: PerformanceReport): string {
  const { score, rows } = parseMetrics(data.lighthouse.metrics);
  const findings = data.codeAnalysis.findings;
  const counts = {
    critical: data.codeAnalysis.critical.length,
    warning: data.codeAnalysis.warnings.length,
    suggestion: data.codeAnalysis.suggestions.length,
  };
  const total = counts.critical + counts.warning + counts.suggestion;

  const severityOrder: Finding['severity'][] = ['critical', 'warning', 'suggestion'];
  const findingsHtml = findings
    ? severityOrder
        .map(sev =>
          findings
            .filter(f => f.severity === sev)
            .map(findingCard)
            .join('')
        )
        .join('')
    : legacyFindings(data.codeAnalysis.critical, 'critical') +
      legacyFindings(data.codeAnalysis.warnings, 'warning') +
      legacyFindings(data.codeAnalysis.suggestions, 'suggestion');

  const generatedAt = data.metadata ? new Date(data.metadata.timestamp).toLocaleString() : '';
  const duration = data.metadata ? `${Math.round(data.metadata.duration / 1000)}s` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>perf-lens report</title>
<style>
  :root {
    --bg: #0c0f14;
    --surface: #12161e;
    --surface2: #1b212c;
    --border: #242c39;
    --text: #e8ecf2;
    --muted: #8b95a5;
    --faint: #5b6575;
    --green: #4ade80;
    --amber: #fbbf24;
    --red: #f87171;
    --blue: #60a5fa;
    --mono: ui-monospace, "SF Mono", "Cascadia Code", Menlo, Consolas, monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: var(--sans);
    font-size: 15px;
    line-height: 1.6;
    -webkit-font-smoothing: antialiased;
  }
  .topbar {
    display: flex; justify-content: space-between; align-items: center;
    padding: 14px 28px;
    border-bottom: 1px solid var(--border);
    font-family: var(--mono); font-size: 13px;
    position: sticky; top: 0; background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(8px); z-index: 10;
  }
  .wordmark { font-weight: 700; letter-spacing: -0.02em; }
  .wordmark::before { content: "▮ "; color: var(--green); }
  .topbar-meta { color: var(--faint); }
  .topbar-meta span + span::before { content: " · "; color: var(--border); }
  main { max-width: 920px; margin: 0 auto; padding: 40px 28px 80px; }

  /* ---- hero ---- */
  .hero { display: flex; gap: 40px; align-items: center; margin-bottom: 48px; flex-wrap: wrap; }
  .score { position: relative; width: 132px; flex: none; text-align: center; }
  .score svg { display: block; }
  .score-value {
    position: absolute; top: 38px; left: 0; right: 0;
    font-family: var(--mono); font-size: 38px; font-weight: 700; line-height: 1;
  }
  .score-label {
    position: absolute; top: 80px; left: 0; right: 0;
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--faint);
  }
  .hero-right { flex: 1; min-width: 280px; }
  .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; }
  .metric {
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    padding: 14px 16px;
  }
  .metric-label {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--faint); margin-bottom: 6px;
  }
  .metric-value { font-family: var(--mono); font-size: 22px; font-weight: 600; }
  .tally { display: flex; gap: 18px; margin-top: 16px; font-family: var(--mono); font-size: 13px; color: var(--muted); }
  .tally b { color: var(--text); }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }

  /* ---- sections ---- */
  h2.section {
    font-family: var(--mono); font-size: 13px; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--muted);
    border-bottom: 1px solid var(--border); padding-bottom: 10px; margin: 48px 0 20px;
  }
  h2.section .count { color: var(--faint); font-weight: 400; }

  /* ---- filters ---- */
  .filters { display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap; }
  .filters button {
    font-family: var(--mono); font-size: 12px; cursor: pointer;
    background: var(--surface); color: var(--muted);
    border: 1px solid var(--border); border-radius: 999px; padding: 5px 14px;
  }
  .filters button:hover { color: var(--text); border-color: var(--faint); }
  .filters button.active { color: var(--text); background: var(--surface2); border-color: var(--faint); }

  /* ---- finding cards ---- */
  .finding {
    background: var(--surface); border: 1px solid var(--border);
    border-left: 3px solid var(--sev); border-radius: 8px;
    padding: 18px 20px; margin-bottom: 14px;
  }
  .finding.hidden { display: none; }
  .finding-head { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-bottom: 8px; }
  .chip { font-family: var(--mono); font-size: 11px; border-radius: 4px; padding: 2px 8px; }
  .chip.sev {
    color: var(--sev); background: color-mix(in srgb, var(--sev) 12%, transparent);
    text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;
  }
  .chip.loc { color: var(--muted); background: var(--surface2); }
  .finding-title { margin: 0 0 6px; font-size: 16px; font-weight: 600; letter-spacing: -0.01em; }
  .finding-desc { margin: 0 0 12px; color: var(--muted); }
  .finding-meta { margin: 0; display: grid; gap: 8px; }
  .finding-meta div { display: grid; grid-template-columns: 64px 1fr; gap: 12px; }
  .finding-meta dt {
    font-family: var(--mono); font-size: 10px; letter-spacing: 0.14em;
    text-transform: uppercase; color: var(--faint); padding-top: 3px;
  }
  .finding-meta dd { margin: 0; color: var(--text); font-size: 14px; }
  .finding-code, .prose pre {
    background: #0a0d12; border: 1px solid var(--border); border-radius: 6px;
    padding: 14px 16px; overflow-x: auto; margin: 14px 0 0;
    font-family: var(--mono); font-size: 13px; line-height: 1.5; color: #c9d4e3;
  }
  .finding-code code, .prose pre code { background: none; padding: 0; color: inherit; }

  /* ---- collapsible panels + prose ---- */
  .panel {
    background: var(--surface); border: 1px solid var(--border); border-radius: 8px;
    margin-bottom: 12px;
  }
  .panel summary {
    cursor: pointer; padding: 14px 18px; font-weight: 600; font-size: 14px;
    list-style: none; display: flex; align-items: center; gap: 10px;
  }
  .panel summary::before {
    content: "▸"; color: var(--faint); font-family: var(--mono);
    transition: transform 0.15s;
  }
  .panel[open] summary::before { transform: rotate(90deg); }
  .panel summary::-webkit-details-marker { display: none; }
  .panel .prose { padding: 0 20px 18px; }
  .prose { color: var(--muted); font-size: 14px; }
  .prose h2, .prose h3, .prose h4, .prose h5, .prose h6 {
    color: var(--text); font-size: 14px; margin: 18px 0 8px; letter-spacing: -0.01em;
  }
  .prose ul, .prose ol { padding-left: 20px; margin: 8px 0; }
  .prose li { margin: 3px 0; }
  .prose p { margin: 8px 0; }
  .prose strong { color: var(--text); }
  .prose code {
    font-family: var(--mono); font-size: 0.9em;
    background: var(--surface2); padding: 1px 5px; border-radius: 4px; color: #c9d4e3;
  }
  .prose a { color: var(--blue); }

  footer {
    margin-top: 64px; padding-top: 20px; border-top: 1px solid var(--border);
    font-family: var(--mono); font-size: 12px; color: var(--faint);
  }
  @media (max-width: 640px) {
    .hero { gap: 24px; }
    .topbar { padding: 12px 16px; }
    main { padding: 28px 16px 60px; }
  }
</style>
</head>
<body>
  <header class="topbar">
    <span class="wordmark">perf-lens</span>
    <span class="topbar-meta">
      ${generatedAt ? `<span>${esc(generatedAt)}</span>` : ''}
      ${duration ? `<span>${duration}</span>` : ''}
    </span>
  </header>
  <main>
    <section class="hero">
      ${scoreRing(score)}
      <div class="hero-right">
        <div class="metric-grid">
          ${rows
            .map(
              ([label, value]) => `
          <div class="metric">
            <div class="metric-label">${esc(label)}</div>
            <div class="metric-value">${esc(value)}</div>
          </div>`
            )
            .join('')}
        </div>
        <div class="tally">
          <span><span class="dot" style="background:var(--red)"></span><b>${counts.critical}</b> critical</span>
          <span><span class="dot" style="background:var(--amber)"></span><b>${counts.warning}</b> warnings</span>
          <span><span class="dot" style="background:var(--blue)"></span><b>${counts.suggestion}</b> suggestions</span>
        </div>
      </div>
    </section>

    <h2 class="section">Findings <span class="count">/ ${total}</span></h2>
    ${
      total > 0
        ? `
    <div class="filters" role="group" aria-label="Filter findings by severity">
      <button class="active" data-filter="all">all ${total}</button>
      <button data-filter="critical">critical ${counts.critical}</button>
      <button data-filter="warning">warnings ${counts.warning}</button>
      <button data-filter="suggestion">suggestions ${counts.suggestion}</button>
    </div>
    <div id="findings">${findingsHtml}</div>`
        : '<p class="prose">No code findings — nice.</p>'
    }

    <h2 class="section">Lighthouse</h2>
    ${detailsSection('Audit report', data.lighthouse.report, true)}
    ${detailsSection('Core Web Vitals analysis', data.lighthouse.analysis.coreWebVitals)}
    ${detailsSection('Performance opportunities', data.lighthouse.analysis.performanceOpportunities)}
    ${detailsSection('Diagnostics', data.lighthouse.analysis.diagnostics)}

    <footer>generated by perf-lens · lighthouse + claude</footer>
  </main>
  <script>
    document.querySelectorAll('.filters button').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filters button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const filter = btn.dataset.filter;
        document.querySelectorAll('.finding').forEach(card => {
          card.classList.toggle('hidden', filter !== 'all' && card.dataset.severity !== filter);
        });
      });
    });
  </script>
</body>
</html>`;
}
