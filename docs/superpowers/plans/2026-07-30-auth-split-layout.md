# Auth Split Layout & Flutter Signup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every auth screen on web and Flutter to a 45% branded teal panel above/beside a 55% white form column, and add the signup screen the Flutter app is missing.

**Architecture:** Two new colours enter the shared design-token pipeline, which generates both the web CSS variables and the Flutter theme constants. Each platform then grows one presentational shell component (`AuthBrandPanel` + `AuthShell` on web, `AuthScaffold` on Flutter) that all auth screens render through, so the individual screens hold no layout or branding code. Flutter additionally gains a pure validation module whose message strings are copied verbatim from web's Zod schemas, plus a signup screen built on top of it.

**Tech Stack:** Next.js 16 / React 19 / Tailwind v4 / Vitest (web); Flutter 3.44 / Riverpod / go_router / mocktail (mobile); Supabase Auth on both.

## Global Constraints

- **Two repos, one branch name.** `magnetrip-web` and `../magnetrip` are separate git repos, both already on `feat/auth-split-layout`. Never commit to `main`.
- **Never hand-edit generated files.** `app/tokens.generated.css` and `../magnetrip/lib/theme/app_theme.dart` are written by `scripts/generate-tokens.mjs`. Change `design/tokens.json` + the generator, then run `pnpm tokens`.
- **Never hardcode colours.** Web uses `var(--token)` / Tailwind token classes; Flutter uses `MagnetripColors.*` and `MagnetripSpacing.*`.
- **Exact colour values:** `primaryDark` = `#0B6E66`, `primaryDeep` = `#08544E`. Existing `primary` = `#0D9488`.
- **Exact gradient:** 160°, stops `primary 0%`, `primaryDark 45%`, `primaryDeep 100%`. The 45% middle stop is a WCAG requirement, not a taste call — white on `#0D9488` is 3.74:1 and fails AA, while white on `#0B6E66` is 6.15:1 and passes. Do not move it.
- **Exact panel copy:** wordmark `Magnetrip`, tagline `Your trips, on a magnet.`
- **Medallion sizes:** 128px web ≥768px, 96px web <768px, 112dp Flutter. White ring `rgba(255,255,255,0.95)`, 3px. Decorative — `alt=""` on web, no semantic label on Flutter.
- **Split ratio:** 45% panel / 55% form. Web splits horizontally at `md:` (768px) and vertically below it. Flutter always splits vertically. **Flutter's band additionally has a 240dp floor** (`math.max(screenHeight * 0.45, 240.0)`) — on a short landscape screen a literal 45% is less tall than the medallion plus copy and would throw a `RenderFlex` overflow. The floor is required, not a deviation.
- **Validation copy is shared.** Flutter's strings must match `lib/validation/auth.ts` character for character, with one documented exception (the 72-char ceiling message).
- **Conventional Commits** (`feat:`, `fix:`, `docs:`, `chore:`), and every commit message ends with the `Co-Authored-By` trailer shown in the commit steps.
- **`flutter analyze` has a known baseline of 3 pre-existing info-level issues**, all in files this plan does not touch: `lib/features/trips/trips_repository.dart:109` and `:110` (`use_null_aware_elements`), and `test/features/trips/trip_list_navigation_test.dart:24` (`unnecessary_underscores`). They predate this branch. Leave them alone — fixing them is out of scope. "Clean" means these 3 and nothing more.
- **`pnpm lint` has a known baseline of 6 pre-existing problems (4 errors, 2 warnings) and exits 1**, all in files this plan does not touch: `app/(app)/dashboard/page.tsx`, `app/(app)/trips/[id]/edit/page.tsx`, `components/ui/carousel.tsx`, `hooks/use-mobile.ts`, `lib/env.test.ts`. They predate this branch (zero overlap with the branch diff). Leave them alone. "Lint clean" means no NEW problems in files this plan touches — the command still exits nonzero, so judge it by reading the file list, not the exit code.
- **Do not delete `components/ui/card.tsx`** — `components/trips/trip-card.tsx` still uses it.

---

## File Structure

**`magnetrip-web`**

| File | Responsibility |
| --- | --- |
| `design/tokens.json` | Source of truth for colours. Add `primaryDark`, `primaryDeep`. |
| `scripts/generate-tokens.mjs` | Emits CSS + Dart. Has **hardcoded** emit lists; adding JSON keys alone does nothing. |
| `scripts/generate-tokens.test.mjs` | Guards the generator's output. |
| `public/brand/logo.png` | **New.** 384px web-served medallion source. |
| `components/auth/auth-brand-panel.tsx` | **New.** The teal panel. Gradient, medallion, wordmark, tagline. No props. |
| `components/auth/auth-shell.tsx` | Heading block + form slot in the white column. Props unchanged: `{ title, subtitle?, children }`. |
| `app/(auth)/layout.tsx` | Owns the 45/55 split geometry and the breakpoint. Nothing else. |

**`../magnetrip`**

| File | Responsibility |
| --- | --- |
| `lib/theme/app_theme.dart` | Generated. Gains `primaryDark`, `primaryDeep`. |
| `assets/brand/logo.png` | **New.** 384px medallion source. |
| `pubspec.yaml` | Declare the asset (its `assets:` block is currently commented out). |
| `lib/features/auth/auth_validation.dart` | **New.** Pure validators. No Flutter imports. |
| `lib/features/auth/auth_scaffold.dart` | **New.** Band + form column. The Flutter counterpart to web's shell + panel. |
| `lib/features/auth/signup_screen.dart` | **New.** Signup form and its check-your-email state. |
| `lib/features/auth/auth_providers.dart` | Gains `AuthController.signUp`. |
| `lib/features/auth/login_screen.dart` | Renders through `AuthScaffold`; uses `validateLoginForm`; links to `/signup`. |
| `lib/features/auth/forgot_password_screen.dart` | Renders through `AuthScaffold`; loses its `AppBar`. |
| `lib/core/router.dart` | Gains the `/signup` route **and** `/signup` in `_authRoutes`. |

---

## Task 1: Design tokens

Adds the two teal shades to the shared pipeline. Everything downstream depends on this, so it goes first. Note this task commits to **both** repos, because `pnpm tokens` writes into the Flutter repo.

**Files:**
- Modify: `design/tokens.json`
- Modify: `scripts/generate-tokens.mjs` (`buildCss` root + theme lists; `buildDart` colors list)
- Test: `scripts/generate-tokens.test.mjs`
- Generated: `app/tokens.generated.css`, `../magnetrip/lib/theme/app_theme.dart`

**Interfaces:**
- Consumes: nothing.
- Produces: CSS variables `--primary-dark`, `--primary-deep` and Tailwind aliases `--color-primary-dark`, `--color-primary-deep`; Dart constants `MagnetripColors.primaryDark`, `MagnetripColors.primaryDeep`.

