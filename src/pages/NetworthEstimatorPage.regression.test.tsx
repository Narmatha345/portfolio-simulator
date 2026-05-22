import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BaseProvider, LightTheme } from 'baseui';
import { NetworthEstimatorPage } from './NetworthEstimatorPage';
import { yahooFinanceService } from '../services/yahooFinanceService';

jest.mock('../components/charts/NetWorthStackedAreaChart', () => ({
  NetWorthStackedAreaChart: () => <div data-testid="networth-stacked-chart" />,
}));
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
    <MemoryRouter initialEntries={['/networth-estimator']}>
      <BaseProvider theme={LightTheme}>
        <NetworthEstimatorPage />
      </BaseProvider>
    </MemoryRouter>
  );

describe('[REGRESSION] NetworthEstimatorPage — /networth-estimator', () => {
  beforeEach(() => {
    yahooFinanceService.clearCache();
    jest.spyOn(yahooFinanceService, 'fetchStockData').mockResolvedValue(fakePriceData as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('SMOKE: page renders without crashing', () => {
    renderPage();
    expect(document.body).toBeTruthy();
  });

  it('STRUCTURE: ticker input row exists by default with correct placeholder', () => {
    renderPage();
    expect(screen.getByPlaceholderText(/AAPL/i)).toBeInTheDocument();
  });

  it('STRUCTURE: units input exists with correct placeholder', () => {
    renderPage();
    expect(screen.getByPlaceholderText('10.5')).toBeInTheDocument();
  });

  it('STRUCTURE: Add holding button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /add holding/i })).toBeInTheDocument();
  });

  it('STRUCTURE: Load chart button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /load chart/i })).toBeInTheDocument();
  });

  it('INTERACTION: Add holding increases the number of unit inputs', async () => {
    renderPage();
    const before = screen.getAllByPlaceholderText('10.5').length;
    await userEvent.click(screen.getByRole('button', { name: /add holding/i }));
    expect(screen.getAllByPlaceholderText('10.5').length).toBe(before + 1);
  });

  it('INTERACTION: Load chart renders net worth chart', async () => {
    renderPage();
    await userEvent.type(screen.getByPlaceholderText(/AAPL/i), 'MSFT');
    await userEvent.type(screen.getByPlaceholderText('10.5'), '100');
    await userEvent.click(screen.getByRole('button', { name: /load chart/i }));
    expect(await screen.findByTestId('networth-stacked-chart')).toBeInTheDocument();
  });

  it('REGRESSION: removing a row reduces unit input count', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: /add holding/i }));
    const before = screen.getAllByPlaceholderText('10.5').length;
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    await userEvent.click(removeButtons[0]);
    expect(screen.getAllByPlaceholderText('10.5').length).toBe(before - 1);
  });

  it('REGRESSION: Remove button is disabled when only one row remains', () => {
    renderPage();
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    expect(removeButtons[0]).toBeDisabled();
  });
});
