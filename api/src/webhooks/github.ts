import crypto from 'crypto';
import { Request, Response } from 'express';
import { createLogger } from '../types/shared.js';
import { wsManager } from '../websocket/manager.js';
import { config } from '../config/index.js';

const logger = createLogger('github-webhooks');

export interface GitHubWebhookEvent {
	id: string;
	type: string;
	action?: string;
	repository: {
		id: number;
		name: string;
		full_name: string;
		owner: {
			login: string;
			avatar_url: string;
		};
		html_url: string;
		description?: string;
		private: boolean;
	};
	sender: {
		login: string;
		avatar_url: string;
		html_url: string;
	};
	timestamp: number;
	data: any;
}

export class GitHubWebhookHandler {
	private secret: string;

	constructor(secret: string) {
		this.secret = secret;
	}

	public async handleWebhook(req: Request, res: Response): Promise<void> {
		try {
			// Verify webhook signature
			if (!this.verifySignature(req)) {
				logger.warn('Invalid GitHub webhook signature');
				res.status(401).json({ error: 'Invalid signature' });
				return;
			}

			const eventType = req.headers['x-github-event'] as string;
			const deliveryId = req.headers['x-github-delivery'] as string;
			const payload = req.body;

			logger.info(`Received GitHub webhook: ${eventType} (${deliveryId})`);

			// Process the webhook event
			const processedEvent = await this.processEvent(
				eventType,
				payload,
				deliveryId
			);

			if (processedEvent) {
				// Broadcast to WebSocket clients
				this.broadcastEvent(processedEvent);

				// Store event for later retrieval
				await this.storeEvent(processedEvent);
			}

			res.status(200).json({ success: true, eventId: deliveryId });
		} catch (error) {
			logger.error('Error handling GitHub webhook:', error);
			res.status(500).json({ error: 'Internal server error' });
		}
	}

	private verifySignature(req: Request): boolean {
		const signature = req.headers['x-hub-signature-256'] as string;
		if (!signature) {
			return false;
		}

		const expectedSignature = crypto
			.createHmac('sha256', this.secret)
			.update(JSON.stringify(req.body))
			.digest('hex');

		const expectedSignatureWithPrefix = `sha256=${expectedSignature}`;

		return crypto.timingSafeEqual(
			Buffer.from(signature),
			Buffer.from(expectedSignatureWithPrefix)
		);
	}

	private async processEvent(
		eventType: string,
		payload: any,
		deliveryId: string
	): Promise<GitHubWebhookEvent | null> {
		const baseEvent: Partial<GitHubWebhookEvent> = {
			id: deliveryId,
			type: eventType,
			action: payload.action,
			repository: payload.repository
				? {
						id: payload.repository.id,
						name: payload.repository.name,
						full_name: payload.repository.full_name,
						owner: {
							login: payload.repository.owner.login,
							avatar_url: payload.repository.owner.avatar_url,
						},
						html_url: payload.repository.html_url,
						description: payload.repository.description,
						private: payload.repository.private,
				  }
				: undefined,
			sender: payload.sender
				? {
						login: payload.sender.login,
						avatar_url: payload.sender.avatar_url,
						html_url: payload.sender.html_url,
				  }
				: undefined,
			timestamp: Date.now(),
		};

		switch (eventType) {
			case 'push':
				return this.processPushEvent(baseEvent, payload);

			case 'pull_request':
				return this.processPullRequestEvent(baseEvent, payload);

			case 'issues':
				return this.processIssuesEvent(baseEvent, payload);

			case 'issue_comment':
				return this.processIssueCommentEvent(baseEvent, payload);

			case 'release':
				return this.processReleaseEvent(baseEvent, payload);

			case 'star':
				return this.processStarEvent(baseEvent, payload);

			case 'fork':
				return this.processForkEvent(baseEvent, payload);

			case 'watch':
				return this.processWatchEvent(baseEvent, payload);

			case 'deployment':
				return this.processDeploymentEvent(baseEvent, payload);

			case 'deployment_status':
				return this.processDeploymentStatusEvent(baseEvent, payload);

			case 'workflow_run':
				return this.processWorkflowRunEvent(baseEvent, payload);

			case 'workflow_job':
				return this.processWorkflowJobEvent(baseEvent, payload);

			case 'check_run':
				return this.processCheckRunEvent(baseEvent, payload);

			case 'check_suite':
				return this.processCheckSuiteEvent(baseEvent, payload);

			default:
				logger.info(`Unhandled GitHub event type: ${eventType}`);
				return this.processGenericEvent(baseEvent, payload);
		}
	}

