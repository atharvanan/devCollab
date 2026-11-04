import { render, screen, fireEvent, act } from '@testing-library/react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

describe('ThemeToggle Component (UIX-004, D-22)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('renders theme toggle button with appropriate initial accessibility attributes', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('aria-label');
  });

  it('toggles theme between light and dark on click', () => {
    render(<ThemeToggle showLabel={true} />);
    const button = screen.getByRole('button');

    // Initial state: default light mode -> button offers Switch to Dark Mode
    expect(button).toHaveAttribute('aria-label', 'Switch to Dark Mode');

    // Click to toggle to dark
    act(() => {
      fireEvent.click(button);
    });

    expect(button).toHaveAttribute('aria-label', 'Switch to Light Mode');
    expect(localStorage.getItem('devcollab_theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Click to toggle back to light
    act(() => {
      fireEvent.click(button);
    });

    expect(button).toHaveAttribute('aria-label', 'Switch to Dark Mode');
    expect(localStorage.getItem('devcollab_theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('displays label when showLabel prop is true', () => {
    render(<ThemeToggle showLabel={true} />);
    expect(screen.getByText(/Dark Theme|Light Theme/)).toBeInTheDocument();
  });
});
