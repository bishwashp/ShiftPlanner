import React, { useState, useEffect } from 'react';
import { apiService, AlgorithmConfig } from '../services/api';
import Button from './ui/Button';

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
        <div className="text-foreground p-6 relative z-10">
            {error && <p className="text-destructive">{error}</p>}
            {loading ? <p className="text-gray-700 dark:text-gray-200">Loading algorithms...</p> : (
                <div className="space-y-4">
                    {algorithms.map(algo => (
                        <div key={algo.id} className="p-4 glass-static">
                            <h2 className="text-xl font-semibold text-foreground">{algo.name}</h2>
                            <p className="text-gray-700 dark:text-gray-200">{algo.description}</p>
                            <p className="text-gray-700 dark:text-gray-200">Status: {algo.isActive ? 'Active' : 'Inactive'}</p>
                            <div className="mt-2 flex space-x-2">
                                <Button onClick={() => handleEdit(algo)} variant="secondary" size="sm">Edit Config</Button>
                                {!algo.isActive && <Button onClick={() => handleActivate(algo.id)} variant="primary" size="sm">Activate</Button>}
                            </div>
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
                        <div className="mt-4 flex space-x-2">
                            <Button type="submit" variant="primary">Save</Button>
                            <Button type="button" onClick={() => setEditingAlgorithm(null)} variant="secondary">Cancel</Button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};

export default AlgorithmManagement; 