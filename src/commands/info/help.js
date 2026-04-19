const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isPremium } = require('../../database/db');
const config = require('../../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('📖 Muestra todos los comandos disponibles'),

  execute(interaction) {
    const premium = isPremium(interaction.guild.id);

    const embed = new EmbedBuilder()
      .setColor(premium ? config.colors.premium : config.colors.primary)
      .setTitle(`🎵 Bot de Música — Comandos`)
      .setDescription(
        premium
          ? '⭐ **Este servidor tiene Premium activo.**'
          : `🔒 Versión gratuita. Usa \`/premium info\` para ver los beneficios del premium.`
      )
      .addFields(
        {
          name: '🎵 Música',
          value: [
            '`/play <canción/URL>` — Reproduce o añade a la cola',
            '`/skip` — Salta la canción actual',
            '`/stop` — Detiene la música',
            '`/pause` — Pausa/reanuda',
            '`/queue` — Ver la cola',
            '`/nowplaying` — Canción actual',
            '`/volume <0-100>` — Ajusta el volumen',
            '`/loop <modo>` — Repetición (off/song/queue)',
            '`/shuffle` — Mezclar la cola',
            '`/remove <posición>` — Eliminar canción',
          ].join('\n'),
          inline: false,
        },
        {
          name: `⭐ Premium${premium ? ' (activo)' : ' (bloqueado)'}`,
          value: [
            '`/play <playlist>` — Cargar playlists completas',
            '`/move <desde> <hasta>` — Mover canciones',
            '`/playlist guardar/cargar/lista/eliminar`',
            '`/history` — Ver historial de reproducción',
          ].join('\n'),
          inline: false,
        },
        {
          name: '📊 Info',
          value: [
            '`/premium info` — Ver beneficios y precio',
            '`/premium estadisticas` — Estadísticas del servidor',
            '`/help` — Este mensaje',
          ].join('\n'),
          inline: false,
        }
      )
      .addFields({
        name: '🔗 Links',
        value: [
          `[Invitar el bot](${config.links.invite})`,
          `[Servidor de soporte](${config.links.support})`,
          `[Donar ❤️](${config.links.donate})`,
        ].join(' • '),
      })
      .setFooter({ text: 'Usa /premium info para ver cómo activar el plan premium' });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
