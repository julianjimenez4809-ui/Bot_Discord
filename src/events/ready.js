const chalk = require('chalk');

module.exports = {
  name: 'clientReady',
  once: true,
  execute(client) {
    console.log(chalk.green(`\n✅ Bot conectado como ${chalk.bold(client.user.tag)}`));
    console.log(chalk.blue(`📡 Sirviendo en ${client.guilds.cache.size} servidores`));
    console.log(chalk.yellow(`🎵 Bot de música listo\n`));

    // Rotar el status cada 30 segundos
    const statuses = [
      { name: '/play para música 🎵', type: 2 },
      { name: `/help para comandos 📖`, type: 2 },
      { name: `${client.guilds.cache.size} servidores 🌐`, type: 3 },
    ];

    let i = 0;
    function rotateStatus() {
      const s = statuses[i % statuses.length];
      client.user.setActivity(s.name, { type: s.type });
      i++;
    }
    rotateStatus();
    setInterval(rotateStatus, 30_000);
  },
};
