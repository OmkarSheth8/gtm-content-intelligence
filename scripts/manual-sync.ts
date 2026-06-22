import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const secret = process.env.CRON_SECRET?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

  if (!secret) {
    console.error("CRON_SECRET is missing from .env.local");
    process.exit(1);
  }

  const baseUrl = appUrl.replace(/\/$/, "");
  const url = `${baseUrl}/api/sync`;

  console.log("Manual sync request");
  console.log(`Target: ${url}`);
  console.log(`CRON_SECRET length: ${secret.length}`);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
    },
  });

  const text = await response.text();

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  console.log(`HTTP status: ${response.status}`);
  console.log(body);

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Manual sync failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});