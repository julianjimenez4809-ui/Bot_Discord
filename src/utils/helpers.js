const play = require('play-dl');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../../config/config');

/**
 * Busca una canción/playlist en YouTube o SoundCloud
 * @param {string} query URL o nombre de búsqueda
 * @returns {{ type: 'song'|'playlist', data: object|object[] }}
 */
async function search(query) {
  // Detectar si es URL
  const isUrl = query.startsWith('http://') || query.startsWith('https://');

  if (isUrl) {
    // ── YouTube playlist ──────────────────
    if (play.yt_validate(query) === 'playlist') {
      const playlist = await play.playlist_info(query, { incomplete: true });
      const videos = await playlist.all_videos();
      return {
        type: 'playlist',
        name: playlist.title,
        data: videos.map(videoToSong),
      };
    }

    // ── YouTube video ─────────────────────
    if (play.yt_validate(query) === 'video') {
      const [info] = await play.video_info(query);
      return { type: 'song', data: videoToSong(info) };
    }

    // ── SoundCloud ────────────────────────
    if (query.includes('soundcloud.com')) {
      const scInfo = await play.soundcloud(query);
      return {
        type: 'song',
        data: {
          title: scInfo.name,
          url: scInfo.url,
          duration: scInfo.durationInSec,
          thumbnail: scInfo.thumbnail,
        },
      };
    }

    // ── Spotify (solo metadata, audio via YouTube) ──
    if (query.includes('spotify.com')) {
      if (play.sp_validate(query) === 'track') {
        const sp = await play.spotify(query);
        // Buscar en YouTube con el nombre de la canción de Spotify
        const results = await play.search(`${sp.name} ${sp.artists[0]?.name}`, {
          source: { youtube: 'video' }, limit: 1
        });
        if (!results.length) throw new Error('No encontré esa canción de Spotify en YouTube');
        return { type: 'song', data: videoToSong(results[0]) };
      }
    }
  }

  // ── Búsqueda por nombre ───────────────
  const results = await play.search(query, {
    source: { youtube: 'video' },
    limit: 1,
  });

  if (!results.length) throw new Error('No encontré ninguna canción con ese nombre');
  return { type: 'song', data: videoToSong(results[0]) };
}

/** Normaliza un video de YouTube a un objeto Song */
function videoToSong(video) {
  return {
    title: video.title,
    url: video.url,
    duration: video.durationInSec || 0,
    thumbnail: video.thumbnails?.[0]?.url || null,
    requestedById: null, // se asigna en el comando
  };
}

/** Embed de error estandarizado */
function errorEmbed(message) {
  return new EmbedBuilder()
    .setColor(config.colors.error)
    .setDescription(`${config.emojis.error} ${message}`);
}

/** Embed de éxito estandarizado */
function successEmbed(message) {
  return new EmbedBuilder()
    .setColor(config.colors.success)
    .setDescription(`${config.emojis.success} ${message}`);
}

/** Embed de bloqueo premium */
function premiumEmbed(featureName) {
  return new EmbedBuilder()
    .setColor(config.colors.premium)
    .setTitle('⭐ Función Premium')
    .setDescription(
      `**${featureName}** es una función exclusiva para servidores premium.\n\n` +
      `Usa \`/premium info\` para ver los beneficios y cómo activarlo.`
    )
    .setFooter({ text: 'Solo $2.99/mes por servidor' });
}

/** Verifica si el usuario está en el mismo canal de voz que el bot */
function checkVoiceChannel(interaction, queue) {
  const memberVC = interaction.member.voice.channel;
  if (!memberVC) {
    return { ok: false, embed: errorEmbed('¡Debes estar en un canal de voz!') };
  }
  if (queue && queue.voiceChannel.id !== memberVC.id) {
    return { ok: false, embed: errorEmbed('¡Debes estar en el mismo canal de voz que el bot!') };
  }
  return { ok: true };
}

/** Formatea duración en segundos a string legible */
function formatDuration(seconds) {
  if (!seconds) return '🔴 En vivo';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}h ${m}m ${s}s`
    : `${m}m ${s}s`;
}

/** Formatea segundos totales a "X horas Y minutos" */
function formatTotalDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m} minutos`;
}

/** Pagina un array para mostrar en embeds */
function paginate(array, page, perPage = 10) {
  const start = (page - 1) * perPage;
  const end = start + perPage;
  return {
    items: array.slice(start, end),
    totalPages: Math.ceil(array.length / perPage),
    currentPage: page,
  };
}

function buildQueueMessage(queue, page) {
  const { items, totalPages, currentPage } = paginate(queue.songs, page, 10);
  const totalDuration = queue.songs.reduce((acc, s) => acc + (s.duration || 0), 0);

  const list = items.map((s, i) => {
    const index = (currentPage - 1) * 10 + i;
    const prefix = index === 0 ? '▶️' : `\`${index}.\``;
    return `${prefix} **${s.title}** — ${formatDuration(s.duration)}`;
  }).join('\n');

  const embed = new EmbedBuilder()
    .setColor(config.colors.primary)
    .setTitle(`📋 Cola — ${queue.songs.length} canciones`)
    .setDescription(list)
    .addFields(
      { name: '⏱ Duración total', value: formatDuration(totalDuration), inline: true },
      { name: '🔁 Loop', value: queue.loop, inline: true },
      { name: '🔊 Volumen', value: `${Math.round(queue.volume * 100)}%`, inline: true },
    )
    .setFooter({ text: `Página ${currentPage}/${totalPages}` });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`queue_prev_${currentPage}`)
      .setLabel('◀️ Anterior')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 1),
    new ButtonBuilder()
      .setCustomId(`queue_next_${currentPage}`)
      .setLabel('Siguiente ▶️')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= totalPages),
  );

  return { embed, row };
}

module.exports = {
  search,
  errorEmbed,
  successEmbed,
  premiumEmbed,
  checkVoiceChannel,
  formatDuration,
  formatTotalDuration,
  paginate,
  buildQueueMessage,
};
