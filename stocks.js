const axios = require("axios");

async function getAllStocks() {
  try {
    const res = await axios.get(
      `https://finnhub.io/api/v1/stock/symbol?exchange=US&token=${process.env.FINNHUB_API}`
    );

    const all = res.data;

    const filtered = all
      .filter(s => s.type === "Common Stock")
      .map(s => s.symbol);

    return filtered;

  } catch (err) {
    console.log("Stock list error:", err.message);
    return [];
  }
}

module.exports = getAllStocks;
