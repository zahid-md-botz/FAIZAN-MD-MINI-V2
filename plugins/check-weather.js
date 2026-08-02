const axios = require('axios');
const config = require('../config');
const { cmd } = require('../command');

// FAIZAN style formatter
function faizanStyle(title, value, status) {
    return `
*╭ׂ┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*
*│ ╌─̇─̣⊰ ${config.BOT_NAME || '𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃'} ⊱┈─̇─̣╌*
*│─̇─̣┄┄┄┄┄┄┄┄┄┄┄┄┄─̇─̣*
*│❀ 🌤 ${title}:* ${value}
*│❀ ⚙️ 𝐒𝐭𝐚𝐭𝐮𝐬:* ${status}
*╰┄─̣┄─̇─̣┄─̇─̣┄─̇─̣┄─̇─̣─̇─̣─᛭*

> ${config.DESCRIPTION || 'ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝐅𝐀𝐈𝐙𝐀𝐍-𝐌𝐃 🤍'}
`;
}

cmd({
    pattern: "weather",
    alias: ["wthr", "climate", "temp"],
    desc: "🌤 Get weather information for a location",
    react: "🌤",
    category: "other",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) {
            return reply(faizanStyle('Weather', 'Please provide a city name\nExample: .weather London', '❌'));
        }

        // Show loading
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        const apiKey = '2d61a72574c11c4f36173b627f8cb177';
        const city = q;
        const url = `http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}&units=metric`;
        
        const response = await axios.get(url);
        const data = response.data;

        // Weather condition emoji
        const weatherEmoji = {
            'Clear': '☀️',
            'Clouds': '☁️',
            'Rain': '🌧️',
            'Drizzle': '🌦️',
            'Thunderstorm': '⛈️',
            'Snow': '❄️',
            'Mist': '🌫️',
            'Fog': '🌫️',
            'Haze': '🌫️',
            'Smoke': '🔥',
            'Dust': '🏜️',
            'Sand': '🏖️',
            'Ash': '🌋',
            'Squall': '💨',
            'Tornado': '🌪️'
        };

        const mainWeather = data.weather[0].main;
        const emoji = weatherEmoji[mainWeather] || '🌤️';

        // Build weather info in FAIZAN style
        const weatherInfo = `
*│❀ 🌍 City:* ${data.name}, ${data.sys.country}
*│❀ ${emoji} Weather:* ${mainWeather}
*│❀ 🌫️ Description:* ${data.weather[0].description}
*│❀ 🌡️ Temperature:* ${data.main.temp}°C
*│❀ 🤔 Feels Like:* ${data.main.feels_like}°C
*│❀ 📉 Min Temp:* ${data.main.temp_min}°C
*│❀ 📈 Max Temp:* ${data.main.temp_max}°C
*│❀ 💧 Humidity:* ${data.main.humidity}%
*│❀ 💨 Wind Speed:* ${data.wind.speed} m/s
*│❀ 🔽 Pressure:* ${data.main.pressure} hPa
*│❀ 👁️ Visibility:* ${(data.visibility / 1000).toFixed(1)} km
`.trim();

        // Send weather info with FAIZAN style
        await reply(faizanStyle('WEATHER', weatherInfo, '✅'));

        // Success reaction
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });

    } catch (e) {
        console.log(e);
        
        if (e.response && e.response.status === 404) {
            await reply(faizanStyle('Weather', `City "${q}" not found\nPlease check spelling`, '❌'));
        } else if (e.response && e.response.status === 401) {
            await reply(faizanStyle('Weather', 'Invalid API key', '❌'));
        } else {
            await reply(faizanStyle('Weather', 'Failed to fetch weather info', '❌'));
        }
        
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    }
});
