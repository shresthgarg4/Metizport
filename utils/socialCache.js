// utils/socialCache.js
const fs = require("fs");
const path = require("path");

const file = path.join(__dirname, "../data/socialCache.json");

function loadCache() {
  try {
    if (!fs.existsSync(file)) {
      return {
        twitter: {},
        instagram: {},
        twitch: {},
        twitterInit: false,
      };
    }

    const data = JSON.parse(fs.readFileSync(file));

    return {
      twitter: data.twitter || {},
      instagram: data.instagram || {},
      twitch: data.twitch || {},
      twitterInit: data.twitterInit || false,
    };
  } catch (e) {
    console.log("❌ Cache load error:", e.message);
    return {
      twitter: {},
      instagram: {},
      twitch: {},
      twitterInit: false,
    };
  }
}

function saveCache(data) {
  try {
    // 📁 ensure folder exists
    if (!fs.existsSync(path.dirname(file))) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
    }

    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (e) {
    console.log("❌ Cache save error:", e.message);
  }
}

module.exports = { loadCache, saveCache };
