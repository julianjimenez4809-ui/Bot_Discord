const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { isPremium, setPremium, removePremium, getStats } = require('../../database/db');
const { successEmbed, errorEmbed, formatTotalDuration } = require('../../utils/helpers');
const config = require('../../../config/config');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('premium')
    .setDescription('⭐ Gestión de premium')
    .addSubcommand(sub =>
      sub.setName('info').setDescription('Ver beneficios y estado del premium')
    )
    .addSubcommand(sub =>
      sub.setName('activar')
        .setDescription('[Admin] Activa premium manualmente en este servidor')
        .addIntegerOption(opt =>
          opt.setName('dias').setDescription('Días de premium (0 = permanente)').setRequired(true)
        )
    )
    .addSubcommand(sub =>
      sub.setName('desactivar').setDescription('[Admin] Desactiva el premium')
    )
    .addSubcommand(sub =>
      sub.setName('estadisticas').setDescription('Ver estadísticas del servidor')
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const premium = isPremium(guildId);

    // ── /premium info ────────────────────────────────────────
    if (sub === 'info') {
      const embed = new EmbedBuilder()
        .setColor(premium ? config.colors.premium : config.colors.primary)
        .setTitle('⭐ Premium — Bot de Música')
        .setDescription(
          premium
            ? '✅ **Este servidor tiene Premium activo.** ¡Gracias por tu apoyo!'
            : '🔒 Este servidor está usando la versión **gratuita**.'
        )
        .addFields(
          {
            name: '🆓 Gratis',
            value: [
              '• Cola hasta **20 canciones**',
              '• Reproducción desde YouTube',
              `• Bot se desconecta tras **3 min** de inactividad`,
              '• Canciones de hasta **10 minutos**',
              '• Comandos básicos',
            ].join('\n'),
            inline: true,
          },
          {
            name: '⭐ Premium — $2.99/mes',
            value: [
              '• Cola hasta **500 canciones**',
              '• **Playlists completas** de YouTube',
              '• **Bot 24/7** sin desconectarse',
              '• Canciones de hasta **3 horas** (lives, radios)',
              '• **Audio de mayor calidad**',
              '• Guardar **playlists personalizadas**',
              '• Comando `/move` para reordenar cola',
              '• Historial de reproducción',
              '• Soporte prioritario',
            ].join('\n'),
            inline: true,
          }
        )
        .addFields({
          name: '💳 ¿Cómo activar?',
          value: `Visita [nuestra web](${config.links.website}) o únete al [servidor de soporte](${config.links.support}) para más información.\n¿Quieres apoyarnos? [Dona aquí](${config.links.donate}) ❤️`,
        })
        .setFooter({ text: `Estado: ${premium ? '✅ Premium activo' : '🔒 Versión gratuita'}` });

      return interaction.reply({ embeds: [embed] });
    }

    // ── /premium estadisticas ─────────────────────────────────
    if (sub === 'estadisticas') {
      const stats = getStats(guildId);
      const embed = new EmbedBuilder()
        .setColor(premium ? config.colors.premium : config.colors.primary)
        .setTitle(`📊 Estadísticas — ${interaction.guild.name}`)
        .addFields(
          { name: '🎵 Canciones reproducidas', value: `${stats.songs_played}`, inline: true },
          { name: '⏱ Tiempo total', value: formatTotalDuration(stats.total_time), inline: true },
          { name: '⭐ Plan', value: premium ? 'Premium' : 'Gratuito', inline: true },
        )
        .setThumbnail(interaction.guild.iconURL());

      return interaction.reply({ embeds: [embed] });
    }

    // ── Comandos de admin (solo administradores del servidor) ──
    if (!interaction.member.permissions.has('Administrator')) {
      return interaction.reply({
        embeds: [errorEmbed('Solo los administradores pueden usar este comando.')],
        ephemeral: true,
      });
    }

    // ── /premium activar ──────────────────────────────────────
    if (sub === 'activar') {
      const days = interaction.options.getInteger('dias');
      const ms = days === 0 ? 0 : days * 24 * 60 * 60 * 1000;
      setPremium(guildId, ms);

      const until = days === 0 ? 'Permanente' : `${days} días`;
      return interaction.reply({
        embeds: [new EmbedBuilder()
          .setColor(config.colors.premium)
          .setTitle('⭐ Premium Activado')
          .setDescription(`Premium activado en **${interaction.guild.name}**\nDuración: **${until}**`)
        ]
      });
    }

    // ── /premium desactivar ───────────────────────────────────
    if (sub === 'desactivar') {
      removePremium(guildId);
      return interaction.reply({
        embeds: [successEmbed('Premium desactivado en este servidor.')]
      });
    }
  },
};
