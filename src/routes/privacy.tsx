import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — Mental Health Walk Club" },
      { name: "description", content: "How Mental Health Walk Club collects, uses, and protects your information." },
    ],
  }),
});

function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-10 prose prose-neutral">
      <p className="text-xs text-muted-foreground">Last updated: May 15, 2026</p>
      <h1 className="font-serif text-4xl">Privacy Policy</h1>
      <p>
        Mental Health Walk Club ("we", "us", "the app") is a wellness and community walking app. This policy explains
        what we collect, why, and what choices you have. We try to keep this in plain English.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>We collect what we need to run your walks, your account, and our community features — nothing more.</li>
        <li>We never sell your personal information.</li>
        <li>You can export or delete your account from your Profile at any time.</li>
        <li>We are not a medical service. Please read the disclaimer at the bottom.</li>
      </ul>

      <h2>What we collect</h2>
      <ul>
        <li><strong>Account info</strong> — your email, display name, optional avatar, and (if you provide it) your city.</li>
        <li><strong>Walk data</strong> — start/end time, duration, walk type, mood check-ins you choose to log, journal entries you write, and any badges you earn.</li>
        <li><strong>Location</strong> — only while a walk is active and only with your permission, used to estimate distance and (if you opt in) show your live route to your group.</li>
        <li><strong>Health data</strong> — on iOS, with your permission, we read your step count from Apple Health while you walk so we can show steps in real time.</li>
        <li><strong>Audio</strong> — Walk &amp; Talk live audio rooms transmit your microphone to other listeners during the room. We do not record rooms.</li>
        <li><strong>Push tokens</strong> — if you enable notifications, we store an anonymous device token to deliver them.</li>
        <li><strong>Payment status</strong> — for Walk Club Plus, we store your subscription status (active, trialing, canceled). Card details are handled by our payment processors and never reach our servers.</li>
        <li><strong>Diagnostic info</strong> — basic crash and error logs to keep the app working.</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        To operate the app: run your walks, save your journal, deliver the community features, send notifications you've
        opted into, process payments, and keep things secure. We don't use your data to advertise to you on third-party
        platforms, and we don't sell it.
      </p>

      <h2>Third parties we use</h2>
      <ul>
        <li><strong>Authentication &amp; database</strong> — to sign you in and store your data securely.</li>
        <li><strong>Stripe and the Apple App Store / Google Play</strong> — for subscription billing.</li>
        <li><strong>OneSignal</strong> — for push notifications, when enabled.</li>
        <li><strong>Apple HealthKit</strong> — read-only, with your explicit consent on iOS.</li>
        <li><strong>Mapping providers</strong> — to show maps and convert places to coordinates.</li>
      </ul>
      <p>Each of these has its own privacy policy. They process data on our behalf to deliver the service.</p>

      <h2>Your rights and choices</h2>
      <ul>
        <li><strong>Access &amp; export</strong> — email us and we'll send you a copy of your data.</li>
        <li><strong>Delete</strong> — open Profile → Settings &amp; safety → Delete my account. This permanently removes your account and all associated walks, journal entries, RSVPs, and memberships.</li>
        <li><strong>Permissions</strong> — you can revoke Location, Microphone, Health, and Notification access at any time in your device settings.</li>
        <li><strong>Notifications</strong> — opt in and out per category in your Profile.</li>
      </ul>

      <h2>Children</h2>
      <p>
        The app is intended for users 16 and older. If you believe a child has created an account, contact us and we will
        remove it.
      </p>

      <h2>Security</h2>
      <p>
        We use encryption in transit and at rest, role-based access controls, and row-level security on our database. No
        system is perfect; please use a strong, unique password.
      </p>

      <h2>International transfers</h2>
      <p>
        Our servers are located in the United States. By using the app you consent to your information being processed
        there.
      </p>

      <h2>Changes to this policy</h2>
      <p>
        If we make material changes we'll notify you in the app or by email. The "Last updated" date at the top reflects
        the current version.
      </p>

      <h2>Important: Not medical advice</h2>
      <p className="rounded-2xl border border-clay/40 bg-clay/10 p-4">
        <strong>Mental Health Walk Club is not a medical service.</strong> Nothing in the app — including content from
        facilitators, other walkers, podcasts, music, or audio rooms — is medical advice or a substitute for professional
        diagnosis or treatment. The platform, its operators, and contributors assume no liability for any decisions,
        injuries, harm, or outcomes related to your use of the app, including walks, audio rooms, in-person events, or
        community interactions. If you are in crisis, contact your local emergency services or a crisis line (in the US,
        call or text 988).
      </p>

      <h2>Contact</h2>
      <p>
        Questions about your privacy? Email <a href="mailto:hello@mentalhealthwalkclub.com">hello@mentalhealthwalkclub.com</a>.
      </p>

      <p className="mt-8 text-sm">
        See also: <Link to="/terms" className="underline">Terms of Service</Link>.
      </p>
    </article>
  );
}
