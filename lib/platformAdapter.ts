export interface ContentPayload {
  platformContentId: string;
  title: string;
  description: string;
  publishedAt: Date;
  url: string;
  thumbnailUrl?: string;
  duration?: number; // seconds
  metadata?: Record<string, unknown>;
}

export interface MetricPayload {
  platformContentId: string;
  views: number;
  likes: number;
  comments: number;
  snapshotAt: Date;
}

export interface PlatformAdapter {
  platform: string;
  fetchContent(accountId: string): Promise<ContentPayload[]>;
  fetchMetrics(contentIds: string[]): Promise<MetricPayload[]>;
}