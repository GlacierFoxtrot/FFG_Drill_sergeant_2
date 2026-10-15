require('dotenv').config();
const {
  Client,
  GatewayIntentBits,
  Partials,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  MessageFlags
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// ====================== CONFIG ======================
const ROLE_OFFICIER = 'Officier';
const ROLE_SOUS_OFFICIER = 'sous-officier';
const ROLE_RECRUE = 'recrue';
const ROLE_SOLDAT = 'soldat';
const ROLE_ALLIE = 'allié';
const ROLE_MERCENAIRE = 'mercenaire';
const ROLE_COALITION = 'Membre de Coalition';
const ROLE_RESERVISTE = 'réserviste';

const TAG_FFG = 'FFG';
const TAG_WCI = 'WCI';

const CONFIG_PATH = path.join(__dirname, 'config.json');

// ====================== CLIENT ======================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages
  ],
  partials: [Partials.Channel]
});

// ====================== UTILITAIRES ======================
function loadConfig() {
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    if (!data.warChannels) data.warChannels = [];
    if (!data.notifyChannel) data.notifyChannel = null;
    return data;
  } catch {
    return { warChannels: [], notifyChannel: null };
  }
}

function saveConfig(config) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function hasOfficerRole(member) {
  return member.roles.cache.some(r => r.name === ROLE_OFFICIER);
}

function getRole(guild, name) {
  return guild.roles.cache.find(r => r.name === name);
}

/** Construit le pseudo avec un tag [XXX] */
function buildNickname(originalName, tag) {
  const prefix = `[${tag}] `;
  const maxLength = 32;
  let newName = prefix + (originalName || 'Utilisateur');
  if (newName.length > maxLength) {
    const available = maxLength - prefix.length;
    newName = prefix + originalName.slice(0, Math.max(0, available));
  }
  return newName;
}

/** Retire n'importe quel préfixe [XXX] */
function removeAnyTagPrefix(nickname) {
  if (!nickname) return nickname;
  return nickname.replace(/^\[[^\]]+\]\s*/, '').trim() || nickname;
}

/**
 * Applique le rôle + le tag au membre
 * (plus de rôle "vérifié")
 */
async function applyVerification(member, tag, specificRoleName) {
  const guild = member.guild;

  // Rôle spécifique
  const specificRole = getRole(guild, specificRoleName);
  if (specificRole) {
    await member.roles.add(specificRole).catch(() => {});
  }

  // Pseudo
  const originalName = member.displayName;
  const newNick = buildNickname(originalName, tag);
  try {
    await member.setNickname(newNick);
  } catch (e) {
    console.error(`Impossible de changer le pseudo de ${member.user.tag}:`, e.message);
  }

  return newNick;
}

/** Vérifie si le membre est protégé de la purge */
function isProtectedFromPurge(member) {
  const protectedRoles = [ROLE_OFFICIER, ROLE_SOUS_OFFICIER, ROLE_COALITION];
  return protectedRoles.some(name => member.roles.cache.some(r => r.name === name));
}

// ====================== READY ======================
client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
  client.user.setActivity('FFG • /panel', { type: 3 });
});

