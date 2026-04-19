const { errorEmbed } = require('../utils/helpers');

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client, queues) {

    // ── Slash commands ────────────────────────
    if (interaction.isChatInputCommand()) {
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
      return;
    }

    // ── Botones de música ─────────────────────
    if (interaction.isButton()) {
      const { customId } = interaction;
      if (!customId.startsWith('music_')) return;

      const queue = queues.get(interaction.guild.id);

      if (!queue?.playing) {
        return interaction.update({ components: [] }).catch(() => {});
      }

      const memberVC = interaction.member.voice.channel;
      if (!memberVC || memberVC.id !== queue.voiceChannel.id) {
        return interaction.reply({
          embeds: [errorEmbed('¡Debes estar en el mismo canal de voz que el bot!')],
          ephemeral: true,
        });
      }

      if (customId === 'music_pause') {
        queue.paused ? queue.resume() : queue.pause();
        return interaction.update({ components: [queue._buildButtons()] });
      }

      if (customId === 'music_skip') {
        queue.skip();
        return interaction.update({ components: [queue._buildButtons(true)] });
      }

      if (customId === 'music_loop') {
        queue.toggleLoop();
        return interaction.update({ components: [queue._buildButtons()] });
      }

      if (customId === 'music_shuffle') {
        queue.shuffle();
        return interaction.update({ components: [queue._buildButtons()] });
      }

      if (customId === 'music_stop') {
        queue.stop();
        queue.destroy();
        queues.delete(interaction.guild.id);
        return interaction.update({
          embeds: [errorEmbed('⏹️ Música detenida y cola vaciada.')],
          components: [],
        });
      }
    }
  },
};
