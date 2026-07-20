#!/usr/bin/env node

/**
 * Restores the verified Supabase catalog backup to Cloudflare R2, then
 * restores the catalog rows with their file URLs rewritten to R2.
 *
 * Run without --apply for an integrity audit. The database is not touched
 * until every R2 upload has completed successfully.
 */

import { createHash, createHmac } from "node:crypto";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultBackup = path.join(root, "outputs", "supabase-catalogs-backup", "2026-07-19T22-41-54-684Z");
const backupDirectory = path.resolve(root, (process.argv.find((argument) => argument.startsWith("--backup=")) ?? `--backup=${path.relative(root, defaultBackup)}`).slice("--backup=".length));
const apply = process.argv.includes("--apply");
const concurrency = Number((process.argv.find((argument) => argument.startsWith("--concurrency=")) ?? "--concurrency=3").slice("--concurrency=".length));
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error("--concurrency must be between 1 and 8");

function parseEnv(contents) {
  return Object.fromEntries(contents.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    return match ? [[match[1], match[2].replace(/^['\"]|['\"]$/g, "")]] : [];
  }));
}

const env = parseEnv(await readFile(path.join(root, ".env.local"), "utf8"));
for (const key of ["CF_R2_ACCESS_KEY_ID", "CF_R2_SECRET_ACCESS_KEY", "CF_R2_ENDPOINT", "CF_R2_BUCKET", "NEXT_PUBLIC_MEDIA_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!env[key]) throw new Error(`Missing ${key} in .env.local`);
}
const endpoint = new URL(env.CF_R2_ENDPOINT);
const publicBaseUrl = env.NEXT_PUBLIC_MEDIA_URL.replace(/\/+$/, "");
const supabaseBaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const reportDirectory = path.join(root, "outputs", "catalog-r2-restore");
const manifest = JSON.parse(await readFile(path.join(backupDirectory, "manifest.json"), "utf8"));
const catalogs = JSON.parse(await readFile(path.join(backupDirectory, "catalogs.json"), "utf8"));

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function hmac(key, value, encoding) { return createHmac("sha256", key).update(value).digest(encoding); }
function encodeKey(key) {
  // encodeURIComponent intentionally leaves a few RFC 3986 reserved
  // characters untouched; S3-compatible SigV4 canonical paths must encode them.
  return key.split("/").map((segment) => encodeURIComponent(segment).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)).join("/");
}
function publicUrl(key) { return `${publicBaseUrl}/${encodeKey(key)}`; }
function decodedObjectPath(value) {
  const url = new URL(value);
  const prefix = "/storage/v1/object/public/catalogs/";
  if (url.origin !== new URL(supabaseBaseUrl).origin || !url.pathname.startsWith(prefix)) throw new Error(`Unexpected backup catalog URL: ${value}`);
  return url.pathname.slice(prefix.length).split("/").map(decodeURIComponent).join("/");
}
function safeRelativePath(value) {
  if (!value || path.isAbsolute(value) || value.split("/").some((part) => part === "" || part === "." || part === "..")) throw new Error(`Unsafe backup path: ${value}`);
  return value;
}

if (!Array.isArray(manifest.files) || manifest.catalogRows !== catalogs.length || manifest.catalogRows !== 16 || manifest.files.length !== 38) {
  throw new Error(`Backup shape mismatch: ${JSON.stringify({ catalogRows: catalogs.length, manifestRows: manifest.catalogRows, files: manifest.files?.length })}`);
}

const manifestByPath = new Map();
for (const file of manifest.files) {
  const relativePath = safeRelativePath(file.path);
  if (!Number.isInteger(file.size) || file.size < 1 || manifestByPath.has(relativePath)) throw new Error(`Invalid manifest entry: ${JSON.stringify(file)}`);
  const sourcePath = path.join(backupDirectory, "storage", ...relativePath.split("/"));
  const sourceStat = await stat(sourcePath);
  if (!sourceStat.isFile() || sourceStat.size !== file.size) throw new Error(`Backup file mismatch: ${relativePath}`);
  manifestByPath.set(relativePath, { ...file, sourcePath, key: `catalogs/${relativePath}`, destinationUrl: publicUrl(`catalogs/${relativePath}`) });
}

const referencedPaths = catalogs.flatMap((catalog) => {
  if (!Array.isArray(catalog.file_urls) || catalog.file_urls.length === 0) throw new Error(`Catalog ${catalog.id} has no files`);
  return catalog.file_urls.map(decodedObjectPath);
});
if (referencedPaths.length !== manifestByPath.size || new Set(referencedPaths).size !== manifestByPath.size || referencedPaths.some((file) => !manifestByPath.has(file))) {
  throw new Error("Catalog rows do not reference exactly the backed-up files");
}

const restoredCatalogs = catalogs.map((catalog) => ({
  ...catalog,
  file_urls: catalog.file_urls.map((oldUrl) => manifestByPath.get(decodedObjectPath(oldUrl)).destinationUrl),
}));
const tasks = Array.from(manifestByPath.values()).sort((left, right) => left.key.localeCompare(right.key));

async function writeReport(report) {
  await mkdir(reportDirectory, { recursive: true });
  const reportPath = path.join(reportDirectory, `${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return reportPath;
}

async function putObject(key, body) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const requestPath = `/${env.CF_R2_BUCKET}/${encodeKey(key)}`;
  const payloadHash = sha256(body);
  const cacheControl = "public, max-age=31536000, immutable";
  const canonicalHeaders = `cache-control:${cacheControl}\ncontent-type:application/pdf\nhost:${endpoint.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "cache-control;content-type;host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", requestPath, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");
  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${env.CF_R2_SECRET_ACCESS_KEY}`, dateStamp), "auto"), "s3"), "aws4_request");
  const signature = hmac(signingKey, stringToSign, "hex");
  const response = await fetch(`${endpoint.origin}${requestPath}`, {
    method: "PUT",
    headers: {
      Authorization: `AWS4-HMAC-SHA256 Credential=${env.CF_R2_ACCESS_KEY_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "Cache-Control": cacheControl,
      "Content-Type": "application/pdf",
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    },
    body,
  });
  if (!response.ok) throw new Error(`R2 PUT ${key}: ${response.status} ${await response.text()}`);
}

async function restoreRows() {
  const response = await fetch(new URL("/rest/v1/catalogs?on_conflict=id", supabaseBaseUrl), {
    method: "POST",
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(restoredCatalogs),
  });
  if (!response.ok) throw new Error(`Supabase catalog restore: ${response.status} ${await response.text()}`);
}

async function verifyRestoredRows() {
  const response = await fetch(new URL("/rest/v1/catalogs?select=id,file_urls", supabaseBaseUrl), {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  });
  if (!response.ok) throw new Error(`Supabase verification: ${response.status} ${await response.text()}`);
  const rows = await response.json();
  const fileUrls = rows.flatMap((row) => row.file_urls ?? []);
  if (rows.length !== catalogs.length || fileUrls.length !== tasks.length || fileUrls.some((url) => !url.startsWith(`${publicBaseUrl}/catalogs/`))) {
    throw new Error(`Supabase verification mismatch: ${JSON.stringify({ rows: rows.length, fileUrls: fileUrls.length })}`);
  }
  return { rows: rows.length, fileUrls: fileUrls.length };
}

if (!apply) {
  const reportPath = await writeReport({ generatedAt: new Date().toISOString(), mode: "audit", backupDirectory, catalogRows: catalogs.length, files: tasks.map(({ sourcePath, ...task }) => task), totalBytes: manifest.totalBytes });
  console.log(`Audit passed: ${catalogs.length} catalog rows, ${tasks.length} PDFs, ${manifest.totalBytes} bytes`);
  console.log(`Report: ${path.relative(root, reportPath)}`);
  process.exit(0);
}

console.log(`Uploading ${tasks.length} PDFs (${manifest.totalBytes} bytes) to R2 with concurrency ${concurrency}`);
const uploaded = [];
const failures = [];
let next = 0;
let completed = 0;
async function worker() {
  while (next < tasks.length) {
    const task = tasks[next++];
    try {
      await putObject(task.key, await readFile(task.sourcePath));
      uploaded.push({ key: task.key, destinationUrl: task.destinationUrl, bytes: task.size });
    } catch (error) {
      failures.push({ key: task.key, error: error instanceof Error ? error.message : String(error) });
    } finally {
      completed++;
      console.log(`Uploaded ${completed}/${tasks.length}`);
    }
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
if (failures.length > 0) {
  const reportPath = await writeReport({ generatedAt: new Date().toISOString(), mode: "apply", uploaded, failures, databaseRestored: false });
  throw new Error(`R2 upload failed for ${failures.length} object(s). Report: ${path.relative(root, reportPath)}`);
}

await restoreRows();
const database = await verifyRestoredRows();
const unavailable = [];
for (const task of tasks) {
  const response = await fetch(task.destinationUrl, { method: "HEAD" });
  if (!response.ok || !response.headers.get("content-type")?.includes("application/pdf")) unavailable.push({ key: task.key, status: response.status, contentType: response.headers.get("content-type") });
}
const reportPath = await writeReport({ generatedAt: new Date().toISOString(), mode: "apply", uploaded, failures, databaseRestored: true, database, unavailable });
if (unavailable.length > 0) throw new Error(`Public R2 verification failed for ${unavailable.length} object(s). Report: ${path.relative(root, reportPath)}`);
console.log(`Restored ${database.rows} catalog rows and verified ${tasks.length} public R2 PDFs`);
console.log(`Report: ${path.relative(root, reportPath)}`);
