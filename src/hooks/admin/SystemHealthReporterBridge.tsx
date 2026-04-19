import { useSystemHealthReporter } from '@/hooks/admin/useSystemHealthReporter';

interface SystemHealthReporterBridgeProps {
  enabled?: boolean;
}

export const SystemHealthReporterBridge = ({ enabled = true }: SystemHealthReporterBridgeProps) => {
  useSystemHealthReporter(enabled);
  return null;
};
