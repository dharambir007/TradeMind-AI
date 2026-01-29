import { useState } from 'react';
import { Link } from 'react-router-dom';

const LoginPage = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    console.log('Login attempt', form);
  };

  return (
    <div className="min-h-screen flex bg-slate-950 text-slate-50">
      {/* Left visual */}
      <div
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden"
        style={{
          backgroundImage:
            'linear-gradient(135deg, rgba(0,188,212,0.35), rgba(59,130,246,0.2)), url(https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1400&q=80)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-slate-950/50 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500/20 via-transparent to-emerald-400/10" />
        <div className="relative z-10 w-full h-full flex items-center justify-center text-center p-10">
          <div className="max-w-xl">
            <p className="text-7xl font-semibold text-cyan-100/80">TradeMind AI</p>
            <br></br>
            <h2 className="text-4xl font-black mt-3 leading-tight">Trade smarter. Move faster.</h2>
            <p className="mt-4 text-slate-100/80 text-base">
              Real-time intelligence, crisp execution, and a platform designed to keep you ahead of the market.
            </p>
          </div>
        </div>
      </div>

      {/* Right form */}
      <div className="flex-1 flex items-center justify-center px-6 py-14">
        <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl p-10 shadow-2xl shadow-cyan-900/40">
          <div className="text-center mb-8">
            <p className="text-sm font-semibold text-cyan-200/80">TradeMind AI</p>
            <h1 className="text-4xl font-bold mt-2">Welcome back</h1>
            <p className="text-base text-slate-300">Sign in to continue</p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <label className="block text-base font-semibold text-slate-200">
              Email
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-4 text-lg placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/60 outline-none"
                placeholder="you@example.com"
                required
              />
            </label>

            <label className="block text-base font-semibold text-slate-200">
              Password
              <div className="mt-2 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={form.password}
                  onChange={handleChange}
                  className="w-full rounded-2xl border border-white/10 bg-slate-800 px-4 py-4 pr-14 text-lg placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-300/60 outline-none"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-4 flex items-center text-slate-400 hover:text-slate-200 text-sm"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </label>

            <div className="pt-2" />

            <button
              type="submit"
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-emerald-500 text-white font-semibold py-4 text-lg shadow-xl shadow-cyan-500/30 hover:shadow-cyan-500/50 hover:-translate-y-0.5 transition-transform"
            >
              Sign In
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-300">
            New here? <Link to="/signup" className="text-cyan-300 font-semibold hover:text-cyan-200">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
