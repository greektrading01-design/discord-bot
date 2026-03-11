const { Client, GatewayIntentBits } = require("discord.js");
const axios = require("axios");
const fs = require("fs");
const getAllStocks = require("./stocks");

const TOKEN = process.env.TOKEN;
const FINNHUB_API = process.env.FINNHUB_API;
const NEWS_CHANNEL_ID = process.env.NEWS_CHANNEL_ID;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let watchList = [];
let sentNews = new Set();


// ================= LOAD SENT NEWS =================
function loadSentNews() {
  try {
    const data = JSON.parse(fs.readFileSync("./sentNews.json"));
    sentNews = new Set(data);
  } catch {
    sentNews = new Set();
  }
}

function saveSentNews() {
  fs.writeFileSync("./sentNews.json", JSON.stringify([...sentNews]));
}


// ================= SEND NEWS =================
async function sendCompanyNews() {

  if (!watchList.length) {
    console.log("Watchlist empty");
    return;
  }

  const channel = await client.channels.fetch(NEWS_CHANNEL_ID);

  const today = new Date();
  const from = new Date(today);
  from.setDate(today.getDate() - 1);

  const fromDate = from.toISOString().split("T")[0];
  const toDate = today.toISOString().split("T")[0];

  const shuffled = [...watchList].sort(() => 0.5 - Math.random());
  const sample = shuffled.slice(0, 10);

  for (const symbol of sample) {

    try {

      const res = await axios.get(
        `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${FINNHUB_API}`
      );

      if (!res.data || res.data.length === 0) continue;

      const news = res.data[0];

      if (sentNews.has(news.url)) continue;

      await channel.send(
`📈 **${symbol}**
${news.headline}
${news.url}`
      );

      sentNews.add(news.url);
      saveSentNews();

      await new Promise(r => setTimeout(r, 1500));

    } catch (err) {
      console.log("Skip", symbol);
    }
  }
}


// ================= BOT READY =================
client.once("ready", async () => {

  console.log(`Bot Ready: ${client.user.tag}`);

  watchList = await getAllStocks();
  console.log("Total stocks loaded:", watchList.length);

  loadSentNews();

  console.log("Running news job...");
  await sendCompanyNews();

  console.log("Job finished");
  process.exit(0);

});


// ================= LOGIN =================
console.log("Starting Discord login...");
client.login(TOKEN).catch(console.error);
