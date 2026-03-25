const {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ComponentType,
} = require("discord.js");
const fs = require("fs").promises;
const path = require("path");
const axios = require("axios"); // Make sure axios is imported for import command

const PING_CONFIG_PATH = path.join(__dirname, "../../data/pingconfig.json");

// ==================== CONFIGURATION ====================
const PLATFORM_STYLES = {
  twitter: {
    color: 0x1da1f2,
    emoji: "🐦",
    name: "Twitter",
    icon: "https://abs.twimg.com/favicons/twitter.ico",
  },
  twitch: {
    color: 0x9146ff,
    emoji: "🟣",
    name: "Twitch",
    icon: "https://www.twitch.tv/favicon.ico",
  },
  instagram: {
    color: 0xe4405f,
    emoji: "📸",
    name: "Instagram",
    icon: "https://www.instagram.com/favicon.ico",
  },
};

const RESPONSE_TIMEOUT = 15000; // 15 seconds for button interactions

// ==================== UTILITY FUNCTIONS ====================

async function loadConfig() {
  try {
    const data = await fs.readFile(PING_CONFIG_PATH, "utf8");
    const config = JSON.parse(data);

    // Validate and repair config structure
    if (!config.channels) config.channels = {};
    if (!config.cache)
      config.cache = { twitter: {}, twitch: {}, instagram: {} };

    // Ensure each channel has proper structure
    for (const [key, channel] of Object.entries(config.channels)) {
      if (!channel.id) channel.id = key;
      if (!channel.twitter) channel.twitter = [];
      if (!channel.twitch) channel.twitch = [];
      if (!channel.instagram) channel.instagram = [];
      if (!channel.role) channel.role = null;

      // Ensure each account has enabled property
      for (const platform of ["twitter", "twitch", "instagram"]) {
        if (channel[platform]) {
          channel[platform] = channel[platform].map((acc) => ({
            name: acc.name,
            enabled: acc.enabled !== undefined ? acc.enabled : true,
          }));
        }
      }
    }

    return config;
  } catch (err) {
    if (err.code === "ENOENT") {
      const defaultConfig = {
        channels: {},
        cache: { twitter: {}, twitch: {}, instagram: {} },
      };
      await saveConfig(defaultConfig);
      return defaultConfig;
    }
    console.error("Error loading config:", err);
    return { channels: {}, cache: { twitter: {}, twitch: {}, instagram: {} } };
  }
}

