const fs = require("fs");
const path = require("path");

const dataDir = path.join(__dirname, "..", "..", "data");
const imagesDbPath = path.join(dataDir, "images.json");

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(imagesDbPath)) {
  fs.writeFileSync(imagesDbPath, JSON.stringify({ images: [] }, null, 2));
}

module.exports = {
  dataDir,
  imagesDbPath
};
