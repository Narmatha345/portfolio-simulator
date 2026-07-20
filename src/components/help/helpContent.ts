export interface HelpTopic {
  title: string;
  content: string;
}

export const helpContent: Record<string, HelpTopic> = {
  // Getting Started
  'getting-started': {
    title: 'Getting Started',
    content: `A portfolio simulator that lets you compare investments using historical stock and index data from Yahoo Finance.

**Features:**
- **Lumpsum:** Compare one-time investments across two portfolios (e.g., TSLA vs NVDA)
- **SIP (Stocks):** Simulate monthly investments and compare two portfolios
- **SWP (Stocks):** Simulate systematic withdrawals with different strategies

**Use it to:**
- Backtest stock and index investments
- Compare how different portfolios would have performed
- Evaluate withdrawal strategies for retirement or income`,
  },

  'portfolios-assets': {
    title: 'Portfolios & Assets',
    content: `**Portfolio:**
A list of stocks or indices with investment amounts. You can add multiple tickers per portfolio (e.g., Portfolio A: TSLA $5000 + AAPL $5000).

**Comparing portfolios:**
Build Portfolio A and Portfolio B side by side to compare performance. Each appears as a separate line on the chart.

**Ticker format:**
Use Yahoo Finance symbols (e.g., AAPL, TSLA, NVDA, ^GSPC). Indian stocks use .NS (NSE) or .BO (BSE) suffix.

**Synthetic benchmarks:**
Use ~12 for a 12% fixed return, ~TARGET_RATE for 12%, or ~TARGET_RATE:10 for 10% — useful for comparing against a target.`,
  },

  'xirr-explained': {
    title: 'What is XIRR?',
    content: `XIRR (Extended Internal Rate of Return) is the annualized return that accounts for irregular cash flows.

**Why XIRR over CAGR?**
- CAGR works for lumpsum (single investment, single redemption)
- XIRR handles multiple investments at different times (like SIP)

**Example:**
If you invested $10,000/month for 5 years and your corpus is $850,000, XIRR tells you the effective annual return considering each monthly investment date.`,
  },

  'url-sharing': {
    title: 'URL Sharing',
    content: `Your setup (portfolios, tickers, amounts, date range) may be saved to the URL depending on the page.

**How to use:**
- Copy the URL from your browser's address bar
- Share it so others see your exact setup
- Bookmark it to save your analysis for later

No login or account needed.`,
  },

  // Lumpsum (Stocks)
  'lumpsum': {
    title: 'Lumpsum',
    content: `Compare two portfolios of one-time (lumpsum) investments using historical price data.

**How to use:**
1. Add stocks to Portfolio A and/or B (ticker + investment amount)
2. Pick start and end dates
3. Click "Plot"

**Results:**
- **Price Chart:** Raw price over time (start = 1)
- **Portfolio Value Chart:** Total value in $ over time
- **Table:** Investment, units bought, end value, return %, and XIRR (annualized return)

**Synthetic benchmarks:**
Use ~12 for 12% fixed return, ~TARGET_RATE for 12%, or ~TARGET_RATE:10 for 10% — to compare against a target.`,
  },

  // SIP (Stocks)
  'sip-stocks': {
    title: 'SIP (Stocks)',
    content: `Simulate monthly investments into stocks and compare two portfolios.

**How to use:**
1. Add stocks to Portfolio A and/or B (ticker + monthly amount)
2. Select start and end month
3. Click "Plot"

**Results:**
- **Price Chart:** Price over time (start = 1)
- **Portfolio Value Chart:** Cumulative value in $ over time
- **Table:** For each month: price, units bought, accumulated units; final XIRR

**Synthetic benchmarks:**
Use ~12, ~TARGET_RATE, or ~TARGET_RATE:10 to compare against a fixed return target.`,
  },

  // SWP (Stocks)
  'swp-stocks': {
    title: 'SWP (Stocks)',
    content: `Simulate systematic withdrawals from a stock portfolio and compare two withdrawal strategies.

**How to use:**
1. Add a ticker and starting corpus (total amount invested)
2. Define Strategy A and Strategy B:
   - **Fixed $/month:** Withdraw the same amount each month
   - **Fixed $ + growth %/month:** Start with an amount, increase by % each month
   - **% of portfolio/month:** Withdraw a percentage of current value each month
3. Select date range and click "Plot"

**Results:**
- **Portfolio Value Chart:** How your corpus changes over time
- **Withdrawal Chart:** Amount withdrawn each month
- **Table:** Month-by-month breakdown

Useful for retirement planning or evaluating income strategies.`,
  },

  // Yahoo Prices
  'yahoo-prices': {
    title: 'Yahoo Prices',
    content: `Fetch and explore daily adjusted close price data for any Yahoo Finance ticker.

**How to use:**
1. Enter a ticker symbol (e.g. AAPL, TCS.NS, ^NSEI, GC=F)
2. Choose a start and end date
3. Click "Fetch"

**Results:**
- **Price Chart:** Daily adjusted close price over time
- **Month-start / Month-end Summary:** First and last price of each month — useful for SIP and price comparison
- **Data Table:** Full list of daily dates and prices
- **Download CSV:** Export the data as a CSV file for offline analysis

**Use it to:**
- Quickly look up historical prices for a ticker
- Compare month-start vs month-end prices
- Export data for spreadsheet analysis`,
  },

  // Weekly High/Low
  'weekly-high-low': {
    title: 'Weekly High/Low',
    content: `View weekly or monthly OHLC (Open, High, Low, Close) price ranges for a stock or index.

**How to use:**
1. Enter a ticker symbol (e.g. AAPL, RELIANCE.NS)
2. Choose a date range
3. Select "Weekly" or "Monthly" view
4. Click "Plot"

**Results:**
- **OHLC Bar Chart:** Each bar shows the open, high, low, and close for that week or month
- Helps identify price ranges, volatility, and trend direction

**Weekly view:** Shows high/low for each calendar week
**Monthly view:** Aggregates daily data into monthly high/low bars

**Use it to:**
- Identify price support and resistance levels
- Understand how volatile a stock is week-to-week
- See monthly trading ranges at a glance`,
  },

  // Compare (Lumpsum vs SIP)
  'compare': {
    title: 'Compare (Lumpsum vs SIP)',
    content: `Compare two investment strategies — Lumpsum and SIP — using the same total amount and the same stocks.

**How it works:**
- **Lumpsum:** The full amount is invested at the start of the first month
- **SIP:** The total amount is divided equally across each month in the range (equal monthly instalments)

**How to use:**
1. Add one or more stocks with a total investment amount (e.g. AAPL $12,000)
2. Pick start and end month
3. Click "Compare"

**Results:**
- **Summary Table:** Total invested, end value, return %, and XIRR for both Lumpsum and SIP
- **Winner:** Shows which strategy gave a higher final value and by how much
- **Per-stock breakdown:** Individual return for each ticker under each strategy
- **SIP Monthly Breakdown Table:** Month-by-month: price, units bought, accumulated units, portfolio value, return %

**Use ~12 for a synthetic 12% fixed-return path** to see how lumpsum vs SIP compares against a flat benchmark.`,
  },

  // Net Worth Estimator
  'net-worth': {
    title: 'Net Worth',
    content: `Track the historical value of your stock/ETF portfolio over time based on units you hold.

**How to use:**
1. Add your holdings — one row per ticker (e.g. AAPL: 50 shares, MSFT: 30 shares)
2. Use ~USD_CASH for cash holdings in USD
3. Pick a date range
4. Click "Plot"

**Results:**
- **Stacked Area Chart:** Total net worth broken down by ticker over time (each layer = one holding)
- **Per-Ticker Value Chart:** Normalized growth of each individual holding (start = 100)
- **Summary:** Final total value, change over the period

**Use it to:**
- Visualize how your portfolio's value has changed over time
- See which holdings contributed most (or least) to your growth
- Understand concentration risk across your holdings

**Tip:** Units represent shares/units held, not dollar amount. Enter the number of shares you actually own.`,
  },

  // Net Worth AI
  'net-worth-ai': {
    title: 'Net Worth AI',
    content: `Same as Net Worth but with an AI assistant that can analyze your portfolio and answer questions.

**How to use:**
1. Add holdings (ticker + units) and click "Plot" to load your portfolio data
2. Once the chart loads, select an AI provider: **Gemini**, **ChatGPT**, or **Claude**
3. Enter your API key for the chosen provider
4. Type a question or prompt about your portfolio
5. Click "Ask AI" to get a response

**What the AI can help with:**
- Summarizing portfolio performance
- Identifying best and worst performers
- Suggesting what to watch or rebalance
- Answering questions like "Which holding grew the most?" or "How did my tech stocks do?"

**Note:** Your API key is used directly in the browser and is never stored on a server. Keep it private.

**Supported AI providers:**
- **Gemini:** Google's AI (requires Gemini API key)
- **ChatGPT:** OpenAI's model (requires OpenAI API key)
- **Claude:** Anthropic's model (requires Claude API key)`,
  },

  // Net Worth GOLD
  'net-worth-gold': {
    title: 'Net Worth GOLD',
    content: `Compare your stock portfolio's value against gold (GLD ETF) over the same time period.

**How to use:**
1. Add your holdings (ticker + number of units)
2. Pick a date range
3. Click "Load"

**Results:**
- **Portfolio vs Gold Chart:** Your portfolio's total value alongside GLD (Gold ETF in USD) on the same chart
- **Per-Ticker Normalized Chart:** How each individual stock grew, normalized to start at 100
- **Summary:** Change in portfolio value over the period

**Why compare with gold?**
Gold is often used as a safe-haven and inflation hedge. Comparing your portfolio against gold tells you whether your equity investments outperformed an alternative store of value.

**Note:** Gold data is fetched via the GLD ETF ticker (USD). For Indian gold ETFs, add GOLDBEES.NS directly as one of your holdings in the Net Worth page.`,
  },

  // FX View
  'fx-view': {
    title: 'FX View',
    content: `View the value of a single stock holding in both its local currency and a target currency, applying live historical FX rates.

**How to use:**
1. Enter a **Ticker** (e.g. MSFT for a US stock, TCS.NS for an Indian stock)
2. Enter the **Local currency** — the currency the stock trades in (e.g. USD for MSFT)
3. Enter the **Target currency** — the currency you want to convert to (e.g. INR)
4. Enter **Units held** (number of shares)
5. Pick a date range and click "Load"

**Results:**
- **Dual-line Chart:** Portfolio value in local currency vs target currency over time
- **Table:** Date-by-date breakdown of stock price, FX rate, local value, and target value
- **Current values:** Latest portfolio value in both currencies

**Use it to:**
- See what your US stocks are worth in INR (or any other currency)
- Understand the combined impact of stock price movement + currency movement
- Evaluate whether currency gains or losses amplified or reduced your returns

**Example:** 10 shares of MSFT (USD) converted to INR — if MSFT rose 20% but USD/INR fell 5%, your net INR return is ~14%.`,
  },

  // Cross-Market Compare
  'cross-market': {
    title: 'Cross-Market Compare',
    content: `Compare a lumpsum investment in two tickers from different markets (e.g. US gold vs Indian gold ETF), with full currency conversion.

**How to use:**
1. Enter **Ticker 1** and its currency (e.g. GLD — USD)
2. Enter **Ticker 2** and its currency (e.g. GOLDBEES.NS — INR)
3. Enter the initial investment amount (same for both)
4. Pick a date range and click "Load"

**Results:**
- **Value in Currency 1:** How both investments performed in Ticker 1's currency (e.g. USD)
- **Value in Currency 2:** How both investments performed in Ticker 2's currency (e.g. INR)
- **Return % for each investment in both currencies**
- **Raw price charts** for both tickers and the FX rate used

**How currency conversion works:**
The FX rate between the two currencies is fetched automatically (e.g. USDINR=X for USD↔INR). Each investment's value is converted using the historical rate for each date.

**Use it to:**
- Compare the same asset listed in two markets (e.g. GLD vs GOLDBEES.NS)
- Evaluate whether the local or foreign version of an investment performed better
- Understand how currency movement affected the comparison`,
  },

  // SIP Cross-Market
  'sip-cross-market': {
    title: 'SIP Cross-Market',
    content: `Compare two SIP portfolios that invest across different global markets, with full multi-currency conversion to a common reporting currency.

**How to use:**
1. Set a **monthly SIP amount** and **invest currency** (the currency you invest in, e.g. USD)
2. Build **Portfolio A** and **Portfolio B** — each can have multiple tickers from different countries
3. For each ticker, specify the ticker symbol, monthly amount, and the native currency it trades in
   - Example: AAPL (USD $50/mo) + TCS.NS (INR ₹4000/mo)
   - Tip: Currency is auto-detected from the ticker suffix (.NS→INR, .L→GBP, etc.)
4. Pick a start and end month and click "Compare"

**Results:**
- **Portfolio value chart (in invest currency):** Total value of Portfolio A vs B, in your common currency
- **Per-currency charts:** Breakdown of value by each currency component
- **Summary Table:** Total invested, final value, return %, and XIRR for both portfolios
- **Detailed monthly breakdown:** Month-by-month SIP buys, prices, FX rates, and portfolio value

**XIRR calculation:**
Each monthly investment is converted to the invest currency using the FX rate on that date for an apples-to-apples comparison.

**Use it to:**
- Compare a purely domestic portfolio vs a globally diversified one
- Evaluate whether international diversification improved or reduced returns over your period`,
  },

  // Supported Assets
  'data-sources': {
    title: 'Data Source',
    content: `**Yahoo Finance:**
All price data comes from [Yahoo Finance](https://finance.yahoo.com). Supports:
- **Stocks:** US (AAPL, TSLA), Indian (TCS.NS, RELIANCE.BO), and global
- **Indices:** ^GSPC (S&P 500), ^NSEI (NIFTY 50), ^IXIC (NASDAQ)
- **ETFs**
- **Commodities:** GC=F (gold), BTC-USD (crypto)

**Synthetic benchmarks:**
Use ~12 for 12% fixed return, ~TARGET_RATE for 12%, or ~TARGET_RATE:10 for 10%. These simulate a hypothetical asset growing at that rate.`,
  },

  'yahoo-tickers': {
    title: 'Common Yahoo Finance Tickers',
    content: `**Indian Stocks:**
TCS.NS -> Tata Consultancy Services (NSE)
RELIANCE.BO -> Reliance Industries (BSE)
HDFCBANK.NS -> HDFC Bank (NSE)

**US Stocks (USD):**
AAPL -> Apple Inc.
TSLA -> Tesla
MSFT -> Microsoft

**Indices:**
^NSEI -> NIFTY 50 (INR)
^BSESN -> SENSEX (INR)
^GSPC -> S&P 500 (USD)
^IXIC -> NASDAQ Composite (USD)
^N225 -> Nikkei 225 (JPY)

**Currency:**
USDINR=X -> USD to INR
EURUSD=X -> Euro to USD

**Crypto:**
BTC-USD -> Bitcoin in USD
ETH-USD -> Ethereum in USD

**Commodities:**
GC=F -> Gold Futures (USD)
GOLDBEES.BO -> Gold ETF (INR)

**Finding tickers:**
Google "[stock/index name] yahoo finance" and use the symbol shown in the page.`,
  },

  // Understanding Charts
  'understanding-charts': {
    title: 'Understanding Charts',
    content: `**Price Chart (normalized):**
Shows price over time with start = 1. Lets you compare growth of different tickers on the same scale.

**Portfolio Value Chart:**
Shows total portfolio value in $ over time. For lumpsum, it's invested amount × price change. For SIP, it adds up units bought each month × current price.

**SWP Withdrawal Chart:**
Shows the amount withdrawn each month under your chosen strategy.`,
  },
};

