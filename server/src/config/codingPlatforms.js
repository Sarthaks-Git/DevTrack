
const codingPlatforms = {
    leetcode: {
        id: 'leetcode',
        displayName: 'LeetCode',
        profileUrl: 'https://leetcode.com/u/{username}/',
        statsIntegration: 'available',
        verificationIntegration: 'needs-validation',
    },

    'leetcode-cn': {
        id: 'leetcode-cn',
        displayName: 'LeetCode China',
        profileUrl: 'https://leetcode.cn/u/{username}/',
        statsIntegration: 'needs-validation',
        verificationIntegration: 'needs-validation',
    },

    codeforces: {
        id: 'codeforces',
        displayName: 'Codeforces',
        profileUrl: 'https://codeforces.com/profile/{username}',
        statsIntegration: 'needs-validation',
        verificationIntegration: 'needs-validation',
    },

    codechef: {
        id: 'codechef',
        displayName: 'CodeChef',
        profileUrl: 'https://www.codechef.com/users/{username}',
        statsIntegration: 'needs-validation',
        verificationIntegration: 'needs-validation',
    },

    hackerrank: {
        id: 'hackerrank',
        displayName: 'HackerRank',
        profileUrl: 'https://www.hackerrank.com/profile/{username}',
        statsIntegration: 'needs-validation',
        verificationIntegration: 'needs-validation',
    },
};

export const CODING_PLATFORMS = Object.freeze(codingPlatforms);

export const CODING_PLATFORM_IDS = Object.freeze(
    Object.keys(CODING_PLATFORMS)
);

export function normalizePlatform(platform) {
    if (typeof platform !== 'string') {
        return null;
    }

    const normalized = platform.trim().toLowerCase();

    return Object.hasOwn(CODING_PLATFORMS, normalized)
        ? normalized
        : null;
}

export function getCodingPlatform(platform) {
    const normalized = normalizePlatform(platform);

    return normalized
        ? CODING_PLATFORMS[normalized]
        : null;
}

// Preserve username casing until each platform's identity rules have
// been verified. Do not assume every provider treats handles alike.
export function normalizePlatformUsername(platform, username) {
    const normalizedPlatform = normalizePlatform(platform);

    if (!normalizedPlatform || typeof username !== 'string') {
        return null;
    }

    const trimmedUsername = username.trim();

    if (
        trimmedUsername.length < 1 ||
        trimmedUsername.length > 100
    ) {
        return null;
    }

    return trimmedUsername;
}

export function buildCodingProfileUrl(platform, username) {
    const config = getCodingPlatform(platform);
    const normalizedUsername = normalizePlatformUsername(
        platform,
        username
    );

    if (!config || !normalizedUsername) {
        return null;
    }

    return config.profileUrl.replace(
        '{username}',
        encodeURIComponent(normalizedUsername)
    );
}
