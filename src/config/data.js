const fs = require("fs");
const path = require("path");
const os = require("os");

let dataDir, imagesDbPath;

if (process.env.VERCEL) {
  // 在Vercel环境中使用临时目录
  dataDir = path.join(os.tmpdir(), "yunpan-data");
  imagesDbPath = path.join(dataDir, "images.json");
  
  // 确保临时目录存在
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  // 如果临时数据库不存在，从项目目录复制一个空的过去
  const localDbPath = path.join(__dirname, "..", "..", "data", "images.json");
  if (!fs.existsSync(imagesDbPath) && fs.existsSync(localDbPath)) {
    try {
      const localData = fs.readFileSync(localDbPath, "utf8");
      fs.writeFileSync(imagesDbPath, localData);
    } catch (err) {
      console.log("Could not copy local db, creating new one");
    }
  }
} else {
  // 本地开发环境
  dataDir = path.join(__dirname, "..", "..", "data");
  imagesDbPath = path.join(dataDir, "images.json");
}

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
