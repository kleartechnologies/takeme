export function friendlyAuthError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "auth/email-already-in-use") return "This email already has an account. Try logging in instead.";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(code)) return "The email or password is incorrect. Please try again.";
  if (code === "auth/weak-password") return "Choose a stronger password with at least 8 characters.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a while before trying again.";
  if (["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(code)) return "Google sign-in was cancelled. You can try again.";
  if (code === "auth/popup-blocked") return "Your browser blocked the Google sign-in popup. Allow popups for TAKEME and try again.";
  if (code === "auth/account-exists-with-different-credential") return "An account already uses this email. Sign in with its existing method first.";
  if (code === "auth/operation-not-allowed") return "Google sign-in is not available yet. Please use email and password for now.";
  if (code === "auth/network-request-failed") return "We couldn’t connect. Check your internet connection and try again.";
  return "We couldn’t complete that request. Please try again.";
}
