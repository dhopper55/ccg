import { Box, Typography } from '@mui/material';
import IconifyIcon from 'components/base/IconifyIcon';

interface EvalLinkInfo {
  serial: string;
  brand: string;
  decodeEventId: number | null;
}

interface IbanezAdditionalInfoPanelProps {
  richText: string;
  evalLink?: EvalLinkInfo | null;
}

function sanitizeAdditionalContextHtmlClient(input: string): string {
  const template = document.createElement('template');
  template.innerHTML = input;
  const allowedTags = new Set(['P', 'BR', 'UL', 'OL', 'LI', 'STRONG', 'EM', 'A', 'H3', 'H4', 'BLOCKQUOTE']);

  const walk = (node: Node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as HTMLElement;
      const tag = el.tagName.toUpperCase();
      if (!allowedTags.has(tag)) {
        const parent = el.parentNode;
        if (parent) {
          while (el.firstChild) parent.insertBefore(el.firstChild, el);
          parent.removeChild(el);
        }
        return;
      }

      Array.from(el.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        if (tag === 'A' && name === 'href') return;
        el.removeAttribute(attr.name);
      });

      if (tag === 'A') {
        const href = (el.getAttribute('href') || '').trim();
        if (!/^(https?:|mailto:|tel:|\/|#)/i.test(href)) {
          el.setAttribute('href', '#');
        }
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer nofollow');
      }
    }

    Array.from(node.childNodes).forEach((child) => walk(child));
  };

  walk(template.content);
  return template.innerHTML;
}

function formatAdditionalInfoHtml(text: string): string {
  const hasHtml = /<\s*[a-z][^>]*>/i.test(text);
  if (hasHtml) {
    return sanitizeAdditionalContextHtmlClient(text);
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return `<p>${text}</p>`;
  }

  let html = '';
  let listOpen = false;

  for (const line of lines) {
    const bulletMatch = line.match(/^[-*]\s+(.+)$/);
    if (bulletMatch) {
      if (!listOpen) {
        html += '<ul>';
        listOpen = true;
      }
      html += `<li>${bulletMatch[1]}</li>`;
      continue;
    }

    if (listOpen) {
      html += '</ul>';
      listOpen = false;
    }

    html += `<p>${line}</p>`;
  }

  if (listOpen) {
    html += '</ul>';
  }

  return sanitizeAdditionalContextHtmlClient(html);
}

const IbanezAdditionalInfoPanel = ({ richText, evalLink }: IbanezAdditionalInfoPanelProps) => {
  const evalHref = evalLink
    ? (() => {
        const params = new URLSearchParams({ brand: evalLink.brand, serial: evalLink.serial });
        if (evalLink.decodeEventId != null) params.set('decodeId', String(evalLink.decodeEventId));
        return `/guitar-value-report-evaluation/?${params.toString()}`;
      })()
    : null;

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      {evalHref ? (
        <Box
          component="a"
          href={evalHref}
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.75,
            mb: 3,
            color: 'warning.main',
            textDecoration: 'none',
            fontWeight: 700,
            fontSize: '1rem',
            border: 1,
            borderColor: 'warning.main',
            borderRadius: 2,
            px: 2,
            py: 1,
            '&:hover': { bgcolor: 'rgba(184,150,12,0.08)' },
            transition: 'background-color 0.15s',
          }}
        >
          <IconifyIcon icon="mdi:currency-usd" fontSize={22} />
          How much is my guitar worth?
        </Box>
      ) : null}
      <Typography variant="h6" sx={{ mb: 3, color: 'warning.main' }}>
        Additional decoded information
      </Typography>

      <Box
        sx={{
          color: 'text.secondary',
          '& p': { mt: 0, mb: 2, typography: 'body2', lineHeight: 1.7 },
          '& ul, & ol': { mt: 0, mb: 2.5, pl: 3 },
          '& li': { mb: 1.2, typography: 'body2', lineHeight: 1.7 },
          '& h3, & h4': { mt: 3, mb: 1.5, color: 'text.primary', typography: 'subtitle1' },
          '& strong': { color: 'text.primary', fontWeight: 600 },
          '& a': { color: 'warning.main' },
          '& blockquote': {
            m: 0,
            pl: 2,
            borderLeft: '2px solid rgba(224, 212, 189, 0.35)',
          },
        }}
        dangerouslySetInnerHTML={{ __html: formatAdditionalInfoHtml(richText) }}
      />
    </Box>
  );
};

export default IbanezAdditionalInfoPanel;
