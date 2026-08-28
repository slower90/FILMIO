const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const staticRoot = path.join(projectRoot, "static-build");
const basePath = (process.env.BASE_PATH || "/").replace(/\/+$/, "");
const platforms = ["ios", "android"];

function fail(message) {
  throw new Error(message);
}

function newestBuildDirectory() {
  if (!fs.existsSync(staticRoot)) {
    fail(`No generated build found in ${staticRoot}`);
  }
  const builds = fs
    .readdirSync(staticRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d+-\d+$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  if (builds.length === 0) {
    fail(`No generated build found in ${staticRoot}`);
  }
  return builds.at(-1);
}

function reservePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => resolve(port));
    });
  });
}

function request(port, requestPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const request = http.get(
      { hostname: "127.0.0.1", port, path: requestPath, headers },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () =>
          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    request.once("error", reject);
  });
}

async function waitForServer(port, child) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      fail(`Production server exited with code ${child.exitCode}`);
    }
    try {
      const response = await request(port, basePath || "/");
      if (response.statusCode === 200) return;
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  fail("Timed out waiting for production server");
}

function localPathFromAssetUrl(assetUrl, platform) {
  let parsed;
  try {
    parsed = new URL(assetUrl);
  } catch {
    fail(`${platform} launch asset is not a valid URL`);
  }
  if (parsed.pathname.includes("..")) {
    fail(`${platform} launch asset contains a traversal path`);
  }
  return `${parsed.pathname}${parsed.search}`;
}

async function verify() {
  const buildDirectory = newestBuildDirectory();
  const port = await reservePort();
  const child = spawn(process.execPath, [path.join(projectRoot, "server", "serve.js")], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    await waitForServer(port, child);
    for (const platform of platforms) {
      const manifestResponse = await request(
        port,
        `${basePath}/manifest`,
        { "expo-platform": platform },
      );
      if (
        manifestResponse.statusCode !== 200 ||
        !manifestResponse.headers["content-type"]?.startsWith("application/json")
      ) {
        fail(`${platform} manifest was not served as JSON`);
      }
      const manifest = JSON.parse(manifestResponse.body.toString("utf8"));
      const launchAsset = manifest.launchAsset;
      if (
        !launchAsset ||
        launchAsset.contentType !== "application/javascript" ||
        typeof launchAsset.url !== "string"
      ) {
        fail(`${platform} manifest has no valid JavaScript launch asset`);
      }
      if (!new URL(launchAsset.url).pathname.includes(`/js/${platform}/bundle.js`)) {
        fail(`${platform} launch asset does not target the ${platform} bundle`);
      }
      const bundleResponse = await request(
        port,
        localPathFromAssetUrl(launchAsset.url, platform),
      );
      if (
        bundleResponse.statusCode !== 200 ||
        !bundleResponse.headers["content-type"]?.startsWith("application/javascript") ||
        bundleResponse.body.length === 0
      ) {
        fail(`${platform} launch bundle was not served successfully`);
      }
      console.log(`${platform}: manifest and launch bundle verified`);
    }
    console.log(`Production serving verification passed for build ${buildDirectory}`);
  } catch (error) {
    const detail = stderr.trim();
    throw new Error(detail ? `${error.message}\n${detail}` : error.message);
  } finally {
    child.kill("SIGTERM");
  }
}

verify().catch((error) => {
  console.error(`Production serving verification failed: ${error.message}`);
  process.exitCode = 1;
});