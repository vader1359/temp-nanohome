export type CommerceFeatureGates = Readonly<{
  amisSaleOrderDraftEnabled?: boolean;
  manualRefundEnabled?: boolean;
  manualRefundEvidenceRequired?: boolean;
}>;

export const canCreateAmisSaleOrderDraft = (gates: CommerceFeatureGates): boolean =>
  gates.amisSaleOrderDraftEnabled === true;

export const canProcessManualRefund = (gates: CommerceFeatureGates): boolean =>
  gates.manualRefundEnabled === true && gates.manualRefundEvidenceRequired === true;
