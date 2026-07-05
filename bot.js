import {
  Client,
  Collection,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

if (!TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error("❌ DISCORD_TOKEN, DISCORD_CLIENT_ID ou DISCORD_GUILD_ID manquant !");
  process.exit(1);
}

const warnings = new Map();
const welcomeConfig = new Map();
const goodbyeConfig = new Map();
const logsConfig = new Map();
const openTickets = new Map();

async function sendLog(client, guildId, embed) {
  const channelId = logsConfig.get(guildId);
  if (!channelId) return;
  const channel = client.channels.cache.get(channelId);
  if (!channel) return;
  await channel.send({ embeds: [embed] }).catch(() => {});
}

const commands = [
  new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bannir un membre du serveur")
    .addUserOption(o => o.setName("membre").setDescription("Le membre à bannir").setRequired(true))
    .addStringOption(o => o.setName("raison").setDescription("Raison du ban"))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),

  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Expulser un membre du serveur")
    .addUserOption(o => o.setName("membre").setDescription("Le membre à expulser").setRequired(true))
    .addStringOption(o => o.setName("raison").setDescription("Raison du kick"))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

  new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Mettre en sourdine un membre (timeout)")
    .addUserOption(o => o.setName("membre").setDescription("Le membre à mute").setRequired(true))
    .addIntegerOption(o => o.setName("duree").setDescription("Durée en minutes").setRequired(true).setMinValue(1).setMaxValue(40320))
    .addStringOption(o => o.setName("raison").setDescription("Raison du mute"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Avertir un membre")
    .addUserOption(o => o.setName("membre").setDescription("Le membre à avertir").setRequired(true))
    .addStringOption(o => o.setName("raison").setDescription("Raison").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("warns")
    .setDescription("Voir les avertissements d'un membre")
    .addUserOption(o => o.setName("membre").setDescription("Le membre").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  new SlashCommandBuilder()
    .setName("clear")
    .setDescription("Supprimer des messages en masse")
    .addIntegerOption(o => o.setName("nombre").setDescription("Nombre (1-100)").setRequired(true).setMinValue(1).setMaxValue(100))
    .addUserOption(o => o.setName("membre").setDescription("Filtrer par membre"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Envoyer le panel de tickets")
    .addChannelOption(o => o.setName("salon").setDescription("Salon cible"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("welcome")
    .setDescription("Configurer le système de bienvenue")
    .addSubcommand(s => s.setName("configurer").setDescription("Configurer le salon")
      .addChannelOption(o => o.setName("salon").setDescription("Salon de bienvenue").setRequired(true))
      .addStringOption(o => o.setName("message").setDescription("Message ({user}, {server}, {count})")))
    .addSubcommand(s => s.setName("test").setDescription("Tester le message"))
    .addSubcommand(s => s.setName("desactiver").setDescription("Désactiver"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("logs")
    .setDescription("Configurer les logs de modération")
    .addSubcommand(s => s.setName("configurer").setDescription("Définir le salon de logs")
      .addChannelOption(o => o.setName("salon").setDescription("Salon des logs").setRequired(true)))
    .addSubcommand(s => s.setName("desactiver").setDescription("Désactiver les logs"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("goodbye")
    .setDescription("Configurer le message d'au revoir")
    .addSubcommand(s => s.setName("configurer").setDescription("Configurer le salon d'au revoir")
      .addChannelOption(o => o.setName("salon").setDescription("Salon d'au revoir").setRequired(true))
      .addStringOption(o => o.setName("message").setDescription("Message ({user}, {server}, {count})")))
    .addSubcommand(s => s.setName("test").setDescription("Tester le message d'au revoir"))
    .addSubcommand(s => s.setName("desactiver").setDescription("Désactiver les messages d'au revoir"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
];

const rest = new REST().setToken(TOKEN);
console.log("⏳ Enregistrement des commandes slash...");
await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), {
  body: commands.map(c => c.toJSON()),
});
console.log(`✅ ${commands.length} commandes enregistrées !`);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("clientReady", () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);
  client.user.setActivity("🛡️ Modération du serveur");
});

client.on("guildMemberAdd", async (member) => {
  const config = welcomeConfig.get(member.guild.id);
  if (!config) return;
  const channel = member.guild.channels.cache.get(config.channelId);
  if (!channel) return;
  const msg = config.message
    .replace("{user}", `<@${member.id}>`)
    .replace("{server}", member.guild.name)
    .replace("{count}", `${member.guild.memberCount}`);
  const embed = new EmbedBuilder()
    .setColor(0x2ecc71).setTitle("👋 Bienvenue !")
    .setDescription(msg).setThumbnail(member.user.displayAvatarURL())
    .addFields({ name: "Compte créé le", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`, inline: true })
    .setFooter({ text: `Membre #${member.guild.memberCount}` }).setTimestamp();
  await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
});

client.on("guildMemberRemove", async (member) => {
  const config = goodbyeConfig.get(member.guild.id);
  if (!config) return;
  const channel = member.guild.channels.cache.get(config.channelId);
  if (!channel) return;
  const msg = config.message
    .replace("{user}", `**${member.user.tag}**`)
    .replace("{server}", member.guild.name)
    .replace("{count}", `${member.guild.memberCount}`);
  const embed = new EmbedBuilder()
    .setColor(0xe74c3c).setTitle("👋 Au revoir !")
    .setDescription(msg).setThumbnail(member.user.displayAvatarURL())
    .addFields({ name: "Était membre depuis", value: member.joinedAt ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : "Inconnu", inline: true })
    .setFooter({ text: `Il reste ${member.guild.memberCount} membres` }).setTimestamp();
  await channel.send({ embeds: [embed] });
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    try {
      await handleCommand(interaction);
    } catch (err) {
      console.error(err);
      const msg = { content: "❌ Une erreur est survenue.", ephemeral: true };
      if (interaction.replied || interaction.deferred) await interaction.followUp(msg);
      else await interaction.reply(msg);
    }
  } else if (interaction.isButton()) {
    await handleButton(interaction);
  } else if (interaction.isModalSubmit()) {
    await handleModal(interaction);
  }
});

async function handleCommand(interaction) {
  const { commandName, guild, user, guildId } = interaction;

  if (commandName === "ban") {
    const target = interaction.options.getUser("membre", true);
    const raison = interaction.options.getString("raison") ?? "Aucune raison fournie";
    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });
    if (!member.bannable) return interaction.reply({ content: "❌ Impossible de bannir ce membre.", ephemeral: true });
    await member.ban({ reason: raison });
    const embed = new EmbedBuilder().setColor(0xe74c3c).setTitle("🔨 Membre banni")
      .addFields({ name: "Membre", value: `${target.tag}`, inline: true }, { name: "Modérateur", value: user.tag, inline: true }, { name: "Raison", value: raison }).setTimestamp();
    await interaction.reply({ embeds: [embed] });
    await sendLog(client, guildId, new EmbedBuilder().setColor(0xe74c3c).setTitle("🔨 BAN")
      .addFields({ name: "Membre", value: `${target.tag} (${target.id})`, inline: true }, { name: "Modérateur", value: user.tag, inline: true }, { name: "Raison", value: raison }).setTimestamp());
  }

  else if (commandName === "kick") {
    const target = interaction.options.getUser("membre", true);
    const raison = interaction.options.getString("raison") ?? "Aucune raison fournie";
    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });
    if (!member.kickable) return interaction.reply({ content: "❌ Impossible d'expulser ce membre.", ephemeral: true });
    await member.kick(raison);
    const embed = new EmbedBuilder().setColor(0xe67e22).setTitle("👢 Membre expulsé")
      .addFields({ name: "Membre", value: `${target.tag}`, inline: true }, { name: "Modérateur", value: user.tag, inline: true }, { name: "Raison", value: raison }).setTimestamp();
    await interaction.reply({ embeds: [embed] });
    await sendLog(client, guildId, new EmbedBuilder().setColor(0xe67e22).setTitle("👢 KICK")
      .addFields({ name: "Membre", value: `${target.tag} (${target.id})`, inline: true }, { name: "Modérateur", value: user.tag, inline: true }, { name: "Raison", value: raison }).setTimestamp());
  }

  else if (commandName === "mute") {
    const target = interaction.options.getUser("membre", true);
    const duree = interaction.options.getInteger("duree", true);
    const raison = interaction.options.getString("raison") ?? "Aucune raison fournie";
    const member = await guild.members.fetch(target.id).catch(() => null);
    if (!member) return interaction.reply({ content: "❌ Membre introuvable.", ephemeral: true });
    if (!member.moderatable) return interaction.reply({ content: "❌ Impossible de mute ce membre.", ephemeral: true });
    await member.timeout(duree * 60 * 1000, raison);
    const embed = new EmbedBuilder().setColor(0xf39c12).setTitle("🔇 Membre mis en sourdine")
      .addFields({ name: "Membre", value: `${target.tag}`, inline: true }, { name: "Modérateur", value: user.tag, inline: true }, { name: "Durée", value: `${duree} min`, inline: true }, { name: "Raison", value: raison }).setTimestamp();
    await interaction.reply({ embeds: [embed] });
    await sendLog(client, guildId, new EmbedBuilder().setColor(0xf39c12).setTitle("🔇 MUTE")
      .addFields({ name: "Membre", value: `${target.tag} (${target.id})`, inline: true }, { name: "Modérateur", value: user.tag, inline: true }, { name: "Durée", value: `${duree} min`, inline: true }, { name: "Raison", value: raison }).setTimestamp());
  }

  else if (commandName === "warn") {
    const target = interaction.options.getUser("membre", true);
    const raison = interaction.options.getString("raison", true);
    const key = `${guildId}-${target.id}`;
    const userWarns = warnings.get(key) ?? [];
    userWarns.push({ raison, date: new Date(), moderateur: user.tag });
    warnings.set(key, userWarns);
    try { await target.send(`⚠️ Avertissement sur **${guild.name}**\n**Raison :** ${raison}\n**Total :** ${userWarns.length}`); } catch {}
    const embed = new EmbedBuilder().setColor(0xf1c40f).setTitle("⚠️ Avertissement")
      .addFields({ name: "Membre", value: `${target.tag}`, inline: true }, { name: "Modérateur", value: user.tag, inline: true }, { name: "Total", value: `${userWarns.length}`, inline: true }, { name: "Raison", value: raison }).setTimestamp();
    await interaction.reply({ embeds: [embed] });
    await sendLog(client, guildId, new EmbedBuilder().setColor(0xf1c40f).setTitle("⚠️ WARN")
      .addFields({ name: "Membre", value: `${target.tag} (${target.id})`, inline: true }, { name: "Modérateur", value: user.tag, inline: true }, { name: "Total warns", value: `${userWarns.length}`, inline: true }, { name: "Raison", value: raison }).setTimestamp());
  }

  else if (commandName === "warns") {
    const target = interaction.options.getUser("membre", true);
    const key = `${guildId}-${target.id}`;
    const userWarns = warnings.get(key) ?? [];
    const embed = new EmbedBuilder().setColor(0x3498db).setTitle(`📋 Avertissements de ${target.tag}`)
      .setDescription(userWarns.length === 0 ? "Aucun avertissement." :
        userWarns.map((w, i) => `**${i + 1}.** ${w.raison}\n└ Par ${w.moderateur} le ${w.date.toLocaleDateString("fr-FR")}`).join("\n\n"))
      .setFooter({ text: `Total : ${userWarns.length}` }).setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  else if (commandName === "clear") {
    const nombre = interaction.options.getInteger("nombre", true);
    const target = interaction.options.getUser("membre");
    await interaction.deferReply({ ephemeral: true });
    const messages = await interaction.channel.messages.fetch({ limit: nombre });
    const toDelete = target ? messages.filter(m => m.author.id === target.id) : messages;
    const deleted = await interaction.channel.bulkDelete(toDelete, true);
    const embed = new EmbedBuilder().setColor(0x2ecc71).setTitle("🗑️ Messages supprimés")
      .addFields({ name: "Supprimés", value: `${deleted.size}`, inline: true }, { name: "Modérateur", value: user.tag, inline: true }, { name: "Salon", value: `<#${interaction.channelId}>`, inline: true }).setTimestamp();
    await interaction.editReply({ embeds: [embed] });
    await sendLog(client, guildId, new EmbedBuilder().setColor(0x2ecc71).setTitle("🗑️ CLEAR")
      .addFields({ name: "Supprimés", value: `${deleted.size}`, inline: true }, { name: "Modérateur", value: user.tag, inline: true }, { name: "Salon", value: `<#${interaction.channelId}>`, inline: true }).setTimestamp());
  }

  else if (commandName === "ticket") {
    const channel = interaction.options.getChannel("salon") ?? interaction.channel;
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle("🎫 Support & Tickets")
      .setDescription("Besoin d'aide ? Cliquez sur le bouton ci-dessous pour ouvrir un ticket.\nUn membre de l'équipe vous répondra rapidement.")
      .addFields({ name: "📌 Avant d'ouvrir un ticket", value: "• Vérifiez les salons d'aide\n• Soyez précis dans votre demande\n• Un ticket par sujet" })
      .setFooter({ text: "Système de tickets • Ne pas abuser" }).setTimestamp();
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId("open_ticket").setLabel("Ouvrir un ticket").setStyle(ButtonStyle.Primary).setEmoji("🎫"),
      new ButtonBuilder().setCustomId("ticket_info").setLabel("Informations").setStyle(ButtonStyle.Secondary).setEmoji("ℹ️")
    );
    await channel.send({ embeds: [embed], components: [row] });
    await interaction.reply({ content: "✅ Panel de tickets envoyé !", ephemeral: true });
  }

  else if (commandName === "welcome") {
    const sub = interaction.options.getSubcommand();
    if (sub === "configurer") {
      const channel = interaction.options.getChannel("salon", true);
      const message = interaction.options.getString("message") ?? "Bienvenue sur **{server}**, {user} ! 🎉\nNous sommes maintenant **{count}** membres.";
      welcomeConfig.set(guildId, { channelId: channel.id, message });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle("✅ Bienvenue configuré")
        .addFields({ name: "Salon", value: `<#${channel.id}>` }, { name: "Message", value: message }).setTimestamp()], ephemeral: true });
    } else if (sub === "test") {
      const config = welcomeConfig.get(guildId);
      if (!config) return interaction.reply({ content: "❌ Non configuré. Utilisez `/welcome configurer` d'abord.", ephemeral: true });
      const channel = guild.channels.cache.get(config.channelId);
      if (!channel) return interaction.reply({ content: "❌ Salon introuvable.", ephemeral: true });
      const msg = config.message.replace("{user}", `<@${user.id}>`).replace("{server}", guild.name).replace("{count}", `${guild.memberCount}`);
      await channel.send({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("👋 Bienvenue !").setDescription(msg).setThumbnail(user.displayAvatarURL()).setTimestamp()] });
      await interaction.reply({ content: "✅ Message de test envoyé !", ephemeral: true });
    } else if (sub === "desactiver") {
      welcomeConfig.delete(guildId);
      await interaction.reply({ content: "✅ Système de bienvenue désactivé.", ephemeral: true });
    }
  }

  else if (commandName === "logs") {
    const sub = interaction.options.getSubcommand();
    if (sub === "configurer") {
      const channel = interaction.options.getChannel("salon", true);
      logsConfig.set(guildId, channel.id);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x2ecc71).setTitle("✅ Logs configurés")
        .addFields({ name: "Salon", value: `<#${channel.id}>` }).setDescription("Toutes les actions de modération seront enregistrées ici.").setTimestamp()], ephemeral: true });
    } else if (sub === "desactiver") {
      logsConfig.delete(guildId);
      await interaction.reply({ content: "✅ Logs désactivés.", ephemeral: true });
    }
  }

  else if (commandName === "goodbye") {
    const sub = interaction.options.getSubcommand();
    if (sub === "configurer") {
      const channel = interaction.options.getChannel("salon", true);
      const message = interaction.options.getString("message") ?? "Au revoir **{user}** ! 😢\nNous sommes maintenant **{count}** membres sur **{server}**.";
      goodbyeConfig.set(guildId, { channelId: channel.id, message });
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("✅ Au revoir configuré")
        .addFields({ name: "Salon", value: `<#${channel.id}>` }, { name: "Message", value: message }).setTimestamp()], ephemeral: true });
    } else if (sub === "test") {
      const config = goodbyeConfig.get(guildId);
      if (!config) return interaction.reply({ content: "❌ Non configuré. Utilisez `/goodbye configurer` d'abord.", ephemeral: true });
      const channel = guild.channels.cache.get(config.channelId);
      if (!channel) return interaction.reply({ content: "❌ Salon introuvable.", ephemeral: true });
      const msg = config.message.replace("{user}", `**${user.tag}**`).replace("{server}", guild.name).replace("{count}", `${guild.memberCount}`);
      await channel.send({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("👋 Au revoir !")
        .setDescription(msg).setThumbnail(user.displayAvatarURL())
        .addFields({ name: "Était membre depuis", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true })
        .setFooter({ text: `Il reste ${guild.memberCount} membres` }).setTimestamp()] });
      await interaction.reply({ content: "✅ Message de test envoyé !", ephemeral: true });
    } else if (sub === "desactiver") {
      goodbyeConfig.delete(guildId);
      await interaction.reply({ content: "✅ Messages d'au revoir désactivés.", ephemeral: true });
    }
  }
}

