import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { User, Mail, Lock, Loader2, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Register() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { register, isLoading } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    const result = await register(username, email, password);
    if (result.success) {
      toast.success('Account created successfully');
      navigate('/');
    } else {
      toast.error(result.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 bg-[#0a0a0f]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/30 via-[#0a0a0f] to-[#0a0a0f]"></div>
        
        {/* Floating shapes */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-[120px] animate-pulse [animation-delay:1s]"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 rounded-full blur-[150px]"></div>
        
        {/* Grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
      </div>
      
      {/* Register Card */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="bg-[#12121a]/80 backdrop-blur-2xl rounded-3xl border border-[#ffffff08] shadow-[0_0_60px_rgba(99,102,241,0.15),inset_0_0_60px_rgba(99,102,241,0.03)]">
          
          {/* Header */}
          <div className="text-center pt-10 pb-8">
            {/* Logo */}
            <div className="relative inline-flex mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-2xl blur-lg opacity-50"></div>
              <div className="relative w-16 h-16 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl flex items-center justify-center">
                <MessageSquare className="w-8 h-8 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Create Account</h1>
            <p className="text-[#8b8b9e]">Join us and start chatting</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-10 pb-10 space-y-5">
            {/* Username Input */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-xl opacity-0 group-focus-within:opacity-20 transition-opacity duration-300"></div>
              <div className="relative flex items-center bg-[#1a1a24]/50 rounded-xl border border-[#ffffff08] group-focus-within:border-indigo-500/50 transition-all duration-300">
                <div className="pl-4 text-[#6b6b7b]">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Username"
                  className="w-full py-4 px-4 bg-transparent text-white placeholder-[#6b6b7b] focus:outline-none"
                  required
                  minLength={3}
                />
              </div>
            </div>

            {/* Email Input */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-xl opacity-0 group-focus-within:opacity-20 transition-opacity duration-300"></div>
              <div className="relative flex items-center bg-[#1a1a24]/50 rounded-xl border border-[#ffffff08] group-focus-within:border-indigo-500/50 transition-all duration-300">
                <div className="pl-4 text-[#6b6b7b]">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full py-4 px-4 bg-transparent text-white placeholder-[#6b6b7b] focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-xl opacity-0 group-focus-within:opacity-20 transition-opacity duration-300"></div>
              <div className="relative flex items-center bg-[#1a1a24]/50 rounded-xl border border-[#ffffff08] group-focus-within:border-indigo-500/50 transition-all duration-300">
                <div className="pl-4 text-[#6b6b7b]">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full py-4 px-4 bg-transparent text-white placeholder-[#6b6b7b] focus:outline-none"
                  required
                  minLength={6}
                />
              </div>
            </div>

            {/* Confirm Password Input */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-xl opacity-0 group-focus-within:opacity-20 transition-opacity duration-300"></div>
              <div className="relative flex items-center bg-[#1a1a24]/50 rounded-xl border border-[#ffffff08] group-focus-within:border-indigo-500/50 transition-all duration-300">
                <div className="pl-4 text-[#6b6b7b]">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                  className="w-full py-4 px-4 bg-transparent text-white placeholder-[#6b6b7b] focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500 hover:from-indigo-600 hover:via-purple-600 hover:to-violet-600 text-white font-semibold rounded-xl transition-all duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.4)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 my-6">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#ffffff10] to-transparent"></div>
              <span className="text-[#6b6b7b] text-sm">or</span>
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#ffffff10] to-transparent"></div>
            </div>

            {/* Login Link */}
            <p className="text-center text-[#8b8b9e]">
              Already have an account?{' '}
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-[#6b6b7b] text-sm mt-6">
          By signing up, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
}
      
