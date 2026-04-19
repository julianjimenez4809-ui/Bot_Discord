const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getStats, getMostPlayed } = require('../../database/db');
const { formatTotalDuration } = require('../../utils/helpers');
const config = require('../../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('stats')
    .setDescription('📊 Estadísticas de música del servidor'),

  execute(interaction) {
    const guildId = interaction.guild.id;
    const stats = getStats(guildId);
    const topSongs = getMostPlayed(guildId, 5);

    const topList = topSongs.length
      ? topSongs.map((s, i) => `\`${i + 1}.\` **${s.title}** — ${s.play_count} reproducciones`).join('\n')
      : 'Aún no hay datos suficientes.';

    const embed = new EmbedBuilder()
      .setColor(config.colors.primary)
      .setTitle(`📊 Estadísticas — ${interaction.guild.name}`)
      .setThumbnail(interaction.guild.iconURL())
      .addFields(
        { name: '🎵 Canciones reproducidas', value: `${stats.songs_played}`, inline: true },
        { name: '⏱ Tiempo total escuchado', value: formatTotalDuration(stats.total_time), inline: true },
        { name: '\u200b', value: '\u200b', inline: true },
        { name: '🏆 Top 5 más reproducidas', value: topList, inline: false },
      );

    return interaction.reply({ embeds: [embed] });
  },
};
