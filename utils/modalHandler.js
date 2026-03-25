const { createTicket } = require("./ticketManager");

/*
------------------------------------------------
MODAL HANDLER
------------------------------------------------
*/

async function handleModal(interaction) {
  const modalId = interaction.customId;

  /*
 --------------------------------
 TOURNAMENT MODAL
 --------------------------------
 */

  if (modalId === "tournament_modal") {
    const matchId = interaction.fields.getTextInputValue("match_id");
    const teamName = interaction.fields.getTextInputValue("team_name");
    const issue = interaction.fields.getTextInputValue("issue");

    await interaction.deferReply({ flags: 64 });

    const channel = await createTicket({
      interaction,
      type: "tournament",
      questions: ["Match ID", "Team Name", "Issue Description"],
      answers: [matchId, teamName, issue],
    });

    if (!channel) {
      return interaction.editReply({
        content: "Failed to create ticket.",
      });
    }

    return interaction.editReply({
      content: `Metizport ${channel}`,
    });
  }

  /*
 --------------------------------
 GENERAL MODAL
 --------------------------------
 */

  if (modalId === "general_modal") {
    const subject = interaction.fields.getTextInputValue("subject");
    const issue = interaction.fields.getTextInputValue("explain_issue");

    await interaction.deferReply({ flags: 64 });

    const channel = await createTicket({
      interaction,
      type: "general",
      questions: ["Subject", "Issue Explanation"],
      answers: [subject, issue],
    });

    if (!channel) {
      return interaction.editReply({
        content: "Failed to create ticket.",
      });
    }

    return interaction.editReply({
      content: `Metizport ${channel}`,
    });
  }
}

/*
------------------------------------------------
EXPORT
------------------------------------------------
*/

module.exports = {
  handleModal,
};
