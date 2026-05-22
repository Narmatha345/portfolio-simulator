import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BaseProvider, LightTheme } from 'baseui';
import NetworthCurrencyPage from './NetworthCurrencyPage';
import { yahooFinanceService } from '../services/yahooFinanceService';

jest.mock('highcharts/highstock', () => ({
  __esModule: true,
  default: { chart: jest.fn(), stockChart: jest.fn() },
}));
jest.mock('../components/charts/StockPriceChart', () => ({
  StockPriceChart: () => <div data-testid="stock-price-chart" />,
}));
jest.mock('highcharts-react-official', () => () => <div data-testid="highcharts-chart" />);

const now = new Date();
const fakePriceData = Array.from({ length: 15 }, (_, i) => {
  const d = new Date(now.getFullYear(), now.getMonth() - (14 - i), 1);
  return { date: d, nav: 100 * Math.pow(1.12, i / 12) };
});

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/networth-currency']}>
      <BaseProvider theme={LightTheme}>
        <NetworthCurrencyPage />
      </BaseProvider>
    </MemoryRouter>
  );

describe('[REGRESSION] NetworthCurrencyPage — /networth-currency', () => {
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
    expect(screen.getByPlaceholderText('MSFT')).toBeInTheDocument();
  });

  it('STRUCTURE: units input exists', () => {
    renderPage();
    expect(screen.getByPlaceholderText('3')).toBeInTheDocument();
  });

  it('STRUCTURE: base currency input exists', () => {
    renderPage();
    expect(screen.getByPlaceholderText('USD')).toBeInTheDocument();
  });

  it('STRUCTURE: target currency input exists', () => {
    renderPage();
    expect(screen.getByPlaceholderText('INR')).toBeInTheDocument();
  });

  it('STRUCTURE: Load button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /^load$/i })).toBeInTheDocument();
  });

  it('INTERACTION: Load renders chart', async () => {
    renderPage();
    await userEvent.type(screen.getByPlaceholderText('MSFT'), 'AAPL');
    await userEvent.type(screen.getByPlaceholderText('3'), '10');
    await userEvent.click(screen.getByRole('button', { name: /^load$/i }));
    expect((await screen.findAllByTestId('stock-price-chart')).length).toBeGreaterThanOrEqual(1);
  });

  it('REGRESSION: Load button is not disabled on initial render', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /^load$/i })).not.toBeDisabled();
  });
});
