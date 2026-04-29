import React, { useState, useEffect } from 'react';
import { browser } from '#imports';
import { ExternalLink, Keyboard, Languages, MousePointerClick, Settings2 } from "lucide-react";
import { getGlobalSettings, updateGlobalSettings, type GlobalSettings } from '@/utils/globalSettings';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { LoadingState } from "@/components/common/LoadingState";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { SettingsRow } from "@/components/common/SettingsRow";
import { PageSurface } from "@/components/layout/AppShell";
import { cn } from "@/lib/utils";
import { t, initLocale, setLocale, getCurrentLocale, SUPPORTED_LOCALES } from '@/utils/i18n';

const GlobalSettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<GlobalSettings>({
    closeModalOnOutsideClick: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [shortcuts, setShortcuts] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    const loadSettings = async () => {
      try {
        setIsLoading(true);
        const globalSettings = await getGlobalSettings();
        setSettings(globalSettings);
        await initLocale();

        try {
          const commands = await browser.commands.getAll();
          const shortcutMap: { [key: string]: string } = {};
          commands.forEach(command => {
            if (command.name && command.shortcut) {
              shortcutMap[command.name] = command.shortcut;
            }
          });
          setShortcuts(shortcutMap);
        } catch (error) {
          console.warn('Unable to get shortcuts:', error);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleSettingChange = async (key: keyof GlobalSettings, value: any) => {
    try {
      setIsSaving(true);
      const newSettings = { ...settings, [key]: value };
      setSettings(newSettings);
      await updateGlobalSettings({ [key]: value });
    } catch (error) {
      console.error('Failed to update setting:', error);
      setSettings(prev => ({ ...prev, [key]: settings[key] }));
    } finally {
      setIsSaving(false);
    }
  };

  const openShortcutSettings = () => {
    const isChrome = navigator.userAgent.includes('Chrome');
    const isFirefox = navigator.userAgent.includes('Firefox');

    if (isChrome) {
      browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
    } else if (isFirefox) {
      browser.tabs.create({ url: 'about:addons' });
    } else {
      alert(t('pleaseManuallyNavigateToShortcuts'));
    }
  };

  if (isLoading) {
    return (
      <PageSurface>
        <LoadingState title={t('loading')} description={t('loadingGlobalSettings')} />
      </PageSurface>
    );
  }

  return (
    <PageSurface>
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
        <PageHeader
          icon={Settings2}
          title={t('globalSettings')}
          description={t('globalSettingsDescription')}
        />

        <SectionCard contentClassName="divide-y divide-border p-0">
          <SettingsRow
            title={t('languageLabel')}
            description={t('languageDescription')}
            control={
              <div className="flex overflow-hidden rounded-xl border border-border bg-muted p-1">
                {SUPPORTED_LOCALES.map((locale) => {
                  const isActive = (settings.language || getCurrentLocale()) === locale.code;
                  return (
                    <Button
                      key={locale.code}
                      type="button"
                      size="sm"
                      variant={isActive ? "default" : "ghost"}
                      disabled={isSaving}
                      onClick={async () => {
                        if (isActive || isSaving) return;
                        await handleSettingChange('language', locale.code);
                        setLocale(locale.code);
                        window.location.reload();
                      }}
                      className="rounded-lg"
                    >
                      <Languages className="size-3.5" />
                      {locale.label}
                    </Button>
                  );
                })}
              </div>
            }
          />

          <SettingsRow
            title={t('closeModalOnOutsideClick')}
            description={t('closeModalOnOutsideClickDescription')}
            control={
              <Switch
                checked={settings.closeModalOnOutsideClick}
                disabled={isSaving}
                onCheckedChange={(checked) => handleSettingChange('closeModalOnOutsideClick', checked)}
                aria-label={t('closeModalOnOutsideClick')}
              />
            }
          />

          <div className="px-5 py-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Keyboard className="size-4 text-primary" />
                <h3 className="text-sm font-medium text-foreground">{t('keyboardShortcuts')}</h3>
              </div>
              <Button onClick={openShortcutSettings} variant="outline" size="sm">
                {t('manageShortcuts')}
                <ExternalLink className="size-3.5" />
              </Button>
            </div>
            <div className="space-y-2">
              {[
                { key: 'open-prompt-selector', label: t('openPromptSelector'), icon: MousePointerClick },
                { key: 'save-selected-prompt', label: t('saveSelectedPrompt'), icon: Keyboard },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={openShortcutSettings}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2 text-left transition-colors hover:bg-muted"
                >
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon className="size-4" />
                    {label}
                  </span>
                  {shortcuts[key] ? (
                    <span className="flex items-center gap-1">
                      {shortcuts[key].split('+').map((part, i) => (
                        <React.Fragment key={`${key}-${part}-${i}`}>
                          {i > 0 && <span className="text-xs text-muted-foreground">+</span>}
                          <kbd className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] font-semibold text-foreground shadow-sm">
                            {part}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </span>
                  ) : (
                    <Badge variant="muted">{t('notSet')}</Badge>
                  )}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        {isSaving && (
          <>
            <Separator />
            <p className={cn("text-center text-xs text-muted-foreground")}>{t('saving')}</p>
          </>
        )}
      </div>
    </PageSurface>
  );
};

export default GlobalSettingsPage; 
