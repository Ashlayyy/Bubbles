import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '@bubbles/shared';
import { validateRequest } from '../validation/zodValidate.js';

// Validation schemas
const analyticsQuerySchema = z.object({
	startDate: z
		.string()
		.transform((str) => new Date(str))
		.optional(),
	endDate: z
		.string()
		.transform((str) => new Date(str))
		.optional(),
	category: z.string().optional(),
	assigneeId: z.string().optional(),
	period: z.enum(['day', 'week', 'month']).default('day'),
	limit: z.number().int().min(1).max(100).default(30),
});

const satisfactionSurveySchema = z.object({
	overallSatisfaction: z.number().int().min(1).max(5),
	responseSpeed: z.number().int().min(1).max(5).optional(),
	helpfulness: z.number().int().min(1).max(5).optional(),
	professionalism: z.number().int().min(1).max(5).optional(),
	resolutionQuality: z.number().int().min(1).max(5).optional(),
	feedback: z.string().max(1000).optional(),
	suggestions: z.string().max(1000).optional(),
	wouldRecommend: z.boolean().optional(),
});

/**
 * Get overall ticket analytics for a guild
 */
export const getTicketAnalytics = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId } = req.params;
		const validation = validateRequest(analyticsQuerySchema, req.query);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid query parameters',
				details: validation.error.issues,
			});
			return;
		}

		const { startDate, endDate, category, assigneeId, period, limit } =
			validation.data;

		// Default to last 30 days if no date range provided
		const defaultEndDate = endDate || new Date();
		const defaultStartDate =
			startDate ||
			new Date(defaultEndDate.getTime() - 30 * 24 * 60 * 60 * 1000);

		const whereClause: any = {
			guildId,
			createdAt: {
				gte: defaultStartDate,
				lte: defaultEndDate,
			},
		};

		if (category) {
			whereClause.category = category;
		}

		if (assigneeId) {
			whereClause.assigneeId = assigneeId;
		}

		// Get basic analytics
		const [
			totalTickets,
			resolvedTickets,
			avgMetrics,
			categoryBreakdown,
			priorityBreakdown,
		] = await Promise.all([
			// Total tickets
			prisma.ticketAnalytics.count({
				where: whereClause,
			}),

			// Resolved tickets
			prisma.ticketAnalytics.count({
				where: {
					...whereClause,
					resolvedAt: { not: null },
				},
			}),

			// Average metrics
			prisma.ticketAnalytics.aggregate({
				where: whereClause,
				_avg: {
					firstResponseTime: true,
					resolutionTime: true,
					satisfactionScore: true,
					messageCount: true,
				},
			}),

			// Category breakdown
			prisma.ticketAnalytics.groupBy({
				by: ['category'],
				where: whereClause,
				_count: {
					id: true,
				},
				_avg: {
					firstResponseTime: true,
					resolutionTime: true,
					satisfactionScore: true,
				},
			}),

			// Priority breakdown
			prisma.ticketAnalytics.groupBy({
				by: ['priority'],
				where: whereClause,
				_count: {
					id: true,
				},
				_avg: {
					firstResponseTime: true,
					resolutionTime: true,
				},
			}),
		]);

		// Get time series data
		const timeSeriesData = await getTimeSeriesData(
			guildId,
			defaultStartDate,
			defaultEndDate,
			period,
			category,
			assigneeId
		);

		// Get top performers
		const topPerformers = await getTopPerformers(
			guildId,
			defaultStartDate,
			defaultEndDate,
			category
		);

		const resolutionRate =
			totalTickets > 0 ? (resolvedTickets / totalTickets) * 100 : 0;

		res.json({
			success: true,
			data: {
				summary: {
					totalTickets,
					resolvedTickets,
					resolutionRate: Math.round(resolutionRate * 100) / 100,
					avgFirstResponseTime: avgMetrics._avg.firstResponseTime,
					avgResolutionTime: avgMetrics._avg.resolutionTime,
					avgSatisfactionScore: avgMetrics._avg.satisfactionScore,
					avgMessageCount: avgMetrics._avg.messageCount,
				},
				categoryBreakdown,
				priorityBreakdown,
				timeSeriesData,
				topPerformers,
				dateRange: {
					startDate: defaultStartDate,
					endDate: defaultEndDate,
				},
			},
		});
	} catch (error) {
		console.error('Error fetching ticket analytics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch ticket analytics',
		});
	}
};

