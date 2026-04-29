import React, { useState, useEffect } from 'react';
import { browser } from '#imports';
import { AlertCircle, Loader2, LogOut, User } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { t } from '../../../utils/i18n';

interface UserInfo {
  email: string;
  name: string;
  id?: string;
}

interface AuthResponse {
  success?: boolean;
  error?: string;
  data?: {
    token?: string;
    userInfo?: UserInfo;
  };
  userInfo?: UserInfo; // 兼容旧格式
}

interface GoogleAuthButtonProps {
  onAuthSuccess?: (user: { email: string; name: string }) => void;
}

const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({ onAuthSuccess }) => {
  const [user, setUser] = useState<{ email: string; name: string } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 检查是否已经登录
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    setIsLoading(true); // Set loading true when checking auth status
    try {
      const storedUserResult = await browser.storage.local.get(['googleUser', 'googleAuthToken']);
      if (storedUserResult.googleUser && storedUserResult.googleAuthToken) {
        console.log('[AUTH_BUTTON V2] Found user info and token in local storage', storedUserResult.googleUser);
        setUser(storedUserResult.googleUser as { email: string; name: string });
        if (onAuthSuccess) {
          onAuthSuccess(storedUserResult.googleUser as { email: string; name: string });
        }
      } else {
        console.log('[AUTH_BUTTON V2] No complete user info/token in local storage, attempting silent auth via background.');
        try {
          const response = await browser.runtime.sendMessage({
            action: 'authenticateWithGoogle',
            interactive: false
          });
          
          // 支持新旧两种响应格式
          const userInfo = response?.data?.userInfo || response?.userInfo;
          
          if (response && response.success && userInfo) {
            console.log('[AUTH_BUTTON V2] Silent auth via background successful:', userInfo);
            setUser(userInfo);
            if (onAuthSuccess) {
              onAuthSuccess(userInfo);
            }
            // Background script now handles storage on successful auth
          } else {
            console.warn('[AUTH_BUTTON V2] Silent auth via background failed or returned no user info:', response?.error || 'No specific error from background');
            // Ensure local state is clear if silent auth fails
            setUser(null); 
            // Background script should have cleared storage, but we can be defensive here if needed
            // await browser.storage.local.remove(['googleUser', 'googleAuthToken']);
          }
        } catch (e) {
          console.error('[AUTH_BUTTON V2] Error during sendMessage for silent auth:', e);
          setUser(null);
        }
      }
    } catch (error) {
      console.error('[AUTH_BUTTON V2] Error checking auth status (e.g., storage access issue):', error);
      setUser(null);
    } finally {
      setIsLoading(false); // Set loading false after checking auth status
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[AUTH_BUTTON V2] Attempting interactive login via background.');
      const response = await browser.runtime.sendMessage({
        action: 'authenticateWithGoogle',
        interactive: true
      });

      // 支持新旧两种响应格式
      const userInfo = response?.data?.userInfo || response?.userInfo;
      
      if (response && response.success && userInfo) {
        console.log('[AUTH_BUTTON V2] Interactive login via background successful:', userInfo);
        setUser(userInfo);
        if (onAuthSuccess) {
          onAuthSuccess(userInfo);
        }
        // Background script now handles storage on successful auth
      } else {
        const errorMessage = (response && response.error) ? String(response.error) : t('loginFailed');
        console.warn('[AUTH_BUTTON V2] Interactive login via background failed:', errorMessage);
        setError(errorMessage);
        setUser(null); // Ensure user state is cleared on failure
        // Background script should have cleared storage
      }
    } catch (e) {
      console.error('[AUTH_BUTTON V2] Error during sendMessage for interactive login:', e);
      const errorMessage = (e instanceof Error) ? e.message : String(e);
      setError(t('errorOccurred', [errorMessage]));
      setUser(null); // Ensure user state is cleared on error
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true); // Optional: show loading during logout
    setError(null);
    console.log('[AUTH_BUTTON V2] Initiating logout via background.');
    try {
      const response = await browser.runtime.sendMessage({ action: 'logoutGoogle' });
      if (response && response.success) {
        console.log('[AUTH_BUTTON V2] Logout message to background successful.');
      } else {
        console.warn('[AUTH_BUTTON V2] Logout message to background might have failed or returned unexpected response:', response);
      }
    } catch (error) {
      console.error('[AUTH_BUTTON V2] Error sending logout message to background:', error);
    } finally {
      setUser(null); // Always clear user state in UI
      setIsLoading(false);
      // Background script is responsible for clearing storage.
      // Call onAuthSuccess with null or similar if the parent component needs to react to logout.
      if (onAuthSuccess) {
        // @ts-ignore Allow passing null to onAuthSuccess if it's designed to handle it
        onAuthSuccess(null); 
      }
    }
  };

  if (user) {
    return (
      <Card className="bg-card/90">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
              <User className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-foreground">{user.name}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
          </div>
          <Button
            type="button"
            onClick={handleLogout}
            variant="outline"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            {t('logoutGoogle')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="destructive" className="py-3">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        onClick={handleLogin}
        disabled={isLoading}
        className="w-full"
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <span className="flex size-5 items-center justify-center rounded-full bg-background text-[11px] font-bold text-primary">
            G
          </span>
        )}
        {t('useGoogleLogin')}
      </Button>
    </div>
  );
};

export default GoogleAuthButton; 
