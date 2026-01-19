import { useState } from 'react'
import { X, Loader2, Plus, Trash } from 'lucide-react'

const API_URL = 'http://localhost:8000'

export function CreateTableModal({ token, project, onClose, onSuccess }: {
    token: string | null,
    project: string,
    onClose: () => void,
    onSuccess: (tableName: string) => void
}) {
    const [tableName, setTableName] = useState('')
    const [columns, setColumns] = useState([{ name: 'id', type: 'UUID', primary: true, default: 'gen_random_uuid()' }])
    const [loading, setLoading] = useState(false)

    const addColumn = () => {
        setColumns([...columns, { name: '', type: 'TEXT', primary: false, default: '' }])
    }

    const removeColumn = (idx: number) => {
        setColumns(columns.filter((_, i) => i !== idx))
    }

    const updateColumn = (idx: number, field: string, value: any) => {
        const newCols = [...columns]
        // @ts-ignore
        newCols[idx][field] = value
        setColumns(newCols)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        if (!tableName) {
            alert("Table name is required")
            setLoading(false)
            return
        }

        if (!project) {
            alert("No project selected")
            setLoading(false)
            return
        }

        try {
            // Construct Create Table SQL
            const columnDefs = columns.map(c => {
                let def = `"${c.name}" ${c.type}`
                if (c.primary) def += ' PRIMARY KEY'
                if (c.default) def += ` DEFAULT ${c.default}`
                return def
            }).join(',\n  ')

            const query = `CREATE TABLE "${project}"."${tableName}" (\n  ${columnDefs}\n);`
            console.log("Executing SQL:", query) // Debugging

            const res = await fetch(`${API_URL}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ query })
            })

            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Failed to create table')

            onSuccess(tableName)
            onClose()
        } catch (err) {
            console.error(err)
            alert('Creation Failed: ' + err)
        } finally {
            setLoading(false)
        }
    }


    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-lg p-6 shadow-2xl relative max-h-[90vh] overflow-auto">
                <button onClick={onClose} className="absolute right-4 top-4 text-zinc-500 hover:text-white"><X size={18} /></button>
                <h2 className="text-lg font-semibold mb-6">Create New Table</h2>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Table Name</label>
                        <input
                            value={tableName}
                            onChange={e => setTableName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                            className="w-full bg-black/40 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                            placeholder="posts"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">Columns</label>

                        {columns.map((col, i) => (
                            <div key={i} className="flex gap-2 items-start">
                                <input
                                    value={col.name}
                                    disabled={col.primary}
                                    onChange={e => updateColumn(i, 'name', e.target.value)}
                                    className="flex-1 bg-black/40 border border-zinc-800 rounded-md px-2 py-1.5 text-sm font-mono placeholder-zinc-700 focus:outline-none focus:border-emerald-500"
                                    placeholder="column_name"
                                />
                                <select
                                    value={col.type}
                                    disabled={col.primary}
                                    onChange={e => updateColumn(i, 'type', e.target.value)}
                                    className="w-32 bg-zinc-800 border border-zinc-800 rounded-md px-2 py-1.5 text-xs text-zinc-300 focus:outline-none"
                                >
                                    <option value="UUID">UUID</option>
                                    <option value="TEXT">TEXT</option>
                                    <option value="INT">INT</option>
                                    <option value="BOOLEAN">BOOLEAN</option>
                                    <option value="TIMESTAMP">TIMESTAMP</option>
                                    <option value="JSONB">JSONB</option>
                                </select>
                                <input
                                    value={col.default}
                                    disabled={col.primary}
                                    onChange={e => updateColumn(i, 'default', e.target.value)}
                                    className="w-40 bg-black/40 border border-zinc-800 rounded-md px-2 py-1.5 text-sm font-mono placeholder-zinc-700 focus:outline-none focus:border-emerald-500"
                                    placeholder="default value"
                                />
                                {!col.primary && (
                                    <button type="button" onClick={() => removeColumn(i)} className="text-zinc-600 hover:text-red-400 p-2">
                                        <Trash size={16} />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    <button type="button" onClick={addColumn} className="text-emerald-500 text-xs hover:text-emerald-400 flex items-center gap-1">
                        <Plus size={14} /> Add Column
                    </button>

                    <div className="flex gap-3 pt-4 border-t border-zinc-800">
                        <button type="button" onClick={onClose} className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-2 rounded-md transition-colors">Cancel</button>
                        <button disabled={loading} className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-md transition-colors flex items-center justify-center gap-2">
                            {loading && <Loader2 className="animate-spin" size={16} />}
                            Create Table
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
