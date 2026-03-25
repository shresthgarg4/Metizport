const fs = require("fs");
const path = require("path");
const { EmbedBuilder } = require("discord.js");

/*
------------------------------------------------
DATA FILE PATHS
------------------------------------------------
*/

const ticketCountPath = path.join(__dirname, "../data/ticketCount.json");

/*
------------------------------------------------
ENSURE DATA FILE EXISTS
------------------------------------------------
*/

function ensureTicketData() {
  if (!fs.existsSync(ticketCountPath)) {
    fs.writeFileSync(
      ticketCountPath,
      JSON.stringify(
        {
          tournament: 0,
          general: 0,
        },
        null,
        2,
      ),
    );
  }
}

/*
------------------------------------------------
GET NEXT TICKET NUMBER
------------------------------------------------
*/

function getNextTicketNumber(type) {
  ensureTicketData();

  const data = JSON.parse(fs.readFileSync(ticketCountPath));

  if (!data[type]) data[type] = 0;

  data[type]++;

  fs.writeFileSync(ticketCountPath, JSON.stringify(data, null, 2));

  const num = data[type];

  return num.toString().padStart(3, "0");
}

/*
------------------------------------------------
RANDOM FOOTER
------------------------------------------------
*/

function getRandomFooter() {
  const footers = ["#riseabovetherest", "#wheregamingmatters"];

  const random = footers[Math.floor(Math.random() * footers.length)];

  return `Metizport • ${random}`;
}

/*
------------------------------------------------
EMBED BUILDER
------------------------------------------------
*/

function createEmbed({ title, description, fields, color }) {
  const embed = new EmbedBuilder();

  if (title) embed.setTitle(title);

  if (description) embed.setDescription(description);

  if (fields && fields.length) embed.addFields(fields);

  embed.setColor(color || "#FFFFFF");

  embed.setFooter({
    text: getRandomFooter(),
  });

  embed.setTimestamp();

  return embed;
}

/*
------------------------------------------------
FIND AVAILABLE CATEGORY
------------------------------------------------
*/

async function getAvailableCategory(guild, baseCategoryId, baseName) {
  let category = guild.channels.cache.get(baseCategoryId);

  if (!category) return null;

  const limit = 48;

  if (category.children.cache.size < limit) {
    return category;
  }

  let index = 2;

  while (true) {
    const name = `${baseName}-${index.toString().padStart(2, "0")}`;

    let existing = guild.channels.cache.find(
      (c) => c.type === 4 && c.name === name,
    );

    if (!existing) {
      const newCategory = await guild.channels.create({
        name: name,
        type: 4,
      });

      return newCategory;
    }

    if (existing.children.cache.size < limit) {
      return existing;
    }

    index++;
  }
}

/*
------------------------------------------------
FORMAT TICKET CHANNEL NAME
------------------------------------------------
*/

function formatTicketName(type, number) {
  if (type === "tournament") {
    return `tournament #${number}`;
  }

  if (type === "general") {
    return `general #${number}`;
  }

  return `ticket #${number}`;
}

/*
------------------------------------------------
EXPORTS
------------------------------------------------
*/

module.exports = {
  getNextTicketNumber,
  getRandomFooter,
  createEmbed,
  getAvailableCategory,
  formatTicketName,
};
