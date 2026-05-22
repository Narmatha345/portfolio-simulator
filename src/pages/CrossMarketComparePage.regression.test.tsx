import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BaseProvider, LightTheme } from 'baseui';
import CrossMarketComparePage from './CrossMarketComparePage';
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
    <MemoryRouter initialEntries={['/cross-market-compare']}>
      <BaseProvider theme={LightTheme}>
        <CrossMarketComparePage />
      </BaseProvider>
    </MemoryRouter>
  );

describe('[REGRESSION] CrossMarketComparePage — /cross-market-compare', () => {
  beforeEach(() => {
    yahooFinanceService.clearCache();
    jest.spyOn(yahooFinanceService, 'fetchStockData').mockResolvedValue(fakePriceData as any);
  });

  afterEach(() => jest.restoreAllMocks());

  it('SMOKE: page renders without crashing', () => {
    renderPage();
    expect(document.body).toBeTruthy();
  });

  it('STRUCTURE: first market ticker input exists', () => {
    renderPage();
    expect(screen.getByPlaceholderText('GLD')).toBeInTheDocument();
  });

  it('STRUCTURE: first market currency input exists', () => {
    renderPage();
    expect(screen.getByPlaceholderText('USD')).toBeInTheDocument();
  });

  it('STRUCTURE: second market ticker input exists', () => {
    renderPage();
    expect(screen.getByPlaceholderText('GOLDBEES.NS')).toBeInTheDocument();
  });

  it('STRUCTURE: second market currency input exists', () => {
    renderPage();
    expect(screen.getByPlaceholderText('INR')).toBeInTheDocument();
  });

  it('STRUCTURE: initial amount input exists', () => {
    renderPage();
    expect(screen.getByPlaceholderText('100')).toBeInTheDocument();
  });

  it('STRUCTURE: Compare button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /compare/i })).toBeInTheDocument();
  });

  it('INTERACTION: Compare renders price chart', async () => {
    renderPage();
    await userEvent.clear(screen.getByPlaceholderText('GLD'));
    await userEvent.type(screen.getByPlaceholderText('GLD'), 'AAPL');
    await userEvent.clear(screen.getByPlaceholderText('GOLDBEES.NS'));
    await userEvent.type(screen.getByPlaceholderText('GOLDBEES.NS'), 'MSFT');
    await userEvent.click(screen.getByRole('button', { name: /compare/i }));
    expect((await screen.findAllByTestId('stock-price-chart')).length).toBeGreaterThanOrEqual(1);
  });

  it('OUTPUT: currency symbols appear in results after Compare', async () => {
    renderPage();
    await userEvent.clear(screen.getByPlaceholderText('GLD'));
    await userEvent.type(screen.getByPlaceholderText('GLD'), 'AAPL');
    await userEvent.clear(screen.getByPlaceholderText('GOLDBEES.NS'));
    await userEvent.type(screen.getByPlaceholderText('GOLDBEES.NS'), 'MSFT');
    await userEvent.click(screen.getByRole('button', { name: /compare/i }));
    await screen.findAllByTestId('stock-price-chart');
    expect(screen.getAllByText(/\$|€|£|₹/).length).toBeGreaterThanOrEqual(1);
  });
});
