import React from 'react';
import { AlertOctagon, AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

export default function RiskBadge({ tier = 'Routine', score, compact = false }) {
  const t = tier ? tier.toLowerCase() : 'routine';

  let config = {
    label: 'Routine',
    icon: CheckCircle,
    bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    dot: 'bg-emerald-500'
  };

  if (t === 'critical') {
    config = {
      label: 'Critical',
      icon: AlertOctagon,
      bg: 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-200 animate-pulse',
      dot: 'bg-rose-600'
    };
  } else if (t === 'high') {
    config = {
      label: 'High Risk',
      icon: AlertTriangle,
      bg: 'bg-amber-50 text-amber-800 border-amber-300',
      dot: 'bg-amber-500'
    };
  } else if (t === 'moderate') {
    config = {
      label: 'Moderate',
      icon: AlertCircle,
      bg: 'bg-yellow-50 text-yellow-800 border-yellow-300',
      dot: 'bg-yellow-500'
    };
  }

  const Icon = config.icon;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${config.bg}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        <span>{config.label}</span>
        {score !== undefined && <span className="opacity-75">({score})</span>}
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-bold border ${config.bg}`}>
      <Icon className="w-4 h-4" />
      <span>{config.label} Deterioration Risk</span>
      {score !== undefined && (
        <span className="ml-1 px-1.5 py-0.5 rounded bg-white/70 text-[11px] font-mono">
          Score {score}
        </span>
      )}
    </div>
  );
}