	private processPushEvent(
		baseEvent: Partial<GitHubWebhookEvent>,
		payload: any
	): GitHubWebhookEvent {
		return {
			...baseEvent,
			data: {
				ref: payload.ref,
				before: payload.before,
				after: payload.after,
				commits:
					payload.commits?.map((commit: any) => ({
						id: commit.id,
						message: commit.message,
						author: commit.author,
						url: commit.url,
						timestamp: commit.timestamp,
					})) || [],
				head_commit: payload.head_commit
					? {
							id: payload.head_commit.id,
							message: payload.head_commit.message,
							author: payload.head_commit.author,
							url: payload.head_commit.url,
							timestamp: payload.head_commit.timestamp,
					  }
					: null,
				pusher: payload.pusher,
				forced: payload.forced,
				created: payload.created,
				deleted: payload.deleted,
				compare: payload.compare,
			},
		} as GitHubWebhookEvent;
	}

	private processPullRequestEvent(
		baseEvent: Partial<GitHubWebhookEvent>,
		payload: any
	): GitHubWebhookEvent {
		return {
			...baseEvent,
			data: {
				number: payload.number,
				pull_request: {
					id: payload.pull_request.id,
					number: payload.pull_request.number,
					title: payload.pull_request.title,
					body: payload.pull_request.body,
					state: payload.pull_request.state,
					draft: payload.pull_request.draft,
					merged: payload.pull_request.merged,
					mergeable: payload.pull_request.mergeable,
					user: {
						login: payload.pull_request.user.login,
						avatar_url: payload.pull_request.user.avatar_url,
					},
					head: {
						ref: payload.pull_request.head.ref,
						sha: payload.pull_request.head.sha,
					},
					base: {
						ref: payload.pull_request.base.ref,
						sha: payload.pull_request.base.sha,
					},
					html_url: payload.pull_request.html_url,
					created_at: payload.pull_request.created_at,
					updated_at: payload.pull_request.updated_at,
					merged_at: payload.pull_request.merged_at,
				},
			},
		} as GitHubWebhookEvent;
	}

	private processIssuesEvent(
		baseEvent: Partial<GitHubWebhookEvent>,
		payload: any
	): GitHubWebhookEvent {
		return {
			...baseEvent,
			data: {
				issue: {
					id: payload.issue.id,
					number: payload.issue.number,
					title: payload.issue.title,
					body: payload.issue.body,
					state: payload.issue.state,
					user: {
						login: payload.issue.user.login,
						avatar_url: payload.issue.user.avatar_url,
					},
					labels:
						payload.issue.labels?.map((label: any) => ({
							name: label.name,
							color: label.color,
							description: label.description,
						})) || [],
					assignees:
						payload.issue.assignees?.map((assignee: any) => ({
							login: assignee.login,
							avatar_url: assignee.avatar_url,
						})) || [],
					html_url: payload.issue.html_url,
					created_at: payload.issue.created_at,
					updated_at: payload.issue.updated_at,
				},
			},
		} as GitHubWebhookEvent;
	}

	private processIssueCommentEvent(
		baseEvent: Partial<GitHubWebhookEvent>,
		payload: any
	): GitHubWebhookEvent {
		return {
			...baseEvent,
			data: {
				issue: {
					id: payload.issue.id,
					number: payload.issue.number,
					title: payload.issue.title,
					html_url: payload.issue.html_url,
				},
				comment: {
					id: payload.comment.id,
					body: payload.comment.body,
					user: {
						login: payload.comment.user.login,
						avatar_url: payload.comment.user.avatar_url,
					},
					html_url: payload.comment.html_url,
					created_at: payload.comment.created_at,
					updated_at: payload.comment.updated_at,
				},
			},
		} as GitHubWebhookEvent;
	}

