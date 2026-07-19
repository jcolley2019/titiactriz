import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { Menu, Lock, LayoutDashboard, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { setLanguage } from '@/i18n';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface LanguageToggleProps {
  variant?: 'default' | 'light' | 'greenworld';
}

const LanguageToggle = ({ variant = 'default' }: LanguageToggleProps) => {
  const { i18n, t } = useTranslation();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (mounted) setSession(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const isEn = i18n.language?.startsWith('en');

  const setLang = (lng: 'en' | 'es') => setLanguage(lng);

  const triggerClasses =
    variant === 'light'
      ? 'text-white/80 hover:text-white hover:bg-white/10'
      : variant === 'greenworld'
        ? 'text-gw-green-dark hover:text-gw-green hover:bg-gw-green/10'
        : 'text-muted-foreground hover:text-foreground';

  const goAdmin = () => navigate('/admin');
  const signOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-qa="lang-menu-trigger"
          className={`gap-2 ${triggerClasses}`}
          aria-label={t('nav.menu', 'Menu')}
        >
          <Menu className="w-5 h-5" />
          <span className="sr-only">{t('nav.menu', 'Menu')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[13rem]">
        <DropdownMenuLabel className="text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground font-normal">
          {t('nav.language', 'Language')}
        </DropdownMenuLabel>
        <div className="px-2 pb-2 pt-1">
          <div
            role="group"
            translate="no"
            aria-label={t('nav.switchLanguage', 'Switch language')}
            className="notranslate flex rounded-md border border-border overflow-hidden text-xs font-semibold tracking-[0.2em]"
          >
            {(['es', 'en'] as const).map((lng) => {
              const active = lng === 'en' ? isEn : !isEn;
              return (
                <button
                  key={lng}
                  type="button"
                  data-qa={`lang-${lng}`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setLang(lng);
                  }}
                  className={`flex-1 px-3 py-1.5 uppercase transition-colors ${
                    active
                      ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
                      : 'bg-transparent text-muted-foreground hover:bg-[hsl(var(--accent))]/10 hover:text-foreground'
                  }`}
                  aria-pressed={active}
                >
                  {lng}
                </button>
              );
            })}
          </div>
        </div>

        <DropdownMenuSeparator />
        {session ? (
          <>
            <DropdownMenuItem onSelect={goAdmin} className="cursor-pointer">
              <LayoutDashboard className="w-3.5 h-3.5 mr-2" />
              {t('nav.admin', 'Admin')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={signOut} className="cursor-pointer">
              <LogOut className="w-3.5 h-3.5 mr-2" />
              {t('nav.signOut', 'Log out')}
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onSelect={goAdmin} className="cursor-pointer">
            <Lock className="w-3.5 h-3.5 mr-2" />
            {t('nav.adminLogin', 'Admin Login')}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageToggle;
