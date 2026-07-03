import { test, expect } from 'vitest';
import { isAuthPath, isProtectedPath, isAuthEntryPath } from './routes';

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
