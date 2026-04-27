import React, { useState, useEffect, useRef } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Info, Loader2, X } from "lucide-react";
import { t } from '../../../utils/i18n'

export interface ToastProps {
  id?: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'loading';
  duration?: number;
  onClose?: () => void;
  error?: string;
}

const Toast: React.FC<ToastProps> = ({ 
  message, 
  type = 'info', 
  duration = 5000,
  error, 
  onClose 
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const hasDetailedError = type === 'error' && error && error !== message;

  useEffect(() => {
    if (duration !== Infinity && type !== 'loading') {
      timeoutRef.current = window.setTimeout(() => {
        setIsVisible(false);
        if (onClose) onClose();
      }, duration);
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [duration, onClose, type]);

  const handleClose = () => {
    setIsVisible(false);
    if (onClose) onClose();
  };

  const toggleExpand = () => {
    setExpanded(!expanded);
    if (!expanded && timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  if (!isVisible) return null;

  const Icon =
    type === 'success'
      ? CheckCircle2
      : type === 'error'
        ? AlertCircle
        : type === 'loading'
          ? Loader2
          : Info;

  const iconClass =
    type === 'success'
      ? 'text-emerald-600 dark:text-emerald-300 bg-emerald-500/10'
      : type === 'error'
        ? 'text-destructive bg-destructive/10'
        : type === 'loading'
          ? 'text-amber-600 dark:text-amber-300 bg-amber-500/10'
          : 'text-primary bg-primary/10';

  return (
    <div className={`mb-2 flex w-full max-w-xs flex-col rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-lg transition-all duration-300 ease-in-out ${expanded ? 'max-w-md' : ''}`} role="alert">
      <div className="flex items-center w-full">
        <div className={`inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon className={`size-5 ${type === 'loading' ? 'animate-spin' : ''}`} />
        </div>
        <div className="ml-3 text-sm font-medium">{message}</div>
        
        {hasDetailedError && (
          <button 
            onClick={toggleExpand}
            className="ml-auto inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={expanded ? t('collapseDetails') : t('showDetails')}
          >
            <span className="sr-only">{expanded ? t('collapseDetails') : t('showDetails')}</span>
            {expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </button>
        )}
        
        <button 
          type="button" 
          onClick={handleClose}
          className="ml-auto inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          aria-label={t('close')}
        >
          <span className="sr-only">{t('close')}</span>
          <X className="size-4" />
        </button>
      </div>
      
      {expanded && hasDetailedError && (
        <div className="mt-3 border-t border-border pt-2">
          <p className="max-h-40 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{error}</p>
        </div>
      )}
    </div>
  );
};

export default Toast; 
