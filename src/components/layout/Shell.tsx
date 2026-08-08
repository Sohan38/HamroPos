import React from 'react';
import { TopNav } from './TopNav';
import { BottomNav } from './BottomNav';
import { DesktopSidebar } from './DesktopSidebar';
import { LicenseBanner } from '../LicenseBanner';
import { ActivationBlocker } from '../ActivationBlocker';
import { ScrollToTop } from './ScrollToTop';

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <ScrollToTop />
      <ActivationBlocker />
      <LicenseBanner />
      <TopNav />
      <div className="flex flex-1">
        <DesktopSidebar />
        <main className="flex-1 md:pl-64 pb-16 md:pb-0 w-full overflow-x-hidden">
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
