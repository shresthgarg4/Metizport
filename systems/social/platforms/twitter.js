// systems/social/platforms/twitter.js

const axios = require("axios");

function extractText(data) {
  return (
    data.text ||
    data.full_text ||
    data.legacy?.full_text ||
    data.legacy?.text ||
    "No text content"
  );
}

async function getLatestTweet(username) {
  try {
    const res = await axios.get(
      `https://cdn.syndication.twimg.com/tweet-result?screen_name=${username}`,
      { timeout: 5000 },
    );

    const text = extractText(res.data);

    return {
      id: res.data.id_str,
      text: text,
      url: `https://twitter.com/${username}/status/${res.data.id_str}`,
    };
  } catch (err) {
    console.log("❌ Twitter fetch failed:", err.message);
    return null;
  }
}

module.exports = { getLatestTweet };
