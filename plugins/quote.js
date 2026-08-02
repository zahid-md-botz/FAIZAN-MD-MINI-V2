const axios = require("axios");
const { cmd } = require("../command");

cmd({
  pattern: "quote",
  desc: "Get a random inspiring quote.",
  category: "fun",
  react: "💬",
  filename: __filename
}, async (conn, m, store, { from, reply }) => {
  try {
    const response = await axios.get("https://api.quotable.io/random");
    const { content, author } = response.data;

    const message = `💬 *"${content}"*\n- ${author}\n\n> *QUOTES BY FAIZAN-MD⁸⁷³*`;
    reply(message);
  } catch (error) {
    console.error("_Error fetching quote_:", error);
    reply("⚠️ _API issue or coding error, please check the logs_!");
  }
});
