"use client";

import React, { useState, useEffect, Suspense } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Fingerprint, AlertTriangle, Loader2 } from "lucide-react";

function LoginForm() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [badgeId, setBadgeId] = useState("");
  const [securityCode, setSecurityCode] = useState("");
  const [confirmCode, setConfirmCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isFocused, setIsFocused] = useState<"badge" | "code" | "confirm" | null>(null);

  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const errorParam = searchParams.get("error");
  
  // Initialize error from URL param
  const getErrorMessage = (err: string | null) => {
    if (!err) return null;
    if (err === "CredentialsSignin") return "Invalid credentials. Check your Badge ID and Clearance Code.";
    if (err === "BADGE_EXISTS") return "This Badge ID is already registered. Please sign in instead.";
    if (err === "INVALID_CREDENTIALS") return "Invalid credentials. Check your Badge ID and Clearance Code.";
    return "Authentication failed. Please try again.";
  };
  const [error, setError] = useState<string | null>(getErrorMessage(errorParam));
  const [success, setSuccess] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated") {
      router.push(callbackUrl);
    }
  }, [status, router, callbackUrl]);

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // Validate confirm code for sign up
    if (isSignUp && securityCode !== confirmCode) {
      setError("Clearance codes do not match. Please verify and try again.");
      setIsLoading(false);
      return;
    }

    // Validate minimum password length for sign up
    if (isSignUp && securityCode.length < 6) {
      setError("Clearance code must be at least 6 characters.");
      setIsLoading(false);
      return;
    }

    try {
      const result = await signIn("credentials", {
        badgeId,
        securityCode,
        isSignUp: isSignUp.toString(),
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        if (result.error.includes("BADGE_EXISTS")) {
          setError("This Badge ID is already registered. Please sign in instead.");
        } else if (result.error.includes("INVALID_CREDENTIALS")) {
          setError("Invalid Badge ID or Clearance Code.");
        } else {
          setError(isSignUp 
            ? "Registration failed. Badge ID may already exist." 
            : "Access denied. Invalid Badge ID or Clearance Code."
          );
        }
        setIsLoading(false);
      } else if (result?.ok) {
        if (isSignUp) {
          setSuccess("Registration successful! Redirecting...");
        }
        router.push(callbackUrl);
      }
    } catch {
      setError("System malfunction. Please try again.");
      setIsLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen w-full bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <span className="text-amber-500 font-typewriter text-sm tracking-widest">
            VERIFYING CLEARANCE...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-[#050505] relative overflow-hidden flex flex-col items-center justify-center font-courier text-[#1a1a1a]">
      {/* --- Ambient Effects --- */}
      
      {/* Film Grain */}
      <div 
        className="absolute inset-0 z-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='1'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Vignette */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_50%_30%,transparent_10%,rgba(0,0,0,0.95)_70%)]" />
      
      {/* Desk Lamp Light */}
      <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-amber-100/10 blur-[120px] rounded-full pointer-events-none mix-blend-screen opacity-50" />

      {/* --- Main Content --- */}
      <main className="relative z-10 w-full max-w-[540px] p-6 flex flex-col items-center">
        
        {/* Dossier Card */}
        <div className="w-full relative transform -rotate-1 transition-transform duration-500 hover:rotate-0 filter drop-shadow-[0_20px_15px_rgba(0,0,0,0.8)]">
          
          {/* Serrated Top Edge */}
          <div 
            className="w-full h-4 relative z-20"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='12' viewBox='0 0 20 12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0,12 L10,0 L20,12 Z' fill='%23e3d5b8' /%3E%3C/svg%3E")`,
              backgroundRepeat: 'repeat-x',
              backgroundPosition: 'bottom left'
            }} 
          />

          {/* Main Paper */}
          <div className="bg-[#e3d5b8] px-10 py-6 md:px-14 md:py-8 relative">
            
            {/* Paper Texture */}
            <div 
              className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.4'/%3E%3C/svg%3E")`,
                filter: "contrast(120%) brightness(95%) sepia(20%)"
              }}
            />
            
            {/* Stains */}
            <div className="absolute top-10 right-10 w-32 h-32 rounded-full border-[15px] border-[#8b5a2b]/10 blur-md pointer-events-none mix-blend-multiply transform skew-x-12 rotate-45" />
            <div className="absolute bottom-20 left-10 w-24 h-24 bg-[#1a1a1a]/5 blur-xl rounded-full pointer-events-none mix-blend-multiply" />

            {/* Stamps */}
            <div className="absolute top-2 right-2 w-28 h-28 border-4 border-indigo-900/60 rounded-full flex items-center justify-center p-2 transform rotate-12 mix-blend-multiply opacity-80 pointer-events-none z-20">
              <div className="w-full h-full border-2 border-indigo-900/40 rounded-full flex flex-col items-center justify-center text-center">
                <span className="text-[9px] font-bold text-indigo-900/80 uppercase tracking-widest leading-none block font-typewriter">BIOMETRIC</span>
                <span className="text-lg font-black text-indigo-900/80 uppercase tracking-widest my-1 transform -rotate-2 font-typewriter">VERIFY</span>
                <span className="text-[9px] font-bold text-indigo-900/60 uppercase tracking-widest font-typewriter">REQUIRED</span>
              </div>
            </div>

            <div className="absolute top-6 left-6 border-4 border-dashed border-red-800/40 px-4 py-2 transform -rotate-12 mix-blend-multiply opacity-60 pointer-events-none select-none z-0">
              <span className="text-2xl md:text-4xl font-black text-red-800/40 uppercase tracking-[0.2em] font-typewriter blur-[0.5px]">RESTRICTED</span>
            </div>

            {/* Header */}
            <div className="text-center mb-10 relative z-10 pt-6">
              <h1 className="text-2xl md:text-3xl font-bold tracking-[0.1em] text-[#1a1a1a] uppercase font-typewriter relative inline-block">
                {isSignUp ? "NEW RECRUIT REGISTRATION" : "BIOMETRIC CHECKPOINT"}
                <svg className="absolute w-full h-2 bottom-0 left-0 overflow-visible" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0,5 Q50,10 100,5" stroke="#1a1a1a" strokeWidth="2" fill="none" strokeLinecap="round" className="opacity-80" />
                </svg>
              </h1>
              
              <div className="mt-6 text-sm text-[#444] italic max-w-xs mx-auto leading-relaxed font-typewriter relative">
                <span className="text-2xl absolute -top-2 -left-2 opacity-20">&ldquo;</span>
                {isSignUp 
                  ? "Register your credentials to join the investigation." 
                  : "Present your credentials, investigator. The Vault awaits."}
                <span className="text-2xl absolute -bottom-4 right-0 opacity-20">&rdquo;</span>
                <br />
                <span className="opacity-70 text-xs mt-2 block font-normal">— Atlas Security Division</span>
              </div>
            </div>

            {/* Success Display */}
            {success && (
              <div className="mb-6 p-4 bg-emerald-900/20 border-2 border-emerald-700/50 relative z-10">
                <div className="flex items-center gap-3">
                  <Fingerprint className="w-5 h-5 text-emerald-700" />
                  <span className="text-emerald-800 font-typewriter text-sm">{success}</span>
                </div>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-900/20 border-2 border-red-800/50 relative z-10">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-800" />
                  <span className="text-red-800 font-typewriter text-sm">{error}</span>
                </div>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleCredentialsSubmit} className="space-y-6 relative z-10">
              
              {/* Badge ID */}
              <div className="group relative">
                <label 
                  htmlFor="badge" 
                  className="block text-xs font-bold tracking-[0.15em] mb-1 uppercase text-[#444] font-typewriter"
                >
                  Badge ID:
                </label>
                <div className={`relative border-b-[3px] border-dotted transition-colors duration-300 ${isFocused === 'badge' ? 'border-[#1a1a1a]' : 'border-[#888]'}`}>
                  <input
                    id="badge"
                    type="text"
                    value={badgeId}
                    onChange={(e) => setBadgeId(e.target.value)}
                    onFocus={() => setIsFocused('badge')}
                    onBlur={() => setIsFocused(null)}
                    className="w-full bg-transparent p-2 text-xl text-[#000] font-typewriter tracking-widest focus:outline-none placeholder-[#000]/20"
                    placeholder="YOUR-BADGE-ID"
                    autoComplete="username"
                    required
                    disabled={isLoading}
                    style={{ textShadow: "0px 0px 1px rgba(0,0,0,0.5)" }}
                  />
                </div>
              </div>

              {/* Security Code */}
              <div className="group relative">
                <label 
                  htmlFor="code" 
                  className="block text-xs font-bold tracking-[0.15em] mb-1 uppercase text-[#444] font-typewriter"
                >
                  {isSignUp ? "Create Clearance Code:" : "Clearance Code:"}
                </label>
                <div className={`relative border-b-[3px] border-dotted transition-colors duration-300 ${isFocused === 'code' ? 'border-[#800000]' : 'border-[#888]'}`}>
                  <input
                    id="code"
                    type="password"
                    value={securityCode}
                    onChange={(e) => setSecurityCode(e.target.value)}
                    onFocus={() => setIsFocused('code')}
                    onBlur={() => setIsFocused(null)}
                    className="w-full bg-transparent p-2 text-xl text-[#800000] font-typewriter tracking-[0.5em] focus:outline-none placeholder-[#000]/20"
                    placeholder="••••••"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    required
                    disabled={isLoading}
                    minLength={isSignUp ? 6 : undefined}
                    style={{ textShadow: "0px 0px 1px rgba(128,0,0,0.4)" }}
                  />
                </div>
                {isSignUp && (
                  <p className="mt-2 text-[10px] text-[#666] font-typewriter">
                    * Minimum 6 characters required
                  </p>
                )}
              </div>

              {/* Confirm Clearance Code (Sign Up Only) */}
              {isSignUp && (
                <div className="group relative">
                  <label 
                    htmlFor="confirm" 
                    className="block text-xs font-bold tracking-[0.15em] mb-1 uppercase text-[#444] font-typewriter"
                  >
                    Confirm Clearance Code:
                  </label>
                  <div className={`relative border-b-[3px] border-dotted transition-colors duration-300 ${isFocused === 'confirm' ? 'border-[#800000]' : 'border-[#888]'}`}>
                    <input
                      id="confirm"
                      type="password"
                      value={confirmCode}
                      onChange={(e) => setConfirmCode(e.target.value)}
                      onFocus={() => setIsFocused('confirm')}
                      onBlur={() => setIsFocused(null)}
                      className="w-full bg-transparent p-2 text-xl text-[#800000] font-typewriter tracking-[0.5em] focus:outline-none placeholder-[#000]/20"
                      placeholder="••••••"
                      autoComplete="new-password"
                      required
                      disabled={isLoading}
                      style={{ textShadow: "0px 0px 1px rgba(128,0,0,0.4)" }}
                    />
                  </div>
                </div>
              )}

              {/* Controls */}
              <div className="pt-6 flex flex-col items-center gap-6 relative">
                
                {/* Fingerprint */}
                <div className="absolute right-0 top-6 opacity-60 mix-blend-multiply pointer-events-none transform rotate-12">
                  <Fingerprint className="w-24 h-24 text-black/20" strokeWidth={1} />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || !badgeId || !securityCode || (isSignUp && !confirmCode)}
                  className="relative group outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="relative px-10 py-4 transition-transform duration-100 ease-linear bg-[#222] border-2 border-[#000] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.4)] active:translate-y-[2px] active:translate-x-[2px] active:shadow-[2px_2px_0px_0px_rgba(0,0,0,0.4)] flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full border border-black transition-colors ${isLoading ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.8)] animate-pulse' : isSignUp ? 'bg-emerald-700/50' : 'bg-red-900/50'}`} />
                    <span className="text-sm font-bold tracking-[0.2em] uppercase text-[#ccc] group-hover:text-white font-courier">
                      {isLoading ? (isSignUp ? 'Registering...' : 'Verifying...') : (isSignUp ? 'Register' : 'Authenticate')}
                    </span>
                  </div>
                </button>

                {/* Divider */}
                <div className="w-full flex items-center gap-4 opacity-40">
                  <div className="h-px bg-[#555] flex-1" />
                  <span className="font-typewriter text-xs font-bold text-[#333]">{isSignUp ? "EXISTING AGENT" : "NEW RECRUIT"}</span>
                  <div className="h-px bg-[#555] flex-1" />
                </div>

                {/* Toggle Sign Up / Sign In */}
                <button
                  type="button"
                  className="group relative w-full disabled:opacity-50"
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError(null);
                    setSuccess(null);
                    setConfirmCode("");
                  }}
                  disabled={isLoading}
                >
                  <div className="relative w-full bg-gradient-to-b from-[#444] to-[#2a2a2a] border border-[#111] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_2px_4px_rgba(0,0,0,0.5)]">
                    {/* Rivets */}
                    <div className="absolute top-1 left-1 w-1.5 h-1.5 rounded-full bg-[#111] shadow-[inset_0_-1px_0_rgba(255,255,255,0.2)]" />
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#111] shadow-[inset_0_-1px_0_rgba(255,255,255,0.2)]" />
                    <div className="absolute bottom-1 left-1 w-1.5 h-1.5 rounded-full bg-[#111] shadow-[inset_0_-1px_0_rgba(255,255,255,0.2)]" />
                    <div className="absolute bottom-1 right-1 w-1.5 h-1.5 rounded-full bg-[#111] shadow-[inset_0_-1px_0_rgba(255,255,255,0.2)]" />

                    <div className={`border border-[#222] p-3 flex items-center justify-center gap-4 transition-colors group-hover:bg-[#3a3a3a] ${isSignUp ? 'bg-[#333]' : 'bg-emerald-900/30'}`}>
                      <div className={`w-6 h-6 flex items-center justify-center rounded-sm font-black font-courier text-lg shadow-[inset_0_0_2px_rgba(0,0,0,0.5)] opacity-80 ${isSignUp ? 'bg-[#ddd] text-[#222]' : 'bg-emerald-700 text-white'}`} style={{ clipPath: "polygon(100% 0, 100% 85%, 85% 100%, 0 100%, 0 0)" }}>
                        {isSignUp ? "→" : "+"}
                      </div>
                      <span className="text-xs font-bold tracking-[0.15em] text-[#aaa] group-hover:text-[#fff] shadow-black drop-shadow-md font-typewriter">
                        {isSignUp ? "[ SIGN IN INSTEAD ]" : "[ REGISTER NEW BADGE ]"}
                      </span>
                    </div>
                  </div>
                </button>

              </div>
            </form>
          </div>

          {/* Paper Edge */}
          <div className="absolute inset-x-2 -bottom-2 h-4 bg-[#dcccae] -z-10 rounded-b-sm border-b border-[#000]/20" />
          <div className="absolute inset-x-4 -bottom-4 h-4 bg-[#d1c0a0] -z-20 rounded-b-sm border-b border-[#000]/20 transform rotate-1" />
          
        </div>

        {/* Footer */}
        <div className="mt-20 text-[#444] text-[10px] uppercase tracking-widest font-mono text-center opacity-50 relative z-10">
          <p className="border-t border-[#333] pt-4 inline-block px-8">Atlas Forensic Vault // Biometric Security System v2.1</p>
        </div>

      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen w-full bg-[#050505] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
          <span className="text-amber-500 font-typewriter text-sm tracking-widest">
            INITIALIZING SECURITY...
          </span>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
