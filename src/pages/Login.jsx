import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, Eye, EyeOff, Loader, CheckCircle, Shield } from 'lucide-react';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remember, setRemember] = useState(false);
  const { login, ssoLogin, ssoLoading } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await login(email, password);
    setLoading(false);
    if (!res.success) setError(res.message || 'Invalid credentials. Please try again.');
  };

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100vw',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      overflow: 'hidden', background: '#F8FAFC',
    }}>
      {/* ───── LEFT PANEL (60%) ───── */}
      <div className="login-left" style={{
        flex: '0 0 60%', position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, #F8FAFC 0%, #EFF6FF 40%, #DBEAFE 70%, #BFDBFE 100%)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '0 80px',
      }}>
        {/* Abstract decorative elements */}
        <div style={{
          position: 'absolute', top: '-120px', right: '-120px',
          width: '500px', height: '500px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-80px', left: '-80px',
          width: '400px', height: '400px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '30%', right: '15%',
          width: '200px', height: '200px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(37,99,235,0.04) 0%, transparent 70%)',
          pointerEvents: 'none', filter: 'blur(40px)',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(37,99,235,0.03) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 560 }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.12)',
            borderRadius: 100, padding: '6px 16px 6px 6px', marginBottom: 32, fontSize: 13, fontWeight: 500, color: '#1D4ED8',
          }}>
            <span style={{
              background: '#2563EB', color: '#fff', borderRadius: 100, padding: '2px 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.5px',
            }}>v2.5.0</span>
            Enterprise CRM Platform
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize: 44, fontWeight: 800, color: '#111827', lineHeight: 1.15, letterSpacing: '-0.03em', margin: 0,
          }}>
            Manage Your Sales Team{' '}
            <span style={{ background: 'linear-gradient(135deg, #2563EB, #1D4ED8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Smarter.
            </span>
          </h1>
          <p style={{ fontSize: 17, color: '#6B7280', lineHeight: 1.6, marginTop: 16, maxWidth: 480 }}>
            Track calls, manage prospects, monitor team performance, and grow revenue — all from one powerful CRM.
          </p>

          {/* Feature Cards */}
          <div style={{ display: 'flex', gap: 12, marginTop: 40 }}>
            {[
              { icon: CheckCircle, title: 'Team Performance', desc: 'Real-time KPI dashboards & leaderboards' },
              { icon: CheckCircle, title: 'Pipeline Tracking', desc: 'End-to-end sales prospect management' },
              { icon: CheckCircle, title: 'Analytics', desc: 'Conversion metrics & revenue insights' },
            ].map((f, i) => (
              <div key={i} style={{
                flex: 1, background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.8)', borderRadius: 16, padding: '20px 16px',
                boxShadow: '0 2px 8px rgba(15,23,42,0.04)',
              }}>
                <f.icon size={18} color="#2563EB" />
                <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', marginTop: 10 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Trust badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginTop: 48, fontSize: 12, color: '#9CA3AF' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={14} color="#16A34A" />
              <span>SSL Encrypted</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={14} color="#16A34A" />
              <span>99.9% Uptime</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Shield size={14} color="#16A34A" />
              <span>Enterprise Secure</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ position: 'absolute', bottom: 24, left: 80, right: 80, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#9CA3AF', zIndex: 1 }}>
          <span>© 2026 Zeravia Technologies</span>
          <div style={{ display: 'flex', gap: 16 }}>
            <a href="#" style={{ color: '#9CA3AF', textDecoration: 'none' }}>Privacy Policy</a>
            <a href="#" style={{ color: '#9CA3AF', textDecoration: 'none' }}>Terms</a>
            <a href="#" style={{ color: '#9CA3AF', textDecoration: 'none' }}>Support</a>
          </div>
        </div>
      </div>

      {/* ───── RIGHT PANEL (40%) ───── */}
      <div className="login-right" style={{
        flex: '0 0 40%', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 40, background: '#FFFFFF',
        animation: 'fadeIn 0.6s ease',
      }}>
        {/* Login Card */}
        <div style={{
          width: '100%', maxWidth: 420,
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(16px) saturate(180%)',
          WebkitBackdropFilter: 'blur(16px) saturate(180%)',
          borderRadius: 24,
          padding: 48,
          boxShadow: '0 20px 60px rgba(15,23,42,0.12), 0 1px 0 rgba(255,255,255,0.5) inset',
          border: '1px solid rgba(229,231,235,0.5)',
        }}>
          {/* Logo + Brand */}
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <img src="/Z_logo.jpeg" alt="" style={{
              width: 56, height: 56, borderRadius: 16, objectFit: 'cover',
              boxShadow: '0 4px 12px rgba(37,99,235,0.15)',
              animation: 'fadeIn 0.4s ease',
            }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginTop: 12, letterSpacing: '-0.3px' }}>Zeravia_beta---CRM</div>
            <div style={{ fontSize: 15, color: '#6B7280', marginTop: 4 }}>Welcome back</div>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 12,
              padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#DC2626', fontWeight: 500,
              animation: 'fadeIn 0.2s ease',
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 500, color: '#374151', marginBottom: 6 }}>Email address</label>
              <div style={{ position: 'relative' }}>
                <Mail size={16} style={{ position: 'absolute', left: 14, top: 18, color: '#9CA3AF', pointerEvents: 'none' }} />
                <input
                  type="email" placeholder="Enter your work email"
                  value={email} onChange={e => setEmail(e.target.value)} required
                  aria-label="Email address"
                  style={{
                    width: '100%', height: 56, padding: '0 16px 0 44px',
                    border: '1px solid #E5E7EB', borderRadius: 14, fontSize: 15,
                    fontFamily: 'Inter', color: '#111827', outline: 'none',
                    background: '#F9FAFB', transition: 'all 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; e.target.style.background = '#fff'; }}
                  onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F9FAFB'; }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <label style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>Password</label>
                <a href="#" style={{ fontSize: 13, color: '#2563EB', fontWeight: 500, textDecoration: 'none' }}>Forgot password?</a>
              </div>
              <div style={{ position: 'relative' }}>
                <Lock size={16} style={{ position: 'absolute', left: 14, top: 18, color: '#9CA3AF', pointerEvents: 'none' }} />
                <input
                  type={showPw ? 'text' : 'password'} placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)} required
                  onKeyDown={e => setCapsLock(e.getModifierState('CapsLock'))}
                  aria-label="Password"
                  style={{
                    width: '100%', height: 56, padding: '0 44px 0 44px',
                    border: '1px solid #E5E7EB', borderRadius: 14, fontSize: 15,
                    fontFamily: 'Inter', color: '#111827', outline: 'none',
                    background: '#F9FAFB', transition: 'all 0.2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; e.target.style.background = '#fff'; }}
                  onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.boxShadow = 'none'; e.target.style.background = '#F9FAFB'; }}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'}
                  style={{ position: 'absolute', right: 14, top: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {capsLock && (
                <div style={{ fontSize: 12, color: '#F59E0B', marginTop: 6, fontWeight: 500 }}>
                  ⚠️ Caps Lock is on
                </div>
              )}
            </div>

            {/* Remember me */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#6B7280' }}>
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}
                  style={{ width: 16, height: 16, accentColor: '#2563EB', borderRadius: 4, cursor: 'pointer' }} />
                Remember me
              </label>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading} aria-label="Sign in"
              style={{
                width: '100%', height: 56, borderRadius: 14, border: 'none',
                background: loading ? '#93C5FD' : 'linear-gradient(135deg, #2563EB, #1D4ED8)',
                color: '#fff', fontSize: 16, fontWeight: 600, fontFamily: 'Inter',
                cursor: loading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
              onMouseOver={e => { if (!loading) { e.target.style.transform = 'translateY(-1px)'; e.target.style.boxShadow = '0 6px 20px rgba(37,99,235,0.3)'; }}}
              onMouseOut={e => { if (!loading) { e.target.style.transform = 'translateY(0)'; e.target.style.boxShadow = '0 4px 12px rgba(37,99,235,0.25)'; }}}
            >
              {loading && <Loader size={18} className="animate-spin" />}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
            <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>OR</span>
            <div style={{ flex: 1, height: 1, background: '#E5E7EB' }} />
          </div>

          {/* SSO Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button type="button" onClick={() => ssoLogin('google')} disabled={ssoLoading}
              style={{
                flex: 1, height: 48, borderRadius: 12, border: '1px solid #E5E7EB',
                background: '#fff', cursor: ssoLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500,
                fontFamily: 'Inter', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s', opacity: ssoLoading ? 0.6 : 1,
              }}
              onMouseOver={e => { if (!ssoLoading) e.target.style.borderColor = '#2563EB'; }}
              onMouseOut={e => { if (!ssoLoading) e.target.style.borderColor = '#E5E7EB'; }}
            >
              {ssoLoading ? <Loader size={14} className="animate-spin" /> : (
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              )}
              {ssoLoading ? 'Connecting...' : 'Continue with Google'}
            </button>
            <button type="button" onClick={() => ssoLogin('azure')} disabled={ssoLoading}
              style={{
                flex: 1, height: 48, borderRadius: 12, border: '1px solid #E5E7EB',
                background: '#fff', cursor: ssoLoading ? 'not-allowed' : 'pointer', fontSize: 13, fontWeight: 500,
                fontFamily: 'Inter', color: '#374151', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 0.2s', opacity: ssoLoading ? 0.6 : 1,
              }}
              onMouseOver={e => { if (!ssoLoading) e.target.style.borderColor = '#2563EB'; }}
              onMouseOut={e => { if (!ssoLoading) e.target.style.borderColor = '#E5E7EB'; }}
            >
              {ssoLoading ? <Loader size={14} className="animate-spin" /> : (
                <svg width="16" height="16" viewBox="0 0 24 24"><path fill="#2563EB" d="M11.5 2C6.26 2 2 6.26 2 11.5S6.26 21 11.5 21s9.5-4.26 9.5-9.5S16.74 2 11.5 2zm4.87 6.14l-4.2 4.2-2.04-2.04a.5.5 0 0 0-.71.71l2.4 2.4a.5.5 0 0 0 .7 0l4.56-4.56a.5.5 0 1 0-.7-.71z"/></svg>
              )}
              {ssoLoading ? 'Connecting...' : 'Continue with Microsoft'}
            </button>
          </div>

          {/* Security notice */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            marginTop: 24, fontSize: 12, color: '#9CA3AF',
          }}>
            <Shield size={14} color="#16A34A" />
            <span>Protected with enterprise-grade encryption</span>
          </div>

          {/* Help */}
          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: '#6B7280' }}>
            Need help?{' '}
            <a href="#" style={{ color: '#2563EB', fontWeight: 500, textDecoration: 'none' }}>Contact IT Administrator</a>
          </div>

          {/* Powered by */}
          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: '#D1D5DB', letterSpacing: '0.3px' }}>
            Powered by Zeravia Technologies
          </div>
        </div>

        {/* Login card bottom footer */}
        <div style={{
          position: 'absolute', bottom: 24, left: 40, right: 40,
          display: 'flex', justifyContent: 'center', gap: 16,
          fontSize: 11, color: '#D1D5DB',
        }}>
          <a href="#" style={{ color: '#D1D5DB', textDecoration: 'none' }}>Privacy</a>
          <a href="#" style={{ color: '#D1D5DB', textDecoration: 'none' }}>Terms</a>
          <span>Version 2.5.0</span>
        </div>
      </div>
    </div>
  );
};

export default Login;
