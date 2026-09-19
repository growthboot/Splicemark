const NEW_ACTOR_TYPES =
	new Set([
		'agent',
		'human',
		'automation'
	]);

export function normalizeNewActorType(
	value = 'agent'
) {
	if (!NEW_ACTOR_TYPES.has(value)) {
		throw new Error(
			'actor type must be agent, human, or automation'
		);
	}

	return value;
}

export function storedActorType(session) {
	const value =
		session?.actorType;

	if (value === undefined || value === null) {
		return 'unknown';
	}

	if (
		value === 'unknown' ||
		NEW_ACTOR_TYPES.has(value)
	) {
		return value;
	}

	return 'unknown';
}

export function normalizeStoredSession(session) {
	return {
		...session,
		actorType:
			storedActorType(session)
	};
}

export function actorTypeLabel(session) {
	return storedActorType(session)
		.toUpperCase();
}
