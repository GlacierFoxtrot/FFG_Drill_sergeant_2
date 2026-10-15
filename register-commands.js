require('dotenv').config();
const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const commands = [
  new SlashCommandBuilder()
    .setName('verif')
    .setDescription('Accorde le rôle vérifié et ajoute [FFG] au pseudo')
    .addUserOption(option =>
      option.setName('utilisateur')
        .setDescription('La personne à vérifier')
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Envoie le panneau de contrôle permanent (Officiers uniquement)'),

  new SlashCommandBuilder()
    .setName('config-guerre')
    .setDescription('Configure les salons où envoyer les messages de guerre (Officiers uniquement)'),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log('Enregistrement des commandes slash...');

    // Enregistrement global (peut prendre jusqu'à 1h)
    // Pour un enregistrement instantané sur 1 serveur, utilise plutôt :
    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands }
    );

    console.log('✅ Commandes enregistrées avec succès !');
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement :', error);
  }
})();