- [ ] **Step 1: Write the failing test**

In `scripts/generate-tokens.test.mjs`, add the two colours to the fixture. Change the `color` block's first two lines from:

```js
    primary: '#0D9488', primaryForeground: '#FFFFFF',
```

to:

```js
    primary: '#0D9488', primaryForeground: '#FFFFFF',
    primaryDark: '#0B6E66', primaryDeep: '#08544E',
```

Then add these assertions at the end of the `buildCss` test body (after the `--radius-2xl` line):

```js
  expect(css).toContain('--primary-dark: #0B6E66;');
  expect(css).toContain('--primary-deep: #08544E;');
  expect(css).toContain('--color-primary-dark: var(--primary-dark);');
  expect(css).toContain('--color-primary-deep: var(--primary-deep);');
```

And at the end of the `buildDart` test body (after the `package:google_fonts` line):

```js
  expect(dart).toContain('static const Color primaryDark = Color(0xFF0B6E66);');
  expect(dart).toContain('static const Color primaryDeep = Color(0xFF08544E);');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run scripts/generate-tokens.test.mjs`

Expected: FAIL. Both tests fail — the CSS assertions report the string is not contained, and the Dart assertions report `Color(0xFFUNDEFINED)` because `c.primaryDark` is `undefined`.

- [ ] **Step 3: Add the tokens to the source of truth**

In `design/tokens.json`, change:

```json
    "primary": "#0D9488",
    "primaryForeground": "#FFFFFF",
```

to:

```json
    "primary": "#0D9488",
    "primaryForeground": "#FFFFFF",
    "primaryDark": "#0B6E66",
    "primaryDeep": "#08544E",
```

- [ ] **Step 4: Teach the generator to emit them**

In `scripts/generate-tokens.mjs`, inside `buildCss`'s `root` object, after the `'--primary-foreground': c.primaryForeground,` line:

```js
    '--primary-dark': c.primaryDark,
    '--primary-deep': c.primaryDeep,
```

In the same function's `theme` array, add two entries at the top of the array (before `'--color-brand-accent: var(--brand-accent);'`):

```js
    '--color-primary-dark: var(--primary-dark);',
    '--color-primary-deep: var(--primary-deep);',
```

In `buildDart`'s `colors` array, after `colorField('primaryForeground', c.primaryForeground),`:

```js
    colorField('primaryDark', c.primaryDark),
    colorField('primaryDeep', c.primaryDeep),
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm vitest run scripts/generate-tokens.test.mjs`

Expected: PASS, 2 tests.

- [ ] **Step 6: Regenerate both platforms' theme files**

Run: `pnpm tokens`

Expected output: two `Wrote …` lines, one for `app/tokens.generated.css` and one for `../magnetrip/lib/theme/app_theme.dart`.

- [ ] **Step 7: Verify the generator is deterministic**

Run: `pnpm tokens && git diff --stat && (cd ../magnetrip && git diff --stat)`

Expected: the diffs list only `app/tokens.generated.css` (in web) and `lib/theme/app_theme.dart` (in Flutter), each showing added lines for the two new colours. Running `pnpm tokens` a second time must not change them again.

- [ ] **Step 8: Confirm the Flutter side compiles**

Run: `cd ../magnetrip && flutter analyze`

Expected: exactly the 3 pre-existing info-level issues listed in Global Constraints (2 in `lib/features/trips/trips_repository.dart`, 1 in `test/features/trips/trip_list_navigation_test.dart`) and nothing new. The regenerated theme file itself must be clean.

- [ ] **Step 9: Commit (both repos)**

```bash
git add design/tokens.json scripts/generate-tokens.mjs scripts/generate-tokens.test.mjs app/tokens.generated.css
git commit -m "feat(tokens): add primaryDark and primaryDeep teal shades

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"

cd ../magnetrip
git add lib/theme/app_theme.dart
git commit -m "feat(theme): regenerate with primaryDark and primaryDeep

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
cd ../magnetrip-web
```

---

## Task 2: Web split layout

Rebuilds the web auth chrome. Because `AuthShell` keeps its exact prop signature, none of the four page files change.

**Files:**
- Create: `public/brand/logo.png`
- Create: `components/auth/auth-brand-panel.tsx`
- Modify: `components/auth/auth-shell.tsx` (full rewrite, 22 lines)
- Modify: `app/(auth)/layout.tsx` (full rewrite, 7 lines)

**Interfaces:**
- Consumes: `--primary`, `--primary-dark`, `--primary-deep` from Task 1.
- Produces: `AuthBrandPanel` (no props) from `@/components/auth/auth-brand-panel`; `AuthShell({ title: string, subtitle?: string, children: React.ReactNode })` — unchanged signature, consumed by all four existing auth pages.

- [ ] **Step 1: Generate the web logo asset**

```bash
mkdir -p public/brand
sips -Z 384 assets/logo.png --out public/brand/logo.png
sips -g pixelWidth -g pixelHeight public/brand/logo.png
ls -lh public/brand/logo.png
```

Expected: 384×384, roughly 100–250 KB (down from the 1.7 MB source). 384px covers the 128px medallion at 3× DPR.

- [ ] **Step 2: Create the brand panel**

Create `components/auth/auth-brand-panel.tsx`:

```tsx
import Image from 'next/image';

/**
 * The branded 45% panel shared by every auth screen. Purely presentational —
 * it knows nothing about forms, routing or auth state.
 *
 * The gradient's middle stop sits at 45% for contrast, not aesthetics: white on
 * --primary is 3.74:1 (fails AA), while white on --primary-dark is 6.15:1.
 * Centring the content over the darker band is what makes the copy legible.
 */
export function AuthBrandPanel() {
  return (
    <div className="flex h-[45svh] shrink-0 flex-col items-center justify-center gap-3 bg-[linear-gradient(160deg,var(--primary)_0%,var(--primary-dark)_45%,var(--primary-deep)_100%)] px-6 text-center md:h-auto md:w-[45%]">
      <Image
        src="/brand/logo.png"
        alt=""
        width={384}
        height={384}
        sizes="128px"
        priority
        className="size-24 rounded-full border-[3px] border-white/95 object-cover shadow-[0_7px_20px_rgba(0,0,0,0.32)] md:size-32"
      />
      <p className="text-xl font-extrabold tracking-tight text-white md:text-2xl">Magnetrip</p>
      <p className="text-[13px] text-white/90">Your trips, on a magnet.</p>
    </div>
  );
}
```

The medallion carries `alt=""` because the wordmark directly beneath it already announces "Magnetrip"; labelling the image would make screen readers say it twice.

- [ ] **Step 3: Rewrite the shell**

Replace the entire contents of `components/auth/auth-shell.tsx`:

```tsx
/**
 * The heading block and form slot for the white 55% column. The card wrapper
 * and the text wordmark that used to live here are gone — the white column is
 * the card now, and the wordmark moved to AuthBrandPanel.
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
        {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}
```

