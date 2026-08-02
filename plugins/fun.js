const { cmd } = require("../command");
const config = require('../config');

// FAIZAN style formatter
function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 🎮 ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍'}
`;
}

// ============================================
// 💖 COMPATIBILITY CHECKER
// ============================================
cmd({
    pattern: "compatibility",
    alias: ["friend", "fcheck", "lovecheck"],
    desc: "Calculate the compatibility score between two users",
    category: "fun",
    react: "💖",
    filename: __filename,
    use: "@tag1 @tag2",
}, async (conn, mek, m, { from, args, reply }) => {
    try {
        if (args.length < 2) {
            return reply(faizanStyle('Compatibility', 'Please mention two users\nUsage: .compatibility @user1 @user2', '❌'));
        }

        let user1 = m.mentionedJid[0];
        let user2 = m.mentionedJid[1];

        if (!user1 || !user2) {
            return reply(faizanStyle('Compatibility', 'Invalid mentions', '❌'));
        }

        const specialNumber = config.DEV ? `${config.DEV}@s.whatsapp.net` : null;

        // Calculate a random compatibility score (between 1 to 1000)
        let compatibilityScore = Math.floor(Math.random() * 1000) + 1;

        // Check if one of the mentioned users is the special number
        if (user1 === specialNumber || user2 === specialNumber) {
            compatibilityScore = 1000; // Special case for DEV number
            return await conn.sendMessage(from, {
                text: `💖 *Compatibility*\n\n👤 @${user1.split('@')[0]}\n👤 @${user2.split('@')[0]}\n\n💯 Score: *${compatibilityScore}+/1000*\n\n> This is all for fun, don't take it seriously!`,
                mentions: [user1, user2]
            }, { quoted: mek });
        }

        // Send the compatibility message
        await conn.sendMessage(from, {
            text: `💖 *Compatibility*\n\n👤 @${user1.split('@')[0]}\n👤 @${user2.split('@')[0]}\n\n💯 Score: *${compatibilityScore}/1000*\n\n> This is all for fun, don't take it seriously!`,
            mentions: [user1, user2]
        }, { quoted: mek });

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (error) {
        console.log(error);
        reply(faizanStyle('Compatibility', error.message, '❌'));
    }
});

