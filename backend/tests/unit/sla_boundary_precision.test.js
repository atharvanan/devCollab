const { SLA_POLICIES, computeSlaDeadlines, evaluateTaskSla, formatDuration } = require('../../src/utils/sla');

describe('SLA Boundary Precision & Millisecond Arithmetic (SLA-001 to SLA-016)', () => {
  beforeEach(() => {
    jest.useRealTimers();
  });

  describe('Millisecond Boundaries: Response SLA (SLA-003, SLA-005)', () => {
    const priorities = ['critical', 'high', 'medium', 'low'];

    priorities.forEach((priority) => {
      const policy = SLA_POLICIES[priority];
      const baseTime = new Date('2026-11-04T10:00:00.000Z').getTime();
      const responseDeadline = new Date(baseTime + policy.responseHours * 3600000);

      it(`${policy.label}: Response SLA exactly 1ms before deadline is NOT breached`, () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(responseDeadline.getTime() - 1));

        const task = {
          priority,
          column: 'todo',
          createdAt: new Date(baseTime),
          sla: { responseDeadline },
        };
        const result = evaluateTaskSla(task);
        expect(result.responseBreached).toBe(false);
        expect(result.state).not.toBe('breached');
      });

      it(`${policy.label}: Response SLA exactly AT deadline (equality) is NOT breached`, () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(responseDeadline.getTime()));

        const task = {
          priority,
          column: 'todo',
          createdAt: new Date(baseTime),
          sla: { responseDeadline },
        };
        const result = evaluateTaskSla(task);
        expect(result.responseBreached).toBe(false);
      });

      it(`${policy.label}: Response SLA exactly 1ms AFTER deadline IS breached`, () => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(responseDeadline.getTime() + 1));

        const task = {
          priority,
          column: 'todo',
          createdAt: new Date(baseTime),
          sla: { responseDeadline },
        };
        const result = evaluateTaskSla(task);
        expect(result.responseBreached).toBe(true);
        expect(result.state).toBe('breached');
        expect(result.badgeColor).toBe('rose');
      });
    });
  });

  describe('Millisecond Boundaries: Resolution SLA (SLA-004, SLA-007)', () => {
    const priorities = ['critical', 'high', 'medium', 'low'];

    priorities.forEach((priority) => {
      const policy = SLA_POLICIES[priority];
      const baseTime = new Date('2026-11-04T10:00:00.000Z').getTime();
      const resolutionDeadline = new Date(baseTime + policy.resolutionHours * 3600000);

      it(`${policy.label}: Completed 1ms before resolution deadline is FULFILLED`, () => {
        const completedAt = new Date(resolutionDeadline.getTime() - 1);
        const task = {
          priority,
          column: 'done',
          createdAt: new Date(baseTime),
          completedAt,
          sla: { resolutionDeadline },
        };
        const result = evaluateTaskSla(task);
        expect(result.resolutionBreached).toBe(false);
        expect(result.state).toBe('fulfilled');
        expect(result.badgeColor).toBe('emerald');
      });

      it(`${policy.label}: Completed exactly AT resolution deadline is FULFILLED`, () => {
        const completedAt = new Date(resolutionDeadline.getTime());
        const task = {
          priority,
          column: 'done',
          createdAt: new Date(baseTime),
          completedAt,
          sla: { resolutionDeadline },
        };
        const result = evaluateTaskSla(task);
        expect(result.resolutionBreached).toBe(false);
        expect(result.state).toBe('fulfilled');
      });

      it(`${policy.label}: Completed 1ms AFTER resolution deadline is BREACHED`, () => {
        const completedAt = new Date(resolutionDeadline.getTime() + 1);
        const task = {
          priority,
          column: 'done',
          createdAt: new Date(baseTime),
          completedAt,
          sla: { resolutionDeadline },
        };
        const result = evaluateTaskSla(task);
        expect(result.resolutionBreached).toBe(true);
        expect(result.state).toBe('breached');
        expect(result.badgeColor).toBe('rose');
      });
    });
  });

  describe('At-Risk Threshold Boundaries: max(2h, 25%) (SLA-012)', () => {
    it('Critical Priority (8h total): threshold is max(2h, 2h) = 2 hours', () => {
      jest.useFakeTimers();
      const baseTime = new Date('2026-11-04T10:00:00.000Z').getTime();
      const totalResolutionMs = 8 * 3600000;
      const resolutionDeadline = new Date(baseTime + totalResolutionMs);
      const thresholdMs = 2 * 3600000; // 2 hours

      // Case A: 1ms above 2h threshold -> healthy
      jest.setSystemTime(new Date(resolutionDeadline.getTime() - thresholdMs - 1));
      let task = {
        priority: 'critical',
        column: 'in_progress',
        startedAt: new Date(baseTime),
        createdAt: new Date(baseTime),
        sla: { resolutionDeadline },
      };
      let res = evaluateTaskSla(task);
      expect(res.state).toBe('healthy');

      // Case B: Exactly at 2h threshold or 1ms below -> at_risk
      jest.setSystemTime(new Date(resolutionDeadline.getTime() - thresholdMs + 1));
      task = {
        priority: 'critical',
        column: 'in_progress',
        startedAt: new Date(baseTime),
        createdAt: new Date(baseTime),
        sla: { resolutionDeadline },
      };
      res = evaluateTaskSla(task);
      expect(res.state).toBe('at_risk');
      expect(res.badgeColor).toBe('amber');
    });

    it('Low Priority (168h total): threshold is max(2h, 25% of 168h = 42h) = 42 hours', () => {
      jest.useFakeTimers();
      const baseTime = new Date('2026-11-04T10:00:00.000Z').getTime();
      const totalResolutionMs = 168 * 3600000;
      const resolutionDeadline = new Date(baseTime + totalResolutionMs);
      const thresholdMs = 42 * 3600000; // 42 hours

      // 1ms above 42h threshold -> healthy
      jest.setSystemTime(new Date(resolutionDeadline.getTime() - thresholdMs - 1));
      let task = {
        priority: 'low',
        column: 'in_progress',
        startedAt: new Date(baseTime),
        createdAt: new Date(baseTime),
        sla: { resolutionDeadline },
      };
      let res = evaluateTaskSla(task);
      expect(res.state).toBe('healthy');

      // 1ms below 42h threshold -> at_risk
      jest.setSystemTime(new Date(resolutionDeadline.getTime() - thresholdMs + 1));
      res = evaluateTaskSla(task);
      expect(res.state).toBe('at_risk');
      expect(res.badgeColor).toBe('amber');
    });
  });

  describe('Calendar & Timezone Boundary Durations (SLA-010)', () => {
    it('Calculates exact deadline across midnight transition', () => {
      const createdAt = new Date('2026-11-04T23:30:00.000Z');
      const { responseDeadline, resolutionDeadline } = computeSlaDeadlines('critical', createdAt);

      // 2 hours past 23:30 is next day 01:30 UTC
      expect(responseDeadline.toISOString()).toBe('2026-11-05T01:30:00.000Z');
      // 8 hours past 23:30 is next day 07:30 UTC
      expect(resolutionDeadline.toISOString()).toBe('2026-11-05T07:30:00.000Z');
    });

    it('Calculates exact deadline across Year-End rollover', () => {
      const createdAt = new Date('2026-12-31T23:00:00.000Z');
      const { responseDeadline } = computeSlaDeadlines('critical', createdAt);

      expect(responseDeadline.toISOString()).toBe('2027-01-01T01:00:00.000Z');
    });

    it('Calculates exact deadline across Leap Year February 29 (2028)', () => {
      const createdAt = new Date('2028-02-28T20:00:00.000Z');
      const { resolutionDeadline } = computeSlaDeadlines('critical', createdAt);

      // 8 hours later crosses into Feb 29 leap day
      expect(resolutionDeadline.toISOString()).toBe('2028-02-29T04:00:00.000Z');
    });
  });

  describe('formatDuration Precision & Boundary Formatting (SLA-011)', () => {
    it('Formats 0ms and sub-minute values correctly', () => {
      expect(formatDuration(0)).toBe('0m');
      expect(formatDuration(59999)).toBe('0m'); // 59.9 seconds -> 0m
      expect(formatDuration(60000)).toBe('1m'); // 60.0 seconds -> 1m
    });

    it('Formats sub-hour values correctly', () => {
      expect(formatDuration(3599999)).toBe('59m');
      expect(formatDuration(3600000)).toBe('1h 0m');
      expect(formatDuration(3660000)).toBe('1h 1m');
    });

    it('Formats multi-day durations exceeding 24 hours correctly', () => {
      expect(formatDuration(24 * 3600000)).toBe('1d 0h');
      expect(formatDuration(25 * 3600000 + 30 * 60000)).toBe('1d 1h');
      expect(formatDuration(168 * 3600000)).toBe('7d 0h'); // P4 168 hours
    });

    it('Handles negative durations cleanly using absolute value representation', () => {
      expect(formatDuration(-120000)).toBe('2m');
      expect(formatDuration(-7200000)).toBe('2h 0m');
    });
  });
});
