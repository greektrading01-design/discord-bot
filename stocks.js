const fs = require("fs");

async function getAllStocks() {

  const raw = fs.readFileSync("./sp500.csv", "utf8");

  const lines = raw.split("\n").slice(1);

  const sp500 = lines
    .map(line => line.split(",")[0])
    .filter(symbol => symbol && symbol.length <= 5);

  const nasdaq = JSON.parse(
    fs.readFileSync("./nasdaq100.json", "utf8")
  );

  return [...new Set([...sp500, ...nasdaq])];
}

module.exports = getAllStocks;