// ============================================
// 💀 AURA CALCULATOR
// ============================================
cmd({
    pattern: "aura",
    alias: ["auracheck", "aurauser"],
    desc: "Calculate aura score of a user",
    category: "fun",
    react: "💀",
    filename: __filename,
    use: "@tag",
}, async (conn, mek, m, { from, args, reply }) => {
    try {
        if (args.length < 1) {
            return reply(faizanStyle('Aura', 'Please mention a user\nUsage: .aura @user', '❌'));
        }

        let user = m.mentionedJid[0];

        if (!user) {
            return reply(faizanStyle('Aura', 'Invalid mention', '❌'));
        }

        const specialNumber = config.DEV ? `${config.DEV}@s.whatsapp.net` : null;

        // Calculate a random aura score (between 1 to 1000)
        let auraScore = Math.floor(Math.random() * 1000) + 1;

        // Check if the mentioned user is the special number
        if (user === specialNumber) {
            auraScore = 999999; // Special case for DEV number
            return await conn.sendMessage(from, {
                text: `💀 *Aura*\n\n👤 @${user.split('@')[0]}\n\n💯 Score: *${auraScore}+*\n\n> This is all for fun, don't take it seriously!`,
                mentions: [user]
            }, { quoted: mek });
        }

        // Send the aura message
        await conn.sendMessage(from, {
            text: `💀 *Aura*\n\n👤 @${user.split('@')[0]}\n\n💯 Score: *${auraScore}/1000*\n\n> This is all for fun, don't take it seriously!`,
            mentions: [user]
        }, { quoted: mek });

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (error) {
        console.log(error);
        reply(faizanStyle('Aura', error.message, '❌'));
    }
});

// ============================================
// 🔥 ROAST GENERATOR
// ============================================
cmd({
    pattern: "roast",
    alias: ["roastuser", "gaali"],
    desc: "Roast someone in Hindi",
    category: "fun",
    react: "🔥",
    filename: __filename,
    use: "@tag"
}, async (conn, mek, m, { from, args, reply }) => {
    try {
        let roasts = [
            "Abe bhai, tera IQ wifi signal se bhi kam hai!",
            "Bhai, teri soch WhatsApp status jaisi hai, 24 ghante baad gayab ho jaati hai!",
            "Abe sochta kitna hai, tu kya NASA ka scientist hai?",
            "Abe tu hai kaun? Google pe search karne se bhi tera naam nahi aata!",
            "Tera dimaag 2G network pe chal raha hai kya?",
            "Itna overthink mat kar bhai, teri battery jaldi down ho jayegi!",
            "Teri soch cricket ke match jaisi hai, baarish aate hi band ho jati hai!",
            "Tu VIP hai, 'Very Idiotic Person'!",
            "Abe tu kis planet se aaya hai, yeh duniya tere jaise aliens ke liye nahi hai!",
            "Tere dimag mein khojne ka itna kuch hai, lekin koi result nahi milta!",
            "Teri zindagi WhatsApp status jaisi hai, kabhi bhi delete ho sakti hai!",
            "Tera style bilkul WiFi password ki tarah hai, sabko pata nahi!",
            "Abe tu toh wahi hai jo apni zindagi ka plot twist bhi Google karta hai!",
            "Abe tu toh software update bhi nahi chalne wala, pura hang hai!",
            "Tere sochne se zyada toh Google search karne mein time waste ho jaata hai!",
            "Mere paas koi shabdon ki kami nahi hai, bas tujhe roast karne ka mood nahi tha!",
            "Teri personality toh dead battery jaisi hai, recharge karne ka time aa gaya hai!",
            "Bhai, teri soch ke liye ek dedicated server hona chahiye!",
            "Abe tu kaunsa game khel raha hai, jisme har baar fail ho jaata hai?",
            "Tere jokes bhi software update ki tarah hote hain, baar-baar lagte hain par kaam nahi karte!",
            "Teri wajah se toh mere phone ka storage bhi full ho jaata hai!",
            "Abe bhai, tu na ek walking meme ban gaya hai!",
            "Abe apne aap ko bada smart samajhta hai, par teri brain cells toh overload mein hain!",
            "Teri wajah se toh humari group chat ko mute karne ka sochna padta hai!",
            "Abe tere jaise log hamesha apne aap ko hero samajhte hain, par actually toh tum villain ho!",
            "Tere jaise logon ke liye zindagi mein rewind aur fast forward button hona chahiye!",
            "Tere mooh se nikla har lafz ek naya bug hai!",
            "Abe tu apni zindagi ke saath save nahi kar paaya, aur dusron ke liye advice de raha hai!",
            "Tu apne life ka sabse bada virus hai!",
            "Abe tu hain ya koi broken app?",
            "Tere soch ke liye CPU ki zarurat hai, par lagta hai tera CPU khatam ho gaya!",
            "Abe tu kya kar raha hai, ek walking error message ban gaya hai!",
            "Teri taareef toh bas lagti hai, par teri asli aukaat toh sabko pata hai!",
            "Tera brain toh ek broken link ki tarah hai, sab kuch dhundne ke bawajood kuch nahi milta!",
            "Bhai, tujhe dekh ke toh lagta hai, Netflix bhi teri wajah se crash ho gaya!",
            "Teri tasveer toh bas ek screenshot lagti hai, real life mein tu kuch bhi nahi!",
            "Abe bhai, tu lagta hai toh I-phone ho, lekin andar kaafi purana android hai!",
            "Abe, tere jaisi soch se toh Google bhi nafrat karta hoga!",
            "Bhai tu apne chehre se ghazab ka mood bana le, shayad koi notice kar le!",
            "Tere kaam bhi uss app ki tarah hote hain jo crash ho jata hai jab sabko zarurat ho!",
            "Teri zindagi ke sabse bada hack toh hai - 'Log mujhse kuch bhi expect mat karo'!",
            "Abe tu apne aap ko hi mirror mein dekh ke samajhta hai ki sab kuch sahi hai!",
            "Abe tu apne dimaag ko low power mode mein daalke chalta hai!",
            "Tere paas ideas hain, par sab outdated hain jaise Windows XP!",
            "Teri soch toh ek system error ki tarah hai, restart karna padega!",
            "Teri personality toh ek empty hard drive jaise hai, kuch bhi valuable nahi!",
            "Abe tu kis planet se aaya hai, yeh duniya tere jaise logon ke liye nahi hai!",
            "Tere chehre pe kisi ne 'loading' likh diya hai, par kabhi bhi complete nahi hota!",
            "Tera dimaag toh ek broken link ki tarah hai, kabhi bhi connect nahi hota!",
            "Abe, teri soch se toh Google ka algorithm bhi confused ho jata hai!",
            "Tere jaisa banda, aur aise ideas? Yeh toh humne science fiction mein dekha tha!",
            "Abe tu apne chehre pe 'not found' likhwa le, kyunki sabko kuch milta nahi!",
            "Teri soch itni slow hai, Google bhi teri madad nahi kar paata!",
            "Abe tu toh '404 not found' ka living example hai!",
            "Tera dimaag bhi phone ki battery jaise hai, kabhi bhi drain ho jaata hai!",
            "Abe tu toh wahi hai, jo apni zindagi ka password bhool jaata hai!",
            "Abe tu jise apni soch samajhta hai, wo ek 'buffering' hai!",
            "Teri life ke decisions itne confusing hain, ki KBC ke host bhi haraan ho jaaye!",
            "Bhai, tere jaise logo ke liye ek dedicated 'error' page hona chahiye!",
            "Teri zindagi ko 'user not found' ka message mil gaya hai!",
            "Teri baatein utni hi value rakhti hain, jitni 90s ke mobile phones mein camera quality thi!",
            "Abe bhai, tu toh har waqt 'under construction' rehta hai!",
            "Tere saath toh life ka 'unknown error' hota hai, koi solution nahi milta!",
            "Bhai, tere chehre pe ek warning sign hona chahiye - 'Caution: Too much stupidity ahead'!",
            "Teri har baat pe lagta hai, system crash hone waala hai!",
            "Tere paas idea hai, par wo abhi bhi 'under review' hai!"
        ];

        let randomRoast = roasts[Math.floor(Math.random() * roasts.length)];
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);

        if (!mentionedUser) {
            return reply(faizanStyle('Roast', 'Please tag someone to roast!\nUsage: .roast @user', '❌'));
        }

        let target = `@${mentionedUser.split("@")[0]}`;

        // Sending the roast message with the mentioned user
        let message = `🔥 *Roast*\n\n${target}\n\n📝 *Message:* ${randomRoast}\n\n> This is all for fun, don't take it seriously!`;
        await conn.sendMessage(from, {
            text: message,
            mentions: [mek.sender, mentionedUser]
        }, { quoted: mek });

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (error) {
        console.log(error);
        reply(faizanStyle('Roast', error.message, '❌'));
    }
});

// ============================================
// 🎱 MAGIC 8-BALL
// ============================================
cmd({
    pattern: "8ball",
    alias: ["magicball", "ask"],
    desc: "Magic 8-Ball gives answers to your questions",
    category: "fun",
    react: "🎱",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            return reply(faizanStyle('8-Ball', 'Ask a yes/no question!\nExample: .8ball Will I be rich?', '❌'));
        }

        let responses = [
            "Yes!",
            "No.",
            "Maybe...",
            "Definitely!",
            "Not sure.",
            "Ask again later.",
            "I don't think so.",
            "Absolutely!",
            "No way!",
            "Looks promising!",
            "Without a doubt!",
            "Very doubtful.",
            "Signs point to yes.",
            "Cannot predict now.",
            "Concentrate and ask again.",
            "Don't count on it.",
            "It is certain.",
            "Most likely.",
            "My reply is no.",
            "Outlook good.",
            "Reply hazy, try again."
        ];

        let answer = responses[Math.floor(Math.random() * responses.length)];

        await reply(faizanStyle('8-Ball', `${q}\n\n🎱 *Answer:* ${answer}`, '✅'));

        await conn.sendMessage(from, {
            react: { text: "🎱", key: mek.key }
        });

    } catch (error) {
        console.log(error);
        reply(faizanStyle('8-Ball', error.message, '❌'));
    }
});

