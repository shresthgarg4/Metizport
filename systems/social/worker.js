// systems/social/worker.js

const { getLatestTweet } = require("./platforms/twitter");
const { isLive } = require("./platforms/twitch");
const { getLatestPost } = require("./platforms/instagram");
const { loadCache, saveCache } = require("../../utils/socialCache");

async function process(client, config) {
  const cache = loadCache();

  for (const key of Object.keys(config.channels)) {
    const channelData = config.channels[key];

    let channel;
    try {
      channel = await client.channels.fetch(channelData.id);
    } catch (err) {
      console.log(`❌ Channel fetch failed: ${channelData.id}`);
      continue;
    }

    if (!channel) continue;

    // ================= TWITTER =================
    for (const acc of channelData.twitter || []) {
      try {
        if (!acc.enabled) continue;

        const tweet = await getLatestTweet(acc.name);
        if (!tweet || !tweet.id) continue;

        const cacheKey = `twitter-${acc.name}`;
        const lastId = cache[cacheKey];

        // FIRST TIME → just save
        if (!lastId) {
          cache[cacheKey] = tweet.id;
          console.log(`🧠 Saved initial tweet for ${acc.name}`);
          continue;
        }

        // SAME → skip
        if (tweet.id === lastId) continue;

        // NEW → send
        await channel.send(
          `🐦 **${acc.name} tweeted:**\n${tweet.text}\n${tweet.url}`,
        );

        console.log(`✅ New tweet sent: ${acc.name}`);

        // UPDATE CACHE
        cache[cacheKey] = tweet.id;
      } catch (err) {
        console.log(`❌ Twitter error (${acc.name}):`, err.message);
      }
    }

    // ================= INSTAGRAM =================
    for (const acc of channelData.instagram || []) {
      try {
        if (!acc.enabled) continue;

        const post = await getLatestPost(acc.name);
        if (!post || !post.id) continue;

        const cacheKey = `instagram-${acc.name}`;
        const lastId = cache[cacheKey];

        // FIRST TIME
        if (!lastId) {
          cache[cacheKey] = post.id;
          console.log(`🧠 Saved initial insta post for ${acc.name}`);
          continue;
        }

        if (post.id === lastId) continue;

        await channel.send(
          `📸 **${acc.name} posted:**\n${post.caption}\n${post.url}`,
        );

        console.log(`✅ New insta post: ${acc.name}`);

        cache[cacheKey] = post.id;
      } catch (err) {
        console.log(`❌ Instagram error (${acc.name}):`, err.message);
      }
    }

    // ================= TWITCH =================
    for (const acc of channelData.twitch || []) {
      try {
        if (!acc.enabled) continue;

        const live = await isLive(acc.name);
        const cacheKey = `twitch-${acc.name}`;

        // already live → skip
        if (live && cache[cacheKey]) continue;

        // went live
        if (live && !cache[cacheKey]) {
          await channel.send(
            `🟣 **${acc.name} is LIVE!**\nhttps://twitch.tv/${acc.name}`,
          );

          console.log(`🔴 Live detected: ${acc.name}`);

          cache[cacheKey] = true;
        }

        // went offline → reset
        if (!live && cache[cacheKey]) {
          cache[cacheKey] = false;
          console.log(`⚫ Offline reset: ${acc.name}`);
        }
      } catch (err) {
        console.log(`❌ Twitch error (${acc.name}):`, err.message);
      }
    }
  }

  saveCache(cache);
}

module.exports = { process };