// Structure for navigation - categories can now be clickable
export const getTopicsByCategory = () => ({
  'Getting Started': {
    topicId: 'getting-started',
    subTopics: ['portfolios-assets', 'xirr-explained', 'url-sharing'],
  },
  'Data Source': {
    topicId: 'data-sources',
    subTopics: ['yahoo-tickers'],
  },
  'Understanding Charts': {
    topicId: 'understanding-charts',
    subTopics: [],
  },
  'Lumpsum': {
    topicId: 'lumpsum',
    subTopics: [],
  },
  'SIP (Stocks)': {
    topicId: 'sip-stocks',
    subTopics: [],
  },
  'SWP (Stocks)': {
    topicId: 'swp-stocks',
    subTopics: [],
  },
  'Yahoo Prices': {
    topicId: 'yahoo-prices',
    subTopics: [],
  },
  'Weekly High/Low': {
    topicId: 'weekly-high-low',
    subTopics: [],
  },
  'Compare': {
    topicId: 'compare',
    subTopics: [],
  },
  'Net Worth': {
    topicId: 'net-worth',
    subTopics: [],
  },
  'Net Worth AI': {
    topicId: 'net-worth-ai',
    subTopics: [],
  },
  'Net Worth GOLD': {
    topicId: 'net-worth-gold',
    subTopics: [],
  },
  'FX View': {
    topicId: 'fx-view',
    subTopics: [],
  },
  'Cross-Market': {
    topicId: 'cross-market',
    subTopics: [],
  },
  'SIP Cross-Market': {
    topicId: 'sip-cross-market',
    subTopics: [],
  },
});
