const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const cron = require("node-cron");
const getAllStocks = require("./stocks");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const TOKEN = process.env.TOKEN;
const FINNHUB_API = process.env.FINNHUB_API;

const NEWS_CHANNEL = process.env.NEWS_CHANNEL_ID;
const EARNINGS_CHANNEL = process.env.EARNINGS_CHANNEL_ID;
const ALERT_CHANNEL = process.env.ALERT_CHANNEL_ID;

let watchList = [];
let indexPointer = 0;


// ===== BOT READY =====
client.once("clientReady", async () => {
  console.log(`Bot Ready: ${client.user.tag}`);

  watchList = await getAllStocks();
  console.log("Total US stocks loaded:", watchList.length);
});


// ================= DAILY NEWS =================
cron.schedule("*/2 * * * *", async () => {
  try {
    const res = await axios.get(
      `https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_API}`
    );

    const channel = await client.channels.fetch(NEWS_CHANNEL);

    const articles = res.data.slice(0, 5);

    for (const news of articles) {
      await channel.send(
        `📰 **${news.headline}**\n${news.summary}\n${news.url}`
      );
    }
  } catch (err) {
    console.log("News Error:", err.message);
  }
});


// ================= WEEKLY EARNINGS =================
cron.schedule("0 10 * * 6", async () => {
  try {
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const from = today.toISOString().split("T")[0];
    const to = nextWeek.toISOString().split("T")[0];

    const res = await axios.get(
      `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${FINNHUB_API}`
    );

    const channel = await client.channels.fetch(EARNINGS_CHANNEL);

    let message = "📅 **Next Week Earnings**\n\n";

    res.data.earnings.slice(0, 20).forEach(e => {
      message += `**${e.symbol}** — ${e.date}\n`;
    });

    channel.send(message);
  } catch (err) {
    console.log("Earnings Error:", err.message);
  }
});


// ================= MARKET SCANNER =================
setInterval(async () => {
  if (!watchList.length) return;

  try {
    const channel = await client.channels.fetch(ALERT_CHANNEL);

    const batchSize = 10;
    const batch = watchList.slice(indexPointer, indexPointer + batchSize);

    for (const symbol of batch) {
      const res = await axios.get(
        `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API}`
      );

      const price = res.data.c;
      const prevClose = res.data.pc;

      if (!price || !prevClose) continue;

      const change = ((price - prevClose) / prevClose) * 100;

      if (change <= 100) {
  await channel.send(
    `🧪 TEST ALERT — ${symbol}
Price: $${price}
Change: ${change.toFixed(2)}%`
  );
}

    }

    indexPointer += batchSize;
    if (indexPointer >= watchList.length) indexPointer = 0;

  } catch (err) {
    console.log("Scanner error:", err.message);
  }
}, 60000);


client.login(TOKEN);