async function handleButton(interaction) {
  const { customId, guild, user } = interaction;

  if (customId === "ticket_info") {
    return interaction.reply({ embeds: [new EmbedBuilder().setColor(0x5865f2).setTitle("ℹ️ Informations tickets")
      .setDescription("1. Cliquez sur **Ouvrir un ticket**\n2. Décrivez votre problème\n3. Un modérateur vous répondra\n4. Le ticket sera fermé une fois résolu\n\n⚠️ N'abusez pas du système.").setTimestamp()], ephemeral: true });
  }

  if (customId === "open_ticket") {
    const existing = openTickets.get(`${guild.id}-${user.id}`);
    if (existing) return interaction.reply({ content: `❌ Vous avez déjà un ticket ouvert : <#${existing}>`, ephemeral: true });
    const modal = new ModalBuilder().setCustomId("ticket_modal").setTitle("Ouvrir un ticket");
    modal.addComponents(
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("ticket_sujet").setLabel("Sujet").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(100)),
      new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("ticket_description").setLabel("Description détaillée").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(1000))
    );
    await interaction.showModal(modal);
  }

  if (customId === "close_ticket") {
    const channel = interaction.channel;
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(0xe74c3c).setTitle("🔒 Fermeture du ticket").setDescription("Ce ticket sera fermé dans 5 secondes...").setTimestamp()] });
    for (const [key, channelId] of openTickets.entries()) {
      if (channelId === channel.id) { openTickets.delete(key); break; }
    }
    setTimeout(() => channel.delete("Ticket fermé").catch(() => {}), 5000);
  }
}

async function handleModal(interaction) {
  if (interaction.customId === "ticket_modal") {
    const sujet = interaction.fields.getTextInputValue("ticket_sujet");
    const description = interaction.fields.getTextInputValue("ticket_description");
    const { guild, user } = interaction;
    await interaction.deferReply({ ephemeral: true });
    const ticketChannel = await guild.channels.create({
      name: `ticket-${user.username}`,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
      ],
    });
    openTickets.set(`${guild.id}-${user.id}`, ticketChannel.id);
    const embed = new EmbedBuilder().setColor(0x5865f2).setTitle(`🎫 Ticket — ${sujet}`).setDescription(description)
      .addFields({ name: "Ouvert par", value: `<@${user.id}>`, inline: true }, { name: "Date", value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true })
      .setFooter({ text: "Cliquez sur Fermer pour clôturer ce ticket" }).setTimestamp();
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId("close_ticket").setLabel("Fermer le ticket").setStyle(ButtonStyle.Danger).setEmoji("🔒"));
    await ticketChannel.send({ content: `<@${user.id}>`, embeds: [embed], components: [row] });
    await interaction.editReply({ content: `✅ Ticket créé : <#${ticketChannel.id}>` });
  }
}

await client.login(TOKEN);