Note this is also an accessibility improvement: the auth pages previously had no `<h1>` at all, because the title rendered as a `CardTitle` `<div>`.

- [ ] **Step 4: Rewrite the layout**

Replace the entire contents of `app/(auth)/layout.tsx`:

```tsx
import { AuthBrandPanel } from '@/components/auth/auth-brand-panel';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-1 flex-col md:flex-row">
      <AuthBrandPanel />
      <main className="flex flex-1 items-center justify-center bg-card px-6 py-10">
        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Verify types, lint and build**

Run: `pnpm lint && pnpm build`

Expected: no lint problems in the files you touched (see the lint baseline in Global Constraints — the command exits 1 regardless), and `pnpm build` succeeds.

If lint reports unused imports for `Card`, `CardContent`, `CardDescription`, `CardHeader` or `CardTitle`, the Step 3 rewrite left the old import line in place — delete it. Do **not** delete `components/ui/card.tsx` itself; `components/trips/trip-card.tsx` still imports from it.

- [ ] **Step 6: Verify the existing unit suite is untouched**

Run: `pnpm test`

Expected: all tests pass, including the generator test from Task 1.

- [ ] **Step 7: Commit**

```bash
git add public/brand/logo.png components/auth/auth-brand-panel.tsx components/auth/auth-shell.tsx "app/(auth)/layout.tsx"
git commit -m "feat(auth): split the auth screens into a branded panel and form column

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Flutter validation module

Pure Dart, no Flutter imports, no UI. Written test-first because it is the one piece with genuinely enumerable behaviour. All work in `../magnetrip`.

**Files:**
- Create: `../magnetrip/lib/features/auth/auth_validation.dart`
- Test: `../magnetrip/test/features/auth/auth_validation_test.dart`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `String? validateEmail(String value)`
  - `String? validateLoginPassword(String value)`
  - `String? validateNewPassword(String value)`
  - `String? validatePasswordConfirmation(String password, String confirmPassword)`
  - `String? validateLoginForm({required String email, required String password})`
  - `String? validateSignupForm({required String email, required String password, required String confirmPassword})`

  All return `null` when valid, or the user-facing message. Consumed by Tasks 4 and 5.

- [ ] **Step 1: Write the failing test**

Create `../magnetrip/test/features/auth/auth_validation_test.dart`:

```dart
import 'package:flutter_test/flutter_test.dart';
import 'package:magnetrip/features/auth/auth_validation.dart';

void main() {
  group('validateEmail', () {
    test('accepts a normal address', () {
      expect(validateEmail('sven@thecalda.com'), isNull);
    });

    test('trims surrounding whitespace before judging', () {
      expect(validateEmail('  sven@thecalda.com  '), isNull);
    });

    test('rejects empty, missing-@ and missing-dot inputs with web copy', () {
      expect(validateEmail(''), 'Enter a valid email address');
      expect(validateEmail('sven'), 'Enter a valid email address');
      expect(validateEmail('sven@localhost'), 'Enter a valid email address');
      expect(validateEmail('sven @thecalda.com'), 'Enter a valid email address');
    });
  });

  group('validateLoginPassword', () {
    test('accepts any non-empty value, because the server decides the rest', () {
      expect(validateLoginPassword('a'), isNull);
    });

    test('rejects empty with web copy', () {
      expect(validateLoginPassword(''), 'Enter your password');
    });
  });

  group('validateNewPassword', () {
    test('accepts exactly 8 and exactly 72 characters', () {
      expect(validateNewPassword('a' * 8), isNull);
      expect(validateNewPassword('a' * 72), isNull);
    });

    test('rejects 7 characters with web copy', () {
      expect(validateNewPassword('a' * 7), 'Password must be at least 8 characters');
    });

    test('rejects 73 characters', () {
      expect(validateNewPassword('a' * 73), 'Password must be 72 characters or fewer');
    });
  });

  group('validatePasswordConfirmation', () {
    test('accepts a match', () {
      expect(validatePasswordConfirmation('hunter2hunter2', 'hunter2hunter2'), isNull);
    });

    test('rejects a mismatch with web copy', () {
      expect(validatePasswordConfirmation('hunter2hunter2', 'hunter3hunter3'),
          'Passwords do not match');
    });
  });

  group('validateLoginForm', () {
    test('accepts a valid pair', () {
      expect(validateLoginForm(email: 'sven@thecalda.com', password: 'x'), isNull);
    });

    test('reports the email error first, mirroring Zod issues[0]', () {
      expect(validateLoginForm(email: 'nope', password: ''),
          'Enter a valid email address');
    });
  });

  group('validateSignupForm', () {
    test('accepts a valid trio', () {
      expect(
          validateSignupForm(
              email: 'sven@thecalda.com',
              password: 'hunter2hunter2',
              confirmPassword: 'hunter2hunter2'),
          isNull);
    });

    test('reports email, then password, then confirmation, in that order', () {
      expect(
          validateSignupForm(email: 'nope', password: 'short', confirmPassword: 'other'),
          'Enter a valid email address');
      expect(
          validateSignupForm(
              email: 'sven@thecalda.com', password: 'short', confirmPassword: 'other'),
          'Password must be at least 8 characters');
      expect(
          validateSignupForm(
              email: 'sven@thecalda.com',
              password: 'hunter2hunter2',
              confirmPassword: 'other'),
          'Passwords do not match');
    });
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd ../magnetrip && flutter test test/features/auth/auth_validation_test.dart`

Expected: FAIL — compile error, `Target of URI doesn't exist: 'package:magnetrip/features/auth/auth_validation.dart'`.

- [ ] **Step 3: Write the implementation**

Create `../magnetrip/lib/features/auth/auth_validation.dart`:

```dart
/// Client-side auth validation.
///
/// Every message string is copied verbatim from the web app's Zod schemas in
/// `magnetrip-web/lib/validation/auth.ts` so the two platforms cannot drift.
/// The one exception is the 72-character ceiling: web's `z.string().max(72)`
/// carries no custom message and falls back to Zod's default, so the copy below
/// is Flutter-only. Reaching it takes 73 typed characters.
///
/// These checks exist to give fast feedback, not to be authoritative — the
/// server remains the real validator.
library;

/// Deliberately permissive: something, an @, something, a dot, something.
final _emailPattern = RegExp(r'^[^@\s]+@[^@\s]+\.[^@\s]+$');

const _invalidEmail = 'Enter a valid email address';
const _missingPassword = 'Enter your password';
const _shortPassword = 'Password must be at least 8 characters';
const _longPassword = 'Password must be 72 characters or fewer';
const _passwordMismatch = 'Passwords do not match';

/// Trims first, matching the web schema's `z.string().trim().email()`.
String? validateEmail(String value) {
  return _emailPattern.hasMatch(value.trim()) ? null : _invalidEmail;
}

/// Signing in only needs a non-empty password; length rules would lock out
/// anyone who registered before those rules existed.
String? validateLoginPassword(String value) {
  return value.isEmpty ? _missingPassword : null;
}

/// Signing up and resetting require 8–72 characters.
String? validateNewPassword(String value) {
  if (value.length < 8) return _shortPassword;
  if (value.length > 72) return _longPassword;
  return null;
}

String? validatePasswordConfirmation(String password, String confirmPassword) {
  return password == confirmPassword ? null : _passwordMismatch;
}

/// Returns the first error only, mirroring how the web reads `issues[0]`.
String? validateLoginForm({required String email, required String password}) {
  return validateEmail(email) ?? validateLoginPassword(password);
}

/// Returns the first error only, mirroring how the web reads `issues[0]`.
String? validateSignupForm({
  required String email,
  required String password,
  required String confirmPassword,
}) {
  return validateEmail(email) ??
      validateNewPassword(password) ??
      validatePasswordConfirmation(password, confirmPassword);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd ../magnetrip && flutter test test/features/auth/auth_validation_test.dart`

