import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Mail, Lock, Loader2, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email, password);
    if (result.success) {
      toast.success('Welcome back!');
      navigate('/');
    } else {
      toast.error(result.message || 'Login failed');
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#eef7f0]">
      <div className="pointer-events-none absolute -left-28 top-8 h-64 w-64 rounded-full bg-emerald-300/45 blur-3xl"></div>
      <div className="pointer-events-none absolute -right-20 top-24 h-72 w-72 rounded-full bg-fuchsia-300/35 blur-3xl"></div>
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-sky-300/30 blur-3xl"></div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid w-full overflow-hidden rounded-[32px] border border-white/80 bg-white/80 shadow-[0_30px_90px_rgba(15,48,30,0.2)] backdrop-blur-xl md:grid-cols-2">
          <section className="relative hidden min-h-[560px] md:block">
            <div className="absolute inset-0 bg-gradient-to-br from-[#0f9f64] via-[#0c7d58] to-[#1f8a9b]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,122,89,0.45),transparent_44%)]"></div>
            <div className="absolute inset-0 bg-[linear-gradient(160deg,rgba(255,255,255,0.14),transparent_42%)]"></div>

            <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Social + Chat
                </p>
                <h2 className="mt-6 max-w-sm text-4xl font-semibold leading-tight">
                  Feel like Instagram. Chat like WhatsApp.
                </h2>
                <p className="mt-3 max-w-sm text-sm text-emerald-50/90">
                  Fast one-to-one conversations with a familiar social feel, focused on clarity and speed.
                </p>
              </div>

              <div className="space-y-3">
                <div className="max-w-[260px] rounded-2xl rounded-bl-md bg-white/20 px-4 py-3 text-sm backdrop-blur">
                  Hey, ready for the team sync in 5?
                </div>
                <div className="ml-auto max-w-[260px] rounded-2xl rounded-br-md bg-white px-4 py-3 text-sm text-emerald-900">
                  Yes, sending updates now.
                </div>
                <div className="max-w-[240px] rounded-2xl rounded-bl-md bg-white/20 px-4 py-3 text-sm backdrop-blur">
                  Perfect. See you there.
                </div>
              </div>
            </div>
          </section>

          <section className="relative bg-white/95 p-6 sm:p-10 lg:p-12">
            <div className="mx-auto w-full max-w-md">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-fuchsia-500 p-[2px] shadow-[0_10px_30px_rgba(15,185,129,0.35)]">
                  <div className="rounded-2xl bg-white p-3">
                    <MessageCircle className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium text-emerald-700">ChatApp</p>
                  <p className="text-xs text-slate-500">Real-time conversations</p>
                </div>
              </div>

              <div className="mt-8">
                <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Sign in</h1>
                <p className="mt-2 text-sm text-slate-600">
                  Continue your conversations with a cleaner social messaging flow.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
                  <div className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 transition-all duration-200 focus-within:border-emerald-500 focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]">
                    <Mail className="h-4.5 w-4.5 text-slate-400 group-focus-within:text-emerald-600" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl bg-transparent py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      required
                    />
                  </div>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-700">Password</span>
                  <div className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 transition-all duration-200 focus-within:border-emerald-500 focus-within:shadow-[0_0_0_4px_rgba(16,185,129,0.15)]">
                    <Lock className="h-4.5 w-4.5 text-slate-400 group-focus-within:text-emerald-600" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full rounded-xl bg-transparent py-3 text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      required
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-fuchsia-500 px-4 py-3.5 font-semibold text-white transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_35px_rgba(20,184,166,0.35)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Signing in...
                    </>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>

              <div className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/70 px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                  <ShieldCheck className="h-4.5 w-4.5" />
                  End-to-end safe session handling
                </p>
              </div>

              <p className="mt-6 text-center text-sm text-slate-600">
                Do not have an account?{' '}
                <Link to="/register" className="font-semibold text-emerald-700 hover:text-emerald-600">
                  Create one
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
