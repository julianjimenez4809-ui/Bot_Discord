const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { addFavorite, removeFavorite, getUserFavorites } = require('../../database/db');
const { errorEmbed, successEmbed, formatDuration } = require('../../utils/helpers');
const { search } = require('../../utils/helpers');
const { isPremium } = require('../../database/db');
const config = require('../../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('favorites')
    .setDescription('⭐ Gestiona tus canciones favoritas')
    .addSubcommand(sub => sub
      .setName('add')
      .setDescription('Añade la canción actual a tus favoritos'))
    .addSubcommand(sub => sub
      .setName('list')
      .setDescription('Ve tu lista de favoritos'))
    .addSubcommand(sub => sub
      .setName('play')
      .setDescription('Reproduce un favorito')
      .addIntegerOption(opt => opt
        .setName('numero')
        .setDescription('Número de la canción en tu lista')
        .setRequired(true)
        .setMinValue(1)))
    .addSubcommand(sub => sub
      .setName('remove')
      .setDescription('Elimina un favorito')
      .addIntegerOption(opt => opt
        .setName('numero')
        .setDescription('Número a eliminar')
        .setRequired(true)
        .setMinValue(1))),

  async execute(interaction, queues) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    // ── /favorites add ────────────────────
    if (sub === 'add') {
      const queue = queues.get(interaction.guild.id);
      const song = queue?.songs[0];

      if (!song) {
        return interaction.reply({ embeds: [errorEmbed('No hay ninguna canción reproduciéndose.')], ephemeral: true });
      }

      const added = addFavorite(userId, song);
      if (!added) {
        return interaction.reply({ embeds: [errorEmbed('Esa canción ya está en tus favoritos.')], ephemeral: true });
      }

      return interaction.reply({
        embeds: [successEmbed(`⭐ **${song.title}** añadida a tus favoritos.`)],
        ephemeral: true,
      });
    }

    // ── /favorites list ───────────────────
    if (sub === 'list') {
      const favs = getUserFavorites(userId);

      if (!favs.length) {
        return interaction.reply({ embeds: [errorEmbed('No tienes canciones favoritas aún. Usa `/favorites add` mientras suena una canción.')], ephemeral: true });
      }

      const list = favs.map((s, i) =>
        `\`${i + 1}.\` **${s.title}** — ${formatDuration(s.duration)}`
      ).join('\n');

      const embed = new EmbedBuilder()
        .setColor(config.colors.premium)
        .setTitle('⭐ Tus favoritos')
        .setDescription(list)
        .setFooter({ text: `${favs.length} canciones guardadas` });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // ── /favorites play ───────────────────
    if (sub === 'play') {
      await interaction.deferReply();

      const favs = getUserFavorites(userId);
      const num = interaction.options.getInteger('numero');

      if (!favs[num - 1]) {
        return interaction.editReply({ embeds: [errorEmbed(`No tienes un favorito en la posición ${num}.`)] });
      }

      const fav = favs[num - 1];
      const memberVC = interaction.member.voice.channel;

      if (!memberVC) {
        return interaction.editReply({ embeds: [errorEmbed('¡Necesitas estar en un canal de voz!')] });
      }

      const { MusicQueue } = require('../../structures/MusicQueue');
      const premium = isPremium(interaction.guild.id);
      let queue = queues.get(interaction.guild.id);

      if (!queue) {
        queue = new MusicQueue(interaction.guild, interaction.channel, memberVC, premium);
        await queue.connect();
        queues.set(interaction.guild.id, queue);
        queue.connection?.on('stateChange', (_, state) => {
          if (state.status === 'destroyed') queues.delete(interaction.guild.id);
        });
      }

      const song = { ...fav, requestedById: userId };
      queue.addSong(song);

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(config.colors.success)
          .setDescription(`⭐ Reproduciendo favorito: **${fav.title}**`)
        ]
      });
    }

    // ── /favorites remove ─────────────────
    if (sub === 'remove') {
      const favs = getUserFavorites(userId);
      const num = interaction.options.getInteger('numero');

      if (!favs[num - 1]) {
        return interaction.reply({ embeds: [errorEmbed(`No tienes un favorito en la posición ${num}.`)], ephemeral: true });
      }

      const fav = favs[num - 1];
      removeFavorite(userId, fav.id);

      return interaction.reply({
        embeds: [successEmbed(`🗑️ **${fav.title}** eliminada de tus favoritos.`)],
        ephemeral: true,
      });
    }
  },
};
