const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const REPORT_DIR = path.join(__dirname, "reports");

fs.mkdirSync(REPORT_DIR, { recursive: true });

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

function clientIP(req) {
  const xff = req.headers["x-forwarded-for"];
  return xff ? xff.split(",")[0].trim() : (req.socket.remoteAddress || "");
}

function filenameForNow() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `device-${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}-${Date.now()}.json`;
}

app.post("/api/reports", (req, res) => {
  const now = new Date();
  const filename = filenameForNow();

  const report = {
    reportId: filename.replace(".json", ""),
    collectedAt: now.toISOString(),
    collectedAtLocal: now.toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "medium"
    }),
    server: {
      clientIP: clientIP(req),
      userAgent: req.headers["user-agent"] || null,
      acceptLanguage: req.headers["accept-language"] || null,
      referer: req.headers["referer"] || null,
      secChUa: req.headers["sec-ch-ua"] || null,
      secChUaMobile: req.headers["sec-ch-ua-mobile"] || null,
      secChUaPlatform: req.headers["sec-ch-ua-platform"] || null
    },
    device: req.body || {}
  };

  fs.writeFileSync(
    path.join(REPORT_DIR, filename),
    JSON.stringify(report, null, 2),
    "utf8"
  );

  res.json({
    ok: true,
    reportId: report.reportId,
    filename,
    collectedAt: report.collectedAtLocal
  });
});

app.get("/api/reports", (req, res) => {
  const files = fs.readdirSync(REPORT_DIR)
    .filter(f => f.endsWith(".json"))
    .map(filename => {
      const full = path.join(REPORT_DIR, filename);
      const stat = fs.statSync(full);
      return {
        filename,
        createdAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString()
      };
    })
    .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));

  res.json(files);
});

app.get("/api/reports/:filename", (req, res) => {
  const filename = path.basename(req.params.filename);
  if (!filename.endsWith(".json")) return res.status(400).json({error:"Invalid report"});
  const full = path.join(REPORT_DIR, filename);
  if (!fs.existsSync(full)) return res.status(404).json({error:"Report not found"});
  res.sendFile(full);
});

app.listen(PORT, () => {
  console.log(`Deep Device Reports running on port ${PORT}`);
});
