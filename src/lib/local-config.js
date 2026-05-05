const fs = require("fs");
const path = require("path");

const configPath = path.join(__dirname, "..", "..", "config.local.json");

function readLocalConfig() {
  if (!fs.existsSync(configPath)) {
    return {};
  }

  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

module.exports = {
  configPath,
  readLocalConfig
};