// ============================================
// 😊 COMPLIMENT GENERATOR
// ============================================
cmd({
    pattern: "compliment",
    alias: ["compli", "nice"],
    desc: "Give a nice compliment to someone",
    category: "fun",
    react: "😊",
    filename: __filename,
    use: "@tag (optional)"
}, async (conn, mek, m, { from, args, reply }) => {
    try {
        let compliments = [
            "You're amazing just the way you are! 💖",
            "You light up every room you walk into! 🌟",
            "Your smile is contagious! 😊",
            "You're a genius in your own way! 🧠",
            "You bring happiness to everyone around you! 🥰",
            "You're like a human sunshine! ☀️",
            "Your kindness makes the world a better place! ❤️",
            "You're unique and irreplaceable! ✨",
            "You're a great listener and a wonderful friend! 🤗",
            "Your positive vibes are truly inspiring! 💫",
            "You're stronger than you think! 💪",
            "Your creativity is beyond amazing! 🎨",
            "You make life more fun and interesting! 🎉",
            "Your energy is uplifting to everyone around you! 🔥",
            "You're a true leader, even if you don't realize it! 🏆",
            "Your words have the power to make people smile! 😊",
            "You're so talented, and the world needs your skills! 🎭",
            "You're a walking masterpiece of awesomeness! 🎨",
            "You're proof that kindness still exists in the world! 💕",
            "You make even the hardest days feel a little brighter! ☀️"
        ];

        let randomCompliment = compliments[Math.floor(Math.random() * compliments.length)];
        let sender = `@${mek.sender.split("@")[0]}`;
        let mentionedUser = m.mentionedJid[0] || (mek.quoted && mek.quoted.sender);
        let target = mentionedUser ? `@${mentionedUser.split("@")[0]}` : "";

        let message = mentionedUser
            ? `😊 *Compliment*\n\n${target}\n\n📝 *Message:* ${randomCompliment}\n\n> Spread kindness!`
            : `${sender}, you forgot to tag someone! But here's a compliment for you:\n\n📝 *Message:* ${randomCompliment}`;

        await conn.sendMessage(from, {
            text: message,
            mentions: [mek.sender, mentionedUser].filter(Boolean)
        }, { quoted: mek });

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (error) {
        console.log(error);
        reply(faizanStyle('Compliment', error.message, '❌'));
    }
});

// ============================================
// ❤️ LOVE TEST
// ============================================
cmd({
    pattern: "lovetest",
    alias: ["lovecheck", "lovescore"],
    desc: "Check love compatibility between two users",
    category: "fun",
    react: "❤️",
    filename: __filename,
    use: "@tag1 @tag2"
}, async (conn, mek, m, { from, args, reply }) => {
    try {
        if (args.length < 2) {
            return reply(faizanStyle('Love Test', 'Tag two users!\nExample: .lovetest @user1 @user2', '❌'));
        }

        let user1 = args[0].replace("@", "") + "@s.whatsapp.net";
        let user2 = args[1].replace("@", "") + "@s.whatsapp.net";

        let lovePercent = Math.floor(Math.random() * 100) + 1;

        let messages = [
            { range: [90, 100], text: "💖 *A match made in heaven!* True love exists!" },
            { range: [75, 89], text: "😍 *Strong connection!* This love is deep and meaningful." },
            { range: [50, 74], text: "😊 *Good compatibility!* You both can make it work." },
            { range: [30, 49], text: "🤔 *It's complicated!* Needs effort, but possible!" },
            { range: [10, 29], text: "😅 *Not the best match!* Maybe try being just friends?" },
            { range: [1, 9], text: "💔 *Uh-oh!* This love is as real as a Bollywood breakup!" }
        ];

        let loveMessage = messages.find(msg => lovePercent >= msg.range[0] && lovePercent <= msg.range[1]).text;

        let message = `❤️ *Love Test*\n\n👤 @${user1.split('@')[0]}\n👤 @${user2.split('@')[0]}\n\n💯 Score: *${lovePercent}%*\n📝 ${loveMessage}\n\n> This is all for fun, don't take it seriously!`;

        await conn.sendMessage(from, {
            text: message,
            mentions: [user1, user2]
        }, { quoted: mek });

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (error) {
        console.log(error);
        reply(faizanStyle('Love Test', error.message, '❌'));
    }
});

// ============================================
// 🙂 EMOJI CONVERTER
// ============================================
cmd({
    pattern: "emoji",
    alias: ["emojify", "emojitext"],
    desc: "Convert text into emoji form",
    category: "fun",
    react: "🙂",
    filename: __filename,
    use: "<text>"
}, async (conn, mek, m, { from, args, q, reply }) => {
    try {
        // Join the words together
        let text = args.join(" ");

        if (!text) {
            return reply(faizanStyle('Emoji', 'Please provide text to convert!\nExample: .emoji hello', '❌'));
        }

        // Map text to corresponding emoji characters
        let emojiMapping = {
            "a": "🅰️",
            "b": "🅱️",
            "c": "🇨️",
            "d": "🇩️",
            "e": "🇪️",
            "f": "🇫️",
            "g": "🇬️",
            "h": "🇭️",
            "i": "🇮️",
            "j": "🇯️",
            "k": "🇰️",
            "l": "🇱️",
            "m": "🇲️",
            "n": "🇳️",
            "o": "🅾️",
            "p": "🇵️",
            "q": "🇶️",
            "r": "🇷️",
            "s": "🇸️",
            "t": "🇹️",
            "u": "🇺️",
            "v": "🇻️",
            "w": "🇼️",
            "x": "🇽️",
            "y": "🇾️",
            "z": "🇿️",
            "0": "0️⃣",
            "1": "1️⃣",
            "2": "2️⃣",
            "3": "3️⃣",
            "4": "4️⃣",
            "5": "5️⃣",
            "6": "6️⃣",
            "7": "7️⃣",
            "8": "8️⃣",
            "9": "9️⃣",
            " ": "  ",
        };

        // Convert the input text into emoji form
        let emojiText = text.toLowerCase().split("").map(char => emojiMapping[char] || char).join(" ");

        let message = `🙂 *Emoji Text*\n\n📝 *Original:* ${text}\n\n🎨 *Converted:*\n${emojiText}`;

        await conn.sendMessage(from, {
            text: message
        }, { quoted: mek });

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (error) {
        console.log(error);
        reply(faizanStyle('Emoji', error.message, '❌'));
    }
});

// ============================================
// 🎮 FUN FACTS
// ============================================
cmd({
    pattern: "fact",
    alias: ["funfact", "facts"],
    desc: "Get a random fun fact",
    category: "fun",
    react: "🤓",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        let facts = [
            "Honey never spoils. Archaeologists found 3000-year-old honey in Egyptian tombs that was still edible! 🍯",
            "A day on Venus is longer than a year on Venus. 🌍",
            "Bananas are berries, but strawberries aren't! 🍌",
            "Octopuses have three hearts. 🐙",
            "The Eiffel Tower can be 15 cm taller during the summer due to thermal expansion. 🗼",
            "Wombat poop is cube-shaped! 🦘",
            "Cows have best friends and get stressed when separated. 🐄",
            "The shortest war in history lasted only 38 minutes between Britain and Zanzibar. ⚔️",
            "A group of flamingos is called a 'flamboyance'. 🦩",
            "The human nose can remember 50,000 different scents. 👃",
            "Butterflies taste with their feet. 🦋",
            "The world's oldest known living tree is over 5,000 years old. 🌲",
            "There's a species of jellyfish that is biologically immortal. 🎐",
            "The Great Wall of China is not visible from space without aid. 🧱",
            "Polar bear skin is actually black, not white. 🐻‍❄️",
            "A single cloud can weigh more than a million pounds. ☁️",
            "The first computer bug was an actual real-life bug (a moth stuck in a computer). 🐛",
            "The Mona Lisa has no eyebrows. 🎨",
            "Koalas have fingerprints almost identical to humans. 🐨",
            "Sea otters hold hands while sleeping to avoid drifting apart. 🦦"
        ];

        let randomFact = facts[Math.floor(Math.random() * facts.length)];

        await reply(faizanStyle('Fun Fact', randomFact, '🤓'));

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (error) {
        console.log(error);
        reply(faizanStyle('Fact', error.message, '❌'));
    }
});

// ============================================
// 🔮 RANDOM JOKE
// ============================================
cmd({
    pattern: "joke",
    alias: ["jokes", "laugh"],
    desc: "Get a random joke",
    category: "fun",
    react: "😂",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        let jokes = [
            "Why don't scientists trust atoms? Because they make up everything! 🧪",
            "What do you call a fake noodle? An impasta! 🍝",
            "Why did the scarecrow win an award? Because he was outstanding in his field! 🌾",
            "What do you call a bear with no teeth? A gummy bear! 🐻",
            "Why don't eggs tell jokes? They'd crack each other up! 🥚",
            "How does a penguin build its house? Igloos it together! 🐧",
            "Why did the math book look so sad? Because it had too many problems! 📚",
            "What do you call a sleeping bull? A bulldozer! 🐂",
            "Why can't you give Elsa a balloon? Because she will let it go! 🎈",
            "What's orange and sounds like a parrot? A carrot! 🥕",
            "How do you organize a space party? You planet! 🚀",
            "What do you call a fish with no eyes? A fsh! 🐟",
            "Why did the bicycle fall over? Because it was two-tired! 🚲",
            "What do you call a pig that does karate? A pork chop! 🐷",
            "Why did the coffee file a police report? It got mugged! ☕",
            "What do you call a cow with no legs? Ground beef! 🐄",
            "Why did the golfer wear two pairs of pants? In case he got a hole in one! ⛳",
            "What do you call a belt made of watches? A waist of time! ⌚",
            "Why did the banana go to the doctor? It wasn't peeling well! 🍌",
            "What do you call a snowman with a six-pack? An abdominal snowman! ⛄"
        ];

        let randomJoke = jokes[Math.floor(Math.random() * jokes.length)];

        await reply(faizanStyle('Joke', randomJoke, '😂'));

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (error) {
        console.log(error);
        reply(faizanStyle('Joke', error.message, '❌'));
    }
});

// ============================================
// 🎰 RANDOM NUMBER
// ============================================
cmd({
    pattern: "random",
    alias: ["rand", "randomnumber"],
    desc: "Generate a random number",
    category: "fun",
    react: "🎰",
    filename: __filename,
    use: "<min> <max>"
}, async (conn, mek, m, { from, args, reply }) => {
    try {
        let min = args[0] ? parseInt(args[0]) : 1;
        let max = args[1] ? parseInt(args[1]) : 100;

        if (isNaN(min) || isNaN(max)) {
            return reply(faizanStyle('Random', 'Please provide valid numbers!\nExample: .random 1 100', '❌'));
        }

        if (min >= max) {
            return reply(faizanStyle('Random', 'Min must be less than max!', '❌'));
        }

        let randomNum = Math.floor(Math.random() * (max - min + 1)) + min;

        await reply(faizanStyle('Random Number', `Between ${min} and ${max}\n\n🎲 Result: *${randomNum}*`, '🎰'));

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (error) {
        console.log(error);
        reply(faizanStyle('Random', error.message, '❌'));
    }
});

// ============================================
// 🪙 COIN FLIP
// ============================================
cmd({
    pattern: "coinflip",
    alias: ["coin", "flip"],
    desc: "Flip a coin (Heads or Tails)",
    category: "fun",
    react: "🪙",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        let result = Math.random() < 0.5 ? "Heads" : "Tails";
        let emoji = result === "Heads" ? "🪙 Heads" : "🪙 Tails";

        await reply(faizanStyle('Coin Flip', `Result: *${emoji}*`, '🎲'));

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (error) {
        console.log(error);
        reply(faizanStyle('Coin Flip', error.message, '❌'));
    }
});

// ============================================
// 🎲 DICE ROLL
// ============================================
cmd({
    pattern: "dice",
    alias: ["rolldice", "roll"],
    desc: "Roll a dice (1-6)",
    category: "fun",
    react: "🎲",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        let result = Math.floor(Math.random() * 6) + 1;
        let diceEmoji = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][result - 1];

        await reply(faizanStyle('Dice Roll', `Result: *${result}* ${diceEmoji}`, '🎲'));

        await conn.sendMessage(from, {
            react: { text: "✅", key: mek.key }
        });

    } catch (error) {
        console.log(error);
        reply(faizanStyle('Dice Roll', error.message, '❌'));
    }
});
