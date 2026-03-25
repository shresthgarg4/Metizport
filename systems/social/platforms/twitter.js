// systems/social/platforms/twitter.js

const axios = require("axios");

async function getLatestTweet(username) {
  try {
    const res = await axios.get(`https://nitter.net/${username}`, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      timeout: 5000,
    });

    const html = res.data;

    // 🧠 tweet text extract
    const textMatch = html.match(
      /<div class="tweet-content media-body">(.*?)<\/div>/,
    );

    const linkMatch = html.match(/href="\/${username}\/status\/(\d+)"/);

    if (!textMatch || !linkMatch) {
      console.log("⚠️ Twitter parse failed:", username);
      return null;
    }

    const text = textMatch[1]
      .replace(/<[^>]*>/g, "") // remove HTML
      .trim();

    const id = linkMatch[1];

    return {
      id,
      text: text || "No text found",
      url: `https://twitter.com/${username}/status/${id}`,
    };
  } catch (err) {
    console.log("❌ Twitter fetch failed:", err.message);
    return null;
  }
}

module.exports = { getLatestTweet };
