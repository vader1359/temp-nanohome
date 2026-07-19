import "server-only";

import { createHash, createHmac } from "node:crypto";

import { env } from "@/lib/env";

function hash(value: Buffer | string) {
  return createHash("sha256").update(value).digest("hex");
}

function hmac(key: string | Buffer, value: string, encoding?: "hex") {
  const digest = createHmac("sha256", key).update(value);
  return encoding ? digest.digest(encoding) : digest.digest();
}

function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

export function isR2MediaUrl(value: string | null | undefined): boolean {
  if (!value || !env.NEXT_PUBLIC_MEDIA_URL) return false;
  try {
    const candidate = new URL(value);
    const base = new URL(env.NEXT_PUBLIC_MEDIA_URL);
    return candidate.protocol === "https:" && candidate.origin === base.origin && candidate.pathname.startsWith(base.pathname);
  } catch {
    return false;
  }
}

export async function uploadRemoteImageToR2(sourceUrl: string, key: string, signal?: AbortSignal): Promise<string> {
  if (!env.CF_R2_ACCESS_KEY_ID || !env.CF_R2_SECRET_ACCESS_KEY || !env.CF_R2_ENDPOINT || !env.CF_R2_BUCKET || !env.NEXT_PUBLIC_MEDIA_URL) {
    throw new Error("R2 media environment variables are not configured");
  }
  const source = await fetch(sourceUrl, { signal });
  if (!source.ok) throw new Error(`Image download failed: ${source.status}`);
  const body = Buffer.from(await source.arrayBuffer());
  const contentType = source.headers.get("content-type")?.split(";", 1)[0] || "image/jpeg";
  const endpoint = new URL(env.CF_R2_ENDPOINT);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const path = `/${env.CF_R2_BUCKET}/${encodeKey(key)}`;
  const payloadHash = hash(body);
  const headers = `content-type:${contentType}\nhost:${endpoint.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "content-type;host;x-amz-content-sha256;x-amz-date";
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const canonical = ["PUT", path, "", headers, signedHeaders, payloadHash].join("\n");
  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, hash(canonical)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${env.CF_R2_SECRET_ACCESS_KEY}`, dateStamp), "auto"), "s3"), "aws4_request");
  const signature = hmac(signingKey, toSign, "hex");
  const result = await fetch(`${endpoint.origin}${path}`, { method: "PUT", signal, body, headers: {
    Authorization: `AWS4-HMAC-SHA256 Credential=${env.CF_R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    "Content-Type": contentType, "x-amz-content-sha256": payloadHash, "x-amz-date": amzDate,
  } });
  if (!result.ok) throw new Error(`R2 upload failed: ${result.status}`);
  return `${env.NEXT_PUBLIC_MEDIA_URL.replace(/\/+$/, "")}/${encodeKey(key)}`;
}
