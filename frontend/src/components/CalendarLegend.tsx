import React from 'react';
import { CalendarLayer, Conflict } from '../types/calendar';

interface CalendarLegendProps {
  layers: CalendarLayer[];
  conflicts: Conflict[];
  onLayerClick: (layerId: string) => void;
}

const CalendarLegend: React.FC<CalendarLegendProps> = ({
  layers,
  conflicts,
  onLayerClick
}) => {
  const enabledLayers = layers.filter(layer => layer.enabled);
  const hasConflicts = conflicts.length > 0;

  const getLayerIcon = (layer: CalendarLayer) => {
    return layer.icon || '📅';
  };

  const getConflictIcon = (conflict: Conflict) => {
    switch (conflict.type) {
      case 'schedule-constraint':
        return '⚠️';
      case 'overlap':
        return '🚫';
      case 'coverage-gap':
        return '❌';
      default:
        return '⚠️';
    }
  };

  const getConflictColor = (conflict: Conflict) => {
    switch (conflict.type) {
      case 'schedule-constraint':
        return 'text-red-600 dark:text-red-400';
      case 'overlap':
        return 'text-orange-600 dark:text-orange-400';
      case 'coverage-gap':
        return 'text-yellow-600 dark:text-yellow-400';
      default:
        return 'text-red-600 dark:text-red-400';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
        Calendar Legend
      </h3>

      {/* Layer Legend */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Layers ({enabledLayers.length} active)
        </h4>
        <div className="space-y-2">
          {enabledLayers
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((layer) => (
              <div
                key={layer.id}
                className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                onClick={() => onLayerClick(layer.id)}
              >
                <div
                  className="w-4 h-4 rounded border-2 border-gray-300 dark:border-gray-600"
                  style={{
                    backgroundColor: layer.color,
                    opacity: layer.opacity
                  }}
                />
                <span className="text-lg">{getLayerIcon(layer)}</span>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {layer.name}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {layer.dataType}
                </span>
              </div>
            ))}
        </div>
      </div>

      {/* Conflict Indicators */}
      {hasConflicts && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Conflicts ({conflicts.length})
          </h4>
          <div className="space-y-2">
            {conflicts.slice(0, 5).map((conflict) => (
              <div
                key={conflict.id}
                className="flex items-center space-x-3 p-2 rounded-md bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
              >
                <span className="text-lg">{getConflictIcon(conflict)}</span>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${getConflictColor(conflict)}`}>
                    {conflict.description}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(conflict.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
            {conflicts.length > 5 && (
              <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                +{conflicts.length - 5} more conflicts
              </div>
            )}
          </div>
        </div>
      )}

      {/* Layer Type Guide */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Layer Types
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center space-x-2">
            <span>📅</span>
            <span className="text-gray-600 dark:text-gray-400">Shifts</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>🚫</span>
            <span className="text-gray-600 dark:text-gray-400">Constraints</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>🏖️</span>
            <span className="text-gray-600 dark:text-gray-400">Vacations</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>🎉</span>
            <span className="text-gray-600 dark:text-gray-400">Events</span>
          </div>
          <div className="flex items-center space-x-2">
            <span>⚖️</span>
            <span className="text-gray-600 dark:text-gray-400">Fairness</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>Total layers: {layers.length}</span>
          <span>Active: {enabledLayers.length}</span>
          {hasConflicts && (
            <span className="text-red-600 dark:text-red-400">
              {conflicts.length} conflicts
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalendarLegend; 