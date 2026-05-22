import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BaseProvider, LightTheme } from 'baseui';
import { StockPriceTab } from './StockPriceTab';
import { yahooFinanceService } from '../services/yahooFinanceService';

jest.mock('../components/charts/StockPriceChart', () => ({
  StockPriceChart: () => <div data-testid="stock-price-chart" />,
}));
jest.mock('../components/charts/StockPriceNormalizedChart', () => ({
  StockPriceNormalizedChart: () => <div data-testid="stock-price-normalized-chart" />,
}));
jest.mock('../components/charts/StockPortfolioValueChart', () => ({
  StockPortfolioValueChart: () => <div data-testid="portfolio-value-chart" />,
}));
jest.mock('../components/charts/StockPortfolioValueNormalizedChart', () => ({
  StockPortfolioValueNormalizedChart: () => <div data-testid="portfolio-normalized-chart" />,
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/stock-price']}>
      <BaseProvider theme={LightTheme}>
        <StockPriceTab />
      </BaseProvider>
    </MemoryRouter>
  );

describe('[REGRESSION] StockPriceTab — /stock-price', () => {
  beforeEach(() => yahooFinanceService.clearCache());

  it('SMOKE: page renders without crashing', () => {
    renderPage();
    expect(document.body).toBeTruthy();
  });

  it('STRUCTURE: Plot button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /plot/i })).toBeInTheDocument();
  });

  it('STRUCTURE: ticker inputs exist with correct placeholder', () => {
    renderPage();
    // Portfolio A and B both render a ticker input — use getAllByPlaceholderText
    expect(screen.getAllByPlaceholderText('Ticker (e.g. AAPL, ~12)').length).toBeGreaterThanOrEqual(1);
  });

  it('STRUCTURE: amount inputs exist', () => {
    renderPage();
    expect(screen.getAllByPlaceholderText('Amount').length).toBeGreaterThanOrEqual(1);
  });

  it('INTERACTION: clicking Plot with synthetic ticker renders price chart', async () => {
    renderPage();
    const [tickerInput] = screen.getAllByPlaceholderText('Ticker (e.g. AAPL, ~12)');
    const [amountInput] = screen.getAllByPlaceholderText('Amount');
    await userEvent.type(tickerInput, '~12');
    await userEvent.type(amountInput, '1000');
    await userEvent.click(screen.getByRole('button', { name: /plot/i }));
    expect(await screen.findByTestId('stock-price-chart')).toBeInTheDocument();
  });

  it('REGRESSION: clicking Plot multiple times keeps chart visible', async () => {
    renderPage();
    const [tickerInput] = screen.getAllByPlaceholderText('Ticker (e.g. AAPL, ~12)');
    const [amountInput] = screen.getAllByPlaceholderText('Amount');
    await userEvent.type(tickerInput, '~12');
    await userEvent.type(amountInput, '1000');
    const plotBtn = screen.getByRole('button', { name: /plot/i });
    await userEvent.click(plotBtn);
    await screen.findByTestId('stock-price-chart');
    await userEvent.click(plotBtn);
    expect(screen.getAllByTestId('stock-price-chart').length).toBeGreaterThanOrEqual(1);
  });

  it('OUTPUT: normalized chart also renders after Plot', async () => {
    renderPage();
    const [tickerInput] = screen.getAllByPlaceholderText('Ticker (e.g. AAPL, ~12)');
    const [amountInput] = screen.getAllByPlaceholderText('Amount');
    await userEvent.type(tickerInput, '~12');
    await userEvent.type(amountInput, '1000');
    await userEvent.click(screen.getByRole('button', { name: /plot/i }));
    expect(await screen.findByTestId('stock-price-normalized-chart')).toBeInTheDocument();
  });
});
