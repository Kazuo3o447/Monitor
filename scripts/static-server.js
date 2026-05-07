const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { URLSearchParams } = require("node:url");

const root = path.resolve(__dirname, "..");
const port = Number(process.env.PORT || process.argv[2] || 5173);
const host = process.env.HOST || "127.0.0.1";
const localConfigPath = path.join(root, "data", "local-config.json");

loadEnvFile(path.join(root, ".env"));

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const content = fs.readFileSync(filePath, "utf8");
  content.split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      return;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

function createDefaultLocalConfig() {
  return {
    licenseAliases: {},
    customPackages: [],
    thresholds: {}
  };
}

function normalizeStringMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => [String(key).trim(), String(entryValue ?? "").trim()])
      .filter(([key]) => key)
  );
}

function normalizeThresholds(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, entryValue]) => {
        const parsed = Number.parseInt(entryValue, 10);
        const threshold = Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 80;
        return [String(key).trim(), threshold];
      })
      .filter(([key]) => key)
  );
}

function normalizeCustomPackages(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(item => item && typeof item === "object")
    .map(item => {
      const total = Math.max(1, Number.parseInt(item.total, 10) || 1);
      const used = Math.min(total, Math.max(0, Number.parseInt(item.used, 10) || 0));
      const sku = String(item.sku || "").trim().toUpperCase().replace(/\s+/g, "_");
      const name = String(item.name || sku).trim();
      if (!sku || !name) {
        return null;
      }

      return {
        id: Number(item.id) || Date.now(),
        name,
        sku,
        total,
        used,
        blocked: Boolean(item.blocked),
        trend: Number(item.trend) || 0,
        source: "manual",
        createdAt: item.createdAt || new Date().toISOString(),
        updatedAt: item.updatedAt || new Date().toISOString()
      };
    })
    .filter(Boolean);
}

function normalizeLocalConfig(config) {
  const defaults = createDefaultLocalConfig();
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return defaults;
  }

  return {
    licenseAliases: normalizeStringMap(config.licenseAliases),
    customPackages: normalizeCustomPackages(config.customPackages),
    thresholds: normalizeThresholds(config.thresholds)
  };
}

function ensureLocalConfigFile() {
  const dirPath = path.dirname(localConfigPath);
  fs.mkdirSync(dirPath, { recursive: true });
  if (!fs.existsSync(localConfigPath)) {
    fs.writeFileSync(localConfigPath, JSON.stringify(createDefaultLocalConfig(), null, 2));
  }
}

function readLocalConfig() {
  ensureLocalConfigFile();
  try {
    const raw = fs.readFileSync(localConfigPath, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeLocalConfig(parsed);
  } catch {
    const defaults = createDefaultLocalConfig();
    fs.writeFileSync(localConfigPath, JSON.stringify(defaults, null, 2));
    return defaults;
  }
}

function writeLocalConfig(config) {
  const normalized = normalizeLocalConfig(config);
  ensureLocalConfigFile();
  fs.writeFileSync(localConfigPath, JSON.stringify(normalized, null, 2));
  return normalized;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function buildConfigError() {
  const missing = ["M365_TENANT_ID", "M365_CLIENT_ID", "M365_CLIENT_SECRET_VALUE"]
    .filter(name => !process.env[name] || process.env[name].startsWith("<"));

  if (missing.length === 0) {
    return null;
  }

  return {
    error: "missing_configuration",
    message: "Microsoft Graph credentials are incomplete. Fill the missing .env values before requesting live license data.",
    missing
  };
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash) || 1;
}

async function fetchGraphAccessToken() {
  const tokenUrl = `https://login.microsoftonline.com/${process.env.M365_TENANT_ID}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: process.env.M365_CLIENT_ID,
    client_secret: process.env.M365_CLIENT_SECRET_VALUE,
    scope: process.env.M365_GRAPH_SCOPE || "https://graph.microsoft.com/.default",
    grant_type: "client_credentials"
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token request failed (${response.status}): ${errorText}`);
  }

  const payload = await response.json();
  return payload.access_token;
}

function mapSubscribedSku(sku) {
  const total = Number(sku?.prepaidUnits?.enabled || 0);
  const used = Math.max(0, Number(sku?.consumedUnits || 0));
  const available = Math.max(0, total - used);

  return {
    id: hashString(String(sku.skuId || sku.skuPartNumber || crypto.randomUUID?.() || Date.now())),
    name: sku.skuPartNumber || sku.skuId || "UNKNOWN_SKU",
    sku: sku.skuPartNumber || sku.skuId || "UNKNOWN_SKU",
    total,
    used: Math.min(total, used),
    blocked: sku.capabilityStatus && sku.capabilityStatus !== "Enabled",
    trend: 0,
    source: "graph",
    available,
    capabilityStatus: sku.capabilityStatus || "Unknown"
  };
}

async function fetchGraphLicenses() {
  const accessToken = await fetchGraphAccessToken();
  const response = await fetch("https://graph.microsoft.com/v1.0/subscribedSkus?$select=skuId,skuPartNumber,consumedUnits,capabilityStatus,prepaidUnits", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Graph request failed (${response.status}): ${errorText}`);
  }

  const payload = await response.json();
  return Array.isArray(payload.value) ? payload.value.map(mapSubscribedSku) : [];
}

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent((requestUrl || "/").split("?")[0]);
  const normalized = path.normalize(pathname).replace(/^([.][.][\\/])+/, "");
  const requestedPath = path.resolve(root, normalized === path.sep ? "index.html" : `.${normalized}`);

  if (requestedPath !== root && !requestedPath.startsWith(`${root}${path.sep}`)) {
    return null;
  }

  return requestedPath;
}

const server = http.createServer(async (req, res) => {
  if (req.url === "/api/config" && req.method === "GET") {
    sendJson(res, 200, readLocalConfig());
    return;
  }

  if (req.url === "/api/config" && req.method === "POST") {
    try {
      const body = await readRequestBody(req);
      const payload = body ? JSON.parse(body) : {};
      const config = writeLocalConfig(payload);
      sendJson(res, 200, config);
    } catch (error) {
      sendJson(res, 400, {
        error: "invalid_config_payload",
        message: error.message
      });
    }
    return;
  }

  if ((req.url || "").startsWith("/api/") && req.method !== "GET") {
    sendJson(res, 405, {
      error: "read_only_api",
      message: "Microsoft Graph access stays read-only. Only the local /api/config endpoint may store UI preferences."
    });
    return;
  }

  if (req.url === "/api/licenses" && req.method === "GET") {
    const configError = buildConfigError();
    if (configError) {
      sendJson(res, 500, configError);
      return;
    }

    try {
      const licenses = await fetchGraphLicenses();
      sendJson(res, 200, {
        source: "graph",
        licenses
      });
    } catch (error) {
      sendJson(res, 502, {
        error: "graph_request_failed",
        message: error.message
      });
    }
    return;
  }

  let filePath = resolveRequestPath(req.url);

  if (!filePath) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.stat(filePath, (statError, stat) => {
    if (statError || !stat.isFile()) {
      filePath = path.join(root, "index.html");
    }

    fs.readFile(filePath, (readError, data) => {
      if (readError) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      res.writeHead(200, {
        "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
        "Cache-Control": "no-store, no-cache, must-revalidate",
        Pragma: "no-cache",
        Expires: "0"
      });
      res.end(data);
    });
  });
});

server.listen(port, host, () => {
  console.log(`Static server running at http://${host}:${port}/`);
});

