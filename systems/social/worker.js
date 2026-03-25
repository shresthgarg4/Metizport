// systems/social/worker.js

const { getLatestTweets } = require("./platforms/twitter");
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

        const tweets = await getLatestTweets(acc.name, 5);

        for (const tweet of tweets.reverse()) {
          if (cache[tweet.id]) continue;

          cache[tweet.id] = true;

          let color = 0x1da1f2;
          let title = "🐦 New Post";

          if (tweet.type === "retweet") {
            title = "🔁 Retweeted";
            color = 0xf1c40f;
          } else if (tweet.type === "article") {
            title = "📰 New Article";
            color = 0x9b59b6;
          }

          const embed = new EmbedBuilder()
            .setColor(color)
            .setAuthor({
              name: `${tweet.username} on X`,
              iconURL: `https://unavatar.io/twitter/${tweet.username}`,
              url: `https://twitter.com/${tweet.username}`,
            })
            .setTitle(title)
            .setDescription(tweet.text.slice(0, 4000))
            .setURL(tweet.url)
            .setFooter({
              text: "Metizport Social Monitor • #wheregamingmatters",
            })
            .setTimestamp();

          if (tweet.image) embed.setImage(tweet.image);

          await channel.send({ embeds: [embed] });

          console.log("✅ Sent tweet:", tweet.id);

          // 🔥 delay (anti spam)
          await new Promise((r) => setTimeout(r, 1500));
        }
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
