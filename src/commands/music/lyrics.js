const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const Genius = require('genius-lyrics');
const { errorEmbed } = require('../../utils/helpers');
const config = require('../../../config/config');

const genius = new Genius.Client(process.env.GENIUS_API_KEY || '');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('lyrics')
    .setDescription('🎤 Muestra la letra de la canción actual o una búsqueda')
    .addStringOption(opt =>
      opt.setName('cancion')
        .setDescription('Nombre de la canción (deja vacío para la canción actual)')
        .setRequired(false)
    ),

  async execute(interaction, queues) {
    await interaction.deferReply();

    const query = interaction.options.getString('cancion');
    const queue = queues.get(interaction.guild.id);

    const searchTerm = query || queue?.songs[0]?.title;

    if (!searchTerm) {
      return interaction.editReply({ embeds: [errorEmbed('No hay canción reproduciéndose y no especificaste ninguna.')] });
    }

    try {
      const searches = await genius.songs.search(searchTerm);
      if (!searches.length) {
        return interaction.editReply({ embeds: [errorEmbed(`No encontré letra para: **${searchTerm}**`)] });
      }

      const song = searches[0];
      const lyrics = await song.lyrics();

      const truncated = lyrics.length > 3900
        ? lyrics.substring(0, 3900) + `\n\n... [Ver letra completa](${song.url})`
        : lyrics;

      const embed = new EmbedBuilder()
        .setColor(config.colors.music)
        .setTitle(`🎤 ${song.title}`)
        .setURL(song.url)
        .setThumbnail(song.thumbnail)
        .setDescription(truncated)
        .setFooter({ text: `Fuente: Genius • ${song.artist.name}` });

      return interaction.editReply({ embeds: [embed] });

    } catch (error) {
      console.error('[/lyrics]', error);
      return interaction.editReply({ embeds: [errorEmbed('No pude obtener la letra. Intenta con un nombre más específico.')] });
    }
  },
};
