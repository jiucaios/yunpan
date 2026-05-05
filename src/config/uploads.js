const fs = require("fs");
const path = require("path");
const os = require("os");
const { isVercel } = require("../lib/env-utils");

let uploadsDir = path.join(os.tmpdir(), "yunpan-uploads");

try {
  if (isVercel()) {
    uploadsDir = path.join(os.tmpdir(), "yunpan-uploads");
  } else {
    uploadsDir = path.join(__dirname, "..", "..", "uploads");
  }
} catch (error) {
  console.error("Error determining uploads directory:", error);
}

if (!uploadsDir || typeof uploadsDir !== "string") {
  uploadsDir = path.join(os.tmpdir(), "yunpan-uploads");
}

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (error) {
  console.error("Error creating uploads directory:", error);
  uploadsDir = path.join(os.tmpdir(), "yunpan-fallback-uploads");
  
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (fallbackError) {
    console.error("Failed to create fallback uploads directory:", fallbackError);
  }
}

module.exports = {
  uploadsDir: uploadsDir
};
