import { describe, it, expect } from 'vitest';
import { formatMarkdownToHtml } from './output.js';

describe('formatMarkdownToHtml', () => {
  it('renders basic markdown', () => {
    const html = formatMarkdownToHtml('## Title\n\n- one\n- two\n\ntext with **bold**');
    expect(html).toContain('<h3>Title</h3>');
    expect(html).toContain('<li>one</li>');
    expect(html).toContain('<strong>bold</strong>');
  });

  it('shifts headings down one level to match the report CSS (# → h2)', () => {
    expect(formatMarkdownToHtml('# Top')).toContain('<h2>Top</h2>');
  });

  it('escapes raw HTML in the source instead of rendering it (no XSS)', () => {
    const html = formatMarkdownToHtml('before <script>alert(1)</script> after');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('escapes HTML inside fenced code blocks', () => {
    const html = formatMarkdownToHtml('```js\nconst x = a < b && c > d;\n```');
    expect(html).toContain('<pre>');
    expect(html).not.toContain('a < b');
    expect(html).toContain('a &lt; b');
  });
});