	private processReleaseEvent(
		baseEvent: Partial<GitHubWebhookEvent>,
		payload: any
	): GitHubWebhookEvent {
		return {
			...baseEvent,
			data: {
				release: {
					id: payload.release.id,
					tag_name: payload.release.tag_name,
					name: payload.release.name,
					body: payload.release.body,
					draft: payload.release.draft,
					prerelease: payload.release.prerelease,
					author: {
						login: payload.release.author.login,
						avatar_url: payload.release.author.avatar_url,
					},
					html_url: payload.release.html_url,
					tarball_url: payload.release.tarball_url,
					zipball_url: payload.release.zipball_url,
					created_at: payload.release.created_at,
					published_at: payload.release.published_at,
				},
			},
		} as GitHubWebhookEvent;
	}

	private processStarEvent(
		baseEvent: Partial<GitHubWebhookEvent>,
		payload: any
	): GitHubWebhookEvent {
		return {
			...baseEvent,
			data: {
				starred_at: payload.starred_at,
				stargazers_count: payload.repository?.stargazers_count,
			},
		} as GitHubWebhookEvent;
	}

	private processForkEvent(
		baseEvent: Partial<GitHubWebhookEvent>,
		payload: any
	): GitHubWebhookEvent {
		return {
			...baseEvent,
			data: {
				forkee: {
					id: payload.forkee.id,
					name: payload.forkee.name,
					full_name: payload.forkee.full_name,
					owner: {
						login: payload.forkee.owner.login,
						avatar_url: payload.forkee.owner.avatar_url,
					},
					html_url: payload.forkee.html_url,
					created_at: payload.forkee.created_at,
				},
				forks_count: payload.repository?.forks_count,
			},
		} as GitHubWebhookEvent;
	}

	private processWatchEvent(
		baseEvent: Partial<GitHubWebhookEvent>,
		payload: any
	): GitHubWebhookEvent {
		return {
			...baseEvent,
			data: {
				watchers_count: payload.repository?.watchers_count,
			},
		} as GitHubWebhookEvent;
	}

	private processDeploymentEvent(
		baseEvent: Partial<GitHubWebhookEvent>,
		payload: any
	): GitHubWebhookEvent {
		return {
			...baseEvent,
			data: {
				deployment: {
					id: payload.deployment.id,
					sha: payload.deployment.sha,
					ref: payload.deployment.ref,
					environment: payload.deployment.environment,
					description: payload.deployment.description,
					creator: {
						login: payload.deployment.creator.login,
						avatar_url: payload.deployment.creator.avatar_url,
					},
					created_at: payload.deployment.created_at,
					updated_at: payload.deployment.updated_at,
				},
			},
		} as GitHubWebhookEvent;
	}

	private processDeploymentStatusEvent(
		baseEvent: Partial<GitHubWebhookEvent>,
		payload: any
	): GitHubWebhookEvent {
		return {
			...baseEvent,
			data: {
				deployment_status: {
					id: payload.deployment_status.id,
					state: payload.deployment_status.state,
					description: payload.deployment_status.description,
					target_url: payload.deployment_status.target_url,
					environment: payload.deployment_status.environment,
					creator: {
						login: payload.deployment_status.creator.login,
						avatar_url: payload.deployment_status.creator.avatar_url,
					},
					created_at: payload.deployment_status.created_at,
					updated_at: payload.deployment_status.updated_at,
				},
				deployment: {
					id: payload.deployment.id,
					sha: payload.deployment.sha,
					ref: payload.deployment.ref,
					environment: payload.deployment.environment,
				},
			},
		} as GitHubWebhookEvent;
	}

	private processWorkflowRunEvent(
		baseEvent: Partial<GitHubWebhookEvent>,
		payload: any
	): GitHubWebhookEvent {
		return {
			...baseEvent,
			data: {
				workflow_run: {
					id: payload.workflow_run.id,
					name: payload.workflow_run.name,
					head_branch: payload.workflow_run.head_branch,
					head_sha: payload.workflow_run.head_sha,
					status: payload.workflow_run.status,
					conclusion: payload.workflow_run.conclusion,
					workflow_id: payload.workflow_run.workflow_id,
					check_suite_id: payload.workflow_run.check_suite_id,
					url: payload.workflow_run.url,
					html_url: payload.workflow_run.html_url,
					created_at: payload.workflow_run.created_at,
					updated_at: payload.workflow_run.updated_at,
					run_started_at: payload.workflow_run.run_started_at,
				},
				workflow: {
					id: payload.workflow.id,
					name: payload.workflow.name,
					path: payload.workflow.path,
				},
			},
		} as GitHubWebhookEvent;
	}

