const tokens = new Map<string, { accessToken: string; refreshToken?: string }>();

export function storeDiscordTokens(
	userId: string,
	tokensPair: { accessToken: string; refreshToken?: string }
): void {
	tokens.set(userId, tokensPair);
}

export function getDiscordAccessToken(userId?: string): string | undefined {
	if (!userId) {
		return undefined;
	}
	return tokens.get(userId)?.accessToken;
}

export function clearDiscordTokens(userId?: string): void {
	if (!userId) {
		return;
	}
	tokens.delete(userId);
}
