const {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder,
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const levelsPath = path.join(__dirname, "../../data/levels.json");
const configPath = path.join(__dirname, "../../data/levelConfig.json");

/*
-------------------------------
XP FORMULA
-------------------------------
*/

function xpRequired(level) {
  return 50 * level * level;
}

/*
-------------------------------
LOAD FILES
-------------------------------
*/

function loadLevels() {
  if (!fs.existsSync(levelsPath)) return {};
  return JSON.parse(fs.readFileSync(levelsPath));
}

function loadConfig() {
  let config = {
    channel: null,
    ignoreRoles: [],
    allowedChannels: [],
    xpChannels: [],
  };

  if (fs.existsSync(configPath)) {
    const file = JSON.parse(fs.readFileSync(configPath));

    config = {
      ...config,
      ...file,
    };
  }

  return config;
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

/*
-----------------------------
PROGRESS BAR
-----------------------------
*/

function progressBar(current, required) {
  const percentage = current / required;

  const size = 16;
  const progress = Math.round(size * percentage);

  const empty = size - progress;

  const bar = "█".repeat(progress) + "░".repeat(empty);

  return bar;
}

/*
-------------------------------
COMMAND DEFINITIONS
-------------------------------
*/

const levelCmd = new SlashCommandBuilder()
  .setName("level")
  .setDescription("Check your level progress");
const levelAddCmd = new SlashCommandBuilder()
  .setName("levela")
  .setDescription("Add a channel where /level command can be used")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .addChannelOption((o) =>
    o.setName("channel").setDescription("Channel to allow").setRequired(true),
  );
const levelRemoveCmd = new SlashCommandBuilder()
  .setName("levelr")
  .setDescription("Remove a channel from allowed level channels")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .addChannelOption((o) =>
    o.setName("channel").setDescription("Channel to remove").setRequired(true),
  );
const allowChannelCmd = new SlashCommandBuilder()
  .setName("allowch")
  .setDescription("Allow a channel for XP gain")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .addChannelOption((o) =>
    o
      .setName("channel")
      .setDescription("Channel to allow XP")
      .setRequired(true),
  );
const removeChannelCmd = new SlashCommandBuilder()
  .setName("removech")
  .setDescription("Remove a channel from XP gain list")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .addChannelOption((o) =>
    o.setName("channel").setDescription("Channel to remove").setRequired(true),
  );
const levellbCmd = new SlashCommandBuilder()
  .setName("levellb")
  .setDescription("Post level leaderboard")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);
const levelHelpCmd = new SlashCommandBuilder()
  .setName("levelhelp")
  .setDescription("Show information about the level system")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator);
const levelchCmd = new SlashCommandBuilder()
  .setName("levelch")
  .setDescription("Set level channel")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .addChannelOption((o) =>
    o
      .setName("channel")
      .setDescription("Channel for level updates")
      .setRequired(true),
  );
const ignoreroleCmd = new SlashCommandBuilder()
  .setName("ignorerolelvl")
  .setDescription("Ignore role from gaining XP")
  .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
  .addRoleOption((o) =>
    o.setName("role").setDescription("Role to ignore").setRequired(true),
  );

/*
-------------------------------
EXPORT COMMANDS
-------------------------------
*/

