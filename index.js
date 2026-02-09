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


// ================= MARKET HOURS (PRE + MARKET + AFTER) =================
function isMarketTime() {
  const now = new Date();

  const greekTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Athens" })
  );

  const day = greekTime.getDay();
  const hour = greekTime.getHours();

  // μόνο Δευτέρα - Παρασκευή
  if (day === 0 || day === 6) return false;

  // 11:00 -> 03:00 Ελλάδας
  if (hour >= 11 || hour < 3) return true;

  return false;
}


// ================= COMPANY NEWS FUNCTION =================
async function sendCompanyNews() {
  try {

    if (!watchList.length) return;

    const channel = await client.channels.fetch(NEWS_CHANNEL);

    const today = new Date();
    const from = new Date(today);
    from.setDate(today.getDate() - 1);

    const fromDate = from.toISOString().split("T")[0];
    const toDate = today.toISOString().split("T")[0];

    // 20 τυχαίες εταιρίες κάθε φορά
    const sample = [...watchList].sort(() => 0.5 - Math.random()).slice(0, 20);

    console.log("Sending company news...");

    for (const symbol of sample) {

      try {

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

        // anti rate-limit
        await new Promise(r => setTimeout(r, 1500));

      } catch (err) {
        console.log("News skip:", symbol);
      }
    }

  } catch (err) {
    console.log("Company news error:", err.message);
  }
}


// ================= BOT READY =================
client.once("clientReady", async (client) => {

 console.log(`Bot Ready: ${client.user.tag}`);


  watchList = await getAllStocks();
  console.log("Total US stocks loaded:", watchList.length);

  // TEST SEND (μόνο στο restart για επιβεβαίωση)
  await sendCompanyNews();
});


// ================= SCHEDULED NEWS =================
// Ελλάδα: 09:00 12:00 15:00 18:00 21:00
// UTC:    07:00 10:00 13:00 16:00 19:00
cron.schedule("00 8,13,19 * * *", sendCompanyNews);



// ================= WEEKLY EARNINGS =================
cron.schedule("0 8 * * 6", async () => { // 10:00 Ελλάδα

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

    await channel.send(message);

  } catch (err) {
    console.log("Earnings Error:", err.message);
  }
});


// ================= REAL MARKET SCANNER (POLYGON) =================

const POLYGON_API = process.env.POLYGON_API;

setInterval(async () => {

  if (!watchList.length) return;
  if (!isMarketTime()) return;

  console.log("SCANNER LOOP RUNNING");

  try {

    const channel = await client.channels.fetch(ALERT_CHANNEL);

    // 5 stocks κάθε κύκλο
    const batchSize = 1;
    const batch = watchList.slice(indexPointer, indexPointer + batchSize);

    for (const symbol of batch) {

      try {

        // Polygon real daily data
        const url = `https://api.polygon.io/v2/aggs/ticker/${symbol}/prev?adjusted=true&apiKey=${POLYGON_API}`;
        const res = await axios.get(url);

        if (!res.data || !res.data.results || !res.data.results.length) {
          console.log(`NO DATA: ${symbol}`);
          continue;
        }

        const day = res.data.results[0];

        const close = day.c;   // last close
        const open = day.o;    // open
        const high = day.h;
        const low = day.l;

        if (!close || !open) {
          console.log(`BAD DATA: ${symbol}`);
          continue;
        }

        // ημερήσια πτώση
        const change = ((close - open) / open) * 100;

        console.log(`${symbol} change: ${change.toFixed(2)}%`);

        if (change <= -1 && !alertedToday.has(symbol)) {

          alertedToday.add(symbol);

          await channel.send(
`🚨 **${symbol} CRASH ALERT**

Daily Change: ${change.toFixed(2)}%
Open: $${open}
Close: $${close}
Low: $${low}
High: $${high}

https://www.tradingview.com/symbols/${symbol}`
          );

        }

        // anti-rate limit
        await new Promise(r => setTimeout(r, 1200));

      } catch (err) {
        console.log(`Polygon error ${symbol}:`, err.response?.status);
      }

    }

    indexPointer += batchSize;
    if (indexPointer >= watchList.length) indexPointer = 0;

  } catch (err) {
    console.log("Scanner fatal error:", err.message);
  }

}, 12000);


client.login(TOKEN);
