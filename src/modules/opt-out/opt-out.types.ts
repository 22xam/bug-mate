export type OptOutSource = 'keyword' | 'admin' | 'campaign' | 'import' | 'unknown';

export interface OptOutRecord {
  phone: string;
  recipientId: string;
  source: OptOutSource;
  reason?: string;
  keyword?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOptOutInput {
  phone: string;
  recipientId?: string;
  source?: OptOutSource;
  reason?: string;
  keyword?: string;
}

export interface UpdateOptOutInput {
  source?: OptOutSource;
  reason?: string | null;
  keyword?: string | null;
}

export interface OptOutEvent {
  id: string;
  phone: string;
  recipientId: string;
  keyword?: string;
  message?: string;
  action: 'created' | 'updated' | 'removed' | 'matched_keyword' | 'ignored';
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface OptOutKeywordMatch {
  matched: boolean;
  keyword?: string;
}

export interface OptOutSettings {
  keywords: string[];
  confirmationMessage?: string;
}
