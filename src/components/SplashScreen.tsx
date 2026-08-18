import { useEffect, useState, useRef } from 'react';

const MESSAGES = [
  'Initializing your workspace…',
  'Loading inventory data…',
  'Syncing location records…',
  'Preparing your dashboard…',
  'Calibrating reports engine…',
  'Almost ready…',
];

const DURATION_MS = 5000;
const TICK_MS = 900;

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [fading, setFading] = useState(false);
  const startRef = useRef(Date.now());
  const rafRef = useRef<number | null>(null);

  // Progress bar via requestAnimationFrame
  useEffect(() => {
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const pct = Math.min(elapsed / DURATION_MS, 1);
      setProgress(pct);
      if (pct < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        // Fade out then call onDone
        setFading(true);
        setTimeout(onDone, 600);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [onDone]);

  // Cycle through messages
  useEffect(() => {
    const id = setInterval(() => {
      setMsgIndex((i) => Math.min(i + 1, MESSAGES.length - 1));
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'hsl(var(--background))',
        transition: 'opacity 0.6s ease',
        opacity: fading ? 0 : 1,
        padding: '1.5rem',
        fontFamily: 'var(--app-font-sans, "Nunito", sans-serif)',
      }}
    >
      {/* Animated background orbs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute',
          top: '-20%',
          left: '-10%',
          width: '50vw',
          height: '50vw',
          maxWidth: '400px',
          maxHeight: '400px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, hsl(197 71% 35% / 0.18) 0%, transparent 70%)',
          animation: 'splashPulse 3s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '-15%',
          right: '-10%',
          width: '40vw',
          height: '40vw',
          maxWidth: '320px',
          maxHeight: '320px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, hsl(173 58% 39% / 0.12) 0%, transparent 70%)',
          animation: 'splashPulse 4s ease-in-out infinite 1s',
        }} />
      </div>

      {/* Center content */}
      <div style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2rem',
        width: '100%',
        maxWidth: '320px',
      }}>
        {/* Logo/Icon area */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* Outer ring */}
          <div style={{
            position: 'absolute',
            width: '96px',
            height: '96px',
            borderRadius: '50%',
            border: '2px solid hsl(197 71% 35% / 0.2)',
            animation: 'splashSpin 3s linear infinite',
          }} />
          {/* Spinning arc */}
          <div style={{
            position: 'absolute',
            width: '96px',
            height: '96px',
            borderRadius: '50%',
            border: '2px solid transparent',
            borderTopColor: 'hsl(197 71% 35%)',
            borderRightColor: 'hsl(197 71% 35% / 0.4)',
            animation: 'splashSpin 1.2s linear infinite',
          }} />
          {/* Center icon box */}
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '18px',
            background: 'hsl(197 71% 35%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 32px hsl(197 71% 35% / 0.35)',
          }}>
            {/* Box icon SVG */}
            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/>
              <path d="m3.3 7 8.7 5 8.7-5"/>
              <path d="M12 22V12"/>
            </svg>
          </div>
        </div>

        {/* App name */}
        <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
          <div style={{
            fontSize: '1.6rem',
            fontWeight: 800,
            color: 'hsl(var(--foreground))',
            letterSpacing: '-0.02em',
          }}>
            MeroByapar
          </div>
          <div style={{
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'hsl(197 71% 35%)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginTop: '0.2rem',
          }}>
            Business Manager
          </div>
        </div>

        {/* Animated message */}
        <div style={{
          height: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span
            key={msgIndex}
            style={{
              fontSize: '0.8rem',
              color: 'hsl(var(--muted-foreground))',
              fontWeight: 500,
              animation: 'splashFadeMsg 0.4s ease forwards',
            }}
          >
            {MESSAGES[msgIndex]}
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ width: '100%' }}>
          <div style={{
            width: '100%',
            height: '3px',
            borderRadius: '9999px',
            background: 'hsl(var(--border))',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              borderRadius: '9999px',
              background: 'linear-gradient(90deg, hsl(197 71% 35%), hsl(173 58% 39%))',
              width: `${progress * 100}%`,
              transition: 'width 0.1s linear',
              boxShadow: '0 0 8px hsl(197 71% 35% / 0.6)',
            }} />
          </div>
          <div style={{
            marginTop: '0.5rem',
            textAlign: 'right',
            fontSize: '0.7rem',
            fontWeight: 600,
            color: 'hsl(var(--muted-foreground))',
          }}>
            {Math.round(progress * 100)}%
          </div>
        </div>
      </div>

      {/* Keyframe styles injected inline */}
      <style>{`
        @keyframes splashSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes splashPulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50%       { transform: scale(1.15); opacity: 1; }
        }
        @keyframes splashFadeMsg {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
