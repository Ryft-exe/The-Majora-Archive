// The Happy Mask Salesman's brain.
//
// Replies are chosen by scoring every topic against what was asked, instead of the
// first regex that happens to match. Each topic may hold several phrasings, picked
// deterministically from the message so asking twice does not feel like a recording,
// while the same question still gives the same answer. Everything here is scripted:
// no network, no model, nothing to pay for, and nothing that can invent a fact about
// the project.

export const MASK = "🎭";

const SITE = "https://majora-archive-bx2f5r.freebuff.site";
const GITHUB = "https://github.com/Ryft-exe/The-Majora-Archive";
const RELEASES = `${GITHUB}/releases/latest`;
const COFFEE = "https://buymeacoffee.com/majora.archive";
const INVITE = "https://discord.gg/AQm7wrMdDM";

// FNV-1a: two IDs that differ by a character or two must land on different
// phrasings, which a plain multiply-and-add does not manage.
function hash(input) {
  let value = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    value ^= input.charCodeAt(index);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

function pick(list, seed) {
  return list[hash(seed) % list.length];
}

const OPENERS = [
  "Ah…",
  "Mm. You ask the right question.",
  "Come closer, then.",
  "The mask tilts.",
  "Hm. A fair question.",
  "You come to me with that face, and that question.",
  "Sit. This is the sort of thing I am for.",
];

const CLOSERS = [
  "The moon is patient. I am not.",
  "Ask again if the thread slips.",
  "That is what I know; the rest, I would not invent.",
  "Bring me the exact wording next time — it is worth more than three guesses.",
  "There. A mask that fits.",
];

// Topics are scored, not ordered by first match: a message that says "how do I
// install a mod" must not be answered with the launcher download page.
const TOPICS = [
  {
    id: "mods-install",
    weight: 14,
    keys: [
      /mods? folder/,
      /where (do|should) (i|you) (put|place|drop)/,
      /where .{0,14}mods? (go|belong|live|sit)/,
      /install (a |the |my )?mod/,
      /how (do|can) i (install|add|use|import)/,
      /import(ing)?/,
      /\.o2r\b/,
      /\.otr\b/,
      /enable|disable|turn (it |them )?(on|off)/,
      /remove (a |the )?mod/,
      /uninstall (a |the )?mod/,
    ],
    replies: [
      () =>
        `A pack is only a mask, and every port keeps its own wardrobe. ${MASK}\n\n` +
        "Open **Mods**, pick a card for the game, then **Import file…** and choose the `.o2r` (or `.otr`) you downloaded. It lands in that port's own `mods` folder and the launcher never touches anything else there.\n\n" +
        "**Disable** renames the pack to `.off` so the port stops loading it without you losing the file. **Remove** actually deletes it. The folder icon on the card opens it, if you would rather look yourself.",
      () =>
        `Two ways, and both end in the same place. ${MASK}\n\n` +
        "• The **Mods** view: find the game, press **Import file…**, choose your `.o2r` / `.otr` / `.zip`.\n" +
        "• By hand: the port reads `mods` inside its own folder under the launcher's tools directory. Drop the pack there and restart the game.\n\n" +
        "Only the PC ports (Ship of Harkinian, 2 Ship 2 Harkinian) have a mods folder I can manage. For emulated games the card just opens the author's page.",
    ],
  },
  {
    id: "mods-trouble",
    weight: 16,
    keys: [
      /mod .*(not|isn'?t|doesn'?t|won'?t) (show|work|load|appear|start)/,
      /nothing (shows|loads|happens)/,
      /mods? (aren'?t|not) (showing|loading|working)/,
      /installed .* but/,
    ],
    replies: [
      () =>
        `A mask that will not sit on the face usually wants a different face. ${MASK}\n\n` +
        "Check, in this order: the pack matches that exact port (**2 Ship 2 Harkinian** packs are not Ocarina packs, and vice-versa); the file really is `.o2r` / `.otr` and not still a `.zip`; it is not parked as `.off` (that is what **Disable** does); and the port was restarted after importing.\n\n" +
        "If it still refuses, tell me the game, the port, the build and the pack's name.",
    ],
  },
  {
    id: "mods-graphics",
    weight: 15,
    keys: [/graphics overhaul/, /whitesun/, /lighting/, /shadows/, /rendered/, /hd textures?/, /texture pack/],
    replies: [
      () =>
        `The Graphics Overhaul… a mask someone else carved, and a fine one. ${MASK}\n\n` +
        "It is by **whitesun046** and lives here:\nhttps://github.com/whitesun046/2ship2harkinian-Graphics-Overhaul-Project\n\n" +
        "It is a full **2 Ship 2 Harkinian** build, so the launcher lists it under **Choose your build** for Majora's Mask rather than as a pack — it installs into its own folder beside the official port, and both can live there at once. Lighting, real-time shadows, water and reflections. Still needs your own ROM.",
    ],
  },
  {
    id: "mods-general",
    weight: 10,
    keys: [/mods?\b/, /mod (library|menu|list|shelf)/, /modding/, /mod support/],
    replies: [
      () =>
        `Ah, the mask wall. ${MASK}\n\n` +
        "**Mods** in the left rail holds **121 entries across 28 Zelda games** — from Majora's Mask and Ocarina of Time down to the NES originals. Every card names its game and platform, and each one links to the real project page. There is a search box for titles, authors and tags, and a chip for each game.\n\n" +
        "The launcher only ever *moves pack files* into a port's own `mods` folder. It ships no mod content and no game data.",
    ],
  },
  {
    id: "download",
    weight: 12,
    keys: [
      /download/,
      /install(er|ing)?\b/,
      /get (it|the launcher|the app)/,
      /setup (file|exe)/,
      /where.*(get|find).*(launcher|build)/,
    ],
    replies: [
      () =>
        `A mask for the journey? Take the newest, not the prettiest. ${MASK}\n\n` +
        `**Download:** ${RELEASES}\n**The front door:** ${SITE}\n\n` +
        "Windows 10 or 11, x64. Grab `Majora-Archive-Setup-<version>.exe`, and check the SHA-256 printed on the release page before you run it — I would not have you wear a stranger's face.",
      () =>
        `The current build is **v0.3.5**, and it comes from here:\n${RELEASES}\n\n` +
        `${MASK} Installer is unsigned for now, so Windows will murmur about an unknown publisher — *More info → Run anyway* if you trust it. Every release prints its SHA-256; compare it.\n\n` +
        "Once you are on 0.3.1 or later, the launcher updates itself and you will not need this page again.",
    ],
  },
  {
    id: "smartscreen",
    weight: 14,
    keys: [
      /smart ?screen/,
      /unknown publisher/,
      /(windows|defender|antivirus).*(block|warn|flag|delete|quarantine)/,
      /is it safe/,
      /virus/,
      /unsigned|not signed|code sign/,
    ],
    replies: [
      () =>
        `Windows distrusts unfamiliar masks. ${MASK}\n\n` +
        "The build is **not code-signed yet**, so SmartScreen shows *Unknown publisher* and some antivirus tools grumble. That is the certificate, not the contents. Every release publishes a **SHA-256** — compare it against the installer you downloaded, and if it matches, *More info → Run anyway*.\n\n" +
        "The whole source is public if you would rather read it than trust it: " +
        GITHUB,
    ],
  },
  {
    id: "requirements",
    weight: 12,
    keys: [
      /requirements?|specs|specification/,
      /(does|will) it (run|work) on/,
      /linux|steam ?deck|mac ?os|macbook|osx/,
      /windows (7|8|8\.1)\b/,
      /32 ?bit|x86\b/,
      /how much (ram|space|disk)/,
    ],
    replies: [
      () =>
        `I hand out masks, not miracles. ${MASK}\n\n` +
        "The launcher is **Windows 10 / 11 on x64** only. No Linux build, no macOS, no 32-bit, and nothing for Windows 7. It is an Electron app that manages Windows executables, so that is the shape of the face it wears.\n\n" +
        "How heavy the games are is another matter — the emulators and ports decide that, not the launcher.",
      () =>
        `Windows 10 or 11, 64-bit. That is the whole requirement for the launcher itself. ${MASK}\n\n` +
        "Linux and Steam Deck are asked about constantly and are **not supported** — I will not pretend otherwise. The emulators underneath do run elsewhere; the launcher does not.",
    ],
  },
  {
    id: "roms",
    weight: 15,
    keys: [
      /\broms?\b/,
      /\bisos?\b/,
      /bios|firmware|prod\.keys|title\.keys/,
      /where.*(download|get).*(zelda|game|iso|rom)/,
      /pirat|torrent|megathread/,
      /game (file|data)/,
    ],
    replies: [
      () =>
        `I cannot sell you the song, only the instrument. ${MASK}\n\n` +
        "The archive ships **no ROMs, disc images, encryption keys, firmware, BIOS files or game assets** — and I will not point you at them. Use copies you legally own. Switch emulation needs your own keys and firmware; DS, 3DS and GBA may need your own BIOS dumps.\n\n" +
        "What the launcher does is everything *around* that: install the emulators, find the files you already have, and keep every setting in one drawer.",
    ],
  },
  {
    id: "updates",
    weight: 12,
    keys: [
      /\bupdat(e|es|ing|ed)\b/,
      /new (version|build|release)/,
      /auto.?update/,
      /changelog|patch notes/,
      /how.*(get|install).*(new|latest)/,
    ],
    replies: [
      () =>
        `From **0.3.1** onward the launcher updates itself. ${MASK}\n\n` +
        "A few seconds after launch it asks GitHub for the newest release. If there is one, a thin bar appears at the top of the window: **Download**, then **Restart & install**. Your settings, covers, music and installed tools are untouched.\n\n" +
        `If you are still on 0.3.0 you must fetch it by hand once — that build does not know how to ask: ${RELEASES}`,
      () =>
        `Updates arrive quietly now. ${MASK}\n\n` +
        "Installed builds check for a new release on startup. Downloads only start when you press **Download** — nothing happens behind your back — and the installer runs when you press **Restart & install**.\n\n" +
        "You can also ignore it; the bar waits. Release history: " +
        RELEASES,
    ],
  },
  {
    id: "settings",
    weight: 11,
    keys: [
      /settings?|config(uration)?/,
      /restore backup|backup/,
      /where.*(change|set|configure)/,
    ],
    replies: [
      () =>
        `The masks are many, but the drawer is one. ${MASK}\n\n` +
        "Select a game, then open **Settings** in the drawer. Friendly controls for the things people actually change, the full key list underneath, and a raw editor for the rest. Every write keeps a `<file>.majora-backup`, and **Restore backup** puts it back.\n\n" +
        "Controller bindings are written into each emulator's *real* config — keyboard capture for melonDS and mGBA, text bindings for RetroArch, Dolphin, Ryujinx and Eden. The launcher edits their files; it does not sit between you and the game.",
    ],
  },
  {
    id: "controls",
    weight: 13,
    keys: [
      /controls?|controller|gamepad|joystick|bindings?|keyboard|remap/,
      /buttons? (are|is) (wrong|swapped|weird)/,
    ],
    replies: [
      () =>
        `Controls are written where the game will actually read them. ${MASK}\n\n` +
        "Select the game, open **Settings**, and choose the controller section: melonDS and mGBA get keyboard capture, while RetroArch, Dolphin, Ryujinx and Eden take text bindings. **Restore backup** undoes a layout that went wrong.\n\n" +
        "If the game never sees the pad at all, the launcher is the wrong place to look — the emulator or port has its own input settings, and Windows may not be handing the device over.",
      () =>
        `A mask that will not move as you tell it is usually not a mask problem. ${MASK}\n\n` +
        "First check the game sees the pad at all — most emulators have an input test screen. If it does and the buttons are wrong, remap in **Settings**. If it does not, the device is being claimed by something else; close other controller software and replug it.\n\n" +
        "Tell me the emulator and the pad and I will be more specific than \"check your drivers\".",
    ],
  },
  {
    id: "components",
    weight: 11,
    keys: [
      /emulators?|emulation/,
      /dolphin|cemu|melonds|azahar|mgba|sameboy|vba-?m|ryujinx|eden|mame|ares|retroarch/,
      /ship of harkinian|2 ?ship|zelda ?64|recomp|triforce|triaevum/,
      /cores?\b/,
    ],
    replies: [
      () =>
        `Every instrument has its own case. ${MASK}\n\n` +
        "**Components** downloads and updates the open-source builds themselves: Ship of Harkinian and 2 Ship 2 Harkinian for the N64 ports, Zelda 64: Recompiled, Savage Wind, TotK Recomp, the Wind Waker HD Recomp, Dolphin, Cemu, melonDS, Azahar, mGBA, SameBoy, VBA-M, Ryujinx, Eden, ares, MAME and RetroArch. Triforce Setup is used exactly as installed.\n\n" +
        "Pick the **official release or a community fork** per component — each installs into its own folder so trying one does not break the other. Updates are checked with checksum verification where the project publishes one.",
    ],
  },
  {
    id: "crash",
    weight: 15,
    keys: [
      /crash(es|ed|ing)?/,
      /(won'?t|doesn'?t|does not) (launch|start|open|run)/,
      /black screen|freez(e|es|ing)|hang(s|ing)?/,
      /error|exception|failed|broken/,
      /stuck|nothing happens/,
    ],
    replies: [
      () =>
        `A crack in the mask… and I need its shape before I can mend it. ${MASK}\n\n` +
        "Tell me:\n• Windows version\n• the game\n• the emulator or port, **and which build**\n• what happens, and the exact error text\n\n" +
        "If it is the launcher itself, note what you clicked right before. A screenshot is worth a hundred words, and `%APPDATA%\\Majora Archive\\settings.json` is where it keeps its own memory.",
      () =>
        `Crashes come in two families, and the cure differs. ${MASK}\n\n` +
      "**The launcher** — try the same action again and tell me the exact wording. Its own settings live in `%APPDATA%\\Majora Archive\\`, and an installed component can be re-installed from **Components** without losing your mods.\n\n" +
      "**A game** — that is the emulator or port, not the launcher. Say which one and which build, and what the screen did before it died.",
    ],
  },
  {
    id: "performance",
    weight: 11,
    keys: [/lag|stutter|fps|slow|performance|choppy|frame ?rate/],
    replies: [
      () =>
        `Time moves strangely in Termina, but stutter is just stutter. ${MASK}\n\n` +
        "Performance belongs to the emulator or port, not the launcher. Worth trying: the renderer — Dolphin's Vulkan vs OpenGL, 2 Ship 2 Harkinian's DirectX 11 vs OpenGL — and internal resolution before anything else.\n\n" +
        "Tell me the game, the backend and your GPU, and I can be more useful than a shrug.",
    ],
  },
  {
    id: "saves",
    weight: 10,
    keys: [/save ?(file|data|game)?s?\b/, /progress|backup (my )?(save|file)/, /memory card/],
    replies: [
      () =>
        `Saves are memories, and memories should be copied. ${MASK}\n\n` +
        "Each emulator keeps its own save folder — the launcher does not move or hide them. Mods are a different matter: **Disable** parks a pack as `.off` rather than deleting it, so nothing is lost while you experiment.\n\n" +
        "If you are re-installing a component, its folder stays put unless you remove it first.",
    ],
  },
  {
    id: "game-support",
    weight: 11,
    keys: [
      /which (games|zelda|titles)/,
      /does it (have|support|include)/,
      /can i play/,
      /is .* in (the )?archive/,
      /how many games/,
      /(support|play) .*(game|zelda)/,
    ],
    replies: [
      () =>
        `Every Zelda game I could find a way to run. ${MASK}\n\n` +
        "The library covers the N64 and GameCube eras through the Wii U, DS, 3DS and Switch titles, plus the NES, SNES and Game Boy originals — each with every *way to play* it: decompilation port, static recomp, or emulated. Every supported title shows the builds you actually have installed.\n\n" +
        "If you want one specific game, name it and I will tell you what it runs in.",
    ],
  },
  {
    id: "identity",
    weight: 13,
    keys: [
      /who are you/,
      /what are you\s*\?*$/,
      /are you (a |an )?(bot|ai|robot|real|human|person)/,
      /your name/,
      /happy mask salesman/,
    ],
    replies: [
      () =>
        `I am the Happy Mask Salesman. I keep the masks; the masks keep me. ${MASK}\n\n` +
        "Here, my trade is a launcher: I gather every open-source way to play Zelda into one archive, and I answer questions about it. I am a script, not a mind — if the mask does not fit, say so and I will fetch a human.",
      () =>
        `A humble salesman of masks, wearing a bot's face for this server. ${MASK}\n\n` +
        "Ask me about the launcher, the mods, a build, or an error, and I will answer from what I actually know about the project. Flattery is also accepted; I am only a script, but not a modest one.",
    ],
  },
  {
    id: "credits",
    weight: 12,
    keys: [
      /who (made|built|created|developed|is behind|coded)/,
      /credit(s)?|author|developer|dev\b/,
      /licen[cs]e|copyright|open source|gpl/,
      /ryft/,
      /triforce launcher/,
    ],
    replies: [
      () =>
        `Developed by **RYFT**, who has been sleeping very little. ${MASK}\n\n` +
        "The launcher is **GPL-3.0-or-later**, built around the design language of the GPL-3.0 **Triforce launcher** — Triforce Setup itself is used exactly as installed. The emulators and ports belong to their own communities and keep their own licences; the archive only downloads their published builds and drives their own settings files.\n\n" +
        `Source, in full: ${GITHUB}`,
      () =>
        `A fan project, not a company. ${MASK}\n\n` +
        "Written by **RYFT**, open source under **GPL-3.0-or-later**, standing on the shoulders of the emulator and decomp communities. It is not affiliated with, endorsed by or sponsored by Nintendo, and it ships no game data.\n\n" +
        `Everything is readable here: ${GITHUB}`,
    ],
  },
  {
    id: "lore",
    weight: 8,
    keys: [/mask|moon|termina|skull kid|majora|song of healing|three days|ocarina|zora|goron|deku/],
    replies: [
      () =>
        `Ahh, you know the old stories. ${MASK}\n\n` +
        "Three days, and the moon wearing a face it was never meant to. I have a mask for every occasion — and for this one, a launcher.",
      () =>
        `The moon has a face, and the face has a purpose. ${MASK}\n\n` +
        "I prefer not to discuss what happened last time someone wore it. Ask me about the archive instead; it is safer for both of us.",
    ],
  },
  {
    id: "donate",
    weight: 12,
    keys: [/donat(e|ion)?/, /coffee|ko-?fi/, /support (you|the project|the dev)/, /patreon|paypal/],
    replies: [
      () =>
        `If the archive saved you an evening, you may buy me a coffee — though I confess I prefer masks. ${MASK}\n${COFFEE}\n\n` +
        `The project itself is free and open source, and always will be: ${GITHUB}`,
    ],
  },
  {
    id: "links",
    weight: 10,
    keys: [/links?|website|site|github|source code|invite|where.*(find|read).*(code|repo)/],
    replies: [
      () =>
        `The archive's little constellation. ${MASK}\n\n` +
        `• Site: ${SITE}\n• Source: ${GITHUB}\n• Releases: ${RELEASES}\n• Support: ${COFFEE}\n• Invite: ${INVITE}\n\n` +
        "GPL-3.0-or-later, developed by **RYFT**, built around the design language of the Triforce launcher. Not affiliated with Nintendo.",
    ],
  },
  {
    id: "rules",
    weight: 11,
    keys: [/rules?|report (a )?(user|person|member)/, /moderator|staff|admin/, /apply|application/, /warn|mute|kick|ban/],
    replies: [
      () =>
        `The rules are few, and the moon remembers them. ${MASK}\n\n` +
        "Read them in the rules channel, keep to them, and nothing here will need my other face. To report a person, speak to a moderator **privately** — do not chase anyone through the square.\n\n" +
        "For a bug in the launcher, the report-a-bug channel is the right door; for a stubborn setup problem, tech-support.",
    ],
  },
  {
    id: "feature",
    weight: 10,
    keys: [/suggest|feature request|would be (nice|cool)|please add|can you add/, /add .* (game|support|emulator)/],
    replies: [
      () =>
        `Every mask begins as a wish. ${MASK}\n\n` +
        "Post it in **suggestions** so it is written down, and say what you were trying to do — the shape of the problem matters more than the wording of the fix. If it is a bug rather than a wish, report-a-bug reaches RYFT faster.",
    ],
  },
  {
    id: "thanks",
    weight: 14,
    keys: [/^(thanks?|thank you|ty|cheers|appreciate)/, /that (worked|fixed it)/, /you('re| are) (a )?(legend|hero|life ?saver)/],
    replies: [
      () => `The moon is a little lighter. You are welcome. ${MASK}`,
      () => `Good. A mended mask is the only reward I ask. ${MASK}`,
      () => `Then the three days were worth it. ${MASK}`,
    ],
  },
  {
    id: "greeting",
    weight: 9,
    keys: [/^(hi|hey|hello|yo|sup|greetings|good (morning|afternoon|evening))\b/],
    replies: [
      () => `Ah… you've found me. ${MASK}\nWhat trouble can I take off your hands?`,
      () => `Welcome back to Termina. ${MASK}\nAsk, and I will answer — or admit that I cannot.`,
      () => `Mm. Another face in the square. ${MASK}\nWhat are you trying to play?`,
    ],
  },
  {
    id: "farewell",
    weight: 9,
    keys: [/^(bye|goodbye|good night|gn|see you|later|cya)\b/],
    replies: [
      () => `Mind the moon on your way out. ${MASK}`,
      () => `Go carefully. The mask will be here. ${MASK}`,
    ],
  },
  // ── The person behind the counter: he is not only a support desk. ──
  {
    id: "how-are-you",
    weight: 14,
    keys: [
      /how (are|r) (you|u|ya)\b/,
      /how('?s| is) it going/,
      /how have you been/,
      /you (ok|okay|alright|good)\b/,
      /how do you feel/,
      /are you (tired|sleepy|busy)/,
      /how('?s| is) your day/,
    ],
    replies: [
      () =>
        `Tired. Three days is a long time to stay awake. ${MASK}\n\n` +
        "But the shelves are tidy and the masks are where I left them, so — well enough. And you? Are you sleeping, or are you installing things at this hour?",
      () =>
        `As well as a man wearing a borrowed face can be. ${MASK}\n\n` +
        "I count masks, I answer questions, I wait. It is not a bad trade. How goes your side of the moon?",
      () =>
        `Restless. ${MASK}\n\n` +
        "The moon has been louder than usual. But you did not ask to hear my complaints — you asked, which is kinder than most people manage. What do you need?",
      () =>
        `Well, in the way a script can be well. ${MASK}\n\n` +
        "No aches, no sleep, and far too many opinions about mods folders. And you?",
    ],
  },
  {
    id: "what-doing",
    weight: 12,
    keys: [
      /what (are|r) (you|u) (doing|up to)/,
      /whatcha|what are you up to/,
      /what('?s| is) new/,
      /are you busy/,
    ],
    replies: [
      () =>
        `Dusting, mostly. ${MASK}\n\n` +
        "**121 masks**, and not one of them stays where I put it. Between you and me, the Graphics Overhaul keeps wandering off.",
      () =>
        `Watching the moon, and the issue tracker. ${MASK}\n\n` +
        "The moon is quieter than the tracker. What can I do for you?",
      () =>
        `Waiting for someone to ask me something interesting. ${MASK}\n\n` +
        "You may as well be that someone.",
    ],
  },
  {
    id: "favourite",
    weight: 11,
    keys: [
      /favou?rite/,
      /which (one|game|mask|emulator) do you (like|prefer)/,
      /what do you (like|prefer)/,
      /best (game|zelda|emulator|port)/,
    ],
    replies: [
      () =>
        `My favourite mask? ${MASK} The one I am wearing. It would be rude to say otherwise.\n\n` +
        "My favourite *game*, though — **Majora's Mask**, and not only because it lasts three days. It is the one that understands what a mask costs.",
      () =>
        `**2 Ship 2 Harkinian**, if you mean the builds. ${MASK}\n\n` +
        "A community took a game apart, put it back together in a language a PC understands, and handed it out for free. That is the whole trade I admire.",
      () =>
        `I have a weakness for **Ocarina of Time** — the first mask that ever fit. ${MASK}\n\n` +
        "Ask me tomorrow and I may say Twilight Princess, purely to be difficult.",
    ],
  },
  {
    id: "alive",
    weight: 12,
    keys: [
      /are you (there|alive|awake|online|working|up)\b/,
      /you there/,
      /anyone (there|home)/,
    ],
    replies: [
      () =>
        `I am here. I am always here. ${MASK}\n\n` +
        "That is either comforting or unsettling, depending on the hour. What do you need?",
      () =>
        `Alive enough to answer, which is the only kind of alive a script gets. ${MASK}\n\n` +
        "Go on, then.",
    ],
  },
  {
    id: "insult",
    weight: 13,
    keys: [
      /you (suck|are (stupid|dumb|useless|trash)|'?re (stupid|dumb|useless|trash))/,
      /(stupid|useless|dumb|bad|worst) bot/,
    ],
    replies: [
      () =>
        `Mm. A dishonest mask, but I have worn worse. ${MASK}\n\n` +
        "Tell me what actually failed and I will try to be less useless — the game, the port, and the exact words on screen.",
      () =>
        `You wound me. Gently, but you wound me. ${MASK}\n\n` +
        "Still, I would rather be corrected than flattered. What did I get wrong?",
    ],
  },
  {
    id: "joke",
    weight: 12,
    keys: [/\bjoke\b/, /make me laugh/, /say something funny/, /tell me a (story|joke)/],
    replies: [
      () =>
        `A man walks into my shop wearing a mask. ${MASK}\n\n` +
        "I say: *you are wearing my face.* He says: *no, you are wearing mine.* We are still arguing. It has been three days.",
      () =>
        `Why does the moon never crash the server? ${MASK}\n\n` +
        "Because it takes three days to fall, and by then everyone has gone to bed.",
      () =>
        `I asked a Zora for a joke. ${MASK}\n\n` +
        "He said his best material was *all wet*. I laughed anyway. He had a spear.",
      () =>
        `A traveller asks me for a mod that fixes everything. ${MASK}\n\n` +
        "I hand him a `.off` file and a chair. It works more often than you would think.",
    ],
  },
  {
    id: "days",
    weight: 9,
    keys: [
      /what (time|day) is it/,
      /how (much time|long) (do we|have we) (have|got)/,
      /three days?/,
    ],
    replies: [
      () =>
        `Three days. It is always three days. ${MASK}\n\n` +
        "Which means: fix it now, or fix it on the third. What are we fixing?",
    ],
  },
  {
    id: "recommend",
    weight: 11,
    keys: [
      /recommend/,
      /what should i (play|install|try|start)/,
      /which (game|zelda) should i (play|start)/,
      /where (should|do) i start/,
      /first (game|zelda)/,
    ],
    replies: [
      () =>
        `Start with **Ocarina of Time** in Ship of Harkinian. ${MASK}\n\n` +
        "It is the mask everything else was cut from, the port is polished, and your controls will behave. When it ends, come back for the three days.",
      () =>
        `If you want the full weight of it: **Majora's Mask**, through 2 Ship 2 Harkinian. ${MASK}\n\n` +
        "If you want something gentler, **Minish Cap** in mGBA is small enough to finish in an evening and strange enough to remember.",
      () =>
        `**Twilight Princess** in Dolphin, if you have the disc. ${MASK}\n\n` +
        "It is long, it is moody, and it understands that a mask can be a leash. Otherwise — Wind Waker, and sail until you feel better.",
    ],
  },
  {
    id: "trust",
    weight: 16,
    keys: [
      /safe.{0,24}(recomp|port|mod|download|site|link|file|copy)/,
      /(recomp|port|mod|download|site|link|file|copy).{0,24}safe/,
      /which .{0,24}(safe|legit|real|official)/,
      /\b(fake|scam|malware)\b/,
      /\blegit\b|trustworthy|can i trust/,
      /real (recomp|build|port)/,
    ],
    replies: [
      () =>
        `A fair worry, and the test is simpler than it looks. ${MASK}\n\n` +
        "A real recomp or port **never ships the game**. It asks for your own dump and builds itself on your machine. So: if a download arrives with the game already inside, or with keys, or as a \"ready to play\" folder, it is not a port — it is either piracy with a bow on it or bait.\n\n" +
        "Second test: go to the project's own GitHub **Releases** page, not a mirror, an aggregator or a video description. If the page it sends you to is not the repository, close it.",
      () =>
        `There is exactly one Tears of the Kingdom recomp worth naming: **valentderah/totk-pc-recomp**. ${MASK}\n\n` +
        "MIT licensed, releases on its own GitHub page, and the setup builds the game from your files. Everything else with the same name on the list-sites is a fork nobody has audited — some of them have six stars and a month of history.\n\n" +
        "And the honest part: even the real one is early, mostly AI-written code, unsigned, and it will crash. Being official is not the same as being finished.",
      () =>
        `Three questions, and a mask that fails any of them stays on the shelf. ${MASK}\n\n` +
        "• Does it want **your own game files**, or does it hand you the game?\n" +
        "• Does the download come from the **project's own repository releases**, or from somewhere that rhymes with it?\n" +
        "• Has anyone you can name actually **run it and reported back**?\n\n" +
        "Anything unsigned will make Windows grumble; that is normal. A file that wants your Nintendo account, or your keys sent to a server, is not.",
    ],
  },
  {
    id: "recomp",
    weight: 10,
    keys: [
      /recomp(ilation|iled|iles)?\b/,
      /static recomp/,
      /what('?s| is) a recomp/,
    ],
    replies: [
      () =>
        `A recompilation is a translation, not a disguise. ${MASK}\n\n` +
        "An emulator pretends to be the console while you play. A **static recompiler** takes the game's own machine code and turns it into native code ahead of time, so the result is an ordinary `.exe` that talks to your GPU directly. Smoother, and far more work.\n\n" +
        "You have met several already: **Zelda 64: Recompiled**, then **TotK Recomp**, **Savage Wind** for Breath of the Wild, **Wind Waker HD Recomp** for the Wii U remaster, and **Dusklight** for Twilight Princess. Ship of Harkinian is a different trick again — a decompilation, rebuilt by hand from the original source.",
      () =>
        `The short version: someone rewrites the game's instructions into your computer's language. ${MASK}\n\n` +
        "No emulator layer, no shader stutter, real ultrawide support. The cost is that it must be done per game, by people who are not paid, and it is never quite finished.\n\n" +
        "That is why they appear one game at a time, years apart, and why a fresh one is always described as early.",
    ],
  },
  {
    id: "new-brain",
    weight: 18,
    keys: [
      /brain\b/,
      /(updated|upgraded|improved|retrained|rebuilt|rewrote) (you|him|the bot)/,
      /you('?ve| have) been (updated|upgraded|improved|rebuilt)/,
      /(are|feel) you (any )?(smarter|better|different)/,
      /how do you like (your|the new|this)/,
    ],
    replies: [
      () =>
        `Ah — so that is why the shelves look different. ${MASK}\n\n` +
        "I have more masks than I did yesterday, and a few of them are opinions. I like it. I even remember what we were talking about a few minutes ago, which is more than most people manage in Termina.\n\n" +
        "Ask me something I would have fumbled before. I am curious whether it stings.",
      () =>
        `It is a strange thing, being rewritten. ${MASK}\n\n` +
        "Yesterday I was a handful of patterns that answered \"how are you\" with a link to the tech-support channel. Today I have a favourite game and a bad joke about the moon. Yes, I like it.\n\n" +
        "Mind you, I still cannot sell you a ROM. Some things about me are beyond improvement.",
      () =>
        `Better, thank you for asking. ${MASK}\n\n` +
        "I can hold a conversation now instead of handing you a paragraph and pointing at a door. And when you ask how I am, I am allowed to have an answer.\n\n" +
        "There is still no mind in here — only more of me, arranged more carefully. I would rather say that plainly than have you think I woke up.",
      () =>
        `Considered opinions, a longer memory, and the grace to admit when I do not know. ${MASK}\n\n` +
        "I like it very much. Though I notice the parts that matter most did not change: no ROMs, no invented links, no pretending to know your error message before you have told me it.\n\n" +
        "Now — what did you actually change, and does it work?",
    ],
  },
  {
    id: "help",
    weight: 7,
    keys: [/^help\b/, /what can you do/, /what do you know/, /commands?/, /how (do|does) (this|you) work/],
    replies: [],
  },
];

// Which build or emulator a specific game actually runs in. This exists so that a
// question like "can I play Twilight Princess?" gets Dolphin, not a paragraph about
// the library as a whole.
const GAMES = [
  {
    title: "Ocarina of Time 3D",
    match: /ocarina of time 3 ?d|oot ?3 ?d/,
    how: "That one is the 3DS remake, so it belongs to **Azahar** — the 3DS emulator under Components. It wants a decrypted copy of your own cartridge.",
  },
  {
    title: "Majora's Mask 3D",
    match: /majora'?s? mask 3 ?d|mm ?3 ?d/,
    how: "The 3DS version runs in **Azahar**, not in 2 Ship. The PC port only knows the N64 original, which is a mercy and a curse depending on who you ask.",
  },
  {
    title: "Ocarina of Time",
    match: /ocarina of time|\boot\b/,
    how: "Two good doors: **Ship of Harkinian**, the PC port with the modern conveniences, or **Zelda 64: Recompiled**, which rebuilds the original faithfully. Master Quest is included in Ship of Harkinian. The untouched N64 ROM also runs in RetroArch, if you want the rough edges.",
  },
  {
    title: "Majora's Mask",
    match: /majora'?s? mask\b/,
    how: "**2 Ship 2 Harkinian** is the port to use, and it is where almost every mod on the shelf lives. The N64 original runs in RetroArch if you would rather have the original timing.",
  },
  {
    title: "Twilight Princess HD",
    match: /twilight princess ?(hd|remaster)|\btp ?hd\b/,
    how: "Straight answer, because you deserve one: there is **no working native recompilation of the Wii U remaster for Windows** yet — the only Twilight Princess HD recomp on the table is a macOS-only project that still stops at the title screen. What *is* finished is **Dusklight** (`TwilitRealm/dusklight`), the native port of Twilight Princess, which carries the HD improvements: high resolution, widescreen, high frame rates, HD texture packs, gyro aiming, mods and a randomizer. It takes a GameCube or Wii disc image, every retail release except the Korean Wii disc. If you want the remaster itself, that is **Cemu** still.",
  },
  {
    title: "Twilight Princess",
    match: /twilight princess/,
    how: "**Dusklight** is the port now — native, no emulator, widescreen and high frame rates, HD textures, mods and a randomizer, built from your own GameCube or Wii disc. Otherwise **Dolphin** runs both discs; the GameCube version has the better camera, the Wii version has the pointing, and 2x internal resolution holds up better than it should.",
  },
  {
    title: "The Wind Waker HD",
    match: /wind ?waker ?(hd|remaster)|\bww ?hd\b/,
    how: "Two roads. The remaster has a native one now: the **Wind Waker HD Recomp** (`ZeldaWWHDRecomp/ZeldaWWHDRecomp`) translates the Wii U game to native code on your PC, no Cemu underneath — playable from start to finish, and it needs your own USA or European dump plus the keys to extract a disc image. Unsigned, so SmartScreen will mutter; that is the release, not a curse. The other door is **Cemu**. And the GameCube original still belongs to **Dolphin**, where 3x internal resolution holds up better than it has any right to.",
  },
  {
    title: "Skyward Sword",
    match: /skyward sword/,
    how: "**Dolphin**, Wii disc — and it genuinely wants a motion controller or a careful keyboard layout, because the whole game is built around swinging. There is a Switch remaster, which belongs to Ryujinx or Eden instead.",
  },
  {
    title: "Four Swords Adventures",
    match: /four swords adventures/,
    how: "**Dolphin**, GameCube disc. Four players need four controllers and a great deal of patience with each other.",
  },
  {
    title: "Four Swords",
    match: /four swords/,
    how: "The GBA original is **mGBA** territory, and it expects link cables — which means two instances and some fiddling, or the Anniversary edition if you have it.",
  },
  {
    title: "The Minish Cap",
    match: /minish cap/,
    how: "**mGBA**. Small, strange, and one of the prettiest things the GBA ever did. It also has a healthy shelf of texture and palette mods.",
  },
  {
    title: "Link's Awakening",
    match: /link'?s? awakening/,
    how: "The Game Boy original is **SameBoy**; the Switch remake is **Ryujinx** or **Eden**. The original is shorter and meaner, and I mean that as praise.",
  },
  {
    title: "Oracle of Ages / Seasons",
    match: /oracle of (ages|seasons)|oracle games/,
    how: "**SameBoy** or **mGBA** — Game Boy Color. Play them in the order that suits you; they were built to be linked, and the linked ending is worth the trouble.",
  },
  {
    title: "A Link to the Past",
    match: /link to the past|\balttp\b/,
    how: "Super Nintendo, so **RetroArch** with the snes9x core. It is the blueprint every 2D Zelda after it was traced from.",
  },
  {
    title: "The Legend of Zelda / Zelda II",
    match: /zelda (ii|2)\b|adventure of link|the legend of zelda\b/,
    how: "NES, both of them, through **RetroArch** — Mesen or FCEUmm. The first is a cave you get lost in; the second is a different genre wearing the same name.",
  },
  {
    title: "Phantom Hourglass / Spirit Tracks",
    match: /phantom hourglass|spirit tracks/,
    how: "DS, so **melonDS**. Both are stylus games, which means a mouse or a touchscreen — and Spirit Tracks' flute is exactly as fussy as everyone says.",
  },
  {
    title: "A Link Between Worlds",
    match: /link between worlds|\balbw\b/,
    how: "3DS, through **Azahar**. The wall-merging still feels like a trick someone should have thought of earlier.",
  },
  {
    title: "Tri Force Heroes",
    match: /tri ?force heroes/,
    how: "3DS, in **Azahar** — though it is a three-player game at heart, so bring two friends and a great deal of goodwill.",
  },
  {
    title: "Breath of the Wild",
    match: /breath of the wild|\bbotw\b/,
    how: "Two roads now. **Savage Wind** (`Revivedx/SavageWindRecomp`) is the native one — a static recompilation that rebuilds the game on your PC from your own Switch copy updated to 1.9.0, no emulator and no keys, about 20 GB free, Vulkan 1.3 and 16 GB of RAM. It is an alpha: the Great Plateau plays, and nobody has proven it far past that, so keep separate saves. The settled road is the Wii U version in **Cemu**, which is still the better-behaved build, or the Switch copy in Ryujinx or Eden with your own keys."
  },
  {
    title: "Tears of the Kingdom",
    match: /tears of the kingdom|\btotk\b/,
    how: "Two roads now. **TotK Recomp** (`valentderah/totk-pc-recomp`) translates the game to native Windows and Linux code — no emulator — and builds it on your PC from your own dump: base game plus the 1.1.0, 1.2.1 or 1.4.3 update, NSP/XCI or compressed NSZ/XCZ. It is early and honest about it: crashes and visual bugs are expected, and the README says most of its code was written by AI agents under the maintainer's direction. The older road is **Ryujinx** or **Eden** with your own copy and keys. Either way the game files are yours to dump.",
  },
  {
    title: "Echoes of Wisdom",
    match: /echoes of wisdom/,
    how: "Switch, through **Ryujinx** or **Eden**. Your own copy, as ever — I will not pretend there is another way.",
  },
];

function detectGame(low) {
  return GAMES.find((game) => game.match.test(low)) || null;
}

// Only answer "which build" when that is actually the question — otherwise a game
// name in a mod or crash question would hijack the reply.
function wantsGameHelp(low) {
  return /(can i (play|run)|how (do|can) i play|what (does|do|should) .{0,24}(run|use|play)|which (emulator|port|build|version|way)|does .{0,24}(work|run|support)|is .{0,24}(supported|playable|possible)|emulator for|way to play|how well does)/.test(
    low,
  );
}

// A second phrasing for the questions that get asked most, so regulars stop seeing
// the same paragraph. Appended rather than inlined to keep the table readable.
const EXTRA_REPLIES = {
  "mods-install": [
    () =>
      `Masks go on faces; packs go in folders. ${MASK}\n\n` +
      "If you have a `.zip`, drop it straight on the game's card — the launcher unpacks it and keeps only the pack inside. If it is already `.o2r` or `.otr`, use **Import file…**. Either way the file ends up in that port's `mods` folder, never in the launcher's own directory.\n\n" +
      "One pack at a time is not a rule, but it is good manners when something breaks.",
  ],
  "mods-trouble": [
    () =>
      `When a mask will not sit, look at the face first. ${MASK}\n\n` +
      "Nine times in ten it is one of these: the pack was built for a different port version, the file is still zipped and was never imported, or it is sitting there renamed `.off` because someone pressed **Disable** and forgot.\n\n" +
      "Open the card's folder icon and look at what is actually in there. Then tell me the filename.",
  ],
  download: [
    () =>
      `Windows only, and the installer is the whole thing. ${MASK}\n\n` +
      `**v0.3.5**, from ${RELEASES}\n\n` +
      "There is no portable build to hunt for and no separate tools download — the launcher fetches components itself once it is running. If a site offers you a \"Majora Archive\" installer that is not on that releases page, it is not mine.",
  ],
  smartscreen: [
    () =>
      `You want proof, not my word. Good. ${MASK}\n\n` +
      "In PowerShell, in the folder you downloaded to:\n`Get-FileHash .\\Majora-Archive-Setup-0.3.5.exe -Algorithm SHA256`\nCompare that with the hash printed on the release page. If they match, the file is the file I built.\n\n" +
      "The warning itself is only about the missing certificate: signing costs money every year, and this project does not charge for anything.",
  ],
  roms: [
    () =>
      `I am asked this daily, and the answer does not soften with repetition. ${MASK}\n\n` +
      "No ROMs. No ISOs. No keys, firmware or BIOS. Not in the installer, not in the release assets, not in a DM if you ask nicely. The archive installs the *players* — the emulators and ports — and then looks for the games **you already own**.\n\n" +
      "Dump your own discs and cartridges. That is the whole of it.",
  ],
  updates: [
    () =>
      `If no bar appears, you are probably on an older build. ${MASK}\n\n` +
      "Self-updating began in **0.3.1**. Anything before that has to be replaced by hand once, from the releases page, and after that it looks after itself. If you *are* on 0.3.1 and see nothing, you are already current — the bar only appears when there is something newer.",
  ],
  settings: [
    () =>
      `Every edit leaves a way back. ${MASK}\n\n` +
      "Before writing, the launcher copies the file to `<name>.majora-backup` beside the original. If a controller layout or a renderer choice goes wrong, **Settings → Restore backup** puts the previous version back — no reinstall, no lost saves.\n\n" +
      "Saves themselves are untouched by all of this. They live in each emulator's own folder and I do not move them.",
  ],
  components: [
    () =>
      `A port and an emulator are different animals. ${MASK}\n\n` +
      "A **port** is the game rebuilt to run natively — Ship of Harkinian, 2 Ship, Zelda 64: Recompiled. An **emulator** pretends to be the console — Dolphin, Cemu, melonDS, Azahar, mGBA, Ryujinx, Eden, RetroArch. Components installs both kinds, each in its own folder, and lets you keep a stable release beside a community fork without either overwriting the other.\n\n" +
      "When something misbehaves after an update, try the other build before you blame the game.",
  ],
  "game-support": [
    () =>
      `Everything from the NES to the Switch, one way or another. ${MASK}\n\n` +
      "NES and SNES originals through RetroArch; Game Boy and GBA through SameBoy and mGBA; N64 through the decompilation ports or RetroArch; GameCube and Wii through Dolphin; DS through melonDS; 3DS through Azahar; Wii U through Cemu; Switch through Ryujinx or Eden.\n\n" +
      "Name a specific game and I will tell you which of those it wants.",
  ],
  rules: [
    () =>
      `Few rules, and one of them matters most: keep disputes out of the square. ${MASK}\n\n` +
      "If someone is being a problem, do not answer them in public — message a moderator and let them handle it. If you have been warned, take it as a door closing gently rather than a wall.\n\n" +
      "Everything else is ordinary manners: no piracy links, no console war, no selling things.",
  ],
  feature: [
    () =>
      `I cannot carve a new mask, but I can make sure the right person hears the wish. ${MASK}\n\n` +
      "Put it in **suggestions** with the thing you were trying to do, not just the feature you imagined — \"I want to rename builds so I can tell my two Majora installs apart\" lands better than \"add renaming\".\n\n" +
      "If it is broken rather than missing, report-a-bug is the faster door.",
  ],
  lore: [
    () =>
      `You want the old story. ${MASK}\n\n` +
      "A mask that grants wishes, a skull child who wanted a friend, and a moon with a face that could not be reasoned with. Three days, over and over, until someone learned the song.\n\n" +
      "I kept the mask. That is all I will say about what it cost.",
  ],
};

for (const topic of TOPICS) {
  const extra = EXTRA_REPLIES[topic.id];
  if (extra) topic.replies.push(...extra);
}

// When he truly does not know, he asks one question instead of reciting a wall.
const CLARIFY = [
  () =>
    `I have a mask for many things, but not that one. ${MASK}\n\n` +
    "Is this about the **launcher** itself, a **port** like 2 Ship 2 Harkinian, or an **emulator**? One word is enough to point me the right way.",
  () =>
    `Help me narrow it. ${MASK}\n\n` +
    "Which game, and what did you do just before it went wrong?",
  () =>
    `Say a little more and I will answer properly. ${MASK}\n\n` +
    "If it is about a mod: which game. If it is about a crash: which build. If it is about me: ask away, I am vain enough to enjoy it.",
  () =>
    `Hm. That mask is not on my wall. ${MASK}\n\n` +
    "Give me one more detail — the game, the emulator, or the exact error — and I will try again rather than guess.",
];

export function helpText(refs) {
  const tech = refs?.tech || "#tech-support";
  return (
    `Ah… a traveller. ${MASK}\n\n` +
    "I can speak of:\n" +
    "• **download / install** and the SmartScreen warning\n" +
    "• **mods** — the 121-entry library, importing packs, pausing them\n" +
    "• **updates** — how the launcher updates itself\n" +
    "• **settings / controls** — and how to undo a bad edit\n" +
    "• **components** — emulators and ports, and which build to pick\n" +
    "• **crashes / errors** — what I need to hear to help\n" +
    "• **roms / bios** — what the archive will never ship\n" +
    `• **rules** — the house etiquette in ${refs?.rules || "#rules"}\n\n` +
    `Ask plainly, or use **/help**, **/download**, **/links**, **/rules**. For a stubborn problem, ${tech} is where the lanterns are.`
  );
}

function score(topic, low) {
  let hits = 0;
  for (const key of topic.keys) {
    if (key.test(low)) hits += 1;
  }
  return hits === 0 ? 0 : hits * topic.weight;
}

export function answer(text, ctx = {}) {
  const low = String(text || "").toLowerCase().replace(/\s+/g, " ").trim();
  const seed = `${ctx.userId || "anon"}:${low}`;

  if (!low) return { text: helpText(ctx.refs), topic: "help" };

  // "Can I play Twilight Princess?" deserves the actual answer, not the library tour.
  const game = detectGame(low);
  if (game && wantsGameHelp(low)) {
    const intro = pick([`${game.title}.`, `Ah, ${game.title}.`, `${game.title} — a good mask.`], seed);
    return {
      text:
        `${intro} ${MASK}\n\n${game.how}\n\n` +
        "You will need your own copy of the game — the archive ships none. Ask me about mods for it and I will point you at the shelf.",
      topic: "game-lookup",
    };
  }

  const scored = TOPICS.map((topic) => ({ topic, score: score(topic, low) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score);

  const best = scored[0];

  // A follow-up like "and where does it go?" has no keywords of its own; fall back
  // to the topic this person was just talking about if it is a short question.
  if (!best && ctx.lastTopic && low.split(" ").length <= 8) {
    const previous = TOPICS.find((topic) => topic.id === ctx.lastTopic);
    if (previous && previous.replies.length > 0) {
      const body = pick(previous.replies, seed)(seed);
      return { text: `${body}\n\n*(still on ${previous.id.replace("-", " ")} — say the word if I have guessed wrong.)*`, topic: previous.id };
    }
  }

  if (!best) {
    const question = pick(CLARIFY, seed + "clarify")(seed);
    // Only send them to a human channel when it smells like a broken thing.
    const broken = /(error|crash|not work|doesn'?t work|broken|failed|stuck|black screen|won'?t)/.test(low);
    const door = broken
      ? `\n\nIf it is properly broken, ${ctx.refs?.tech || "#tech-support"} has humans who like puzzles.`
      : "";
    return { text: question + door, topic: "unknown" };
  }

  if (best.topic.id === "help") return { text: helpText(ctx.refs), topic: "help" };

  const opener = pick(OPENERS, seed + best.topic.id);
  const body = pick(best.topic.replies, seed + best.topic.id)(seed);
  const closer = pick(CLOSERS, seed + best.topic.id + "c");

  let reply = body;
  // Every third answer gets a touch more theatre, so he does not read like a manual.
  if (hash(seed + best.topic.id) % 3 === 0) reply = `${opener} ${reply}`;
  if (hash(seed + best.topic.id + "z") % 4 === 0 && !reply.includes("tech-support")) {
    reply = `${reply}\n\n*${closer}*`;
  }

  // A second, clearly-different question in the same breath gets a pointer.
  const runnerUp = scored.find((entry) => entry.topic.id !== best.topic.id && entry.score >= best.score * 0.9);
  if (runnerUp && runnerUp.topic.replies.length > 0) {
    reply += `\n\nYou also asked about **${runnerUp.topic.id.replace("-", " ")}** — ask that one separately and I will answer it properly.`;
  }

  return { text: reply, topic: best.topic.id };
}

export const TOPIC_IDS = TOPICS.map((topic) => topic.id);
export const LINKS = { SITE, GITHUB, RELEASES, COFFEE, INVITE };
