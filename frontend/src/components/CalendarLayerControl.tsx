import React, { useState } from 'react';
import { CalendarLayer, LayerPreferences } from '../types/calendar';

interface CalendarLayerControlProps {
  layers: CalendarLayer[];
  onLayerToggle: (layerId: string, enabled: boolean) => void;
  onPreferenceChange: (layerId: string, preferences: Partial<LayerPreferences>) => void;
  onReset: () => void;
}

const CalendarLayerControl: React.FC<CalendarLayerControlProps> = ({
  layers,
  onLayerToggle,
  onPreferenceChange,
  onReset
}) => {
  const [expandedLayer, setExpandedLayer] = useState<string | null>(null);

  const handleLayerToggle = (layerId: string, enabled: boolean) => {
    onLayerToggle(layerId, enabled);
  };

  const handleOpacityChange = (layerId: string, opacity: number) => {
    onPreferenceChange(layerId, { opacity });
  };

  const handleColorChange = (layerId: string, color: string) => {
    onPreferenceChange(layerId, { color });
  };

  const handleOrderChange = (layerId: string, orderIndex: number) => {
    onPreferenceChange(layerId, { orderIndex });
  };

  const toggleLayerExpansion = (layerId: string) => {
    setExpandedLayer(expandedLayer === layerId ? null : layerId);
  };

  const getLayerIcon = (layer: CalendarLayer) => {
    return layer.icon || '📅';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Calendar Layers
        </h3>
        <button
          onClick={onReset}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="space-y-3">
        {layers
          .sort((a, b) => a.orderIndex - b.orderIndex)
          .map((layer) => (
            <div
              key={layer.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-3"
            >
              {/* Layer Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{getLayerIcon(layer)}</span>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {layer.name}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {layer.description}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* Toggle Switch */}
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={layer.enabled}
                      onChange={(e) => handleLayerToggle(layer.id, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                  
                  {/* Expand/Collapse Button */}
                  <button
                    onClick={() => toggleLayerExpansion(layer.id)}
                    className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <svg
                      className={`w-4 h-4 transform transition-transform ${
                        expandedLayer === layer.id ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Layer Details (Expanded) */}
              {expandedLayer === layer.id && (
                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 space-y-3">
                  {/* Opacity Slider */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Opacity: {Math.round(layer.opacity * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={layer.opacity}
                      onChange={(e) => handleOpacityChange(layer.id, parseFloat(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
                    />
                  </div>

                  {/* Color Picker */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Color
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="color"
                        value={layer.color}
                        onChange={(e) => handleColorChange(layer.id, e.target.value)}
                        className="w-8 h-8 rounded border border-gray-300 dark:border-gray-600 cursor-pointer"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        {layer.color}
                      </span>
                    </div>
                  </div>

                  {/* Order Index */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Display Order
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={layer.orderIndex}
                      onChange={(e) => handleOrderChange(layer.id, parseInt(e.target.value))}
                      className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>

                  {/* Layer Type */}
                  <div>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Type: <span className="font-medium capitalize">{layer.dataType}</span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
      </div>

      {/* Summary */}
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
          <span>
            {layers.filter(l => l.enabled).length} of {layers.length} layers enabled
          </span>
          <span>
            {layers.filter(l => l.enabled).length > 0 ? 'Active' : 'No layers active'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default CalendarLayerControl; 