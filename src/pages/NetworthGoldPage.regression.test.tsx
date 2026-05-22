import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BaseProvider, LightTheme } from 'baseui';
import NetworthGoldPage from './NetworthGoldPage';
import { yahooFinanceService } from '../services/yahooFinanceService';

jest.mock('../components/charts/StockPriceChart', () => ({
  StockPriceChart: () => <div data-testid="stock-price-chart" />,
}));

const now = new Date();
const fakePriceData = Array.from({ length: 15 }, (_, i) => {
  const d = new Date(now.getFullYear(), now.getMonth() - (14 - i), 1);
  return { date: d, nav: 100 * Math.pow(1.12, i / 12) };
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/networth-gold']}>
      <BaseProvider theme={LightTheme}>
        <NetworthGoldPage />
      </BaseProvider>
    </MemoryRouter>
  );

describe('[REGRESSION] NetworthGoldPage — /networth-gold', () => {
  beforeEach(() => {
    yahooFinanceService.clearCache();
    jest.spyOn(yahooFinanceService, 'fetchStockData').mockResolvedValue(fakePriceData as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('SMOKE: page renders without crashing', () => {
    renderPage();
    expect(document.body).toBeTruthy();
  });

  it('STRUCTURE: ticker input exists with correct placeholder', () => {
    renderPage();
    expect(screen.getByPlaceholderText('AAPL')).toBeInTheDocument();
  });

  it('STRUCTURE: units input exists', () => {
    renderPage();
    expect(screen.getByPlaceholderText('10')).toBeInTheDocument();
  });

  it('STRUCTURE: Add Holding button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /add holding/i })).toBeInTheDocument();
  });

  it('STRUCTURE: Load GOLD View button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /load gold view/i })).toBeInTheDocument();
  });

  it('INTERACTION: Add Holding increases unit input count', async () => {
    renderPage();
    const before = screen.getAllByPlaceholderText('10').length;
    await userEvent.click(screen.getByRole('button', { name: /add holding/i }));
    expect(screen.getAllByPlaceholderText('10').length).toBe(before + 1);
  });

  it('INTERACTION: Load GOLD View renders chart', async () => {
    renderPage();
    await userEvent.type(screen.getByPlaceholderText('AAPL'), 'MSFT');
    await userEvent.type(screen.getByPlaceholderText('10'), '50');
    await userEvent.click(screen.getByRole('button', { name: /load gold view/i }));
    expect((await screen.findAllByTestId('stock-price-chart')).length).toBeGreaterThanOrEqual(1);
  });

  it('REGRESSION: Remove button removes the holding row', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /add holding/i }));
    const before = screen.getAllByPlaceholderText('10').length;
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await userEvent.click(removeButtons[0]);
    expect(screen.getAllByPlaceholderText('10').length).toBe(before - 1);
  });
});
