# Walkthrough

Phase 7 artifact — fill in once the system is running end-to-end.

## Demo Script

1. Show last sync timestamp (SyncStatus component)
2. Walk through MetricCards — total views, engagement rate, top topic
3. Show PerformanceChart — view growth over time for top 5 videos
4. Show ContentTable — sortable by views, engagement, publish date
5. Click into a content item — classification, metric history, tracked events
6. Navigate to Recommendations — explain the data → LLM → idea pipeline
7. Navigate to ROI — show proxy funnel, explain assumptions, estimated pipeline
8. Trigger a manual sync live: `curl -X POST /api/sync -H "Authorization: Bearer ..."`
9. Show the new sync_run record appear in the dashboard