async function saveConfig(config) {
  try {
    await fs.writeFile(PING_CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch (err) {
    console.error("Error saving config:", err);
    throw new Error("Failed to save configuration");
  }
}

function findAccount(config, platform, username) {
  const results = [];
  for (const [channelId, channelConfig] of Object.entries(config.channels)) {
    if (channelConfig[platform]) {
      const accountIndex = channelConfig[platform].findIndex(
        (a) => a.name.toLowerCase() === username.toLowerCase(),
      );
      if (accountIndex !== -1) {
        results.push({
          account: channelConfig[platform][accountIndex],
          accountIndex,
          channelConfig,
          channelId,
        });
      }
    }
  }
  return results.length > 0 ? results : null;
}

function formatChannelList(config) {
  return Object.entries(config.channels).map(([name, ch]) => ({
    name: name,
    id: ch.id,
    role: ch.role,
    twitter: ch.twitter?.length || 0,
    twitch: ch.twitch?.length || 0,
    instagram: ch.instagram?.length || 0,
  }));
}

function getPlatformStats(config) {
  const stats = {
    twitter: { total: 0, enabled: 0, disabled: 0 },
    twitch: { total: 0, enabled: 0, disabled: 0 },
    instagram: { total: 0, enabled: 0, disabled: 0 },
  };

  for (const channel of Object.values(config.channels)) {
    for (const platform of ["twitter", "twitch", "instagram"]) {
      if (channel[platform]) {
        for (const acc of channel[platform]) {
          stats[platform].total++;
          if (acc.enabled) stats[platform].enabled++;
          else stats[platform].disabled++;
        }
      }
    }
  }

  return stats;
}

function createErrorEmbed(title, description) {
  return new EmbedBuilder()
    .setTitle(`❌ ${title}`)
    .setDescription(description)
    .setColor(0xff0000)
    .setTimestamp()
    .setFooter({ text: "Metizport Social Monitor • #wheregamingmatters" });
}

function createSuccessEmbed(title, description, color = 0x00ff00) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .setTimestamp()
    .setFooter({ text: "Metizport Social Monitor • #wheregamingmatters" });
}

// ==================== PAGINATION CLASS ====================

class Paginator {
  constructor(items, itemsPerPage = 10) {
    this.items = items;
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 0;
    this.totalPages = Math.ceil(items.length / itemsPerPage);
  }

  getCurrentPage() {
    const start = this.currentPage * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.items.slice(start, end);
  }

  hasNext() {
    return this.currentPage < this.totalPages - 1;
  }

  hasPrev() {
    return this.currentPage > 0;
  }

  next() {
    if (this.hasNext()) this.currentPage++;
  }

  prev() {
    if (this.hasPrev()) this.currentPage--;
  }

  getPageInfo() {
    return `Page ${this.currentPage + 1} of ${this.totalPages}`;
  }
}

// ==================== MAIN COMMAND ====================

module.exports = {
  data: new SlashCommandBuilder()
    .setName("social")
    .setDescription("🎮 Manage social media monitors and notifications")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)

    // List command
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("📋 Shows all monitored accounts grouped by platform")
        .addStringOption((opt) =>
          opt
            .setName("platform")
            .setDescription("Filter by platform (optional)")
            .setRequired(false)
            .addChoices(
              { name: "Twitter", value: "twitter" },
              { name: "Twitch", value: "twitch" },
              { name: "Instagram", value: "instagram" },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Filter by channel (optional)")
            .setRequired(false)
            .setAutocomplete(true),
        ),
    )

    // Enable command
    .addSubcommand((sub) =>
      sub
        .setName("enable")
        .setDescription("✅ Enable notifications for an account")
        .addStringOption((opt) =>
          opt
            .setName("platform")
            .setDescription("Platform")
            .setRequired(true)
            .addChoices(
              { name: "Twitter", value: "twitter" },
              { name: "Twitch", value: "twitch" },
              { name: "Instagram", value: "instagram" },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("username")
            .setDescription("Username to enable (case-insensitive)")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )

    // Disable command
    .addSubcommand((sub) =>
      sub
        .setName("disable")
        .setDescription("⛔ Disable notifications for an account")
        .addStringOption((opt) =>
          opt
            .setName("platform")
            .setDescription("Platform")
            .setRequired(true)
            .addChoices(
              { name: "Twitter", value: "twitter" },
              { name: "Twitch", value: "twitch" },
              { name: "Instagram", value: "instagram" },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("username")
            .setDescription("Username to disable (case-insensitive)")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )

    // Role command
    .addSubcommand((sub) =>
      sub
        .setName("role")
        .setDescription("🔔 Set the ping role for social alerts in a channel")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to update")
            .setRequired(true),
        )
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Role to ping (leave empty to remove)")
            .setRequired(false),
        ),
    )

    // Check command
    .addSubcommand((sub) =>
      sub
        .setName("check")
        .setDescription("🔎 Manually trigger a check for all platforms")
        .addStringOption((opt) =>
          opt
            .setName("platform")
            .setDescription("Specific platform to check (optional)")
            .setRequired(false)
            .addChoices(
              { name: "Twitter", value: "twitter" },
              { name: "Twitch", value: "twitch" },
              { name: "Instagram", value: "instagram" },
              { name: "All", value: "all" },
            ),
        ),
    )

    // Restart command
    .addSubcommand((sub) =>
      sub
        .setName("restart")
        .setDescription("🔄 Restart the social media monitor"),
    )

    // Status command
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("📊 Show detailed system status and statistics"),
    )

    // Test command
    .addSubcommand((sub) =>
      sub
        .setName("test")
        .setDescription("🧪 Send a test notification")
        .addStringOption((opt) =>
          opt
            .setName("platform")
            .setDescription("Platform to test")
            .setRequired(true)
            .addChoices(
              { name: "Twitter", value: "twitter" },
              { name: "Twitch", value: "twitch" },
              { name: "Instagram", value: "instagram" },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("username")
            .setDescription("Username for test")
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to send test (defaults to current)")
            .setRequired(false),
        ),
    )

    // Export command
    .addSubcommand((sub) =>
      sub
        .setName("export")
        .setDescription("📤 Export monitor configuration as JSON"),
    )

    // Import command
    .addSubcommand((sub) =>
      sub
        .setName("import")
        .setDescription("📥 Import monitor configuration from JSON")
        .addAttachmentOption((opt) =>
          opt
            .setName("file")
            .setDescription("JSON configuration file")
            .setRequired(true),
        ),
    )

    // Stats command
    .addSubcommand((sub) =>
      sub
        .setName("stats")
        .setDescription("📈 Show detailed platform statistics"),
    )

    // ==================== NEW LAST COMMAND ====================
    .addSubcommand((sub) =>
      sub
        .setName("last")
        .setDescription("🔍 Fetch the last post from a social media account")
        .addStringOption((opt) =>
          opt
            .setName("platform")
            .setDescription("Platform to fetch from")
            .setRequired(true)
            .addChoices(
              { name: "Twitter", value: "twitter" },
              { name: "Twitch", value: "twitch" },
              { name: "Instagram", value: "instagram" },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("username")
            .setDescription("Username to fetch")
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel to send the post (defaults to current)")
            .setRequired(false),
        ),
    )

    // Help command
    .addSubcommand((sub) =>
      sub
        .setName("help")
        .setDescription("📖 Show all social monitor commands with examples"),
    ),

  // Autocomplete handler
  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const config = await loadConfig();

    if (focusedOption.name === "username") {
      const platform = interaction.options.getString("platform");
      if (!platform) return [];

      const usernames = new Set();
      for (const channel of Object.values(config.channels)) {
        if (channel[platform]) {
          channel[platform].forEach((acc) => usernames.add(acc.name));
        }
      }

      const filtered = Array.from(usernames)
        .filter((name) =>
          name.toLowerCase().includes(focusedOption.value.toLowerCase()),
        )
        .slice(0, 25)
        .map((name) => ({ name, value: name }));

      await interaction.respond(filtered);
    }

    if (focusedOption.name === "channel") {
      const channels = Object.keys(config.channels)
        .filter((name) =>
          name.toLowerCase().includes(focusedOption.value.toLowerCase()),
        )
        .slice(0, 25)
        .map((name) => ({ name, value: name }));

      await interaction.respond(channels);
    }
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const config = await loadConfig();

    try {
      // ==================== LIST COMMAND ====================
      if (subcommand === "list") {
        const platformFilter = interaction.options.getString("platform");
        const channelFilter = interaction.options.getString("channel");

        const accounts = {
          twitter: new Set(),
          twitch: new Set(),
          instagram: new Set(),
        };

        for (const [channelName, channelConfig] of Object.entries(
          config.channels,
        )) {
          if (channelFilter && channelName !== channelFilter) continue;

          if (channelConfig.twitter) {
            channelConfig.twitter.forEach((acc) => {
              if (!platformFilter || platformFilter === "twitter") {
                accounts.twitter.add(
                  `${acc.name} ${acc.enabled ? "✅" : "❌"} (${channelName})`,
                );
              }
            });
          }
          if (channelConfig.twitch) {
            channelConfig.twitch.forEach((acc) => {
              if (!platformFilter || platformFilter === "twitch") {
                accounts.twitch.add(
                  `${acc.name} ${acc.enabled ? "✅" : "❌"} (${channelName})`,
                );
              }
            });
          }
          if (channelConfig.instagram) {
            channelConfig.instagram.forEach((acc) => {
              if (!platformFilter || platformFilter === "instagram") {
                accounts.instagram.add(
                  `${acc.name} ${acc.enabled ? "✅" : "❌"} (${channelName})`,
                );
              }
            });
          }
        }

        const embed = new EmbedBuilder()
          .setTitle("🌐 Social Monitor Overview")
          .setColor(0xffffff)
          .setTimestamp()
          .setFooter({
            text: `Requested by ${interaction.user.tag} • #wheregamingmatters`,
            iconURL: interaction.user.displayAvatarURL(),
          });

        let description = "";
        const platforms = platformFilter
          ? [platformFilter]
          : ["twitter", "twitch", "instagram"];

        for (const platform of platforms) {
          const style = PLATFORM_STYLES[platform];
          const platformAccounts = accounts[platform];

          if (platformAccounts.size > 0) {
            description += `**${style.emoji} ${style.name}** (${platformAccounts.size})\n`;
            description +=
              Array.from(platformAccounts)
                .map((u) => `• ${u}`)
                .join("\n") + "\n\n";
          } else if (!platformFilter) {
            description += `**${style.emoji} ${style.name}**\n• No accounts\n\n`;
          }
        }

        if (!description) {
          description = "No accounts match your filters.";
        }

        embed.setDescription(description);

        // Add summary stats
        const total =
          accounts.twitter.size +
          accounts.twitch.size +
          accounts.instagram.size;
        embed.addFields({
          name: "📊 Summary",
          value: `Total Monitored Accounts: **${total}**`,
          inline: false,
        });

        return interaction.reply({ embeds: [embed] });
      }

      // ==================== ENABLE/DISABLE COMMANDS ====================
      if (subcommand === "enable" || subcommand === "disable") {
        const platform = interaction.options.getString("platform");
        const username = interaction.options.getString("username");
        const enabled = subcommand === "enable";

        const results = findAccount(config, platform, username);

        if (!results || results.length === 0) {
          return interaction.reply({
            embeds: [
              createErrorEmbed(
                "Account Not Found",
                `Could not find **${username}** in the ${PLATFORM_STYLES[platform].name} list.`,
              ),
            ],
            flags: 64,
          });
        }

        // Update all matching accounts
        results.forEach((result) => {
          result.account.enabled = enabled;
        });

        await saveConfig(config);

        const embed = createSuccessEmbed(
          enabled ? "✅ Notifications Enabled" : "⛔ Notifications Disabled",
          `Notifications for **${username}** on ${PLATFORM_STYLES[platform].name} have been ${enabled ? "enabled" : "disabled"}.`,
          PLATFORM_STYLES[platform].color,
        );

        if (results.length > 1) {
          embed.addFields({
            name: "Updated Channels",
            value: results.map((r) => `<#${r.channelConfig.id}>`).join("\n"),
            inline: false,
          });
        }

        return interaction.reply({ embeds: [embed] });
      }

      // ==================== ROLE COMMAND ====================
      if (subcommand === "role") {
        const channel = interaction.options.getChannel("channel");
        const role = interaction.options.getRole("role");

        let foundChannel = null;
        let channelKey = null;

        for (const [key, chConfig] of Object.entries(config.channels)) {
          if (chConfig.id === channel.id) {
            foundChannel = chConfig;
            channelKey = key;
            break;
          }
        }

        if (!foundChannel) {
          return interaction.reply({
            embeds: [
              createErrorEmbed(
                "Channel Not Found",
                `Channel ${channel} is not configured for social monitoring. Use \`/social add\` first.`,
              ),
            ],
          });
        }

        foundChannel.role = role?.id || null;
        await saveConfig(config);

        const embed = createSuccessEmbed(
          "🔔 Notification Role Updated",
          `Role for social alerts in ${channel} set to ${role || "none"}`,
          0xffffff,
        );

        return interaction.reply({ embeds: [embed] });
      }

      // ==================== CHECK COMMAND ====================
      if (subcommand === "check") {
        // ✅ Better null check
        if (!socialMonitor) {
          console.log(
            "\x1b[31m❌ socialMonitor is NULL in check command\x1b[0m",
          );
          return interaction.reply({
            embeds: [
              createErrorEmbed(
                "Monitor Not Running",
                "Social monitor is not initialized. Try restarting the bot.",
              ),
            ],
          });
        }

        if (!socialMonitor.isRunning) {
          console.log("\x1b[33m⚠️ socialMonitor.isRunning = false\x1b[0m");
          return interaction.reply({
            embeds: [
              createErrorEmbed(
                "Monitor Not Running",
                "Social monitor is stopped. Use `/social restart` to start it.",
              ),
            ],
          });
        }

        const platform = interaction.options.getString("platform") || "all";
        await interaction.deferReply();

        try {
          const results = [];

          // ✅ Use checkPlatform method instead of direct monitor access
          if (platform === "all" || platform === "twitter") {
            await socialMonitor.checkPlatform("twitter");
            results.push("✅ Twitter");
          }
          if (platform === "all" || platform === "twitch") {
            await socialMonitor.checkPlatform("twitch");
            results.push("✅ Twitch");
          }
          if (platform === "all" || platform === "instagram") {
            await socialMonitor.checkPlatform("instagram");
            results.push("✅ Instagram");
          }

          const embed = createSuccessEmbed(
            "🔎 Manual Check Completed",
            `Checked: ${results.join(", ") || "No platforms checked"}`,
            0xffffff,
          );
          await interaction.editReply({ embeds: [embed] });
        } catch (error) {
          console.error("❌ Check command error:", error);
          await interaction.editReply({
            embeds: [
              createErrorEmbed("Check Failed", `Error: ${error.message}`),
            ],
          });
        }
      }

      // ==================== RESTART COMMAND ====================
      if (subcommand === "restart") {
        if (!socialMonitor) {
          return interaction.reply({
            embeds: [
              createErrorEmbed(
                "Monitor Not Running",
                "Social monitor is not initialized.",
              ),
            ],
          });
        }

        await interaction.deferReply();

        try {
          await socialMonitor.stop();
          await socialMonitor.start();

          const embed = createSuccessEmbed(
            "🔄 Monitor Restarted",
            "All monitoring tasks have been restarted successfully.",
            0xffffff,
          );

          await interaction.editReply({ embeds: [embed] });
        } catch (error) {
          await interaction.editReply({
            embeds: [
              createErrorEmbed("Restart Failed", `Error: ${error.message}`),
            ],
          });
        }
      }

      // ==================== STATUS COMMAND ====================
      if (subcommand === "status") {
        const stats = getPlatformStats(config);
        const channelList = formatChannelList(config);
        const monitorStats = socialMonitor?.getRateLimitStats?.() || null;

        const embed = new EmbedBuilder()
          .setTitle("📊 Social Monitor Status")
          .setColor(0xffffff)
          .addFields(
            {
              name: "📈 Platform Statistics",
              value:
                `🐦 Twitter: ${stats.twitter.enabled} active / ${stats.twitter.disabled} paused\n` +
                `🟣 Twitch: ${stats.twitch.enabled} active / ${stats.twitch.disabled} paused\n` +
                `📸 Instagram: ${stats.instagram.enabled} active / ${stats.instagram.disabled} paused`,
              inline: false,
            },
            {
              name: "📋 Configured Channels",
              value:
                channelList.length > 0
                  ? channelList
                      .map(
                        (c) =>
                          `<#${c.id}> (${c.twitter}+${c.twitch}+${c.instagram} accounts)`,
                      )
                      .join("\n")
                  : "No channels configured",
              inline: false,
            },
            {
              name: "💾 Cache Status",
              value:
                `Twitter: ${Object.keys(config.cache?.twitter || {}).length} entries\n` +
                `Twitch: ${Object.keys(config.cache?.twitch || {}).length} entries\n` +
                `Instagram: ${Object.keys(config.cache?.instagram || {}).length} entries`,
              inline: true,
            },
            {
              name: "🔄 Monitor State",
              value: socialMonitor?.isRunning ? "🟢 Active" : "🔴 Stopped",
              inline: true,
            },
          )
          .setTimestamp()
          .setFooter({
            text: `System Uptime: ${monitorStats?.uptime || 0} minutes • #wheregamingmatters`,
          });

        if (monitorStats) {
          embed.addFields({
            name: "⏱️ Rate Limits",
            value:
              `Twitter: ${monitorStats.twitter.remaining}/${monitorStats.twitter.total} req\n` +
              `Twitch: ${monitorStats.twitch.remaining}/${monitorStats.twitch.total} req\n` +
              `Instagram: ${monitorStats.instagram.remaining}/${monitorStats.instagram.total} req`,
            inline: false,
          });
        }

        return interaction.reply({ embeds: [embed] });
      }

      // ==================== STATS COMMAND ====================
      if (subcommand === "stats") {
        const stats = getPlatformStats(config);
        const monitorStats = socialMonitor?.getRateLimitStats?.();

        const embed = new EmbedBuilder()
          .setTitle("📈 Platform Performance Statistics")
          .setColor(0xffffff)
          .setTimestamp()
          .setFooter({ text: "Metizport Analytics • #wheregamingmatters" });

        for (const [platform, style] of Object.entries(PLATFORM_STYLES)) {
          const platformStats = stats[platform];
          const rateStats = monitorStats?.[platform];

          let value = `Total: ${platformStats.total} accounts\n`;
          value += `Active: ${platformStats.enabled}\n`;
          value += `Paused: ${platformStats.disabled}\n`;

          if (rateStats) {
            value += `\n**Rate Limits**\n`;
            value += `Remaining: ${rateStats.remaining}/${rateStats.total}\n`;
            value += `Reset in: ${rateStats.resetIn}s\n`;
            value += `Throttled: ${rateStats.throttledCount || 0} times`;
          }

          embed.addFields({
            name: `${style.emoji} ${style.name}`,
            value: value,
            inline: true,
          });
        }

        if (monitorStats?.postsSent) {
          embed.addFields({
            name: "📤 Posts Sent",
            value:
              `Twitter: ${monitorStats.postsSent.twitter || 0}\n` +
              `Twitch: ${monitorStats.postsSent.twitch || 0}\n` +
              `Instagram: ${monitorStats.postsSent.instagram || 0}`,
            inline: false,
          });
        }

        return interaction.reply({ embeds: [embed] });
      }

      // ==================== TEST COMMAND ====================
      if (subcommand === "test") {
        const platform = interaction.options.getString("platform");
        const username = interaction.options.getString("username");
        const targetChannel =
          interaction.options.getChannel("channel") || interaction.channel;
        const style = PLATFORM_STYLES[platform];

        const embed = new EmbedBuilder()
          .setColor(style.color)
          .setAuthor({
            name:
              platform === "twitter"
                ? `@${username} on X`
                : platform === "twitch"
                  ? `${username} is LIVE on Twitch!`
                  : `@${username} on Instagram`,
            iconURL: style.icon,
            url:
              platform === "twitter"
                ? `https://twitter.com/${username}`
                : platform === "twitch"
                  ? `https://twitch.tv/${username}`
                  : `https://instagram.com/${username}`,
          })
          .setFooter({
            text: "Metizport Social Monitor • TEST NOTIFICATION • #wheregamingmatters",
          })
          .setTimestamp();

        if (platform === "twitter") {
          embed.setDescription(
            "This is a **test tweet** notification.\n\n" +
              "Lorem ipsum dolor sit amet, consectetur adipiscing elit. #Metizport #CS2",
          );
          embed.setImage("https://picsum.photos/400/200");
        } else if (platform === "twitch") {
          embed.setTitle("🔴 Test Stream: Road to Global Elite");
          embed.setURL(`https://twitch.tv/${username}`);
          embed.setDescription(
            "**Game:** Counter-Strike 2\n**Viewers:** 1,337",
          );
          embed.setImage(
            `https://static-cdn.jtvnw.net/previews-ttv/live_user_${username}-440x248.jpg`,
          );
        } else if (platform === "instagram") {
          embed.setDescription(
            "📸 **Test Instagram Post**\n\n" +
              "Check out this amazing content! #gaming #esports #Metizport",
          );
          embed.setImage("https://picsum.photos/400/400");
        }

        await targetChannel.send({ embeds: [embed] });

        const successEmbed = createSuccessEmbed(
          "🧪 Test Notification Sent",
          `Test ${style.name} notification sent to ${targetChannel}`,
          style.color,
        );

        return interaction.reply({ embeds: [successEmbed], flags: 64 });
      }

      // ==================== NEW LAST COMMAND ====================
      if (subcommand === "last") {
        const platform = interaction.options.getString("platform");
        const username = interaction.options.getString("username");
        const targetChannel =
          interaction.options.getChannel("channel") || interaction.channel;
        const style = PLATFORM_STYLES[platform];

        await interaction.deferReply({ flags: 64 });

        try {
          // Import the monitor classes
          const SocialMonitors = require("../../systems/SocialMonitor");

          let content = null;
          let errorDetails = "";

          if (platform === "twitter") {
            console.log(`🔍 Fetching last tweet from @${username}...`);

            // Try multiple times with different methods
            const twitterMonitor = new SocialMonitors.FreeTwitterMonitor();

            // Try up to 3 times with delay
            for (let attempt = 1; attempt <= 3; attempt++) {
              console.log(`  Attempt ${attempt}...`);
              content = await twitterMonitor.getLatestTweet(username);

              if (content) {
                console.log(`✅ Found on attempt ${attempt}`);

                // 🔴 YEH 3 LINES ADD KARO - TEXT FIELD ENSURE KARNE KE LIYE
                if (!content.text) {
                  content.text =
                    content.full_text || "Tweet content not available";
                  console.log(
                    `📝 Text field fixed: "${content.text.substring(0, 50)}..."`,
                  );
                }

                break;
              }

              if (attempt < 3) {
                await new Promise((resolve) => setTimeout(resolve, 2000));
              }
            }

            if (!content) {
              errorDetails =
                "Twitter API might be rate limited or down. Try again later.";
            }
          } else if (platform === "twitch") {
            console.log(`🔍 Fetching last stream from ${username}...`);
            const twitchMonitor = new SocialMonitors.FreeTwitchMonitor();
            const stream = await twitchMonitor.getStreamStatus(username);

            if (stream) {
              content = {
                id: stream.id,
                title: stream.title,
                game_name: stream.game_name,
                viewer_count: stream.viewer_count,
                started_at: stream.started_at,
                thumbnail_url: stream.thumbnail_url,
                url: stream.url,
                profile_image: stream.profile_image,
              };
            } else {
              errorDetails =
                "User is not currently live or Twitch API is rate limited.";
            }
          } else if (platform === "instagram") {
            console.log(`🔍 Fetching last Instagram post from @${username}...`);
            const instagramMonitor = new SocialMonitors.FreeInstagramMonitor();
            content = await instagramMonitor.getLatestPost(username);

            if (!content) {
              errorDetails =
                "Instagram is rate limiting (429 error). Try again later.";
            }
          }

          if (!content) {
            // Create a more helpful error message
            const errorEmbed = new EmbedBuilder()
              .setTitle("❌ No Content Found")
              .setDescription(
                `Could not fetch any recent post from **${username}** on ${style.name}.\n\n` +
                  `**Possible reasons:**\n` +
                  `• Account may be private\n` +
                  `• API rate limiting (try again in 15 minutes)\n` +
                  `• No recent posts available\n\n` +
                  `${errorDetails ? `**Details:** ${errorDetails}` : ""}`,
              )
              .setColor(0xffaa00)
              .setTimestamp()
              .setFooter({
                text: "Metizport Social Monitor • #wheregamingmatters",
              });

            return interaction.editReply({ embeds: [errorEmbed] });
          }

          // Create embed based on platform
          const embed = new EmbedBuilder()
            .setColor(style.color)
            .setAuthor({
              name:
                platform === "twitter"
                  ? `@${username} on X`
                  : platform === "twitch"
                    ? `${username} is LIVE on Twitch!`
                    : `@${username} on Instagram`,
              iconURL: content.profile_image || style.icon,
              url:
                platform === "twitter"
                  ? `https://twitter.com/${username}`
                  : platform === "twitch"
                    ? `https://twitch.tv/${username}`
                    : `https://instagram.com/${username}`,
            })
            .setURL(content.url)
            .setTimestamp(
              new Date(
                content.created_at ||
                  content.taken_at ||
                  content.started_at ||
                  Date.now(),
              ),
            )
            .setFooter({
              text: `Metizport Social Monitor • Last ${style.name} Post • #wheregamingmatters`,
            });

          if (platform === "twitter") {
            embed.setDescription(
              content.text?.substring(0, 2000) || "No text content",
            );
            if (content.media?.length) embed.setImage(content.media[0]);
          } else if (platform === "twitch") {
            embed.setTitle(content.title?.substring(0, 256) || "Live Stream");
            embed.setDescription(
              `**Game:** ${content.game_name}\n**Viewers:** ${content.viewer_count}`,
            );
            embed.setImage(content.thumbnail_url);
          } else if (platform === "instagram") {
            embed.setDescription(
              content.caption?.substring(0, 2000) || "Instagram post",
            );
            if (content.media_url) embed.setImage(content.media_url);
          }

          await targetChannel.send({ embeds: [embed] });

          const successEmbed = createSuccessEmbed(
            "✅ Last Post Fetched",
            `Successfully fetched the last ${style.name} post from **${username}**`,
            style.color,
          );

          await interaction.editReply({ embeds: [successEmbed] });
        } catch (error) {
          console.error(`Error in /social last:`, error);
          await interaction.editReply({
            embeds: [
              createErrorEmbed(
                "Fetch Failed",
                `Error fetching post: ${error.message}\n\nTwitter API might be temporarily unavailable. Try again in a few minutes.`,
              ),
            ],
          });
        }
      }

      // ==================== EXPORT COMMAND ====================
      if (subcommand === "export") {
        const exportData = {
          version: "1.0",
          exportedAt: new Date().toISOString(),
          exportedBy: interaction.user.tag,
          channels: config.channels,
        };

        const jsonString = JSON.stringify(exportData, null, 2);
        const buffer = Buffer.from(jsonString, "utf-8");

        await interaction.reply({
          content: "📤 Here's your monitor configuration:",
          files: [
            {
              attachment: buffer,
              name: `social_config_${Date.now()}.json`,
            },
          ],
          flags: 64,
        });
      }

      // ==================== IMPORT COMMAND ====================
      if (subcommand === "import") {
        const file = interaction.options.getAttachment("file");

        if (!file.name.endsWith(".json")) {
          return interaction.reply({
            embeds: [
              createErrorEmbed(
                "Invalid File",
                "Please upload a valid JSON file.",
              ),
            ],
          });
        }

        await interaction.deferReply({ flags: 64 });

        try {
          const response = await axios.get(file.url);
          const importData = response.data;

          // Validate import data
          if (!importData.channels || typeof importData.channels !== "object") {
            throw new Error("Invalid configuration format");
          }

          // Confirm with user
          const confirmEmbed = new EmbedBuilder()
            .setTitle("⚠️ Confirm Import")
            .setDescription(
              "This will **replace** your current configuration.\n" +
                `Current: ${Object.keys(config.channels).length} channels\n` +
                `Import: ${Object.keys(importData.channels).length} channels\n\n` +
                "Are you sure?",
            )
            .setColor(0xffaa00);

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("confirm_import")
              .setLabel("✅ Confirm Import")
              .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
              .setCustomId("cancel_import")
              .setLabel("❌ Cancel")
              .setStyle(ButtonStyle.Secondary),
          );

          const response_msg = await interaction.editReply({
            embeds: [confirmEmbed],
            components: [row],
          });

          const collector = response_msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: RESPONSE_TIMEOUT,
          });

          collector.on("collect", async (btnInt) => {
            if (btnInt.customId === "confirm_import") {
              config.channels = importData.channels;
              await saveConfig(config);

              const successEmbed = createSuccessEmbed(
                "✅ Configuration Imported",
                `Successfully imported ${Object.keys(importData.channels).length} channels.`,
                0x00ff00,
              );

              await btnInt.update({ embeds: [successEmbed], components: [] });
            } else {
              await btnInt.update({
                content: "❌ Import cancelled.",
                embeds: [],
                components: [],
              });
            }
          });

          collector.on("end", () => {
            interaction.editReply({ components: [] }).catch(() => {});
          });
        } catch (error) {
          await interaction.editReply({
            embeds: [
              createErrorEmbed("Import Failed", `Error: ${error.message}`),
            ],
          });
        }
      }

      // ==================== HELP COMMAND ====================
      if (subcommand === "help") {
        const embed = new EmbedBuilder()
          .setTitle("📖 Social Monitor Commands")
          .setColor(0xffffff)
          .setDescription(
            "**📋 Account Management**\n" +
              "`/social list [platform] [channel]` - List monitored accounts\n" +
              "`/social enable <platform> <username>` - Enable notifications\n" +
              "`/social disable <platform> <username>` - Disable notifications\n\n" +
              "**🔧 Channel Management**\n" +
              "`/social role <channel> [role]` - Set ping role for channel\n\n" +
              "**🎮 Monitor Control**\n" +
              "`/social check [platform]` - Manual check for updates\n" +
              "`/social restart` - Restart the monitor\n\n" +
              "**📊 Information**\n" +
              "`/social status` - Show system status\n" +
              "`/social stats` - Show platform statistics\n" +
              "`/social test <platform> <username> [channel]` - Send test notification\n" +
              "`/social last <platform> <username> [channel]` - Fetch last post\n\n" +
              "**💾 Backup & Restore**\n" +
              "`/social export` - Export configuration\n" +
              "`/social import` - Import configuration\n\n" +
              "**❓ Help**\n" +
              "`/social help` - Show this message",
          )
          .addFields(
            {
              name: "📝 Examples",
              value:
                "`/social enable twitch ninja`\n" +
                "`/social role #stream-2 @subscribers`\n" +
                "`/social last twitter Metizport`",
              inline: false,
            },
            {
              name: "💡 Tips",
              value:
                "• Use autocomplete for usernames and channels\n" +
                "• Test notifications before enabling\n" +
                "• Export config regularly for backup",
              inline: false,
            },
          )
          .setTimestamp()
          .setFooter({ text: "Metizport Support Tools • #wheregamingmatters" });

        return interaction.reply({ embeds: [embed] });
      }
    } catch (error) {
      console.error(`Error in /social ${subcommand}:`, error);

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          embeds: [
            createErrorEmbed(
              "Command Error",
              `An error occurred: ${error.message}`,
            ),
          ],
          flags: 64,
        });
      } else if (interaction.deferred) {
        await interaction.editReply({
          embeds: [
            createErrorEmbed(
              "Command Error",
              `An error occurred: ${error.message}`,
            ),
          ],
        });
      }
    }
  },
};
