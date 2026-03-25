// utils/socialCache.js
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "../data/socialCache.json");

function loadCache() {
  try {
    if (!fs.existsSync(file)) return {};
    return JSON.parse(fs.readFileSync(file));
  } catch (e) {
    console.log("❌ Cache load error:", e.message);
    return {};
  }
}

function saveCache(data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log("❌ Cache save error:", e.message);
  }
}

module.exports = { loadCache, saveCache };
