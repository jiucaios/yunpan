const fs = require("fs");
const path = require("path");
const os = require("os");

let dataDir = path.join(os.tmpdir(), "yunpan-data");
let imagesDbPath = path.join(dataDir, "images.json");

try {
  if (process.env.VERCEL) {
    dataDir = path.join(os.tmpdir(), "yunpan-data");
    imagesDbPath = path.join(dataDir, "images.json");
  } else {
    dataDir = path.join(__dirname, "..", "..", "data");
    imagesDbPath = path.join(dataDir, "images.json");
  }
} catch (error) {
  console.error("Error determining data directory:", error);
}

if (!dataDir || typeof dataDir !== "string") {
  dataDir = path.join(os.tmpdir(), "yunpan-data");
}

if (!imagesDbPath || typeof imagesDbPath !== "string") {
  imagesDbPath = path.join(dataDir, "images.json");
}

try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(imagesDbPath)) {
    fs.writeFileSync(imagesDbPath, JSON.stringify({ images: [] }, null, 2));
  }
} catch (error) {
  console.error("Error creating data directory or database:", error);
  imagesDbPath = path.join(os.tmpdir(), "yunpan-fallback", "images.json");
  dataDir = path.dirname(imagesDbPath);
  
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(imagesDbPath)) {
      fs.writeFileSync(imagesDbPath, JSON.stringify({ images: [] }, null, 2));
    }
  } catch (fallbackError) {
    console.error("Failed to create fallback database:", fallbackError);
  }
}

module.exports = {
  dataDir: dataDir,
  imagesDbPath: imagesDbPath
};
