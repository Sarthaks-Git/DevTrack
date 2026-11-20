import api from './api';

export async function getBilling() { const { data } = await api.get('/billing'); return data.data; }
export async function createOrder(pass) { const { data } = await api.post('/billing/orders', { pass }); return data.data; }
export async function verifyPayment(payment) { const { data } = await api.post('/billing/verify', payment); return data.data; }

const CHECKOUT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';
let checkoutPromise = null;

// Razorpay Checkout is loaded only when someone clicks Buy, never on page load.
export function loadCheckout() {
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  if (!checkoutPromise) {
    checkoutPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = CHECKOUT_SRC;
      script.async = true;
      script.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error('The payment window could not load.')));
      script.onerror = () => {
        script.remove();
        checkoutPromise = null;
        reject(new Error('The payment window could not load. Check your connection or ad blocker and try again.'));
      };
      document.head.appendChild(script);
    });
  }
  return checkoutPromise;
}

export const formatMoney = (amount, currency) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount / 100);
