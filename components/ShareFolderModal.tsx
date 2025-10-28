'use client';

import React, { useState, useEffect } from 'react';
import { X, Search, Share2, Eye, Edit, Trash2, Users } from 'lucide-react';
import { Folder } from '../lib/db';

interface User {
  user_id: string;
  email: string;
  display_name?: string;
  username?: string;
  profile_picture_url?: string;
}

interface FolderShare {
  id: string;
  folder_id: string;
  owner_id: string;
  shared_with_id: string;
  permission: 'view' | 'edit';
  created_at: string;
  folder?: Folder;
  owner?: User;
  sharedWith?: User;
}

interface ShareFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: Folder | null;
  userId?: string;
}

const ShareFolderModal: React.FC<ShareFolderModalProps> = ({ isOpen, onClose, folder, userId }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedPermission, setSelectedPermission] = useState<'view' | 'edit'>('view');
  const [existingShares, setExistingShares] = useState<FolderShare[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);

  // Fetch existing shares for this folder
  const fetchExistingShares = async () => {
    if (!folder || !userId) return;

    try {
      // Fetch shares by owner (where current user is owner)
      const response = await fetch(`/api/folders/share?userId=${userId}&type=shared-by-me`);
      if (response.ok) {
        const { shares } = await response.json();
        // Filter shares for this specific folder
        const folderShares = (shares || []).filter((s: FolderShare) => s.folder_id === folder?.id);
        console.log('Existing shares for folder:', folderShares);
        setExistingShares(folderShares);
      }
    } catch (error) {
      console.error('Error fetching existing shares:', error);
    }
  };

  // Fetch friends
  const fetchFriends = async () => {
    if (!userId) return;

    try {
      const response = await fetch(`/api/friends?userId=${userId}&status=accepted`);
      if (response.ok) {
        const { friends } = await response.json();
        setFriends(friends || []);
      }
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };

  useEffect(() => {
    if (isOpen && folder && userId) {
      fetchExistingShares();
      fetchFriends();
    }
  }, [isOpen, folder, userId]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSearchResults([]);
      setSelectedPermission('view');
    }
  }, [isOpen]);

  // Debounced search - automatically search as user types
  useEffect(() => {
    if (!searchQuery.trim() || !userId || !folder) {
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
            console.log('Search results:', users);
            // Filter out users who already have access
            const alreadySharedIds = existingShares.map(s => s.shared_with_id);
            const filteredUsers = users.filter((u: User) => !alreadySharedIds.includes(u.user_id));
            console.log('Filtered results:', filteredUsers);
            setSearchResults(filteredUsers);
          } else {
            const errorData = await response.json();
            console.error('Search API error:', errorData);
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
  }, [searchQuery, userId, folder, existingShares]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !userId) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}&userId=${userId}`);
      if (response.ok) {
        const { users } = await response.json();
        // Filter out users who already have access
        const alreadySharedIds = existingShares.map(s => s.shared_with_id);
        setSearchResults(users.filter((u: User) => !alreadySharedIds.includes(u.user_id)));
      }
    } catch (error) {
      console.error('Error searching users:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const handleShare = async (sharedWithId: string) => {
    if (!folder || !userId) return;

    try {
      const response = await fetch('/api/folders/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: folder.id,
          userId,
          sharedWithId,
          permission: selectedPermission,
        }),
      });

      if (response.ok) {
        setSearchResults([]);
        setSearchQuery('');
        fetchExistingShares();
        alert('Folder shared successfully!');
      } else {
        const { error } = await response.json();
        alert(error || 'Failed to share folder');
      }
    } catch (error) {
      console.error('Error sharing folder:', error);
      alert('Failed to share folder');
    }
  };

  const handleUnshare = async (shareId: string) => {
    if (!confirm('Are you sure you want to unshare this folder?')) return;

    try {
      const response = await fetch(`/api/folders/share?shareId=${shareId}&userId=${userId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchExistingShares();
      } else {
        const { error } = await response.json();
        alert(error || 'Failed to unshare folder');
      }
    } catch (error) {
      console.error('Error unsharing folder:', error);
      alert('Failed to unshare folder');
    }
  };

  if (!isOpen || !folder) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-semibold text-white">Share Folder</h2>
            <p className="text-sm text-gray-400 mt-1">{folder.name}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Permission Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Default Permission
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedPermission('view')}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                  selectedPermission === 'view'
                    ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                    : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <Eye size={16} />
                View Only
              </button>
              <button
                onClick={() => setSelectedPermission('edit')}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-colors ${
                  selectedPermission === 'edit'
                    ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                    : 'border-gray-600 bg-gray-700 text-gray-300 hover:border-gray-500'
                }`}
              >
                <Edit size={16} />
                Can Edit
              </button>
            </div>
          </div>

          {/* Your Friends - Quick Access */}
          {friends.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
                <Users size={18} />
                Your Friends
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {friends.map((friendship) => {
                  const friend = friendship.friend || { 
                    user_id: friendship.friend_id, 
                    email: '', 
                    display_name: '',
                    profile_picture_url: null
                  };
                  const alreadyShared = existingShares.some(s => s.shared_with_id === friend.user_id);
                  
                  return (
                    <button
                      key={friendship.id}
                      onClick={() => !alreadyShared && handleShare(friend.user_id)}
                      disabled={alreadyShared}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        alreadyShared 
                          ? 'bg-gray-600/30 cursor-not-allowed opacity-50' 
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      {friend.profile_picture_url ? (
                        <img
                          src={friend.profile_picture_url}
                          alt={friend.display_name || friend.email}
                          className="w-8 h-8 rounded-full"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm">
                          {(friend.display_name || friend.email || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 text-left">
                        <p className={`text-sm font-medium ${alreadyShared ? 'text-gray-400' : 'text-white'}`}>
                          {friend.display_name || friend.email || 'Friend'}
                        </p>
                        {alreadyShared && (
                          <p className="text-xs text-gray-500">Already shared</p>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search for Users */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Share with</h3>
            <div className="flex gap-2 mb-4">
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
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
                <p className="text-gray-400 text-sm">Searching...</p>
              </div>
            ) : searchResults.length > 0 && (
              <div className="space-y-2 mb-4">
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
                      onClick={() => handleShare(user.user_id)}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-2"
                    >
                      <Share2 size={16} />
                      Share
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Existing Shares */}
          <div>
            <h3 className="text-lg font-semibold text-white mb-3">Shared with</h3>
            {existingShares.length === 0 ? (
              <p className="text-gray-400 text-center py-8">No one has access to this folder yet</p>
            ) : (
              <div className="space-y-2">
                {existingShares.map((share) => {
                  const sharedUser = share.sharedWith || { user_id: share.shared_with_id, email: '', display_name: '' };
                  return (
                    <div
                      key={share.id}
                      className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {sharedUser?.profile_picture_url ? (
                          <img
                            src={sharedUser.profile_picture_url}
                            alt={sharedUser.display_name || sharedUser.email}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center">
                            {(sharedUser?.display_name || sharedUser?.email || 'U')[0].toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-white font-medium">{sharedUser?.display_name || 'User'}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 bg-gray-600 rounded text-gray-300">
                              {share.permission === 'edit' ? (
                                <span className="flex items-center gap-1">
                                  <Edit size={10} /> Can Edit
                                </span>
                              ) : (
                                <span className="flex items-center gap-1">
                                  <Eye size={10} /> View Only
                                </span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUnshare(share.id)}
                        className="p-2 text-red-400 hover:bg-red-600/20 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ShareFolderModal;

