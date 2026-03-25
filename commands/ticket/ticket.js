const {
  SlashCommandBuilder,
  PermissionsBitField,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ChannelType,
} = require("discord.js");

const fs = require("fs");
const path = require("path");

const allowClosePath = path.join(__dirname, "../../data/allowClose.json");

/*
------------------------------------------------
ENSURE ALLOW CLOSE DATA
------------------------------------------------
*/

function ensureAllowClose() {
  if (!fs.existsSync(allowClosePath)) {
    fs.writeFileSync(allowClosePath, JSON.stringify({}, null, 2));
  }
}

/*
------------------------------------------------
SET ALLOW CLOSE
------------------------------------------------
*/

function setAllowClose(channelId, value) {
  ensureAllowClose();

  const data = JSON.parse(fs.readFileSync(allowClosePath));

  data[channelId] = value;

  fs.writeFileSync(allowClosePath, JSON.stringify(data, null, 2));
}

/*
------------------------------------------------
GET ALLOW CLOSE
------------------------------------------------
*/

function getAllowClose(channelId) {
  ensureAllowClose();

  const data = JSON.parse(fs.readFileSync(allowClosePath));

  return data[channelId] || false;
}

/*
------------------------------------------------
TRANSCRIPT GENERATOR
------------------------------------------------
*/

async function generateTranscript(channel) {
  let lastId;
  let messages = [];

  while (true) {
    const fetched = await channel.messages.fetch({
      limit: 100,
      before: lastId,
    });

    if (fetched.size === 0) break;

    messages.push(...fetched.values());
    lastId = fetched.last().id;
  }

  let content = "";

  const sorted = messages.sort(
    (a, b) => a.createdTimestamp - b.createdTimestamp,
  );

  sorted.forEach((m) => {
    content += `[${m.author.tag}] ${m.content}\n`;

    if (m.attachments.size > 0) {
      m.attachments.forEach((a) => {
        content += `Attachment: ${a.url}\n`;
      });
    }
  });

  const filePath = `./transcript-${channel.id}.txt`;

  fs.writeFileSync(filePath, content);

  return filePath;
}

/*
------------------------------------------------
COMMANDS
------------------------------------------------
*/

