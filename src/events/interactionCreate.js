const { errorEmbed, buildQueueMessage } = require('../utils/helpers');
const { isPremium } = require('../database/db');
const config = require('../../config/config');

const MUSIC_COMMANDS = new Set(['play','skip','stop','pause','queue','nowplaying','volume','loop','shuffle','remove','move','lyrics','favorites','playlist']);
const cooldowns = new Map();

module.exports = {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client, queues) {

    // ── Slash commands ────────────────────────
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      // Cooldown
      if (MUSIC_COMMANDS.has(interaction.commandName)) {
        const premium = isPremium(interaction.guild.id);
        const cooldownMs = premium ? config.cooldowns.premium : config.cooldowns.free;
        const userId = interaction.user.id;
        const key = `${userId}:${interaction.commandName}`;
        const now = Date.now();
        const lastUsed = cooldowns.get(key) || 0;
        const remaining = cooldownMs - (now - lastUsed);

        if (remaining > 0) {
          return interaction.reply({
            embeds: [errorEmbed(`⏳ Espera **${(remaining / 1000).toFixed(1)}s** antes de usar este comando de nuevo.${!premium ? ' ⭐ Premium reduce el cooldown a 1s.' : ''}`)],
            ephemeral: true,
          });
        }
        cooldowns.set(key, now);
      }

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

    // ── Botones de paginación de cola ─────
    if (interaction.isButton()) {
      const { customId } = interaction;
      if (!customId.startsWith('queue_')) return;

      const queue = queues.get(interaction.guild.id);
      if (!queue || queue.songs.length === 0) {
        return interaction.update({ components: [] }).catch(() => {});
      }

      const currentPage = parseInt(customId.split('_')[2]);
      const newPage = customId.startsWith('queue_prev') ? currentPage - 1 : currentPage + 1;
      const { embed, row } = buildQueueMessage(queue, newPage);
      return interaction.update({ embeds: [embed], components: [row] });
    }
  },
};
