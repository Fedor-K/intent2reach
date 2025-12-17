import type { RunStatus } from '../types';

interface StatusBadgeProps {
  status: RunStatus;
}

const statusConfig: Record<RunStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-yellow-100 text-yellow-800',
  },
  running: {
    label: 'Running',
    className: 'bg-blue-100 text-blue-800 animate-pulse',
  },
  succeeded: {
    label: 'Succeeded',
    className: 'bg-green-100 text-green-800',
  },
  failed: {
    label: 'Failed',
    className: 'bg-red-100 text-red-800',
  },
  aborted: {
    label: 'Aborted',
    className: 'bg-gray-100 text-gray-800',
  },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.pending;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}
