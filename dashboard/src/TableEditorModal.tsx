import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'

const API_URL = 'http://localhost:8000'

interface Column {
    name: string
    type: string
    nullable: string
    default: string | null
}

export function AddRowModal({ token, project, table, schema, onClose, onSuccess }: {
    token: string | null,
    project: string,
    table: string,
    schema: Column[],
    onClose: () => void,
    onSuccess: () => void
}) {
    const [formData, setFormData] = useState<Record<string, any>>({})
    const [loading, setLoading] = useState(false)

    // Filter out auto-generated columns (like id, created_at) usually
    // validatable by default value presence, but for now we show all editable ones.
    const editableColumns = schema.filter(col =>
        col.name !== 'id' &&
        col.name !== 'created_at' &&
        col.name !== 'updated_at'
    )

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            // Construct SQL Insert
            const cols = Object.keys(formData)
            const vals = Object.values(formData).map(v => {
                if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'` // Basic SQL escape
                return v
            })

            const query = `INSERT INTO "${project}"."${table}" (${cols.map(c => `"${c}"`).join(', ')}) VALUES (${vals.join(', ')})`

            const res = await fetch(`${API_URL}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ query })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to insert')

            onSuccess()
            onClose()
        } catch (err) {
            alert('Insert Failed: ' + err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-lg p-6 shadow-2xl relative max-h-[90vh] overflow-auto">
                <button onClick={onClose} className="absolute right-4 top-4 text-zinc-500 hover:text-white"><X size={18} /></button>
                <h2 className="text-lg font-semibold mb-6">Add New Row</h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {editableColumns.map(col => (
                        <div key={col.name}>
                            <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                                {col.name} <span className="text-zinc-600 lowercase">({col.type})</span>
                            </label>
                            <input
                                className="w-full bg-black/40 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors"
                                placeholder={col.nullable === 'YES' ? 'NULL' : ''}
                                onChange={e => {
                                    const val = e.target.value
                                    setFormData({ ...formData, [col.name]: val })
                                }}
                            />
                        </div>
                    ))}

                    <div className="flex gap-3 mt-8 pt-4 border-t border-zinc-800">
                        <button type="button" onClick={onClose} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-2 rounded-md transition-colors">Cancel</button>
                        <button disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-md transition-colors flex items-center justify-center gap-2">
                            {loading && <Loader2 className="animate-spin" size={16} />}
                            Save Row
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
