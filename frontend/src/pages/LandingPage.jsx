import { useState, useEffect, useRef } from 'react';

const LandingPage = () => {
  const [scrollY, setScrollY] = useState(0);
  const [visible, setVisible] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    setVisible(true);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      ),
      title: "Real-time Signals",
      desc: "Live trade entries with sub-millisecond latency and precision confidence scoring across all major markets.",
      accent: "#00d4ff",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      ),
      title: "Risk Controls",
      desc: "Automated position sizing, intelligent stop-losses, and portfolio guardrails protecting every trade you make.",
      accent: "#8b5cf6",
    },
    {
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
        </svg>
      ),
      title: "Clean Analytics",
      desc: "Distilled performance dashboards that surface what matters and eliminate noise from your trading workflow.",
      accent: "#10b981",
    },
  ];

  const stats = [
    { value: "87%", label: "Signal Accuracy", suffix: "" },
    { value: "150", label: "Avg Response", suffix: "ms" },
    { value: "50K", label: "Active Traders", suffix: "+" },
  ];

  const logos = ["Bloomberg", "Reuters", "NASDAQ", "NYSE", "NSE"];

  return (
    <div style={{ minHeight: '100vh', background: '#06080f', color: '#f0f2f5', fontFamily: "'Inter', system-ui, sans-serif", position: 'relative', overflow: 'hidden' }}>

      {/* Background orbs */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
        <div style={{
          position: 'absolute', left: '-10%', top: '-5%', width: '500px', height: '500px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.06) 0%, transparent 70%)',
          animation: 'orb-drift 20s ease-in-out infinite', filter: 'blur(40px)',
        }} />
        <div style={{
          position: 'absolute', right: '-5%', top: '30%', width: '400px', height: '400px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)',
          animation: 'orb-drift 25s ease-in-out infinite reverse', filter: 'blur(40px)',
        }} />
        <div style={{
          position: 'absolute', left: '40%', bottom: '-10%', width: '600px', height: '600px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(16,185,129,0.04) 0%, transparent 70%)',
          animation: 'orb-drift 30s ease-in-out infinite', filter: 'blur(60px)',
        }} />
        {/* Grid pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
        }} />
      </div>

      {/* Navigation */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        background: 'rgba(6, 8, 15, 0.8)',
        backdropFilter: 'blur(20px) saturate(1.2)',
      }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '64px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(0,212,255,0.2)',
            }}>
              <span style={{ fontSize: '14px', fontWeight: 800, color: '#fff' }}>TM</span>
            </div>
            <span style={{ fontSize: '16px', fontWeight: 700, color: '#f0f2f5', letterSpacing: '-0.02em' }}>TradeMind</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <a href="/login" style={{
              padding: '8px 18px', borderRadius: '8px', fontSize: '14px', fontWeight: 500,
              color: '#8b93a7', border: '1px solid transparent',
              textDecoration: 'none', transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { e.target.style.color = '#f0f2f5'; e.target.style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { e.target.style.color = '#8b93a7'; e.target.style.background = 'transparent'; }}
            >Sign in</a>
            <a href="/signup" style={{
              padding: '8px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 600,
              color: '#fff', textDecoration: 'none',
              background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
              boxShadow: '0 4px 20px rgba(0,212,255,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 8px 30px rgba(0,212,255,0.35), inset 0 1px 0 rgba(255,255,255,0.1)'; }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 20px rgba(0,212,255,0.25), inset 0 1px 0 rgba(255,255,255,0.1)'; }}
            >Get Started</a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header ref={heroRef} style={{ position: 'relative', zIndex: 1, maxWidth: '1000px', margin: '0 auto', padding: '80px 24px 40px', textAlign: 'center' }}>
        {/* Status badge */}
        <div className={visible ? 'animate-fade-in-up' : ''} style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '6px 14px', borderRadius: '100px',
          border: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.03)',
          fontSize: '13px', color: '#8b93a7',
          animationDelay: '0.1s',
        }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: '#10b981',
            boxShadow: '0 0 8px rgba(16,185,129,0.5)',
            animation: 'pulse-glow 2s ease infinite',
          }} />
          Trusted by 50K+ traders worldwide
        </div>

        {/* Headline */}
        <h1 className={visible ? 'animate-fade-in-up delay-200' : ''} style={{
          marginTop: '28px', fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 800,
          lineHeight: 1.08, letterSpacing: '-0.035em', color: '#f0f2f5',
        }}>
          Trade with
          <span style={{
            display: 'block',
            background: 'linear-gradient(135deg, #00d4ff 0%, #8b5cf6 50%, #f43f5e 100%)',
            backgroundSize: '200% 200%',
            animation: 'gradient-shift 6s ease infinite',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            machine precision
          </span>
        </h1>

        {/* Subtext */}
        <p className={visible ? 'animate-fade-in-up delay-300' : ''} style={{
          marginTop: '20px', fontSize: '17px', lineHeight: 1.65, color: '#6b7394',
          maxWidth: '540px', margin: '20px auto 0',
        }}>
          AI-powered trade signals, automated risk management, and institutional-grade analytics — designed for traders who demand precision.
        </p>

        {/* CTAs */}
        <div className={visible ? 'animate-fade-in-up delay-400' : ''} style={{ marginTop: '36px', display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <a href="/signup" style={{
            padding: '14px 32px', borderRadius: '12px', fontSize: '15px', fontWeight: 600,
            color: '#fff', textDecoration: 'none',
            background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
            boxShadow: '0 8px 30px rgba(0,212,255,0.25), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 14px 40px rgba(0,212,255,0.35), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)'; }}
          onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 8px 30px rgba(0,212,255,0.25), 0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)'; }}
          >Start Trading Free</a>
          <a href="#features" style={{
            padding: '14px 32px', borderRadius: '12px', fontSize: '15px', fontWeight: 500,
            color: '#8b93a7', textDecoration: 'none',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onMouseEnter={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.color = '#f0f2f5'; e.target.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.color = '#8b93a7'; e.target.style.transform = 'translateY(0)'; }}
          >Watch Demo</a>
        </div>

        {/* Stats */}
        <div className={visible ? 'animate-fade-in-up delay-500' : ''} style={{ marginTop: '56px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', maxWidth: '600px', margin: '56px auto 0' }}>
          {stats.map((stat, i) => (
            <div key={i} style={{
              padding: '20px 16px', borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.05)',
              background: 'rgba(255,255,255,0.02)',
              transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              cursor: 'default',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.borderColor = 'rgba(0,212,255,0.15)'; e.currentTarget.style.transform = 'translateY(-3px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <p style={{
                fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em',
                background: 'linear-gradient(135deg, #f0f2f5, #8b93a7)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
              }}>{stat.value}<span style={{ fontSize: '16px', fontWeight: 500 }}>{stat.suffix}</span></p>
              <p style={{ fontSize: '12px', color: '#505872', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 500 }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </header>

      {/* Trusted by bar */}
      <div style={{ position: 'relative', zIndex: 1, marginTop: '40px', padding: '24px 0', borderTop: '1px solid rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#3b4260', marginBottom: '16px', fontWeight: 500 }}>Integrated with leading platforms</p>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '48px', flexWrap: 'wrap', opacity: 0.3 }}>
            {logos.map((l, i) => (
              <span key={i} style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '0.05em', color: '#505872' }}>{l}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section id="features" style={{ position: 'relative', zIndex: 1, maxWidth: '1100px', margin: '0 auto', padding: '80px 24px 60px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p style={{
            display: 'inline-block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em',
            padding: '6px 14px', borderRadius: '100px',
            border: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)',
            color: '#6b7394', fontWeight: 600,
          }}>Features</p>
          <h2 style={{ marginTop: '16px', fontSize: 'clamp(24px, 3vw, 36px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f0f2f5' }}>
            Everything you need to<br/>trade with clarity
          </h2>
          <p style={{ marginTop: '12px', fontSize: '15px', color: '#505872', maxWidth: '480px', margin: '12px auto 0' }}>
            Built from the ground up for traders who value precision over noise.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
          {features.map((f, i) => (
            <div key={i} className={visible ? `animate-fade-in-up delay-${(i + 3) * 100}` : ''} style={{
              padding: '28px', borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.04)',
              background: 'rgba(255,255,255,0.015)',
              transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
              cursor: 'default', position: 'relative', overflow: 'hidden',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = `${f.accent}20`;
              e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.boxShadow = `0 20px 50px rgba(0,0,0,0.3), 0 0 50px ${f.accent}08`;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.04)';
              e.currentTarget.style.background = 'rgba(255,255,255,0.015)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
            }}
            >
              {/* Glow dot */}
              <div style={{
                position: 'absolute', top: '-50px', right: '-50px', width: '120px', height: '120px',
                borderRadius: '50%', background: `radial-gradient(circle, ${f.accent}08 0%, transparent 70%)`,
                pointerEvents: 'none',
              }} />
              <div style={{
                width: '40px', height: '40px', borderRadius: '10px',
                background: `${f.accent}10`, color: f.accent,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '16px',
              }}>{f.icon}</div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#f0f2f5', marginBottom: '8px', letterSpacing: '-0.01em' }}>{f.title}</h3>
              <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#6b7394' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: '900px', margin: '0 auto', padding: '40px 24px 80px' }} id="demo">
        <div style={{
          borderRadius: '20px', position: 'relative', overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.06)',
          background: 'linear-gradient(135deg, rgba(0,212,255,0.03) 0%, rgba(139,92,246,0.03) 100%)',
          padding: '60px 40px', textAlign: 'center',
        }}>
          {/* Top glow */}
          <div style={{
            position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
            width: '300px', height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.4), transparent)',
          }} />
          <p style={{
            display: 'inline-block', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.12em',
            padding: '6px 14px', borderRadius: '100px',
            border: '1px solid rgba(0,212,255,0.1)', background: 'rgba(0,212,255,0.05)',
            color: '#00d4ff', fontWeight: 600, marginBottom: '20px',
          }}>Launch Offer</p>
          <h3 style={{ fontSize: 'clamp(24px, 3vw, 34px)', fontWeight: 800, letterSpacing: '-0.03em', color: '#f0f2f5' }}>
            Ready to transform your trading?
          </h3>
          <p style={{ marginTop: '12px', fontSize: '15px', color: '#505872', maxWidth: '440px', margin: '12px auto 0' }}>
            Join thousands of traders using AI-powered signals to make smarter decisions, faster.
          </p>
          <div style={{ marginTop: '32px', display: 'flex', justifyContent: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <a href="/signup" style={{
              padding: '14px 32px', borderRadius: '12px', fontSize: '15px', fontWeight: 600,
              color: '#fff', textDecoration: 'none',
              background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
              boxShadow: '0 8px 30px rgba(0,212,255,0.25), inset 0 1px 0 rgba(255,255,255,0.15)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={e => { e.target.style.transform = 'translateY(-2px)'; e.target.style.boxShadow = '0 14px 40px rgba(0,212,255,0.35), inset 0 1px 0 rgba(255,255,255,0.15)'; }}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 8px 30px rgba(0,212,255,0.25), inset 0 1px 0 rgba(255,255,255,0.15)'; }}
            >Create Free Account</a>
            <a href="/login" style={{
              padding: '14px 32px', borderRadius: '12px', fontSize: '15px', fontWeight: 500,
              color: '#8b93a7', textDecoration: 'none',
              border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={e => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.color = '#f0f2f5'; }}
            onMouseLeave={e => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.color = '#8b93a7'; }}
            >Sign In</a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        position: 'relative', zIndex: 1,
        borderTop: '1px solid rgba(255,255,255,0.04)',
        padding: '24px 0', textAlign: 'center',
        background: 'rgba(6, 8, 15, 0.9)',
      }}>
        <p style={{ fontSize: '13px', color: '#3b4260' }}>© 2026 TradeMind AI — Intelligent Trading Platform</p>
      </footer>
    </div>
  );
};

export default LandingPage;
