import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Notice } from "./SettingsSection";
import { createOrder, formatMoney, getBilling, loadCheckout, verifyPayment } from "../../services/billingService";
import useRestoredPage from "../common/useRestoredPage";

const STATUS_TEXT = { paid: "Paid", refunded: "Refunded" };

// UPI first: most people here pay with a UPI app. Cards, netbanking and wallets stay available below.
const CHECKOUT_DISPLAY = {
  blocks: { upi: { name: "Pay with UPI", instruments: [{ method: "upi" }] } },
  sequence: ["block.upi"],
  preferences: { show_default_blocks: true },
};

function ProPasses({ onPlanChanged }) {
  const [billing, setBilling] = useState(null);
  // "opening" while the order is created and Razorpay loads; "confirming" while the server checks a payment.
  const [busy, setBusy] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [notice, setNotice] = useState({ kind: "", text: "" });

  useEffect(() => {
    let active = true;
    getBilling()
      .then(data => active && setBilling(data))
      .catch(() => active && setBilling(null));
    return () => {
      active = false;
    };
  }, []);

  // Back from a bank or UPI page: nothing is pending any more, and the webhook may already have
  // turned Pro on, so read the plan again.
  useRestoredPage(() => {
    setBusy("");
    setConfirming(false);
    getBilling()
      .then(data => {
        setBilling(data);
        onPlanChanged?.();
      })
      .catch(() => {});
  });

  async function confirm(response) {
    setConfirming(true);
    try {
      const data = await verifyPayment({
        orderId: response.razorpay_order_id,
        paymentId: response.razorpay_payment_id,
        signature: response.razorpay_signature,
      });
      setBilling(data);
      setNotice({ kind: "ok", text: `Payment received. Pro is active until ${new Date(data.plan.until).toLocaleDateString()}.` });
      onPlanChanged?.();
    } catch (error) {
      // Razorpay also tells the server directly, so a paid order still turns Pro on.
      setNotice({ kind: "error", text: `${error.message} If money left your account, Pro turns on automatically within a few minutes once Razorpay confirms it.` });
    } finally {
      setConfirming(false);
    }
  }

  async function buy(pass) {
    setBusy(pass.id);
    setNotice({ kind: "", text: "" });
    try {
      const [order, Razorpay] = await Promise.all([createOrder(pass.id), loadCheckout()]);
      const checkout = new Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "DevTrack",
        description: `Pro, ${order.label}`,
        config: { display: CHECKOUT_DISPLAY },
        handler: confirm,
      });
      checkout.on("payment.failed", event => {
        setNotice({ kind: "error", text: event?.error?.description || "The payment did not go through. You were not charged." });
      });
      checkout.open();
    } catch (error) {
      setNotice({ kind: "error", text: error.message });
    } finally {
      // Razorpay's window covers the page from here on, so the buttons need no lock while it is open.
      setBusy("");
    }
  }

  if (!billing?.available) return null;
  const { plan, passes, payments, canBuy, mode, refundWindowDays } = billing;

  return (
    <div className="mt-6 border-t border-[var(--dt-border)] pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-[var(--dt-text-primary)]">Get Pro</p>
        {mode === "test" ? <span className="dt-badge">Test mode, no real money</span> : null}
      </div>
      <p className="mt-1 text-xs leading-5 text-[var(--dt-text-secondary)]">
        {plan.tier === "pro" && plan.until
          ? `Pro until ${new Date(plan.until).toLocaleDateString()}. A new pass adds its days on top.`
          : "Prepaid passes: pay once, no auto-renewal and nothing to cancel. Pay with UPI, card or netbanking."}
      </p>

      {canBuy ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {passes.map(pass => (
            <button
              key={pass.id}
              type="button"
              onClick={() => buy(pass)}
              disabled={Boolean(busy) || confirming}
              className="border border-[var(--dt-border)] p-4 text-left hover:border-[var(--dt-accent)] disabled:opacity-50"
            >
              <span className="block text-[11px] uppercase tracking-[0.18em] text-[var(--dt-text-muted)]">{pass.label}</span>
              <span className="mt-1 block text-lg text-[var(--dt-text-primary)]">{formatMoney(pass.amount, pass.currency)}</span>
              <span className="mt-1 block text-xs text-[var(--dt-text-secondary)]">
                {busy === pass.id ? "Opening payment..." : `${pass.days} days of Pro`}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-xs text-[var(--dt-text-muted)]">Your Pro plan has no end date, so there is nothing to buy.</p>
      )}

      <p className="mt-3 text-xs leading-5 text-[var(--dt-text-muted)]">
        Full refund within {refundWindowDays} days if you used fewer than 10 Pro AI actions. See{" "}
        <Link to="/refunds" className="text-[var(--dt-accent-soft)] underline underline-offset-2">pricing and refunds</Link>.
      </p>

      {payments.length ? (
        <ul className="mt-4 space-y-1 text-xs text-[var(--dt-text-secondary)]" aria-label="Payment history">
          {payments.map(payment => (
            <li key={payment.id} className="flex flex-wrap justify-between gap-2">
              <span>{payment.label} · {formatMoney(payment.amount, payment.currency)}</span>
              <span className="text-[var(--dt-text-muted)]">
                {STATUS_TEXT[payment.status] || payment.status}
                {payment.paidAt ? `, ${new Date(payment.refundedAt || payment.paidAt).toLocaleDateString()}` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {confirming ? <p role="status" className="mt-4 text-xs text-[var(--dt-text-secondary)]">Confirming your payment...</p> : null}
      <Notice kind={notice.kind}>{notice.text}</Notice>
    </div>
  );
}

export default ProPasses;
