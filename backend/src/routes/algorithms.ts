import { Router } from 'express';
import { prisma } from '../app';

const router = Router();

// Get all algorithm configurations
router.get('/', async (req, res) => {
  try {
    const algorithms = await prisma.algorithmConfig.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(algorithms);
  } catch (error) {
    console.error('Error fetching algorithms:', error);
    res.status(500).json({ error: 'Failed to fetch algorithms' });
  }
});

// Get algorithm by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const algorithm = await prisma.algorithmConfig.findUnique({
      where: { id }
    });
    
    if (!algorithm) {
      return res.status(404).json({ error: 'Algorithm not found' });
    }
    
    res.json(algorithm);
  } catch (error) {
    console.error('Error fetching algorithm:', error);
    res.status(500).json({ error: 'Failed to fetch algorithm' });
  }
});

// Create new algorithm configuration
router.post('/', async (req, res) => {
  try {
    const { name, description, config } = req.body;
    
    if (!name || !config) {
      return res.status(400).json({ error: 'name and config are required' });
    }
    
    const algorithm = await prisma.algorithmConfig.create({
      data: {
        name,
        description,
        config,
        isActive: false
      }
    });
    
    res.status(201).json(algorithm);
  } catch (error: any) {
    console.error('Error creating algorithm:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Algorithm name already exists' });
    }
    res.status(400).json({ error: 'Failed to create algorithm' });
  }
});

// Update algorithm configuration
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, config, isActive } = req.body;
    
    const algorithm = await prisma.algorithmConfig.update({
      where: { id },
      data: {
        name,
        description,
        config,
        isActive
      }
    });
    
    res.json(algorithm);
  } catch (error: any) {
    console.error('Error updating algorithm:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Algorithm not found' });
    }
    res.status(400).json({ error: 'Failed to update algorithm' });
  }
});

// Delete algorithm configuration
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.algorithmConfig.delete({ where: { id } });
    res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting algorithm:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Algorithm not found' });
    }
    res.status(400).json({ error: 'Failed to delete algorithm' });
  }
});

// Activate algorithm configuration
router.post('/:id/activate', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Deactivate all other algorithms first
    await prisma.algorithmConfig.updateMany({
      where: { isActive: true },
      data: { isActive: false }
    });
    
    // Activate the specified algorithm
    const algorithm = await prisma.algorithmConfig.update({
      where: { id },
      data: { isActive: true }
    });
    
    res.json(algorithm);
  } catch (error: any) {
    console.error('Error activating algorithm:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Algorithm not found' });
    }
    res.status(400).json({ error: 'Failed to activate algorithm' });
  }
});

// Get active algorithm configuration
router.get('/active/current', async (req, res) => {
  try {
    const activeAlgorithm = await prisma.algorithmConfig.findFirst({
      where: { isActive: true }
    });
    
    if (!activeAlgorithm) {
      return res.status(404).json({ error: 'No active algorithm found' });
    }
    
    res.json(activeAlgorithm);
  } catch (error) {
    console.error('Error fetching active algorithm:', error);
    res.status(500).json({ error: 'Failed to fetch active algorithm' });
  }
});

export default router; 