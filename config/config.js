require('dotenv').config();

module.exports = {
  // ── Bot ──────────────────────────────────
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID,
  prefix: process.env.PREFIX || '!',

  // ── Links ────────────────────────────────
  links: {
    support: process.env.BOT_SUPPORT_SERVER,
    invite: process.env.BOT_INVITE_LINK,
    website: process.env.BOT_WEBSITE,
    donate: process.env.BOT_DONATE_LINK,
  },

  // ── Música ───────────────────────────────
  music: {
    // Máximo de canciones en cola para usuarios FREE
    maxQueueFree: 20,
    // Máximo de canciones en cola para usuarios PREMIUM
    maxQueuePremium: 500,
    // Volumen por defecto (0 a 1)
    defaultVolume: 0.5,
    // Tiempo de inactividad antes de desconectarse (ms) - FREE
    inactivityTimeoutFree: 3 * 60 * 1000,       // 3 minutos
    // Tiempo de inactividad para PREMIUM (0 = nunca se desconecta)
    inactivityTimeoutPremium: 0,
    // Duración máxima de canción para FREE (segundos)
    maxDurationFree: 10 * 60,   // 10 minutos
    // Duración máxima para PREMIUM
    maxDurationPremium: 3 * 60 * 60, // 3 horas (para lives/radios)
  },

  // ── Premium ──────────────────────────────
  premium: {
    // Precio mensual en centavos (para Stripe)
    priceMonthly: 299, // $2.99
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhook: process.env.STRIPE_WEBHOOK_SECRET,
  },

  // ── Colores para embeds ──────────────────
  colors: {
    primary: 0x5865F2,    // Azul Discord
    success: 0x57F287,    // Verde
    error: 0xED4245,      // Rojo
    warning: 0xFEE75C,    // Amarillo
    premium: 0xF1C40F,    // Dorado
    music: 0x1DB954,      // Verde Spotify
  },

  // ── Emojis ───────────────────────────────
  emojis: {
    play: '▶️',
    pause: '⏸️',
    stop: '⏹️',
    skip: '⏭️',
    queue: '📋',
    shuffle: '🔀',
    loop: '🔁',
    volume: '🔊',
    music: '🎵',
    premium: '⭐',
    error: '❌',
    success: '✅',
    loading: '⏳',
    search: '🔍',
    link: '🔗',
  },

  // ── Favoritos ────────────────────────────
  favorites: {
    maxFree: 10,
    maxPremium: 100,
  },

  // ── Cooldowns (ms) ───────────────────────
  cooldowns: {
    free: 5000,
    premium: 1000,
  },

  // ── URLs permitidas ──────────────────────
  allowedDomains: [
    'youtube.com', 'www.youtube.com', 'youtu.be', 'music.youtube.com',
    'spotify.com', 'open.spotify.com',
    'soundcloud.com', 'www.soundcloud.com',
  ],

  // ── Base de datos ────────────────────────
  db: {
    path: process.env.DB_PATH || './data/database.sqlite',
  },
};
