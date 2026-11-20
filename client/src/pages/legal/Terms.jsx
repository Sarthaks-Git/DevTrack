import { Link } from "react-router-dom";
import LegalPage from "./LegalPage";
import { OPERATOR } from "./operator";

const mail = <a href={`mailto:${OPERATOR.email}`} className="text-[var(--dt-accent-soft)] underline underline-offset-2">{OPERATOR.email}</a>;
const refunds = <Link to="/refunds" className="text-[var(--dt-accent-soft)] underline underline-offset-2">pricing and refunds</Link>;
const privacy = <Link to="/privacy" className="text-[var(--dt-accent-soft)] underline underline-offset-2">privacy policy</Link>;

const sections = [
  {
    id: "agreement",
    title: "Agreement",
    body: (
      <p>
        These terms are an agreement between you and {OPERATOR.name} ("we"), who runs DevTrack. By creating an account or using
        DevTrack you accept them and the {privacy}. If you do not agree, please do not use DevTrack.
      </p>
    ),
  },
  {
    id: "account",
    title: "Your account",
    body: (
      <ul>
        <li>You must be 18 or over and give a real email address you can receive mail at.</li>
        <li>Keep your password private. You are responsible for what happens under your account; tell us at {mail} if you think someone else has access.</li>
        <li>One person per account. Do not create accounts in someone else's name.</li>
      </ul>
    ),
  },
  {
    id: "content",
    title: "Your content",
    body: (
      <p>
        You own what you put into DevTrack: goals, projects, journal entries and the rest. You give us permission to store and
        process it only to provide the service to you, as described in the {privacy}. We do not claim ownership and do not
        publish it.
      </p>
    ),
  },
  {
    id: "use",
    title: "Acceptable use",
    body: (
      <>
        <p>Do not:</p>
        <ul>
          <li>try to access other people's accounts or data, or get around rate limits and other protections;</li>
          <li>attack, overload, scrape or reverse-engineer the service, or use it to send spam;</li>
          <li>connect coding or GitHub accounts that are not yours;</li>
          <li>store content that is illegal or that you have no right to store.</li>
        </ul>
        <p>Found a security problem? Please report it privately to {mail} instead of testing it on real accounts.</p>
      </>
    ),
  },
  {
    id: "services",
    title: "Other services",
    body: (
      <p>
        DevTrack reads data from services such as LeetCode and GitHub. Their availability and data are outside our control, and
        your use of them is governed by their own terms. If they change or stop providing data, related features may stop
        working.
      </p>
    ),
  },
  {
    id: "ai",
    title: "AI suggestions",
    body: (
      <p>
        AI features are optional. Their suggestions, including security and code-review notes, can be wrong or incomplete. Treat
        them as hints, not professional advice, and check anything important yourself.
      </p>
    ),
  },
  {
    id: "plans",
    title: "Plans and payments",
    body: (
      <ul>
        <li>DevTrack has a free plan. Pro is sold as prepaid passes: ₹299 for 30 days or ₹2,999 for 365 days, paid through Razorpay.</li>
        <li>A pass starts as soon as the payment is confirmed and does not renew. Nothing is charged again unless you buy another pass, which adds its days on top.</li>
        <li>Refunds are covered on the {refunds} page: a full refund within 7 days if you used fewer than 10 Pro AI actions, and failed or double charges are always refunded. A refunded pass ends.</li>
        <li>Prices may change for future passes; a pass you already bought keeps its length.</li>
      </ul>
    ),
  },
  {
    id: "availability",
    title: "Availability and changes",
    body: (
      <p>
        DevTrack is provided "as is" and "as available". We work to keep it running and your data safe, but we do not promise it
        will be uninterrupted or error-free. We may change or remove features; if we plan to shut DevTrack down, we will give
        at least 30 days' notice by email so you can save what you need.
      </p>
    ),
  },
  {
    id: "ending",
    title: "Ending your account",
    body: (
      <p>
        You can delete your account at any time in Settings, which permanently deletes your data. We may suspend or close an
        account that breaks these terms or puts the service or other users at risk, and will tell you why unless the law or
        safety prevents it.
      </p>
    ),
  },
  {
    id: "liability",
    title: "Liability",
    body: (
      <p>
        To the extent the law allows, we are not liable for indirect or consequential losses, or for loss of data, arising from
        your use of DevTrack. Nothing in these terms limits rights you have under Indian consumer law that cannot be excluded.
      </p>
    ),
  },
  {
    id: "law",
    title: "Law and contact",
    body: (
      <p>
        These terms are governed by the laws of India. If we change them, we will update the date at the top and, for important
        changes, tell you before they apply. Questions: {mail}.
      </p>
    ),
  },
];

export default function Terms() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of service"
      intro="The rules for using DevTrack, in plain language: what you can expect from us, what we expect from you, and what happens if things go wrong."
      sections={sections}
      otherPage={{ to: "/privacy", label: "Privacy policy" }}
    />
  );
}
