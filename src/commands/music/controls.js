const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { errorEmbed, successEmbed, checkVoiceChannel, paginate, formatDuration, premiumEmbed } = require('../../utils/helpers');
const { isPremium } = require('../../database/db');
const config = require('../../../config/config');

const skip = {
  data: new SlashCommandBuilder()
    .setName('skip')
    .setDescription('⏭️ Salta la canción actual'),

  execute(interaction, queues) {
    const queue = queues.get(interaction.guild.id);
    if (!queue?.playing) return interaction.reply({ embeds: [errorEmbed('No hay música reproduciéndose.')], ephemeral: true });
    const check = checkVoiceChannel(interaction, queue);
    if (!check.ok) return interaction.reply({ embeds: [check.embed], ephemeral: true });
    const skipped = queue.songs[0]?.title || 'canción';
    queue.skip();
    return interaction.reply({ embeds: [successEmbed(`Saltada: **${skipped}**`)] });
  },
};

const stop = {
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('⏹️ Detiene la música y vacía la cola'),

  execute(interaction, queues) {
    const queue = queues.get(interaction.guild.id);
    if (!queue) return interaction.reply({ embeds: [errorEmbed('No hay música reproduciéndose.')], ephemeral: true });
    const check = checkVoiceChannel(interaction, queue);
    if (!check.ok) return interaction.reply({ embeds: [check.embed], ephemeral: true });
    queue.stop();
    queue.destroy();
    queues.delete(interaction.guild.id);
    return interaction.reply({ embeds: [successEmbed('Música detenida y cola vaciada.')] });
  },
};

const pause = {
  data: new SlashCommandBuilder()
    .setName('pause')
    .setDescription('⏸️ Pausa o reanuda la música'),

  execute(interaction, queues) {
    const queue = queues.get(interaction.guild.id);
    if (!queue?.playing) return interaction.reply({ embeds: [errorEmbed('No hay música reproduciéndose.')], ephemeral: true });
    const check = checkVoiceChannel(interaction, queue);
    if (!check.ok) return interaction.reply({ embeds: [check.embed], ephemeral: true });
    if (queue.paused) {
      queue.resume();
      return interaction.reply({ embeds: [successEmbed('▶️ Música reanudada.')] });
    } else {
      queue.pause();
      return interaction.reply({ embeds: [successEmbed('⏸️ Música pausada.')] });
    }
  },
};

const queueCmd = {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('📋 Muestra la cola de canciones')
    .addIntegerOption(opt =>
      opt.setName('pagina').setDescription('Número de página').setMinValue(1)
    ),

  execute(interaction, queues) {
    const queue = queues.get(interaction.guild.id);
    if (!queue || queue.songs.length === 0) {
      return interaction.reply({ embeds: [errorEmbed('La cola está vacía.')], ephemeral: true });
    }
    const page = interaction.options.getInteger('pagina') || 1;
    const { items, totalPages, currentPage } = paginate(queue.songs, page, 10);
    const list = items.map((s, i) => {
      const index = (currentPage - 1) * 10 + i;
      const prefix = index === 0 ? '▶️' : `\`${index}.\``;
      return `${prefix} **${s.title}** — ${formatDuration(s.duration)}`;
    }).join('\n');
    const totalDuration = queue.songs.reduce((acc, s) => acc + (s.duration || 0), 0);
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`📋 Cola — ${queue.songs.length} canciones`)
        .setDescription(list)
        .addFields(
          { name: '⏱ Duración total', value: formatDuration(totalDuration), inline: true },
          { name: '🔁 Loop', value: queue.loop, inline: true },
          { name: '🔊 Volumen', value: `${Math.round(queue.volume * 100)}%`, inline: true },
        )
        .setFooter({ text: `Página ${currentPage}/${totalPages}` })
      ]
    });
  },
};

const nowplaying = {
  data: new SlashCommandBuilder()
    .setName('nowplaying')
    .setDescription('🎵 Muestra la canción que suena ahora'),

  execute(interaction, queues) {
    const queue = queues.get(interaction.guild.id);
    if (!queue?.playing || !queue.songs[0]) {
      return interaction.reply({ embeds: [errorEmbed('No hay música reproduciéndose.')], ephemeral: true });
    }
    const song = queue.songs[0];
    return interaction.reply({
      embeds: [new EmbedBuilder()
        .setColor(config.colors.music)
        .setTitle('🎵 Reproduciendo ahora')
        .setDescription(`**[${song.title}](${song.url})**`)
        .setThumbnail(song.thumbnail)
        .addFields(
          { name: '⏱ Duración', value: formatDuration(song.duration), inline: true },
          { name: '👤 Pedida por', value: `<@${song.requestedById}>`, inline: true },
          { name: '📋 Siguientes', value: `${queue.songs.length - 1} canciones`, inline: true },
          { name: '🔁 Loop', value: queue.loop, inline: true },
          { name: queue.paused ? '⏸ Estado' : '▶️ Estado', value: queue.paused ? 'Pausado' : 'Reproduciendo', inline: true },
        )
      ]
    });
  },
};

