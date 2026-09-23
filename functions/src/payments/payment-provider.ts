import type { ProtectedPaymentStatus, PayoutStatus, RefundStatus, SellerOnboardingStatus } from "../protected-transaction-domain";

export interface ProtectedPaymentRequest { transactionId: string; buyerId: string; sellerId: string; amountSen: number; currency: "MYR"; idempotencyKey: string }
export interface ProtectedPaymentResult { provider: string; providerReference: string; status: ProtectedPaymentStatus }
export interface SellerOnboardingResult { provider: string; providerAccountReference: string | null; status: SellerOnboardingStatus; chargesEnabled: boolean; payoutsEnabled: boolean; requirementsStatus: string }
export interface PayoutRequest { transactionId: string; sellerId: string; amountSen: number; currency: "MYR"; idempotencyKey: string }
export interface PayoutResult { providerReference: string; status: PayoutStatus }
export interface RefundRequest { transactionId: string; paymentReference: string; amountSen: number; currency: "MYR"; idempotencyKey: string }
export interface RefundResult { providerReference: string; status: RefundStatus }
export interface VerifiedProviderEvent { providerEventId: string; type: string; providerReference: string; createdAt: string; payloadVersion: string }

export interface PaymentProvider {
  readonly id: string;
  readonly enabled: boolean;
  createProtectedPayment(request: ProtectedPaymentRequest): Promise<ProtectedPaymentResult>;
  retrievePaymentStatus(providerReference: string): Promise<ProtectedPaymentResult>;
  createSellerOnboarding(userId: string, idempotencyKey: string): Promise<SellerOnboardingResult>;
  retrieveSellerOnboarding(providerAccountReference: string): Promise<SellerOnboardingResult>;
  releasePayout(request: PayoutRequest): Promise<PayoutResult>;
  createRefund(request: RefundRequest): Promise<RefundResult>;
  retrieveRefundStatus(providerReference: string): Promise<RefundResult>;
  verifyWebhook(rawBody: string, signature: string): Promise<VerifiedProviderEvent>;
}

export class PaymentProviderDisabledError extends Error {
  constructor() { super("Protected payments are not enabled."); this.name = "PaymentProviderDisabledError"; }
}
