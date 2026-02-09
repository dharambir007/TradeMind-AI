import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const SignupPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => { setMounted(true); }, []);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (response.status === 409) {
        setError('Account already exists. Please log in. Redirecting...');
        setTimeout(() => navigate('/login', { replace: true }), 1200);
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || 'Signup failed. Please try again.');
      }

      navigate('/login');
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field) => ({
    width: '100%', padding: '14px 16px', borderRadius: '10px',
    border: `1px solid ${focusedField === field ? 'rgba(139,92,246,0.4)' : 'rgba(255,255,255,0.06)'}`,
    background: focusedField === field ? 'rgba(139,92,246,0.03)' : 'rgba(255,255,255,0.03)',
    color: '#f0f2f5', fontSize: '15px', outline: 'none',
    transition: 'all 0.3s ease',
    boxShadow: focusedField === field ? '0 0 0 3px rgba(139,92,246,0.08)' : 'none',
  });

  const fields = [
    { name: 'name', label: 'Full Name', type: 'text', auto: 'name', placeholder: 'Jane Doe' },
    { name: 'email', label: 'Email', type: 'email', auto: 'email', placeholder: 'you@example.com' },
    { name: 'password', label: 'Password', type: 'password', auto: 'new-password', placeholder: 'Min. 8 characters' },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#06080f', position: 'relative', overflow: 'hidden' }}>

      {/* Background orbs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', right: '15%', top: '10%', width: '400px', height: '400px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)',
          animation: 'orb-drift 22s ease-in-out infinite', filter: 'blur(60px)',
        }} />
        <div style={{
          position: 'absolute', left: '5%', bottom: '15%', width: '350px', height: '350px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.04) 0%, transparent 70%)',
          animation: 'orb-drift 28s ease-in-out infinite reverse', filter: 'blur(60px)',
        }} />
      </div>

      {/* Left panel — form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', zIndex: 1 }}>
        <div className={mounted ? 'animate-fade-in-up' : ''} style={{ width: '100%', maxWidth: '400px' }}>

          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #8b5cf6, #00d4ff)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(139,92,246,0.2)', marginBottom: '16px',
            }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>TM</span>
            </div>
            <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', color: '#f0f2f5' }}>Create your account</h1>
            <p style={{ fontSize: '14px', color: '#505872', marginTop: '6px' }}>Start trading with TradeMind AI</p>
          </div>

          <form onSubmit={handleSubmit}>
            {fields.map((f, i) => (
              <div key={f.name} className={mounted ? `animate-fade-in-up delay-${(i + 1) * 100}` : ''} style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#8b93a7', marginBottom: '6px' }}>{f.label}</label>
                <input
                  name={f.name} type={f.type} autoComplete={f.auto}
                  value={form[f.name]} onChange={handleChange}
                  onFocus={() => setFocusedField(f.name)} onBlur={() => setFocusedField(null)}
                  style={inputStyle(f.name)}
                  placeholder={f.placeholder} required
                />
              </div>
            ))}

            {error && (
              <div style={{
                padding: '12px 16px', borderRadius: '10px', marginBottom: '20px',
                background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.15)',
                color: '#fda4af', fontSize: '13px',
                animation: 'scaleIn 0.3s ease',
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading} className={mounted ? 'animate-fade-in-up delay-400' : ''} style={{
              width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
              background: loading ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #8b5cf6, #00d4ff)',
              color: '#fff', fontSize: '15px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 8px 30px rgba(139,92,246,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={e => { if (!loading) { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 12px 40px rgba(139,92,246,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'; }}}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 8px 30px rgba(139,92,246,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'; }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
                  </svg>
                  Creating account...
                </span>
              ) : 'Create Account'}
            </button>
          </form>

          <div style={{ margin: '28px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
            <span style={{ fontSize: '12px', color: '#3b4260' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
          </div>

          <p style={{ textAlign: 'center', fontSize: '14px', color: '#505872' }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: '#8b5cf6', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
          </p>
        </div>
      </div>

      {/* Right panel — decorative */}
      <div style={{
        display: 'none', flex: 1, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(139,92,246,0.03), rgba(0,212,255,0.03))',
        borderLeft: '1px solid rgba(255,255,255,0.03)',
      }} className="lg-show-signup">
        <style>{`@media (min-width: 1024px) { .lg-show-signup { display: flex !important; } }`}</style>

        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
          maskImage: 'radial-gradient(ellipse at 40% 50%, black 20%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 40% 50%, black 20%, transparent 70%)',
        }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', padding: '48px', textAlign: 'center' }}>
          <h2 className={mounted ? 'animate-fade-in-up delay-200' : ''} style={{
            fontSize: '38px', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1,
            background: 'linear-gradient(135deg, #f0f2f5, #8b93a7)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Join 50K+<br/>traders today
          </h2>
          <p className={mounted ? 'animate-fade-in-up delay-300' : ''} style={{ marginTop: '16px', fontSize: '15px', color: '#505872', maxWidth: '320px', lineHeight: 1.6 }}>
            Get access to institutional-grade analytics and AI-powered signals from day one.
          </p>

          {/* Feature pills */}
          <div className={mounted ? 'animate-fade-in-up delay-500' : ''} style={{ marginTop: '40px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {['Real-time market signals', 'Automated risk management', 'Advanced charting tools'].map((t, i) => (
              <div key={i} style={{
                padding: '10px 20px', borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)',
                fontSize: '13px', color: '#8b93a7',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
