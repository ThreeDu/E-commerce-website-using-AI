import { render, screen } from '@testing-library/react';
import App from './App';

test('renders home page title', () => {
  render(<App />);
  const titleElement = screen.getByText(/trang chủ website bán hàng/i);
  expect(titleElement).toBeInTheDocument();
});
