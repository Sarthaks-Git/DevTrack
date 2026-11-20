import LegalPage from "./LegalPage";
import { OPERATOR } from "./operator";

const mail = <a href={`mailto:${OPERATOR.email}`} className="text-[var(--dt-accent-soft)] underline underline-offset-2">{OPERATOR.email}</a>;

const sections = [
  {
    id: "who",
    title: "Who we are",
    body: (
      <p>
        DevTrack is run by {OPERATOR.name}, an individual based in {OPERATOR.country}, who decides how your data is used
        (the "data fiduciary" under India's Digital Personal Data Protection Act, 2023). Questions, requests and complaints: {mail}.
      </p>
    ),
  },
  {
    id: "collect",
    title: "What we collect",
    body: (
      <>
        <ul>
          <li><strong>Account:</strong> your email address, username, display name and a bcrypt hash of your password (never the password itself).</li>
          <li><strong>Sign-in with Google, GitHub or LinkedIn:</strong> the provider's account id, your email address and name.</li>
          <li><strong>Security records:</strong> active sessions with a device label such as "Chrome on Windows" and the time of use, hashed tokens for browsers you have signed in from, and two-factor settings (the secret is encrypted).</li>
          <li><strong>What you write:</strong> goals, milestones, projects, journal entries, reminder settings and notifications.</li>
          <li><strong>Coding platforms you connect:</strong> your LeetCode username and the public statistics and accepted submissions LeetCode shows for it.</li>
          <li><strong>Payments, if you buy Pro:</strong> which pass you bought, the amount, its status and dates, and Razorpay's order and payment ids. Your card, UPI or bank details go straight to Razorpay; DevTrack never sees them.</li>
          <li><strong>GitHub, if you connect it:</strong> for the repositories you choose, commit messages, dates, authors and the names of changed files. We do not store your source code.</li>
          <li><strong>Phone and browser notifications, if you turn them on:</strong> the browser's push address and keys, and a device label such as "Chrome on Android". Signing out on that device removes them.</li>
        </ul>
        <p>
          We do not use advertising or analytics trackers, and we do not store your IP address with your account. Rate limits
          keep a one-way hash of it for up to an hour to stop abuse.
        </p>
      </>
    ),
  },
  {
    id: "use",
    title: "How we use it",
    body: (
      <ul>
        <li>To run your account: sign-in, your dashboard, progress from verified sources, reminders and the weekly review.</li>
        <li>To keep it safe: email verification, alerts about new sign-ins and email changes, rate limits, and checking new passwords against known breaches.</li>
        <li>To send account email: verification codes, password resets, security alerts and, unless you turn it off in Settings → Reminders, a morning summary of new reminders. We do not send marketing email.</li>
      </ul>
    ),
  },
  {
    id: "ai",
    title: "AI features",
    body: (
      <p>
        AI features are off until you turn them on in Settings. When they are on, commit messages and changed file names (and,
        for code review on a repository you switch it on for, the changed lines, with anything that looks like a secret removed)
        are sent to Anthropic to generate suggestions. When you ask for a plan, a quiz or project ideas for a goal, that goal's
        title, description, deadline and milestones are sent too; for a written weekly review, that week's numbers and the titles
        of what you finished or let slip. Anthropic does not use this data to train its models. Suggestions are
        labelled as AI and never count as verified progress. Turning AI off stops all sending.
      </p>
    ),
  },
  {
    id: "share",
    title: "Who we share it with",
    body: (
      <>
        <p>We never sell your data. These services process it for us, only to run DevTrack:</p>
        <ul>
          <li><strong>Vercel</strong> serves the website; <strong>Render</strong> runs the server (Singapore).</li>
          <li><strong>MongoDB Atlas</strong> stores the database (Singapore).</li>
          <li><strong>Brevo</strong> sends account email.</li>
          <li><strong>Google, Mozilla, Apple or Microsoft</strong> deliver phone and browser notifications if you turn them on, through your browser's own push service. The notification is encrypted and says only how many reminders are new.</li>
          <li><strong>Have I Been Pwned</strong> checks new passwords against breaches. Only the first 5 characters of a hash of the password are sent, never the password.</li>
          <li><strong>Google, GitHub and LinkedIn</strong> when you sign in with them or connect GitHub; <strong>LeetCode</strong> when we fetch your public statistics.</li>
          <li><strong>Anthropic</strong>, only when you turn on AI features.</li>
          <li><strong>Razorpay</strong> processes payments when you buy Pro. It receives an order with the amount and an internal reference, never your DevTrack account details; it collects whatever it needs for the payment itself.</li>
        </ul>
        <p>Some of these store data outside India. We may also disclose data when the law requires it.</p>
      </>
    ),
  },
  {
    id: "cookies",
    title: "Cookies",
    body: (
      <>
        <p>DevTrack only uses cookies needed for it to work:</p>
        <ul>
          <li><strong>Sign-in cookies</strong> keep you signed in (a short-lived access cookie and a refresh cookie that lasts up to 60 days).</li>
          <li><strong>A security cookie</strong> protects forms against cross-site request forgery.</li>
          <li><strong>A device cookie</strong> (random, up to 400 days) lets us notice sign-ins from a new browser and alert you.</li>
          <li><strong>Short-lived cookies</strong> during two-factor sign-in and the Google, GitHub or LinkedIn redirect.</li>
        </ul>
        <p>Your light or dark theme choice is saved in your browser only.</p>
      </>
    ),
  },
  {
    id: "keep",
    title: "How long we keep it",
    body: (
      <ul>
        <li>Your account data stays until you delete it.</li>
        <li>Verification codes, reset codes and sign-in handshakes expire within minutes to days and are then deleted automatically.</li>
        <li>Deleting your account (Settings → Delete account) permanently removes your account and everything linked to it, including payment records, and revokes DevTrack's access to GitHub. Razorpay keeps its own record of any payment, as payment law requires.</li>
        <li>An encrypted backup of the database is made every week and each one is kept for 90 days, so deleted data is gone from every backup within 90 days.</li>
      </ul>
    ),
  },
  {
    id: "rights",
    title: "Your rights",
    body: (
      <>
        <p>You can:</p>
        <ul>
          <li>see and correct your data in the app, and change your email or password in Settings;</li>
          <li>disconnect GitHub or coding platforms, sign out other devices, and turn AI off at any time;</li>
          <li>delete your account and all its data yourself, in Settings;</li>
          <li>ask us for a summary of the data we hold about you, or raise a complaint, by writing to {mail}.</li>
        </ul>
        <p>
          We reply within 30 days. If you are not satisfied, you can complain to the Data Protection Board of India.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Security",
    body: (
      <p>
        Passwords are hashed with bcrypt; third-party tokens and two-factor secrets are encrypted; all traffic uses HTTPS; sign-in
        is rate limited; and you can add two-factor authentication. No system is perfectly secure. If a breach affects your data,
        we will tell you and the Data Protection Board as the law requires.
      </p>
    ),
  },
  {
    id: "age",
    title: "Age",
    body: <p>DevTrack is for people aged 18 or over. If you are younger, please do not create an account.</p>,
  },
  {
    id: "changes",
    title: "Changes",
    body: (
      <p>
        If we change this policy, we will update the date at the top, and for important changes we will tell you by email or in
        the app before they apply.
      </p>
    ),
  },
];

export default function Privacy() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy policy"
      intro="This explains what DevTrack collects, why, who else handles it, and how you can see, change or delete it. In short: we keep only what the product needs, we never sell it, and you can delete everything yourself at any time."
      sections={sections}
      otherPage={{ to: "/terms", label: "Terms of service" }}
    />
  );
}
