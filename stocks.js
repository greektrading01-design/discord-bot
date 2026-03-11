const fs = require("fs");

async function getAllStocks() {
  try {

    const raw = fs.readFileSync("./sp500.csv", "utf8");

    const lines = raw.split("\n").slice(1);
    const sp500 = lines
      .map(line => line.split(",")[0])
      .filter(symbol => symbol && symbol.length <= 5);

    const nasdaq = JSON.parse(
      fs.readFileSync("./nasdaq100.json", "utf8")
    );

    const combined = [...new Set([...sp500, ...nasdaq])];

    return combined;

  } catch (err) {
    console.log("Stock list load error:", err.message);
    return [];
  }
}

module.exports = getAllStocks;