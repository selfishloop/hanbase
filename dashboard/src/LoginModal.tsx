import { useState } from 'react'


export function LoginModal({ onLogin }: { onLogin: (e: string, p: string) => void }) {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-lg p-8 shadow-2xl">
                <div className="text-center mb-6">
                    <div className="w-12 h-12 rounded-lg bg-emerald-600 flex items-center justify-center font-bold text-white mx-auto mb-4 text-xl shadow-lg shadow-emerald-900/20">HB</div>
                    <h2 className="text-xl font-semibold">Welcome Back</h2>
                    <p className="text-sm text-zinc-400 mt-1">Sign in to Hanbase Platform</p>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); onLogin(email, password); }} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Email</label>
                        <input value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-black/40 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors" placeholder="admin@hunkar.com" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Password</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="w-full bg-black/40 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors" placeholder="••••••••" />
                    </div>
                    <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-md transition-colors mt-2">Sign In</button>
                    <p className="text-xs text-center text-zinc-600 mt-4">Use the admin credentials created in setup.</p>
                </form>
            </div>
        </div>
    )
}
