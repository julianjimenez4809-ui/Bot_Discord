const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getHistory } = require('../../database/db');
const { errorEmbed, formatDuration } = require('../../utils/helpers');
const config = require('../../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('history')
    .setDescription('📜 Muestra las últimas canciones reproducidas en este servidor'),

  execute(interaction) {
    const songs = getHistory(interaction.guild.id, 10);

    if (!songs.length) {
      return interaction.reply({ embeds: [errorEmbed('No hay historial de reproducción aún.')], ephemeral: true });
    }

    const list = songs.map((s, i) =>
      `\`${i + 1}.\` **${s.title}** — ${formatDuration(s.duration)} • <@${s.user_id}>`
    ).join('\n');

    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(`📜 Historial — ${interaction.guild.name}`)
      .setDescription(list)
      .setFooter({ text: 'Últimas 10 canciones reproducidas' });

    return interaction.reply({ embeds: [embed] });
  },
};
