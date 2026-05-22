import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BaseProvider, LightTheme } from 'baseui';
import { YahooStockPrice } from './YahooStockPrice';
import { yahooFinanceService } from '../services/yahooFinanceService';

jest.mock('../components/charts/StockPriceChart', () => ({
  StockPriceChart: () => <div data-testid="stock-price-chart" />,
}));

const fakePriceData = Array.from({ length: 24 }, (_, i) => ({
  date: new Date(Date.UTC(2023, i % 12, 1)),
  nav: 100 * Math.pow(1.12, i / 12),
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/yahoo-stock-price']}>
      <BaseProvider theme={LightTheme}>
        <YahooStockPrice />
      </BaseProvider>
    </MemoryRouter>
  );

describe('[REGRESSION] YahooStockPrice — /yahoo-stock-price', () => {
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

  it('STRUCTURE: Fetch button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /fetch/i })).toBeInTheDocument();
  });

  it('STRUCTURE: Download CSV button exists initially disabled', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /download csv/i })).toBeDisabled();
  });

  it('INTERACTION: Fetch renders price chart', async () => {
    renderPage();
    await userEvent.clear(screen.getByPlaceholderText('AAPL'));
    await userEvent.type(screen.getByPlaceholderText('AAPL'), 'MSFT');
    await userEvent.click(screen.getByRole('button', { name: /fetch/i }));
    expect(await screen.findByTestId('stock-price-chart')).toBeInTheDocument();
  });

  it('REGRESSION: Fetch does not render duplicate charts on repeated clicks', async () => {
    renderPage();
    const fetchBtn = screen.getByRole('button', { name: /fetch/i });
    await userEvent.click(fetchBtn);
    await screen.findByTestId('stock-price-chart');
    await userEvent.click(fetchBtn);
    expect(screen.getAllByTestId('stock-price-chart')).toHaveLength(1);
  });
});