const volume = {
  data: new SlashCommandBuilder()
    .setName('volume')
    .setDescription('🔊 Ajusta el volumen (0-100)')
    .addIntegerOption(opt =>
      opt.setName('valor').setDescription('Volumen entre 0 y 100').setMinValue(0).setMaxValue(100).setRequired(true)
    ),

  execute(interaction, queues) {
    const queue = queues.get(interaction.guild.id);
    if (!queue?.playing) return interaction.reply({ embeds: [errorEmbed('No hay música reproduciéndose.')], ephemeral: true });
    const check = checkVoiceChannel(interaction, queue);
    if (!check.ok) return interaction.reply({ embeds: [check.embed], ephemeral: true });
    const val = interaction.options.getInteger('valor');
    queue.setVolume(val);
    return interaction.reply({ embeds: [successEmbed(`🔊 Volumen ajustado a **${val}%**`)] });
  },
};

const loop = {
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('🔁 Cambia el modo de repetición')
    .addStringOption(opt =>
      opt.setName('modo').setDescription('Modo de repetición').setRequired(true)
        .addChoices(
          { name: '❌ Sin repetición', value: 'off' },
          { name: '🔂 Repetir canción', value: 'song' },
          { name: '🔁 Repetir cola', value: 'queue' },
        )
    ),

  execute(interaction, queues) {
    const queue = queues.get(interaction.guild.id);
    if (!queue) return interaction.reply({ embeds: [errorEmbed('No hay música reproduciéndose.')], ephemeral: true });
    const check = checkVoiceChannel(interaction, queue);
    if (!check.ok) return interaction.reply({ embeds: [check.embed], ephemeral: true });
    const mode = interaction.options.getString('modo');
    queue.toggleLoop(mode);
    const labels = { off: '❌ Sin repetición', song: '🔂 Repetir canción actual', queue: '🔁 Repetir toda la cola' };
    return interaction.reply({ embeds: [successEmbed(`Modo loop: **${labels[mode]}**`)] });
  },
};

const shuffle = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('🔀 Mezcla la cola aleatoriamente'),

  execute(interaction, queues) {
    const queue = queues.get(interaction.guild.id);
    if (!queue || queue.songs.length < 2) {
      return interaction.reply({ embeds: [errorEmbed('No hay suficientes canciones en la cola.')], ephemeral: true });
    }
    const check = checkVoiceChannel(interaction, queue);
    if (!check.ok) return interaction.reply({ embeds: [check.embed], ephemeral: true });
    queue.shuffle();
    return interaction.reply({ embeds: [successEmbed(`🔀 Cola mezclada. (${queue.songs.length - 1} canciones)`)] });
  },
};

const remove = {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('🗑️ Elimina una canción de la cola')
    .addIntegerOption(opt =>
      opt.setName('posicion').setDescription('Posición en la cola').setMinValue(1).setRequired(true)
    ),

  execute(interaction, queues) {
    const queue = queues.get(interaction.guild.id);
    if (!queue || queue.songs.length <= 1) {
      return interaction.reply({ embeds: [errorEmbed('No hay canciones en la cola para eliminar.')], ephemeral: true });
    }
    const check = checkVoiceChannel(interaction, queue);
    if (!check.ok) return interaction.reply({ embeds: [check.embed], ephemeral: true });
    const pos = interaction.options.getInteger('posicion');
    const removed = queue.remove(pos);
    if (!removed) return interaction.reply({ embeds: [errorEmbed('Posición inválida.')], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed(`🗑️ Eliminada: **${removed.title}**`)] });
  },
};

const move = {
  data: new SlashCommandBuilder()
    .setName('move')
    .setDescription('↕️ [Premium] Mueve una canción en la cola')
    .addIntegerOption(opt => opt.setName('desde').setDescription('Posición actual').setMinValue(1).setRequired(true))
    .addIntegerOption(opt => opt.setName('hasta').setDescription('Nueva posición').setMinValue(1).setRequired(true)),

  execute(interaction, queues) {
    if (!isPremium(interaction.guild.id)) {
      return interaction.reply({ embeds: [premiumEmbed('Mover canciones en la cola')], ephemeral: true });
    }
    const queue = queues.get(interaction.guild.id);
    if (!queue || queue.songs.length <= 1) {
      return interaction.reply({ embeds: [errorEmbed('No hay suficientes canciones.')], ephemeral: true });
    }
    const from = interaction.options.getInteger('desde');
    const to = interaction.options.getInteger('hasta');
    const ok = queue.move(from, to);
    if (!ok) return interaction.reply({ embeds: [errorEmbed('Posición inválida.')], ephemeral: true });
    return interaction.reply({ embeds: [successEmbed(`↕️ Canción movida de la posición ${from} a la ${to}.`)] });
  },
};

module.exports = { skip, stop, pause, queueCmd, nowplaying, volume, loop, shuffle, remove, move };
