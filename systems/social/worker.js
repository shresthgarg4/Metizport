const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
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
    } catch {
      console.log(`❌ Channel fetch failed: ${channelData.id}`);
      continue;
    }

    if (!channel) continue;

    const rolePing = channelData.role ? `<@&${channelData.role}>` : "";

    // ================= TWITTER =================
    for (const acc of channelData.twitter || []) {
      try {
        if (!acc.enabled) continue;

        const tweets = await getLatestTweets(acc.name, 5);

        for (const tweet of tweets.reverse()) {
          if (!tweet || !tweet.id) continue;
          if (cache[tweet.id]) continue;

          cache[tweet.id] = true;

          let text = tweet.text || "No text content";
          if (text.length < 3 && tweet.image) {
            text = "📸 Media post";
          }

          let label = "posted a new Tweet";
          let color = 0x1da1f2;

          if (tweet.type === "retweet") {
            label = "retweeted";
            color = 0xf1c40f;
          } else if (tweet.type === "article") {
            label = "posted a new Article";
            color = 0x9b59b6;
          }

          const embed = new EmbedBuilder()
            .setColor(color)
            .setAuthor({
              name: `@${tweet.username}`,
              iconURL: `https://unavatar.io/twitter/${tweet.username}`,
              url: `https://twitter.com/${tweet.username}`,
            })
            .setDescription(
              `✨ **${tweet.username} ${label}**\n\n${text.slice(0, 3500)}`,
            )
            .setURL(tweet.url)
            .setFooter({
              text: "X • Social Monitor",
            })
            .setTimestamp();

          // 🖼️ IMAGE (MAIN ATTRACTION)
          if (tweet.image && tweet.image.startsWith("http")) {
            embed.setImage(tweet.image);
          }

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel("View Tweet 🐦")
              .setStyle(ButtonStyle.Link)
              .setURL(tweet.url),

            new ButtonBuilder()
              .setLabel("Open Profile 👤")
              .setStyle(ButtonStyle.Link)
              .setURL(`https://twitter.com/${tweet.username}`),
          );

          await channel.send({
            content: rolePing,
            embeds: [embed],
            components: [row],
          });

          console.log(`✅ Sent tweet: ${tweet.id}`);

          await new Promise((r) => setTimeout(r, 1200));
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

        if (!lastId) {
          cache[cacheKey] = post.id;
          continue;
        }

        if (post.id === lastId) continue;

        const embed = new EmbedBuilder()
          .setColor(0xe1306c)
          .setAuthor({
            name: `@${acc.name}`,
            iconURL: `https://unavatar.io/instagram/${acc.name}`,
          })
          .setDescription(
            `📸 **${acc.name} posted on Instagram**\n\n${post.caption || "New post"}`,
          )
          .setURL(post.url)
          .setFooter({ text: "Instagram • Social Monitor" })
          .setTimestamp();

        await channel.send({
          content: rolePing,
          embeds: [embed],
        });

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

        if (live && cache[cacheKey]) continue;

        if (live && !cache[cacheKey]) {
          const embed = new EmbedBuilder()
            .setColor(0x9146ff)
            .setAuthor({
              name: acc.name,
              iconURL: `https://unavatar.io/twitch/${acc.name}`,
            })
            .setDescription(
              `🟣 **${acc.name} is LIVE now!**\n\nClick below to watch 🔥`,
            )
            .setURL(`https://twitch.tv/${acc.name}`)
            .setFooter({ text: "Twitch • Live Alert" })
            .setTimestamp();

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setLabel("Watch Stream 🔴")
              .setStyle(ButtonStyle.Link)
              .setURL(`https://twitch.tv/${acc.name}`),
          );
          await channel.send({
            content: rolePing,
            embeds: [embed],
            components: [row],
          });

          cache[cacheKey] = true;
        }

        if (!live && cache[cacheKey]) {
          cache[cacheKey] = false;
        }
      } catch (err) {
        console.log(`❌ Twitch error (${acc.name}):`, err.message);
      }
    }
  }

  saveCache(cache);
}

module.exports = { process };
