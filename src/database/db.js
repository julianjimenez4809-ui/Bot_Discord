const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('../../config/config');

// Crear carpeta data si no existe
const dataDir = path.dirname(config.db.path);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(config.db.path);

// Activar WAL para mejor rendimiento
db.pragma('journal_mode = WAL');

// ─────────────────────────────────────────
// TABLAS
// ─────────────────────────────────────────
db.exec(`
  -- Servidores: configuración y estado premium
  CREATE TABLE IF NOT EXISTS guilds (
    guild_id      TEXT PRIMARY KEY,
    prefix        TEXT DEFAULT '!',
    premium       INTEGER DEFAULT 0,
    premium_until INTEGER DEFAULT 0,
    dj_role       TEXT,
    volume        REAL DEFAULT 0.5,
    created_at    INTEGER DEFAULT (unixepoch())
  );

  -- Playlists guardadas por usuario
  CREATE TABLE IF NOT EXISTS playlists (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL,
    guild_id   TEXT NOT NULL,
    name       TEXT NOT NULL,
    songs      TEXT NOT NULL,  -- JSON array de canciones
    created_at INTEGER DEFAULT (unixepoch()),
    UNIQUE(user_id, guild_id, name)
  );

  -- Historial de reproducción (para !history)
  CREATE TABLE IF NOT EXISTS history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    title      TEXT NOT NULL,
    url        TEXT NOT NULL,
    duration   INTEGER,
    played_at  INTEGER DEFAULT (unixepoch())
  );

  -- Estadísticas del bot
  CREATE TABLE IF NOT EXISTS stats (
    guild_id    TEXT PRIMARY KEY,
    songs_played INTEGER DEFAULT 0,
    total_time   INTEGER DEFAULT 0
  );

  -- Favoritos por usuario
  CREATE TABLE IF NOT EXISTS favorites (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    TEXT NOT NULL,
    title      TEXT NOT NULL,
    url        TEXT NOT NULL,
    duration   INTEGER DEFAULT 0,
    thumbnail  TEXT,
    added_at   INTEGER DEFAULT (unixepoch()),
    UNIQUE(user_id, url)
  );
`);

// ─────────────────────────────────────────
// FUNCIONES - GUILDS
// ─────────────────────────────────────────

/** Obtiene o crea la configuración de un servidor */
function getGuild(guildId) {
  let guild = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(guildId);
  if (!guild) {
    db.prepare('INSERT INTO guilds (guild_id) VALUES (?)').run(guildId);
    guild = db.prepare('SELECT * FROM guilds WHERE guild_id = ?').get(guildId);
  }
  return guild;
}

/** Verifica si un servidor tiene premium activo */
function isPremium(guildId) {
  const guild = getGuild(guildId);
  if (!guild.premium) return false;
  if (guild.premium_until === 0) return true; // Premium permanente
  return guild.premium_until > Date.now();
}

/** Activa el premium para un servidor */
function setPremium(guildId, durationMs) {
  const until = durationMs === 0 ? 0 : Date.now() + durationMs;
  db.prepare(`
    UPDATE guilds SET premium = 1, premium_until = ? WHERE guild_id = ?
  `).run(until, guildId);
}

/** Desactiva el premium */
function removePremium(guildId) {
  db.prepare(`
    UPDATE guilds SET premium = 0, premium_until = 0 WHERE guild_id = ?
  `).run(guildId);
}

/** Guarda el volumen preferido de un servidor */
function setVolume(guildId, volume) {
  getGuild(guildId);
  db.prepare('UPDATE guilds SET volume = ? WHERE guild_id = ?').run(volume, guildId);
}

// ─────────────────────────────────────────
// FUNCIONES - PLAYLISTS
// ─────────────────────────────────────────

