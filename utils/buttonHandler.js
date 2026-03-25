const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");

/*
------------------------------------------------
BUTTON HANDLER
------------------------------------------------
*/

async function handleButton(interaction) {
  const id = interaction.customId;

  /*
 --------------------------------
 BUSINESS ENQUIRY
 --------------------------------
 */

  if (id === "business_ticket") {
    return interaction.reply({
      content: "Please send your enquiry to:\npost@Metizport.com",
      flags: 64,
    });
  }

  /*
 --------------------------------
 TOURNAMENT TICKET
 --------------------------------
 */

  if (id === "tournament_ticket") {
    const modal = new ModalBuilder()
      .setCustomId("tournament_modal")
      .setTitle("Tournament Enquiry");

    const q1 = new TextInputBuilder()
      .setCustomId("match_id")
      .setLabel("Your Match ID")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const q2 = new TextInputBuilder()
      .setCustomId("team_name")
      .setLabel("Your Team Name")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const q3 = new TextInputBuilder()
      .setCustomId("issue")
      .setLabel("Describe the issue")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(q1),
      new ActionRowBuilder().addComponents(q2),
      new ActionRowBuilder().addComponents(q3),
    );

    return interaction.showModal(modal);
  }

  /*
 --------------------------------
 GENERAL TICKET
 --------------------------------
 */

  if (id === "general_ticket") {
    const modal = new ModalBuilder()
      .setCustomId("general_modal")
      .setTitle("General Enquiry");

    const q1 = new TextInputBuilder()
      .setCustomId("subject")
      .setLabel("Subject")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const q2 = new TextInputBuilder()
      .setCustomId("explain_issue")
      .setLabel("Explain your issue")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(q1),
      new ActionRowBuilder().addComponents(q2),
    );

    return interaction.showModal(modal);
  }
}

/*
------------------------------------------------
EXPORT
------------------------------------------------
*/

module.exports = {
  handleButton,
};
