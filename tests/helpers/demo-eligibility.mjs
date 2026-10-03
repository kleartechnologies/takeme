import { getAuth } from "firebase/auth";
import { randomUUID } from "node:crypto";
import { connectFunctionsEmulator, getFunctions, httpsCallable } from "firebase/functions";

export const createDemoPassword = () => randomUUID() + "!Aa1";

/** Authenticated fixtures use the actual server acceptance path; no credentials or acceptance timestamps are stored here. */
export async function acceptDemoPolicies(app, functions) {
  const auth = getAuth(app);
  if (app.options.projectId !== "demo-takeme" || !auth.currentUser
    || auth.emulatorConfig?.host !== "127.0.0.1" || auth.emulatorConfig?.port !== 9099) {
    throw new Error("Demo acceptance requires a signed-in demo-takeme Auth emulator account on 127.0.0.1:9099.");
  }
  if (!functions) {
    functions = getFunctions(app, "asia-southeast1");
    connectFunctionsEmulator(functions, "127.0.0.1", 5001);
  }
  const status = (await httpsCallable(functions, "getAccountSetupStatus")({})).data;
  if (!status.policyAvailable || !status.termsVersion || !status.privacyVersion) throw new Error("The demo policy release is unavailable.");
  await httpsCallable(functions, "acceptWebPolicies")({
    termsVersion: status.termsVersion, privacyVersion: status.privacyVersion,
    acceptTerms: true, acceptPrivacy: true, confirmAge18: true,
  });
}