/**
 * Get response time analytics
 */
export const getResponseTimeAnalytics = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId } = req.params;
		const validation = validateRequest(analyticsQuerySchema, req.query);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid query parameters',
				details: validation.error.issues,
			});
			return;
		}

		const { startDate, endDate, category, assigneeId } = validation.data;

		const defaultEndDate = endDate || new Date();
		const defaultStartDate =
			startDate ||
			new Date(defaultEndDate.getTime() - 30 * 24 * 60 * 60 * 1000);

		const whereClause: any = {
			guildId,
			createdAt: {
				gte: defaultStartDate,
				lte: defaultEndDate,
			},
			firstResponseTime: { not: null },
		};

		if (category) {
			whereClause.category = category;
		}

		if (assigneeId) {
			whereClause.assigneeId = assigneeId;
		}

		// Get response time distribution
		const responseTimeRanges = [
			{ label: '< 5 min', min: 0, max: 5 },
			{ label: '5-15 min', min: 5, max: 15 },
			{ label: '15-30 min', min: 15, max: 30 },
			{ label: '30-60 min', min: 30, max: 60 },
			{ label: '1-2 hours', min: 60, max: 120 },
			{ label: '2-4 hours', min: 120, max: 240 },
			{ label: '4-8 hours', min: 240, max: 480 },
			{ label: '> 8 hours', min: 480, max: Infinity },
		];

		const distribution = await Promise.all(
			responseTimeRanges.map(async (range) => {
				const count = await prisma.ticketAnalytics.count({
					where: {
						...whereClause,
						firstResponseTime: {
							gte: range.min,
							...(range.max !== Infinity && { lt: range.max }),
						},
					},
				});

				return {
					label: range.label,
					count,
					range: {
						min: range.min,
						max: range.max === Infinity ? null : range.max,
					},
				};
			})
		);

		// Get percentiles
		const allResponseTimes = await prisma.ticketAnalytics.findMany({
			where: whereClause,
			select: { firstResponseTime: true },
			orderBy: { firstResponseTime: 'asc' },
		});

		const responseTimes = allResponseTimes
			.map((t: any) => t.firstResponseTime)
			.filter((t: any) => t !== null) as number[];

		const percentiles = calculatePercentiles(
			responseTimes,
			[50, 75, 90, 95, 99]
		);

		// Get trends by hour of day
		const hourlyTrends = await getHourlyResponseTrends(
			guildId,
			defaultStartDate,
			defaultEndDate,
			category,
			assigneeId
		);

		res.json({
			success: true,
			data: {
				distribution,
				percentiles,
				hourlyTrends,
				totalTicketsWithResponse: responseTimes.length,
			},
		});
	} catch (error) {
		console.error('Error fetching response time analytics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch response time analytics',
		});
	}
};

/**
 * Get satisfaction score analytics
 */
