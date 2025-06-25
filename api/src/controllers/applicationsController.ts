import type { Response } from 'express';
import { createLogger } from '../types/shared.js';
import type { AuthRequest } from '../middleware/auth.js';
import { getPrismaClient } from '../services/databaseService.js';

const logger = createLogger('applications-controller');

// Get applications
export const getApplications = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const { page = 1, limit = 50, status, formId } = req.query;
		const prisma = getPrismaClient();

		const where: any = { guildId };
		if (status) where.status = status as string;
		if (formId) where.formId = formId as string;

		const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
		const take = parseInt(limit as string);

		const [applications, total] = await Promise.all([
			prisma.application.findMany({
				where,
				orderBy: { createdAt: 'desc' },
				skip,
				take,
				include: { form: true },
			}),
			prisma.application.count({ where }),
		]);

		return res.success({
			applications,
			pagination: {
				page: parseInt(page as string),
				limit: take,
				total,
				pages: Math.ceil(total / take),
			},
		});
	} catch (error) {
		logger.error('Error fetching applications:', error);
		return res.failure('Failed to fetch applications', 500);
	}
};

// Submit application
export const submitApplication = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();
		const { formId, responses, attachments } = req.body;

		const form = await prisma.applicationForm.findFirst({
			where: { id: formId, guildId },
		});
		if (!form) {
			return res.failure('Form not found', 404);
		}

		const app = await prisma.application.create({
			data: {
				formId,
				guildId,
				userId: req.user?.id || 'unknown',
				responses,
				attachments: attachments || [],
				status: 'PENDING',
				submittedAt: new Date(),
			},
		});

		return res.success(
			{
				data: app,
				message: 'Application submitted successfully',
			},
			201
		);
	} catch (error) {
		logger.error('Error submitting application:', error);
		return res.failure('Failed to submit application', 500);
	}
};

// Get application details
export const getApplication = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId, applicationId } = req.params;
		const prisma = getPrismaClient();

		const application = await prisma.application.findFirst({
			where: { id: applicationId, guildId },
			include: { form: true },
		});
		if (!application) {
			return res.failure('Application not found', 404);
		}

		return res.success(application);
	} catch (error) {
		logger.error('Error fetching application:', error);
		return res.failure('Failed to fetch application', 500);
	}
};

// Update application status
export const updateApplicationStatus = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId, applicationId } = req.params;
		const { status, reason, notes } = req.body;
		const prisma = getPrismaClient();

		const application = await prisma.application.findFirst({
			where: { id: applicationId, guildId },
		});
		if (!application) {
			return res.failure('Application not found', 404);
		}

		const updated = await prisma.application.update({
			where: { id: applicationId },
			data: {
				status,
				reviewNotes: notes,
				reviewedBy: req.user?.id || 'unknown',
				reviewedAt: new Date(),
			},
		});

		return res.success({
			data: updated,
			message: 'Application status updated successfully',
		});
	} catch (error) {
		logger.error('Error updating application status:', error);
		return res.failure('Failed to update application status', 500);
	}
};

// Get application forms
export const getApplicationForms = async (req: AuthRequest, res: Response) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();

		const forms = await prisma.applicationForm.findMany({ where: { guildId } });
		return res.success(forms);
	} catch (error) {
		logger.error('Error fetching application forms:', error);
		return res.failure('Failed to fetch application forms', 500);
	}
};

// Create application form
export const createApplicationForm = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId } = req.params;
		const prisma = getPrismaClient();
		const formData = req.body;

		const form = await prisma.applicationForm.create({
			data: { guildId, ...formData, createdBy: req.user?.id || 'unknown' },
		});
		return res.success(
			{
				data: form,
				message: 'Application form created successfully',
			},
			201
		);
	} catch (error) {
		logger.error('Error creating application form:', error);
		return res.failure('Failed to create application form', 500);
	}
};

// Update application form
export const updateApplicationForm = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId, formId } = req.params;
		const prisma = getPrismaClient();
		const formData = req.body;

		const existing = await prisma.applicationForm.findFirst({
			where: { id: formId, guildId },
		});
		if (!existing) {
			return res.failure('Form not found', 404);
		}

		const updated = await prisma.applicationForm.update({
			where: { id: formId },
			data: { ...formData, updatedAt: new Date() },
		});
		return res.success({
			data: updated,
			message: 'Application form updated successfully',
		});
	} catch (error) {
		logger.error('Error updating application form:', error);
		return res.failure('Failed to update application form', 500);
	}
};

// Delete application form
export const deleteApplicationForm = async (
	req: AuthRequest,
	res: Response
) => {
	try {
		const { guildId, formId } = req.params;
		const prisma = getPrismaClient();

		const existing = await prisma.applicationForm.findFirst({
			where: { id: formId, guildId },
		});
		if (!existing) {
			return res.failure('Form not found', 404);
		}

		await prisma.applicationForm.delete({ where: { id: formId } });
		return res.success({ message: 'Application form deleted successfully' });
	} catch (error) {
		logger.error('Error deleting application form:', error);
		return res.failure('Failed to delete application form', 500);
	}
};
