'use client';

import { signIn } from 'next-auth/react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    if (result?.error) {
      setError('Email hoặc mật khẩu không đúng');
      setLoading(false);
    } else {
      router.push('/');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#d4c8ee]/60 via-[#f9f7fd] to-[#d4c8ee]/40 p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-3 rounded-2xl overflow-hidden shadow-md border-2 border-purple-200/80 bg-white flex items-center justify-center">
            <Image
              src="/logo.jpg"
              alt="Dota Floral Logo"
              width={80}
              height={80}
              className="w-full h-full object-cover"
              priority
            />
          </div>
          <h1 className="text-2xl font-black text-purple-950 tracking-tight">Dota Floral</h1>
          <p className="text-sm text-purple-800 font-semibold mt-1">Quản lý tiệm hoa</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white/90 backdrop-blur-md rounded-2xl shadow-xl border border-purple-200/80 p-6 space-y-4"
        >
          <div>
            <label className="block text-sm font-bold text-purple-950 mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-purple-200 px-4 py-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-shadow bg-white"
              placeholder="email@dotafloral.com"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-purple-950 mb-1.5">
              Mật khẩu
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-purple-200 px-4 py-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-shadow bg-white"
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm text-center rounded-xl py-2.5 px-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-purple-600 text-white rounded-xl py-3.5 font-bold text-base hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Đang đăng nhập...
              </span>
            ) : (
              'Đăng nhập'
            )}
          </button>
        </form>

        <p className="text-center text-xs text-purple-800 font-semibold mt-6">
          Dota Floral • TT. Bắc Hà, Lào Cai
        </p>
      </div>
    </div>
  );
}
