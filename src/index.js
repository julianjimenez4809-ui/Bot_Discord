require('dotenv').config();
const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const config = require('../config/config');

// ─────────────────────────────────────────
// VALIDAR VARIABLES DE ENTORNO
// ─────────────────────────────────────────
if (!config.token) {
  console.error(chalk.red('❌ DISCORD_TOKEN no está definido en .env'));
  process.exit(1);
}
if (!config.clientId) {
  console.error(chalk.red('❌ CLIENT_ID no está definido en .env'));
  process.exit(1);
}

// ─────────────────────────────────────────
// CREAR CLIENTE
// ─────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

// Cola de música por servidor: Map<guildId, MusicQueue>
const queues = new Map();

// ─────────────────────────────────────────
// CARGAR COMANDOS
// ─────────────────────────────────────────
const commandsData = [];

function loadCommand(filePath) {
  const cmd = require(filePath);
  if (cmd.data && cmd.execute) {
    client.commands.set(cmd.data.name, cmd);
    commandsData.push(cmd.data.toJSON());
    console.log(chalk.cyan(`  ✔ /${cmd.data.name}`));
  } else if (typeof cmd === 'object') {
    for (const [, c] of Object.entries(cmd)) {
      if (c.data && c.execute) {
        client.commands.set(c.data.name, c);
        commandsData.push(c.data.toJSON());
        console.log(chalk.cyan(`  ✔ /${c.data.name}`));
      }
    }
  }
}

console.log(chalk.yellow('\n📦 Cargando comandos...'));
const commandDirs = ['music', 'premium', 'info'];
for (const dir of commandDirs) {
  const dirPath = path.join(__dirname, 'commands', dir);
  if (!fs.existsSync(dirPath)) continue;
  const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
  for (const file of files) {
    loadCommand(path.join(dirPath, file));
  }
}

// ─────────────────────────────────────────
// CARGAR EVENTOS
// ─────────────────────────────────────────
console.log(chalk.yellow('\n📡 Cargando eventos...'));
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(f => f.endsWith('.js'));

for (const file of eventFiles) {
  const event = require(path.join(eventsPath, file));
  const handler = (...args) => event.execute(...args, client, queues);
  if (event.once) {
    client.once(event.name, handler);
  } else {
    client.on(event.name, handler);
  }
  console.log(chalk.cyan(`  ✔ ${event.name}`));
}

// ─────────────────────────────────────────
// REGISTRAR SLASH COMMANDS EN DISCORD
// ─────────────────────────────────────────
async function registerCommands() {
  const rest = new REST({ version: '10' }).setToken(config.token);
  try {
    console.log(chalk.yellow('\n🔄 Registrando slash commands...'));

    if (config.guildId && process.env.NODE_ENV === 'development') {
      await rest.put(
        Routes.applicationGuildCommands(config.clientId, config.guildId),
        { body: commandsData }
      );
      console.log(chalk.green(`✅ ${commandsData.length} comandos registrados en servidor de pruebas`));
    } else {
      await rest.put(
        Routes.applicationCommands(config.clientId),
        { body: commandsData }
      );
      console.log(chalk.green(`✅ ${commandsData.length} comandos registrados globalmente`));
    }
  } catch (error) {
    console.error(chalk.red('❌ Error registrando comandos:'), error);
  }
}

// ─────────────────────────────────────────
// MANEJO DE ERRORES GLOBALES
// ─────────────────────────────────────────
process.on('unhandledRejection', (error) => {
  console.error(chalk.red('[UnhandledRejection]'), error);
});

process.on('uncaughtException', (error) => {
  console.error(chalk.red('[UncaughtException]'), error);
});

client.on('error', (error) => {
  console.error(chalk.red('[Client Error]'), error);
});

// ─────────────────────────────────────────
// ARRANCAR
// ─────────────────────────────────────────
(async () => {
  await registerCommands();
  await client.login(config.token);
})();
