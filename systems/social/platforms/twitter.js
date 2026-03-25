const axios = require("axios");
const xml2js = require("xml2js");

async function getLatestTweet(username) {
  try {
    const url = `https://nitter.net/${username}/rss`;

    const res = await axios.get(url, { timeout: 5000 });

    const parsed = await xml2js.parseStringPromise(res.data);

    const items = parsed.rss.channel[0].item;

    // 🔥 SKIP PINNED
    let item = items.find((i) => !i.title[0].startsWith("Pinned"));
    if (!item) item = items[0];

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
    console.log("❌ Twitter RSS failed:", err.message);
    return null;
  }
}

module.exports = { getLatestTweet };
