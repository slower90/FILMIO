const SIDECAR = "http://127.0.0.1:1106";

function privateObjectName(objectPath: string): { bucket: string; objectName: string } {
  if (!objectPath.startsWith("/objects/")) {
    throw new Error("Invalid private object path");
  }

  const bucket = (process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID || "").replace(/^\/+/, "");
  const privateDir = (process.env.PRIVATE_OBJECT_DIR || "").replace(/^\/+|\/+$/g, "");
  const relativeObjectName = objectPath.slice("/objects/".length);
  if (!bucket || !relativeObjectName || relativeObjectName.includes("..") || relativeObjectName.startsWith("/")) {
    throw new Error("Invalid private object path");
  }

  return {
    bucket,
    objectName: privateDir ? `${privateDir}/${relativeObjectName}` : relativeObjectName,
  };
}

export async function deletePrivateObject(
  objectPath: string,
  options: { ignoreNotFound?: boolean } = {},
): Promise<void> {
  const { bucket, objectName } = privateObjectName(objectPath);
  const response = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucket,
      object_name: objectName,
      method: "DELETE",
      expires_at: new Date(Date.now() + 900_000).toISOString(),
    }),
  });
  if (!response.ok) {
    throw new Error(`Unable to sign object deletion URL (${response.status})`);
  }

  const { signed_url: signedUrl } = await response.json() as { signed_url: string };
  const deletion = await fetch(signedUrl, { method: "DELETE" });
  if (!deletion.ok && !(options.ignoreNotFound && deletion.status === 404)) {
    throw new Error(`Unable to delete private object (${deletion.status})`);
  }
}

export async function signPrivateObjectUrl(
  objectPath: string,
  method: "PUT" | "GET",
): Promise<{ url: string; objectPath: string }> {
  const { bucket, objectName } = privateObjectName(objectPath);
  const response = await fetch(`${SIDECAR}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucket,
      object_name: objectName,
      method,
      expires_at: new Date(Date.now() + 900_000).toISOString(),
    }),
  });
  if (!response.ok) {
    throw new Error(`Unable to sign private object URL (${response.status})`);
  }
  const { signed_url: url } = await response.json() as { signed_url: string };
  return { url, objectPath };
}