import { HeadBucketCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

export interface S3Config {
  provider?: string;
  region?: string;
  bucket?: string;
  endpoint?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  encryption?: boolean;
  versioning?: boolean;
}

export function maskSecret(value?: string) {
  if (!value) return "";
  if (value.length <= 4) return "••••";
  return `••••••••${value.slice(-4)}`;
}

export function clientFromConfig(config: S3Config) {
  if (!config.bucket) throw new Error("S3 bucket name is required");
  const region = config.region || "us-east-1";
  const clientConfig: ConstructorParameters<typeof S3Client>[0] = { region };
  if (config.endpoint?.trim()) {
    clientConfig.endpoint = config.endpoint.trim();
    clientConfig.forcePathStyle = true;
  }
  if (config.accessKeyId && config.secretAccessKey) {
    clientConfig.credentials = {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    };
  }
  return new S3Client(clientConfig);
}

export async function testS3Connection(config: S3Config) {
  const client = clientFromConfig(config);
  await client.send(new HeadBucketCommand({ Bucket: config.bucket }));
  return { success: true, message: `Successfully connected to bucket "${config.bucket}"` };
}

export async function getS3BucketStats(config: S3Config) {
  const client = clientFromConfig(config);
  await client.send(new HeadBucketCommand({ Bucket: config.bucket }));

  let totalBytes = 0;
  let objectCount = 0;
  let token: string | undefined;

  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: config.bucket, ContinuationToken: token, MaxKeys: 1000 })
    );
    for (const obj of page.Contents ?? []) {
      objectCount += 1;
      totalBytes += obj.Size ?? 0;
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
    // Cap scan for very large buckets — partial count is noted in response
    if (objectCount >= 10000) break;
  } while (token);

  return {
    connected: true,
    bucket: config.bucket,
    objectCount,
    totalBytes,
    totalGb: Number((totalBytes / 1024 / 1024 / 1024).toFixed(2)),
    partial: Boolean(token),
  };
}

export function sanitizeS3ForResponse(config: S3Config) {
  return {
    ...config,
    secretAccessKey: config.secretAccessKey ? maskSecret(config.secretAccessKey) : "",
    hasCredentials: Boolean(config.accessKeyId && config.secretAccessKey),
  };
}
