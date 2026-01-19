import { useState, useEffect } from 'react'
import { Trash2, UserPlus } from 'lucide-react'

const API_URL = 'http://localhost:8000'

export function AuthManager({ token, project }: { token: string | null, project: string }) {
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [newUserEmail, setNewUserEmail] = useState('')
    const [newUserPass, setNewUserPass] = useState('')
    const [showAdd, setShowAdd] = useState(false)

    useEffect(() => {
        if (token && project) fetchUsers()
    }, [token, project])

    const fetchUsers = async () => {
        setLoading(true)
        try {
            const res = await fetch(`${API_URL}/${project}/auth/users`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const data = await res.json()
            setUsers(Array.isArray(data) ? data : [])
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const deleteUser = async (id: string) => {
        if (!confirm("Are you sure?")) return
        await fetch(`${API_URL}/${project}/auth/users/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        })
        fetchUsers()
    }

    const createUser = async (e: React.FormEvent) => {
        e.preventDefault()
        try {
            const res = await fetch(`${API_URL}/${project}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: newUserEmail, password: newUserPass })
            })
            if (res.ok) {
                setShowAdd(false)
                setNewUserEmail('')
                setNewUserPass('')
                fetchUsers()
            } else {
                alert("Failed to create user")
            }
        } catch (e) { console.error(e) }
    }

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Users</h2>
                <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 bg-emerald-600 px-3 py-1.5 rounded text-sm hover:bg-emerald-500 transition-colors">
                    <UserPlus size={16} /> Add User
                </button>
            </div>

            {showAdd && (
                <form onSubmit={createUser} className="mb-6 bg-zinc-900 border border-zinc-800 p-4 rounded-lg flex gap-4 items-end">
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1">Email</label>
                        <input className="bg-black/40 border border-zinc-800 rounded px-2 py-1 text-sm outline-none focus:border-emerald-500"
                            value={newUserEmail} onChange={e => setNewUserEmail(e.target.value)} required />
                    </div>
                    <div>
                        <label className="block text-xs text-zinc-500 mb-1">Password</label>
                        <input className="bg-black/40 border border-zinc-800 rounded px-2 py-1 text-sm outline-none focus:border-emerald-500"
                            type="password" value={newUserPass} onChange={e => setNewUserPass(e.target.value)} required />
                    </div>
                    <button className="bg-emerald-600 px-4 py-1.5 rounded text-sm hover:bg-emerald-500">Create</button>
                </form>
            )}

            <div className="border border-zinc-800 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-900/50 text-zinc-400 font-medium">
                        <tr>
                            <th className="px-4 py-3">ID</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Created At</th>
                            <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {users.map(u => (
                            <tr key={u.id} className="group hover:bg-zinc-900/40">
                                <td className="px-4 py-3 font-mono text-xs text-zinc-500">{u.id}</td>
                                <td className="px-4 py-3 text-zinc-300">{u.email}</td>
                                <td className="px-4 py-3 text-zinc-500 text-xs">{new Date(u.created_at).toLocaleString()}</td>
                                <td className="px-4 py-3 text-right">
                                    <button onClick={() => deleteUser(u.id)} className="text-zinc-600 hover:text-red-500 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {users.length === 0 && !loading && (
                    <div className="p-8 text-center text-zinc-500">No users found.</div>
                )}
            </div>
        </div>
    )
}
