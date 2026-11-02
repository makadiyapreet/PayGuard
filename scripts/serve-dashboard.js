/**
 * scripts/serve-dashboard.js
 * 
 * Minimal static HTTP server for the PayGuard dashboard.
 * Serves the project root on port 3000 so the dashboard can:
 *   - fetch /deployed.json (contract addresses)
 *   - connect to Ganache at http://127.0.0.1:7545 via web3.js
 *
 * Usage:  node scripts/serve-dashboard.js
 *   or:   npm run dashboard
 */
const http = require("http");
const fs   = require("fs");
const path = require("path");

const PORT = 3000;
const ROOT = path.resolve(__dirname, "..");

const MIME = {
  ".html": "text/html",
  ".js":   "application/javascript",
  ".css":  "text/css",
  ".json": "application/json",
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".svg":  "image/svg+xml",
  ".ico":  "image/x-icon",
};

const server = http.createServer((req, res) => {
  // Default route → dashboard/index.html
  let urlPath = req.url.split("?")[0];
  if (urlPath === "/") urlPath = "/dashboard/index.html";

  const filePath = path.join(ROOT, urlPath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not Found: " + urlPath);
    }
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME[ext] || "application/octet-stream";
    res.writeHead(200, {
      "Content-Type": mime,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`\n  ╔══════════════════════════════════════════════════════╗`);
  console.log(`  ║   PayGuard Dashboard Server Running                 ║`);
  console.log(`  ║                                                      ║`);
  console.log(`  ║   → Open:  http://127.0.0.1:${PORT}                    ║`);
  console.log(`  ║   → Also:  http://localhost:${PORT}                    ║`);
  console.log(`  ║                                                      ║`);
  console.log(`  ║   Press Ctrl+C to stop the server                    ║`);
  console.log(`  ╚══════════════════════════════════════════════════════╝\n`);
});
