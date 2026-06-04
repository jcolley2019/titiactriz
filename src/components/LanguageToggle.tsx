import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { Menu, Lock, LayoutDashboard, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
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
  const nextLang = isEn ? 'es' : 'en';

  const toggleLanguage = () => {
    i18n.changeLanguage(nextLang);
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'light':
        return 'text-white/80 hover:text-white hover:bg-white/10';
      case 'greenworld':
        return 'text-gw-green-dark hover:text-gw-green hover:bg-gw-green/10';
      default:
        return 'text-muted-foreground hover:text-foreground';
    }
  };

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
          className={`gap-2 ${getVariantClasses()}`}
          aria-label={t('nav.menu', 'Menu')}
        >
          <Menu className="w-5 h-5" />
          <span className="sr-only">{t('nav.menu', 'Menu')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[12rem]">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          {t('nav.language', 'Language')}
        </DropdownMenuLabel>
        <div className="px-2 py-1.5">
          <button
            type="button"
            onClick={toggleLanguage}
            className="w-full inline-flex items-center justify-between rounded-md border border-border bg-background/40 px-1 py-1 text-xs font-medium tracking-wider"
            aria-label={t('nav.switchLanguage', 'Switch language')}
          >
            <span
              className={`flex-1 px-3 py-1 rounded-sm transition-colors ${
                isEn
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
                  : 'text-muted-foreground'
              }`}
            >
              EN
            </span>
            <span
              className={`flex-1 px-3 py-1 rounded-sm transition-colors ${
                !isEn
                  ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
                  : 'text-muted-foreground'
              }`}
            >
              ES
            </span>
          </button>
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
