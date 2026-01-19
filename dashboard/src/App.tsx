import { useState, useEffect } from 'react'
import { LayoutDashboard, Database, Users, LogOut, Plus, Trash2, Home } from 'lucide-react'
import { LoginModal } from './LoginModal'
import { NewProjectModal } from './NewProjectModal'
import { TableEditor } from './TableEditor'
import { SQLEditor } from './SQLEditor'
import { AuthManager } from './AuthManager'

const API_URL = 'http://localhost:8000'

function App() {
    const [token, setToken] = useState<string | null>(localStorage.getItem('admin_token'))
    const [showLogin, setShowLogin] = useState(false)
    const [showNewProject, setShowNewProject] = useState(false)
    const [projects, setProjects] = useState<any[]>([])
    const [activeTab, setActiveTab] = useState('tables') // projects, tables, sql, auth
    const [selectedProject, setSelectedProject] = useState<string>('')

    // Effects
    useEffect(() => {
        if (!token) {
            setShowLogin(true)
        } else {
            setShowLogin(false)
            fetchProjects()
        }
    }, [token])

    // Auto-select first project if none selected
    useEffect(() => {
        if (projects.length > 0 && !selectedProject) {
            setSelectedProject(projects[0].slug)
        }
    }, [projects])

    const fetchProjects = async () => {
        try {
            const res = await fetch(`${API_URL}/projects`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (res.ok) {
                const data = await res.json()
                setProjects(Array.isArray(data) ? data : [])
            }
        } catch (e) { console.error(e) }
    }

    const deleteProject = async (slug: string) => {
        if (!confirm(`Delete project '${slug}'? This cannot be undone.`)) return
        await fetch(`${API_URL}/projects/${slug}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        })
        fetchProjects()
    }

    const handleLogin = async (email: string, password: string) => {
        try {
            const res = await fetch(`${API_URL}/auth/signin`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            })
            if (!res.ok) throw new Error()
            const data = await res.json()
            setToken(data.token)
            localStorage.setItem('admin_token', data.token)
            setShowLogin(false)
        } catch {
            alert("Login Failed")
        }
    }

    const handleLogout = () => {
        setToken(null)
        localStorage.removeItem('admin_token')
    }

    return (
        <div className="flex h-screen bg-black text-zinc-100 font-sans selection:bg-emerald-500/30">
            {showLogin && <LoginModal onLogin={handleLogin} />}
            {showNewProject && <NewProjectModal token={token} onClose={() => setShowNewProject(false)} onSuccess={fetchProjects} />}

            {/* Supabase-style Icon Sidebar */}
            <div className="w-16 border-r border-zinc-800 flex flex-col items-center py-4 bg-zinc-950">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-bold text-black mb-8 shadow-lg shadow-emerald-900/20 text-lg">H</div>

                <NavButton icon={<Home size={20} />} active={activeTab === 'projects'} onClick={() => setActiveTab('projects')} label="Projects" />
                <NavButton icon={<Database size={20} />} active={activeTab === 'tables'} onClick={() => setActiveTab('tables')} label="Database" />
                <NavButton icon={<Users size={20} />} active={activeTab === 'auth'} onClick={() => setActiveTab('auth')} label="Auth" />
                <NavButton icon={<LayoutDashboard size={20} />} active={activeTab === 'sql'} onClick={() => setActiveTab('sql')} label="SQL Editor" />

                <div className="mt-auto flex flex-col gap-4">
                    <button onClick={handleLogout} className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-500 transition-colors">
                        <LogOut size={20} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0 bg-black overflow-hidden pointer-events-auto">
                {/* Top Bar */}
                <div className="h-14 border-b border-zinc-800 flex items-center px-6 justify-between bg-zinc-950/30 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-sm">
                        <span className="text-zinc-500">Hanbase</span>
                        <span className="text-zinc-700">/</span>
                        <span className="font-medium text-zinc-200 capitalize">{activeTab}</span>
                    </div>
                </div>

                <div className="flex-1 overflow-hidden relative">
                    {activeTab === 'projects' && (
                        <div className="p-8 max-w-5xl mx-auto w-full">
                            <div className="flex justify-between items-center mb-8">
                                <div>
                                    <h1 className="text-2xl font-bold mb-1">Projects</h1>
                                    <p className="text-zinc-400 text-sm">Manage your projects and dedicated schemas.</p>
                                </div>
                                <button onClick={() => setShowNewProject(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 transition-colors">
                                    <Plus size={16} /> New Project
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {projects.map(p => (
                                    <div key={p.slug} className="group bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 p-5 rounded-xl cursor-pointer transition-all" onClick={() => { setSelectedProject(p.slug); setActiveTab('tables') }}>
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-400 group-hover:text-emerald-500 transition-colors">
                                                <Database size={16} />
                                            </div>
                                            <button onClick={(e) => { e.stopPropagation(); deleteProject(p.slug) }} className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/10 hover:text-red-500 rounded transition-all">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                        <h3 className="font-semibold text-zinc-200">{p.name}</h3>
                                        <code className="text-xs text-zinc-500 mt-1 block">{p.slug}</code>
                                        <div className="mt-4 flex items-center gap-2 text-xs text-emerald-500">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Active
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {activeTab === 'tables' && <div className="h-full p-6"><TableEditor token={token} projects={projects} selectedProjectSlug={selectedProject} onSelectProject={setSelectedProject} /></div>}
                    {activeTab === 'sql' && <div className="h-full p-6"><SQLEditor token={token} /></div>}
                    {activeTab === 'auth' && projects.length > 0 && <div className="h-full p-6"><AuthManager token={token} project={selectedProject || projects[0]?.slug} /></div>}
                </div>
            </div>
        </div>
    )
}

function NavButton({ icon, active, onClick, label }: { icon: React.ReactNode, active: boolean, onClick: () => void, label: string }) {
    return (
        <div className="relative group flex items-center justify-center w-full mb-2">
            <button onClick={onClick} className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${active ? 'bg-emerald-500/10 text-emerald-500' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900'}`}>
                {icon}
            </button>
            <div className="absolute left-14 bg-zinc-800 text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-zinc-700">
                {label}
            </div>
        </div>
    )
}

export default App
