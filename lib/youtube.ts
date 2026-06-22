import type { ContentPayload, MetricPayload, PlatformAdapter } from "./platformAdapter";

// Phase 2: implement YouTube Data API v3 ingestion
// Docs: https://developers.google.com/youtube/v3/docs
export class YouTubeAdapter implements PlatformAdapter {
  readonly platform = "youtube";

  async fetchContent(_channelId: string): Promise<ContentPayload[]> {
    // Phase 2:
    // GET https://www.googleapis.com/youtube/v3/search
    //   ?channelId=<channelId>&part=snippet&type=video&maxResults=50
    //   &key=<YOUTUBE_API_KEY>
    throw new Error("YouTubeAdapter.fetchContent not implemented — Phase 2");
  }

  async fetchMetrics(_videoIds: string[]): Promise<MetricPayload[]> {
    // Phase 2:
    // GET https://www.googleapis.com/youtube/v3/videos
    //   ?id=<id1,id2,...>&part=statistics&key=<YOUTUBE_API_KEY>
    throw new Error("YouTubeAdapter.fetchMetrics not implemented — Phase 2");
  }
}