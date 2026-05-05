const fs = require("fs");
const path = require("path");
const os = require("os");

let uploadsDir;

if (process.env.VERCEL) {
  uploadsDir = path.join(os.tmpdir(), "yunpan-uploads");
} else {
  uploadsDir = path.join(__dirname, "..", "..", "uploads");
}

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

module.exports = {
  uploadsDir
};
