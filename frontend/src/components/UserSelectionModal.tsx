import React, { useState, useEffect } from 'react';
import { X, User, Calendar, Check } from 'lucide-react';

interface UserSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (userName: string, documentDate: string) => void;
  initialUserName?: string;
  initialDate?: string;
}

const UserSelectionModal: React.FC<UserSelectionModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialUserName = '',
  initialDate = new Date().toISOString().split('T')[0]
}) => {
  const [selectedUser, setSelectedUser] = useState(initialUserName);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [isAnimating, setIsAnimating] = useState(false);

  const users = [
    { name: 'Haron Alhakimi', initials: 'HA', color: 'bg-blue-500' },
  ];

  useEffect(() => {
    if (isOpen) {
      setIsAnimating(true);
      // Reset to initial values when modal opens
      setSelectedUser(initialUserName);
      setSelectedDate(initialDate);
    }
  }, [isOpen, initialUserName, initialDate]);

  const handleConfirm = () => {
    if (selectedUser && selectedDate) {
      onConfirm(selectedUser, selectedDate);
      setIsAnimating(false);
      setTimeout(onClose, 300);
    }
  };

  const handleCancel = () => {
    setIsAnimating(false);
    setTimeout(onClose, 300);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black transition-opacity duration-300 ${
          isAnimating ? 'bg-opacity-50' : 'bg-opacity-0'
        }`}
        onClick={handleCancel}
      />
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-md transform transition-all duration-300 ${
            isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0'
          }`}
        >
          {/* Header */}
          <div className="relative bg-gradient-to-r from-blue-600 to-purple-600 rounded-t-2xl px-6 py-5">
            <button
              onClick={handleCancel}
              className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
            <h2 className="text-2xl font-bold text-white">Document Information</h2>
            <p className="text-blue-100 mt-1">Select user and document date</p>
          </div>

          {/* Content */}
          <div className="px-6 py-6 space-y-6">
            {/* User Selection */}
            <div>
              <label className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                <User className="h-4 w-4 mr-2" />
                Select User
              </label>
              <div className="grid grid-cols-2 gap-3">
                {users.map((user) => (
                  <button
                    key={user.name}
                    onClick={() => setSelectedUser(user.name)}
                    className={`relative p-4 rounded-xl border-2 transition-all duration-200 ${
                      selectedUser === user.name
                        ? 'border-blue-500 bg-blue-50 shadow-lg transform scale-105'
                        : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                    }`}
                  >
                    {selectedUser === user.name && (
                      <div className="absolute top-2 right-2">
                        <div className="bg-blue-500 rounded-full p-1">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      </div>
                    )}
                    <div className={`${user.color} w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mx-auto mb-2`}>
                      {user.initials}
                    </div>
                    <p className={`text-sm font-medium ${
                      selectedUser === user.name ? 'text-blue-900' : 'text-gray-700'
                    }`}>
                      {user.name}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Date Selection */}
            <div>
              <label htmlFor="documentDate" className="flex items-center text-sm font-semibold text-gray-700 mb-3">
                <Calendar className="h-4 w-4 mr-2" />
                Document Date
              </label>
              <input
                id="documentDate"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all duration-200 text-gray-700"
              />
            </div>

            {/* Selected Summary */}
            {selectedUser && (
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200">
                <p className="text-sm text-gray-600 mb-1">Selected Information:</p>
                <p className="font-medium text-gray-800">
                  <span className="text-blue-600">{selectedUser}</span>
                  <span className="mx-2 text-gray-400">•</span>
                  <span className="text-purple-600">{new Date(selectedDate).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    year: 'numeric', 
                    month: 'short', 
                    day: 'numeric' 
                  })}</span>
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-6 py-4 rounded-b-2xl">
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancel}
                className="px-6 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors duration-200 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedUser || !selectedDate}
                className={`px-6 py-2.5 rounded-lg font-medium transition-all duration-200 ${
                  selectedUser && selectedDate
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                Confirm Selection
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserSelectionModal;
