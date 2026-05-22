import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BaseProvider, LightTheme } from 'baseui';
import LumpsumSipCompare from './LumpsumSipCompare';
import { yahooFinanceService } from '../services/yahooFinanceService';

jest.mock('../components/charts/StockPriceChart', () => ({
  StockPriceChart: () => <div data-testid="stock-price-chart" />,
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/compare']}>
      <BaseProvider theme={LightTheme}>
        <LumpsumSipCompare />
      </BaseProvider>
    </MemoryRouter>
  );

describe('[REGRESSION] LumpsumSipCompare — /compare', () => {
  beforeEach(() => yahooFinanceService.clearCache());

  it('SMOKE: page renders without crashing', () => {
    renderPage();
    expect(document.body).toBeTruthy();
  });

  it('STRUCTURE: ticker input exists with correct placeholder', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Ticker (e.g. AAPL, ~12)')).toBeInTheDocument();
  });

  it('STRUCTURE: total amount input exists', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Total Amount')).toBeInTheDocument();
  });

  it('STRUCTURE: Compare button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /compare/i })).toBeInTheDocument();
  });

  it('INTERACTION: Compare with synthetic ticker and amount renders price chart', async () => {
    renderPage();
    await userEvent.type(screen.getByPlaceholderText('Ticker (e.g. AAPL, ~12)'), '~12');
    await userEvent.type(screen.getByPlaceholderText('Total Amount'), '10000');
    await userEvent.click(screen.getByRole('button', { name: /compare/i }));
    expect(await screen.findByTestId('stock-price-chart')).toBeInTheDocument();
  });

  it('OUTPUT: comparison result mentions both Lumpsum and SIP', async () => {
    renderPage();
    await userEvent.type(screen.getByPlaceholderText('Ticker (e.g. AAPL, ~12)'), '~12');
    await userEvent.type(screen.getByPlaceholderText('Total Amount'), '10000');
    await userEvent.click(screen.getByRole('button', { name: /compare/i }));
    await screen.findByTestId('stock-price-chart');
    // Multiple elements match /lumpsum/i and /sip/i — use getAllByText
    expect(screen.getAllByText(/lumpsum/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/sip/i).length).toBeGreaterThanOrEqual(1);
  });

  it('REGRESSION: Compare button is disabled when no valid entries', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /compare/i })).toBeDisabled();
  });

  it('REGRESSION: Compare button enables after ticker and amount are entered', async () => {
    renderPage();
    await userEvent.type(screen.getByPlaceholderText('Ticker (e.g. AAPL, ~12)'), '~12');
    await userEvent.type(screen.getByPlaceholderText('Total Amount'), '10000');
    expect(screen.getByRole('button', { name: /compare/i })).not.toBeDisabled();
  });
});
