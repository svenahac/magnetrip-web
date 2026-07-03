import { test, expect } from 'vitest';
import { loginSchema, signupSchema, forgotPasswordSchema, resetPasswordSchema } from './auth';

test('loginSchema requires a valid email and non-empty password', () => {
  expect(loginSchema.safeParse({ email: 'a@b.com', password: 'secret12' }).success).toBe(true);
  expect(loginSchema.safeParse({ email: 'not-an-email', password: 'secret12' }).success).toBe(false);
  expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
});

test('signupSchema enforces min password length and matching confirmation', () => {
  expect(signupSchema.safeParse({ email: 'a@b.com', password: 'secret12', confirmPassword: 'secret12' }).success).toBe(true);
  expect(signupSchema.safeParse({ email: 'a@b.com', password: 'short', confirmPassword: 'short' }).success).toBe(false);
  const mismatch = signupSchema.safeParse({ email: 'a@b.com', password: 'secret12', confirmPassword: 'secret99' });
  expect(mismatch.success).toBe(false);
  if (!mismatch.success) expect(mismatch.error.issues[0]?.path).toEqual(['confirmPassword']);
});

test('forgotPasswordSchema requires a valid email', () => {
  expect(forgotPasswordSchema.safeParse({ email: 'a@b.com' }).success).toBe(true);
  expect(forgotPasswordSchema.safeParse({ email: 'x' }).success).toBe(false);
});

test('resetPasswordSchema enforces min length and matching confirmation', () => {
  expect(resetPasswordSchema.safeParse({ password: 'secret12', confirmPassword: 'secret12' }).success).toBe(true);
  expect(resetPasswordSchema.safeParse({ password: 'secret12', confirmPassword: 'nope' }).success).toBe(false);
  const rp = resetPasswordSchema.safeParse({ password: 'secret12', confirmPassword: 'nope' });
  expect(rp.success).toBe(false);
  if (!rp.success) expect(rp.error.issues[0]?.path).toEqual(['confirmPassword']);
});
