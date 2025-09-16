import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell, BarChart, Bar, ResponsiveContainer } from 'recharts';
import { Users, MessageSquare, FileText, Database, Activity, HardDrive, Cpu, Settings, Search, Filter, RefreshCw, Trash2, Eye, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { adminAPI } from '@/services/api';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  
  // Data states
  const [overviewStats, setOverviewStats] = useState({});
  const [usageStats, setUsageStats] = useState({});
  const [modelStats, setModelStats] = useState({});
  const [users, setUsers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [files, setFiles] = useState([]);
  const [systemInfo, setSystemInfo] = useState({});
  
  // Pagination states
  const [usersPagination, setUsersPagination] = useState({ page: 1, per_page: 10 });
  const [sessionsPagination, setSessionsPagination] = useState({ page: 1, per_page: 10 });
  const [filesPagination, setFilesPagination] = useState({ page: 1, per_page: 10 });
  
  // Filter states
  const [userSearch, setUserSearch] = useState('');
  const [activeUsersOnly, setActiveUsersOnly] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedModel, setSelectedModel] = useState('');

  // Load functions
  const loadOverviewStats = async () => {
    try {
      const data = await adminAPI.getOverviewStats();
      setOverviewStats(data.data); // Access .data property
    } catch (err) {
      setError(`Failed to load overview stats: ${err.message}`);
    }
  };

  const loadUsageStats = async (days = 30) => {
    try {
      const data = await adminAPI.getUsageStats(days);
      setUsageStats(data.data); // Access .data property
    } catch (err) {
      setError(`Failed to load usage stats: ${err.message}`);
    }
  };

  const loadModelStats = async () => {
    try {
      const data = await adminAPI.getModelStats();
      setModelStats(data.data); // Access .data property
    } catch (err) {
      setError(`Failed to load model stats: ${err.message}`);
    }
  };

  const loadUsers = async (page = 1) => {
    try {
      setLoading(true);
      const data = await adminAPI.getUsers(page, usersPagination.per_page, userSearch, activeUsersOnly);
      setUsers(data.data.users); // Access .data.users
      setUsersPagination(prev => ({ ...prev, ...data.data.pagination })); // Access .data.pagination
    } catch (err) {
      setError(`Failed to load users: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async (page = 1) => {
    try {
      setLoading(true);
      const data = await adminAPI.getSessions(page, sessionsPagination.per_page, selectedUserId, selectedModel);
      setSessions(data.data.sessions); // Access .data.sessions
      setSessionsPagination(prev => ({ ...prev, ...data.data.pagination })); // Access .data.pagination
    } catch (err) {
      setError(`Failed to load sessions: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadFiles = async (page = 1) => {
    try {
      setLoading(true);
      const data = await adminAPI.getFiles(page, filesPagination.per_page, selectedUserId);
      setFiles(data.data.files); // Access .data.files
      setFilesPagination(prev => ({ ...prev, ...data.data.pagination })); // Access .data.pagination
    } catch (err) {
      setError(`Failed to load files: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadSystemInfo = async () => {
    try {
      const data = await adminAPI.getSystemInfo();
      setSystemInfo(data.data); // Access .data property
    } catch (err) {
      setError(`Failed to load system info: ${err.message}`);
    }
  };

  const toggleUserStatus = async (userId, currentStatus) => {
    try {
      await adminAPI.updateUserStatus(userId, !currentStatus);
      await loadUsers(usersPagination.page);
      await loadOverviewStats(); // Refresh overview stats
    } catch (err) {
      setError(`Failed to update user status: ${err.message}`);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    setError('');
    
    try {
      await Promise.all([
        loadOverviewStats(),
        loadUsageStats(),
        loadModelStats(),
        activeTab === 'users' && loadUsers(usersPagination.page),
        activeTab === 'sessions' && loadSessions(sessionsPagination.page),
        activeTab === 'files' && loadFiles(filesPagination.page),
        activeTab === 'system' && loadSystemInfo()
      ].filter(Boolean));
    } finally {
      setRefreshing(false);
    }
  };

  // Effects
  useEffect(() => {
    loadOverviewStats();
    loadUsageStats();
    loadModelStats();
  }, []);

  useEffect(() => {
    if (activeTab === 'users') loadUsers(1);
    else if (activeTab === 'sessions') loadSessions(1);
    else if (activeTab === 'files') loadFiles(1);
    else if (activeTab === 'system') loadSystemInfo();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'users') {
      const timer = setTimeout(() => loadUsers(1), 500);
      return () => clearTimeout(timer);
    }
  }, [userSearch, activeUsersOnly]);

  useEffect(() => {
    if (activeTab === 'sessions') {
      const timer = setTimeout(() => loadSessions(1), 500);
      return () => clearTimeout(timer);
    }
  }, [selectedUserId, selectedModel]);

  // Helper functions
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

  // Components
  const StatCard = ({ title, value, icon: Icon, trend, color = 'blue' }) => (
    <div className="bg-white rounded-lg shadow p-6 border">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className={`text-2xl font-bold text-${color}-600`}>{value}</p>
          {trend && (
            <p className="text-sm text-gray-500 mt-1">{trend}</p>
          )}
        </div>
        <Icon className={`h-8 w-8 text-${color}-600`} />
      </div>
    </div>
  );

  const Pagination = ({ pagination, onPageChange }) => (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t">
      <div className="flex items-center text-sm text-gray-700">
        <span>Showing {((pagination.page - 1) * pagination.per_page) + 1} to {Math.min(pagination.page * pagination.per_page, pagination.total)} of {pagination.total} results</span>
      </div>
      <div className="flex items-center space-x-2">
        <button
          onClick={() => onPageChange(pagination.page - 1)}
          disabled={pagination.page <= 1}
          className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Previous
        </button>
        <span className="text-sm text-gray-700">
          Page {pagination.page} of {pagination.pages}
        </span>
        <button
          onClick={() => onPageChange(pagination.page + 1)}
          disabled={pagination.page >= pagination.pages}
          className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Next
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <Settings className="h-8 w-8 text-blue-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={refreshData}
                disabled={refreshing}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
          
          {/* Navigation Tabs */}
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', name: 'Overview', icon: Activity },
                { id: 'users', name: 'Users', icon: Users },
                { id: 'sessions', name: 'Sessions', icon: MessageSquare },
                { id: 'files', name: 'Files', icon: FileText },
                { id: 'system', name: 'System', icon: Database }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-5 w-5 mr-2" />
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2" />
              <p className="text-red-800">{error}</p>
              <button
                onClick={() => setError('')}
                className="ml-auto text-red-400 hover:text-red-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-gray-500">
              <StatCard
                title="Total Users"
                value={overviewStats.users?.total || 0}
                icon={Users}
                trend={`${overviewStats.users?.new_this_week || 0} new this week`}
                color="blue"
              />
              <StatCard
                title="Active Sessions"
                value={overviewStats.sessions?.active_24h || 0}
                icon={MessageSquare}
                trend={`${overviewStats.sessions?.total || 0} total sessions`}
                color="green"
              />
              <StatCard
                title="Messages"
                value={overviewStats.messages?.total || 0}
                icon={Activity}
                trend={`${overviewStats.messages?.new_this_week || 0} new this week`}
                color="purple"
              />
              <StatCard
                title="Storage Used"
                value={formatBytes(overviewStats.files?.total_size || 0)}
                icon={HardDrive}
                trend={`${overviewStats.files?.total || 0} files`}
                color="orange"
              />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Usage Trends */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Usage Trends (30 days)</h3>
                {usageStats.message_count ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={usageStats.message_count}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="#8884d8" name="Messages" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-300 flex items-center justify-center text-gray-500">
                    Loading chart data...
                  </div>
                )}
              </div>

              {/* Model Usage */}
              <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Model Usage</h3>
                {modelStats.model_usage ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={modelStats.model_usage}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ model, session_count }) => `${model}: ${session_count}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="session_count"
                      >
                        {modelStats.model_usage.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-300 flex items-center justify-center text-gray-500">
                    Loading chart data...
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-64">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-700" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-10 pr-4 py-2 w-full text-gray-700 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={activeUsersOnly}
                    onChange={(e) => setActiveUsersOnly(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">Active users only</span>
                </label>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-500">Loading users...</p>
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-gray-200">
                    {users.map(user => (
                      <li key={user.id} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                                user.is_active ? 'bg-green-100' : 'bg-gray-100'
                              }`}>
                                <Users className={`h-5 w-5 ${user.is_active ? 'text-green-600' : 'text-gray-400'}`} />
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="flex items-center">
                                <p className="text-sm font-medium text-gray-900">{user.username}</p>
                                {user.is_active ? (
                                  <CheckCircle className="ml-2 h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="ml-2 h-4 w-4 text-red-500" />
                                )}
                              </div>
                              <p className="text-sm text-gray-500">{user.email}</p>
                              <div className="flex items-center text-xs text-gray-400 mt-1">
                                <span>{user.session_count} sessions</span>
                                <span className="mx-2">•</span>
                                <span>{user.message_count} messages</span>
                                <span className="mx-2">•</span>
                                <span>{user.file_count} files</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className="text-right text-sm">
                              <p className="text-gray-900">Joined: {formatDate(user.created_at)}</p>
                              <p className="text-gray-500">Last login: {formatDate(user.last_login)}</p>
                            </div>
                            <button
                              onClick={() => toggleUserStatus(user.id, user.is_active)}
                              className={`px-3 py-1 text-xs font-medium rounded-full ${
                                user.is_active
                                  ? 'bg-red-100 text-red-800 hover:bg-red-200'
                                  : 'bg-green-100 text-green-800 hover:bg-green-200'
                              }`}
                            >
                              {user.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Pagination
                    pagination={usersPagination}
                    onPageChange={(page) => loadUsers(page)}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Sessions Tab */}
        {activeTab === 'sessions' && (
          <div className="space-y-6">
            {/* Filters */}
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="flex flex-wrap items-center gap-4">
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="px-3 py-2 text-gray-500 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Users</option>
                  {users.map(user => (
                    <option key={user.id} value={user.id}>{user.username}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Filter by model..."
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="px-3 py-2 text-gray-500 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Sessions Table */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-500">Loading sessions...</p>
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-gray-200">
                    {sessions.map(session => (
                      <li key={session.id} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <MessageSquare className="h-8 w-8 text-blue-600" />
                            </div>
                            <div className="ml-4">
                              <p className="text-sm font-medium text-gray-900">{session.title}</p>
                              <p className="text-sm text-gray-500">User: {session.username}</p>
                              <div className="flex items-center text-xs text-gray-400 mt-1">
                                <span>{session.model}</span>
                                <span className="mx-2">•</span>
                                <span>{session.message_count} messages</span>
                                <span className="mx-2">•</span>
                                <span className={session.is_closed ? 'text-red-500' : 'text-green-500'}>
                                  {session.is_closed ? 'Closed' : 'Open'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <p className="text-gray-900">Created: {formatDate(session.created_at)}</p>
                            <p className="text-gray-500">Updated: {formatDate(session.updated_at)}</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Pagination
                    pagination={sessionsPagination}
                    onPageChange={(page) => loadSessions(page)}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Files Tab */}
        {activeTab === 'files' && (
          <div className="space-y-6">
            {/* Files Table */}
            <div className="bg-white shadow overflow-hidden sm:rounded-md">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-500">Loading files...</p>
                </div>
              ) : (
                <>
                  <ul className="divide-y divide-gray-200">
                    {files.map(file => (
                      <li key={file.id} className="px-6 py-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0">
                              <FileText className="h-8 w-8 text-green-600" />
                            </div>
                            <div className="ml-4">
                              <p className="text-sm font-medium text-gray-900">{file.original_filename}</p>
                              <p className="text-sm text-gray-500">User: {file.username}</p>
                              <div className="flex items-center text-xs text-gray-400 mt-1">
                                <span>{formatBytes(file.file_size)}</span>
                                <span className="mx-2">•</span>
                                <span>{file.mime_type}</span>
                                <span className="mx-2">•</span>
                                <span className={file.file_exists ? 'text-green-500' : 'text-red-500'}>
                                  {file.file_exists ? 'Available' : 'Missing'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right text-sm">
                            <p className="text-gray-900">Uploaded: {formatDate(file.uploaded_at)}</p>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Pagination
                    pagination={filesPagination}
                    onPageChange={(page) => loadFiles(page)}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* System Tab */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            {systemInfo.error ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
                  <div>
                    <p className="text-yellow-800 font-medium">System monitoring unavailable</p>
                    <p className="text-yellow-700 text-sm mt-1">{systemInfo.error}</p>
                    {systemInfo.install_command && (
                      <p className="text-yellow-700 text-sm mt-2">
                        Install required package: <code className="bg-yellow-100 px-2 py-1 rounded">{systemInfo.install_command}</code>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : systemInfo.system ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* System Information */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">System Information</h3>
                  <dl className="space-y-3">
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500">Platform</dt>
                      <dd className="text-sm text-gray-900">{systemInfo.system.platform}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500">Architecture</dt>
                      <dd className="text-sm text-gray-900">{systemInfo.system.architecture}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500">Python Version</dt>
                      <dd className="text-sm text-gray-900">{systemInfo.system.python_version}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-sm font-medium text-gray-500">CPU Cores</dt>
                      <dd className="text-sm text-gray-900">{systemInfo.cpu.count}</dd>
                    </div>
                  </dl>
                </div>

                {/* Resource Usage */}
                <div className="bg-white p-6 rounded-lg shadow">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Resource Usage</h3>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-500">CPU Usage</span>
                        <span className="text-gray-900">{systemInfo.cpu.usage.toFixed(1)}%</span>
                      </div>
                      <div className="mt-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-blue-600 h-2 rounded-full" 
                          style={{ width: `${systemInfo.cpu.usage}%` }}
                        ></div>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-500">Memory Usage</span>
                        <span className="text-gray-900">{systemInfo.memory.percentage.toFixed(1)}%</span>
                      </div>
                      <div className="mt-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full" 
                          style={{ width: `${systemInfo.memory.percentage}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{formatBytes(systemInfo.memory.used)} used</span>
                        <span>{formatBytes(systemInfo.memory.total)} total</span>
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-gray-500">Disk Usage</span>
                        <span className="text-gray-900">{systemInfo.disk.percentage.toFixed(1)}%</span>
                      </div>
                      <div className="mt-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-orange-600 h-2 rounded-full" 
                          style={{ width: `${systemInfo.disk.percentage}%` }}
                        ></div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{formatBytes(systemInfo.disk.used)} used</span>
                        <span>{formatBytes(systemInfo.disk.total)} total</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white p-6 rounded-lg shadow">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
                  <div className="space-y-3">
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                    <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;