import { test, expect } from 'vitest';
import { isAuthPath, isProtectedPath, isAuthEntryPath, safeNextPath } from './routes';

test('isProtectedPath matches the app area', () => {
  expect(isProtectedPath('/dashboard')).toBe(true);
  expect(isProtectedPath('/dashboard/anything')).toBe(true);
  expect(isProtectedPath('/login')).toBe(false);
  expect(isProtectedPath('/t/abc123')).toBe(false); // public trip page
});

test('isAuthPath matches only the auth screens', () => {
  expect(isAuthPath('/login')).toBe(true);
  expect(isAuthPath('/signup')).toBe(true);
  expect(isAuthPath('/forgot-password')).toBe(true);
  expect(isAuthPath('/reset-password')).toBe(true);
  expect(isAuthPath('/dashboard')).toBe(false);
});

test('isAuthEntryPath matches login/signup/forgot but NOT reset-password', () => {
  expect(isAuthEntryPath('/login')).toBe(true);
  expect(isAuthEntryPath('/signup')).toBe(true);
  expect(isAuthEntryPath('/forgot-password')).toBe(true);
  expect(isAuthEntryPath('/reset-password')).toBe(false);
});

test('safeNextPath allows same-origin relative paths', () => {
  expect(safeNextPath('/dashboard')).toBe('/dashboard');
  expect(safeNextPath('/dashboard/trips?filter=x')).toBe('/dashboard/trips?filter=x');
  expect(safeNextPath('/t/abc')).toBe('/t/abc');
});
test('safeNextPath rejects off-site, protocol-relative, or malformed targets', () => {
  expect(safeNextPath('@evil.com')).toBe('/dashboard');
  expect(safeNextPath('//evil.com')).toBe('/dashboard');
  expect(safeNextPath('https://evil.com')).toBe('/dashboard');
  expect(safeNextPath('/\\evil.com')).toBe('/dashboard');
  expect(safeNextPath('\\/evil.com')).toBe('/dashboard');
  expect(safeNextPath(null)).toBe('/dashboard');
  expect(safeNextPath(undefined)).toBe('/dashboard');
  expect(safeNextPath('')).toBe('/dashboard');
});
