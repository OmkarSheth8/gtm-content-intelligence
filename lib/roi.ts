// Phase 6: ROI calculations using a transparent proxy funnel
//
// Funnel: views → tracked clicks → landing page visits → demo requests → estimated pipeline
// All estimates are labeled directional — no overclaiming

export interface ROIAssumptions {
  averageContractValue: number; // USD
  demoToOpportunityRate: number; // 0–1
  opportunityCloseRate: number; // 0–1
}

export interface ROIEstimate {
  views: number;
  trackedClicks: number;
  landingPageVisits: number;
  demoRequests: number;
  estimatedPipeline: number; // USD
  isDirectional: true; // always true — never claimed as exact
  assumptions: ROIAssumptions;
}

export const DEFAULT_ASSUMPTIONS: ROIAssumptions = {
  averageContractValue: 25000,
  demoToOpportunityRate: 0.4,
  opportunityCloseRate: 0.25,
};

export async function calculateROI(
  _contentItemId: string,
  assumptions: ROIAssumptions = DEFAULT_ASSUMPTIONS
): Promise<ROIEstimate> {
  // Phase 6:
  // 1. Query content_events for clicks/demo_requests for this content item
  // 2. Apply assumptions to estimate pipeline
  // 3. Return labeled as directional
  void assumptions;
  throw new Error("calculateROI not implemented — Phase 6");
}