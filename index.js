const express = require("express");
const app = express();

const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const cron = require("node-cron");
const fs = require("fs");
const getAllStocks = require("./stocks");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.TOKEN;
const FINNHUB_API = process.env.FINNHUB_API;
const NEWS_CHANNEL = process.env.NEWS_CHANNEL_ID;

let watchList = [];
let sentNews = new Set();


// ===== Web server για Render =====
app.get("/", (req, res) => {
  res.send("Bot running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Web server running on port " + PORT);
});


// ===== Load sent news =====
function loadSentNews() {
  try {
    const data = JSON.parse(fs.readFileSync("./sentNews.json"));
    sentNews = new Set(data);
  } catch {
    sentNews = new Set();
  }
}

function saveSentNews() {
  fs.writeFileSync(
    "./sentNews.json",
    JSON.stringify([...sentNews], null, 2)
  );
}


// ================= BOT READY =================
client.once("ready", async () => {

  console.log(`Bot Ready: ${client.user.tag}`);

  watchList = await getAllStocks();
  console.log("Total stocks loaded:", watchList.length);

  loadSentNews();
});


// ================= SEND NEWS =================
async function sendCompanyNews() {

  if (!watchList.length) {
    console.log("Watchlist empty");
    return;
  }

  try {

    const channel = await client.channels.fetch(NEWS_CHANNEL);

    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 1);

    const fromDate = from.toISOString().split("T")[0];
    const toDate = today.toISOString().split("T")[0];

    const shuffled = [...watchList].sort(() => 0.5 - Math.random());
    const sample = shuffled.slice(0, 12);

    let sent = 0;

    for (const symbol of sample) {

      try {

        const res = await axios.get(
          `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${FINNHUB_API}`
        );

        if (!res.data || res.data.length === 0) continue;

        const news = res.data[0];

        if (sentNews.has(news.url)) {
          continue;
        }

        await channel.send(
`📈 **${symbol}**
**${news.headline}**
${news.url}`
        );

        sentNews.add(news.url);
        saveSentNews();

        sent++;

        await new Promise(r => setTimeout(r, 1500));

      } catch {
        console.log(`Skip ${symbol}`);
      }
    }

    console.log(`News sent: ${sent}`);

  } catch (err) {
    console.log("News error:", err.message);
  }
}


// ================= SCHEDULE =================
cron.schedule("0 7,10,13,16,19 * * *", sendCompanyNews, {
  timezone: "UTC"
});


client.login(TOKEN);