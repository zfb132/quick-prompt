import React, { useState, useEffect, useRef } from 'react';
import { browser } from '#imports';
import { AlertCircle, CheckCircle2, Loader2, LogOut, ShieldCheck } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/common/PageHeader';
import { SectionCard } from '@/components/common/SectionCard';
import { PageSurface } from '@/components/layout/AppShell';
import { t } from '../../../utils/i18n';

interface UserInfo {
  email: string;
  name: string;
  id?: string;
}

const GoogleAuthPage: React.FC = () => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const periodicCheckerRef = useRef<number | null>(null);

  // 检查用户的登录状态
  useEffect(() => {
    checkAuthStatus();
    
    // 监听认证状态变化
    const authStatusIntervalId = monitorAuthStatus();
    
    // 设置轮询检查登录状态
    startPeriodicAuthCheck();
    
    // 在组件卸载时清除定时器
    return () => {
      stopPeriodicAuthCheck();
      
      // 清除监听认证状态的定时器
      if (authStatusIntervalId) {
        window.clearInterval(authStatusIntervalId);
      }
    };
  }, []);
  
  // 开始定期检查登录状态
  const startPeriodicAuthCheck = () => {
    // 每10秒检查一次登录状态
    periodicCheckerRef.current = window.setInterval(async () => {
      const result = await browser.storage.local.get('google_user_info');
      // 只有状态有变化时才更新
      if ((result.google_user_info && !user) || 
          (!result.google_user_info && user)) {
        console.log(t('loginStatusChanged'));
        if (result.google_user_info) {
          setUser(result.google_user_info);
          setError(null);
        } else {
          setUser(null);
        }
      }
    }, 10000);
  };
  
  // 停止定期检查
  const stopPeriodicAuthCheck = () => {
    if (periodicCheckerRef.current) {
      window.clearInterval(periodicCheckerRef.current);
      periodicCheckerRef.current = null;
    }
  };

  const checkAuthStatus = async () => {
    setIsLoading(true);
    try {
      // 从本地存储获取用户信息
      const result = await browser.storage.local.get('google_user_info');
      if (result.google_user_info) {
        setUser(result.google_user_info);
        setError(null); // 清除任何错误状态
        console.log(t('foundLoggedInUser'), result.google_user_info);
        return true;
      }
      return false;
    } catch (error) {
      console.error(t('checkAuthStatusError'), error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log(t('attemptGoogleLogin'));
      
      // 背景脚本将设置 'google_auth_status' 为 'in_progress'.
      // monitorAuthStatus 将会捕捉此状态并显示相应信息.
      await browser.runtime.sendMessage({
        action: 'authenticateWithGoogle',
        interactive: true
      });
      
      // UI更新将由monitorAuthStatus在检测到 'google_auth_status' === 'success' 时触发，
      // 然后调用 checkAuthStatus。
      // 注意：setIsLoading(false) 将由 monitorAuthStatus 或 checkAuthStatus 内部处理。

    } catch (e: any) {
      // 此处主要捕获发送消息本身的错误
      const errorMessage = e?.message || t('loginProcessError');
      setError(errorMessage);
      console.error(t('googleLoginRequestError'), e);
      setIsLoading(false); // 在发送错误时确保停止加载
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log(t('loggingOutGoogle'));
      
      // 发送登出请求
      browser.runtime.sendMessage({ action: 'logoutGoogle' }).catch(e => {
        console.error(t('logoutRequestError'), e);
      });
      
      // 创建一个登出状态检查函数，等待用户信息被清除
      const checkUntilLoggedOut = async (maxAttempts = 5) => {
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          // 等待一小段时间
          await new Promise(resolve => setTimeout(resolve, 500));
          
          // 检查用户是否已经登出
          const result = await browser.storage.local.get('google_user_info');
          if (!result.google_user_info) {
            console.log(t('confirmedLogout'));
            setUser(null);
            return true;
          }
          
          console.log(t('logoutCheckAttempt', [(attempt + 1).toString(), maxAttempts.toString()]));
        }
        
        return false;
      };
      
      // 开始检查登出状态
      const loggedOut = await checkUntilLoggedOut();
      
      if (loggedOut) {
        console.log(t('googleLogoutSuccess'));
      } else {
        // 即使检查失败，也尝试清除本地状态
        setUser(null);
        setError(t('logoutMaybeIncomplete'));
        console.warn(t('logoutProcessIncomplete'));
      }
    } catch (e: any) {
      const errorMessage = e?.message || t('logoutProcessError');
      setError(errorMessage);
      console.error(t('googleLogoutRequestError'), e);
    } finally {
      setIsLoading(false);
    }
  };
  
  // 监控认证状态变化
  const monitorAuthStatus = () => {
    // 设置状态变化检测
    const checkInterval = window.setInterval(async () => {
      try {
        const result = await browser.storage.local.get('google_auth_status');
        if (result.google_auth_status) {
          const status = result.google_auth_status.status;
          const timestamp = result.google_auth_status.timestamp;
          
          // 只处理最近5分钟内的状态更新
          const isRecent = (Date.now() - timestamp) < 5 * 60 * 1000;
          
          if (isRecent) {
            switch (status) {
              case 'in_progress':
                // isLoading 应该在 handleLogin 开始时设置，此处可选择性更新error提示
                setError(t('loginInProgress'));
                setIsLoading(true); // 确保在轮询到in_progress时也显示loading
                break;
              case 'checking_session':
                setError(t('checkingLoginSession'));
                setIsLoading(true);
                break;
              case 'success':
                await checkAuthStatus(); // 这会更新用户状态并可能设置isLoading(false)
                await browser.storage.local.remove('google_auth_status');
                setError(null); // 清除之前的提示信息
                setIsLoading(false); // 明确停止加载
                break;
              case 'failed':
                setError(t('loginFailedTryAgain'));
                await browser.storage.local.remove('google_auth_status');
                setIsLoading(false);
                break;
              case 'error':
                setError(t('loginErrorTryLater'));
                await browser.storage.local.remove('google_auth_status');
                setIsLoading(false);
                break;
            }
          }
        }
      } catch (err) {
        console.error(t('monitorAuthStatusError'), err);
        // 发生监控错误时，也应该停止加载，避免UI卡死
        // setIsLoading(false); // 考虑是否添加，可能导致错误状态下loading提前消失
      }
    }, 1000); // 每秒检查一次
    
    // 在useEffect的返回函数中会调用clearInterval
    return checkInterval;
  };

  return (
    <PageSurface className="min-h-screen">
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title={t('googleAuth')}
          description={t('googleAuthDescription')}
          icon={ShieldCheck}
        />

        <SectionCard title={t('accountAuthentication')} description={t('googleAuthDescription')}>
          <div className="mx-auto max-w-md">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
            ) : user ? (
              <div className="flex flex-col items-center rounded-2xl border border-border bg-muted/40 p-6 text-center">
                <div className="mb-3 flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/15">
                  <span className="text-2xl font-semibold">
                    {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                  </span>
                </div>
                <h3 className="font-medium text-foreground">{user.name}</h3>
                <p className="mb-4 text-sm text-muted-foreground">{user.email}</p>
                <Button
                  type="button"
                  onClick={handleLogout}
                  disabled={isLoading}
                  variant="outline"
                  className="w-full"
                >
                    <LogOut className="size-4" />
                    {t('logoutGoogle')}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                onClick={handleLogin}
                disabled={isLoading}
                className="w-full"
              >
                <span className="flex size-5 items-center justify-center rounded-full bg-background text-[11px] font-bold text-primary">
                  G
                </span>
                {t('useGoogleLogin')}
              </Button>
            )}
            
            {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </SectionCard>

        <SectionCard title={t('googleAuthExplanation')}>
          <div className="space-y-4 text-sm leading-6 text-muted-foreground">
            <p>{t('googleAuthBenefits')}</p>
            <ul className="space-y-2">
              {[t('secureCloudStorage'), t('crossDeviceAccess'), t('googleServiceIntegration')].map((item) => (
                <li key={item}>
                  <span className="inline-flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-500" />
                    {item}
                  </span>
                </li>
              ))}
            </ul>
            <p>{t('privacyAssurance')}</p>
          </div>
        </SectionCard>
      </div>
    </PageSurface>
  );
};

export default GoogleAuthPage; 
