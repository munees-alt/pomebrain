---
name: playwright-e2e-form-scripting
description: Build Playwright end-to-end scripts for form submissions, validation banners, redirects, and route success states. Use before preview or production promotion when user-visible form workflows need browser verification.
---

# Playwright E2E Form Scripting

Purpose: Build localized user-flow scripts for UI form submissions, error states, and landing route redirects.

## Inputs

- `target_url`: string
- `form_selectors_and_inputs`: object mapping fields to selectors and mock values

## Outputs

- `playwright_test_javascript`: executable browser testing script

## Procedure

1. Visit the target route.
2. Prefer user-visible labels or strict `data-testid` selectors.
3. Fill specified mock details.
4. Submit the form.
5. Assert expected success URL, visible status, or validation banner.
6. Add explicit timeout parameters on all awaited checkpoints.

## Evaluation

- Script must avoid infinite hangs.
- Script must use reliable selectors.
- Script must assert both action and outcome.

