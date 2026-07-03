import { test, expect } from 'vitest';
import { authErrorMessage } from './error-messages';

test('maps invalid credentials to a friendly message', () => {
  expect(authErrorMessage({ code: 'invalid_credentials', message: 'Invalid login credentials' }))
    .toBe('Incorrect email or password.');
});

test('maps already-registered users', () => {
  expect(authErrorMessage({ code: 'user_already_exists', message: 'User already registered' }))
    .toBe('An account with this email already exists.');
});

test('maps a rate-limit error', () => {
  expect(authErrorMessage({ code: 'over_email_send_rate_limit', message: 'rate limit' }))
    .toBe('Too many attempts. Please wait a moment and try again.');
});

test('falls back to a generic message for unknown errors', () => {
  expect(authErrorMessage({ message: 'weird internal thing' }))
    .toBe('Something went wrong. Please try again.');
  expect(authErrorMessage(null)).toBe('Something went wrong. Please try again.');
});
