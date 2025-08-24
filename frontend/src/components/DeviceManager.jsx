import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Monitor, Smartphone, Tablet, Trash2, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { authAPI } from '../services/api';

const DeviceManager = () => {
  const [devices, setDevices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revokingDevice, setRevokingDevice] = useState(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const [showRevokeAllDialog, setShowRevokeAllDialog] = useState(false);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await authAPI.getDevices();
      setDevices(response.data.devices || []);
    } catch (error) {
      console.error('Failed to load devices:', error);
      setError('Failed to load device sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const revokeDevice = async (sessionId) => {
    try {
      setRevokingDevice(sessionId);
      await authAPI.revokeDevice(sessionId);
      toast.success('Device session revoked');
      await loadDevices(); // Reload the list
    } catch (error) {
      console.error('Failed to revoke device:', error);
      toast.error('Failed to revoke device session');
    } finally {
      setRevokingDevice(null);
    }
  };

  const revokeAllDevices = async () => {
    try {
      setRevokingAll(true);
      await authAPI.revokeAllDevices();
      toast.success('All other device sessions revoked');
      await loadDevices(); // Reload the list
      setShowRevokeAllDialog(false);
    } catch (error) {
      console.error('Failed to revoke all devices:', error);
      toast.error('Failed to revoke device sessions');
    } finally {
      setRevokingAll(false);
    }
  };

  const getDeviceIcon = (deviceType) => {
    switch (deviceType) {
      case 'mobile':
        return <Smartphone className="h-4 w-4" />;
      case 'tablet':
        return <Tablet className="h-4 w-4" />;
      case 'desktop':
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getDeviceStatus = (device) => {
    const now = new Date();
    const lastUsed = new Date(device.last_used);
    const expiresAt = new Date(device.expires_at);
    
    if (expiresAt < now) {
      return { status: 'expired', icon: <AlertTriangle className="h-3 w-3" />, color: 'destructive' };
    } else if (device.is_remember_me) {
      return { status: 'remember-me', icon: <CheckCircle className="h-3 w-3" />, color: 'default' };
    } else {
      return { status: 'active', icon: <Clock className="h-3 w-3" />, color: 'secondary' };
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const getTimeAgo = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Device Sessions</CardTitle>
          <CardDescription>Manage your active device sessions</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Device Sessions</CardTitle>
          <CardDescription>Manage your active device sessions</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Device Sessions</CardTitle>
            <CardDescription>Manage your active device sessions</CardDescription>
          </div>
          {devices.length > 1 && (
            <Dialog open={showRevokeAllDialog} onOpenChange={setShowRevokeAllDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  Revoke All Others
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Revoke All Other Devices</DialogTitle>
                  <DialogDescription>
                    This will log out all your other devices except this one. You'll need to log in again on those devices.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setShowRevokeAllDialog(false)}>
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={revokeAllDevices}
                    disabled={revokingAll}
                  >
                    {revokingAll ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Revoking...
                      </>
                    ) : (
                      'Revoke All Others'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {devices.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No active device sessions found.
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => {
              const status = getDeviceStatus(device);
              const isCurrentDevice = device.id === localStorage.getItem('session_id');
              
              return (
                <div
                  key={device.id}
                  className={`flex items-center justify-between p-4 rounded-lg border ${
                    isCurrentDevice ? 'bg-muted/50' : 'bg-background'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      {getDeviceIcon(device.device_type)}
                      <div>
                        <div className="font-medium">
                          {device.device_name || 'Unknown Device'}
                          {isCurrentDevice && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Current
                            </Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          Last used: {getTimeAgo(device.last_used)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Expires: {formatDate(device.expires_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge variant={status.color} className="text-xs">
                      {status.icon}
                      <span className="ml-1">
                        {status.status === 'remember-me' ? 'Remember Me' : 
                         status.status === 'active' ? 'Active' : 'Expired'}
                      </span>
                    </Badge>
                    
                    {!isCurrentDevice && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => revokeDevice(device.id)}
                        disabled={revokingDevice === device.id}
                      >
                        {revokingDevice === device.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DeviceManager;