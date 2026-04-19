const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType,
} = require('@discordjs/voice');
const { spawn } = require('child_process');
const { PassThrough } = require('stream');
const path = require('path');
const { EmbedBuilder } = require('discord.js');
const ffmpegPath = require('ffmpeg-static');
const config = require('../../config/config');
const { addToHistory, incrementStats } = require('../database/db');

const ytdlpBin = process.platform === 'win32'
  ? path.join(__dirname, '../../yt-dlp.exe')
  : 'yt-dlp';

class MusicQueue {
  constructor(guild, textChannel, voiceChannel, premium = false) {
    this.guild = guild;
    this.textChannel = textChannel;
    this.voiceChannel = voiceChannel;
    this.premium = premium;

    this.songs = [];
    this.playing = false;
    this.paused = false;
    this.loop = 'off'; // 'off' | 'song' | 'queue'
    this.volume = config.music.defaultVolume;

    this.connection = null;
    this.player = createAudioPlayer();
    this.currentResource = null;
    this._ytdlpProcess = null;
    this._ffmpegProcess = null;
    this._inactivityTimer = null;

    this._setupPlayerEvents();
  }

  _setupPlayerEvents() {
    this.player.on(AudioPlayerStatus.Idle, () => {
      if (this.loop === 'song') {
        this._playCurrent();
      } else {
        if (this.loop === 'queue' && this.songs.length > 0) {
          this.songs.push(this.songs.shift());
        } else {
          this.songs.shift();
        }

        if (this.songs.length > 0) {
          this._playCurrent();
        } else {
          this.playing = false;
          this._startInactivityTimer();
          this.textChannel.send({
            embeds: [this._embed('📭 La cola ha terminado. ¡Hasta luego!', config.colors.music)]
          });
        }
      }
    });

    this.player.on('error', (error) => {
      console.error('[Player Error]', error.message);
      this.textChannel.send({
        embeds: [this._embed(`❌ Error al reproducir: ${error.message}`, config.colors.error)]
      });
      this.songs.shift();
      if (this.songs.length > 0) this._playCurrent();
    });
  }

