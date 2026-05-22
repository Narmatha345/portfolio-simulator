import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { BaseProvider, LightTheme } from 'baseui';
import { NetworthEstimatorCopyPage } from './NetworthEstimatorCopyPage';
import { yahooFinanceService } from '../services/yahooFinanceService';

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('../components/charts/NetWorthStackedAreaChart', () => ({
  NetWorthStackedAreaChart: () => <div data-testid="networth-stacked-chart" />,
}));
jest.mock('../components/charts/StockPriceChart', () => ({
  StockPriceChart: () => <div data-testid="stock-price-chart" />,
}));
jest.mock('../services/geminiService', () => ({
  sendNetworthDataToGemini: jest.fn().mockResolvedValue('Gemini mock response'),
}));
jest.mock('../services/chatgptService', () => ({
  sendNetworthDataToChatGPT: jest.fn().mockResolvedValue('ChatGPT mock response'),
}));
jest.mock('../services/claudeService', () => ({
  sendNetworthDataToClaude: jest.fn().mockResolvedValue('Claude mock response'),
}));

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/networth-estimator-copy']}>
      <BaseProvider theme={LightTheme}>
        <NetworthEstimatorCopyPage />
      </BaseProvider>
    </MemoryRouter>
  );

describe('[REGRESSION] NetworthEstimatorCopyPage — /networth-estimator-copy', () => {
  beforeEach(() => yahooFinanceService.clearCache());

  it('SMOKE: page renders without crashing', () => {
    renderPage();
    expect(document.body).toBeTruthy();
  });

  it('STRUCTURE: ticker input exists with correct placeholder', () => {
    renderPage();
    expect(screen.getByPlaceholderText(/AAPL/i)).toBeInTheDocument();
  });

  it('STRUCTURE: units input exists with correct placeholder', () => {
    renderPage();
    expect(screen.getByPlaceholderText('10.5')).toBeInTheDocument();
  });

  it('STRUCTURE: AI provider selector exists with 3 options', () => {
    renderPage();
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Gemini' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'ChatGPT' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Claude' })).toBeInTheDocument();
  });

  it('STRUCTURE: AI prompt input defaults to Gemini placeholder', () => {
    renderPage();
    expect(screen.getByPlaceholderText(/ask gemini/i)).toBeInTheDocument();
  });

  it('STRUCTURE: Send button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('STRUCTURE: Add holding button exists', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /add holding/i })).toBeInTheDocument();
  });

  it('INTERACTION: Add holding increases the number of unit inputs', async () => {
    renderPage();
    const before = screen.getAllByPlaceholderText('10.5').length;
    await userEvent.click(screen.getByRole('button', { name: /add holding/i }));
    expect(screen.getAllByPlaceholderText('10.5').length).toBe(before + 1);
  });

  it('INTERACTION: switching provider to ChatGPT updates placeholder', async () => {
    renderPage();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'chatgpt');
    expect(screen.getByPlaceholderText(/ask chatgpt/i)).toBeInTheDocument();
  });

  it('INTERACTION: switching provider to Claude updates placeholder', async () => {
    renderPage();
    await userEvent.selectOptions(screen.getByRole('combobox'), 'claude');
    expect(screen.getByPlaceholderText(/ask claude/i)).toBeInTheDocument();
  });

  it('REGRESSION: Send button is disabled when AI prompt is empty', () => {
    renderPage();
    expect(screen.getByRole('button', { name: /send/i })).toBeDisabled();
  });

  it('REGRESSION: Send button enables after prompt is typed', async () => {
    renderPage();
    await userEvent.type(
      screen.getByPlaceholderText(/ask gemini/i),
      'How is my portfolio performing?'
    );
    expect(screen.getByRole('button', { name: /send/i })).not.toBeDisabled();
  });
});
