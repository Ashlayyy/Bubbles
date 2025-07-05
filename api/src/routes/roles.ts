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
import { addRoute } from '../utils/secureRoute.js';

const router = Router({ mergeParams: true });

const rolePerm = {
	discordPermissions: ['MANAGE_ROLES'],
	permissionsOverride: true,
};

addRoute(router, 'get', '/', {}, authenticateToken, getRoles);
addRoute(router, 'post', '/', rolePerm, authenticateToken, createRole);

addRoute(
	router,
	'get',
	'/auto-role',
	{},
	authenticateToken,
	getAutoRoleSettings
);
addRoute(router, 'get', '/logs', rolePerm, authenticateToken, getRoleLogs);
addRoute(
	router,
	'get',
	'/statistics',
	{},
	authenticateToken,
	getRoleStatistics
);

addRoute(router, 'get', '/:roleId', {}, authenticateToken, getRole);
addRoute(router, 'patch', '/:roleId', rolePerm, authenticateToken, updateRole);
addRoute(router, 'delete', '/:roleId', rolePerm, authenticateToken, deleteRole);
addRoute(
	router,
	'post',
	'/:roleId/assign',
	rolePerm,
	authenticateToken,
	assignRole
);
addRoute(
	router,
	'post',
	'/:roleId/remove',
	rolePerm,
	authenticateToken,
	removeRole
);

export default router;
