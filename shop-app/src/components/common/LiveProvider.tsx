import React, { PropsWithChildren } from 'react';
import { LiveProvider as ReactLiveProvider } from 'react-live';
import * as mui from '@mui/material';
import ts, { transpile } from 'typescript';
import IconifyIcon from 'components/base/IconifyIcon';

// Kept here, not in lib/utils: importing the TypeScript compiler from a shared util put all
// of it (~3.5 MB) into every shop page's bundle. Only the template's live docs need it.
const transformTSCode = (snippet: string, target: ts.ScriptTarget = ts.ScriptTarget.ES2015) =>
  transpile(snippet, {
    jsx: ts.JsxEmit.React,
    target,
  });

export interface LiveProviderProps {
  code?: string;
  scope?: { [key: string]: any };
  noInline?: boolean;
  disabled?: boolean;
  transformCode?: (code: string) => string | Promise<string>;
}

const LiveProvider = ({
  children,
  code,
  noInline,
  scope,
  disabled,
  transformCode,
}: PropsWithChildren<LiveProviderProps>) => {
  const theme = mui.useTheme();

  return (
    <ReactLiveProvider
      code={code}
      disabled={disabled}
      scope={{ ...mui, ...React, IconifyIcon, ...scope }}
      noInline={noInline}
      transformCode={
        transformCode ? transformCode : (code) => transformTSCode(code.replace(/^import.*$/gm, ''))
      }
      language="tsx"
      theme={{
        plain: {
          color: theme.vars.palette.text.primary,
          backgroundColor: theme.vars.palette.background.elevation2,
        },
        styles: [
          {
            types: ['prolog', 'constant', 'builtin'],
            style: {
              color: theme.vars.palette.error.main,
            },
          },
          {
            types: ['inserted', 'function', 'operator'],
            style: {
              color: theme.vars.palette.primary.main,
            },
          },
          {
            types: ['deleted'],
            style: {
              color: theme.vars.palette.error.main,
            },
          },
          {
            types: ['changed'],
            style: {
              color: theme.vars.palette.warning.main,
            },
          },
          {
            types: ['punctuation', 'symbol'],
            style: {
              color: theme.vars.palette.text.primary,
            },
          },
          {
            types: ['string', 'char', 'selector', 'attr-value', 'property'],
            style: {
              color: theme.vars.palette.success.main,
            },
          },
          {
            types: ['keyword', 'variable', 'attr-equals', 'script-punctuation'],
            style: {
              color: theme.vars.palette.error.main,
            },
          },
          {
            types: ['comment'],
            style: {
              color: theme.vars.palette.info.main,
            },
          },
          {
            types: ['attr-name', 'tag', 'literal-property'],
            style: {
              color: theme.vars.palette.text.primary,
            },
          },
        ],
      }}
    >
      {children}
    </ReactLiveProvider>
  );
};

export default LiveProvider;
