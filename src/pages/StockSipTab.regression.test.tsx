import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BaseProvider, LightTheme } from 'baseui';
import { StockSipTab } from './StockSipTab';
import { yahooFinanceService } from '../services/yahooFinanceService';

jest.mock('../components/charts/StockPortfolioValueChart', () => ({
  StockPortfolioValueChart: () => <div data-testid="portfolio-value-chart" />,
}));
jest.mock('../components/charts/StockPortfolioValueNormalizedChart', () => ({
  StockPortfolioValueNormalizedChart: () => <div data-testid="portfolio-normalized-chart" />,
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/stock-sip']}>
      <BaseProvider theme={LightTheme}>
        <StockSipTab />
      </BaseProvider>
    </MemoryRouter>
  );

describe('[REGRESSION] StockSipTab — /stock-sip', () => {
  beforeEach(() => yahooFinanceService.clearCache());

  it('SMOKE: page renders without crashing', () => {
    renderPage();
    expect(document.body).toBeTruthy();
  });

  it('STRUCTURE: both Portfolio A and Portfolio B sections render', () => {
    renderPage();
    expect(screen.getByText('Portfolio A')).toBeInTheDocument();
    expect(screen.getByText('Portfolio B')).toBeInTheDocument();
  });

  it('STRUCTURE: ticker inputs exist with correct placeholder', () => {
    renderPage();
    const tickers = screen.getAllByPlaceholderText('Ticker (e.g. AAPL, ~12)');
    expect(tickers.length).toBeGreaterThanOrEqual(1);
  });

  it('STRUCTURE: monthly amount inputs exist', () => {
    renderPage();
    const amounts = screen.getAllByPlaceholderText('Monthly');
    expect(amounts.length).toBeGreaterThanOrEqual(1);
  });

  it('STRUCTURE: Plot button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /plot/i })).toBeInTheDocument();
  });

  it('INTERACTION: Plot with Portfolio A shows SIP breakdown table', async () => {
    renderPage();
    const [tickerInput] = screen.getAllByPlaceholderText('Ticker (e.g. AAPL, ~12)');
    const [amountInput] = screen.getAllByPlaceholderText('Monthly');
    await userEvent.type(tickerInput, '~12');
    await userEvent.type(amountInput, '500');
    await userEvent.click(screen.getByRole('button', { name: /plot/i }));
    expect(await screen.findByText(/Portfolio A.*SIP Calculation Breakdown/i)).toBeInTheDocument();
  });

  it('INTERACTION: breakdown table contains expected columns', async () => {
    renderPage();
    const [tickerInput] = screen.getAllByPlaceholderText('Ticker (e.g. AAPL, ~12)');
    const [amountInput] = screen.getAllByPlaceholderText('Monthly');
    await userEvent.type(tickerInput, '~12');
    await userEvent.type(amountInput, '500');
    await userEvent.click(screen.getByRole('button', { name: /plot/i }));
    await screen.findByText(/SIP Calculation Breakdown/i);
    // Use exact column header text to avoid matching the description paragraph
    expect(screen.getByText('Price ($)')).toBeInTheDocument();
    expect(screen.getByText('Accumulated Units')).toBeInTheDocument();
  });

  it('OUTPUT: portfolio value chart renders after Plot', async () => {
    renderPage();
    const [tickerInput] = screen.getAllByPlaceholderText('Ticker (e.g. AAPL, ~12)');
    const [amountInput] = screen.getAllByPlaceholderText('Monthly');
    await userEvent.type(tickerInput, '~12');
    await userEvent.type(amountInput, '500');
    await userEvent.click(screen.getByRole('button', { name: /plot/i }));
    expect(await screen.findByTestId('portfolio-value-chart')).toBeInTheDocument();
  });

  it('REGRESSION: re-clicking Plot does not duplicate charts', async () => {
    renderPage();
    const [tickerInput] = screen.getAllByPlaceholderText('Ticker (e.g. AAPL, ~12)');
    const [amountInput] = screen.getAllByPlaceholderText('Monthly');
    await userEvent.type(tickerInput, '~12');
    await userEvent.type(amountInput, '500');
    const plotBtn = screen.getByRole('button', { name: /plot/i });
    await userEvent.click(plotBtn);
    await screen.findByTestId('portfolio-value-chart');
    await userEvent.click(plotBtn);
    expect(screen.getAllByTestId('portfolio-value-chart')).toHaveLength(1);
    expect(screen.getAllByTestId('portfolio-normalized-chart')).toHaveLength(1);
  });
});
