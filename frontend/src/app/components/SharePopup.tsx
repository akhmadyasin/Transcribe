// @ts-nocheck
"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/app/lib/supabaseClient";

interface SharePopupProps {
  isOpen: boolean;
  onClose: () => void;
  historyId: string;
}

export default function SharePopup({ isOpen, onClose, historyId }: SharePopupProps) {
  const [loading, setLoading] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const supabase = supabaseBrowser();

  const handleCreateShare = async () => {
    if (!historyId) return;

    setLoading(true);
    setError(null);
    setShareUrl(null);

    try {
      console.log('Creating share for history ID:', historyId);
      
      // Test endpoint first
      const testResponse = await fetch('http://localhost:5001/api/share/test');
      const testData = await testResponse.json();
      console.log('Test endpoint response:', testData);
      
      if (!testData.supabase_configured) {
        throw new Error('Supabase not configured on backend');
      }
      
      // Get current session
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("You must be logged in to create a share link");
      }

      console.log('Session found, access token:', session.access_token ? 'present' : 'missing');

      // Create share token
      const response = await fetch('http://localhost:5001/api/share/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          history_id: historyId
        })
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response:', errorData);
        throw new Error(errorData.error || 'Failed to create share link');
      }

      const data = await response.json();
      console.log('Success response:', data);
      const fullUrl = `${window.location.origin}/share/${data.share_token}`;
      setShareUrl(fullUrl);
    } catch (err: any) {
      console.error('Error creating share:', err);
      setError(err.message || 'Failed to create share link');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = async () => {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  const handleClose = () => {
    setShareUrl(null);
    setError(null);
    setCopied(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Share Transcription</h3>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-4">
            Create a shareable link that allows others to view this transcription without logging in.
          </p>

          {!shareUrl && !error && (
            <button
              onClick={handleCreateShare}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Share Link'}
            </button>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {shareUrl && (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <p className="text-green-600 text-sm font-medium mb-2">Share link created successfully!</p>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={shareUrl}
                    readOnly
                    className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 bg-gray-50"
                  />
                  <button
                    onClick={handleCopyLink}
                    className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="text-xs text-gray-500">
                <p><strong>Note:</strong> This link will expire in 30 days and can be accessed by anyone with the URL.</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
