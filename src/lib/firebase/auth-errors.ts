export function friendlyAuthError(error: unknown) {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
  if (code === "auth/email-already-in-use") return "This email already has an account. Try logging in instead.";
  if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found"].includes(code)) return "The email or password is incorrect. Please try again.";
  if (["auth/weak-password", "auth/password-does-not-meet-requirements"].includes(code)) return "Your password does not meet the requirements shown below the password field.";
  if (code === "auth/invalid-email") return "Enter a valid email address.";
  if (code === "auth/user-disabled") return "This account is unavailable. Contact TAKEME support for help.";
  if (code === "auth/too-many-requests") return "Too many attempts. Please wait a while before trying again.";
  if (["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(code)) return "Google sign-in was cancelled. You can try again.";
  if (code === "auth/popup-blocked") return "Your browser blocked the Google sign-in popup. Allow popups for TAKEME and try again.";
  if (code === "auth/account-exists-with-different-credential") return "An account already uses this email. Sign in with its existing method first.";
  if (code === "auth/operation-not-allowed") return "This sign-in method is not available yet. Please try another method or contact TAKEME support.";
  if (code === "functions/unauthenticated") return "Your session ended. Log in again to continue.";
  if (["auth/network-request-failed", "functions/unavailable", "functions/deadline-exceeded"].includes(code)) return "We couldn’t connect. Check your internet connection and try again.";
  if (code === "functions/failed-precondition") return "Account setup could not continue. Refresh to check your account status, then try again.";
  return "We couldn’t complete that request. Please try again.";
}
