import React, { useState, useEffect } from 'react';
import { FileText, Download, AlertCircle, CheckCircle } from 'lucide-react';

interface GoogleDriveLoaderProps {
  onDataLoaded: (data: any) => void;
}

export function GoogleDriveLoader({ onDataLoaded }: GoogleDriveLoaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');

  // PERMANENT RULE: This component is DEPRECATED - all data must come from G: drive
  useEffect(() => {
    setError('This component is deprecated. All data must be loaded from G: drive through the main application.');
    setStatus('DEPRECATED - Use G: Drive Only');
  }, []);

  return (
    <div className="bg-white rounded-xl shadow-soft p-6 border border-red-200">
      <div className="text-center">
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-red-500" />
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Component Deprecated</h2>
        <p className="text-gray-600 mb-4">
          This component has been deprecated in favor of G: drive data loading.
        </p>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-700 font-medium">
            PERMANENT RULE: All data must come from G: drive. No local data loading allowed.
          </p>
        </div>
        <p className="text-sm text-gray-500">
          The main application now automatically loads all data from G: drive.
          Please use the main application interface instead.
        </p>
      </div>
    </div>
  );
}
