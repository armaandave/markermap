'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, UserPlus, UserCheck, UserX, Check, X as XIcon } from 'lucide-react';

interface User {
  user_id: string;
  email: string;
  display_name?: string;
  username?: string;
  profile_picture_url?: string;
}

interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
  friend?: User;
  isIncoming: boolean;
}

interface FriendRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: string;
}

const FriendRequestModal: React.FC<FriendRequestModalProps> = ({ isOpen, onClose, userId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<'search' | 'requests'>('search');

  // Fetch pending friend requests
  const fetchPendingRequests = async () => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/friends?userId=${userId}&status=pending`);
      if (response.ok) {
        const { friends } = await response.json();
        setPendingRequests(friends || []);
      }
    } catch (error) {
      console.error('Error fetching pending requests:', error);
    }
  };

  useEffect(() => {
    if (isOpen && userId) {
      fetchPendingRequests();
    }
  }, [isOpen, userId]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setActiveTab('search');
    }
  }, [isOpen]);

  // Debounced search - automatically search as user types
  useEffect(() => {
    if (!searchQuery.trim() || !userId) {
      setSearchResults([]);
      return;
    }

    const searchTimeout = setTimeout(() => {
      const performSearch = async () => {
        setIsSearching(true);
        try {
          const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}&userId=${userId}`);
          if (response.ok) {
            const { users } = await response.json();
            setSearchResults(users || []);
          }
        } catch (error) {
          console.error('Error searching users:', error);
        } finally {
          setIsSearching(false);
        }
      };

      performSearch();
    }, 500); // 500ms debounce

    return () => clearTimeout(searchTimeout);
  }, [searchQuery, userId]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !userId) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}&userId=${userId}`);
      if (response.ok) {
        const { users } = await response.json();
        setSearchResults(users || []);
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSendRequest = async (friendId: string) => {
    if (!userId) return;

    try {
      const response = await fetch('/api/friends', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, friendId, action: 'send_request' }),
      });

      if (response.ok) {
        // Remove from search results
        setSearchResults(searchResults.filter(u => u.user_id !== friendId));
        alert('Friend request sent!');
      } else {
        const { error } = await response.json();
        alert(error || 'Failed to send friend request');
      }
    } catch (error) {
      console.error('Error sending friend request:', error);
      alert('Failed to send friend request');
    }
  };

  const handleAcceptRequest = async (friendshipId: string) => {
    try {
      const response = await fetch('/api/friends', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ friendshipId, userId, status: 'accepted' }),
      });

      if (response.ok) {
        fetchPendingRequests();
      } else {
        const { error } = await response.json();
        alert(error || 'Failed to accept friend request');
      }
    } catch (error) {
      console.error('Error accepting friend request:', error);
      alert('Failed to accept friend request');
    }
  };

  const handleDeclineRequest = async (friendshipId: string) => {
    if (!confirm('Are you sure you want to decline this friend request?')) return;

    try {
      const response = await fetch(`/api/friends?id=${friendshipId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchPendingRequests();
      } else {
        const { error } = await response.json();
        alert(error || 'Failed to decline friend request');
      }
    } catch (error) {
      console.error('Error declining friend request:', error);
      alert('Failed to decline friend request');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-semibold text-white">Friends</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 px-6 pt-4 border-b border-gray-700">
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'search'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <Search size={16} />
              Search & Add
            </div>
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'requests'
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            <div className="flex items-center gap-2">
              <UserCheck size={16} />
              Requests ({pendingRequests.length})
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'search' && (
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by email or username..."
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={handleSearch}
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Search size={16} />
                  Search
                </button>
              </div>

              {/* Search Results */}
              {isSearching ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
                  <p className="text-gray-400">Searching...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {searchResults.map((user) => (
                    <div
                      key={user.user_id}
                      className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {user.profile_picture_url ? (
                          <img
                            src={user.profile_picture_url}
                            alt={user.display_name || user.email}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                            {(user.display_name || user.email)[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-white font-medium">{user.display_name || user.username || 'User'}</p>
                          <p className="text-sm text-gray-400">{user.email}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendRequest(user.user_id)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                      >
                        <UserPlus size={16} />
                        Add Friend
                      </button>
                    </div>
                  ))}
                  {searchResults.length === 0 && searchQuery && (
                    <p className="text-center text-gray-400 py-8">No users found</p>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'requests' && (
            <div className="space-y-4">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-12">
                  <UserCheck size={48} className="mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-400">No pending friend requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((friendship) => {
                    const otherUser = friendship.isIncoming ? friendship.friend : { user_id: friendship.friend_id, email: '', display_name: '' };
                    return (
                      <div
                        key={friendship.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-gray-700 rounded-lg gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                            {(otherUser?.display_name || otherUser?.email || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="text-white font-medium">{otherUser?.display_name || 'User'}</p>
                            <p className="text-sm text-gray-400">{otherUser?.email || otherUser?.user_id}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 sm:flex-nowrap">
                          {friendship.isIncoming ? (
                            <>
                              <button
                                onClick={() => handleAcceptRequest(friendship.id)}
                                className="px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm sm:px-4"
                              >
                                <Check size={14} className="sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">Accept</span>
                              </button>
                              <button
                                onClick={() => handleDeclineRequest(friendship.id)}
                                className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center gap-2 text-sm sm:px-4"
                              >
                                <XIcon size={14} className="sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">Decline</span>
                              </button>
                            </>
                          ) : (
                            <span className="text-gray-400 text-sm">Request sent</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FriendRequestModal;

