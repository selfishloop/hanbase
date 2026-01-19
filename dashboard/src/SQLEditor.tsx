import { useState } from 'react'
import { Play, RotateCw } from 'lucide-react'

// Simple helper to fetch API
const API_URL = 'http://localhost:8000'

export function SQLEditor({ token }: { token: string | null }) {
    const [query, setQuery] = useState('SELECT * FROM information_schema.tables;')
    const [results, setResults] = useState<any[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const runQuery = async () => {
        setLoading(true)
        setError('')
        setResults([])
        try {
            const res = await fetch(`${API_URL}/query`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ query })
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Query failed')

            if (Array.isArray(data)) {
                setResults(data)
            } else {
                setResults([data]) // For non-SELECT commands that might return a message object
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex flex-col h-full gap-4 max-w-6xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold tracking-tight mb-1">SQL Editor</h1>
                    <p className="text-muted-foreground text-sm">Run raw SQL queries against your database.</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={runQuery} disabled={loading} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-md font-medium text-sm transition-colors shadow-lg shadow-emerald-900/20 disabled:opacity-50">
                        {loading ? <RotateCw className="animate-spin" size={16} /> : <Play size={16} />}
                        Run Query
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 flex-1 min-h-0">
                {/* Editor Area */}
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg p-0 overflow-hidden flex flex-col">
                    <textarea
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        className="w-full h-48 bg-transparent p-4 font-mono text-sm text-zinc-300 focus:outline-none resize-none"
                        spellCheck={false}
                    />
                </div>

                {/* Results Area */}
                <div className="bg-zinc-900/40 border border-zinc-800 rounded-lg overflow-hidden flex flex-col flex-1 min-h-0">
                    {error && (
                        <div className="bg-red-900/20 text-red-400 p-4 font-mono text-sm border-b border-red-900/20">
                            Error: {error}
                        </div>
                    )}

                    {results.length > 0 && (
                        <div className="overflow-auto flex-1">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-zinc-950/50 sticky top-0">
                                    <tr>
                                        {Object.keys(results[0]).map((key) => (
                                            <th key={key} className="px-4 py-3 font-medium text-zinc-400 border-b border-zinc-800 whitespace-nowrap">{key}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {results.map((row, i) => (
                                        <tr key={i} className="hover:bg-zinc-800/20 font-mono text-xs">
                                            {Object.values(row).map((val: any, j) => (
                                                <td key={j} className="px-4 py-2 border-b border-zinc-900/50 whitespace-nowrap text-zinc-300">
                                                    {typeof val === 'object' ? JSON.stringify(val) : String(val)}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {results.length === 0 && !error && !loading && (
                        <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
                            No results to display
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
