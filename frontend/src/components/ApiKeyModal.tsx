// components/ApiKeyModal.tsx
import { useState } from 'react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onSubmit: (key: string) => void;
  onClose: () => void;
}

export default function ApiKeyModal({ isOpen, onSubmit, onClose }: ApiKeyModalProps) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.startsWith('sk-')) {
      setError('Invalid API key format. Key should start with "sk-"');
      return;
    }
    onSubmit(key);
    setKey('');
    setError('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full">
        <h2 className="text-2xl font-bold mb-4">Enter OpenAI API Key</h2>
        <p className="text-gray-600 mb-4">
          Your API key will be used only for this session and won&apos;t be stored.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-..."
            className="w-full px-3 py-2 border rounded-lg mb-4"
            required
          />
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg 
                       hover:bg-indigo-700 transition-colors"
            >
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}