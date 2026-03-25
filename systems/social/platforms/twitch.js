// systems/social/platforms/twitch.js
const axios = require("axios");

async function isLive(username) {
  try {
    const res = await axios.get(`https://decapi.me/twitch/uptime/${username}`);

    return !res.data.includes("offline");
  } catch {
    return false;
  }
}

module.exports = { isLive };
