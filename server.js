const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;

function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) return;

  const source = fs.readFileSync(filePath, "utf8");
  for (const line of source.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || line.trimStart().startsWith("#")) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    const isQuoted =
      rawValue.length >= 2 &&
      ((rawValue.startsWith('"') && rawValue.endsWith('"')) ||
        (rawValue.startsWith("'") && rawValue.endsWith("'")));
    process.env[key] = isQuoted ? rawValue.slice(1, -1) : rawValue;
  }
}

loadLocalEnv(path.join(ROOT, ".env"));

const PORT = Number(process.env.PORT || 3000);
const ADMIN_LOGIN = process.env.ADMIN_LOGIN;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!ADMIN_LOGIN || !ADMIN_TOKEN) {
  throw new Error(
    "Set ADMIN_LOGIN and ADMIN_TOKEN in .env or environment variables before starting the server.",
  );
}

const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "content.json");
const UPLOAD_DIR = path.join(PUBLIC_DIR, "assets", "uploads");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

function send(res, status, body, contentType = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload, null, 2));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 5_000_000) {
        reject(new Error("Payload is too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(raw));
    req.on("error", reject);
  });
}

function readBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      chunks.push(chunk);
      size += chunk.length;
      if (size > 350_000_000) {
        reject(new Error("Payload is too large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function safeCompare(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function requireAdmin(req, res) {
  const header = req.headers.authorization || "";
  let token = header.startsWith("Bearer ") ? header.slice(7) : "";
  let login = "";
  const encodedLogin = req.headers["x-admin-login-b64"];
  if (encodedLogin) {
    try {
      login = Buffer.from(String(encodedLogin), "base64").toString("utf8");
    } catch {
      login = "";
    }
  }
  const encodedToken = req.headers["x-admin-token-b64"];
  if (encodedToken) {
    try {
      token = Buffer.from(String(encodedToken), "base64").toString("utf8");
    } catch {
      token = "";
    }
  }
  if (!safeCompare(login, ADMIN_LOGIN) || !safeCompare(token, ADMIN_TOKEN)) {
    sendJson(res, 401, { error: "Неверный логин или пароль админки" });
    return false;
  }
  return true;
}

function readContent() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function writeContent(content) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(content, null, 2), "utf8");
  fs.renameSync(tmp, DATA_FILE);
}

function parseMultipartUpload(req, body) {
  const contentType = req.headers["content-type"] || "";
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) throw new Error("Upload boundary not found");

  const boundary = Buffer.from(`--${boundaryMatch[1] || boundaryMatch[2]}`);
  const fileHeader = Buffer.from('name="file"');
  let cursor = body.indexOf(boundary);

  while (cursor !== -1) {
    const next = body.indexOf(boundary, cursor + boundary.length);
    if (next === -1) break;

    const part = body.subarray(cursor + boundary.length + 2, next - 2);
    const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd !== -1) {
      const header = part.subarray(0, headerEnd).toString("utf8");
      if (part.includes(fileHeader)) {
        const filenameMatch = header.match(/filename="([^"]+)"/i);
        const contentTypeMatch = header.match(/Content-Type:\s*([^\r\n]+)/i);
        return {
          filename: filenameMatch ? filenameMatch[1] : "upload.png",
          contentType: contentTypeMatch ? contentTypeMatch[1].trim() : "application/octet-stream",
          data: part.subarray(headerEnd + 4),
        };
      }
    }

    cursor = next;
  }

  throw new Error("File field not found");
}

function saveUpload(file) {
  const allowed = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp3", ".wav", ".ogg", ".m4a", ".mp4", ".webm"]);
  const ext = path.extname(file.filename).toLowerCase();
  if (!allowed.has(ext)) throw new Error("Only images, audio, mp4 and webm video files are allowed");
  if (!file.contentType.startsWith("image/") && !file.contentType.startsWith("audio/") && !file.contentType.startsWith("video/")) {
    throw new Error("Uploaded file must be an image, audio or video");
  }

  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const safeName = path.basename(file.filename, ext).replace(/[^a-z0-9_-]+/gi, "-").slice(0, 50) || "upload";
  const finalName = `${Date.now()}-${safeName}${ext}`;
  const finalPath = path.join(UPLOAD_DIR, finalName);
  fs.writeFileSync(finalPath, file.data);
  return `/assets/uploads/${finalName}`;
}

function serveFile(req, res) {
  const cleanUrl = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const relative = cleanUrl === "/" ? "index.html" : cleanUrl.replace(/^\/+/, "");
  const filePath = path.normalize(path.join(PUBLIC_DIR, relative));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    send(res, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      send(res, 404, "Not found", "text/plain; charset=utf-8");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES[ext] || "application/octet-stream";
    const range = req.headers.range;

    // Video playback needs byte ranges for seeking and chapter navigation.
    if (range) {
      const match = /bytes=(\d*)-(\d*)/.exec(range);
      if (!match) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        res.end();
        return;
      }
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
      if (start > end || start >= stat.size) {
        res.writeHead(416, { "Content-Range": `bytes */${stat.size}` });
        res.end();
        return;
      }
      res.writeHead(206, {
        "Content-Type": type,
        "Content-Length": end - start + 1,
        "Content-Range": `bytes ${start}-${end}/${stat.size}`,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      });
      fs.createReadStream(filePath, { start, end }).pipe(res);
      return;
    }

    res.writeHead(200, {
      "Content-Type": type,
      "Content-Length": stat.size,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(filePath).pipe(res);
  });
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/api/content") {
    sendJson(res, 200, readContent());
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/admin/content") {
    if (!requireAdmin(req, res)) return;
    sendJson(res, 200, readContent());
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/content") {
    if (!requireAdmin(req, res)) return;

    try {
      const body = await readBody(req);
      const content = JSON.parse(body);
      content.updatedAt = new Date().toISOString();
      writeContent(content);
      sendJson(res, 200, { ok: true, updatedAt: content.updatedAt });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/upload") {
    if (!requireAdmin(req, res)) return;

    try {
      const body = await readBuffer(req);
      const file = parseMultipartUpload(req, body);
      const url = saveUpload(file);
      sendJson(res, 200, { ok: true, url });
    } catch (error) {
      sendJson(res, 400, { error: error.message });
    }
    return;
  }

  sendJson(res, 404, { error: "API route not found" });
}

const server = http.createServer((req, res) => {
  if (req.url.startsWith("/api/")) {
    handleApi(req, res).catch((error) => sendJson(res, 500, { error: error.message }));
    return;
  }

  serveFile(req, res);
});

server.listen(PORT, () => {
  console.log(`Dark fantasy archive is running: http://localhost:${PORT}`);
  console.log("Admin panel: /admin.html");
});
