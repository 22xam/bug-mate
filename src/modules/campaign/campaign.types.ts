export type CampaignRunStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'cancelled'
  | 'completed'
  | 'completed_with_errors';

export type CampaignJobStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'skipped' | 'cancelled';

export interface CampaignTargetConfig {
  source: 'clients' | 'manual';
  includePhones?: string[];
  excludePhones?: string[];
  systems?: string[];
}

export interface CampaignDefaults {
  maxAttempts?: number;
  delayMs?: number;
  batchSize?: number;
}

export interface CampaignDefinition {
  id: string;
  name: string;
  description?: string;
  enabled?: boolean;
  messageTemplate: string;
  target: CampaignTargetConfig;
  defaults?: CampaignDefaults;
  metadata?: Record<string, unknown>;
}

export interface CampaignsConfig {
  defaults?: Required<CampaignDefaults>;
  campaigns: CampaignDefinition[];
  optOut?: {
    keywords?: string[];
    confirmationMessage?: string;
  };
}

export interface CampaignRecipient {
  phone: string;
  recipientId?: string;
  name?: string;
  company?: string;
  systems?: string[];
  variables?: Record<string, string>;
}

export interface CampaignPreviewRequest {
  campaignId: string;
  recipients?: CampaignRecipient[];
  limit?: number;
}

export interface CampaignPreviewItem {
  phone: string;
  recipientId: string;
  name?: string;
  message: string;
  optedOut: boolean;
}

export interface CreateCampaignRunInput {
  campaignId: string;
  recipients?: CampaignRecipient[];
  requestedBy?: string;
  metadata?: Record<string, unknown>;
  maxAttempts?: number;
}

export interface CampaignRun {
  id: string;
  campaignId: string;
  name: string;
  status: CampaignRunStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  totalJobs: number;
  queuedJobs: number;
  sentJobs: number;
  failedJobs: number;
  skippedJobs: number;
  cancelledJobs: number;
  metadata?: Record<string, unknown>;
}

export interface CampaignJob {
  id: string;
  runId: string;
  campaignId: string;
  recipientId: string;
  phone: string;
  name?: string;
  status: CampaignJobStatus;
  message: string;
  error?: string;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt?: string;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
}

export interface CampaignRunDetails extends CampaignRun {
  jobs: CampaignJob[];
}

export interface CampaignMetrics {
  runs: number;
  jobs: number;
  queued: number;
  sent: number;
  failed: number;
  skipped: number;
  cancelled: number;
  byCampaign: Array<{
    campaignId: string;
    runs: number;
    jobs: number;
    sent: number;
    failed: number;
    skipped: number;
  }>;
}

export interface CampaignProcessResult {
  processed: boolean;
  job?: CampaignJob;
  run?: CampaignRun;
  status: 'sent' | 'failed' | 'skipped' | 'empty';
  error?: string;
}

export interface CampaignSender {
  sendCampaignMessage(job: CampaignJob): Promise<void>;
}

export type CampaignSendHandler = (job: CampaignJob) => Promise<void>;