export const getSatisfactionAnalytics = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId } = req.params;
		const validation = validateRequest(analyticsQuerySchema, req.query);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid query parameters',
				details: validation.error.issues,
			});
			return;
		}

		const { startDate, endDate, category, assigneeId } = validation.data;

		const defaultEndDate = endDate || new Date();
		const defaultStartDate =
			startDate ||
			new Date(defaultEndDate.getTime() - 30 * 24 * 60 * 60 * 1000);

		const whereClause: any = {
			guildId,
			submittedAt: {
				gte: defaultStartDate,
				lte: defaultEndDate,
			},
		};

		if (category) {
			whereClause.category = category;
		}

		if (assigneeId) {
			whereClause.assigneeId = assigneeId;
		}

		// Get satisfaction metrics
		const [
			overallMetrics,
			scoreDistribution,
			categoryBreakdown,
			assigneeBreakdown,
		] = await Promise.all([
			// Overall metrics
			prisma.ticketSatisfactionSurvey.aggregate({
				where: whereClause,
				_avg: {
					overallSatisfaction: true,
					responseSpeed: true,
					helpfulness: true,
					professionalism: true,
					resolutionQuality: true,
				},
				_count: {
					id: true,
				},
			}),

			// Score distribution
			prisma.ticketSatisfactionSurvey.groupBy({
				by: ['overallSatisfaction'],
				where: whereClause,
				_count: {
					id: true,
				},
				orderBy: {
					overallSatisfaction: 'asc',
				},
			}),

			// Category breakdown
			prisma.ticketSatisfactionSurvey.groupBy({
				by: ['category'],
				where: whereClause,
				_avg: {
					overallSatisfaction: true,
					responseSpeed: true,
					helpfulness: true,
					professionalism: true,
					resolutionQuality: true,
				},
				_count: {
					id: true,
				},
			}),

			// Assignee breakdown
			prisma.ticketSatisfactionSurvey.groupBy({
				by: ['assigneeId'],
				where: {
					...whereClause,
					assigneeId: { not: null },
				},
				_avg: {
					overallSatisfaction: true,
				},
				_count: {
					id: true,
				},
				orderBy: {
					_avg: {
						overallSatisfaction: 'desc',
					},
				},
				take: 10,
			}),
		]);

		// Get recent feedback
		const recentFeedback = await prisma.ticketSatisfactionSurvey.findMany({
			where: {
				...whereClause,
				feedback: { not: null },
			},
			select: {
				overallSatisfaction: true,
				feedback: true,
				category: true,
				submittedAt: true,
			},
			orderBy: { submittedAt: 'desc' },
			take: 10,
		});

		// Calculate Net Promoter Score (NPS) equivalent
		const wouldRecommendData = await prisma.ticketSatisfactionSurvey.groupBy({
			by: ['wouldRecommend'],
			where: {
				...whereClause,
				wouldRecommend: { not: null },
			},
			_count: {
				id: true,
			},
		});

		const totalRecommendResponses = wouldRecommendData.reduce(
			(sum: number, item: any) => sum + item._count.id,
			0
		);
		const positiveRecommendations =
			wouldRecommendData.find((item: any) => item.wouldRecommend === true)
				?._count.id || 0;
		const npsScore =
			totalRecommendResponses > 0
				? (positiveRecommendations / totalRecommendResponses) * 100
				: 0;

		res.json({
			success: true,
			data: {
				overallMetrics,
				scoreDistribution,
				categoryBreakdown,
				assigneeBreakdown,
				recentFeedback,
				npsScore: Math.round(npsScore * 100) / 100,
				totalResponses: overallMetrics._count.id,
			},
		});
	} catch (error) {
		console.error('Error fetching satisfaction analytics:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch satisfaction analytics',
		});
	}
};

/**
 * Submit a satisfaction survey
 */
export const submitSatisfactionSurvey = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId, ticketId } = req.params;
		const validation = validateRequest(satisfactionSurveySchema, req.body);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid survey data',
				details: validation.error.issues,
			});
			return;
		}

		const data = validation.data;

		// Get ticket details
		const ticket = await prisma.ticket.findFirst({
			where: {
				id: ticketId,
				guildId,
			},
		});

		if (!ticket) {
			res.status(404).json({
				success: false,
				error: 'Ticket not found',
			});
			return;
		}

		// Check if survey already exists
		const existingSurvey = await prisma.ticketSatisfactionSurvey.findFirst({
			where: { ticketId },
		});

		if (existingSurvey) {
			res.status(409).json({
				success: false,
				error: 'Satisfaction survey already submitted for this ticket',
			});
			return;
		}

		// Create survey
		const survey = await prisma.ticketSatisfactionSurvey.create({
			data: {
				...data,
				guildId,
				ticketId,
				userId: ticket.userId,
				assigneeId: ticket.assignedTo,
				category: ticket.category,
			},
		});

		// Update ticket analytics with satisfaction score
		await prisma.ticketAnalytics.upsert({
			where: { ticketId },
			update: {
				satisfactionScore: data.overallSatisfaction,
				satisfactionFeedback: data.feedback,
			},
			create: {
				guildId,
				ticketId,
				category: ticket.category,
				assigneeId: ticket.assignedTo,
				createdAt: ticket.createdAt,
				satisfactionScore: data.overallSatisfaction,
				satisfactionFeedback: data.feedback,
			},
		});

		res.status(201).json({
			success: true,
			data: survey,
		});
	} catch (error) {
		console.error('Error submitting satisfaction survey:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to submit satisfaction survey',
		});
	}
};

