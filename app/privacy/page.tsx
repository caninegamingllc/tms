import Link from "next/link";
import {
  LEGAL_COMPANY_NAME,
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOCUMENT_VERSION,
  LEGAL_PRODUCT_NAME,
  LEGAL_SERVICE_URL
} from "@/lib/legal";

export const metadata = {
  title: `Privacy Policy · ${LEGAL_PRODUCT_NAME}`
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <article className="mx-auto max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Legal
        </p>
        <h1 className="font-display mt-1 text-[2rem] font-semibold tracking-tight text-foreground">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective date: July 15, 2026 · Document version {LEGAL_DOCUMENT_VERSION}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-foreground">
          This Privacy Policy describes how {LEGAL_COMPANY_NAME} (“Company,” “we,” “us,” or “our”)
          collects, uses, discloses, and protects information in connection with{" "}
          {LEGAL_PRODUCT_NAME} (the “Service”) available at {LEGAL_SERVICE_URL}. By creating an
          account or using the Service, you acknowledge this Policy.
        </p>

        <section className="mt-10 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">1. Who we are</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The Service is owned and operated by {LEGAL_COMPANY_NAME}, an Ohio corporation.{" "}
            {LEGAL_PRODUCT_NAME} is a business-to-business transportation management system for
            freight brokerages and related logistics operations. For privacy inquiries, contact{" "}
            <a className="font-semibold text-primary" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
              {LEGAL_CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            2. Information we collect
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We collect information in the following categories:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">Account information.</span> Name,
              email address, password (stored as a one-way hash) or OAuth identity from Google or
              Microsoft, organization membership and role, session metadata, and optional UI
              preferences.
            </li>
            <li>
              <span className="font-semibold text-foreground">Customer Content.</span> Business data
              you and your authorized users enter or upload in your company workspace, which may
              include customers, contacts, carriers, drivers (including names and phone numbers),
              facilities and stop details, loads, notes, activity logs, invoices, carrier bills,
              commissions, payment records, and related operational and financial information.
            </li>
            <li>
              <span className="font-semibold text-foreground">Documents and files.</span> Uploaded or
              generated files such as bills of lading, proofs of delivery, rate confirmations,
              invoices, insurance certificates, W-9s, carrier packets, company logos, and similar
              PDFs or images, including file names, size, type, and uploader metadata.
            </li>
            <li>
              <span className="font-semibold text-foreground">Communications.</span> Transactional
              emails we send (for example invite and password-reset messages). If you connect a
              Gmail or Microsoft 365 mailbox, we store encrypted access tokens and mail metadata and
              content needed to sync and send operational email related to your loads and documents.
            </li>
            <li>
              <span className="font-semibold text-foreground">Technical and security data.</span>{" "}
              Approximate IP address used for rate limiting and abuse prevention, session cookies,
              timestamps, and audit log entries of significant account or administrative actions.
            </li>
            <li>
              <span className="font-semibold text-foreground">Billing.</span> When you purchase seats
              or subscriptions, payment card data is processed by Stripe; we receive billing status,
              customer identifiers, and related account information—not full card numbers.
            </li>
          </ul>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            3. How we use information
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>Provide, operate, secure, and improve the Service</li>
            <li>Create and administer company workspaces, users, roles, and seats</li>
            <li>Authenticate users and prevent fraud, abuse, and unauthorized access</li>
            <li>Process billing and account changes</li>
            <li>Send transactional notices related to the Service</li>
            <li>
              Enable optional integrations you connect (for example QuickBooks, Google Maps APIs,
              carrier compliance lookups, and mailbox sync)
            </li>
            <li>Comply with law and enforce our Terms of Service</li>
          </ul>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            4. How we share information
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We do not sell personal information. We disclose information only as needed to operate
            the Service or as required by law, including to:
          </p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              <span className="font-semibold text-foreground">Service providers / processors</span>{" "}
              such as hosting and database providers, object storage (for example S3-compatible
              storage), Redis (optional rate limiting/caching), Resend or SMTP for email, Stripe for
              payments, Intuit QuickBooks Online, Google and Microsoft identity and mail services,
              Google Maps / Places / Routes APIs, and FMCSA-related carrier lookup services.
            </li>
            <li>
              <span className="font-semibold text-foreground">Your organization.</span> Workspace
              administrators and authorized users within your company can access Customer Content
              according to roles and permissions you configure.
            </li>
            <li>
              <span className="font-semibold text-foreground">Legal and safety.</span> When we believe
              disclosure is reasonably necessary to comply with law, respond to lawful requests,
              protect rights and safety, or investigate abuse.
            </li>
            <li>
              <span className="font-semibold text-foreground">Business transfers.</span> In connection
              with a merger, acquisition, financing, or sale of assets, subject to appropriate
              confidentiality protections.
            </li>
          </ul>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            5. Cookies and similar technologies
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We use first-party cookies that are necessary for the Service to function, including
            session authentication, OAuth security/state cookies, and limited preference cookies
            (for example branch filter). We do not currently use advertising or third-party analytics
            cookies on the Service. You can control cookies through your browser; disabling necessary
            cookies may prevent sign-in or key features from working.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            6. Multi-tenant Customer Content
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Customer Content is associated with your company workspace and is intended to remain
            isolated from other customers’ workspaces. You are responsible for the legality of data
            you upload, for obtaining any required consents from your employees, customers, carriers,
            and drivers, and for configuring user access within your organization.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            7. Retention
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We retain account information and Customer Content for as long as your workspace remains
            active and as needed to provide the Service, meet legal obligations, resolve disputes,
            and enforce agreements. Password-reset tokens expire after a short period (typically one
            hour). You may request deletion of your account or workspace content by contacting us; we
            may retain limited records where required by law or legitimate business needs (for
            example billing and audit trails).
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">8. Security</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We use administrative, technical, and organizational measures designed to protect
            information, including hashed passwords, HTTP-only session cookies, encrypted tokens for
            certain integrations, access controls, and rate limiting. No method of transmission or
            storage is completely secure; you use the Service at your own risk subject to our Terms.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            9. International transfers
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We and our processors may process information in the United States and other countries.
            Where information is transferred internationally, we take steps designed to ensure an
            appropriate level of protection consistent with applicable law.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            10. Your choices and rights
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Depending on applicable law (including Ohio and other U.S. state privacy laws that may
            apply), you may have rights to access, correct, delete, or obtain a copy of certain
            personal information, or to appeal a denial of a privacy request. To exercise these
            rights, email{" "}
            <a className="font-semibold text-primary" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
              {LEGAL_CONTACT_EMAIL}
            </a>
            . We may need to verify your identity and, where applicable, confirm you are authorized
            to act for your organization. Some requests relating to Customer Content may need to be
            handled by your company administrator.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            11. Children’s privacy
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The Service is directed to businesses and is not intended for individuals under 18. We
            do not knowingly collect personal information from children.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            12. Changes to this Policy
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We may update this Privacy Policy from time to time. The effective date and document
            version above will change when we do. Material changes may be communicated through the
            Service or by email. Continued use after the effective date constitutes acceptance of the
            updated Policy where permitted by law.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">13. Contact</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {LEGAL_COMPANY_NAME}
            <br />
            Ohio, United States
            <br />
            Email:{" "}
            <a className="font-semibold text-primary" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
              {LEGAL_CONTACT_EMAIL}
            </a>
          </p>
        </section>

        <p className="mt-10 text-sm text-muted-foreground">
          See also our{" "}
          <Link href="/terms" className="font-semibold text-primary">
            Terms of Service
          </Link>
          .
        </p>
        <p className="mt-6">
          <Link href="/login" className="text-sm font-semibold text-primary">
            Back to sign in
          </Link>
        </p>
      </article>
    </main>
  );
}
