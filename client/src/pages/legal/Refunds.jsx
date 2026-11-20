import { Link } from "react-router-dom";
import LegalPage from "./LegalPage";
import { OPERATOR } from "./operator";

const mail = <a href={`mailto:${OPERATOR.email}`} className="text-[var(--dt-accent-soft)] underline underline-offset-2">{OPERATOR.email}</a>;
const terms = <Link to="/terms" className="text-[var(--dt-accent-soft)] underline underline-offset-2">terms of service</Link>;

const sections = [
  {
    id: "prices",
    title: "Prices",
    body: (
      <>
        <ul>
          <li><strong>Free:</strong> ₹0. Goals, projects, coding stats, journal, timeline, and 100 AI actions a month for commit security checks.</li>
          <li><strong>Pro, 1 month:</strong> ₹299 for 30 days.</li>
          <li><strong>Pro, 12 months:</strong> ₹2,999 for 365 days.</li>
        </ul>
        <p>Pro adds a stronger AI model, 300 AI actions a month and code review of changed lines. Prices are in Indian rupees and are the full amount you pay.</p>
      </>
    ),
  },
  {
    id: "delivery",
    title: "Delivery",
    body: (
      <p>
        Pro is a digital service with nothing shipped. It turns on in your account as soon as Razorpay confirms the payment,
        usually within seconds and at most a few minutes. Your end date is shown in Settings → AI and plan.
      </p>
    ),
  },
  {
    id: "renewal",
    title: "No auto-renewal, nothing to cancel",
    body: (
      <p>
        Passes are prepaid. We never save a payment method or charge you again on our own. When a pass ends your account moves
        back to Free and keeps all its data. Buying another pass while one is active adds its days on top.
      </p>
    ),
  },
  {
    id: "refunds",
    title: "Refunds",
    body: (
      <ul>
        <li><strong>Within 7 days of paying</strong>, you get a full refund if you used fewer than 10 Pro AI actions since that payment.</li>
        <li><strong>Failed, duplicate or wrong charges</strong> are always refunded in full, whenever you report them.</li>
        <li>After 7 days, or once 10 or more Pro AI actions were used, a pass is not refundable.</li>
        <li>A refund ends the days that pass added. Refunds go back to the original payment method through Razorpay, usually within 5 to 7 working days.</li>
      </ul>
    ),
  },
  {
    id: "request",
    title: "How to ask",
    body: (
      <p>
        Email {mail} from your account's email address with the date and amount of the payment. We reply within 3 working days.
        These terms are part of the {terms}.
      </p>
    ),
  },
  {
    id: "contact",
    title: "Contact",
    body: (
      <p>
        DevTrack is run by {OPERATOR.name}, {OPERATOR.country}. Email: {mail}.
      </p>
    ),
  },
];

export default function Refunds() {
  return (
    <LegalPage
      eyebrow="Billing"
      title="Pricing and refunds"
      intro="What Pro costs, how it is delivered, and when you can get your money back."
      sections={sections}
      otherPage={{ to: "/terms", label: "Terms of service" }}
    />
  );
}
