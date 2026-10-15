export const CAMPAIGN_ID = 'founding-01';
export const POINTS = { join: 10, quiz: 40, track: 20 } as const;
export type CampaignAction = keyof typeof POINTS;
