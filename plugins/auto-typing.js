const fs = require('fs');
const path = require('path');
const config = require('../config')
const {cmd , commands} = require('../command')


// Composing (Auto Typing)
cmd({
    on: "body"
},    
async (conn, mek, m, { from, body, isOwner }) => {
    if (config.AUTO_TYPING === 'true') {
        conn.sendPresenceUpdate('composing', from).catch(() => {}); // fire-and-forget — don't block
    }
});
