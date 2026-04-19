const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { MusicQueue } = require('../../structures/MusicQueue');
const { search, errorEmbed } = require('../../utils/helpers');
const { isPremium } = require('../../database/db');
const config = require('../../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('🎵 Reproduce una canción o playlist')
    .addStringOption(opt =>
      opt.setName('query')
        .setDescription('URL de YouTube/Spotify/SoundCloud o nombre de canción')
        .setRequired(true)
    ),

  async execute(interaction, queues) {
    await interaction.deferReply();

    const query = interaction.options.getString('query');
    const memberVC = interaction.member.voice.channel;

    if (!memberVC) {
      return interaction.editReply({ embeds: [errorEmbed('¡Necesitas estar en un canal de voz!')] });
    }

    const premium = isPremium(interaction.guild.id);

    let queue = queues.get(interaction.guild.id);

    if (!queue) {
      queue = new MusicQueue(interaction.guild, interaction.channel, memberVC, premium);
      await queue.connect();
      queues.set(interaction.guild.id, queue);

      queue.connection?.on('stateChange', (_, state) => {
        if (state.status === 'destroyed') queues.delete(interaction.guild.id);
      });
    } else if (queue.voiceChannel.id !== memberVC.id) {
      return interaction.editReply({ embeds: [errorEmbed('El bot ya está en otro canal de voz.')] });
    }

    const maxQueue = premium ? config.music.maxQueuePremium : config.music.maxQueueFree;
    if (queue.songs.length >= maxQueue) {
      return interaction.editReply({
        embeds: [errorEmbed(
          premium
            ? `La cola está llena (máx. ${maxQueue} canciones).`
            : `La cola está llena (máx. ${maxQueue}). ⭐ Premium soporta hasta 500.`
        )]
      });
    }

    try {
      const result = await search(query);

      if (result.type === 'playlist') {
        if (!premium) {
          return interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(config.colors.premium)
              .setTitle('⭐ Playlists — Función Premium')
              .setDescription('Cargar playlists completas es exclusivo para servidores premium.\nUsa `/premium info` para más detalles.')
            ]
          });
        }

        const songs = result.data.map(s => ({ ...s, requestedById: interaction.user.id }));
        queue.addSongs(songs);

        return interaction.editReply({
          embeds: [new EmbedBuilder()
            .setColor(config.colors.success)
            .setTitle('📋 Playlist añadida')
            .setDescription(`**${result.name}**`)
            .addFields(
              { name: 'Canciones añadidas', value: `${songs.length}`, inline: true },
              { name: 'Total en cola', value: `${queue.songs.length}`, inline: true },
            )
          ]
        });

      } else {
        const song = { ...result.data, requestedById: interaction.user.id };

        const maxDuration = premium ? config.music.maxDurationPremium : config.music.maxDurationFree;
        if (song.duration > maxDuration && song.duration !== 0) {
          return interaction.editReply({
            embeds: [errorEmbed(
              `La canción supera la duración máxima (${Math.floor(maxDuration / 60)} min). ` +
              (premium ? '' : '⭐ Premium permite canciones más largas.')
            )]
          });
        }

        const wasEmpty = queue.songs.length === 0;
        queue.addSong(song);

        if (!wasEmpty) {
          return interaction.editReply({
            embeds: [new EmbedBuilder()
              .setColor(config.colors.primary)
              .setDescription(`➕ **${song.title}** añadida a la cola (posición #${queue.songs.length})`)
            ]
          });
        }

        return interaction.editReply({ content: '✅ Cargando canción...' });
      }

    } catch (error) {
      console.error('[/play]', error);
      return interaction.editReply({
        embeds: [errorEmbed(error.message || 'No pude encontrar esa canción.')]
      });
    }
  },
};
