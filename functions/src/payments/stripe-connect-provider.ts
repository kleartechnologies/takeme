import { PaymentProviderDisabledError, type PaymentProvider } from "./payment-provider";

/**
 * Safe architectural stub. No Stripe SDK is installed and no network request,
 * account creation, payment, payout, refund or webhook verification can occur.
 */
export class StripeConnectProvider implements PaymentProvider {
  readonly id = "stripe_connect";
  readonly enabled = false;
  private unavailable(): never { throw new PaymentProviderDisabledError(); }
  async createProtectedPayment(): Promise<never> { return this.unavailable(); }
  async retrievePaymentStatus(): Promise<never> { return this.unavailable(); }
  async createSellerOnboarding(): Promise<never> { return this.unavailable(); }
  async retrieveSellerOnboarding(): Promise<never> { return this.unavailable(); }
  async releasePayout(): Promise<never> { return this.unavailable(); }
  async createRefund(): Promise<never> { return this.unavailable(); }
  async retrieveRefundStatus(): Promise<never> { return this.unavailable(); }
  async verifyWebhook(): Promise<never> { return this.unavailable(); }
}

export const protectedPaymentsConfig = Object.freeze({
  provider: "stripe_connect" as const,
  requestedEnabled: process.env.PROTECTED_PAYMENTS_ENABLED === "true",
  implementationReady: false,
  enabled: false,
});

export const protectedPaymentProvider = new StripeConnectProvider();
