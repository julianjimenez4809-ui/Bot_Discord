# 🎵 Discord Music Bot

Bot de música para Discord con sistema premium integrado. Construido con Node.js, discord.js v14 y play-dl.

---

## ✨ Características

### Gratis
- Reproducción desde YouTube, SoundCloud y Spotify (via YouTube)
- Cola de hasta 20 canciones
- Comandos: play, skip, stop, pause, queue, nowplaying, volume, loop, shuffle, remove
- El bot se desconecta tras 3 minutos de inactividad

### ⭐ Premium
- Cola de hasta 500 canciones
- Playlists completas de YouTube
- Bot 24/7 sin desconectarse
- Audio de mayor calidad
- Guardar y cargar playlists personalizadas
- Comando /move para reordenar cola
- Historial de reproducción
- Estadísticas del servidor

---

## 🚀 Instalación

### 1. Clonar el proyecto
```bash
git clone https://github.com/tuusuario/discord-music-bot.git
cd discord-music-bot
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Configurar variables de entorno
```bash
cp .env.example .env
# Edita .env con tus valores
```

### 4. Crear el bot en Discord
1. Ve a https://discord.com/developers/applications
2. New Application → Bot → Add Bot
3. Activa los intents: Server Members, Message Content, Presence
4. Copia el token y ponlo en `.env`
5. En OAuth2 → URL Generator, selecciona: `bot` + `applications.commands`
6. Permisos: Connect, Speak, Send Messages, Read Message History, Embed Links

### 5. Ejecutar
```bash
# Desarrollo (con auto-reload)
npm run dev

# Producción
npm start
```

---

## 📁 Estructura del proyecto

```
discord-music-bot/
├── config/
│   └── config.js           ← Configuración centralizada
├── src/
│   ├── index.js            ← Punto de entrada principal
│   ├── commands/
│   │   ├── music/
│   │   │   ├── play.js     ← Comando /play
│   │   │   └── controls.js ← skip, stop, pause, queue, etc.
│   │   ├── premium/
│   │   │   ├── premium.js  ← Gestión de premium
│   │   │   └── playlist.js ← Playlists guardadas (premium)
│   │   └── info/
│   │       └── help.js     ← Comando /help
│   ├── events/
│   │   ├── ready.js        ← Evento cuando el bot arranca
│   │   └── interactionCreate.js ← Manejo de slash commands
│   ├── structures/
│   │   └── MusicQueue.js   ← Lógica central de la cola de música
│   ├── database/
│   │   └── db.js           ← SQLite: premium, playlists, historial
│   └── utils/
│       └── helpers.js      ← Búsqueda, embeds, utilidades
├── data/                   ← Base de datos (se crea automáticamente)
├── .env.example            ← Variables de entorno de ejemplo
├── .env                    ← TUS variables (no subir a git)
├── .gitignore
└── package.json
```

---

## 🎮 Comandos

| Comando | Descripción | Plan |
|---|---|---|
| `/play <canción>` | Reproduce o añade a la cola | Gratis |
| `/skip` | Salta la canción actual | Gratis |
| `/stop` | Detiene la música | Gratis |
| `/pause` | Pausa/reanuda | Gratis |
| `/queue` | Ver la cola | Gratis |
| `/nowplaying` | Canción actual | Gratis |
| `/volume <0-100>` | Ajusta el volumen | Gratis |
| `/loop <modo>` | Repetición | Gratis |
| `/shuffle` | Mezclar cola | Gratis |
| `/remove <pos>` | Eliminar canción | Gratis |
| `/play <playlist>` | Cargar playlist completa | ⭐ Premium |
| `/move <desde> <hasta>` | Mover canción en cola | ⭐ Premium |
| `/playlist guardar/cargar/lista/eliminar` | Playlists personalizadas | ⭐ Premium |
| `/premium info` | Ver beneficios | Gratis |
| `/premium estadisticas` | Stats del servidor | Gratis |
| `/premium activar <días>` | Activar premium | Admin |
| `/help` | Lista de comandos | Gratis |

---

## 🚢 Despliegue 24/7

### Con PM2 (en VPS)
```bash
npm install -g pm2
pm2 start src/index.js --name "music-bot"
pm2 save
pm2 startup
```

### Railway / Render
1. Sube el proyecto a GitHub
2. Conecta el repo en railway.app o render.com
3. Agrega las variables de entorno
4. Deploy automático

---

## 💰 Monetización

El sistema de premium está integrado directamente en el bot:

- **Gratis:** Funcionalidades básicas con límites
- **Premium ($2.99/mes):** Sin límites + funciones exclusivas

Para activar premium en un servidor:
```
/premium activar <días>   ← Como admin del servidor
```

Para monetización real, conecta con Stripe o usa la monetización nativa de Discord.

---

## 📄 Licencia

MIT — Úsalo libremente, da créditos si puedes 🙏
