import type { Response, Request, NextFunction } from 'express';

export interface SuccessResponse<T = unknown> {
	success: true;
	data: T;
}

export interface FailureResponse {
	success: false;
	error: string;
	details?: unknown;
}

// Augment Express Response type via module augmentation
declare module 'express-serve-static-core' {
	interface Response {
		success: <T = unknown>(data: T, statusCode?: number) => void;
		failure: (error: string, statusCode?: number, details?: unknown) => void;
	}
}

export const responseEnhancer = (
	_req: Request,
	res: Response,
	next: NextFunction
) => {
	res.success = function success<T>(data: T, statusCode = 200) {
		this.status(statusCode).json({ success: true, data } as SuccessResponse<T>);
	};

	res.failure = function failure(
		error: string,
		statusCode = 400,
		details?: unknown
	) {
		const payload: FailureResponse = { success: false, error };
		if (details !== undefined) payload.details = details;
		this.status(statusCode).json(payload);
	};

	next();

	// Automatic wrapper for legacy res.json(payload)
	const originalJson = res.json.bind(res);
	(res as any).json = (body: any) => {
		// If the payload already follows new format, pass through
		if (body && typeof body === 'object' && 'success' in body) {
			return originalJson(body);
		}
		// Otherwise treat as success wrapper
		return originalJson({ success: true, data: body } as SuccessResponse);
	};
};
