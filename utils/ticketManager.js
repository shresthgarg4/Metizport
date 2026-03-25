const { ChannelType, PermissionsBitField } = require("discord.js");

const {
  getNextTicketNumber,
  formatTicketName,
  getAvailableCategory,
  createEmbed,
} = require("./helpers");

/*
------------------------------------------------
CREATE TICKET
------------------------------------------------
*/

async function createTicket({ interaction, type, questions, answers }) {
  const guild =
    interaction.guild ||
    (await interaction.client.guilds.fetch(interaction.guildId));
  await guild.channels.fetch();
  const user = interaction.user;

  /*
 --------------------------------
 ENV VARIABLES
 --------------------------------
 */

  const tournamentCategory = process.env.TOURNAMENT_CATEGORY_ID;
  const tournamentAdmin = process.env.TOURNAMENT_ADMIN_ROLE;
  const generalCategory = process.env.GENERAL_CATEGORY_ID;

  const generalAdmin = process.env.GENERAL_ADMIN_ROLE;

  /*
 --------------------------------
 DETERMINE TICKET TYPE
 --------------------------------
 */

  let baseCategoryId;
  let adminRole;
  let baseCategoryName;

  if (type === "tournament") {
    baseCategoryId = tournamentCategory;
    adminRole = tournamentAdmin;
    baseCategoryName = "Tournament-Tickets";
  }

  if (type === "general") {
    baseCategoryId = generalCategory;
    adminRole = generalAdmin;
    baseCategoryName = "General-Tickets";
  }

  /*
 --------------------------------
 CHECK EXISTING TICKET (PER SECTION)
 --------------------------------
*/

  const existingTicket = guild.channels.cache.find((c) => {
    if (!c.parentId) return false;

    const correctCategory =
      type === "tournament"
        ? c.parentId === process.env.TOURNAMENT_CATEGORY_ID
        : c.parentId === process.env.GENERAL_CATEGORY_ID;

    const userHasAccess = c.topic === user.id;

    return correctCategory && userHasAccess;
  });

  if (existingTicket) {
    return interaction.editReply({
      content: `You already have an open ${type} ticket: ${existingTicket}`,
    });
  }

  /*
 --------------------------------
 GENERATE TICKET NUMBER
 --------------------------------
*/

  const ticketNumber = getNextTicketNumber(type);

  const channelName = formatTicketName(type, ticketNumber);

  /*
 --------------------------------
 FIND AVAILABLE CATEGORY
 --------------------------------
 */

  const category = await getAvailableCategory(
    guild,
    baseCategoryId,
    baseCategoryName,
  );

  if (!category) {
    return interaction.editReply({
      content: "Ticket category not configured.",
    });
  }

  /*
 --------------------------------
 CREATE CHANNEL
 --------------------------------
 */

  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: user.id,

    permissionOverwrites: [
      {
        id: guild.roles.everyone,
        deny: [PermissionsBitField.Flags.ViewChannel],
      },

      {
        id: user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
        ],
      },

      {
        id: adminRole,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageChannels,
          PermissionsBitField.Flags.ReadMessageHistory,
          PermissionsBitField.Flags.AttachFiles,
        ],
      },
    ],
  });

  /*
 --------------------------------
 BUILD TICKET EMBED
 --------------------------------
 */

  const fields = [];

  for (let i = 0; i < questions.length; i++) {
    fields.push({
      name: questions[i],
      value: answers[i] || "Not provided",
    });
  }

  const embed = createEmbed({
    title: `Ticket Created`,
    description: `Opened by <@${user.id}>`,
    fields: fields,
  });

  /*
 --------------------------------
 SEND MESSAGE
 --------------------------------
 */

  await channel.send({
    content: `<@${user.id}> <@&${adminRole}>`,
    embeds: [embed],
  });

  /*
 --------------------------------
 LOG TICKET
 --------------------------------
 */

  const logChannelId = process.env.TICKET_LOG_CHANNEL;

  if (logChannelId) {
    const logChannel = guild.channels.cache.get(logChannelId);

    if (logChannel) {
      const logEmbed = createEmbed({
        title: "Ticket Opened",
        description: `User: <@${user.id}>\nChannel: <#${channel.id}>`,
      });

      logChannel.send({ embeds: [logEmbed] });
    }
  }

  /*
 --------------------------------
 RETURN CHANNEL
 --------------------------------
 */

  return channel;
}

/*
------------------------------------------------
CHECK IF USER CAN CLOSE
------------------------------------------------
*/

function canUserClose(interaction, openerId, allowClose) {
  const adminRoles = [
    process.env.TOURNAMENT_ADMIN_ROLE,
    process.env.GENERAL_ADMIN_ROLE,
  ];

  const member = interaction.member;

  const isAdmin = member.roles.cache.some((r) => adminRoles.includes(r.id));

  if (isAdmin) return true;

  if (allowClose && interaction.user.id === openerId) return true;

  return false;
}

/*
------------------------------------------------
EXPORT
------------------------------------------------
*/

module.exports = {
  createTicket,
  canUserClose,
};
