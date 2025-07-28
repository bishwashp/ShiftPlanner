import React, { useState, useEffect } from 'react';
import { apiService, AlgorithmConfig } from '../services/api';

const AlgorithmManagement: React.FC = () => {
    const [algorithms, setAlgorithms] = useState<AlgorithmConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [editingAlgorithm, setEditingAlgorithm] = useState<AlgorithmConfig | null>(null);
    const [formData, setFormData] = useState<any>({});

    useEffect(() => {
        fetchAlgorithms();
    }, []);

    const fetchAlgorithms = async () => {
        try {
            setLoading(true);
            const data = await apiService.getAlgorithms();
            setAlgorithms(data);
        } catch (err) {
            setError('Failed to fetch algorithms.');
        } finally {
            setLoading(false);
        }
    };

    const handleEdit = (algo: AlgorithmConfig) => {
        setEditingAlgorithm(algo);
        setFormData(algo.config || {});
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingAlgorithm) return;

        try {
            await apiService.updateAlgorithm(editingAlgorithm.id, { config: formData });
            setEditingAlgorithm(null);
            fetchAlgorithms();
        } catch (err) {
            setError('Failed to save algorithm configuration.');
        }
    };
    
    const handleActivate = async (id: string) => {
        try {
            await apiService.activateAlgorithm(id);
            fetchAlgorithms();
        } catch (err) {
            setError('Failed to activate algorithm.');
        }
    };

    return (
        <div className="bg-background text-foreground p-6">
            {error && <p className="text-destructive">{error}</p>}
            {loading ? <p className="text-muted-foreground">Loading algorithms...</p> : (
                <div className="space-y-4">
                    {algorithms.map(algo => (
                        <div key={algo.id} className="p-4 border border-border rounded bg-card">
                            <h2 className="text-xl font-semibold text-foreground">{algo.name}</h2>
                            <p className="text-muted-foreground">{algo.description}</p>
                            <p className="text-muted-foreground">Status: {algo.isActive ? 'Active' : 'Inactive'}</p>
                            <button onClick={() => handleEdit(algo)} className="px-4 py-2 mt-2 bg-muted text-muted-foreground rounded hover:bg-muted/80">Edit Config</button>
                            {!algo.isActive && <button onClick={() => handleActivate(algo.id)} className="px-4 py-2 mt-2 ml-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">Activate</button>}
                        </div>
                    ))}
                </div>
            )}

            {editingAlgorithm && (
                <div className="mt-8">
                    <h2 className="text-xl font-bold mb-4 text-foreground">Edit Configuration for {editingAlgorithm.name}</h2>
                    <form onSubmit={handleSave}>
                        <textarea 
                            className="w-full h-64 p-2 border border-border rounded font-mono bg-input"
                            value={JSON.stringify(formData, null, 2)}
                            onChange={e => {
                                try {
                                    setFormData(JSON.parse(e.target.value));
                                } catch (error) {
                                    // Handle invalid JSON
                                }
                            }}
                        />
                        <div className="mt-4">
                            <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90">Save</button>
                            <button type="button" onClick={() => setEditingAlgorithm(null)} className="px-4 py-2 ml-2 bg-muted text-muted-foreground rounded hover:bg-muted/80">Cancel</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default AlgorithmManagement; 