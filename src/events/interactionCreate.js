const { errorEmbed } = require('../utils/helpers');

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client, queues) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction, queues);
    } catch (error) {
      console.error(`[Command Error] /${interaction.commandName}:`, error);
      const reply = { embeds: [errorEmbed('Ocurrió un error al ejecutar el comando.')], ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        interaction.editReply(reply).catch(() => {});
      } else {
        interaction.reply(reply).catch(() => {});
      }
    }
  },
};
