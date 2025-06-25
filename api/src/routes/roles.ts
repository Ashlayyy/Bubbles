import { Router } from 'express';
import {
	getRoles,
	getRole,
	createRole,
	updateRole,
	deleteRole,
	assignRole,
	removeRole,
	getAutoRoleSettings,
	getRoleLogs,
	getRoleStatistics,
} from '../controllers/roleController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router({ mergeParams: true });


router.get('/', authenticateToken, getRoles);

router.post('/', authenticateToken, createRole);


router.get('/auto-role', authenticateToken, getAutoRoleSettings);

router.get('/logs', authenticateToken, getRoleLogs);

router.get('/statistics', authenticateToken, getRoleStatistics);


router.get('/:roleId', authenticateToken, getRole);

router.patch('/:roleId', authenticateToken, updateRole);

router.delete('/:roleId', authenticateToken, deleteRole);

router.post('/:roleId/assign', authenticateToken, assignRole);
router.post('/:roleId/remove', authenticateToken, removeRole);

export default router;
