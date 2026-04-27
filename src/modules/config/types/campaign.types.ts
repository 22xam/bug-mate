export type CampaignAudienceMode = 'all' | 'phones' | 'systems' | 'companies';

export interface CampaignAudience {
  mode: CampaignAudienceMode;
  phones?: string[];
  systems?: string[];
  companies?: string[];
}

export interface CampaignRateLimitConfig {
  delayMs: number;
  maxPerRun?: number;
}

export interface CampaignRetryConfig {
  maxAttempts: number;
  backoffMs: number;
}

export interface CampaignOptOutConfig {
  enabled: boolean;
  keywords: string[];
  confirmationMessage: string;
}

export interface CampaignConfig {
  id: string;
  name: string;
  enabled: boolean;
  audience: CampaignAudience;
  template?: string;
  aiPrompt?: string;
  systemPrompt?: string;
  rateLimit: CampaignRateLimitConfig;
  retry: CampaignRetryConfig;
  optOut?: CampaignOptOutConfig;
}
