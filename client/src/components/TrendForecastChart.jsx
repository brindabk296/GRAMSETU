import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { TrendingUp, AlertTriangle, Activity, Calendar } from 'lucide-react';

export default function TrendForecastChart({
  historicalData = [],
  forecast = null,
  metricName = 'Systolic BP',
  threshold = 160,
  unit = 'mmHg'
}) {
  // Format data for Recharts
  const chartData = historicalData
    .filter(item =>
      Number.isFinite(Number(item.value)) &&
      Number.isFinite(new Date(item.recordedAt).getTime())
    )
    .map((item, idx) => ({
    index: idx + 1,
    date: new Date(item.recordedAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
    fullDate: new Date(item.recordedAt).toLocaleDateString(),
    value: Number(item.value),
    source: item.source === 'health_worker'
      ? 'Health worker'
      : item.source === 'patient_profile'
        ? 'Patient profile'
        : 'Doctor visit',
    threshold
  }));

  // Append projected point if forecast exists and worsening
  if (forecast && forecast.forecastDays && forecast.trend === 'worsening' && chartData.length > 0) {
    chartData[chartData.length - 1].projectedValue = chartData[chartData.length - 1].value;
    const projectedDate = new Date(Date.now() + forecast.forecastDays * 86400000).toLocaleDateString('en-IN', {
      month: 'short',
      day: 'numeric'
    });
    chartData.push({
      index: chartData.length + 1,
      date: `${projectedDate}*`,
      fullDate: `Projected (${forecast.forecastWeeksText})`,
      projectedValue: threshold,
      threshold,
      isForecast: true
    });
  }

  const isWorsening = forecast?.trend === 'worsening';

  return (
    <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-bold text-slate-800">
              Longitudinal {metricName} & OLS Forecast
            </h3>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Patient-specific ordinary least-squares regression over this patient's readings
          </p>
        </div>

        {forecast?.hasSufficientData ? (
          <div
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
              isWorsening ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}
          >
            {isWorsening ? <AlertTriangle className="w-4 h-4 text-amber-600" /> : <TrendingUp className="w-4 h-4 text-emerald-600" />}
            <div>
              <span>Slope: </span>
              <span className="font-mono font-bold">
                {forecast.slopePerMonth > 0 ? '+' : ''}
                {forecast.slopePerMonth} {unit}/month
              </span>
              <span className="text-[10px] ml-1 opacity-75">({forecast.trend.toUpperCase()})</span>
            </div>
          </div>
        ) : (
          <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md">
            Insufficient data (&lt;3 readings)
          </span>
        )}
      </div>

      {/* Chart container */}
      <div className="h-64 w-full mt-4">
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fill: '#64748b', fontSize: 11 }}
                unit={` ${unit}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs space-y-1">
                        <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{data.fullDate}</span>
                        </div>
                        {data.value !== undefined && (
                          <div className="text-sm font-bold text-emerald-400">
                            {data.value} {unit}
                          </div>
                        )}
                        {data.projectedValue !== undefined && (
                          <div className="text-sm font-bold text-amber-400">
                            Forecast: ~{data.projectedValue} {unit}
                          </div>
                        )}
                        {data.source && (
                          <div className="text-[10px] text-slate-400">Recorded by: {data.source}</div>
                        )}
                        <div className="text-[10px] text-rose-300 border-t border-slate-700 pt-1">
                          Clinical Threshold: {threshold} {unit}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Threshold reference line */}
              <ReferenceLine
                y={threshold}
                stroke="#f43f5e"
                strokeDasharray="4 4"
                label={{
                  value: `Threshold: ${threshold} ${unit}`,
                  fill: '#f43f5e',
                  fontSize: 10,
                  position: 'insideTopRight'
                }}
              />
              {/* Actual historical line */}
              <Line
                type="monotone"
                dataKey="value"
                stroke="#059669"
                strokeWidth={3}
                dot={{ r: 5, fill: '#059669', strokeWidth: 2, stroke: '#ffffff' }}
                activeDot={{ r: 7 }}
                name="Recorded Value"
              />
              {/* Projected dotted trajectory */}
              <Line
                type="monotone"
                dataKey="projectedValue"
                stroke="#f59e0b"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 5, fill: '#f59e0b', strokeWidth: 2, stroke: '#ffffff' }}
                name="Projected Forecast"
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-400 text-sm">
            No historical recordings logged yet.
          </div>
        )}
      </div>

      {/* Narrative Blueprint Callout */}
      {forecast?.summaryText && (
        <div className="mt-4 p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-start gap-2.5">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
          <div>
            <span className="font-semibold text-slate-900">Explainable AI Forecast: </span>
            <span>{forecast.summaryText}</span>
            <div className="mt-1 text-[11px] text-slate-500 italic">
              *Threshold configured in clinical guidelines. Decision support only — clinician retains final treatment authority.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
