// systems/social/platforms/twitter.js
const axios = require("axios");

async function getLatestTweet(username) {
  try {
    const res = await axios.get(
      `https://cdn.syndication.twimg.com/tweet-result?screen_name=${username}`,
      { timeout: 5000 },
    );

    return {
      id: res.data.id_str,
      text: res.data.text,
      url: `https://twitter.com/${username}/status/${res.data.id_str}`,
    };
  } catch {
    return null;
  }
}

module.exports = { getLatestTweet };
