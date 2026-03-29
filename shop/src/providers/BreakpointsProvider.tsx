import { PropsWithChildren, createContext, useContext, useMemo } from 'react';
import { Breakpoint, Theme, useMediaQuery, useTheme } from '@mui/material';

interface BreakpointContextInterface {
  currentBreakpoint: Breakpoint;
  up: (key: Breakpoint | number) => boolean;
  down: (key: Breakpoint | number) => boolean;
  only: (key: Breakpoint | number) => boolean;
  between: (start: Breakpoint | number, end: Breakpoint | number) => boolean;
}

const BREAKPOINT_ORDER: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl'];

export const BreakpointContext = createContext({} as BreakpointContextInterface);

function isNamedBreakpoint(key: Breakpoint | number): key is Breakpoint {
  return typeof key === 'string' && BREAKPOINT_ORDER.includes(key);
}

function normalizeBreakpointValue(
  theme: Theme,
  key: Breakpoint | number,
  fallback: number,
): number {
  if (typeof key === 'number') {
    return key;
  }

  const rawValue = theme.breakpoints.values[key];
  return typeof rawValue === 'number' ? rawValue : fallback;
}

function resolveCurrentBreakpoint(matches: Record<Breakpoint, boolean>): Breakpoint {
  if (matches.xl) return 'xl';
  if (matches.lg) return 'lg';
  if (matches.md) return 'md';
  if (matches.sm) return 'sm';
  return 'xs';
}

const BreakpointsProvider = ({ children }: PropsWithChildren) => {
  const theme = useTheme();

  const matches = {
    xs: useMediaQuery(theme.breakpoints.up('xs')),
    sm: useMediaQuery(theme.breakpoints.up('sm')),
    md: useMediaQuery(theme.breakpoints.up('md')),
    lg: useMediaQuery(theme.breakpoints.up('lg')),
    xl: useMediaQuery(theme.breakpoints.up('xl')),
  };

  const value = useMemo<BreakpointContextInterface>(() => {
    const currentBreakpoint = resolveCurrentBreakpoint(matches);
    const currentValue = theme.breakpoints.values[currentBreakpoint] ?? 0;

    const up = (key: Breakpoint | number) => {
      if (isNamedBreakpoint(key)) {
        return BREAKPOINT_ORDER.indexOf(currentBreakpoint) >= BREAKPOINT_ORDER.indexOf(key);
      }

      return currentValue >= key;
    };

    const down = (key: Breakpoint | number) => {
      if (isNamedBreakpoint(key)) {
        return BREAKPOINT_ORDER.indexOf(currentBreakpoint) < BREAKPOINT_ORDER.indexOf(key);
      }

      return currentValue < key;
    };

    const only = (key: Breakpoint | number) => {
      if (isNamedBreakpoint(key)) {
        return currentBreakpoint === key;
      }

      const keyValue = normalizeBreakpointValue(theme, key, key);
      const nextBreakpoint = BREAKPOINT_ORDER.find(
        (breakpoint) => theme.breakpoints.values[breakpoint] > keyValue,
      );
      const nextValue = nextBreakpoint ? theme.breakpoints.values[nextBreakpoint] : Number.POSITIVE_INFINITY;
      return currentValue >= keyValue && currentValue < nextValue;
    };

    const between = (start: Breakpoint | number, end: Breakpoint | number) => {
      const startValue = normalizeBreakpointValue(theme, start, 0);
      const endValue = normalizeBreakpointValue(theme, end, Number.POSITIVE_INFINITY);
      return currentValue >= startValue && currentValue < endValue;
    };

    return {
      currentBreakpoint,
      up,
      down,
      only,
      between,
    };
  }, [matches, theme]);

  return <BreakpointContext.Provider value={value}>{children}</BreakpointContext.Provider>;
};

export const useBreakpoints = () => useContext(BreakpointContext);

export default BreakpointsProvider;