/**
 * Get staff performance metrics
 */
export const getStaffPerformance = async (
	req: Request,
	res: Response
): Promise<void> => {
	try {
		const { guildId } = req.params;
		const validation = validateRequest(analyticsQuerySchema, req.query);

		if (!validation.success) {
			res.status(400).json({
				success: false,
				error: 'Invalid query parameters',
				details: validation.error.issues,
			});
			return;
		}

		const { startDate, endDate, period } = validation.data;

		const defaultEndDate = endDate || new Date();
		const defaultStartDate =
			startDate ||
			new Date(defaultEndDate.getTime() - 30 * 24 * 60 * 60 * 1000);

		// Get staff metrics for the period
		const staffMetrics = await prisma.ticketStaffMetrics.findMany({
			where: {
				guildId,
				period: period.toUpperCase(),
				periodStart: { gte: defaultStartDate },
				periodEnd: { lte: defaultEndDate },
			},
			orderBy: [
				{ avgSatisfactionScore: 'desc' },
				{ avgFirstResponseTime: 'asc' },
			],
		});

		// Get detailed analytics per staff member
		const staffAnalytics = await prisma.ticketAnalytics.groupBy({
			by: ['assigneeId'],
			where: {
				guildId,
				assigneeId: { not: null },
				createdAt: {
					gte: defaultStartDate,
					lte: defaultEndDate,
				},
			},
			_count: {
				id: true,
			},
			_avg: {
				firstResponseTime: true,
				resolutionTime: true,
				satisfactionScore: true,
			},
		});

		res.json({
			success: true,
			data: {
				staffMetrics,
				staffAnalytics,
				period: {
					start: defaultStartDate,
					end: defaultEndDate,
					type: period,
				},
			},
		});
	} catch (error) {
		console.error('Error fetching staff performance:', error);
		res.status(500).json({
			success: false,
			error: 'Failed to fetch staff performance',
		});
	}
};

// Helper functions

async function getTimeSeriesData(
	guildId: string,
	startDate: Date,
	endDate: Date,
	period: string,
	category?: string,
	assigneeId?: string
): Promise<any[]> {
	const whereClause: any = {
		guildId,
		date: {
			gte: startDate,
			lte: endDate,
		},
	};

	if (category) {
		whereClause.category = category;
	}

	if (assigneeId) {
		whereClause.assigneeId = assigneeId;
	}

	return await prisma.ticketDailyStats.findMany({
		where: whereClause,
		orderBy: { date: 'asc' },
	});
}

async function getTopPerformers(
	guildId: string,
	startDate: Date,
	endDate: Date,
	category?: string
): Promise<any[]> {
	const whereClause: any = {
		guildId,
		createdAt: {
			gte: startDate,
			lte: endDate,
		},
		assigneeId: { not: null },
	};

	if (category) {
		whereClause.category = category;
	}

	return await prisma.ticketAnalytics.groupBy({
		by: ['assigneeId'],
		where: whereClause,
		_count: {
			id: true,
		},
		_avg: {
			firstResponseTime: true,
			resolutionTime: true,
			satisfactionScore: true,
		},
		orderBy: {
			_avg: {
				satisfactionScore: 'desc',
			},
		},
		take: 10,
	});
}

function calculatePercentiles(
	values: number[],
	percentiles: number[]
): Record<string, number> {
	const sorted = values.sort((a, b) => a - b);
	const result: Record<string, number> = {};

	percentiles.forEach((p) => {
		const index = Math.ceil((p / 100) * sorted.length) - 1;
		result[`p${p}`] = sorted[Math.max(0, index)] || 0;
	});

	return result;
}

async function getHourlyResponseTrends(
	guildId: string,
	startDate: Date,
	endDate: Date,
	category?: string,
	assigneeId?: string
): Promise<any[]> {
	// This would require raw SQL or more complex aggregation
	// For now, return empty array - can be implemented with raw queries
	return [];
}
