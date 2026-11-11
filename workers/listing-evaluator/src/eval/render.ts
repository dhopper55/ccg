import { sanitizePatternLookupHtml } from '../utils/html.js';
import { claudeMarkdownToHtml, stripTrailingJsonBlock } from '../../../../shared/claude-eval-rules.js';

// Claude's Markdown readout -> the sanitized HTML the AI Analysis fields store.
export function renderAnalysisHtml(markdown: string): string {
  return sanitizePatternLookupHtml(claudeMarkdownToHtml(stripTrailingJsonBlock(markdown))).slice(0, 20000);
}
