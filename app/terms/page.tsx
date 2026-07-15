import Link from "next/link";
import {
  LEGAL_COMPANY_NAME,
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOCUMENT_VERSION,
  LEGAL_PRODUCT_NAME,
  LEGAL_SERVICE_URL
} from "@/lib/legal";

export const metadata = {
  title: `Terms of Service · ${LEGAL_PRODUCT_NAME}`
};

export default function TermsOfServicePage() {
  return (
    <main className="min-h-screen bg-background px-6 py-10">
      <article className="mx-auto max-w-3xl">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Legal
        </p>
        <h1 className="font-display mt-1 text-[2rem] font-semibold tracking-tight text-foreground">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective date: July 15, 2026 · Document version {LEGAL_DOCUMENT_VERSION}
        </p>
        <p className="mt-4 text-sm leading-relaxed text-foreground">
          These Terms of Service (“Terms”) govern your access to and use of {LEGAL_PRODUCT_NAME}{" "}
          (the “Service”) at {LEGAL_SERVICE_URL}, provided by {LEGAL_COMPANY_NAME} (“Company,” “we,”
          “us,” or “our”). By creating an account, accepting an invitation, checking the
          acknowledgment box, or using the Service, you agree to these Terms and our{" "}
          <Link href="/privacy" className="font-semibold text-primary">
            Privacy Policy
          </Link>
          .
        </p>

        <section className="mt-10 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">1. Eligibility</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You must be at least 18 years old and able to form a binding contract. If you use the
            Service on behalf of a company or other entity, you represent that you have authority to
            bind that entity, and “you” includes that entity.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            2. The Service
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {LEGAL_PRODUCT_NAME} is a multi-tenant transportation management platform for freight
            brokerage and related logistics workflows, including loads, customers, carriers,
            documents, dispatch, accounting integrations, and reporting. Features may change over
            time. We may modify, suspend, or discontinue parts of the Service with reasonable notice
            where practicable.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            3. Accounts and workspaces
          </h2>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>
              You are responsible for the accuracy of registration information and for maintaining
              the confidentiality of login credentials and connected OAuth accounts.
            </li>
            <li>
              Workspace owners and administrators control invitations, roles, and access within
              their company. You are responsible for activity occurring under your account and by
              users you authorize.
            </li>
            <li>
              You must promptly revoke access for users who leave your organization and notify us of
              unauthorized use.
            </li>
            <li>
              One natural person should generally use one user account; sharing credentials is not
              permitted.
            </li>
          </ul>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            4. Customer Content
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            “Customer Content” means data, documents, and materials you or your users submit to the
            Service. As between you and us, you retain ownership of Customer Content. You grant us a
            non-exclusive, worldwide, royalty-free license to host, store, process, transmit,
            display, and otherwise use Customer Content solely to provide, maintain, secure, and
            improve the Service and to comply with law.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You represent that you have all rights and consents needed to submit Customer Content
            (including personal information of employees, contacts, and drivers) and that Customer
            Content does not violate law or third-party rights. You are solely responsible for
            backup of Customer Content outside the Service unless we expressly agree otherwise in
            writing.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            5. Acceptable use
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">You agree not to:</p>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-muted-foreground">
            <li>Use the Service for unlawful, fraudulent, or deceptive purposes</li>
            <li>Attempt to access another customer’s workspace or data without authorization</li>
            <li>
              Probe, scan, or test the vulnerability of the Service, or bypass security or rate
              limits, except with our prior written consent
            </li>
            <li>
              Upload malware, or content that is illegal, infringing, or that you lack rights to
              process
            </li>
            <li>
              Reverse engineer, scrape at scale, or resell the Service except as permitted by law or
              a separate written agreement
            </li>
            <li>Interfere with other users’ use of the Service</li>
          </ul>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            6. Fees and billing
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Certain features require paid seats or subscriptions billed through Stripe or another
            payment processor. Fees, taxes, and renewal terms are presented at purchase or in an
            order form. Except where required by law or expressly stated, fees are non-refundable.
            Failure to pay may result in suspension or termination of access.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            7. Third-party services and integrations
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Optional integrations (including Google, Microsoft, Stripe, QuickBooks, mapping and
            carrier data services, and email providers) are subject to those third parties’ terms
            and privacy policies. We are not responsible for third-party services you choose to
            enable. You authorize us to exchange data with those services as needed for the
            integration you enable.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            8. Intellectual property
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            The Service, including software, design, trademarks, and documentation, is owned by{" "}
            {LEGAL_COMPANY_NAME} or its licensors. Except for the limited right to use the Service
            under these Terms, no rights are granted to you. Feedback you provide may be used by us
            without obligation to you.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            9. Confidentiality
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Each party may receive non-public information from the other. The receiving party will
            use reasonable care to protect that information and use it only for purposes of these
            Terms, except for information that is public through no fault of the receiving party,
            independently developed, or rightfully received from a third party without duty of
            confidentiality.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            10. Disclaimers
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground uppercase">
            The Service is provided “as is” and “as available.” To the maximum extent permitted by
            law, we disclaim all warranties, express or implied, including merchantability, fitness
            for a particular purpose, title, and non-infringement. We do not warrant that the Service
            will be uninterrupted, error-free, or free of harmful components, or that Customer
            Content will be preserved without loss.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            11. Limitation of liability
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground uppercase">
            To the maximum extent permitted by law, {LEGAL_COMPANY_NAME} and its officers, directors,
            employees, and agents will not be liable for any indirect, incidental, special,
            consequential, exemplary, or punitive damages, or any loss of profits, revenue, data,
            goodwill, or business interruption, arising out of or related to the Service or these
            Terms, whether based in contract, tort, or any other theory, even if advised of the
            possibility of such damages. Our aggregate liability arising out of or related to the
            Service or these Terms will not exceed the greater of (a) the amounts you paid us for
            the Service in the twelve (12) months before the claim arose, or (b) one hundred U.S.
            dollars (US $100). Some jurisdictions do not allow certain limitations; in those cases,
            our liability is limited to the fullest extent permitted by law.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">12. Indemnity</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You will defend, indemnify, and hold harmless {LEGAL_COMPANY_NAME} and its officers,
            directors, employees, and agents from and against claims, damages, losses, and expenses
            (including reasonable attorneys’ fees) arising out of or related to your Customer
            Content, your use of the Service, your violation of these Terms, or your violation of
            any law or third-party right.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            13. Suspension and termination
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            You may stop using the Service at any time. We may suspend or terminate access if you
            breach these Terms, fail to pay fees, create risk to the Service or other customers, or
            if we discontinue the Service. Upon termination, your right to use the Service ends.
            Provisions that by their nature should survive (including ownership, disclaimers,
            limitations of liability, indemnity, and governing law) will survive.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            14. Governing law and venue
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            These Terms are governed by the laws of the State of Ohio, excluding conflict-of-law
            rules. Exclusive venue for disputes arising out of or relating to these Terms or the
            Service will be the state or federal courts located in Ohio, and you consent to personal
            jurisdiction there, unless applicable law requires otherwise.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            15. Changes to these Terms
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            We may update these Terms from time to time. The effective date and document version
            above will change when we do. Material changes may be communicated through the Service
            or by email. If you do not agree to updated Terms, you must stop using the Service.
            Continued use after the effective date constitutes acceptance where permitted by law.
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">
            16. Miscellaneous
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            These Terms, together with the Privacy Policy and any order form or separate written
            agreement, are the entire agreement between you and us regarding the Service. If a
            provision is unenforceable, the remainder remains in effect. Failure to enforce a
            provision is not a waiver. You may not assign these Terms without our consent; we may
            assign them in connection with a corporate transaction. Notices may be sent to the email
            associated with your account and to{" "}
            <a className="font-semibold text-primary" href={`mailto:${LEGAL_CONTACT_EMAIL}`}>
              {LEGAL_CONTACT_EMAIL}
            </a>
            .
          </p>
        </section>

        <section className="mt-8 grid gap-3">
          <h2 className="font-display text-xl font-semibold text-foreground">17. Contact</h2>
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
          <Link href="/privacy" className="font-semibold text-primary">
            Privacy Policy
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
