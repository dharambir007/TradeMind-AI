const LandingPage = () => {
  const features = [
    { icon: "⚡", title: "Real-time signals", desc: "Live entries with millisecond latency and clear confidence scores." },
    { icon: "🛡️", title: "Risk controls", desc: "Auto sizing, smart stops, and guardrails to protect every trade." },
    { icon: "📊", title: "Clean analytics", desc: "Simple performance views to spot what works and cut noise." },
  ];

  const stats = [
    { value: "87%", label: "Signal win rate" },
    { value: "150ms", label: "Avg response" },
    { value: "50K+", label: "Active traders" },
  ];

  return (
    <div className="min-h-screen bg-linear-to-b from-[#f7f9ff] via-white to-[#f7f9ff] text-slate-900 font-sans relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-20 h-64 w-64 bg-blue-200/60 blur-[120px]" />
          <div className="absolute right-4 top-10 h-52 w-52 bg-cyan-200/60 blur-[110px]" />
          <div className="absolute -right-24 bottom-10 h-72 w-72 bg-purple-200/50 blur-[130px]" />
        </div>

        {/* NAVBAR */}
        <nav className="relative border-b border-slate-200/70 bg-white/70 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-linear-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-md shadow-blue-200/80">
                <span className="text-lg font-bold text-white">TM</span>
              </div>
              <div>
                <p className="text-lg font-bold tracking-tight text-slate-900">TradeMind AI</p>
                <p className="text-xs text-slate-500">Calm, focused trading</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a href="/login" className="px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-100 transition">Login</a>
              <a href="/signup" className="px-4 py-2 rounded-lg bg-linear-to-r from-cyan-400 to-blue-500 text-white font-semibold shadow-[0_10px_30px_rgba(56,189,248,0.35)]">Get Started</a>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <header className="relative max-w-5xl mx-auto px-6 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white shadow-sm text-sm text-slate-700">
            <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
            Trusted by 50K+ traders worldwide
          </div>

          <h1 className="mt-6 text-4xl sm:text-5xl font-extrabold leading-tight tracking-tight text-slate-900">
            Trade approval
            <span className="block text-transparent bg-clip-text bg-linear-to-r from-blue-600 via-cyan-500 to-purple-500">made effortless</span>
          </h1>

          <p className="mt-4 text-lg text-slate-600 max-w-3xl mx-auto">
            Streamlined entries, clear signals, and automation you can trust—built for modern teams that need speed and control.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a href="/signup" className="px-7 py-3 rounded-xl bg-linear-to-r from-blue-600 to-cyan-500 text-white font-semibold shadow-[0_14px_40px_rgba(59,130,246,0.30)] transition-transform hover:-translate-y-0.5">
              Get Started
            </a>
            <a href="#demo" className="px-7 py-3 rounded-xl border border-slate-200 text-slate-800 hover:bg-white transition-transform hover:-translate-y-0.5">
              Watch Demo
            </a>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {stats.map((stat, i) => (
              <div key={i} className="rounded-xl border border-slate-200 bg-white px-6 py-5 text-left sm:text-center shadow-sm transition-transform hover:-translate-y-1">
                <p className="text-3xl font-semibold text-slate-900">{stat.value}</p>
                <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </header>

        {/* FEATURES */}
        <section className="relative max-w-6xl mx-auto px-6 pb-16">
          <div className="text-center mb-10">
            <p className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white text-xs uppercase tracking-[0.08em] text-slate-600">
              Features
            </p>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">Everything you need to trade with clarity</h2>
            <p className="mt-3 text-slate-600">Fast signals, safer execution, and analytics that keep you focused.</p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {features.map((f, i) => (
              <div
                key={i}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <div className="h-11 w-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-lg mb-4">{f.icon}</div>
                <h3 className="text-lg font-semibold mb-2 text-slate-900">{f.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="relative max-w-5xl mx-auto px-6 pb-14" id="demo">
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="px-8 py-12 sm:px-12 text-center">
              <p className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-100 bg-blue-50 text-xs font-semibold text-blue-700">
                Fast • Secure • Reliable
              </p>
              <h3 className="mt-5 text-3xl sm:text-4xl font-bold tracking-tight text-slate-900">Ready to transform your trading?</h3>
              <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
                Join teams using TradeMind AI for cleaner approvals, faster signals, and steady execution.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <a href="/signup" className="px-7 py-3 rounded-xl bg-linear-to-r from-blue-600 to-cyan-500 text-white font-semibold shadow-[0_14px_40px_rgba(59,130,246,0.28)] hover:-translate-y-0.5 transition-transform">
                  Create Free Account
                </a>
                <a href="/login" className="px-7 py-3 rounded-xl border border-slate-200 text-slate-800 hover:bg-slate-50 transition-transform hover:-translate-y-0.5">
                  Login
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
      <footer className="relative border-t border-slate-200 text-center py-8 text-slate-500 text-sm bg-white/70 backdrop-blur-sm">
        © 2026 TradeMind AI • Intelligent Trading Platform
      </footer>
    </div>
  );
};

export default LandingPage;
