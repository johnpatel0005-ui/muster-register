import express from 'express';
import {
  getWorkers,
  getWorkerById,
  createWorker,
  updateWorker,
  toggleWorkerStatus,
  deleteWorker,
  getNextId,
} from '../controllers/workerController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Preview next auto-generated worker ID
router.get('/next-id', protect, getNextId);

// Worker CRUD and search
router.get('/', protect, getWorkers);
router.post('/', protect, createWorker);
router.get('/:id', protect, getWorkerById);
router.put('/:id', protect, updateWorker);
router.patch('/:id/status', protect, toggleWorkerStatus);
router.delete('/:id', protect, deleteWorker);

export default router;
