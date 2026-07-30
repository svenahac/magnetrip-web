import { test, expect } from 'vitest';
import { buildCss, buildDart } from './generate-tokens.mjs';

const tokens = {
  color: {
    primary: '#0D9488', primaryForeground: '#FFFFFF',
    primaryDark: '#0B6E66', primaryDeep: '#08544E',
    secondary: '#44403C', secondaryForeground: '#FFFFFF', secondarySurface: '#F0EDE7',
    accent: '#E07A5F', accentForeground: '#FFFFFF',
    background: '#FAF9F6', surface: '#FFFFFF', border: '#E7E2D9',
    success: '#15803D', successForeground: '#FFFFFF', successSurface: '#DCFCE7',
    warning: '#B45309', warningForeground: '#FFFFFF',
    error: '#DC2626', errorForeground: '#FFFFFF',
    textPrimary: '#1C1917', textSecondary: '#57534E', textMuted: '#78716C', disabled: '#A8A29E',
  },
  radius: { sm: '8px', md: '12px', lg: '16px', xl: '20px', '2xl': '24px', full: '9999px' },
  spacing: { 1: '4px', 2: '8px', 4: '16px' },
  font: { family: 'Plus Jakarta Sans' },
};

test('buildCss maps semantic + brand variables', () => {
  const css = buildCss(tokens);
  expect(css).toContain('--background: #FAF9F6;');
  expect(css).toContain('--primary: #0D9488;');
  expect(css).toContain('--primary-foreground: #FFFFFF;');
  expect(css).toContain('--muted-foreground: #57534E;');
  expect(css).toContain('--destructive: #DC2626;');
  expect(css).toContain('--radius: 12px;');
  expect(css).toContain('--brand-accent: #E07A5F;');
  expect(css).toContain('--color-success: var(--success);');
  expect(css).not.toContain('.dark');
  expect(css).toContain('--accent: #F0EDE7;');
  expect(css).toContain('--secondary: #F0EDE7;');
  expect(css).toContain('--secondary-foreground: #44403C;');
  expect(css).not.toContain('--accent: #E07A5F;');
  expect(css).toContain('--radius-sm: 8px;');
  expect(css).toContain('--radius-md: 12px;');
  expect(css).toContain('--radius-lg: 16px;');
  expect(css).toContain('--radius-xl: 20px;');
  expect(css).toContain('--radius-2xl: 24px;');
  expect(css).toContain('--primary-dark: #0B6E66;');
  expect(css).toContain('--primary-deep: #08544E;');
  expect(css).toContain('--color-primary-dark: var(--primary-dark);');
  expect(css).toContain('--color-primary-deep: var(--primary-deep);');
});

test('buildDart maps colors to Flutter ARGB and is material-only', () => {
  const dart = buildDart(tokens);
  expect(dart).toContain('import \'package:flutter/material.dart\';');
  expect(dart).toContain('static const Color primary = Color(0xFF0D9488);');
  expect(dart).toContain('static const Color background = Color(0xFFFAF9F6);');
  expect(dart).toContain('static const double md = 12;');
  expect(dart).toContain("fontFamily: 'Plus Jakarta Sans'");
  expect(dart).not.toContain('package:google_fonts');
  expect(dart).toContain('static const Color primaryDark = Color(0xFF0B6E66);');
  expect(dart).toContain('static const Color primaryDeep = Color(0xFF08544E);');
});