Expected: PASS, all groups green.

- [ ] **Step 5: Verify lints**

Run: `cd ../magnetrip && flutter analyze`

Expected: exactly the 3 pre-existing info-level issues listed in Global Constraints (2 in `lib/features/trips/trips_repository.dart`, 1 in `test/features/trips/trip_list_navigation_test.dart`) and nothing new.

- [ ] **Step 6: Commit**

```bash
cd ../magnetrip
git add lib/features/auth/auth_validation.dart test/features/auth/auth_validation_test.dart
git commit -m "feat(auth): add client-side validation mirroring the web schemas

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
cd ../magnetrip-web
```

---

## Task 4: Flutter AuthScaffold and restyled screens

Creates the shared Flutter chrome and moves the two existing auth screens onto it. The logo asset is declared here because the widget tests in this task render it.

**Files:**
- Create: `../magnetrip/assets/brand/logo.png`
- Modify: `../magnetrip/pubspec.yaml` (uncomment and fill the `assets:` block)
- Create: `../magnetrip/lib/features/auth/auth_scaffold.dart`
- Modify: `../magnetrip/lib/features/auth/login_screen.dart`
- Modify: `../magnetrip/lib/features/auth/forgot_password_screen.dart`
- Test: `../magnetrip/test/features/auth/auth_scaffold_test.dart`

**Interfaces:**
- Consumes: `MagnetripColors.primaryDark` / `.primaryDeep` (Task 1); `validateLoginForm({required String email, required String password})` (Task 3).
- Produces: `AuthScaffold({Key? key, required String title, String? subtitle, required List<Widget> children})` from `lib/features/auth/auth_scaffold.dart`. Consumed by Task 5.

- [ ] **Step 1: Generate and declare the Flutter logo asset**

```bash
cd ../magnetrip
mkdir -p assets/brand
sips -Z 384 assets/logo.png --out assets/brand/logo.png
sips -g pixelWidth -g pixelHeight assets/brand/logo.png
```

Expected: 384×384. A 112dp medallion at 3× DPR needs 336px, so 384 is the next comfortable size. One file only — no `2.0x` / `3.0x` variant directories.

In `pubspec.yaml`, find the commented block under `flutter:`:

```yaml
  # To add assets to your application, add an assets section, like this:
  # assets:
  #   - images/a_dot_burr.jpeg
  #   - images/a_dot_ham.jpeg
```

Replace those four lines with:

```yaml
  assets:
    - assets/brand/logo.png
```

Then run: `flutter pub get`

- [ ] **Step 2: Write the failing test**

Create `../magnetrip/test/features/auth/auth_scaffold_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:magnetrip/features/auth/auth_scaffold.dart';

void main() {
  testWidgets('renders the brand band, the heading block and the children',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: AuthScaffold(
        title: 'Welcome back',
        subtitle: 'Sign in to manage your trips',
        children: [Text('form goes here')],
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Magnetrip'), findsOneWidget);
    expect(find.text('Your trips, on a magnet.'), findsOneWidget);
    expect(find.text('Welcome back'), findsOneWidget);
    expect(find.text('Sign in to manage your trips'), findsOneWidget);
    expect(find.text('form goes here'), findsOneWidget);
  });

  testWidgets('omits the subtitle when none is given', (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: AuthScaffold(title: 'Reset password', children: [Text('body')]),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Reset password'), findsOneWidget);
    expect(find.text('body'), findsOneWidget);
  });

  testWidgets('has no AppBar — auth screens navigate with in-body links',
      (tester) async {
    await tester.pumpWidget(const MaterialApp(
      home: AuthScaffold(title: 'Reset password', children: [Text('body')]),
    ));
    await tester.pumpAndSettle();

    expect(find.byType(AppBar), findsNothing);
  });
}
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd ../magnetrip && flutter test test/features/auth/auth_scaffold_test.dart`

Expected: FAIL — `Target of URI doesn't exist: 'package:magnetrip/features/auth/auth_scaffold.dart'`.

- [ ] **Step 4: Write the AuthScaffold**

Create `../magnetrip/lib/features/auth/auth_scaffold.dart`:

