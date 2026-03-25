const axios = require("axios");
const xml2js = require("xml2js");

const INSTANCES = [
  "https://nitter.net",
  "https://nitter.poast.org",
  "https://nitter.privacydev.net",
];

// 🧠 TEXT EXTRACTOR (BULLETPROOF)
function extractText(item) {
  let html = item.description?.[0];

  if (!html || html.trim() === "") {
    html = item.title?.[0] || "";
  }

  if (!html) return "No text content";

  let text = html
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n+/g, "\n")
    .trim();

  if (!text || text.length < 3) {
    return "No text content";
  }

  return text;
}

// 🖼️ IMAGE EXTRACTOR
function extractImage(html) {
  const match = html?.match(/<img src="([^"]+)"/);
  return match ? match[1] : null;
}

// 🚀 MAIN FUNCTION (QUEUE SUPPORT)
async function getLatestTweets(username, limit = 5) {
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

      if (!res.data.includes("<rss")) {
        console.log("⚠️ Not RSS response");
        continue;
      }

      const parsed = await xml2js.parseStringPromise(res.data);

      if (!parsed?.rss) {
        console.log("❌ Invalid RSS structure");
        continue;
      }

      const items = parsed.rss.channel[0].item;

      console.log(`📦 Found ${items.length} items`);

      const tweets = [];

      for (let i = 0; i < items.length && tweets.length < limit; i++) {
        const item = items[i];
        const title = item.title?.[0] || "";

        // ❌ skip pinned only
        if (title.startsWith("Pinned")) continue;

        let text = extractText(item);
        let rawHtml = item.description?.[0] || "";

        // 🖼️ image
        const image = extractImage(rawHtml);

        // 🧠 type detect
        let type = "post";
        if (title.startsWith("RT by")) type = "retweet";
        else if (title.includes("x.com/i/article")) type = "article";

        const link = item.link?.[0]?.replace("nitter.net", "twitter.com");

        if (!link) continue;

        const idMatch = link.match(/status\/(\d+)/);
        const id = idMatch ? idMatch[1] : Date.now() + i;

        // 📸 media fallback
        if (text === "No text content" && image) {
          text = "📸 Media post";
        }

        tweets.push({
          id,
          text,
          image,
          url: link,
          type,
          username,
        });
      }

      return tweets;
    } catch (err) {
      console.log(`❌ ${base} failed:`, err.message);
    }
  }

  console.log(`💀 All Twitter sources failed for ${username}`);
  return [];
}

module.exports = { getLatestTweets };
