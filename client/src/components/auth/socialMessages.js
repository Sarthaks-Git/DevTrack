export const PROVIDER_LABELS = { google: "Google", github: "GitHub", linkedin: "LinkedIn" };

// Outcome words the server puts in the redirect after a provider sign-in, as plain sentences.
export function socialOutcomeText(outcome, provider) {
  const name = PROVIDER_LABELS[provider] || "the provider";
  switch (outcome) {
    case "linked": return `${name} is now linked. You can use it to sign in.`;
    case "denied": return "Sign-in was cancelled.";
    case "expired": return "That sign-in took too long or was opened in another browser. Please try again.";
    case "email_unverified": return `Your ${name} account's email is not verified. Verify it with ${name}, or use another way to sign in.`;
    case "email_exists": return `An account with this email already exists. Sign in with your password, then link ${name} in Settings → Sign-in methods.`;
    case "in_use": return `That ${name} account is already linked to another DevTrack account.`;
    case "already_linked": return `A different ${name} account is already linked. Unlink it first.`;
    default: return `Could not sign in with ${name}. Please try again.`;
  }
}