	private processWorkflowJobEvent(
		baseEvent: Partial<GitHubWebhookEvent>,
		payload: any
	): GitHubWebhookEvent {
		return {
			...baseEvent,
			data: {
				workflow_job: {
					id: payload.workflow_job.id,
					run_id: payload.workflow_job.run_id,
					name: payload.workflow_job.name,
					status: payload.workflow_job.status,
					conclusion: payload.workflow_job.conclusion,
					head_sha: payload.workflow_job.head_sha,
					url: payload.workflow_job.url,
					html_url: payload.workflow_job.html_url,
					created_at: payload.workflow_job.created_at,
					started_at: payload.workflow_job.started_at,
					completed_at: payload.workflow_job.completed_at,
				},
			},
		} as GitHubWebhookEvent;
	}

	private processCheckRunEvent(
		baseEvent: Partial<GitHubWebhookEvent>,
		payload: any
	): GitHubWebhookEvent {
		return {
			...baseEvent,
			data: {
				check_run: {
					id: payload.check_run.id,
					name: payload.check_run.name,
					head_sha: payload.check_run.head_sha,
					status: payload.check_run.status,
					conclusion: payload.check_run.conclusion,
					url: payload.check_run.url,
					html_url: payload.check_run.html_url,
					details_url: payload.check_run.details_url,
					started_at: payload.check_run.started_at,
					completed_at: payload.check_run.completed_at,
				},
			},
		} as GitHubWebhookEvent;
	}

	private processCheckSuiteEvent(
		baseEvent: Partial<GitHubWebhookEvent>,
		payload: any
	): GitHubWebhookEvent {
		return {
			...baseEvent,
			data: {
				check_suite: {
					id: payload.check_suite.id,
					head_branch: payload.check_suite.head_branch,
					head_sha: payload.check_suite.head_sha,
					status: payload.check_suite.status,
					conclusion: payload.check_suite.conclusion,
					url: payload.check_suite.url,
					before: payload.check_suite.before,
					after: payload.check_suite.after,
					created_at: payload.check_suite.created_at,
					updated_at: payload.check_suite.updated_at,
				},
			},
		} as GitHubWebhookEvent;
	}

	private processGenericEvent(
		baseEvent: Partial<GitHubWebhookEvent>,
		payload: any
	): GitHubWebhookEvent {
		return {
			...baseEvent,
			data: payload,
		} as GitHubWebhookEvent;
	}

	private broadcastEvent(event: GitHubWebhookEvent): void {
		// Broadcast to all connected WebSocket clients interested in GitHub events
		wsManager.broadcastToAll(
			{
				type: 'GITHUB_EVENT',
				event: event.type,
				data: event,
				timestamp: Date.now(),
				messageId: `github_${event.id}`,
			},
			(connection) => {
				// Only send to clients subscribed to GitHub events
				return (
					connection.metadata.subscriptions?.includes('GITHUB_EVENTS') ||
					connection.metadata.subscriptions?.includes(
						`GITHUB_${event.type.toUpperCase()}`
					)
				);
			}
		);

		logger.info(`Broadcasted GitHub ${event.type} event to WebSocket clients`);
	}

	private async storeEvent(event: GitHubWebhookEvent): Promise<void> {
		// TODO: Implement event storage (database, Redis, etc.)
		// For now, just log the event
		logger.info(`Stored GitHub event: ${event.type} - ${event.id}`);
	}

	public getEventHistory(
		limit: number = 50,
		eventType?: string
	): GitHubWebhookEvent[] {
		// TODO: Implement event history retrieval
		// This would fetch from your storage system
		return [];
	}

	public getEventStats(): any {
		// TODO: Implement event statistics
		return {
			totalEvents: 0,
			eventsByType: {},
			recentEvents: [],
		};
	}
}

// Create singleton instance
export const githubWebhookHandler = new GitHubWebhookHandler(
	process.env.GITHUB_WEBHOOK_SECRET || 'default-secret'
);
