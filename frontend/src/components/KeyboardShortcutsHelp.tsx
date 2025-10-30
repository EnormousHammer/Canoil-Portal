import React from 'react';
import { X, Keyboard } from 'lucide-react';

interface KeyboardShortcutsHelpProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsHelp({ isOpen, onClose }: KeyboardShortcutsHelpProps) {
  if (!isOpen) return null;

  const shortcuts = [
    {
      category: 'Navigation',
      items: [
        { keys: ['Escape'], description: 'Close modal or go back' },
        { keys: ['Alt', '←'], description: 'Go back in history' },
        { keys: ['Alt', '→'], description: 'Go forward in history' },
        { keys: ['Ctrl', 'H'], description: 'Go to home/dashboard' },
        { keys: ['Alt', 'Backspace'], description: 'Go back (browser-style)' }
      ]
    },
    {
      category: 'Search & Actions',
      items: [
        { keys: ['Ctrl', 'F'], description: 'Focus search input' },
        { keys: ['Tab'], description: 'Navigate through elements' },
        { keys: ['Shift', 'Tab'], description: 'Navigate backwards' },
        { keys: ['Enter'], description: 'Activate focused element' },
        { keys: ['?'], description: 'Show this help (when not typing)' }
      ]
    },
    {
      category: 'Data Navigation',
      items: [
        { keys: ['↑', '↓'], description: 'Navigate table rows' },
        { keys: ['←', '→'], description: 'Navigate table columns' },
        { keys: ['Space'], description: 'Select/toggle item' },
        { keys: ['Enter'], description: 'Open item details' }
      ]
    }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-primary-dark to-primary px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 text-white">
                <Keyboard className="w-6 h-6" />
                <h2 className="text-xl font-semibold">
                  Keyboard Shortcuts
                </h2>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition-colors"
                aria-label="Close help"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body */}
          <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
            <div className="space-y-6">
              {shortcuts.map((category) => (
                <div key={category.category}>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center">
                    {category.category}
                  </h3>
                  <div className="space-y-2">
                    {category.items.map((shortcut, index) => (
                      <div key={`${shortcut.description}-${index}`} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-700">{shortcut.description}</span>
                        <div className="flex items-center space-x-1">
                          {shortcut.keys.map((key, keyIndex) => (
                            <React.Fragment key={keyIndex}>
                              {keyIndex > 0 && <span className="text-gray-400 text-sm">+</span>}
                              <kbd className="px-2 py-1 bg-white border border-gray-300 rounded text-sm font-mono text-gray-800 shadow-sm">
                                {key}
                              </kbd>
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Tip:</strong> Most shortcuts work globally throughout the application. 
                When typing in input fields, only Escape and navigation shortcuts are available.
              </p>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="bg-gray-50 px-6 py-4 flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors font-medium"
            >
              Got it!
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
