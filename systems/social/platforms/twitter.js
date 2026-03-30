const axios = require("axios");
const xml2js = require("xml2js");

const INSTANCES = [
  "https://nitter.net",
  "https://nitter.privacydev.net",
  "https://nitter.poast.org",
];

// 🔥 TEXT (TITLE FIRST - FRIEND STYLE)
function extractText(item) {
  const title = item.title?.[0] || "";
  let html = item.description?.[0] || "";

  // ✅ ALWAYS prefer title (main tweet text)
  let text = title;

  if (!text || text.length < 3) {
    html = html.replace(/<!\[CDATA\[|\]\]>/g, "");

    const match = html.match(/<p>(.*?)<\/p>/i);
    text = match ? match[1] : "";

    text = text
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]*>/g, "")
      .replace(/\n+/g, "\n")
      .trim();
  }

  if (!text || text.length < 3) {
    return "📸 Media post";
  }

  return text;
}

// 🔥 IMAGE (FIXED + CLEAN)
function extractImage(html) {
  if (!html) return null;

  // try normal img
  const match = html.match(/<img[^>]+src="([^"]+)"/);
  if (!match) return null;

  let url = match[1];

  // fix encoded media links
  if (url.includes("media%2F")) {
    const part = url.split("media%2F")[1];
    return `https://pbs.twimg.com/media/${part}`;
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

      // 🔥 SORT BY LATEST TWEET ID (CRITICAL FIX)
      items.sort((a, b) => {
        const getId = (item) => {
          const link = item.link?.[0] || "";
          const match = link.match(/status\/(\d+)/);
          return match ? BigInt(match[1]) : 0n;
        };

        return getId(b) - getId(a);
      });

      const tweets = [];

      for (let i = 0; i < items.length && tweets.length < limit; i++) {
        const item = items[i];
        const title = item.title?.[0] || "";

        // ❌ skip pinned
        if (title.startsWith("Pinned")) continue;

        const rawHtml = item.description?.[0] || "";

        const text = extractText(item);
        const image = extractImage(rawHtml);

        let type = "post";
        if (title.startsWith("RT by")) type = "retweet";
        else if (title.includes("x.com/i/article")) type = "article";

        const rawLink = item.link?.[0]?.replace("nitter.net", "twitter.com");

        const previewLink = rawLink?.replace("twitter.com", "vxtwitter.com");

        if (!link) continue;

        const idMatch = link.match(/status\/(\d+)/);
        const id = idMatch ? idMatch[1] : Date.now() + i;

        tweets.push({
          id,
          text,
          image,
          url: rawLink,
          preview: previewLink,
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
