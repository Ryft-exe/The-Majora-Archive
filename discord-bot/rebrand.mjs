import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const envPath = path.join(root, ".env.local");
const env = {};
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text.startsWith("#")) continue;
    const at = text.indexOf("=");
    if (at > 0) env[text.slice(0, at).trim()] = text.slice(at + 1).trim();
  }
}

const token = env.DISCORD_TOKEN || process.env.DISCORD_TOKEN || "";
const guildId = env.DISCORD_GUILD_ID || process.env.DISCORD_GUILD_ID || "";
if (!token || !guildId) {
  console.error("Missing DISCORD_TOKEN or DISCORD_GUILD_ID in the project .env.local");
  process.exit(1);
}

const API = "https://discord.com/api/v10";
const headers = {
  Authorization: `Bot ${token}`,
  "Content-Type": "application/json",
  "User-Agent": "MajoraArchiveHelper/1.0 (https://github.com/Ryft-exe/The-Majora-Archive)",
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function api(method, endpoint, body) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(API + endpoint, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (response.status === 429) {
      let wait = 1;
      try {
        wait = (await response.json()).retry_after || 1;
      } catch {}
      await sleep(Math.ceil(wait * 1000) + 100);
      continue;
    }
    if (!response.ok) {
      let detail = "";
      try {
        detail = (await response.json()).message || "";
      } catch {}
      throw new Error(`${method} ${endpoint} -> HTTP ${response.status}${detail ? ` (${detail})` : ""}`);
    }
    if (response.status === 204) return null;
    return response.json();
  }
  throw new Error(`${method} ${endpoint} -> rate limited`);
}

const bit = {
  KICK_MEMBERS: 1n << 1n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  USE_EXTERNAL_EMOJIS: 1n << 18n,
  CHANGE_NICKNAME: 1n << 26n,
  MANAGE_NICKNAMES: 1n << 27n,
  VIEW_AUDIT_LOG: 1n << 7n,
  MANAGE_THREADS: 1n << 34n,
  MODERATE_MEMBERS: 1n << 40n,
  SEND_MESSAGES_IN_THREADS: 1n << 38n,
};

const botPermissions =
  bit.VIEW_CHANNEL |
  bit.SEND_MESSAGES |
  bit.SEND_MESSAGES_IN_THREADS |
  bit.READ_MESSAGE_HISTORY |
  bit.EMBED_LINKS |
  bit.ATTACH_FILES |
  bit.ADD_REACTIONS |
  bit.USE_EXTERNAL_EMOJIS |
  bit.MANAGE_MESSAGES |
  bit.MODERATE_MEMBERS |
  bit.KICK_MEMBERS |
  bit.CHANGE_NICKNAME;

const me = await api("GET", "/users/@me");
console.log(`Bot before: ${me.username} (${me.id})`);

const guild = await api("GET", `/guilds/${guildId}`);
let channels = await api("GET", `/guilds/${guildId}/channels`);
const roles = await api("GET", `/guilds/${guildId}/roles`);

const roleByName = (prefix) =>
  roles.find((role) => role.name.toLowerCase().startsWith(prefix.toLowerCase()));
const tatl = roleByName("tatl");
const fairy = roleByName("fairy");
const tael = roleByName("tael");
const botRole =
  roles.find((role) => role.tags?.bot_id === me.id) ||
  roles.find((role) => role.managed && role.name.toLowerCase().includes("setup"));

if (!botRole) {
  console.error("Could not find the bot's managed role.");
  process.exit(1);
}
console.log(`Bot role before: ${botRole.name} (${botRole.id})`);

// The mod-log is private, but visible to the three staff roles and the helper.
const staffAllow =
  bit.VIEW_CHANNEL | bit.SEND_MESSAGES | bit.READ_MESSAGE_HISTORY | bit.EMBED_LINKS;
const overwrites = [
  {
    id: guildId,
    type: 0,
    deny: String(bit.VIEW_CHANNEL | bit.SEND_MESSAGES),
    allow: "0",
  },
  ...[tatl, fairy, tael, botRole]
    .filter(Boolean)
    .map((role) => ({
      id: role.id,
      type: 0,
      allow: String(staffAllow),
      deny: "0",
    })),
];

let modLog = channels.find((channel) => channel.name === "mod-log" && channel.type === 0);
const info = channels.find((channel) => channel.name === "info" && channel.type === 4);
if (!modLog) {
  modLog = await api("POST", `/guilds/${guildId}/channels`, {
    name: "mod-log",
    type: 0,
    parent_id: info?.id,
    topic: "Moderator actions and warnings.",
    position: 9,
    permission_overwrites: overwrites,
  });
  channels.push(modLog);
  console.log("Created #mod-log");
} else {
  await api("PATCH", `/channels/${modLog.id}`, {
    topic: "Moderator actions and warnings.",
    permission_overwrites: overwrites,
  });
  console.log("Updated #mod-log");
}

// A bot cannot edit its own managed integration role. The owner can reset it
// by re-authorizing with this exact permission set (and the commands scope).
const reauthUrl =
  "https://discord.com/oauth2/authorize" +
  `?client_id=${me.id}` +
  "&scope=bot%20applications.commands" +
  `&permissions=${botPermissions}`;
console.log(`Reauthorize URL: ${reauthUrl}`);

const avatarPath = path.join(here, "avatar.png");
if (fs.existsSync(avatarPath)) {
  const avatar = `data:image/png;base64,${fs.readFileSync(avatarPath).toString("base64")}`;
  try {
    await api("PATCH", "/users/@me", { avatar });
    console.log("Bot avatar updated");
  } catch (error) {
    console.log(`Avatar update failed: ${error.message}`);
  }
}

for (const username of ["Happy Mask Salesman", "The Happy Mask Salesman"]) {
  try {
    await api("PATCH", "/users/@me", { username });
    console.log(`Bot username: ${username}`);
    break;
  } catch (error) {
    console.log(`Username "${username}" rejected: ${error.message}`);
  }
}

try {
  await api("PATCH", `/guilds/${guildId}/members/@me`, { nick: "Happy Mask Salesman" });
  console.log("Server nickname set");
} catch (error) {
  console.log(`Nickname failed: ${error.message}`);
}

const finalMe = await api("GET", "/users/@me");
const finalRoles = await api("GET", `/guilds/${guildId}/roles`);
const finalRole = finalRoles.find((role) => role.id === botRole.id);
const admin = finalRole ? (BigInt(finalRole.permissions || 0) & 8n) !== 0n : null;
const finalChannels = await api("GET", `/guilds/${guildId}/channels`);
const finalModLog = finalChannels.find((channel) => channel.name === "mod-log" && channel.type === 0);

console.log("--- rebrand summary ---");
console.log(`username: ${finalMe.username}`);
console.log(`role: ${finalRole?.name || "missing"} | administrator: ${admin}`);
console.log(`mod-log: ${finalModLog ? "present" : "missing"}`);
console.log("DONE");
