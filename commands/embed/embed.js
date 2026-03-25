const {
  SlashCommandBuilder,
  PermissionsBitField,
  AttachmentBuilder,
} = require("discord.js");

const axios = require("axios");

const { buildEmbed, redirectButtons } = require("../../systems/embedSystem");

const fs = require("fs");
const path = require("path");

const cachePath = path.join(__dirname, "../../data/imageCache.json");

let imageCache = {};

if (fs.existsSync(cachePath)) {
  imageCache = JSON.parse(fs.readFileSync(cachePath));
}

async function uploadImageToStorage(client, url) {
  if (imageCache[url]) {
    return imageCache[url];
  }

  const channel = await client.channels.fetch(process.env.STORAGE_CHANNEL_ID);

  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 10000,
  });

  const file = new AttachmentBuilder(Buffer.from(response.data), {
    name: "embed-image.png",
  });

  const msg = await channel.send({
    files: [file],
  });

  const cdn = msg.attachments.first().url;

  imageCache[url] = cdn;

  fs.writeFileSync(cachePath, JSON.stringify(imageCache, null, 2));

  return cdn;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)

    .setName("embed")
    .setDescription("Create a fully custom embed")

    .addStringOption((o) => o.setName("title").setDescription("Embed title"))

    .addStringOption((o) => o.setName("url").setDescription("Title URL"))

    .addStringOption((o) =>
      o.setName("description").setDescription("Embed description"),
    )

    .addAttachmentOption((o) =>
      o.setName("image").setDescription("Upload main image"),
    )

    .addAttachmentOption((o) =>
      o.setName("thumbnail").setDescription("Upload thumbnail"),
    )

    .addStringOption((o) => o.setName("color").setDescription("Hex color"))

    .addBooleanOption((o) =>
      o.setName("timestamp").setDescription("Enable timestamp"),
    )

    .addStringOption((o) =>
      o.setName("field1_name").setDescription("Field 1 name"),
    )

    .addStringOption((o) =>
      o.setName("field1_value").setDescription("Field 1 value"),
    )

    .addStringOption((o) =>
      o.setName("field2_name").setDescription("Field 2 name"),
    )

    .addStringOption((o) =>
      o.setName("field2_value").setDescription("Field 2 value"),
    )

    .addStringOption((o) =>
      o.setName("redirect_label").setDescription("Redirect button text"),
    )

    .addStringOption((o) =>
      o.setName("redirect_url").setDescription("Redirect button URL"),
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const title = interaction.options.getString("title");
    const url = interaction.options.getString("url");
    let description = interaction.options.getString("description");

    if (description) {
      description = description.replace(/\\n/g, "\n").replace(/\/n/g, "\n");
    }
    const imageAttachment = interaction.options.getAttachment("image");
    let image = imageAttachment ? imageAttachment.url : null;

    if (image && image.startsWith("http")) {
      image = await uploadImageToStorage(interaction.client, image);
    }
    const thumbnailAttachment = interaction.options.getAttachment("thumbnail");
    let thumbnail = thumbnailAttachment ? thumbnailAttachment.url : null;

    if (thumbnail && thumbnail.startsWith("http")) {
      thumbnail = await uploadImageToStorage(interaction.client, thumbnail);
    }

    const color = interaction.options.getString("color");
    const timestamp = interaction.options.getBoolean("timestamp");

    const f1name = interaction.options.getString("field1_name");
    const f1value = interaction.options.getString("field1_value");

    const f2name = interaction.options.getString("field2_name");
    const f2value = interaction.options.getString("field2_value");

    const redirectLabel = interaction.options.getString("redirect_label");
    const redirectURL = interaction.options.getString("redirect_url");

    /*
 --------------------------
 FIELDS BUILD
 --------------------------
 */

    const fields = [];

    if (f1name && f1value) {
      fields.push({ name: f1name, value: f1value, inline: false });
    }

    if (f2name && f2value) {
      fields.push({ name: f2name, value: f2value, inline: false });
    }

    /*
 --------------------------
 BUILD EMBED
 --------------------------
 */

    const { embed, files } = buildEmbed({
      title,
      url,
      description,
      image,
      thumbnail,
      color,
      timestamp,
      fields,
    });

    /*
 --------------------------
 BUTTONS
 --------------------------
 */

    const redirectRows =
      redirectLabel && redirectURL
        ? redirectButtons([{ label: redirectLabel, url: redirectURL }])
        : [];

    /*
 --------------------------
 SEND
 --------------------------
 */

    await interaction.channel.send({
      embeds: [embed],
      components: [...redirectRows],
      files: files,
    });

    await interaction.editReply({
      content: "✅ Embed posted.",
    });
  },
};
