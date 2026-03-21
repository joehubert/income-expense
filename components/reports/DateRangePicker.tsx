'use client';

// Shared date range control for all report views
import { useEffect, useState } from 'react';

export interface DateRange {
  from: string;  // YYYY-MM-DD
  to: string;    // YYYY-MM-DD
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

type Preset = 'ytd' | 'custom';

function ytdRange(): DateRange {
  const today = new Date();
  const year  = today.getFullYear();
  return {
    from: `${year}-01-01`,
    to:   today.toISOString().slice(0, 10),
  };
}

export default function DateRangePicker({ value, onChange }: Readonly<DateRangePickerProps>) {
  const [preset, setPreset] = useState<Preset>('ytd');

  // Initialise to YTD on mount if value is empty
  useEffect(() => {
    if (!value.from && !value.to) {
      onChange(ytdRange());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPreset(p: Preset) {
    setPreset(p);
    if (p === 'ytd') onChange(ytdRange());
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Preset buttons */}
      <div className="flex rounded-md border border-gray-300 overflow-hidden text-sm">
        {(['ytd', 'custom'] as Preset[]).map((p) => (
          <button
            key={p}
            onClick={() => applyPreset(p)}
            className={`px-3 py-1.5 font-medium capitalize ${
              preset === p ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            {p === 'ytd' ? 'YTD' : 'Custom Range'}
          </button>
        ))}
      </div>

      {/* Date pickers — always visible, editable when custom is active */}
      <div className="flex items-center gap-2 text-sm">
        <input
          type="date"
          value={value.from}
          onChange={(e) => { setPreset('custom'); onChange({ ...value, from: e.target.value }); }}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-gray-400">–</span>
        <input
          type="date"
          value={value.to}
          onChange={(e) => { setPreset('custom'); onChange({ ...value, to: e.target.value }); }}
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