```dart
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../theme/app_theme.dart';

/// Shared chrome for every auth screen: a branded gradient band across the top
/// 45% of the screen with the form column beneath it. The Flutter counterpart
/// to the web app's AuthBrandPanel + AuthShell pair.
class AuthScaffold extends StatelessWidget {
  const AuthScaffold({
    super.key,
    required this.title,
    this.subtitle,
    required this.children,
  });

  final String title;
  final String? subtitle;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    // Screen height, deliberately not the shrunken viewport, so the band does
    // not resize the moment a text field takes focus. The whole page scrolls
    // instead, letting the band slide away under an open keyboard.
    final screenHeight = MediaQuery.sizeOf(context).height;
    // The floor keeps the band's contents from overflowing on short (landscape)
    // screens, where a literal 45% is less tall than the medallion and copy.
    final bandHeight = math.max(screenHeight * 0.45, 240.0);
    final textTheme = Theme.of(context).textTheme;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        statusBarBrightness: Brightness.dark,
      ),
      child: Scaffold(
        backgroundColor: MagnetripColors.surface,
        body: SingleChildScrollView(
          child: Column(
            children: [
              _BrandBand(height: bandHeight),
              Padding(
                padding: const EdgeInsets.all(MagnetripSpacing.s6),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 400),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          title,
                          style: textTheme.headlineSmall
                              ?.copyWith(fontWeight: FontWeight.w800),
                        ),
                        if (subtitle != null) ...[
                          const SizedBox(height: MagnetripSpacing.s2),
                          Text(
                            subtitle!,
                            style: textTheme.bodyMedium
                                ?.copyWith(color: MagnetripColors.textSecondary),
                          ),
                        ],
                        const SizedBox(height: MagnetripSpacing.s6),
                        ...children,
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// The teal gradient band: medallion, wordmark, tagline. Runs edge to edge
/// behind the status bar, with its contents inset below it.
class _BrandBand extends StatelessWidget {
  const _BrandBand({required this.height});

  final double height;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: double.infinity,
      padding: EdgeInsets.only(top: MediaQuery.paddingOf(context).top),
      decoration: const BoxDecoration(
        // Approximates the web's linear-gradient(160deg, …): roughly 19 degrees
        // off vertical, with the same 0 / 45% / 100% stops. The 45% stop is a
        // contrast requirement — white on primary is 3.74:1 and fails AA, while
        // white on primaryDark is 6.15:1.
        gradient: LinearGradient(
          begin: Alignment(-0.35, -1.0),
          end: Alignment(0.35, 1.0),
          stops: [0.0, 0.45, 1.0],
          colors: [
            MagnetripColors.primary,
            MagnetripColors.primaryDark,
            MagnetripColors.primaryDeep,
          ],
        ),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 112,
              height: 112,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: Colors.white.withValues(alpha: 0.95),
                  width: 3,
                ),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x52000000),
                    blurRadius: 20,
                    offset: Offset(0, 7),
                  ),
                ],
              ),
              // Decorative: the wordmark below already says "Magnetrip", so a
              // semantic label here would be read out twice.
              child: ClipOval(
                child: Image.asset('assets/brand/logo.png', fit: BoxFit.cover),
              ),
            ),
            const SizedBox(height: MagnetripSpacing.s3),
            const Text(
              'Magnetrip',
              style: TextStyle(
                color: Colors.white,
                fontSize: 22,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: MagnetripSpacing.s1),
            Text(
              'Your trips, on a magnet.',
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.9),
                fontSize: 13,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd ../magnetrip && flutter test test/features/auth/auth_scaffold_test.dart`

Expected: PASS, 3 tests.

If it fails with `Unable to load asset: "assets/brand/logo.png"`, the test asset manifest is stale — run `flutter clean && flutter pub get` and retry. The asset must be declared in `pubspec.yaml` (Step 1) for `flutter test` to bundle it.

- [ ] **Step 6: Move the login screen onto the scaffold**

In `../magnetrip/lib/features/auth/login_screen.dart`, add two imports beside the existing ones:

```dart
import 'auth_scaffold.dart';
import 'auth_validation.dart';
```

The `import '../../theme/app_theme.dart';` line stays — `MagnetripColors` and `MagnetripSpacing` are still used below.

Replace the body of `_submit` (its first `if` block) so validation runs through the shared module. Change:

```dart
    final email = _email.text.trim();
    final password = _password.text;
    if (email.isEmpty || password.isEmpty) {
      setState(() => _error = 'Enter your email and password.');
      return;
    }
```

to:

```dart
    final email = _email.text.trim();
    final password = _password.text;
    final invalid = validateLoginForm(email: email, password: password);
    if (invalid != null) {
      setState(() => _error = invalid);
      return;
    }
```

Then replace the whole `build` method with:

```dart
  @override
  Widget build(BuildContext context) {
    return AuthScaffold(
      title: 'Welcome back',
      subtitle: 'Sign in to manage your trips',
      children: [
        TextField(
          key: const Key('login-email'),
          controller: _email,
          enabled: !_loading,
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
          decoration: const InputDecoration(labelText: 'Email'),
        ),
        const SizedBox(height: MagnetripSpacing.s4),
        TextField(
          key: const Key('login-password'),
          controller: _password,
          enabled: !_loading,
          obscureText: true,
          autofillHints: const [AutofillHints.password],
          onSubmitted: (_) => _submit(),
          decoration: const InputDecoration(labelText: 'Password'),
        ),
        if (_error != null) ...[
          const SizedBox(height: MagnetripSpacing.s3),
          Text(_error!, style: const TextStyle(color: MagnetripColors.error)),
        ],
        const SizedBox(height: MagnetripSpacing.s6),
        FilledButton(
          onPressed: _loading ? null : _submit,
          child: _loading
              ? const SizedBox(
                  height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Sign in'),
        ),
        const SizedBox(height: MagnetripSpacing.s3),
        TextButton(
          onPressed: _loading ? null : () => context.go('/forgot-password'),
          child: const Text('Forgot password?'),
        ),
      ],
    );
  }
```

The inline `Text('Magnetrip')` wordmark and the `Scaffold` / `SafeArea` / `Center` / `SingleChildScrollView` / `ConstrainedBox` nesting are all gone — `AuthScaffold` owns them now. The "No account? Create one" link comes in Task 6, once `/signup` exists.

- [ ] **Step 7: Move the forgot-password screen onto the scaffold, dropping its AppBar**

In `../magnetrip/lib/features/auth/forgot_password_screen.dart`, add:

```dart
import 'auth_scaffold.dart';
import 'auth_validation.dart';
```

Replace the empty-check in `_submit`. Change:

```dart
    final email = _email.text.trim();
    if (email.isEmpty) {
      setState(() => _error = 'Enter your email.');
      return;
    }
```

to:

```dart
    final email = _email.text.trim();
    final invalid = validateEmail(email);
    if (invalid != null) {
      setState(() => _error = invalid);
      return;
    }
```

Then replace the whole `build` method with:

```dart
  @override
  Widget build(BuildContext context) {
    if (_sent) {
      return AuthScaffold(
        title: 'Check your email',
        subtitle: 'If an account exists, we sent a reset link.',
        children: [
          TextButton(
            onPressed: () => context.go('/login'),
            child: const Text('Back to sign in'),
          ),
        ],
      );
    }

    return AuthScaffold(
      title: 'Reset your password',
      subtitle: "We'll email you a reset link.",
      children: [
        TextField(
          key: const Key('forgot-email'),
          controller: _email,
          enabled: !_loading,
          keyboardType: TextInputType.emailAddress,
          onSubmitted: (_) => _submit(),
          decoration: const InputDecoration(labelText: 'Email'),
        ),
        if (_error != null) ...[
          const SizedBox(height: MagnetripSpacing.s3),
          Text(_error!, style: const TextStyle(color: MagnetripColors.error)),
        ],
        const SizedBox(height: MagnetripSpacing.s6),
        FilledButton(
          onPressed: _loading ? null : _submit,
          child: _loading
              ? const SizedBox(
                  height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Send reset link'),
        ),
        const SizedBox(height: MagnetripSpacing.s3),
        TextButton(
          onPressed: _loading ? null : () => context.go('/login'),
          child: const Text('Back to sign in'),
        ),
      ],
    );
  }
```

The `appBar: AppBar()` is deliberately not carried over: a back arrow floating on the teal band reads as a rendering bug, and this screen already offers "Back to sign in" in its body — the same pattern the web uses.

- [ ] **Step 8: Run the full Flutter suite and lints**

