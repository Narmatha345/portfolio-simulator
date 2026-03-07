import { ProcessedIndexData } from "../types/index";
import { toaster } from "baseui/toast";
import React from "react";

let globalOpenHelp: ((topic: string) => void) | null = null;

export const setGlobalOpenHelp = (openHelp: (topic: string) => void) => {
  globalOpenHelp = openHelp;
};

const showErrorToast = (message: string) => {
  const handleHelpClick = (e: React.MouseEvent) => {
    e.preventDefault();
    globalOpenHelp?.("yahoo-tickers");
  };

  toaster.negative(
    React.createElement(
      "div",
      null,
      message,
      React.createElement("br"),
      React.createElement("br"),
      React.createElement(
        "a",
        {
          href: "#",
          onClick: handleHelpClick,
          style: { color: "white", textDecoration: "underline", cursor: "pointer" },
        },
        "📖 Help?"
      )
    ),
    { autoHideDuration: 7000 }
  );
};

interface YahooFinanceResponse {
  chart: {
    result: Array<{
      timestamp: number[];
      indicators: {
        adjclose?: Array<{ adjclose: (number | null)[] }>;
      };
    }>;
    error: any;
  };
}

class YahooFinanceService {
  private stockDataCache: Record<string, ProcessedIndexData[]> = {};
  private currencyCache: Record<string, string> = {};

  async fetchStockData(symbol: string): Promise<ProcessedIndexData[]> {
    if (this.stockDataCache[symbol]) return this.stockDataCache[symbol];

    try {
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=100y`;

      const proxyUrl = `https://cors-proxy-lake-omega.vercel.app/api/proxy?url=${encodeURIComponent(
        yahooUrl
      )}`;

      const response = await fetch(proxyUrl);

      if (!response.ok) throw new Error(`Ticker "${symbol}" not found`);

      const yahooData: YahooFinanceResponse = await response.json();

      const chart = yahooData?.chart?.result?.[0];
      if (!chart) throw new Error(`No data for ticker "${symbol}"`);

      const timestamps = chart.timestamp || [];
      const pricesRaw = chart.indicators.adjclose?.[0]?.adjclose || [];

      const processed: ProcessedIndexData[] = [];
      for (let i = 0; i < timestamps.length; i++) {
        const price = pricesRaw[i];
        if (price === null || price === undefined) continue;

        const date = new Date(timestamps[i] * 1000);
        processed.push({
          date: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())),
          nav: price,
        });
      }

      if (processed.length < 2) throw new Error(`Not enough valid data for ticker "${symbol}"`);

      this.stockDataCache[symbol] = processed;
      return processed;
    } catch (err) {
      const msg = `Error fetching Yahoo Finance ticker "${symbol}"`;
      console.error(msg, err);
      showErrorToast(msg);
      throw err;
    }
  }

  async fetchStockDataConverted(
    symbol: string,
    convertToINR: boolean
  ): Promise<ProcessedIndexData[]> {
    const data = await this.fetchStockData(symbol);
    if (!convertToINR) return data;

    const currency = this.currencyCache[symbol];
    if (!currency || currency === "INR") return data;

    return this._convertToINR(data, currency);
  }

  private async _convertToINR(
    data: ProcessedIndexData[],
    fromCurrency: string
  ): Promise<ProcessedIndexData[]> {
    const forexSymbol = `${fromCurrency}INR=X`;
    const forexData = await this.fetchStockData(forexSymbol);

    let fxIndex = 0;
    let rate = forexData[0]?.nav || 1;

    return data.map((point) => {
      while (fxIndex < forexData.length && forexData[fxIndex].date <= point.date) {
        rate = forexData[fxIndex].nav;
        fxIndex++;
      }
      return { date: point.date, nav: point.nav * rate };
    });
  }

  clearCache(): void {
    this.stockDataCache = {};
    this.currencyCache = {};
  }
}

export const yahooFinanceService = new YahooFinanceService();
