const axios = require("axios");
const xml2js = require("xml2js");

const INSTANCES = [
  "https://nitter.net",
  "https://nitter.poast.org",
  "https://nitter.privacydev.net",
];

async function getLatestTweet(username) {
  for (const base of INSTANCES) {
    try {
      const url = `${base}/${username}/rss`;

      console.log(`🔍 Trying: ${url}`);

      const res = await axios.get(url, {
        timeout: 5000,
        headers: {
          "User-Agent": "Mozilla/5.0",
        },
      });

      console.log(`📡 Status: ${res.status}`);

      // 🧠 Check response type
      if (!res.data.includes("<rss")) {
        console.log("⚠️ Not RSS, probably blocked or HTML page");
        continue;
      }

      console.log("✅ RSS detected");

      const parsed = await xml2js.parseStringPromise(res.data);

      if (!parsed || !parsed.rss) {
        console.log("❌ Parsed but no RSS object");
        continue;
      }

      const items = parsed.rss.channel[0].item;

      console.log(`📦 Items found: ${items.length}`);

      let item = items.find((i) => !i.title[0].startsWith("Pinned"));
      if (!item) item = items[0];

      console.log("🧠 Selected tweet:", item.title[0]);

      const title = item.title[0];
      const link = item.link[0];

      const idMatch = link.match(/status\/(\d+)/);
      const id = idMatch ? idMatch[1] : Date.now();

      return {
        id,
        text: title,
        url: link,
      };
    } catch (err) {
      console.log(`❌ ERROR on ${base}:`, err.message);
    }
  }

  console.log(`💀 All sources failed for ${username}`);
  return null;
}

module.exports = { getLatestTweet };