Run: `cd ../magnetrip && flutter analyze && flutter test`

Expected: exactly the 3 pre-existing info-level issues listed in Global Constraints (2 in `lib/features/trips/trips_repository.dart`, 1 in `test/features/trips/trip_list_navigation_test.dart`) and nothing new, and every test passing. Watch for an unused-import warning on `app_theme.dart` in either screen — if one appears, that screen no longer references `MagnetripColors`/`MagnetripSpacing` and the import should go.

- [ ] **Step 9: Commit**

```bash
cd ../magnetrip
git add assets/brand/logo.png pubspec.yaml lib/features/auth/auth_scaffold.dart \
  lib/features/auth/login_screen.dart lib/features/auth/forgot_password_screen.dart \
  test/features/auth/auth_scaffold_test.dart
git commit -m "feat(auth): move auth screens onto a branded split scaffold

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
cd ../magnetrip-web
```

---

## Task 5: Flutter signup screen

Builds the screen and its controller method in isolation, tested directly via `MaterialApp(home:)`. Navigation wiring is Task 6.

**Files:**
- Modify: `../magnetrip/lib/features/auth/auth_providers.dart`
- Create: `../magnetrip/lib/features/auth/signup_screen.dart`
- Test: `../magnetrip/test/features/auth/signup_screen_test.dart`

**Interfaces:**
- Consumes: `AuthScaffold({required String title, String? subtitle, required List<Widget> children})` (Task 4); `validateSignupForm({required String email, required String password, required String confirmPassword})` (Task 3); existing `authErrorMessage(Object?)` and `authControllerProvider`.
- Produces: `Future<bool> AuthController.signUp({required String email, required String password})` — `true` means a session exists (confirmation disabled) and the router redirect takes over; `false` means show the check-your-email state. Also `SignupScreen` (const constructor, no args), consumed by Task 6.

- [ ] **Step 1: Write the failing test**

Create `../magnetrip/test/features/auth/signup_screen_test.dart`:

```dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:magnetrip/features/auth/auth_providers.dart';
import 'package:magnetrip/features/auth/signup_screen.dart';

class MockAuthController extends Mock implements AuthController {}

Future<void> _pump(WidgetTester tester, MockAuthController controller) async {
  await tester.pumpWidget(ProviderScope(
    overrides: [authControllerProvider.overrideWithValue(controller)],
    child: const MaterialApp(home: SignupScreen()),
  ));
  await tester.pumpAndSettle();
}

Future<void> _fill(
  WidgetTester tester, {
  required String email,
  required String password,
  required String confirm,
}) async {
  await tester.enterText(find.byKey(const Key('signup-email')), email);
  await tester.enterText(find.byKey(const Key('signup-password')), password);
  await tester.enterText(find.byKey(const Key('signup-confirm')), confirm);
}

/// On the 800x600 test surface the band plus three fields push the submit button
/// below the fold. enterText does not hit-test but tap does, so the button has
/// to be scrolled into view first or the tap throws.
Future<void> _tapCreate(WidgetTester tester) async {
  await tester.ensureVisible(find.text('Create account'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Create account'));
}

void main() {
  testWidgets('mismatched passwords are rejected without calling the controller',
      (tester) async {
    final controller = MockAuthController();
    await _pump(tester, controller);

    await _fill(tester,
        email: 'sven@thecalda.com', password: 'hunter2hunter2', confirm: 'nope');
    await _tapCreate(tester);
    await tester.pumpAndSettle();

    expect(find.text('Passwords do not match'), findsOneWidget);
    verifyNever(() => controller.signUp(
        email: any(named: 'email'), password: any(named: 'password')));
  });

  testWidgets('a short password is rejected without calling the controller',
      (tester) async {
    final controller = MockAuthController();
    await _pump(tester, controller);

    await _fill(tester, email: 'sven@thecalda.com', password: 'short', confirm: 'short');
    await _tapCreate(tester);
    await tester.pumpAndSettle();

    expect(find.text('Password must be at least 8 characters'), findsOneWidget);
    verifyNever(() => controller.signUp(
        email: any(named: 'email'), password: any(named: 'password')));
  });

  testWidgets('no session means email confirmation is pending', (tester) async {
    final controller = MockAuthController();
    when(() => controller.signUp(
            email: any(named: 'email'), password: any(named: 'password')))
        .thenAnswer((_) async => false);
    await _pump(tester, controller);

    await _fill(tester,
        email: 'sven@thecalda.com',
        password: 'hunter2hunter2',
        confirm: 'hunter2hunter2');
    await _tapCreate(tester);
    await tester.pumpAndSettle();

    expect(find.text('Check your email'), findsOneWidget);
    expect(find.textContaining('sven@thecalda.com'), findsOneWidget);
    verify(() => controller.signUp(
        email: 'sven@thecalda.com', password: 'hunter2hunter2')).called(1);
  });

  testWidgets('an existing account surfaces friendly copy, not the raw error',
      (tester) async {
    final controller = MockAuthController();
    when(() => controller.signUp(
            email: any(named: 'email'), password: any(named: 'password')))
        .thenThrow(const AuthException('duplicate', code: 'user_already_exists'));
    await _pump(tester, controller);

    await _fill(tester,
        email: 'sven@thecalda.com',
        password: 'hunter2hunter2',
        confirm: 'hunter2hunter2');
    await _tapCreate(tester);
    await tester.pumpAndSettle();

    expect(find.text('An account with this email already exists.'), findsOneWidget);
    expect(find.text('Check your email'), findsNothing);
  });

  testWidgets('the submit button is disabled while signing up', (tester) async {
    final controller = MockAuthController();
    final pending = Completer<bool>();
    when(() => controller.signUp(
            email: any(named: 'email'), password: any(named: 'password')))
        .thenAnswer((_) => pending.future);
    await _pump(tester, controller);

    await _fill(tester,
        email: 'sven@thecalda.com',
        password: 'hunter2hunter2',
        confirm: 'hunter2hunter2');
    await _tapCreate(tester);
    await tester.pump();

    final button = tester.widget<FilledButton>(find.byType(FilledButton));
    expect(button.onPressed, isNull);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);

    pending.complete(false);
    await tester.pumpAndSettle();
  });
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd ../magnetrip && flutter test test/features/auth/signup_screen_test.dart`

Expected: FAIL — `Target of URI doesn't exist: 'package:magnetrip/features/auth/signup_screen.dart'`, plus `The method 'signUp' isn't defined for the type 'AuthController'`.

- [ ] **Step 3: Add signUp to the controller**

In `../magnetrip/lib/features/auth/auth_providers.dart`, insert this method into `AuthController`, directly after `signIn`:

```dart
  /// Registers a new account. Returns true when Supabase handed back a session,
  /// meaning email confirmation is disabled and the router's redirect will take
  /// over. Returns false when confirmation is pending, so the caller should ask
  /// the user to check their inbox.
  ///
  /// The confirmation link points at the web callback, so a phone user tapping
  /// it lands on the web dashboard rather than back in the app — the same
  /// trade-off `sendPasswordReset` already makes. Deep linking is future work.
  Future<bool> signUp({required String email, required String password}) async {
    final response = await _client.auth.signUp(
      email: email,
      password: password,
      emailRedirectTo: '${AppConfig.apiBaseUrl}/auth/callback?next=/dashboard',
    );
    return response.session != null;
  }
```

`AppConfig` is already imported in this file (`import '../../core/config.dart';`).

Returning `bool` rather than `AuthResponse` keeps Supabase types out of the widget layer.

- [ ] **Step 4: Write the signup screen**

Create `../magnetrip/lib/features/auth/signup_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../theme/app_theme.dart';
import 'auth_error.dart';
import 'auth_providers.dart';
import 'auth_scaffold.dart';
import 'auth_validation.dart';

/// Account registration. Mirrors the web app's `app/(auth)/signup/page.tsx`,
/// including its two-state flow: submit, then either the router redirects on a
/// live session or we ask the user to confirm their email.
class SignupScreen extends ConsumerStatefulWidget {
  const SignupScreen({super.key});
  @override
  ConsumerState<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends ConsumerState<SignupScreen> {
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  String? _error;
  bool _loading = false;
  bool _awaitingConfirmation = false;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final email = _email.text.trim();
    final password = _password.text;
    final invalid = validateSignupForm(
      email: email,
      password: password,
      confirmPassword: _confirm.text,
    );
    if (invalid != null) {
      setState(() => _error = invalid);
      return;
    }
    setState(() {
      _error = null;
      _loading = true;
    });
    try {
      final signedIn =
          await ref.read(authControllerProvider).signUp(email: email, password: password);
      // A session means the router redirect handles navigation, exactly as it
      // does after signIn. Otherwise confirmation is pending.
      if (!signedIn && mounted) setState(() => _awaitingConfirmation = true);
    } catch (e) {
      if (mounted) setState(() => _error = authErrorMessage(e));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_awaitingConfirmation) {
      return AuthScaffold(
        title: 'Check your email',
        subtitle: 'We sent a confirmation link to ${_email.text.trim()}.',
        children: [
          Text(
            'Click the link in that email to activate your account, then sign in.',
            style: Theme.of(context)
                .textTheme
                .bodyMedium
                ?.copyWith(color: MagnetripColors.textSecondary),
          ),
          const SizedBox(height: MagnetripSpacing.s6),
          TextButton(
            onPressed: () => context.go('/login'),
            child: const Text('Back to sign in'),
          ),
        ],
      );
    }

    return AuthScaffold(
      title: 'Create your account',
      subtitle: 'Start collecting your trips',
      children: [
        TextField(
          key: const Key('signup-email'),
          controller: _email,
          enabled: !_loading,
          keyboardType: TextInputType.emailAddress,
          autofillHints: const [AutofillHints.email],
          decoration: const InputDecoration(labelText: 'Email'),
        ),
        const SizedBox(height: MagnetripSpacing.s4),
        TextField(
          key: const Key('signup-password'),
          controller: _password,
          enabled: !_loading,
          obscureText: true,
          autofillHints: const [AutofillHints.newPassword],
          decoration: const InputDecoration(labelText: 'Password'),
        ),
        const SizedBox(height: MagnetripSpacing.s4),
        TextField(
          key: const Key('signup-confirm'),
          controller: _confirm,
          enabled: !_loading,
          obscureText: true,
          autofillHints: const [AutofillHints.newPassword],
          onSubmitted: (_) => _submit(),
          decoration: const InputDecoration(labelText: 'Confirm password'),
        ),
        if (_error != null) ...[
          const SizedBox(height: MagnetripSpacing.s3),
          Text(_error!, style: const TextStyle(color: MagnetripColors.error)),
        ],
        const SizedBox(height: MagnetripSpacing.s6),
        FilledButton(
          onPressed: _loading ? null : _submit,
          child: _loading
              ? const SizedBox(
                  height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Create account'),
        ),
        const SizedBox(height: MagnetripSpacing.s3),
        TextButton(
          onPressed: _loading ? null : () => context.go('/login'),
          child: const Text('Already have an account? Sign in'),
        ),
      ],
    );
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd ../magnetrip && flutter test test/features/auth/signup_screen_test.dart`

Expected: PASS, 5 tests.

Note the `_tapCreate` helper exists specifically because the button is below the fold on the default test surface. If a tap still misses, check that `AuthScaffold` wrapped the page in a `SingleChildScrollView` — `ensureVisible` needs a scrollable ancestor to work.

- [ ] **Step 6: Run the full suite and lints**

Run: `cd ../magnetrip && flutter analyze && flutter test`

Expected: exactly the 3 pre-existing info-level issues listed in Global Constraints (2 in `lib/features/trips/trips_repository.dart`, 1 in `test/features/trips/trip_list_navigation_test.dart`) and nothing new, and every test passing.

- [ ] **Step 7: Commit**

```bash
cd ../magnetrip
git add lib/features/auth/auth_providers.dart lib/features/auth/signup_screen.dart \
  test/features/auth/signup_screen_test.dart
git commit -m "feat(auth): add the signup screen

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
cd ../magnetrip-web
```

---

## Task 6: Route the signup screen

Wires `/signup` into the router and links it from login. Both router edits belong together: adding the `GoRoute` without adding `/signup` to `_authRoutes` makes `redirectLocation` bounce every signed-out visitor straight back to `/login`.

**Files:**
- Modify: `../magnetrip/lib/core/router.dart:11` (the `_authRoutes` set) and the `routes:` list
- Modify: `../magnetrip/lib/features/auth/login_screen.dart`
- Test: `../magnetrip/test/core/router_test.dart`
- Test: `../magnetrip/test/features/auth/login_screen_test.dart` (new)

**Interfaces:**
- Consumes: `SignupScreen` (Task 5); existing `redirectLocation({required bool loggedIn, required String location})`.
- Produces: a reachable `/signup` route.

- [ ] **Step 1: Write the failing redirect test**

In `../magnetrip/test/core/router_test.dart`, add one line to the first test's body:

```dart
    expect(redirectLocation(loggedIn: false, location: '/signup'), isNull);
```

and one line to the second test's body:

```dart
    expect(redirectLocation(loggedIn: true, location: '/signup'), '/');
```

- [ ] **Step 2: Write the failing navigation test**

