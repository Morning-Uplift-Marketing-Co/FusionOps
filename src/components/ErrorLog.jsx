import React, { useState, useEffect } from "react";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { LS, now } from "../utils";

const ERROR_LOG_KEY = "lpf2-error-log";

// Error logging utility
export const logError = (error, context = {}) => {
  const errorEntry = {
    id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date().toISOString(),
    message: typeof error === 'string' ? error : error.message || 'Unknown error',
    stack: error?.stack || '',
    context: {
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...context
    },
    severity: context.severity || 'error'
  };

  try {
    const existingLog = LS.get(ERROR_LOG_KEY) || [];
    existingLog.unshift(errorEntry);
    
    // Keep only last 1000 errors
    if (existingLog.length > 1000) {
      existingLog.splice(1000);
    }
    
    LS.set(ERROR_LOG_KEY, existingLog);
    console.error('[Error Log]', errorEntry);
  } catch (e) {
    console.error('Failed to log error:', e);
  }
};

export function ErrorLog() {
  const [errors, setErrors] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const loadErrors = () => {
    try {
      setErrors(LS.get(ERROR_LOG_KEY) || []);
    } catch (e) {
      console.error('Failed to load error log:', e);
    }
  };

  useEffect(() => {
    loadErrors();
    // Refresh when tab regains focus
    window.addEventListener('focus', loadErrors);
    return () => window.removeEventListener('focus', loadErrors);
  }, []);

  const filteredErrors = errors.filter(error => {
    const matchesFilter = filter === 'all' || error.severity === filter;
    const matchesSearch = !search || 
      error.message.toLowerCase().includes(search.toLowerCase()) ||
      error.context?.url?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const clearLog = () => {
    if (confirm('Clear all error logs? This cannot be undone.')) {
      LS.set(ERROR_LOG_KEY, []);
      setErrors([]);
    }
  };

  const exportLog = () => {
    const dataStr = JSON.stringify(errors, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `error-log-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'error': return 'bg-red-400';
      case 'warning': return 'bg-yellow-400';
      case 'info': return 'bg-blue-400';
      default: return 'bg-gray-400';
    }
  };

  const errorCounts = {
    all: errors.length,
    critical: errors.filter(e => e.severity === 'critical').length,
    error: errors.filter(e => e.severity === 'error').length,
    warning: errors.filter(e => e.severity === 'warning').length,
    info: errors.filter(e => e.severity === 'info').length,
  };

  return (
    <div className="animate-[fadeIn_.3s_ease]">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-[22px] font-bold m-0">Error Log</h1>
          <p className="text-[hsl(var(--muted-foreground))] text-xs mt-0.5">
            System errors and debugging information
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={loadErrors} variant="ghost" className="px-3 py-2 text-xs">
            🔄 Refresh
          </Button>
          <Button onClick={exportLog} variant="ghost" className="px-3 py-2 text-xs">
            📥 Export
          </Button>
          <Button onClick={clearLog} variant="destructive" className="px-3 py-2 text-xs">
            🗑️ Clear
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-5 gap-2.5 mb-4">
        {Object.entries(errorCounts).map(([key, count]) => (
          <Card 
            key={key}
            className={`p-3 cursor-pointer transition-all ${
              filter === key ? 'ring-2 ring-[hsl(var(--primary))]' : ''
            }`}
            onClick={() => setFilter(key)}
          >
            <div className="text-[10px] text-[hsl(var(--muted-foreground))] capitalize">
              {key === 'all' ? 'All Errors' : key}
            </div>
            <div className="text-[18px] font-bold mt-0.5">{count}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2.5 items-center mb-4">
        <input
          type="text"
          placeholder="Search errors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[hsl(var(--input))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] rounded-lg text-xs px-2.5 py-2 flex-1"
        />
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="bg-[hsl(var(--input))] border border-[hsl(var(--border))] text-[hsl(var(--foreground))] rounded-lg text-xs px-2.5 py-2 min-w-[120px]"
        >
          <option value="all">All Levels</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>
      </div>

      {/* Error List */}
      <div className="space-y-2">
        {filteredErrors.length === 0 ? (
          <Card className="p-6 text-center">
            <div className="text-[hsl(var(--muted-foreground))]">
              {search || filter !== 'all' ? 'No errors match your filters' : 'No errors logged'}
            </div>
          </Card>
        ) : (
          filteredErrors.map((error) => (
            <Card key={error.id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge 
                      className={`text-white text-xs ${getSeverityColor(error.severity)}`}
                    >
                      {error.severity.toUpperCase()}
                    </Badge>
                    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                      {formatTime(error.timestamp)}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-[hsl(var(--foreground))] mb-1">
                    {error.message}
                  </div>
                  {error.context?.url && (
                    <div className="text-[10px] text-[hsl(var(--muted-foreground))] mb-1">
                      URL: {error.context.url}
                    </div>
                  )}
                </div>
              </div>
              
              {error.stack && (
                <details className="mt-2">
                  <summary className="text-xs text-[hsl(var(--muted-foreground))] cursor-pointer hover:text-[hsl(var(--foreground))]">
                    View Stack Trace
                  </summary>
                  <pre className="text-xs bg-[hsl(var(--muted))/50] p-2 rounded mt-1 overflow-x-auto whitespace-pre-wrap">
                    {error.stack}
                  </pre>
                </details>
              )}
              
              {error.context && Object.keys(error.context).length > 1 && (
                <details className="mt-2">
                  <summary className="text-xs text-[hsl(var(--muted-foreground))] cursor-pointer hover:text-[hsl(var(--foreground))]">
                    View Context
                  </summary>
                  <pre className="text-xs bg-[hsl(var(--muted))/50] p-2 rounded mt-1 overflow-x-auto">
                    {JSON.stringify(error.context, null, 2)}
                  </pre>
                </details>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
