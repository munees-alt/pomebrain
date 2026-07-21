import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Pomebrain",
  description: "How Pomebrain collects, uses, and protects your data.",
};

const EFFECTIVE_DATE = "July 13, 2026";
const CONTACT_EMAIL = "medium@finanshels.com";

export default function PrivacyPolicyPage() {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <header className="legal-header">
          <span className="legal-eyebrow">POMEBRAIN</span>
          <h1>Privacy Policy</h1>
          <p className="legal-meta">Effective {EFFECTIVE_DATE}</p>
        </header>

        <section>
          <h2>1. Overview</h2>
          <p>
            Pomebrain (&quot;we&quot;, &quot;us&quot;) provides a workspace for building and running
            applications with AI agents. This policy explains what data we collect when you use
            Pomebrain, how we use it, and the choices you have.
          </p>
        </section>

        <section>
          <h2>2. Information we collect</h2>
          <p>We collect the minimum information needed to operate your workspace:</p>
          <ul>
            <li>
              <strong>Account information</strong> — email address, and, if you sign in with
              Google, the basic profile information (name, email, avatar) Google shares with us.
            </li>
            <li>
              <strong>Workspace content</strong> — projects, agent outputs, connectors, and data you
              create or upload inside Pomebrain.
            </li>
            <li>
              <strong>Usage data</strong> — agent-action counts and basic technical logs used for
              billing, security, and debugging.
            </li>
          </ul>
        </section>

        <section>
          <h2>3. How we use your information</h2>
          <ul>
            <li>To authenticate you and keep your workspace secure and isolated from others.</li>
            <li>To operate the features you use, such as running agents and connectors.</li>
            <li>To diagnose problems and improve reliability.</li>
          </ul>
          <p>We do not sell your personal information.</p>
        </section>

        <section>
          <h2>4. Google account access</h2>
          <p>
            If you sign in with Google, we only request the minimum OAuth scopes needed to verify
            your identity (name, email address, profile photo). We do not access your Gmail,
            Drive, Calendar, or other Google data unless a specific feature explicitly asks for
            that permission and you separately consent to it.
          </p>
        </section>

        <section>
          <h2>5. Third-party service providers</h2>
          <p>We rely on infrastructure providers to run Pomebrain, including:</p>
          <ul>
            <li>Supabase — authentication, encrypted credential storage, and workspace data.</li>
            <li>Vercel — Pomebrain application hosting.</li>
            <li>Stripe — subscription checkout, invoices, and billing management.</li>
            <li>Google, OpenAI, and Anthropic — sign-in and customer-authorized model services, where applicable.</li>
          </ul>
          <p>
            These providers process data only as needed to deliver the service and are bound by
            their own privacy and security commitments.
          </p>
        </section>

        <section>
          <h2>6. Customer credentials</h2>
          <p>
            Model and connector credentials you save are encrypted at rest and are not returned
            to the browser after saving. Pomebrain decrypts a credential server-side only when
            your workspace requests an authorized action, then transmits it to the provider you
            selected. Customer work does not use another customer&apos;s or the master admin&apos;s key.
          </p>
        </section>

        <section>
          <h2>7. Data retention</h2>
          <p>
            We retain your account and workspace data for as long as your account is active. You
            can request deletion of your account and associated data at any time by contacting us.
          </p>
        </section>

        <section>
          <h2>8. Your choices</h2>
          <ul>
            <li>You can access, update, or delete your workspace data from within the app.</li>
            <li>You can revoke Pomebrain&apos;s access to your Google account at any time via your <a href="https://myaccount.google.com/permissions" target="_blank" rel="noreferrer">Google Account permissions page</a>.</li>
            <li>You can request full account deletion by contacting us at the address below.</li>
          </ul>
        </section>

        <section>
          <h2>9. Changes to this policy</h2>
          <p>
            We may update this policy as Pomebrain evolves. Material changes will be reflected by
            updating the effective date above.
          </p>
        </section>

        <section>
          <h2>10. Contact</h2>
          <p>
            Questions about this policy or your data can be sent to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </section>
      </article>
    </main>
  );
}
