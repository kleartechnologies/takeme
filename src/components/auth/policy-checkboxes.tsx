import Link from "next/link";
import styles from "./auth.module.css";

export function PolicyCheckboxes({ age, agreed, setAge, setAgreed, disabled = false }: { age: boolean; agreed: boolean; setAge: (value: boolean) => void; setAgreed: (value: boolean) => void; disabled?: boolean }) {
  return <div className={styles.checks}>
    <label className={styles.check}><input type="checkbox" checked={age} disabled={disabled} onChange={event => setAge(event.target.checked)} /><span>I confirm that I am at least 18 years old.</span></label>
    <label className={styles.check} htmlFor="accept-policies"><input id="accept-policies" type="checkbox" checked={agreed} disabled={disabled} onChange={event => setAgreed(event.target.checked)} aria-labelledby="policy-label" /><span id="policy-label">I agree to the TAKEME <Link href="/terms" target="_blank" rel="noopener">Terms of Service<span className="sr-only"> (opens in a new tab)</span></Link> and <Link href="/privacy" target="_blank" rel="noopener">Privacy Policy<span className="sr-only"> (opens in a new tab)</span></Link>.</span></label>
  </div>;
}
