# 🤖 FAIZAN-MD MINI

**FAIZAN-MD** ka mini version — wohi bot, wohi **162 plugins**, bas session system naya hai.

| | Full FAIZAN-MD | FAIZAN-MD MINI |
|---|---|---|
| Login | `SESSION_ID` paste karna padta tha | **Pairing code** web page se (8-digit) |
| Session storage | `sessions/` folder (restart pe gayab) | **MongoDB** (restart pe bhi safe) |
| Numbers | 1 number per deploy | **Multi-number** (`MAX_BOTS` tak) |
| Plugins | 162 | **162 — bilkul same, koi change nahi** |

Antilink, antidelete, status-seen, anti-bad, anti-vv, welcome, sab kuch **jaisa tha waisa hi** hai.

---

## 📂 Structure

```
index.js          ← pairing server + bot manager (NEW)
main.js           ← poora FAIZAN-MD bot (aapka original index.js, session part badla)
pair.html         ← pairing code page (NEW)
lib/mongoAuth.js  ← MongoDB session storage (NEW)
command.js        ← plugin registry (unchanged)
config.js         ← settings + MONGODB_URI (updated)
plugins/          ← 162 plugins (unchanged)
lib/ data/ assets/ ← unchanged
```

**Kaise chalta hai:** `index.js` pairing page serve karta hai → number pair hone pe session MongoDB mein save hota hai → phir har number ke liye **alag child process** (`main.js`) start hota hai.

> Har number apne process mein chalta hai — is liye plugins ka in-memory data (antilink groups, warning counts, antidelete cache) numbers ke beech **mix nahi hota**. Yehi wajah hai ke plugins mein ek line bhi change nahi karni padi.

---

## 🚀 Deploy

### Heroku
```bash
heroku create faizan-md-mini
heroku config:set MONGODB_URI="mongodb+srv://..."
heroku config:set MAX_BOTS=2
git push heroku main
```

### Koyeb / Render / Railway
- Build: `npm install`
- Start: `npm start`
- Env: `MONGODB_URI`, `MAX_BOTS`, `PORT` (auto)

### VPS
```bash
npm install
MONGODB_URI="mongodb+srv://..." npm start
```

---

## 📱 Number link karna

1. Deploy ke baad app ka URL kholo (e.g. `https://faizan-md-mini.herokuapp.com`)
2. Apna number daalo — country code ke sath, **bina +** (e.g. `923266105873`)
3. **Get Pairing Code** dabao → 8-digit code milega
4. WhatsApp → **Settings → Linked devices → Link a device → Link with phone number instead**
5. Code enter karo ✅ — bot foran start ho jayega

Doosra number add karna ho? Wahi page dobara kholo, naya number daalo.

---

## 🔗 Endpoints

| Route | Kaam |
|---|---|
| `/` | Pairing page |
| `/pair?number=923...` | Pairing code generate |
| `/status` | Kaun se numbers chal rahe hain |
| `/delete?number=923...` | Session delete (logout) |

---

## ⚙️ Env variables

| Variable | Default | Note |
|---|---|---|
| `MONGODB_URI` | shared test cluster | **Apna Atlas cluster banao** production ke liye |
| `MAX_BOTS` | `3` | Har number ~200MB RAM. Free hosting (512MB) = 1-2 numbers |
| `PREFIX` | `.` | Command prefix |
| `OWNER_NUMBER` | `923266105873` | Owner |
| `MODE` | `public` | public / private |

Baqi saari settings (`AUTO_STATUS_SEEN`, `ANTI_LINK`, `ANTI_DELETE`, `ANTI_BAD`, `ANTI_VV`, `AUTO_REACT`, ...) `config.js` mein pehle ki tarah mojood hain.

---

## ⚠️ Zaroori baatein

- **MongoDB:** default URL ek shared test cluster hai. Production ke liye [MongoDB Atlas](https://cloud.mongodb.com) pe apna free cluster banao aur `MONGODB_URI` set karo.
- **RAM:** ye bot heavy hai (ffmpeg, sticker, jimp). Free hosting pe `MAX_BOTS=1` ya `2` rakho.
- **Pairing 405 error:** agar pairing code ke baad turant connection close ho jaye, to hosting ka IP WhatsApp ne block kiya hai — us case mein doosra host try karo ya proxy lagao.
- Session corrupt ho jaye to `/delete?number=...` se clear kar ke dobara pair kar lo.

---

*Powered by FAIZAN JUTT · 162 plugins · pairing code + MongoDB*

---

## 📎 Ek file manually add karni hai

`assets/menu.m4a` (3.3MB menu audio) is repo mein nahi hai — GitHub API se itni bari
binary file push nahi hoti. Ye file ZIP mein mojood hai; GitHub web pe **assets** folder
khol ke **Add file → Upload files** se drag kar do.

Bot iske baghair bhi theek chalta hai — menu commands ab check karte hain ke audio
file mojood hai ya nahi, na mile to sirf text menu bhejte hain (koi crash nahi).
