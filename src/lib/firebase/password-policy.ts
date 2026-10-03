import type { PasswordPolicy } from "firebase/auth";

export function passwordPolicyHelp(policy: PasswordPolicy) {
  const rules = policy.customStrengthOptions;
  const parts = [`at least ${rules.minPasswordLength ?? 6} characters`];
  if (rules.containsLowercaseLetter) parts.push("a lowercase letter");
  if (rules.containsUppercaseLetter) parts.push("an uppercase letter");
  if (rules.containsNumericCharacter) parts.push("a number");
  if (rules.containsNonAlphanumericCharacter) parts.push("a symbol");
  return `Use ${parts.join(", ")}.${rules.maxPasswordLength ? ` Maximum ${rules.maxPasswordLength} characters.` : ""}`;
}
