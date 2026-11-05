import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

// Mock Lucide icons
jest.mock('lucide-react', () => ({
  Crown: () => <span data-testid="crown-icon">👑</span>,
  Star: () => <span data-testid="star-icon">⭐</span>,
  ShieldCheck: () => <span>🛡️</span>,
  AlertTriangle: () => <span>⚠️</span>,
  UserCheck: () => <span>👤</span>,
  Trash2: () => <span>🗑️</span>,
  UserPlus: () => <span>➕</span>,
  Bot: () => <span>🤖</span>,
  X: () => <span>✕</span>,
  Check: () => <span>✓</span>,
  Lock: () => <span>🔒</span>,
  ChevronDown: () => <span>▼</span>,
}));

// Mock Next.js router
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  useParams: () => ({ id: 'proj-123' }),
}));

describe('Frontend Governance & Role Hierarchy UI Test Suite', () => {
  const mockOwnerUser = {
    _id: 'user-owner-1',
    name: 'Alice Owner',
    email: 'alice.owner@devcollab.com',
    role: 'user',
    canCreateProjects: true,
  };

  const mockPmUser = {
    _id: 'user-pm-2',
    name: 'Bob Manager',
    email: 'bob.pm@devcollab.com',
    role: 'user',
    canCreateProjects: false,
  };

  const mockDevUser = {
    _id: 'user-dev-3',
    name: 'Charlie Dev',
    email: 'charlie.dev@devcollab.com',
    role: 'user',
    canCreateProjects: false,
  };

  const mockProject = {
    _id: 'proj-123',
    name: 'FinTech Governance Core',
    owner: { _id: 'user-owner-1', name: 'Alice Owner', email: 'alice.owner@devcollab.com' },
    status: 'active',
    members: [
      { user: mockOwnerUser, role: 'project_manager' },
      { user: mockPmUser, role: 'project_manager' },
      { user: mockDevUser, role: 'frontend_developer' },
    ],
  };

  // Mini Governance Member List Component simulating Tab 3 in projects/[id]/page.tsx
  function GovernanceMembersList({
    project,
    currentUser,
    onAppointPM = jest.fn(),
    onRevokePM = jest.fn(),
    onRoleChange = jest.fn(),
    onTransferOwnership = jest.fn(),
  }: {
    project: any;
    currentUser: any;
    onAppointPM?: (userId: string) => void;
    onRevokePM?: (userId: string) => void;
    onRoleChange?: (userId: string, role: string) => void;
    onTransferOwnership?: (userId: string) => void;
  }) {
    const isOwner = project.owner?._id === currentUser._id || currentUser.role === 'admin';
    const isPM = isOwner || project.members.some(
      (m: any) => m.user._id === currentUser._id && (m.role === 'project_manager' || m.role === 'admin')
    );

    return (
      <div data-testid="governance-panel">
        <h2>Project Team & Governance</h2>
        {isOwner && (
          <button
            onClick={() => onTransferOwnership('user-pm-2')}
            data-testid="transfer-ownership-btn"
          >
            Transfer Ownership
          </button>
        )}

        <div data-testid="members-list">
          {project.members.map((m: any) => {
            const memberUser = m.user;
            const isMemberOwner = project.owner?._id === memberUser._id;
            const isMemberPM = m.role === 'project_manager';

            return (
              <div key={memberUser._id} data-testid={`member-card-${memberUser._id}`}>
                <span data-testid="member-name">{memberUser.name}</span>
                {isMemberOwner && <span data-testid="badge-project-owner">Project Owner</span>}
                {!isMemberOwner && isMemberPM && <span data-testid="badge-project-manager">Project Manager</span>}
                {!isMemberOwner && !isMemberPM && <span data-testid="badge-role">{m.role}</span>}

                {/* Owner controls */}
                {isOwner && !isMemberOwner && (
                  <>
                    {isMemberPM ? (
                      <button
                        onClick={() => onRevokePM(memberUser._id)}
                        data-testid={`revoke-pm-btn-${memberUser._id}`}
                      >
                        Revoke PM
                      </button>
                    ) : (
                      <button
                        onClick={() => onAppointPM(memberUser._id)}
                        data-testid={`appoint-pm-btn-${memberUser._id}`}
                      >
                        Appoint PM
                      </button>
                    )}
                  </>
                )}

                {/* Role select */}
                {isPM && !isMemberOwner && (
                  <select
                    data-testid={`role-select-${memberUser._id}`}
                    value={m.role}
                    onChange={(e) => onRoleChange(memberUser._id, e.target.value)}
                  >
                    <option value="frontend_developer">Frontend Developer</option>
                    <option value="backend_developer">Backend Developer</option>
                    <option value="qa_tester">QA Tester</option>
                    <option value="project_manager" disabled={!isOwner}>
                      Project Manager {isOwner ? '' : '(Owner Only)'}
                    </option>
                  </select>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Mini Lifecycle Controls Component simulating page.tsx lifecycle controls
  function ProjectLifecycleControls({
    currentStatus,
    currentUser,
    isOwner,
    isPM,
    onStatusChange = jest.fn(),
  }: {
    currentStatus: string;
    currentUser: any;
    isOwner: boolean;
    isPM: boolean;
    onStatusChange?: (status: string) => void;
  }) {
    return (
      <div data-testid="lifecycle-controls">
        <span data-testid="current-status">{currentStatus}</span>
        {isPM && (
          <>
            <button onClick={() => onStatusChange('on_hold')} data-testid="btn-hold">
              Hold Project
            </button>
            <button onClick={() => onStatusChange('active')} data-testid="btn-resume">
              Resume Project
            </button>
            <button onClick={() => onStatusChange('completed')} data-testid="btn-complete">
              Complete Project
            </button>
          </>
        )}
        {/* Archiving requires Project Owner or Admin */}
        {isOwner && (
          <button onClick={() => onStatusChange('archived')} data-testid="btn-archive">
            Archive Project
          </button>
        )}
      </div>
    );
  }

  // 1. Project Owner & PM Badges Verification
  it('1. Renders Project Owner and Project Manager badges accurately', () => {
    render(
      <GovernanceMembersList
        project={mockProject}
        currentUser={mockOwnerUser}
      />
    );

    expect(screen.getByTestId('badge-project-owner')).toBeInTheDocument();
    expect(screen.getByTestId('badge-project-manager')).toBeInTheDocument();
    expect(screen.getByText('Alice Owner')).toBeInTheDocument();
    expect(screen.getByText('Bob Manager')).toBeInTheDocument();
    expect(screen.getByText('Charlie Dev')).toBeInTheDocument();
  });

  // 2. Owner Authority: Appoint & Revoke PM
  it('2. Project Owner sees Appoint PM and Revoke PM action buttons', () => {
    const handleRevokePM = jest.fn();
    const handleAppointPM = jest.fn();

    render(
      <GovernanceMembersList
        project={mockProject}
        currentUser={mockOwnerUser}
        onRevokePM={handleRevokePM}
        onAppointPM={handleAppointPM}
      />
    );

    // Bob is PM, so Owner sees Revoke PM button for Bob
    const revokeBtn = screen.getByTestId('revoke-pm-btn-user-pm-2');
    expect(revokeBtn).toBeInTheDocument();
    fireEvent.click(revokeBtn);
    expect(handleRevokePM).toHaveBeenCalledWith('user-pm-2');

    // Charlie is not PM, so Owner sees Appoint PM button for Charlie
    const appointBtn = screen.getByTestId('appoint-pm-btn-user-dev-3');
    expect(appointBtn).toBeInTheDocument();
    fireEvent.click(appointBtn);
    expect(handleAppointPM).toHaveBeenCalledWith('user-dev-3');
  });

  // 3. PM Restrictions: Non-owner PM cannot appoint or revoke PMs
  it('3. Non-owner Project Manager cannot see or trigger Appoint/Revoke PM buttons', () => {
    render(
      <GovernanceMembersList
        project={mockProject}
        currentUser={mockPmUser} // Logged in as PM Bob, not Owner Alice
      />
    );

    expect(screen.queryByTestId('revoke-pm-btn-user-pm-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('appoint-pm-btn-user-dev-3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('transfer-ownership-btn')).not.toBeInTheDocument();
  });

  // 4. Role Hierarchy: PM cannot elevate another member to Project Manager in role selector
  it('4. Role dropdown disables project_manager option for non-owner PM', () => {
    render(
      <GovernanceMembersList
        project={mockProject}
        currentUser={mockPmUser}
      />
    );

    const roleSelect = screen.getByTestId('role-select-user-dev-3');
    const pmOption = roleSelect.querySelector('option[value="project_manager"]') as HTMLOptionElement;
    expect(pmOption).toBeDisabled();
    expect(pmOption.textContent).toContain('(Owner Only)');
  });

  // 5. Ownership Transfer UI: Only visible to Project Owner
  it('5. Transfer Ownership button is strictly visible to Project Owner and fires modal handler', () => {
    const handleTransfer = jest.fn();
    const { rerender } = render(
      <GovernanceMembersList
        project={mockProject}
        currentUser={mockOwnerUser}
        onTransferOwnership={handleTransfer}
      />
    );

    const transferBtn = screen.getByTestId('transfer-ownership-btn');
    expect(transferBtn).toBeInTheDocument();
    fireEvent.click(transferBtn);
    expect(handleTransfer).toHaveBeenCalledWith('user-pm-2');

    // Re-render as normal dev user
    rerender(
      <GovernanceMembersList
        project={mockProject}
        currentUser={mockDevUser}
      />
    );
    expect(screen.queryByTestId('transfer-ownership-btn')).not.toBeInTheDocument();
  });

  // 6. Project Lifecycle Controls Separation
  it('6. Lifecycle controls: PM can Hold, Resume, and Complete, but cannot Archive', () => {
    const handleStatusChange = jest.fn();

    // Render as PM (not Owner)
    const { rerender } = render(
      <ProjectLifecycleControls
        currentStatus="active"
        currentUser={mockPmUser}
        isOwner={false}
        isPM={true}
        onStatusChange={handleStatusChange}
      />
    );

    expect(screen.getByTestId('btn-hold')).toBeInTheDocument();
    expect(screen.getByTestId('btn-resume')).toBeInTheDocument();
    expect(screen.getByTestId('btn-complete')).toBeInTheDocument();
    // Archive button must NOT be rendered for PM
    expect(screen.queryByTestId('btn-archive')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('btn-hold'));
    expect(handleStatusChange).toHaveBeenCalledWith('on_hold');

    // Re-render as Project Owner
    rerender(
      <ProjectLifecycleControls
        currentStatus="active"
        currentUser={mockOwnerUser}
        isOwner={true}
        isPM={true}
        onStatusChange={handleStatusChange}
      />
    );

    // Archive button IS rendered for Project Owner
    const archiveBtn = screen.getByTestId('btn-archive');
    expect(archiveBtn).toBeInTheDocument();
    fireEvent.click(archiveBtn);
    expect(handleStatusChange).toHaveBeenCalledWith('archived');
  });

  // 7. Regular Contributor Restrictions: No management controls
  it('7. Regular Contributor has read-only view of team members without management controls', () => {
    render(
      <GovernanceMembersList
        project={mockProject}
        currentUser={mockDevUser} // Charlie
      />
    );

    expect(screen.queryByTestId('transfer-ownership-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('appoint-pm-btn-user-dev-3')).not.toBeInTheDocument();
    expect(screen.queryByTestId('role-select-user-dev-3')).not.toBeInTheDocument();
  });
});

