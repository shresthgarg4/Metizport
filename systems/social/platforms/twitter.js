const axios = require("axios");
const xml2js = require("xml2js");

const INSTANCES = [
  "https://nitter.net",
  "https://nitter.poast.org",
  "https://nitter.privacydev.net",
];

function cleanText(html) {
  return html
    .replace(/<br>/g, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n+/g, "\n")
    .trim();
}

function extractImage(html) {
  const match = html.match(/<img src="([^"]+)"/);
  return match ? match[1] : null;
}

async function getLatestTweets(username, limit = 3) {
  for (const base of INSTANCES) {
    try {
      const url = `${base}/${username}/rss`;

      const res = await axios.get(url, {
        timeout: 5000,
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (!res.data.includes("<rss")) continue;

      const parsed = await xml2js.parseStringPromise(res.data);
      if (!parsed?.rss) continue;

      const items = parsed.rss.channel[0].item;

      let tweets = [];

      for (let i = 0; i < items.length && tweets.length < limit; i++) {
        const item = items[i];
        const title = item.title[0];

        let rawHtml = item.description?.[0] || title;

        let text = cleanText(rawHtml);
        text = text.split("—")[0].trim();

        const image = extractImage(rawHtml);

        let type = "post";
        if (title.startsWith("RT by")) type = "retweet";
        else if (title.includes("x.com/i/article")) type = "article";

        const link = item.link[0].replace("nitter.net", "twitter.com");

        const idMatch = link.match(/status\/(\d+)/);
        const id = idMatch ? idMatch[1] : Date.now() + i;

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

  return [];
}

module.exports = { getLatestTweets };
