import React, { useState } from 'react';

export default function CategoryQueueModal({
  queue: initialQueue,
  availableCategories = [],
  categoryCounts = {},
  onSave,
  onClose
}) {
  const [slots, setSlots] = useState(() => {
    if (initialQueue && initialQueue.length > 0) {
      return initialQueue.map(s => ({
        category: s.category || '',
        count: s.count ? String(s.count) : ''
      }));
    }
    return [{ category: availableCategories[0] || '', count: '' }];
  });

  const [customMode, setCustomMode] = useState({});

  const addSlot = () => {
    setSlots(prev => [...prev, { category: availableCategories[0] || '', count: '' }]);
  };

  const removeSlot = (idx) => {
    setSlots(prev => prev.filter((_, i) => i !== idx));
  };

  const moveSlot = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= slots.length) return;
    const copy = [...slots];
    const temp = copy[idx];
    copy[idx] = copy[newIdx];
    copy[newIdx] = temp;
    setSlots(copy);
  };

  const updateSlot = (idx, field, value) => {
    setSlots(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const handleSave = () => {
    const valid = slots
      .map(s => ({
        category: String(s.category || '').trim(),
        count: parseInt(s.count) || 0
      }))
      .filter(s => s.category.length > 0);

    if (valid.length === 0) {
      alert('Please configure at least one category slot with a category name.');
      return;
    }

    onSave(valid);
  };

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[#18181b] rounded-2xl max-w-xl w-full max-h-[90vh] flex flex-col border border-purple-500/40 shadow-2xl shadow-purple-950/50">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-800 bg-gradient-to-r from-purple-900/30 via-transparent to-transparent rounded-t-2xl">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">🏷️</span>
            <div>
              <h2 className="text-xl font-black text-white tracking-wide">Category Auction Queue</h2>
              <p className="text-xs text-purple-300/80">Configure sequential rounds by player category</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl font-bold px-2 transition-colors"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar space-y-4">
          <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl text-xs text-purple-200/90 leading-relaxed">
            💡 <strong>How it works:</strong> Players are loaded category-by-category. Fresh players in each category are always auctioned first before any unsold players.
            Leave <span className="bg-purple-900/50 text-white px-1.5 py-0.5 rounded font-mono font-semibold">Count</span> blank to play <strong>all</strong> players of that category before moving to the next.
          </div>

          {availableCategories.length === 0 && (
            <div className="p-3 bg-yellow-950/30 border border-yellow-500/30 rounded-xl text-xs text-yellow-300">
              ⚠️ No categories detected in your uploaded players. You can still type custom category names below (e.g. Diamond, Gold, Silver).
            </div>
          )}

          {/* Slots List */}
          <div className="space-y-2.5">
            {slots.map((slot, idx) => {
              const isCustom = customMode[idx] || (slot.category && !availableCategories.includes(slot.category));
              const availableInCat = categoryCounts[slot.category] ?? 0;

              return (
                <div
                  key={idx}
                  className="flex items-center gap-2.5 bg-gray-900/90 border border-gray-800 hover:border-purple-500/40 p-3 rounded-xl transition-all"
                >
                  {/* Slot Number */}
                  <div className="w-7 h-7 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-xs font-black text-purple-300 shrink-0">
                    {idx + 1}
                  </div>

                  {/* Category Selector / Input */}
                  <div className="flex-1 min-w-0">
                    {!isCustom && availableCategories.length > 0 ? (
                      <div className="flex gap-1.5">
                        <select
                          value={slot.category}
                          onChange={(e) => {
                            if (e.target.value === '__CUSTOM__') {
                              setCustomMode(prev => ({ ...prev, [idx]: true }));
                              updateSlot(idx, 'category', '');
                            } else {
                              updateSlot(idx, 'category', e.target.value);
                            }
                          }}
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-purple-500 focus:outline-none"
                        >
                          <option value="">Select category...</option>
                          {availableCategories.map(cat => (
                            <option key={cat} value={cat}>
                              {cat} ({categoryCounts[cat] ?? 0} available)
                            </option>
                          ))}
                          <option value="__CUSTOM__">+ Type custom category...</option>
                        </select>
                      </div>
                    ) : (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={slot.category}
                          onChange={(e) => updateSlot(idx, 'category', e.target.value)}
                          placeholder="e.g. Diamond, Gold, Silver..."
                          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:border-purple-500 focus:outline-none"
                        />
                        {availableCategories.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setCustomMode(prev => ({ ...prev, [idx]: false }));
                              updateSlot(idx, 'category', availableCategories[0] || '');
                            }}
                            className="text-xs text-purple-400 hover:text-purple-300 px-2 shrink-0 border border-purple-500/30 rounded-lg"
                            title="Choose from existing list"
                          >
                            List
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Count Input */}
                  <div className="flex flex-col items-center shrink-0 w-20">
                    <input
                      type="number"
                      min="1"
                      value={slot.count}
                      onChange={(e) => updateSlot(idx, 'count', e.target.value)}
                      placeholder="All"
                      className="w-full px-2 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm text-center font-mono focus:border-purple-500 focus:outline-none"
                      title="Number of players to auction in this round. Leave blank for ALL."
                    />
                    <span className="text-[10px] text-gray-500 mt-0.5">blank = all</span>
                  </div>

                  {/* Actions: Reorder & Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveSlot(idx, -1)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-20 transition-all"
                      title="Move Up"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={idx === slots.length - 1}
                      onClick={() => moveSlot(idx, 1)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-20 transition-all"
                      title="Move Down"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      disabled={slots.length <= 1}
                      onClick={() => removeSlot(idx)}
                      className="p-1.5 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-950/40 disabled:opacity-20 transition-all font-bold"
                      title="Delete Slot"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Slot Button */}
          <button
            type="button"
            onClick={addSlot}
            className="w-full py-2.5 border border-dashed border-gray-700 hover:border-purple-500 text-purple-300 hover:text-white hover:bg-purple-950/20 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
          >
            <span>+</span> Add Category Round
          </button>

          {/* Quick Example Card */}
          <div className="p-3 bg-gray-900/60 border border-gray-800 rounded-xl text-[11px] text-gray-400 space-y-1">
            <span className="text-white font-semibold block">📋 Example Queue:</span>
            <div>1. <span className="text-purple-300">Diamond × 4</span> (serves 4 diamond players)</div>
            <div>2. <span className="text-purple-300">Gold × All</span> (serves all gold players)</div>
            <div>3. <span className="text-purple-300">Silver × 4</span> (serves 4 silver players)</div>
            <div>4. <span className="text-purple-300">Diamond × All</span> (returns to serve remaining fresh + unsold Diamond players)</div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-800 flex justify-end gap-3 bg-[#131316] rounded-b-2xl">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white bg-gray-800/80 hover:bg-gray-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2 text-sm font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 shadow-lg shadow-purple-900/40 rounded-xl transition-all"
          >
            Save & Activate Queue
          </button>
        </div>

      </div>
    </div>
  );
}