Create `../magnetrip/test/features/auth/login_screen_test.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:mocktail/mocktail.dart';
import 'package:magnetrip/features/auth/auth_providers.dart';
import 'package:magnetrip/features/auth/login_screen.dart';
import 'package:magnetrip/features/auth/signup_screen.dart';

class MockAuthController extends Mock implements AuthController {}

void main() {
  testWidgets('the create-account link opens the signup screen', (tester) async {
    final router = GoRouter(routes: [
      GoRoute(path: '/', builder: (_, _) => const LoginScreen()),
      GoRoute(path: '/signup', builder: (_, _) => const SignupScreen()),
    ]);

    await tester.pumpWidget(ProviderScope(
      overrides: [authControllerProvider.overrideWithValue(MockAuthController())],
      child: MaterialApp.router(routerConfig: router),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Welcome back'), findsOneWidget);

    await tester.ensureVisible(find.text('No account? Create one'));
    await tester.tap(find.text('No account? Create one'));
    await tester.pumpAndSettle();

    expect(find.byType(SignupScreen), findsOneWidget);
    expect(find.text('Create your account'), findsOneWidget);
  });
}
```

- [ ] **Step 3: Run both tests to verify they fail**

Run: `cd ../magnetrip && flutter test test/core/router_test.dart test/features/auth/login_screen_test.dart`

Expected: FAIL. The router test reports `Expected: null / Actual: '/login'` for the signed-out `/signup` case. The navigation test fails to find `No account? Create one`.

- [ ] **Step 4: Register the route**

In `../magnetrip/lib/core/router.dart`, add the import beside the other auth screen imports:

```dart
import '../features/auth/signup_screen.dart';
```

Change line 11 from:

```dart
const _authRoutes = {'/login', '/forgot-password'};
```

to:

```dart
const _authRoutes = {'/login', '/signup', '/forgot-password'};
```

And add the route to the `routes:` list, directly after the `/login` entry:

```dart
      GoRoute(path: '/signup', builder: (_, _) => const SignupScreen()),
```

- [ ] **Step 5: Add the login link**

In `../magnetrip/lib/features/auth/login_screen.dart`, append one more child to the `AuthScaffold` `children:` list, after the "Forgot password?" `TextButton`:

```dart
        TextButton(
          onPressed: _loading ? null : () => context.go('/signup'),
          child: const Text('No account? Create one'),
        ),
```

- [ ] **Step 6: Run both tests to verify they pass**

Run: `cd ../magnetrip && flutter test test/core/router_test.dart test/features/auth/login_screen_test.dart`

Expected: PASS, 3 tests total.

- [ ] **Step 7: Run the full suite and lints**

Run: `cd ../magnetrip && flutter analyze && flutter test`

Expected: exactly the 3 pre-existing info-level issues listed in Global Constraints (2 in `lib/features/trips/trips_repository.dart`, 1 in `test/features/trips/trip_list_navigation_test.dart`) and nothing new, and every test passing.

- [ ] **Step 8: Commit**

```bash
cd ../magnetrip
git add lib/core/router.dart lib/features/auth/login_screen.dart \
  test/core/router_test.dart test/features/auth/login_screen_test.dart
git commit -m "feat(auth): route /signup and link it from the login screen

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
cd ../magnetrip-web
```

---

## Task 7: End-to-end verification

Nothing here is code. This task exists because the web side has no component-test harness, so the visual result must actually be looked at, on both platforms, at both widths.

**Files:** none modified.

**Interfaces:**
- Consumes: everything from Tasks 1–6.
- Produces: a verification record. Report findings; do not silently fix anything non-trivial — raise it.

- [ ] **Step 1: Full automated verification, both repos**

```bash
pnpm test && pnpm lint && pnpm build
cd ../magnetrip && flutter analyze && flutter test && cd ../magnetrip-web
```

Expected: `pnpm test` and `flutter test` fully green; `pnpm build` succeeds; `pnpm lint` and `flutter analyze` show only their known baselines from Global Constraints and nothing new. Paste the actual summary lines into the report — do not claim success without them.

- [ ] **Step 2: Confirm the token generator stayed deterministic**

```bash
pnpm tokens
git status --porcelain
(cd ../magnetrip && git status --porcelain)
```

Expected: both are empty. A dirty tree here means the generator is not idempotent, which is a bug.

- [ ] **Step 3: Inspect the web result at both widths**

Run `pnpm dev`, then visit each of `/login`, `/signup`, `/forgot-password`, `/reset-password` at 1440px and at 375px. For each, confirm:

- The panel is 45% (left on desktop, top on mobile) with the teal gradient running light-to-dark.
- The medallion shows the logo, circular, with a visible white ring — not a square, not a blue box.
- The wordmark and tagline are legible against the gradient.
- The form is vertically centred in the white column and capped around 384px.
- No horizontal scrollbar at 375px.

Screenshot each. `/reset-password` renders its "Link expired" state without a token — that is correct, not a bug.

- [ ] **Step 4: Verify contrast against the spec's numbers**

Use the browser devtools colour picker (or any contrast checker) on the rendered wordmark and tagline. Expected: wordmark ≈6.15:1, tagline ≈5.3:1, both passing AA. If either measures below 4.5:1, the gradient stop moved — recheck Task 2's gradient string against the Global Constraints.

- [ ] **Step 5: Verify keyboard focus order on web**

On `/login`, press Tab from the top. Expected order: email → password → "Forgot password?" → Sign in → "Create one". Nothing should be reachable inside the brand panel, since it holds no interactive elements.

- [ ] **Step 6: Inspect the Flutter result on a device or simulator**

```bash
cd ../magnetrip && flutter run
```

Confirm:
- Login shows the band across the top ~45%, gradient behind the status bar, with **light** status-bar icons.
- Tapping the email field opens the keyboard and the page scrolls; the band slides away rather than squashing, and the focused field stays visible.
- "No account? Create one" opens signup; "Already have an account? Sign in" comes back.
- Signup with a mismatched confirmation shows "Passwords do not match" without a network call.
- "Forgot password?" opens a screen with **no** app bar and a working "Back to sign in".
- Rotate to landscape on login: the band is taller than 45% (the 240dp floor) and nothing overflows — no yellow-and-black overflow stripes.

- [ ] **Step 7: Report**

Summarise: commands run and their real output, screenshots taken, measured contrast values, and anything that looked wrong. Explicitly note that no web component tests exist and the web result rests on the manual pass in Steps 3–5.

---

## Notes for the executor

- **The two repos commit separately.** Task 1 touches both. Always confirm `git branch --show-current` reports `feat/auth-split-layout` before committing, in whichever repo you are in.
- **`assets/logo.png` has an opaque light-blue background.** That is why the medallion is a circle crop with a white ring rather than a free-standing mark. If someone later supplies a transparent PNG or SVG, the ring can go and the mark can sit directly on the gradient — a change confined to `auth-brand-panel.tsx` and `_BrandBand` in `auth_scaffold.dart`.
- **Flutter login validation got stricter on purpose.** It previously only checked for empty strings; it now rejects malformed emails, matching web. This is intended, not a regression.
- **Do not add jsdom or Testing Library to the web repo.** Web component tests are explicitly out of scope for this change.
