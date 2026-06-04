import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service — Mental Health Walk Club" },
      { name: "description", content: "The terms that govern your use of Mental Health Walk Club." },
    ],
  }),
});

function TermsPage() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-10 prose prose-neutral">
      <p className="text-xs text-muted-foreground">Last updated: May 15, 2026</p>
      <h1 className="font-serif text-4xl">Terms of Service</h1>
      <p>
        Welcome to Mental Health Walk Club ("the app", "we", "us"). By creating an account or using the app you agree to
        these terms. Please read them carefully — there are important disclaimers and a limitation of liability below.
      </p>

      <h2>1. Eligibility</h2>
      <p>You must be at least 16 years old to use the app and capable of forming a binding contract.</p>

      <h2>2. Your account</h2>
      <p>
        You are responsible for keeping your login credentials secure and for all activity under your account. Provide
        accurate information; we may suspend or terminate accounts that violate these terms or harm the community.
      </p>

      <h2>3. Acceptable use</h2>
      <p>You agree NOT to:</p>
      <ul>
        <li>Harass, threaten, dox, or abuse other walkers, in audio rooms or in person.</li>
        <li>Share illegal, hateful, sexually explicit, or harmful content.</li>
        <li>Impersonate others, scrape the service, or attempt to access data that isn't yours.</li>
        <li>Use the app to give medical, legal, or financial advice as if you were a licensed professional.</li>
      </ul>
      <p>We may remove content, end audio rooms, or terminate accounts that violate these rules, with or without notice.</p>

      <h2>4. Walk &amp; Talk and Local Walks</h2>
      <p>
        Walk &amp; Talk audio rooms and Local Walks involve interaction with other people. Other users are responsible for
        their own conduct. Use the in-app Report and Block tools if anyone makes you uncomfortable. For in-person Local
        Walks, meet in public places and use your judgment.
      </p>

      <h2>5. Subscriptions (Walk Club Plus)</h2>
      <ul>
        <li>Plus is offered at $1.99/month, with a 30-day free trial for new subscribers. 50% of net Plus revenue is donated to our nonprofit partner each month.</li>
        <li>Trials and subscriptions auto-renew until you cancel.</li>
        <li>You can cancel anytime from your Profile (web) or in the App Store / Google Play settings (mobile).</li>
        <li>Refunds are handled by the platform that processed your payment (Stripe, Apple, or Google) under their refund policies.</li>
      </ul>

      <h2>6. Content you create</h2>
      <p>
        You keep ownership of your journal entries, photos, and walks. By posting publicly (e.g. a public group walk) you
        grant us a non-exclusive license to display that content within the app.
      </p>

      <h2>7. Termination</h2>
      <p>
        You can delete your account at any time from Profile → Settings &amp; safety. Deletion is permanent and removes your
        walks, journal, memberships, and other data. We may also terminate accounts that violate these terms.
      </p>

      <h2>8. NOT MEDICAL ADVICE — IMPORTANT</h2>
      <p className="rounded-2xl border border-clay/40 bg-clay/10 p-4">
        <strong>The app is a wellness and community tool, not a medical service.</strong> Nothing in the app constitutes
        medical, psychological, or psychiatric advice, diagnosis, or treatment. Always consult a qualified professional
        about your health. If you are in crisis, contact emergency services or a crisis line (in the US, call or text 988).
      </p>

      <h2>9. ASSUMPTION OF RISK</h2>
      <p className="rounded-2xl border border-border bg-muted/40 p-4">
        Walking, exercising, meeting other users in person, and participating in live audio rooms carry inherent risks
        including physical injury, emotional distress, theft, harassment, and exposure to weather or unsafe environments.
        <strong> You participate at your own risk.</strong> The platform, its operators, employees, contributors, and
        affiliated parties assume no liability for any injury, loss, harm, or damage — physical, emotional, financial, or
        otherwise — arising from your use of the app or interactions with other users, whether online or in person.
      </p>

      <h2>10. DISCLAIMER OF WARRANTIES</h2>
      <p>
        THE APP IS PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
        IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR THAT THE APP WILL BE
        ERROR-FREE, SECURE, OR UNINTERRUPTED.
      </p>

      <h2>11. LIMITATION OF LIABILITY</h2>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, IN NO EVENT WILL THE PLATFORM, ITS OPERATORS, OR AFFILIATES BE LIABLE
        FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF PROFITS, DATA, USE,
        GOODWILL, OR OTHER INTANGIBLE LOSSES. OUR TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING OUT OF OR RELATING TO THE
        APP IS LIMITED TO THE GREATER OF (a) THE AMOUNT YOU PAID US IN THE PRIOR TWELVE MONTHS OR (b) US$50.
      </p>

      <h2>12. Indemnification</h2>
      <p>
        You agree to indemnify and hold the platform harmless from claims arising out of your conduct, your content, or
        your violation of these terms, including in interactions with other users.
      </p>

      <h2>13. Governing law and disputes</h2>
      <p>
        These terms are governed by the laws of the United States and the State of California, without regard to conflict
        of laws. Disputes will be resolved in the state or federal courts located in California, unless required otherwise
        by law.
      </p>

      <h2>14. Changes</h2>
      <p>
        We may update these terms. We'll notify you of material changes in the app or by email. Continued use after the
        change means you accept the new terms.
      </p>

      <h2>15. Contact</h2>
      <p>
        Questions? Email <a href="mailto:hello@mentalhealthwalkclub.com">hello@mentalhealthwalkclub.com</a>.
      </p>

      <p className="mt-8 text-sm">
        See also: <Link to="/privacy" className="underline">Privacy Policy</Link>.
      </p>
    </article>
  );
}
