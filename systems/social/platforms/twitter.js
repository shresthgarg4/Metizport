const axios = require("axios");
const xml2js = require("xml2js");

const INSTANCES = [
  "https://nitter.net",
  "https://nitter.privacydev.net",
  "https://nitter.poast.org",
];

function extractText(item) {
  let html = item.description?.[0] || item.title?.[0] || "";
  if (!html) return "No text content";

  html = html.replace(/<!\[CDATA\[|\]\]>/g, "");

  const firstP = html.match(/<p>(.*?)<\/p>/i);
  let text = firstP ? firstP[1] : html;

  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n+/g, "\n")
    .trim();

  text = text.replace(/https?:\/\/\S+/g, "").trim();

  if (!text || text.length < 3) return "No text content";

  return text;
}

function extractImage(html) {
  if (!html) return null;

  // 🔥 ONLY FIRST IMAGE (main tweet)
  const match = html.match(/<img[^>]+src="([^"]+)"/);
  if (!match) return null;

  let url = match[1];

  // fix encoded links
  if (url.includes("media%2F")) {
    return "https://nitter.net/pic/" + url.split("pic/")[1];
  }

  return url;
}

async function getLatestTweets(username, limit = 5) {
  for (const base of INSTANCES) {
    try {
      const url = `${base}/${username}/rss`;

      const res = await axios.get(url, {
        timeout: 10000,
        headers: { "User-Agent": "Mozilla/5.0" },
      });

      if (!res.data.includes("<rss")) continue;

      const parsed = await xml2js.parseStringPromise(res.data);
      if (!parsed?.rss) continue;

      const items = parsed.rss.channel[0].item;
      const tweets = [];

      for (let i = 0; i < items.length && tweets.length < limit; i++) {
        const item = items[i];
        const title = item.title?.[0] || "";

        if (title.startsWith("Pinned")) continue;

        const rawHtml = item.description?.[0] || item.title?.[0] || "";

        let text = extractText(item);
        const image = extractImage(rawHtml);

        let type = "post";
        if (title.startsWith("RT by")) type = "retweet";
        else if (title.includes("x.com/i/article")) type = "article";

        const link = item.link?.[0]?.replace("nitter.net", "twitter.com");
        if (!link) continue;

        const idMatch = link.match(/status\/(\d+)/);
        const id = idMatch ? idMatch[1] : Date.now() + i;

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
    } catch {
      continue;
    }
  }

  return [];
}

module.exports = { getLatestTweets };
