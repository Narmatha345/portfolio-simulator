import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BaseProvider, LightTheme } from 'baseui';
import { StockSwpTab } from './StockSwpTab';
import { yahooFinanceService } from '../services/yahooFinanceService';

jest.mock('../components/charts/StockPortfolioValueChart', () => ({
  StockPortfolioValueChart: () => <div data-testid="portfolio-value-chart" />,
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/stock-swp']}>
      <BaseProvider theme={LightTheme}>
        <StockSwpTab />
      </BaseProvider>
    </MemoryRouter>
  );

describe('[REGRESSION] StockSwpTab — /stock-swp', () => {
  beforeEach(() => yahooFinanceService.clearCache());

  it('SMOKE: page renders without crashing', () => {
    renderPage();
    expect(document.body).toBeTruthy();
  });

  it('STRUCTURE: ticker input exists with correct placeholder', () => {
    renderPage();
    expect(screen.getByPlaceholderText('Ticker (e.g. VOO, ~12)')).toBeInTheDocument();
  });

  it('STRUCTURE: corpus amount input exists', () => {
    renderPage();
    expect(screen.getByPlaceholderText('e.g. 100000')).toBeInTheDocument();
  });

  it('STRUCTURE: withdrawal amount input exists', () => {
    renderPage();
    expect(screen.getByPlaceholderText('e.g. 1000')).toBeInTheDocument();
  });

  it('STRUCTURE: Simulate button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /simulate/i })).toBeInTheDocument();
  });

  it('STRUCTURE: Add ticker button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /add ticker/i })).toBeInTheDocument();
  });

  it('INTERACTION: Simulate with synthetic ticker renders corpus chart', async () => {
    renderPage();
    await userEvent.type(screen.getByPlaceholderText('Ticker (e.g. VOO, ~12)'), '~12');
    await userEvent.type(screen.getByPlaceholderText('e.g. 100000'), '100000');
    await userEvent.click(screen.getByRole('button', { name: /simulate/i }));
    // SWP renders one chart per withdrawal strategy (Strategy A and B)
    const charts = await screen.findAllByTestId('portfolio-value-chart');
    expect(charts.length).toBeGreaterThanOrEqual(1);
  });

  it('REGRESSION: Simulate button is disabled when no ticker entered', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /simulate/i })).toBeDisabled();
  });

  it('REGRESSION: Simulate button enables after ticker and corpus are entered', async () => {
    renderPage();
    await userEvent.type(screen.getByPlaceholderText('Ticker (e.g. VOO, ~12)'), '~12');
    await userEvent.type(screen.getByPlaceholderText('e.g. 100000'), '100000');
    expect(screen.getByRole('button', { name: /simulate/i })).not.toBeDisabled();
  });
});
