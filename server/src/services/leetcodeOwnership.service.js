
import AppError from '../utils/AppError.js';

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

const OWNERSHIP_PROFILE_QUERY = `
    query userOwnershipProfile($username: String!) {
        matchedUser(username: $username) {
            username
            profile {
                aboutMe
            }
        }
    }
`;

export async function fetchLeetCodeOwnershipProfile(username) {
    if (
        typeof username !== 'string' ||
        !username.trim() ||
        username.trim().length > 100
    ) {
        throw new AppError('A valid LeetCode username is required', 400);
    }

    const requestedUsername = username.trim();

    let response;

    try {
        response = await fetch(LEETCODE_GRAPHQL_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                'User-Agent': 'DevTrack/1.0',
            },
            body: JSON.stringify({
                query: OWNERSHIP_PROFILE_QUERY,
                variables: {
                    username: requestedUsername,
                },
            }),
            signal: AbortSignal.timeout(10000),
        });
    } catch (error) {
        if (
            error.name === 'TimeoutError' ||
            error.name === 'AbortError'
        ) {
            throw new AppError(
                'LeetCode profile lookup timed out. Please try again.',
                503
            );
        }

        throw new AppError(
            'Unable to reach LeetCode. Please try again later.',
            503
        );
    }

    if (!response.ok) {
        if (response.status === 429) {
            throw new AppError(
                'LeetCode rate limit reached. Please try again later.',
                503
            );
        }

        throw new AppError(
            `LeetCode profile lookup failed with status ${response.status}.`,
            502
        );
    }

    let payload;

    try {
        payload = await response.json();
    } catch {
        throw new AppError(
            'LeetCode returned an invalid response.',
            502
        );
    }

    if (!payload || payload.errors?.length) {
        throw new AppError(
            'LeetCode could not provide public profile information.',
            502
        );
    }

    const user = payload.data?.matchedUser;

    if (!user || typeof user.username !== 'string') {
        throw new AppError(
            'LeetCode profile was not found.',
            404
        );
    }

    // Confirm that the provider returned the requested account.
    // This prevents accidentally verifying a different profile.
    if (
        user.username.toLowerCase() !==
        requestedUsername.toLowerCase()
    ) {
        throw new AppError(
            'LeetCode returned a different username than requested.',
            502
        );
    }

    const aboutMe = user.profile?.aboutMe;

    return {
        username: user.username,
        aboutMe: typeof aboutMe === 'string' ? aboutMe : '',
    };
}
