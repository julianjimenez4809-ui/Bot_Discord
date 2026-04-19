const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isPremium, savePlaylist, getPlaylist, getUserPlaylists, deletePlaylist } = require('../../database/db');
const { errorEmbed, successEmbed, premiumEmbed } = require('../../utils/helpers');
const { search } = require('../../utils/helpers');
const config = require('../../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('📁 [Premium] Gestiona tus playlists guardadas')
    .addSubcommand(sub =>
      sub.setName('guardar')
        .setDescription('Guarda la cola actual como playlist')
        .addStringOption(opt => opt.setName('nombre').setDescription('Nombre de la playlist').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('cargar')
        .setDescription('Carga una playlist guardada')
        .addStringOption(opt => opt.setName('nombre').setDescription('Nombre de la playlist').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('lista').setDescription('Ver todas tus playlists guardadas')
    )
    .addSubcommand(sub =>
      sub.setName('eliminar')
        .setDescription('Elimina una playlist guardada')
        .addStringOption(opt => opt.setName('nombre').setDescription('Nombre de la playlist').setRequired(true))
    ),

  async execute(interaction, queues) {
    // TODA esta función requiere premium
    if (!isPremium(interaction.guild.id)) {
      return interaction.reply({ embeds: [premiumEmbed('Playlists guardadas')], ephemeral: true });
    }

    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    // ── guardar ───────────────────────────────────────────────
    if (sub === 'guardar') {
      const queue = queues.get(guildId);
      if (!queue || queue.songs.length === 0) {
        return interaction.editReply({ embeds: [errorEmbed('No hay canciones en la cola para guardar.')] });
      }

      const name = interaction.options.getString('nombre');
      const songs = queue.songs.map(s => ({ title: s.title, url: s.url, duration: s.duration, thumbnail: s.thumbnail }));

      savePlaylist(userId, guildId, name, songs);
      return interaction.editReply({
        embeds: [successEmbed(`📁 Playlist **${name}** guardada con **${songs.length} canciones**.`)]
      });
    }

    // ── cargar ────────────────────────────────────────────────
    if (sub === 'cargar') {
      const name = interaction.options.getString('nombre');
      const pl = getPlaylist(userId, guildId, name);

      if (!pl) return interaction.editReply({ embeds: [errorEmbed(`No encontré una playlist llamada **${name}**.`)] });

      const memberVC = interaction.member.voice.channel;
      if (!memberVC) return interaction.editReply({ embeds: [errorEmbed('¡Necesitas estar en un canal de voz!')] });

      let queue = queues.get(guildId);
      if (!queue) {
        const { MusicQueue } = require('../../structures/MusicQueue');
        queue = new MusicQueue(interaction.guild, interaction.channel, memberVC, true);
        await queue.connect();
        queues.set(guildId, queue);
      }

      const songs = pl.songs.map(s => ({ ...s, requestedById: userId }));
      queue.addSongs(songs);

      return interaction.editReply({
        embeds: [new EmbedBuilder()
          .setColor(config.colors.success)
          .setTitle('📁 Playlist cargada')
          .setDescription(`**${name}** — ${songs.length} canciones añadidas a la cola.`)
        ]
      });
    }

    // ── lista ─────────────────────────────────────────────────
    if (sub === 'lista') {
      const pls = getUserPlaylists(userId, guildId);
      if (!pls.length) return interaction.editReply({ embeds: [errorEmbed('No tienes playlists guardadas.')] });

      const embed = new EmbedBuilder()
        .setColor(config.colors.premium)
        .setTitle('📁 Tus playlists')
        .setDescription(pls.map((p, i) => `\`${i + 1}.\` **${p.name}**`).join('\n'));

      return interaction.editReply({ embeds: [embed] });
    }

    // ── eliminar ──────────────────────────────────────────────
    if (sub === 'eliminar') {
      const name = interaction.options.getString('nombre');
      const deleted = deletePlaylist(userId, guildId, name);
      if (!deleted) return interaction.editReply({ embeds: [errorEmbed(`No encontré la playlist **${name}**.`)] });
      return interaction.editReply({ embeds: [successEmbed(`🗑️ Playlist **${name}** eliminada.`)] });
    }
  },
};
