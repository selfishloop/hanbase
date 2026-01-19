import { useState } from 'react'
import { X } from 'lucide-react'

const API_URL = 'http://localhost:8000'

export function NewProjectModal({ token, onClose, onSuccess }: { token: string | null, onClose: () => void, onSuccess: () => void }) {
    const [name, setName] = useState('')
    const [slug, setSlug] = useState('')

    const handleCreate = async () => {
        if (!name || !slug) {
            alert("Name and Slug are required")
            return
        }
        try {
            const res = await fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, slug })
            })
            const data = await res.json()
            if (res.ok) {
                onSuccess()
                onClose()
                alert('Project Created: ' + data.message)
            } else {
                alert(data.error)
            }
        } catch (err) {
            alert('Create Error')
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-lg p-8 shadow-2xl relative">
                <button onClick={onClose} className="absolute right-4 top-4 text-zinc-500 hover:text-white"><X size={18} /></button>
                <h2 className="text-lg font-semibold mb-1">Create New Project</h2>
                <p className="text-sm text-zinc-400 mb-6">This will create a dedicated database schema.</p>

                <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Project Name</label>
                        <input value={name} onChange={e => { setName(e.target.value); setSlug(e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')) }} className="w-full bg-black/40 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors" placeholder="My E-Commerce App" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Project Slug (Schema)</label>
                        <input value={slug} onChange={e => setSlug(e.target.value)} className="w-full bg-black/40 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors font-mono" placeholder="my_ecommerce_app" />
                    </div>
                    <div className="flex gap-3 mt-6">
                        <button type="button" onClick={onClose} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-2 rounded-md transition-colors">Cancel</button>
                        <button className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-md transition-colors">Create Project</button>
                    </div>
                </form>
            </div>
        </div>
    )
}
