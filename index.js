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
const alertedToday = new Set();


// ================= MARKET HOURS FILTER =================
function isMarketTime() {
  const now = new Date();

  const greekTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Athens" })
  );

  const day = greekTime.getDay();
  const hour = greekTime.getHours();

  // Δευτέρα - Παρασκευή μόνο
  if (day === 0 || day === 6) return false;

  // 11:00 -> 03:00 Ελλάδας (premarket + market + after-hours)
  if (hour >= 11 || hour < 3) return true;

  return false;
}


// ===== BOT READY =====
client.once("clientReady", async () => {

  console.log(`Bot Ready: ${client.user.tag}`);

  watchList = await getAllStocks();
  console.log("Total US stocks loaded:", watchList.length);


  // ================= COMPANY NEWS FUNCTION =================
  async function sendCompanyNews() {
    try {

      const channel = await client.channels.fetch(NEWS_CHANNEL);

      const today = new Date();
      const from = new Date(today);
      from.setDate(today.getDate() - 1);

      const fromDate = from.toISOString().split("T")[0];
      const toDate = today.toISOString().split("T")[0];

      // 20 τυχαίες εταιρίες κάθε φορά
      const sample = watchList.sort(() => 0.5 - Math.random()).slice(0, 20);

      for (const symbol of sample) {

        const res = await axios.get(
          `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${FINNHUB_API}`
        );

        if (!res.data || !res.data.length) continue;

        const news = res.data[0];

        await channel.send(
          `📈 **${symbol}**
**${news.headline}**
${news.url}`
        );

        // καθυστέρηση για rate limit
        await new Promise(r => setTimeout(r, 1500));
      }

    } catch (err) {
      console.log("Company news error:", err.message);
    }
  }


  // ================= SCHEDULED NEWS =================
  // 09:00 Ελλάδα
  cron.schedule("0 9 * * *", sendCompanyNews, {
    timezone: "Europe/Athens"
  });

  // 14:00 Ελλάδα
  cron.schedule("0 14 * * *", sendCompanyNews, {
    timezone: "Europe/Athens"
  });

  // 19:00 Ελλάδα
  cron.schedule("11 19 * * *", sendCompanyNews, {
    timezone: "Europe/Athens"
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

      res.data.earnings.slice(0, 25).forEach(e => {
        message += `**${e.symbol}** — ${e.date}\n`;
      });

      channel.send(message);

    } catch (err) {
      console.log("Earnings Error:", err.message);
    }
  });


  // ================= MARKET CRASH SCANNER =================
  setInterval(async () => {

    if (!watchList.length) return;
    if (!isMarketTime()) return;

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

        if (change <= -7 && !alertedToday.has(symbol)) {

          alertedToday.add(symbol);

          await channel.send(
            `🚨 **${symbol} crashed ${change.toFixed(2)}% today!**
Price: $${price}
Previous Close: $${prevClose}`
          );
        }
      }

      indexPointer += batchSize;
      if (indexPointer >= watchList.length) indexPointer = 0;

    } catch (err) {
      console.log("Scanner error:", err.message);
    }

  }, 60000);

});
if (!TOKEN) {
  console.error("TOKEN NOT FOUND IN ENV VARIABLES");
  process.exit(1);
}

client.login(TOKEN);
