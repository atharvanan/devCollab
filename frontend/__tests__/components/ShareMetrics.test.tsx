import { render, screen } from '@testing-library/react';
import { ShareMetrics } from '@/components/collab/ShareMetrics';

describe('ShareMetrics Component', () => {
  const mockContributors = [
    {
      user: 'u1',
      name: 'Alice PM',
      role: 'project_manager',
      charactersAdded: 300,
      linesContributed: 25,
      percentage: 60,
    },
    {
      user: 'u2',
      name: 'Bob Dev',
      role: 'frontend_developer',
      charactersAdded: 200,
      linesContributed: 15,
      percentage: 40,
    },
  ];

  it('renders contribution metrics header and total counts', () => {
    render(
      <ShareMetrics
        contributors={mockContributors}
        activeUserIds={['u1']}
        totalLines={40}
        totalChars={500}
      />
    );

    expect(screen.getByText('Contribution Share')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
  });

  it('renders contributor names and calculated percentage shares', () => {
    render(
      <ShareMetrics
        contributors={mockContributors}
        activeUserIds={['u1']}
        totalLines={40}
        totalChars={500}
      />
    );

    // Both contributors should be visible
    expect(screen.getAllByText('Alice PM').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bob Dev').length).toBeGreaterThan(0);

    // Percentages displayed
    expect(screen.getAllByText('60%').length).toBeGreaterThan(0);
    expect(screen.getAllByText('40%').length).toBeGreaterThan(0);
  });

  it('handles edge cases with empty contributors and zero metrics gracefully without crash', () => {
    render(
      <ShareMetrics
        contributors={[]}
        activeUserIds={[]}
        totalLines={0}
        totalChars={0}
      />
    );

    expect(screen.getByText('Contribution Share')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBe(2);
  });
});

