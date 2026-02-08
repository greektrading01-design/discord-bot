const fs = require("fs");

async function getAllStocks() {
  try {

    // ===== Load S&P 500 from CSV =====
    const raw = fs.readFileSync("./sp500.csv", "utf8");

    const lines = raw.split("\n").slice(1);
    const sp500 = lines
      .map(line => line.split(",")[0])
      .filter(symbol => symbol && symbol.length <= 5);


    // ===== Load NASDAQ100 =====
    const nasdaq = JSON.parse(
      fs.readFileSync("./nasdaq100.json", "utf8")
    );

    const combined = [...new Set([...sp500, ...nasdaq])];

    return combined;

  } catch (err) {
    console.log("Stock list local load error:", err.message);
    return [];
  }
}

module.exports = getAllStocks;
