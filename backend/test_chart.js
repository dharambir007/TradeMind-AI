const YahooFinance = require("yahoo-finance2").default;
const yahooFinance = new YahooFinance();

function toUnixSeconds(date) {
  return Math.floor(date.getTime() / 1000);
}

function getRangeWindow(range) {
  const now = new Date();
  const period2 = toUnixSeconds(now);
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  return { period1: toUnixSeconds(start), period2 };
}

async function run() {
  const interval = "5m";
  const { period1, period2 } = getRangeWindow("1d");

  const modernOptions = {
    period1,
    period2,
    interval,
    includePrePost: false,
    events: "div|split|earn",
    return: "object",
  };

  try {
    const res = await yahooFinance.chart("RELIANCE.NS", modernOptions, { validateResult: true });
    console.log("Success with modernOptions");
  } catch (error) {
    console.error("Failed modernOptions:", error.message);
  }

  const fallbackOptions = {
    range: "1d",
    interval,
    includePrePost: false,
    events: "div|split|earn",
    return: "object",
  };

  try {
    const res = await yahooFinance.chart("RELIANCE.NS", fallbackOptions, { validateResult: true });
    console.log("Success with fallbackOptions");
  } catch (error) {
    console.error("Failed fallbackOptions:", error.message);
  }
}

run();
