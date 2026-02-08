const axios = require("axios");

const FINNHUB_API = process.env.FINNHUB_API;

// ---- S&P500 symbols ----
const SP500_URL =
  "https://raw.githubusercontent.com/datasets/s-and-p-500-companies/master/data/constituents_symbols.txt";

// ---- NASDAQ100 symbols ----
const NASDAQ100_URL =
  "https://raw.githubusercontent.com/pssolanki111/NASDAQ-100-Stock-Tickers/main/nasdaq100_tickers.txt";

async function getAllStocks() {
  try {
    const sp = await axios.get(SP500_URL);
    const nasdaq = await axios.get(NASDAQ100_URL);

    const sp500 = sp.data.split("\n");
    const nasdaq100 = nasdaq.data.split("\n");

    // merge + remove duplicates
    const merged = [...new Set([...sp500, ...nasdaq100])];

    console.log("S&P500:", sp500.length);
    console.log("NASDAQ100:", nasdaq100.length);
    console.log("Total tradable stocks:", merged.length);

    return merged.filter(Boolean);
  } catch (err) {
    console.log("Stock list error:", err.message);
    return [];
  }
}

module.exports = getAllStocks;
