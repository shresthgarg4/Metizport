require("dotenv").config();

const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const { messageHandler } = require("./systems/levels");
const {
  Client,
  GatewayIntentBits,
  Collection,
  Events,
  ActivityType,
  EmbedBuilder,
  AttachmentBuilder,
} = require("discord.js");
const SocialManager = require("./systems/social/socialManager");
require("./deploy-commands.js");
const { scheduledLeaderboard } = require("./systems/levels");
// ================= CONFIG =================
const CONFIG = {
  crashLogChannel: process.env.CRASH_LOG_CHANNEL,
  coreCheckInterval: 120000, // 2 min (safe)
};

// ================= LOGGER =================
const log = {
  info: (msg) => console.log(`[INFO] ${msg}`),
  error: (msg) => console.log(`[ERROR] ${msg}`),
};

// ================= CRASH MONITOR =================
class CrashMonitor {
  constructor(client) {
    this.client = client;
    this.deleted = 0;
  }

  async sendToDiscord(title, desc, filePath = null) {
    try {
      if (!CONFIG.crashLogChannel) return;

      const channel = await this.client.channels.fetch(CONFIG.crashLogChannel);
      if (!channel) return;

      const embed = new EmbedBuilder()
        .setTitle(title)
        .setDescription(desc)
        .setColor(0xff0000)
        .setTimestamp();

      const payload = { embeds: [embed] };

      if (filePath) {
        payload.files = [new AttachmentBuilder(filePath)];
      }

      await channel.send(payload);
    } catch (e) {
      log.error("Discord log failed");
    }
  }

  async saveCrash(error) {
    console.log("💥 Crash:", error.message);
  }

  async checkCore() {
    try {
      const files = await fsp.readdir("/home/container");

      for (const f of files) {
        if (f.startsWith("core.")) {
          const full = `/home/container/${f}`;
          const stats = await fsp.stat(full);

          await this.sendToDiscord(
            "⚠️ Core File Detected",
            `${f} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`,
          );

          // AUTO DELETE
          await fsp.unlink(full);
          this.deleted++;

          await this.sendToDiscord(
            "🗑️ Core Deleted",
            `${f} deleted (Total: ${this.deleted})`,
          );

          log.info(`Deleted core file: ${f}`);
        }
      }
    } catch (e) {
      log.error("Core check error");
    }
  }
}

// ================= CLIENT =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// ================= COMMAND LOADER =================
async function loadCommands() {
  const base = "./commands";

  const folders = fs.readdirSync(base);

  for (const folder of folders) {
    const files = fs.readdirSync(`${base}/${folder}`);

    for (const file of files) {
      if (!file.endsWith(".js")) continue;

      try {
        const cmd = require(`./commands/${folder}/${file}`);

        if (Array.isArray(cmd.data)) {
          cmd.data.forEach((c) => client.commands.set(c.name, cmd));
        } else {
          client.commands.set(cmd.data.name, cmd);
        }

        log.info(`Loaded ${file}`);
      } catch (e) {
        log.error(`Command error: ${file}`);
      }
    }
  }
}

// ================= EVENTS =================
client.on(Events.InteractionCreate, async (i) => {
  try {
    if (!i.isChatInputCommand()) return;

    const cmd = client.commands.get(i.commandName);
    if (!cmd) return;

    await cmd.execute(i, client);
  } catch (e) {
    console.log("❌ Interaction error:", e);

    if (!i.replied) {
      await i
        .reply({ content: "Error occurred", ephemeral: true })
        .catch(() => {});
    }
  }
});

client.on(Events.MessageCreate, async (message) => {
  try {
    await messageHandler(message, client);
  } catch (e) {
    console.log("Level error:", e.message);
  }
});

// ================= READY =================
client.once(Events.ClientReady, async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  client.crash = new CrashMonitor(client);

  // ✅ SOCIAL SYSTEM START
  client.social = new SocialManager(client);
  client.social.start();

  // ✅ LEADERBOARD LOOP
  setInterval(() => {
    try {
      scheduledLeaderboard(client);
    } catch (e) {
      console.log("Leaderboard error:", e.message);
    }
  }, 60000);

  // ✅ CORE CHECK
  setInterval(() => {
    client.crash.checkCore();
  }, CONFIG.coreCheckInterval);
});

// ================= ERROR HANDLING =================
process.on("unhandledRejection", async (err) => {
  console.log("❌ Unhandled:", err);
  if (client.crash) await client.crash.saveCrash(err);
});

process.on("uncaughtException", async (err) => {
  console.log("❌ Exception:", err);
  if (client.crash) await client.crash.saveCrash(err);
});

// ================= START =================
(async () => {
  await loadCommands();
  await client.login(process.env.TOKEN);
})();