module.exports = {
  data: [
    levelCmd,
    levellbCmd,
    levelchCmd,
    ignoreroleCmd,
    levelHelpCmd,
    levelAddCmd,
    levelRemoveCmd,
    allowChannelCmd,
    removeChannelCmd,
  ],

  async execute(interaction) {
    const levels = loadLevels();
    const config = loadConfig();

    /*
================================
/allowch
================================
*/

    if (interaction.commandName === "allowch") {
      const channel = interaction.options.getChannel("channel");

      if (!config.xpChannels.includes(channel.id)) {
        config.xpChannels.push(channel.id);
        saveConfig();
      }

      return interaction.reply({
        content: `✅ XP enabled in ${channel}`,
        flags: 64,
      });
    }

    /*
================================
/removech
================================
*/

    if (interaction.commandName === "removech") {
      const channel = interaction.options.getChannel("channel");

      config.xpChannels = config.xpChannels.filter((c) => c !== channel.id);

      saveConfig();

      return interaction.reply({
        content: `❌ XP disabled in ${channel}`,
        flags: 64,
      });
    }

    /*
================================
/level
================================
*/

    if (interaction.commandName === "level") {
      if (config.allowedChannels && config.allowedChannels.length) {
        if (!config.allowedChannels.includes(interaction.channel.id)) {
          return interaction.reply({
            content: "❌ This command cannot be used in this channel.",
            flags: 64,
          });
        }
      }
      const user = levels[interaction.user.id] || { xp: 0, level: 0 };

      const needed = xpRequired(user.level + 1);

      const bar = progressBar(user.xp, needed);

      const percent = Math.floor((user.xp / needed) * 100);

      const embed = new EmbedBuilder()
        .setTitle(`📊 ${interaction.user.username}'s Level`)
        .setColor("#ffffff")
        .addFields(
          { name: "Level", value: String(user.level), inline: true },
          { name: "XP", value: `${user.xp} / ${needed}`, inline: true },
          { name: "Progress", value: `${bar} **${percent}%**` },
        )
        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    /*
================================
/levelhelp
================================
*/

    if (interaction.commandName === "levelhelp") {
      const embed = new EmbedBuilder()
        .setTitle("📊 Level System Guide")
        .setColor("#ffffff")

        .setDescription(
          "Chat in the server to earn **XP** and level up!\n\n" +
            "• XP is earned every **5 seconds** while chatting\n" +
            "• Higher levels require **more XP** to reach\n" +
            "• Special levels unlock **exclusive roles**",
        )

        .addFields(
          {
            name: "⚙️ User Commands",
            value: "`/level` → Check your level progress",
          },

          {
            name: "🛠 Admin Commands",
            value:
              "`/levellb` → Post level leaderboard\n" +
              "`/levelch` → Set level announcement channel\n" +
              "`/ignorerolelvl` → Ignore role from gaining XP\n" +
              "`/levela` → Allow channel for /level command\n" +
              "`/levelr` → Remove channel from /level command list\n" +
              "`/allowch` → Allow XP gain in a channel\n" +
              "`/removech` → Remove XP gain from a channel",
          },

          {
            name: "🏆 Level Rewards",
            value:
              "⚓ Level 10 → Deckhand of the Fleet\n" +
              "🛡️ Level 30 → Raider of the Fleet\n" +
              "🧭 Level 60 → Navigator of the Fleet\n" +
              "👑 Level 100 → Jarl of the Fleet",
          },
        )

        .setFooter({
          text: "Keep chatting to climb the leaderboard!",
        })

        .setTimestamp();

      return interaction.reply({ embeds: [embed] });
    }

    /*
================================
/levellb
================================
*/

    if (interaction.commandName === "levellb") {
      const sorted = Object.entries(levels)
        .filter((u) => u[1].level >= 1)
        .sort((a, b) => b[1].xp - a[1].xp)
        .slice(0, 10);

      let description = "";

      if (sorted.length === 0) {
        description = "No players have reached **Level 1** yet.";
      } else {
        sorted.forEach((u, i) => {
          let medal = "";

          if (i === 0) medal = "🥇";
          else if (i === 1) medal = "🥈";
          else if (i === 2) medal = "🥉";
          else medal = `${i + 1}.`;

          description += `${medal} <@${u[0]}> — **Level ${u[1].level}**\n`;
        });
      }

      const embed = new EmbedBuilder()
        .setTitle("🏆 Server Chat Leaderboard")
        .setDescription(description)
        .setColor("#ffffff")
        .setFooter({
          text: "Top 10 most active members",
        })
        .setTimestamp();

      await interaction.channel.send({ embeds: [embed] });

      return interaction.reply({
        content: "Leaderboard posted.",
        flags: 64,
      });
    }

    /*
================================
/levelch
================================
*/

    if (interaction.commandName === "levelch") {
      const channel = interaction.options.getChannel("channel");

      config.channel = channel.id;

      saveConfig(config);

      return interaction.reply({
        content: `Level channel set to ${channel}.`,
        flags: 64,
      });
    }

    /*
================================
/levela
================================
*/

    if (interaction.commandName === "levela") {
      const channel = interaction.options.getChannel("channel");

      if (!config.allowedChannels.includes(channel.id)) {
        config.allowedChannels.push(channel.id);
        saveConfig();
      }

      return interaction.reply({
        content: `✅ ${channel} added to allowed level channels.`,
        flags: 64,
      });
    }

    /*
================================
/levelr
================================
*/

    if (interaction.commandName === "levelr") {
      const channel = interaction.options.getChannel("channel");

      config.allowedChannels = config.allowedChannels.filter(
        (c) => c !== channel.id,
      );

      saveConfig();

      return interaction.reply({
        content: `❌ ${channel} removed from allowed level channels.`,
        flags: 64,
      });
    }

    /*
================================
/ignorerolelvl
================================
*/

    if (interaction.commandName === "ignorerolelvl") {
      const role = interaction.options.getRole("role");

      if (!config.ignoreRoles.includes(role.id)) {
        config.ignoreRoles.push(role.id);
      }

      saveConfig(config);

      return interaction.reply({
        content: `Role **${role.name}** will no longer gain XP.`,
        flags: 64,
      });
    }
  },
};
