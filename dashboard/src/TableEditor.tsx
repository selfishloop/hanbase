import { useState, useEffect } from 'react'
import { Database, Plus, RefreshCw } from 'lucide-react'
import { AddRowModal } from './TableEditorModal'
import { CreateTableModal } from './CreateTableModal'

// Simple helper to fetch API
const API_URL = 'http://localhost:8000'

export function TableEditor({ token, projects, selectedProjectSlug, onSelectProject }: {
    token: string | null,
    projects: any[],
    selectedProjectSlug: string,
    onSelectProject: (slug: string) => void
}) {
    // Keep internal state synced? Or just use prop?
    // Using prop is better, but our sidebar select needs to update parent.
    // So onSelectProject is crucial.

    const [tables, setTables] = useState<string[]>([])
    const [selectedTable, setSelectedTable] = useState('')
    const [schema, setSchema] = useState<any[]>([])
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [showAddModal, setShowAddModal] = useState(false)
    const [showCreateTable, setShowCreateTable] = useState(false)

    // Fetch Tables when Project Changes
    useEffect(() => {
        if (!selectedProjectSlug || !token) return
        fetchTables()
    }, [selectedProjectSlug, token])

    // Update selectedProject if projects array changes (initial load)
    // Update selectedProject if projects array changes (initial load)
    useEffect(() => {
        if (projects.length > 0 && !selectedProjectSlug) {
            onSelectProject(projects[0].slug)
        }
    }, [projects])

    // Fetch Schema & Data when Table Changes
    useEffect(() => {
        if (!selectedTable || !selectedProjectSlug || !token) return
        fetchTableData()
    }, [selectedTable, selectedProjectSlug])

    const fetchTables = async (newTable?: string) => {
        // Ensure newTable is a string (handle event objects)
        const targetTable = typeof newTable === 'string' ? newTable : undefined

        const res = await fetch(`${API_URL}/meta/${selectedProjectSlug}/tables`, {
            headers: { 'Authorization': `Bearer ${token}` }
        })
        const data = await res.json()
        if (!res.ok) {
            console.error("Failed to fetch tables:", data)
            setTables([])
            return
        }
        setTables(Array.isArray(data) ? data : [])

        if (targetTable && data.includes(targetTable)) {
            setSelectedTable(targetTable)
        } else if (data && data.length > 0 && !selectedTable) {
            setSelectedTable(data[0])
        } else if (data && data.length > 0 && !data.includes(selectedTable)) {
            // Selected table deleted?
            setSelectedTable(data[0])
        }
    }

    const fetchTableData = async () => {
        setLoading(true)
        try {
            // 1. Get Schema
            const schemaRes = await fetch(`${API_URL}/meta/${selectedProjectSlug}/tables/${selectedTable}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            const schemaData = await schemaRes.json()
            setSchema(Array.isArray(schemaData) ? schemaData : [])

            // 2. Get Data via SQL (Admin)
            const queryRes = await fetch(`${API_URL}/query`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ query: `SELECT * FROM "${selectedProjectSlug}"."${selectedTable}" LIMIT 100` })
            })

            const tableRows = await queryRes.json()
            setData(Array.isArray(tableRows) ? tableRows : [])

        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex h-full gap-6">
            {showAddModal && <AddRowModal
                token={token}
                project={selectedProjectSlug}
                table={selectedTable}
                schema={schema}
                onClose={() => setShowAddModal(false)}
                onSuccess={fetchTableData}
            />}

            {showCreateTable && <CreateTableModal
                token={token}
                project={selectedProjectSlug}
                onClose={() => setShowCreateTable(false)}
                onSuccess={(name) => fetchTables(name)}
            />}

            {/* Sidebar List */}
            <div className="w-64 flex flex-col border-r border-zinc-800 pr-6">
                <div className="mb-4">
                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 block">Project</label>
                    <select
                        value={selectedProjectSlug}
                        onChange={(e) => onSelectProject(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-emerald-500"
                    >
                        {projects.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                    </select>
                </div>

                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Tables</span>
                    <div className="flex gap-2">
                        <button onClick={() => setShowCreateTable(true)} className="text-zinc-500 hover:text-emerald-500" title="New Table"><Plus size={14} /></button>
                        <button onClick={() => fetchTables()} className="text-zinc-500 hover:text-white" title="Refresh"><RefreshCw size={12} /></button>
                    </div>
                </div>

                <div className="flex-1 overflow-auto space-y-1">
                    {tables.map(t => (
                        <button
                            key={t}
                            onClick={() => setSelectedTable(t)}
                            className={`w-full text-left px-3 py-2 rounded-md text-sm flex items-center gap-2 transition-colors
                                ${selectedTable === t
                                    ? 'bg-emerald-500/10 text-emerald-500 font-medium'
                                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                                }
                            `}
                        >
                            <Database size={14} />
                            {t}
                        </button>
                    ))}
                    {tables.length === 0 && <div className="text-xs text-zinc-600 italic px-2">No tables found</div>}
                </div>
            </div>

            {/* Main Data Grid */}
            <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h2 className="text-lg font-semibold">{selectedTable}</h2>
                        <div className="text-xs text-zinc-500 flex gap-2">
                            {schema.map(c => <span key={c.name} title={c.type}>{c.name}</span>)}
                        </div>
                    </div>
                    <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors">
                        <Plus size={14} /> Add Row
                    </button>
                </div>

                <div className="flex-1 border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/20">
                    {loading ? (
                        <div className="h-full flex items-center justify-center text-zinc-500 animate-pulse">Loading data...</div>
                    ) : (
                        <div className="overflow-auto h-full">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-zinc-950/50 sticky top-0 z-10">
                                    <tr>
                                        {schema.map((col) => (
                                            <th key={col.name} className="px-4 py-3 font-medium text-zinc-400 border-b border-zinc-800 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis">
                                                <div className="flex flex-col">
                                                    <span>{col.name}</span>
                                                    <span className="text-[10px] text-zinc-600 font-normal">{col.type}</span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.map((row, i) => (
                                        <tr key={i} className="hover:bg-zinc-800/20 font-mono text-xs group">
                                            {schema.map((col, j) => (
                                                <td key={j} className="px-4 py-2 border-b border-zinc-900/50 whitespace-nowrap text-zinc-300 max-w-[200px] overflow-hidden text-ellipsis">
                                                    {row[col.name]?.toString()}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {data.length === 0 && <div className="p-8 text-center text-zinc-600 text-sm">Table is empty</div>}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
