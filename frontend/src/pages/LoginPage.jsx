import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const LoginPage = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL || '/api'}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data?.message || 'Login failed. Check your credentials and try again.';
        throw new Error(message);
      }

      if (data?.token) {
        localStorage.setItem('token', data.token);
      }

      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = (field) => ({
    width: '100%', padding: '14px 16px', borderRadius: '10px',
    border: `1px solid ${focusedField === field ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
    background: focusedField === field ? 'rgba(0,212,255,0.03)' : 'rgba(255,255,255,0.03)',
    color: '#f0f2f5', fontSize: '15px', outline: 'none',
    transition: 'all 0.3s ease',
    boxShadow: focusedField === field ? '0 0 0 3px rgba(0,212,255,0.08)' : 'none',
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: '#06080f', position: 'relative', overflow: 'hidden' }}>

      {/* Background orbs */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', left: '10%', top: '20%', width: '400px', height: '400px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,212,255,0.05) 0%, transparent 70%)',
          animation: 'orb-drift 20s ease-in-out infinite', filter: 'blur(60px)',
        }} />
        <div style={{
          position: 'absolute', right: '10%', bottom: '20%', width: '350px', height: '350px',
          borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)',
          animation: 'orb-drift 25s ease-in-out infinite reverse', filter: 'blur(60px)',
        }} />
      </div>

      {/* Left panel — branding */}
      <div style={{
        display: 'none', flex: 1, position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(0,212,255,0.03), rgba(139,92,246,0.03))',
        borderRight: '1px solid rgba(255,255,255,0.03)',
      }} className="lg-show">
        
        {/* Grid backdrop */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)`,
          backgroundSize: '50px 50px',
          maskImage: 'radial-gradient(ellipse at 60% 50%, black 20%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at 60% 50%, black 20%, transparent 70%)',
        }} />

        {/* Decorative elements */}
        <div style={{ position: 'absolute', top: '15%', left: '10%', width: '200px', height: '200px', borderRadius: '50%', border: '1px solid rgba(0,212,255,0.06)', animation: 'orb-drift 15s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: '20%', right: '15%', width: '150px', height: '150px', borderRadius: '50%', border: '1px solid rgba(139,92,246,0.06)', animation: 'orb-drift 18s ease-in-out infinite reverse' }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', padding: '48px', textAlign: 'center' }}>
          {/* Logo */}
          <div className="animate-scale-in" style={{
            width: '56px', height: '56px', borderRadius: '14px',
            background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 8px 30px rgba(0,212,255,0.2)',
            marginBottom: '32px',
          }}>
            <span style={{ fontSize: '20px', fontWeight: 800, color: '#fff' }}>TM</span>
          </div>

          <h2 className="animate-fade-in-up delay-200" style={{
            fontSize: '42px', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1,
            background: 'linear-gradient(135deg, #f0f2f5, #8b93a7)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>
            Trade smarter.<br/>Move faster.
          </h2>
          <p className="animate-fade-in-up delay-300" style={{ marginTop: '16px', fontSize: '15px', color: '#505872', maxWidth: '360px', lineHeight: 1.6 }}>
            Real-time intelligence, precision execution, and a platform built to keep you ahead.
          </p>

          {/* Floating stats */}
          <div className="animate-fade-in-up delay-500" style={{ marginTop: '48px', display: 'flex', gap: '24px' }}>
            {[{ v: '87%', l: 'Accuracy' }, { v: '150ms', l: 'Latency' }].map((s, i) => (
              <div key={i} style={{
                padding: '16px 24px', borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.05)',
                background: 'rgba(255,255,255,0.02)',
              }}>
                <p style={{ fontSize: '22px', fontWeight: 800, color: '#f0f2f5' }}>{s.v}</p>
                <p style={{ fontSize: '11px', color: '#505872', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '2px' }}>{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', zIndex: 1 }}>
        <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: '400px' }}>
          
          {/* Mobile logo */}
          <div style={{ textAlign: 'center', marginBottom: '32px' }} className="lg-hide">
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 20px rgba(0,212,255,0.2)', marginBottom: '16px',
            }}>
              <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>TM</span>
            </div>
          </div>

          <h1 style={{ fontSize: '28px', fontWeight: 800, letterSpacing: '-0.03em', color: '#f0f2f5', textAlign: 'center' }}>Welcome back</h1>
          <p style={{ fontSize: '14px', color: '#505872', textAlign: 'center', marginTop: '6px' }}>Sign in to your account</p>

          <form onSubmit={handleSubmit} style={{ marginTop: '32px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#8b93a7', marginBottom: '6px' }}>Email</label>
              <input
                name="email" type="email" autoComplete="email"
                value={form.email} onChange={handleChange}
                onFocus={() => setFocusedField('email')} onBlur={() => setFocusedField(null)}
                style={inputStyle('email')}
                placeholder="you@example.com" required
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#8b93a7', marginBottom: '6px' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                  value={form.password} onChange={handleChange}
                  onFocus={() => setFocusedField('password')} onBlur={() => setFocusedField(null)}
                  style={{ ...inputStyle('password'), paddingRight: '54px' }}
                  placeholder="Enter password" required
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} style={{
                  position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', color: '#505872', fontSize: '12px',
                  cursor: 'pointer', fontWeight: 500, transition: 'color 0.2s',
                }} onMouseEnter={e => e.target.style.color = '#8b93a7'} onMouseLeave={e => e.target.style.color = '#505872'}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{
                padding: '12px 16px', borderRadius: '10px', marginBottom: '20px',
                background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.15)',
                color: '#fda4af', fontSize: '13px',
                animation: 'scaleIn 0.3s ease',
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '14px', borderRadius: '10px', border: 'none',
              background: loading ? 'rgba(255,255,255,0.06)' : 'linear-gradient(135deg, #00d4ff, #8b5cf6)',
              color: '#fff', fontSize: '15px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 8px 30px rgba(0,212,255,0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
              transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              opacity: loading ? 0.6 : 1,
            }}
            onMouseEnter={e => { if (!loading) { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 12px 40px rgba(0,212,255,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'; }}}
            onMouseLeave={e => { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 8px 30px rgba(0,212,255,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'; }}
            >
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" opacity="0.25" /><path d="M12 2a10 10 0 0 1 10 10" opacity="0.75" />
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ margin: '28px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
            <span style={{ fontSize: '12px', color: '#3b4260' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
          </div>

          <p style={{ textAlign: 'center', fontSize: '14px', color: '#505872' }}>
            New here?{' '}
            <Link to="/signup" style={{
              color: '#00d4ff', fontWeight: 600, textDecoration: 'none',
              transition: 'color 0.2s',
            }}>Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
