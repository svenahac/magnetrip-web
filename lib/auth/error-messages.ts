const GENERIC = 'Something went wrong. Please try again.';

const BY_CODE: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  email_not_confirmed: 'Please confirm your email before signing in.',
  user_already_exists: 'An account with this email already exists.',
  weak_password: 'Password is too weak. Use at least 8 characters.',
  over_email_send_rate_limit: 'Too many attempts. Please wait a moment and try again.',
  over_request_rate_limit: 'Too many attempts. Please wait a moment and try again.',
  same_password: 'Your new password must be different from the old one.',
  otp_expired: 'This link has expired. Please request a new one.',
};

/** Map a Supabase auth error (or anything) to friendly, user-safe copy. */
export function authErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object') return GENERIC;
  const e = error as { code?: string; message?: string };
  if (e.code && BY_CODE[e.code]) return BY_CODE[e.code];
  // Some errors only carry a message; match a couple of common ones defensively.
  const msg = (e.message ?? '').toLowerCase();
  if (msg.includes('invalid login credentials')) return BY_CODE.invalid_credentials;
  if (msg.includes('already registered')) return BY_CODE.user_already_exists;
  return GENERIC;
}
