import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ActivityType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from "discord.js";
import { LINKS, MASK, answer, helpText } from "./brain.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const envPath = path.join(root, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text.startsWith("#")) continue;
    const at = text.indexOf("=");
    if (at > 0) process.env[text.slice(0, at).trim()] ||= text.slice(at + 1).trim();
  }
}

const token = process.env.DISCORD_TOKEN || "";
const guildId = process.env.DISCORD_GUILD_ID || "";
if (!token) {
  console.error("Missing DISCORD_TOKEN in the project .env.local");
  process.exit(1);
}

function channelRef(guild, name, fallback) {
  const channel = guild.channels.cache.find((entry) => entry.name === name && entry.type === 0);
  return channel ? `<#${channel.id}>` : fallback;
}

function refsFor(guild) {
  return {
    tech: channelRef(guild, "tech-support", "#tech-support"),
    rules: channelRef(guild, "rules", "#rules"),
    bugs: channelRef(guild, "report-a-bug", "#report-a-bug"),
    suggestions: channelRef(guild, "suggestions", "#suggestions"),
    support: channelRef(guild, "support-the-project", "#support-the-project"),
  };
}

const commands = [
  new SlashCommandBuilder()
    .setName("help")
    .setDescription("Ask the Happy Mask Salesman for help.")
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("download")
    .setDescription("Get the latest Majora Archive build.")
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("links")
    .setDescription("Show the official Majora Archive links.")
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("rules")
    .setDescription("Show the server rules.")
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Delete recent messages in this channel.")
    .addIntegerOption((option) =>
      option
        .setName("amount")
        .setDescription("How many messages to remove (1–100).")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(100),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warn a member and record it in the mod log.")
    .addUserOption((option) =>
      option.setName("member").setDescription("Who needs the warning?").setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Why the warning?").setRequired(true).setMaxLength(400),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("timeout")
    .setDescription("Temporarily mute a member.")
    .addUserOption((option) =>
      option.setName("member").setDescription("Who needs a pause?").setRequired(true),
    )
    .addIntegerOption((option) =>
      option
        .setName("minutes")
        .setDescription("How long, in minutes (1–10080).")
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(10080),
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Why?").setRequired(true).setMaxLength(400),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .setDMPermission(false),
  new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Remove a member from the server.")
    .addUserOption((option) =>
      option.setName("member").setDescription("Who must leave?").setRequired(true),
    )
    .addStringOption((option) =>
      option.setName("reason").setDescription("Why must they leave?").setRequired(true).setMaxLength(400),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .setDMPermission(false),
].map((command) => command.toJSON());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const cooldowns = new Map();
// What each person was last asking about, so a follow-up like "where does it go?"
// still lands on the right topic without repeating the keywords.
const memories = new Map();
const MEMORY_MS = 10 * 60 * 1000;

async function logAction(guild, action, target, moderator, reason, extra) {
  let channel = guild.channels.cache.find((entry) => entry.name === "mod-log" && entry.type === 0);
  if (!channel) {
    const fetched = await guild.channels.fetch().catch(() => null);
    channel = fetched?.find((entry) => entry.name === "mod-log" && entry.type === 0);
  }
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0xc6a2ff)
    .setTitle(`${MASK} ${action}`)
    .addFields(
      { name: "Member", value: `${target} (${target.id})`, inline: true },
      { name: "Moderator", value: `${moderator}`, inline: true },
      { name: "Reason", value: reason || "No reason given." },
    )
    .setTimestamp()
    .setFooter({ text: "Happy Mask Salesman" });
  if (extra) embed.addFields({ name: "Details", value: extra });

  await channel.send({ embeds: [embed] }).catch(() => {});
}

async function requirePermission(interaction, permission) {
  if (interaction.memberPermissions?.has(permission)) return true;
  await interaction.reply({
    content: `That mask is not yours to wear. ${MASK}`,
    flags: MessageFlags.Ephemeral,
  });
  return false;
}

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Logged in as ${readyClient.user.username} (${readyClient.user.id})`);
  readyClient.user.setPresence({
    status: "online",
    activities: [{ name: "over Termina", type: ActivityType.Watching }],
  });

  try {
    if (guildId) {
      await readyClient.application.commands.set(commands, guildId);
      console.log(`Registered ${commands.length} commands in guild ${guildId}`);
    } else {
      await readyClient.application.commands.set(commands);
      console.log(`Registered ${commands.length} global commands`);
    }
  } catch (error) {
    console.error(`Command registration failed: ${error.message}`);
  }
});

client.on(Events.MessageCreate, async (message) => {
  if (!message.inGuild() || message.author.bot || !client.user) return;
  if (message.channel.name === "mod-log") return;
  if (!message.mentions.has(client.user)) return;

  const key = `${message.guildId}:${message.channelId}:${message.author.id}`;
  const now = Date.now();
  if ((cooldowns.get(key) || 0) > now) {
    await message.react(MASK).catch(() => {});
    return;
  }
  cooldowns.set(key, now + 6000);
  if (cooldowns.size > 400) {
    for (const [entry, expires] of cooldowns) {
      if (expires < now) cooldowns.delete(entry);
    }
  }

  const text = message.content
    .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
    .trim();

  const remembered = memories.get(key);
  const lastTopic = remembered && now - remembered.at < MEMORY_MS ? remembered.topic : null;

  await message.react(MASK).catch(() => {});
  const reply = answer(text, {
    userId: message.author.id,
    refs: refsFor(message.guild),
    lastTopic,
  });

  memories.set(key, { topic: reply.topic, at: now });
  if (memories.size > 400) {
    for (const [entry, value] of memories) {
      if (now - value.at > MEMORY_MS) memories.delete(entry);
    }
  }

  const channel = message.channel;
  if (typeof channel.sendTyping === "function") {
    await channel.sendTyping().catch(() => {});
  }

  await message
    .reply({
      content: reply.text,
      allowedMentions: { repliedUser: true, parse: [] },
    })
    .catch((error) => console.error(`Reply failed: ${error.message}`));
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand() || !interaction.inGuild()) return;
  const guild = interaction.guild;
  if (!guild) return;

  try {
    switch (interaction.commandName) {
      case "help": {
        await interaction.reply({
          content: helpText(refsFor(guild)),
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      case "download": {
        await interaction.reply({
          content:
            `The current Windows build is here:\n${LINKS.RELEASES}\n\n` +
            `The archive's front door: ${LINKS.SITE}\n\n` +
            "The build is unsigned, so SmartScreen may warn about an unknown publisher. Check the SHA-256 on the release page.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      case "links": {
        await interaction.reply({
          content:
            `• Site: ${LINKS.SITE}\n` +
            `• Source: ${LINKS.GITHUB}\n` +
            `• Releases: ${LINKS.RELEASES}\n` +
            `• Support: ${LINKS.COFFEE}\n` +
            `• Invite: ${LINKS.INVITE}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      case "rules": {
        await interaction.reply({
          content: `The rules are few, and the moon remembers: ${channelRef(guild, "rules", "#rules")}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      case "purge": {
        if (!(await requirePermission(interaction, PermissionFlagsBits.KickMembers))) return;
        const amount = interaction.options.getInteger("amount", true);
        if (!interaction.channel?.isTextBased() || !("bulkDelete" in interaction.channel)) {
          await interaction.reply({
            content: `I can only sweep text, not shadows. ${MASK}`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        const deleted = await interaction.channel.bulkDelete(amount, true);
        await logAction(
          guild,
          "Messages purged",
          interaction.user,
          interaction.user,
          `Removed ${deleted.size} message(s) in ${interaction.channel}.`,
          `Channel: ${interaction.channel}`,
        );
        await interaction.reply({
          content: `The dust is swept. **${deleted.size}** message(s) removed. ${MASK}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      case "warn": {
        if (!(await requirePermission(interaction, PermissionFlagsBits.ModerateMembers))) return;
        const target = interaction.options.getMember("member");
        const reason = interaction.options.getString("reason", true);
        if (!target) {
          await interaction.reply({
            content: "That traveller is not in the square.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (target.user.bot || target.id === interaction.user.id) {
          await interaction.reply({
            content: `The mask refuses to warn itself or another mask. ${MASK}`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await target
          .send({
            content:
              `${MASK} **A warning from the Happy Mask Salesman**\n\n` +
              `You have been warned in **${guild.name}**.\n` +
              `**Reason:** ${reason}\n\n` +
              "Keep to the rules, and the moon will stay its course.",
          })
          .catch(() => {});
        await logAction(guild, "Warning", target.user, interaction.user, reason);
        await interaction.reply({
          content: `The warning has been recorded and slipped into ${target}'s DMs if the door was open. ${MASK}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      case "timeout": {
        if (!(await requirePermission(interaction, PermissionFlagsBits.ModerateMembers))) return;
        const target = interaction.options.getMember("member");
        const minutes = interaction.options.getInteger("minutes", true);
        const reason = interaction.options.getString("reason", true);
        if (!target) {
          await interaction.reply({
            content: "That traveller is not in the square.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (!target.moderatable || target.user.bot) {
          await interaction.reply({
            content: `That mask sits too high for me to touch. Ask a human moderator. ${MASK}`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await target.timeout(minutes * 60_000, reason);
        await logAction(
          guild,
          "Timeout",
          target.user,
          interaction.user,
          reason,
          `${minutes} minute(s)`,
        );
        await interaction.reply({
          content: `The clock tower has paused ${target} for **${minutes}** minute(s). ${MASK}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      case "kick": {
        if (!(await requirePermission(interaction, PermissionFlagsBits.KickMembers))) return;
        const target = interaction.options.getMember("member");
        const reason = interaction.options.getString("reason", true);
        if (!target) {
          await interaction.reply({
            content: "That traveller is not in the square.",
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        if (!target.kickable || target.user.bot) {
          await interaction.reply({
            content: `That mask sits too high for me to move. Ask a human moderator. ${MASK}`,
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
        await target.kick(reason);
        await logAction(guild, "Kick", target.user, interaction.user, reason);
        await interaction.reply({
          content: `The door to Termina closes for ${target}. ${MASK}`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      default:
        return;
    }
  } catch (error) {
    console.error(`Command ${interaction.commandName} failed:`, error);
    if (interaction.deferred || interaction.replied) {
      await interaction
        .followUp({
          content: `The mask slipped. ${MASK} Try again, or tell a human moderator.`,
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
    } else {
      await interaction
        .reply({
          content: `The mask slipped. ${MASK} Try again, or tell a human moderator.`,
          flags: MessageFlags.Ephemeral,
        })
        .catch(() => {});
    }
  }
});

client.on(Events.Error, (error) => console.error("Discord client error:", error));

process.on("unhandledRejection", (error) => {
  console.error("Unhandled rejection:", error);
});

client.login(token).catch((error) => {
  console.error(`Login failed: ${error.message}`);
  if (/disallowed intents/i.test(error.message)) {
    console.error(
      "Enable Message Content Intent in the Discord Developer Portal: Applications → Majora Archive setup → Bot → Privileged Gateway Intents.",
    );
  }
  process.exit(1);
});
