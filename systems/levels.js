const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

const levelPath = path.join(__dirname, "../data/levels.json");
const boardPath = path.join(__dirname, "../data/leaderboard.json");

let levels = {};
let leaderboardData = { messageId: null, lastUpdate: 0 };
const configPath = path.join(__dirname, "../data/levelConfig.json");

let config = {
  channel: null,
  ignoreRoles: [],
  allowedChannels: [],
  xpChannels: [],
};

if (fs.existsSync(configPath)) {
  config = JSON.parse(fs.readFileSync(configPath));
}

function saveConfig() {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}
if (fs.existsSync(levelPath)) {
  levels = JSON.parse(fs.readFileSync(levelPath));
}

if (fs.existsSync(boardPath)) {
  leaderboardData = JSON.parse(fs.readFileSync(boardPath));
}

/*
--------------------------------
SAVE FUNCTIONS
--------------------------------
*/

function saveLevels() {
  fs.writeFileSync(levelPath, JSON.stringify(levels, null, 2));
}

function saveBoard() {
  fs.writeFileSync(boardPath, JSON.stringify(leaderboardData, null, 2));
}

/*
--------------------------------
XP FORMULA
--------------------------------
*/

function xpRequired(level) {
  return 50 * level * level;
}

/*
--------------------------------
LEADERBOARD EMBED
--------------------------------
*/

function buildLeaderboard() {
  const sorted = Object.entries(levels)
    .filter((u) => u[1].level >= 1)
    .sort((a, b) => b[1].xp - a[1].xp)
    .slice(0, 10);

  let description = "";

  if (sorted.length === 0) {
    description = "No players have reached **Level 1** yet.";
  } else {
    sorted.forEach((user, i) => {
      let medal = "";

      if (i === 0) medal = "🥇";
      else if (i === 1) medal = "🥈";
      else if (i === 2) medal = "🥉";
      else medal = `${i + 1}.`;

      description += `${medal} <@${user[0]}> — **Level ${user[1].level}**\n`;
    });
  }

  const embed = new EmbedBuilder()
    .setTitle("🏆 Metizport Chat Leaderboard")
    .setColor("#ffffff")
    .setThumbnail("attachment://pfp.jpg")
    .setDescription(description)
    .addFields({
      name: "━━━━━━━━━━━━━━━━",
      value: "Top 10 most active members",
    })
    .setFooter({
      text: "Metizport Level System",
    });

  return embed;
}

/*
--------------------------------
UPDATE LEADERBOARD
--------------------------------
*/

async function updateLeaderboard(client) {
  const channel = await client.channels.fetch(process.env.LEVEL_CHANNEL_ID);

  if (!channel) return;

  const embed = buildLeaderboard();

  let msg = null;

  if (leaderboardData.messageId) {
    try {
      msg = await channel.messages.fetch(leaderboardData.messageId);
    } catch {}
  }

  if (msg) {
    await msg.edit({
      embeds: [embed],
      files: ["./assets/pfp.jpg"],
    });
  } else {
    const newMsg = await channel.send({
      embeds: [embed],
      files: ["./assets/pfp.jpg"],
    });

    leaderboardData.messageId = newMsg.id;
  }

  leaderboardData.lastUpdate = Date.now();

  saveBoard();
}

/*
--------------------------------
LEVEL ROLES
--------------------------------
*/

const levelRoles = {
  10: process.env.LEVEL_ROLE_10,
  30: process.env.LEVEL_ROLE_30,
  60: process.env.LEVEL_ROLE_60,
  100: process.env.LEVEL_ROLE_100,
};

/*
--------------------------------
MESSAGE HANDLER
--------------------------------
*/

async function messageHandler(message, client) {
  if (message.author.bot) return;

  const userId = message.author.id;

  if (config.ignoreRoles.length) {
    const member = message.member;

    if (member.roles.cache.some((r) => config.ignoreRoles.includes(r.id))) {
      return;
    }
  }

  if (config.xpChannels.length) {
    if (!config.xpChannels.includes(message.channel.id)) {
      return;
    }
  }

  if (!levels[userId]) {
    levels[userId] = {
      xp: 0,
      level: 0,
      lastMessage: 0,
    };
  }

  const user = levels[userId];

  const now = Date.now();

  if (now - user.lastMessage < 5000) return;

  user.lastMessage = now;

  const xpGain = Math.floor(Math.random() * 15) + 10;

  user.xp += xpGain;

  const required = xpRequired(user.level + 1);

  if (user.xp >= required) {
    user.level += 1;

    const levelChannel = await client.channels.fetch(
      process.env.LEVEL_CHANNEL_ID,
    );

    if (levelChannel) {
      levelChannel.send(`🎉 <@${userId}> reached **Level ${user.level}**!`);
    }

    const roleId = levelRoles[user.level];

    if (roleId) {
      try {
        const member = await message.guild.members.fetch(userId);
        await member.roles.add(roleId);
      } catch {}
    }
  }

  saveLevels();
}

/*
--------------------------------
LEADERBOARD AUTO UPDATE
--------------------------------
*/

let lastUpdate = 0;

async function scheduledLeaderboard(client) {
  const now = Date.now();

  if (now - leaderboardData.lastUpdate < 5 * 60 * 1000) return;

  await updateLeaderboard(client);
}

module.exports = { messageHandler, scheduledLeaderboard, updateLeaderboard };