module.exports = {
  data: [
    new SlashCommandBuilder()
      .setName("panel")
      .setDescription("Create the ticket panel")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),

    new SlashCommandBuilder()
      .setName("add")
      .setDescription("Add user to ticket")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .addUserOption((o) =>
        o.setName("user").setDescription("User").setRequired(true),
      ),

    new SlashCommandBuilder()
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .setName("remove")
      .setDescription("Remove user from ticket")
      .addUserOption((o) =>
        o.setName("user").setDescription("User").setRequired(true),
      ),

    new SlashCommandBuilder()
      .setName("close")
      .setDescription("Close the ticket"),

    new SlashCommandBuilder()
      .setName("frclose")
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .setDescription("Force close ticket")
      .addChannelOption((o) =>
        o
          .setName("channel")
          .setDescription("Ticket channel")
          .addChannelTypes(ChannelType.GuildText)
          .setRequired(true),
      ),

    new SlashCommandBuilder()
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .setName("special")
      .setDescription("Move ticket to special category")
      .addStringOption((o) =>
        o.setName("name").setDescription("New ticket name").setRequired(true),
      ),

    new SlashCommandBuilder()
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .setName("allowclose")
      .setDescription("Allow opener to close ticket")
      .addStringOption((o) =>
        o
          .setName("mode")
          .setDescription("on/off")
          .setRequired(true)
          .addChoices(
            { name: "on", value: "on" },
            { name: "off", value: "off" },
          ),
      ),

    new SlashCommandBuilder()
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
      .setName("tickethelp")
      .setDescription("Show ticket commands"),
  ],

  async execute(interaction) {
    const cmd = interaction.commandName;

    const adminRoles = [
      process.env.TOURNAMENT_ADMIN_ROLE,
      process.env.GENERAL_ADMIN_ROLE,
    ];

    const isAdmin = interaction.member.roles.cache.some((r) =>
      adminRoles.includes(r.id),
    );

    /*
 --------------------------------
 PANEL
 --------------------------------
 */

    if (cmd === "panel") {
      if (!isAdmin)
        return interaction.reply({ content: "No permission", flags: 64 });

      const embed = new EmbedBuilder()
        .setColor("#ffffff")
        .setAuthor({
          name: "MetizBot",
          iconURL: "attachment://PIC.jpg",
        })
        .setImage("attachment://SPONSOR.jpg")
        .setThumbnail("attachment://pfp.jpg")
        .setTitle("Metizport Support Center")
        .setDescription(
          `Welcome to **Metizport Support**.

Select the category that best matches your enquiry.

🎮 **Tournament Enquiry**
Issues related to tournaments or matches.

💼 **Business Enquiry**
For sponsorships, partnerships or business communication.

❓ **General Enquiry**
Any other support request.

Our team will respond as soon as possible.`,
        )
        .addFields(
          {
            name: "Support Hours",
            value: "24/7 Community Support",
            inline: true,
          },
          {
            name: "Response Time",
            value: "Usually within a few minutes",
            inline: true,
          },
        )
        .setFooter({
          text: "Metizport Support • Choose a category below",
        });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("business_ticket")
          .setLabel("Business Enquiry")
          .setStyle(ButtonStyle.Primary),

        new ButtonBuilder()
          .setCustomId("tournament_ticket")
          .setLabel("Tournament Enquiry")
          .setStyle(ButtonStyle.Success),

        new ButtonBuilder()
          .setCustomId("general_ticket")
          .setLabel("General Enquiry")
          .setStyle(ButtonStyle.Secondary),
      );

      await interaction.reply({ content: "Panel created", flags: 64 });

      await interaction.channel.send({
        embeds: [embed],
        components: [row],
        files: ["./assets/pfp.jpg", "./assets/SPONSOR.jpg", "./assets/PIC.jpg"],
      });
    }

    /*
 --------------------------------
 ADD USER
 --------------------------------
 */

    if (cmd === "add") {
      if (!isAdmin)
        return interaction.reply({ content: "No permission", flags: 64 });

      const user = interaction.options.getUser("user");

      await interaction.channel.permissionOverwrites.edit(user.id, {
        ViewChannel: true,
        SendMessages: true,
      });

      interaction.reply(`Added ${user}`);
    }

    /*
 --------------------------------
 REMOVE USER
 --------------------------------
 */

    if (cmd === "remove") {
      if (!isAdmin)
        return interaction.reply({ content: "No permission", flags: 64 });

      const user = interaction.options.getUser("user");

      await interaction.channel.permissionOverwrites.delete(user.id);

      interaction.reply(`Removed ${user}`);
    }

    /*
 --------------------------------
 CLOSE TICKET
 --------------------------------
 */

    if (cmd === "close") {
      const allowClose = getAllowClose(interaction.channel.id);

      if (!isAdmin && !allowClose) {
        return interaction.reply({
          content: "Only admins can close this ticket.",
          flags: 64,
        });
      }

      await interaction.deferReply({ flags: 64 });

      const transcript = await generateTranscript(interaction.channel);

      const logChannel = interaction.guild.channels.cache.get(
        process.env.TICKET_LOG_CHANNEL,
      );

      if (logChannel) {
        await logChannel.send({
          content: `Transcript from ${interaction.channel.name}`,
          files: [transcript],
        });
      }

      /*
SEND TO USER
*/

      const ticketOwnerId = interaction.channel.topic;

      if (ticketOwnerId && /^\d+$/.test(ticketOwnerId)) {
        try {
          const user = await interaction.client.users.fetch(ticketOwnerId);

          await user.send({
            embeds: [
              new EmbedBuilder()
                .setColor("#ffffff")
                .setTitle("Ticket Closed")
                .setDescription(
                  `Your ticket **${interaction.channel.name}** has been closed.\nThe transcript is attached below.`,
                )
                .setTimestamp(),
            ],
            files: [transcript],
          });
        } catch {}
      }

      /*
DELETE LOCAL FILE
*/

      try {
        fs.unlinkSync(transcript);
      } catch {
        console.log("Transcript delete failed");
      }

      await interaction.editReply({
        content: "Closing ticket...",
      });

      setTimeout(() => {
        interaction.channel.delete();
      }, 3000);
    }

    /*
 --------------------------------
 FORCE CLOSE
 --------------------------------
 */

    if (cmd === "frclose") {
      if (!isAdmin) return;

      const channel = interaction.options.getChannel("channel");

      await interaction.reply("Force closing...");

      setTimeout(() => {
        channel.delete();
      }, 3000);
    }

    /*
 --------------------------------
 SPECIAL
 --------------------------------
 */

    if (cmd === "special") {
      if (!isAdmin) return;

      const name = interaction.options.getString("name");

      await interaction.channel.setName(`special-${name}`);

      await interaction.channel.setParent(
        process.env.SPECIAL_TICKET_CATEGORY_ID,
      );

      interaction.reply("Moved to special category.");
    }

    /*
 --------------------------------
 ALLOW CLOSE
 --------------------------------
 */

    if (cmd === "allowclose") {
      if (!isAdmin) return;

      const mode = interaction.options.getString("mode");

      setAllowClose(interaction.channel.id, mode === "on");

      interaction.reply(`Allow close set to ${mode}`);
    }

    /*
 --------------------------------
 HELP
 --------------------------------
 */

    if (cmd === "tickethelp") {
      const embed = new EmbedBuilder()
        .setTitle("Ticket Commands")
        .setDescription(
          `
/panel - create ticket panel
/add - add user
/remove - remove user
/close - close ticket
/frclose - force close
/special - move ticket
/allowclose - allow opener close
`,
        )
        .setColor("#ffffff");

      interaction.reply({ embeds: [embed], flags: 64 });
    }
  },
};