// ====================== INTERACTIONS ======================
client.on('interactionCreate', async (interaction) => {
  try {

    // =====================================================
    // SLASH COMMANDS
    // =====================================================
    if (interaction.isChatInputCommand()) {
      const { commandName } = interaction;

      // ---------- /verif ----------
      if (commandName === 'verif') {
        if (!hasOfficerRole(interaction.member)) {
          return interaction.reply({
            content: '❌ Seuls les **Officiers** peuvent utiliser cette commande.',
            flags: MessageFlags.Ephemeral
          });
        }

        const target = interaction.options.getMember('utilisateur');
        if (!target) {
          return interaction.reply({
            content: '❌ Utilisateur introuvable sur le serveur.',
            flags: MessageFlags.Ephemeral
          });
        }

        const select = new StringSelectMenuBuilder()
          .setCustomId(`verif_type_${target.id}`)
          .setPlaceholder('Choisis le type de vérification')
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel('FFG')
              .setDescription('Tag [FFG] + recrue / soldat / sous-officier')
              .setValue('ffg')
              .setEmoji('⚔️'),
            new StringSelectMenuOptionBuilder()
              .setLabel('Personnalisé / Coalition')
              .setDescription('Tag custom ou [WCI] + allié / mercenaire / Membre de Coalition')
              .setValue('perso')
              .setEmoji('🏷️')
          );

        const row = new ActionRowBuilder().addComponents(select);

        return interaction.reply({
          content: `Vérification de **${target.displayName}**\nChoisis le type :`,
          components: [row],
          flags: MessageFlags.Ephemeral
        });
      }

      // ---------- /panel ----------
      if (commandName === 'panel') {
        if (!hasOfficerRole(interaction.member)) {
          return interaction.reply({
            content: '❌ Seuls les **Officiers** peuvent envoyer le panneau.',
            flags: MessageFlags.Ephemeral
          });
        }

        const embed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setTitle('⚔️ Panneau de contrôle FFG')
          .setDescription(
            '**Vérification des soldats** → Retire les rôles recrue/soldat/allié/mercenaire + le tag du pseudo.\n' +
            'Les anciennes **recrues** et **soldats** reçoivent le rôle **réserviste**.\n' +
            'Les **Officiers**, **sous-officiers** et **Membres de Coalition** sont protégés.\n' +
            'Un message (FR + EN) est envoyé dans le salon de notification.\n\n' +
            '**Nouvelle guerre** → Envoie `-- War X --` dans les salons configurés.\n\n' +
            '**Configurer les salons** → Salons de guerre + salon de notification.'
          )
          .setFooter({ text: 'Réservé aux Officiers' });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('btn_verif_soldats')
            .setLabel('Vérification des soldats')
            .setStyle(ButtonStyle.Danger)
            .setEmoji('🛡️'),
          new ButtonBuilder()
            .setCustomId('btn_nouvelle_guerre')
            .setLabel('Nouvelle guerre')
            .setStyle(ButtonStyle.Success)
            .setEmoji('⚔️')
        );

        const row2 = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('btn_config_guerre')
            .setLabel('Salons de guerre')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('⚙️'),
          new ButtonBuilder()
            .setCustomId('btn_config_notify')
            .setLabel('Salon de notification')
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📢')
        );

        await interaction.reply({
          content: '✅ Panneau envoyé !',
          flags: MessageFlags.Ephemeral
        });

        await interaction.channel.send({
          embeds: [embed],
          components: [row, row2]
        });
      }

      // ---------- /config-guerre ----------
      if (commandName === 'config-guerre') {
        if (!hasOfficerRole(interaction.member)) {
          return interaction.reply({
            content: '❌ Seuls les **Officiers** peuvent configurer les salons.',
            flags: MessageFlags.Ephemeral
          });
        }

        const select = new ChannelSelectMenuBuilder()
          .setCustomId('select_war_channels')
          .setPlaceholder('Choisis les salons de guerre')
          .setMinValues(0)
          .setMaxValues(25)
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

        const row = new ActionRowBuilder().addComponents(select);
        const config = loadConfig();
        const current = config.warChannels.length > 0
          ? config.warChannels.map(id => `<#${id}>`).join(', ')
          : '*Aucun salon configuré*';

        return interaction.reply({
          content: `**Salons de guerre actuels :**\n${current}\n\nSélectionne les salons ci-dessous :`,
          components: [row],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // =====================================================
    // SELECT MENUS
    // =====================================================
    if (interaction.isStringSelectMenu()) {

      // ----- Choix du TYPE (FFG ou Perso) -----
      if (interaction.customId.startsWith('verif_type_')) {
        if (!hasOfficerRole(interaction.member)) {
          return interaction.reply({ content: '❌ Réservé aux Officiers.', flags: MessageFlags.Ephemeral });
        }

        const userId = interaction.customId.replace('verif_type_', '');
        const choice = interaction.values[0];

        if (choice === 'ffg') {
          const select = new StringSelectMenuBuilder()
            .setCustomId(`verif_ffg_role_${userId}`)
            .setPlaceholder('Choisis le rôle FFG')
            .addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel('Recrue')
                .setValue(ROLE_RECRUE)
                .setEmoji('🌱'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Soldat')
                .setValue(ROLE_SOLDAT)
                .setEmoji('⚔️'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Sous-officier')
                .setValue(ROLE_SOUS_OFFICIER)
                .setEmoji('🎖️')
            );

          const row = new ActionRowBuilder().addComponents(select);

          return interaction.update({
            content: `Type **FFG** sélectionné.\nChoisis le rôle pour <@${userId}> :`,
            components: [row]
          });
        }

        if (choice === 'perso') {
          // Menu pour choisir allié / mercenaire / Membre de Coalition
          const select = new StringSelectMenuBuilder()
            .setCustomId(`verif_perso_role_choice_${userId}`)
            .setPlaceholder('Choisis le rôle')
            .addOptions(
              new StringSelectMenuOptionBuilder()
                .setLabel('Allié')
                .setValue(ROLE_ALLIE)
                .setEmoji('🤝'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Mercenaire')
                .setValue(ROLE_MERCENAIRE)
                .setEmoji('💰'),
              new StringSelectMenuOptionBuilder()
                .setLabel('Membre de Coalition')
                .setValue(ROLE_COALITION)
                .setEmoji('🌐')
            );

          const row = new ActionRowBuilder().addComponents(select);

          return interaction.update({
            content: `Type **Personnalisé / Coalition** sélectionné.\nChoisis le rôle pour <@${userId}> :`,
            components: [row]
          });
        }
      }

      // ----- Choix du RÔLE pour FFG -----
      if (interaction.customId.startsWith('verif_ffg_role_')) {
        if (!hasOfficerRole(interaction.member)) {
          return interaction.reply({ content: '❌ Réservé aux Officiers.', flags: MessageFlags.Ephemeral });
        }

        const userId = interaction.customId.replace('verif_ffg_role_', '');
        const roleName = interaction.values[0];

        const member = await interaction.guild.members.fetch(userId).catch(() => null);
        if (!member) {
          return interaction.update({ content: '❌ Membre introuvable.', components: [] });
        }

        const newNick = await applyVerification(member, TAG_FFG, roleName);

        return interaction.update({
          content: `✅ **${member}** a été vérifié.\n` +
                   `• Tag : \`[FFG]\`\n` +
                   `• Rôle : **${roleName}**\n` +
                   `• Pseudo : \`${newNick}\``,
          components: []
        });
      }

      // ----- Choix du RÔLE pour Perso / Coalition -----
      if (interaction.customId.startsWith('verif_perso_role_choice_')) {
        if (!hasOfficerRole(interaction.member)) {
          return interaction.reply({ content: '❌ Réservé aux Officiers.', flags: MessageFlags.Ephemeral });
        }

        const userId = interaction.customId.replace('verif_perso_role_choice_', '');
        const roleName = interaction.values[0];

        // Si Membre de Coalition → tag fixe [WCI], on applique directement
        if (roleName === ROLE_COALITION) {
          const member = await interaction.guild.members.fetch(userId).catch(() => null);
          if (!member) {
            return interaction.update({ content: '❌ Membre introuvable.', components: [] });
          }

          const newNick = await applyVerification(member, TAG_WCI, roleName);

          return interaction.update({
            content: `✅ **${member}** a été vérifié.\n` +
                     `• Tag : \`[WCI]\`\n` +
                     `• Rôle : **${roleName}**\n` +
                     `• Pseudo : \`${newNick}\``,
            components: []
          });
        }

        // Sinon (allié ou mercenaire) → on demande le tag personnalisé via modal
        const modal = new ModalBuilder()
          .setCustomId(`verif_perso_modal_${userId}_${roleName}`)
          .setTitle('Tag personnalisé');

        const input = new TextInputBuilder()
          .setCustomId('custom_tag')
          .setLabel('Texte du tag (sans les crochets)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Ex: ABC ou ClanX')
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(15);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }
    }

    // =====================================================
    // MODAL (tag personnalisé pour allié / mercenaire)
    // =====================================================
    if (interaction.isModalSubmit() && interaction.customId.startsWith('verif_perso_modal_')) {
      if (!hasOfficerRole(interaction.member)) {
        return interaction.reply({ content: '❌ Réservé aux Officiers.', flags: MessageFlags.Ephemeral });
      }

      // customId = verif_perso_modal_USERID_ROLENAME
      const withoutPrefix = interaction.customId.replace('verif_perso_modal_', '');
      const lastUnderscore = withoutPrefix.lastIndexOf('_');
      const userId = withoutPrefix.slice(0, lastUnderscore);
      const roleName = withoutPrefix.slice(lastUnderscore + 1);

      let tag = interaction.fields.getTextInputValue('custom_tag').trim();
      tag = tag.replace(/^\[|\]$/g, '').trim();

      if (!tag) {
        return interaction.reply({
          content: '❌ Le tag ne peut pas être vide.',
          flags: MessageFlags.Ephemeral
        });
      }

      const member = await interaction.guild.members.fetch(userId).catch(() => null);
      if (!member) {
        return interaction.reply({ content: '❌ Membre introuvable.', flags: MessageFlags.Ephemeral });
      }

      const newNick = await applyVerification(member, tag, roleName);

      return interaction.reply({
        content: `✅ **${member}** a été vérifié.\n` +
                 `• Tag : \`[${tag}]\`\n` +
                 `• Rôle : **${roleName}**\n` +
                 `• Pseudo : \`${newNick}\``,
        flags: MessageFlags.Ephemeral
      });
    }

    // =====================================================
    // BOUTONS
    // =====================================================
    if (interaction.isButton()) {
      if (!hasOfficerRole(interaction.member)) {
        return interaction.reply({
          content: '❌ Seuls les **Officiers** peuvent utiliser ces boutons.',
          flags: MessageFlags.Ephemeral
        });
      }

      // Bouton A : Vérification des soldats → confirmation
      if (interaction.customId === 'btn_verif_soldats') {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('confirm_verif_soldats')
            .setLabel('Oui, confirmer')
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId('cancel_action')
            .setLabel('Annuler')
            .setStyle(ButtonStyle.Secondary)
        );

        return interaction.reply({
          content: '⚠️ **Confirmation requise**\n\n' +
                   'Cette action va :\n' +
                   '• Retirer les rôles **recrue / soldat / allié / mercenaire**\n' +
                   '• Retirer le tag `[...]` du pseudo\n' +
                   '• Donner le rôle **réserviste** aux anciennes **recrues** et **soldats**\n' +
                   '• Envoyer un message (FR + EN) dans le salon de notification\n\n' +
                   '**Protégés (non touchés)** : Officier, sous-officier, Membre de Coalition\n\nEs-tu sûr ?',
          components: [row],
          flags: MessageFlags.Ephemeral
        });
      }

      // Confirmation de la purge
      if (interaction.customId === 'confirm_verif_soldats') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const rolesToRemove = [
          getRole(interaction.guild, ROLE_RECRUE),
          getRole(interaction.guild, ROLE_SOLDAT),
          getRole(interaction.guild, ROLE_ALLIE),
          getRole(interaction.guild, ROLE_MERCENAIRE)
        ].filter(Boolean);

        const recrueRole = getRole(interaction.guild, ROLE_RECRUE);
        const soldatRole = getRole(interaction.guild, ROLE_SOLDAT);
        const reservisteRole = getRole(interaction.guild, ROLE_RESERVISTE);

        let removedRoles = 0;
        let nickUpdated = 0;
        let becameReserviste = 0;
        const affectedMembers = [];

        const members = await interaction.guild.members.fetch();

        for (const [, member] of members) {
          if (member.user.bot) continue;
          if (isProtectedFromPurge(member)) continue; // Officier / sous-officier / Membre de Coalition

          const hadRecrue = recrueRole && member.roles.cache.has(recrueRole.id);
          const hadSoldat = soldatRole && member.roles.cache.has(soldatRole.id);
          const hadAnyRole = rolesToRemove.some(r => member.roles.cache.has(r.id));

          if (hadAnyRole) {
            affectedMembers.push(member);
          }

          // Retire les rôles
          for (const role of rolesToRemove) {
            if (member.roles.cache.has(role.id)) {
              try {
                await member.roles.remove(role);
                removedRoles++;
              } catch (e) {
                console.error(`Erreur retrait rôle ${role.name} sur ${member.user.tag}:`, e.message);
              }
            }
          }

          // Ajoute réserviste uniquement pour ex-recrue et ex-soldat
          if ((hadRecrue || hadSoldat) && reservisteRole) {
            try {
              await member.roles.add(reservisteRole);
              becameReserviste++;
            } catch (e) {
              console.error(`Erreur ajout réserviste sur ${member.user.tag}:`, e.message);
            }
          }

          // Nettoie le pseudo
          const currentNick = member.nickname || member.user.username;
          if (/^\[[^\]]+\]/.test(currentNick)) {
            const cleanNick = removeAnyTagPrefix(currentNick);
            try {
              await member.setNickname(cleanNick === member.user.username ? null : cleanNick);
              nickUpdated++;
            } catch (e) {
              console.error(`Erreur pseudo ${member.user.tag}:`, e.message);
            }
          }
        }

        // Message de notification
        let notifyInfo = '';
        const config = loadConfig();
        if (config.notifyChannel && affectedMembers.length > 0) {
          const channel = interaction.guild.channels.cache.get(config.notifyChannel);
          if (channel && channel.isTextBased()) {
            const chunkSize = 40;
            for (let i = 0; i < affectedMembers.length; i += chunkSize) {
              const chunk = affectedMembers.slice(i, i + chunkSize);
              const mentions = chunk.map(m => `<@${m.id}>`).join(' ');

              const message =
                `${mentions}\n\n` +
                `🇫🇷 **Votre statut de vérification a été retiré.**\n` +
                `Si vous souhaitez récupérer vos accès, merci de refaire la vérification auprès d'un Officier.\n\n` +
                `🇬🇧 **Your verification status has been removed.**\n` +
                `If you wish to regain your access, please redo the verification with an Officer.`;

              try {
                await channel.send({ content: message, allowedMentions: { users: chunk.map(m => m.id) } });
              } catch (e) {
                console.error('Erreur envoi notification:', e.message);
              }
            }
            notifyInfo = `\n• Message de notification envoyé à **${affectedMembers.length}** personne(s)`;
          } else {
            notifyInfo = `\n⚠️ Salon de notification introuvable ou non configuré`;
          }
        } else if (!config.notifyChannel) {
          notifyInfo = `\n⚠️ Aucun salon de notification configuré`;
        }

        return interaction.editReply(
          `✅ **Vérification terminée**\n` +
          `• Rôles retirés : **${removedRoles}**\n` +
          `• Pseudos nettoyés : **${nickUpdated}**\n` +
          `• Anciennes recrues/soldats → **réserviste** : **${becameReserviste}**` +
          notifyInfo
        );
      }

      // Annulation
      if (interaction.customId === 'cancel_action') {
        return interaction.update({
          content: '❌ Action annulée.',
          components: []
        });
      }

      // Bouton B : Nouvelle guerre
      if (interaction.customId === 'btn_nouvelle_guerre') {
        const modal = new ModalBuilder()
          .setCustomId('modal_guerre')
          .setTitle('Nouvelle guerre');

        const input = new TextInputBuilder()
          .setCustomId('numero_guerre')
          .setLabel('Numéro de la guerre (ex: 3)')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Entre un nombre')
          .setRequired(true)
          .setMinLength(1)
          .setMaxLength(10);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        return interaction.showModal(modal);
      }

      // Config salons de guerre
      if (interaction.customId === 'btn_config_guerre') {
        const select = new ChannelSelectMenuBuilder()
          .setCustomId('select_war_channels')
          .setPlaceholder('Choisis les salons de guerre')
          .setMinValues(0)
          .setMaxValues(25)
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

        const row = new ActionRowBuilder().addComponents(select);
        const config = loadConfig();
        const current = config.warChannels.length > 0
          ? config.warChannels.map(id => `<#${id}>`).join(', ')
          : '*Aucun salon configuré*';

        return interaction.reply({
          content: `**Salons de guerre actuels :**\n${current}\n\nSélectionne les salons ci-dessous :`,
          components: [row],
          flags: MessageFlags.Ephemeral
        });
      }

      // Config salon de notification
      if (interaction.customId === 'btn_config_notify') {
        const select = new ChannelSelectMenuBuilder()
          .setCustomId('select_notify_channel')
          .setPlaceholder('Choisis le salon de notification')
          .setMinValues(0)
          .setMaxValues(1)
          .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement);

        const row = new ActionRowBuilder().addComponents(select);
        const config = loadConfig();
        const current = config.notifyChannel
          ? `<#${config.notifyChannel}>`
          : '*Aucun salon configuré*';

        return interaction.reply({
          content: `**Salon de notification actuel :**\n${current}\n\nSélectionne le salon où envoyer le message aux personnes qui perdent la vérification :`,
          components: [row],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    // =====================================================
    // MODAL GUERRE
    // =====================================================
    if (interaction.isModalSubmit() && interaction.customId === 'modal_guerre') {
      if (!hasOfficerRole(interaction.member)) {
        return interaction.reply({ content: '❌ Réservé aux Officiers.', flags: MessageFlags.Ephemeral });
      }

      const numero = interaction.fields.getTextInputValue('numero_guerre').trim();
      const config = loadConfig();

      if (!config.warChannels || config.warChannels.length === 0) {
        return interaction.reply({
          content: '❌ Aucun salon de guerre configuré.\nUtilise le bouton **Salons de guerre** ou `/config-guerre`.',
          flags: MessageFlags.Ephemeral
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      let success = 0;
      let failed = 0;

      for (const channelId of config.warChannels) {
        const channel = interaction.guild.channels.cache.get(channelId);
        if (!channel || !channel.isTextBased()) {
          failed++;
          continue;
        }
        try {
          await channel.send(`-- War ${numero} --`);
          success++;
        } catch (e) {
          console.error(`Erreur envoi dans ${channelId}:`, e.message);
          failed++;
        }
      }

      return interaction.editReply(
        `✅ Message **-- War ${numero} --** envoyé dans **${success}** salon(s).` +
        (failed > 0 ? `\n⚠️ ${failed} salon(s) ont échoué (permissions ?).` : '')
      );
    }

    // =====================================================
    // CHANNEL SELECT
    // =====================================================
    if (interaction.isChannelSelectMenu()) {
      if (!hasOfficerRole(interaction.member)) {
        return interaction.reply({ content: '❌ Réservé aux Officiers.', flags: MessageFlags.Ephemeral });
      }

      if (interaction.customId === 'select_war_channels') {
        const selected = interaction.values;
        const config = loadConfig();
        config.warChannels = selected;
        saveConfig(config);

        const list = selected.length > 0
          ? selected.map(id => `<#${id}>`).join(', ')
          : '*Aucun*';

        return interaction.update({
          content: `✅ **Salons de guerre mis à jour :**\n${list}`,
          components: []
        });
      }

      if (interaction.customId === 'select_notify_channel') {
        const selected = interaction.values;
        const config = loadConfig();
        config.notifyChannel = selected.length > 0 ? selected[0] : null;
        saveConfig(config);

        const text = config.notifyChannel
          ? `✅ Salon de notification défini : <#${config.notifyChannel}>`
          : '✅ Salon de notification désactivé.';

        return interaction.update({
          content: text,
          components: []
        });
      }
    }

  } catch (error) {
    console.error('Erreur interaction :', error);
    const msg = { content: '❌ Une erreur est survenue.', flags: MessageFlags.Ephemeral };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(msg).catch(() => {});
    } else {
      await interaction.reply(msg).catch(() => {});
    }
  }
});

// ====================== LOGIN ======================
client.login(process.env.DISCORD_TOKEN);
