const {
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const defaults = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/embedDefaults.json")),
);

/*
-----------------------------------
RANDOM FOOTER
-----------------------------------
*/

function randomFooter() {
  const options = defaults.footerOptions;

  return options[Math.floor(Math.random() * options.length)];
}

/*
-----------------------------------
AUTO ATTACHMENT LOADER
-----------------------------------
*/

function collectAttachments(data = {}) {
  const fileSet = new Set();

  const check = (value) => {
    if (typeof value !== "string") return;

    if (value.startsWith("attachment://")) {
      const file = value.replace("attachment://", "");

      fileSet.add(`./assets/${file}`);
    }
  };

  check(defaults.author?.iconURL);
  check(defaults.thumbnail);
  check(defaults.foot);

  check(data.thumbnail);
  check(data.image);

  return [...fileSet];
}

/*
-----------------------------------
BUILD EMBED
-----------------------------------
*/

function buildEmbed(data = {}) {
  const embed = new EmbedBuilder();

  const author = data.author ?? defaults.author;
  const thumbnail = data.thumbnail ?? defaults.thumbnail;
  const color = data.color ?? defaults.color;

  embed.setAuthor(author);
  embed.setColor(color);

  if (data.title) embed.setTitle(data.title);

  if (data.url) embed.setURL(data.url);

  embed.setDescription(data.description ?? defaults.description);

  const fields = data.fields ?? defaults.fields;

  if (fields && fields.length) {
    embed.addFields(fields);
  }

  if (thumbnail) embed.setThumbnail(thumbnail);

  if (data.image) embed.setImage(data.image);

  embed.setFooter({
    text: randomFooter(),
    iconURL: defaults.foot,
  });

  if (data.timestamp ?? defaults.timestamp) {
    embed.setTimestamp();
  }

  const files = collectAttachments(data);

  return { embed, files };
}

/*
-----------------------------------
MULTIPLE REDIRECT BUTTONS
-----------------------------------
*/

function redirectButtons(buttons = []) {
  if (!buttons.length) return [];

  const rows = [];
  let row = new ActionRowBuilder();

  buttons.forEach((btn, i) => {
    const button = new ButtonBuilder()
      .setLabel(btn.label)
      .setStyle(ButtonStyle.Link)
      .setURL(btn.url);

    row.addComponents(button);

    if ((i + 1) % 5 === 0) {
      rows.push(row);
      row = new ActionRowBuilder();
    }
  });

  if (row.components.length) rows.push(row);

  return rows;
}

module.exports = {
  buildEmbed,
  redirectButtons,
};