function savePlaylist(userId, guildId, name, songs) {
  db.prepare(`
    INSERT INTO playlists (user_id, guild_id, name, songs)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(user_id, guild_id, name) DO UPDATE SET songs = excluded.songs
  `).run(userId, guildId, name, JSON.stringify(songs));
}

function getPlaylist(userId, guildId, name) {
  const row = db.prepare(`
    SELECT * FROM playlists WHERE user_id = ? AND guild_id = ? AND name = ?
  `).get(userId, guildId, name);
  if (!row) return null;
  return { ...row, songs: JSON.parse(row.songs) };
}

function getUserPlaylists(userId, guildId) {
  return db.prepare(`
    SELECT id, name, created_at FROM playlists WHERE user_id = ? AND guild_id = ?
  `).all(userId, guildId);
}

function deletePlaylist(userId, guildId, name) {
  return db.prepare(`
    DELETE FROM playlists WHERE user_id = ? AND guild_id = ? AND name = ?
  `).run(userId, guildId, name).changes;
}

// ─────────────────────────────────────────
// FUNCIONES - HISTORIAL
// ─────────────────────────────────────────

function addToHistory(guildId, userId, song) {
  db.prepare(`
    INSERT INTO history (guild_id, user_id, title, url, duration)
    VALUES (?, ?, ?, ?, ?)
  `).run(guildId, userId, song.title, song.url, song.duration);

  // Mantener solo los últimos 50 registros por servidor
  db.prepare(`
    DELETE FROM history WHERE guild_id = ? AND id NOT IN (
      SELECT id FROM history WHERE guild_id = ? ORDER BY played_at DESC LIMIT 50
    )
  `).run(guildId, guildId);
}

function getHistory(guildId, limit = 10) {
  return db.prepare(`
    SELECT * FROM history WHERE guild_id = ? ORDER BY played_at DESC LIMIT ?
  `).all(guildId, limit);
}

// ─────────────────────────────────────────
// FUNCIONES - ESTADÍSTICAS
// ─────────────────────────────────────────

function incrementStats(guildId, durationSec) {
  db.prepare(`
    INSERT INTO stats (guild_id, songs_played, total_time)
    VALUES (?, 1, ?)
    ON CONFLICT(guild_id) DO UPDATE SET
      songs_played = songs_played + 1,
      total_time = total_time + ?
  `).run(guildId, durationSec, durationSec);
}

function getStats(guildId) {
  return db.prepare('SELECT * FROM stats WHERE guild_id = ?').get(guildId) || {
    songs_played: 0, total_time: 0
  };
}

// ─────────────────────────────────────────
// FUNCIONES - FAVORITOS
// ─────────────────────────────────────────

function addFavorite(userId, song) {
  return db.prepare(`
    INSERT OR IGNORE INTO favorites (user_id, title, url, duration, thumbnail)
    VALUES (?, ?, ?, ?, ?)
  `).run(userId, song.title, song.url, song.duration || 0, song.thumbnail || null).changes;
}

function removeFavorite(userId, id) {
  return db.prepare(`
    DELETE FROM favorites WHERE id = ? AND user_id = ?
  `).run(id, userId).changes;
}

function getUserFavorites(userId) {
  return db.prepare(`
    SELECT * FROM favorites WHERE user_id = ? ORDER BY added_at DESC
  `).all(userId);
}

function getMostPlayed(guildId, limit = 5) {
  return db.prepare(`
    SELECT title, url, COUNT(*) as play_count
    FROM history WHERE guild_id = ?
    GROUP BY url ORDER BY play_count DESC LIMIT ?
  `).all(guildId, limit);
}

module.exports = {
  db,
  getGuild,
  isPremium,
  setPremium,
  removePremium,
  setVolume,
  savePlaylist,
  getPlaylist,
  getUserPlaylists,
  deletePlaylist,
  addToHistory,
  getHistory,
  incrementStats,
  getStats,
  addFavorite,
  removeFavorite,
  getUserFavorites,
  getMostPlayed,
};