  async connect() {
    this.connection = joinVoiceChannel({
      channelId: this.voiceChannel.id,
      guildId: this.guild.id,
      adapterCreator: this.guild.voiceAdapterCreator,
      selfDeaf: true,
    });

    this.connection.on('stateChange', (_oldState, newState) => {
      if (newState.networking) {
        newState.networking.once('stateChange', () => {});
      }
    });

    this.connection.subscribe(this.player);

    try {
      await entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
    } catch {
      this.connection.destroy();
      throw new Error('No pude conectar al canal de voz (timeout).');
    }

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000),
        ]);
      } catch {
        this.destroy();
      }
    });

    return this;
  }

  async _playCurrent() {
    const song = this.songs[0];
    if (!song) return;

    this._clearInactivityTimer();

    if (this._ytdlpProcess) { this._ytdlpProcess.kill(); this._ytdlpProcess = null; }
    if (this._ffmpegProcess) { this._ffmpegProcess.kill(); this._ffmpegProcess = null; }

    try {
      // yt-dlp descarga el audio y lo pasa por ffmpeg → opus para Discord
      const ytdlp = spawn(ytdlpBin, [
        '-f', 'bestaudio/best',
        '--no-playlist',
        '-o', '-',
        '--quiet',
        '--no-warnings',
        song.url,
      ]);

      const ffmpeg = spawn(ffmpegPath, [
        '-i', 'pipe:0',
        '-ac', '2',
        '-ar', '48000',
        '-f', 's16le',
        'pipe:1',
      ]);

      const passthrough = new PassThrough();
      ytdlp.stdout.pipe(ffmpeg.stdin);
      ffmpeg.stdout.pipe(passthrough);

      this._ytdlpProcess = ytdlp;
      this._ffmpegProcess = ffmpeg;

      ytdlp.stderr.on('data', (d) => {
        const msg = d.toString().trim();
        if (msg) console.error('[yt-dlp]', msg);
      });
      ffmpeg.stderr.on('data', () => {});

      ytdlp.on('error', (err) => {
        console.error('[yt-dlp spawn error]', err);
        this.textChannel.send({
          embeds: [this._embed(`❌ No pude reproducir **${song.title}**. Saltando...`, config.colors.error)]
        });
        this.songs.shift();
        if (this.songs.length > 0) this._playCurrent();
      });

      this.currentResource = createAudioResource(passthrough, {
        inputType: StreamType.Raw,
        inlineVolume: true,
      });

      this.currentResource.volume?.setVolume(this.volume);
      this.player.play(this.currentResource);
      this.playing = true;
      this.paused = false;

      addToHistory(this.guild.id, song.requestedById, song);
      if (song.duration) incrementStats(this.guild.id, song.duration);

      this.textChannel.send({ embeds: [this._nowPlayingEmbed(song)] });

    } catch (error) {
      console.error('[Stream Error]', error);
      this.textChannel.send({
        embeds: [this._embed(`❌ No pude reproducir **${song.title}**. Saltando...`, config.colors.error)]
      });
      this.songs.shift();
      if (this.songs.length > 0) this._playCurrent();
    }
  }

  addSong(song) {
    this.songs.push(song);
    if (!this.playing) this._playCurrent();
  }

  addSongs(songs) {
    this.songs.push(...songs);
    if (!this.playing) this._playCurrent();
  }

  skip() {
    this.player.stop();
  }

  pause() {
    if (this.paused) return false;
    this.player.pause();
    this.paused = true;
    return true;
  }

  resume() {
    if (!this.paused) return false;
    this.player.unpause();
    this.paused = false;
    return true;
  }

  stop() {
    this.songs = [];
    this.player.stop();
    this.playing = false;
    if (this._ytdlpProcess) { this._ytdlpProcess.kill(); this._ytdlpProcess = null; }
    if (this._ffmpegProcess) { this._ffmpegProcess.kill(); this._ffmpegProcess = null; }
  }

  setVolume(percent) {
    this.volume = percent / 100;
    this.currentResource?.volume?.setVolume(this.volume);
  }

  shuffle() {
    if (this.songs.length <= 1) return false;
    const current = this.songs.shift();
    this.songs.sort(() => Math.random() - 0.5);
    this.songs.unshift(current);
    return true;
  }

  toggleLoop(mode) {
    if (['off', 'song', 'queue'].includes(mode)) {
      this.loop = mode;
    } else {
      const modes = ['off', 'song', 'queue'];
      this.loop = modes[(modes.indexOf(this.loop) + 1) % modes.length];
    }
    return this.loop;
  }

  move(from, to) {
    if (from < 1 || to < 1 || from >= this.songs.length || to >= this.songs.length) return false;
    const [song] = this.songs.splice(from, 1);
    this.songs.splice(to, 0, song);
    return true;
  }

  remove(index) {
    if (index < 1 || index >= this.songs.length) return null;
    return this.songs.splice(index, 1)[0];
  }

  destroy() {
    this._clearInactivityTimer();
    this.stop();
    try { this.connection?.destroy(); } catch {}
  }

  _startInactivityTimer() {
    const timeout = this.premium
      ? config.music.inactivityTimeoutPremium
      : config.music.inactivityTimeoutFree;
    if (timeout === 0) return;
    this._inactivityTimer = setTimeout(() => {
      this.textChannel.send({
        embeds: [this._embed('💤 Desconectado por inactividad.', config.colors.warning)]
      });
      this.destroy();
    }, timeout);
  }

  _clearInactivityTimer() {
    if (this._inactivityTimer) {
      clearTimeout(this._inactivityTimer);
      this._inactivityTimer = null;
    }
  }

  _nowPlayingEmbed(song) {
    return new EmbedBuilder()
      .setColor(config.colors.music)
      .setAuthor({ name: '🎵 Reproduciendo ahora' })
      .setTitle(song.title)
      .setURL(song.url)
      .setThumbnail(song.thumbnail || null)
      .addFields(
        { name: '⏱ Duración', value: formatDuration(song.duration), inline: true },
        { name: '👤 Pedida por', value: `<@${song.requestedById}>`, inline: true },
        { name: '📋 En cola', value: `${this.songs.length - 1} canciones`, inline: true },
        { name: '🔁 Loop', value: this.loop, inline: true },
        { name: '🔊 Volumen', value: `${Math.round(this.volume * 100)}%`, inline: true },
        ...(this.premium ? [{ name: '⭐ Premium', value: 'Activo', inline: true }] : []),
      );
  }

  _embed(description, color = config.colors.primary) {
    return new EmbedBuilder().setColor(color).setDescription(description);
  }
}

function formatDuration(seconds) {
  if (!seconds) return 'En vivo';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

module.exports = { MusicQueue, formatDuration };
