# Pomebrain launch checklist

## Automated release gate

- `npm run check` passes lint, TypeScript, and unit/integration tests.
- `npm run build` produces the production Next.js application.
- `npm run test:e2e` passes the anonymous security-boundary browser suite.
- `npm audit --audit-level=high` reports no high or critical dependency issues.
- `npm run check:production` confirms both liveness and deployment readiness.

## Required production configuration

- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_CONNECTOR_CLIENT_ID` and `GOOGLE_CONNECTOR_CLIENT_SECRET`
- `GOOGLE_CONNECTOR_REDIRECT_URI`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- Optional fixed Stripe price IDs for Builder, Pro, and Studio

## Manual launch certification

Use a dedicated customer test workspace—not platform-wide credentials—to:

1. Sign up and confirm workspace provisioning.
2. Connect one model provider, GitHub, Vercel, and Supabase.
3. Run Production Preflight and confirm all required providers are verified.
4. Submit a small application goal and approve its build plan.
5. Confirm generated files are committed to the governed GitHub branch.
6. Open the Vercel preview and review the application.
7. Approve production promotion and confirm the recorded production URL.
8. Start a Stripe Checkout session, complete a test subscription, and confirm entitlement synchronization.
9. Cancel through the billing portal and confirm webhook-driven status changes.
