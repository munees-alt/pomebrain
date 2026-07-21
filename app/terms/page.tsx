import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Pomebrain",
  description: "The terms that govern your use of Pomebrain.",
};

const EFFECTIVE_DATE = "July 13, 2026";
const CONTACT_EMAIL = "medium@finanshels.com";

export default function TermsOfServicePage() {
  return (
    <main className="legal-page">
      <article className="legal-card">
        <header className="legal-header">
          <span className="legal-eyebrow">POMEBRAIN</span>
          <h1>Terms of Service</h1>
          <p className="legal-meta">Effective {EFFECTIVE_DATE}</p>
        </header>

        <section>
          <h2>1. Acceptance of terms</h2>
          <p>
            By creating an account or otherwise using Pomebrain (&quot;the Service&quot;), you
            agree to these Terms of Service. If you do not agree, do not use the Service.
          </p>
        </section>

        <section>
          <h2>2. The Service</h2>
          <p>
            Pomebrain is a workspace for building and running applications with AI agents. The
            Service is provided on an evolving, &quot;as is&quot; basis, and features may change,
            be added, or be removed at any time.
          </p>
        </section>

        <section>
          <h2>3. Accounts</h2>
          <p>
            You are responsible for maintaining the confidentiality of your account credentials
            and for all activity that occurs under your account. You must provide accurate
            information when creating an account, including when signing in with Google.
          </p>
        </section>

        <section>
          <h2>4. Acceptable use</h2>
          <p>You agree not to use the Service to:</p>
          <ul>
            <li>Violate any applicable law or regulation.</li>
            <li>Upload or generate content that is unlawful, infringing, or malicious.</li>
            <li>Attempt to gain unauthorized access to other workspaces, accounts, or systems.</li>
            <li>Interfere with or disrupt the integrity or performance of the Service.</li>
          </ul>
        </section>

        <section>
          <h2>5. Your content</h2>
          <p>
            You retain ownership of the projects, data, and content you create in your workspace.
            You grant us only the limited rights necessary to host, process, and display that
            content in order to operate the Service for you.
          </p>
        </section>

        <section>
          <h2>6. Third-party services</h2>
          <p>
            The Service integrates with third-party providers (such as Google, Supabase, OpenAI,
            and Anthropic) to deliver authentication, storage, and AI functionality. Your use of
            those integrations is also subject to the applicable third party&apos;s own terms.
          </p>
        </section>

        <section>
          <h2>7. Subscriptions, agent actions, and third-party costs</h2>
          <p>
            New workspaces receive one month of trial access with 200 agent actions. Paid plans
            renew monthly until canceled and include the agent-action allowance shown at checkout.
            One agent action is one protected specialist agent completing one assigned task.
            Unused monthly actions do not roll over unless a plan expressly says otherwise.
          </p>
          <p>
            Pomebrain subscription fees cover access to the platform, protected agents,
            orchestration, governance, and workflow. Model tokens, hosting, databases, email,
            analytics, and other third-party services are charged separately through the accounts
            and API keys you connect. You can cancel through the billing portal; access continues
            through the paid billing period unless suspended for misuse or non-payment.
          </p>
        </section>

        <section>
          <h2>8. Disclaimers</h2>
          <p>
            The Service is provided without warranties of any kind, express or implied, including
            fitness for a particular purpose. AI-generated output may be inaccurate, and you are
            responsible for reviewing it before relying on it.
          </p>
        </section>

        <section>
          <h2>9. Limitation of liability</h2>
          <p>
            To the maximum extent permitted by law, Pomebrain and its operators are not liable
            for any indirect, incidental, or consequential damages arising from your use of the
            Service.
          </p>
        </section>

        <section>
          <h2>10. Termination</h2>
          <p>
            You may stop using the Service and request deletion of your account at any time. We
            may suspend or terminate access to the Service for conduct that violates these terms.
          </p>
        </section>

        <section>
          <h2>11. Changes to these terms</h2>
          <p>
            We may update these terms as the Service evolves. Continued use of the Service after
            an update constitutes acceptance of the revised terms.
          </p>
        </section>

        <section>
          <h2>12. Contact</h2>
          <p>
            Questions about these terms can be sent to{" "}
            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </section>
      </article>
    </main>
  );
}
