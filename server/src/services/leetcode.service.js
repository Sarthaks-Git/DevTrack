
const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

const PROFILE_STATS_QUERY = `
    query userProfileStats($username: String!) {
        allQuestionsCount {
            difficulty
            count
        }
        matchedUser(username: $username) {
            username
            submitStats {
                acSubmissionNum {
                    difficulty
                    count
                }
            }
            userCalendar {
                submissionCalendar
            }
            profile {
                ranking
            }
        }
        userContestRanking(username: $username) {
            rating
        }
    }
`;

export async function fetchLeetCodeStats(username) {
    if (typeof username !== 'string' || !username.trim()) {
        throw new Error('A valid LeetCode username is required');
    }

    const normalizedUsername = username.trim();

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
                query: PROFILE_STATS_QUERY,
                variables: {
                    username: normalizedUsername,
                },
            }),
            signal: AbortSignal.timeout(10000),
        });
    } catch (error) {
        if (
            error.name === 'TimeoutError' ||
            error.name === 'AbortError'
        ) {
            throw new Error(
                'LeetCode request timed out. Please try again.'
            );
        }

        throw new Error(
            'Unable to reach LeetCode. Please try again later.'
        );
    }

    if (!response.ok) {
        if (response.status === 429) {
            throw new Error(
                'LeetCode rate limit reached. Try again later.'
            );
        }

        throw new Error(
            `LeetCode request failed with status ${response.status}`
        );
    }

    let payload;

    try {
        payload = await response.json();
    } catch {
        throw new Error('LeetCode returned an invalid response.');
    }

    if (payload.errors?.length) {
        throw new Error(
            'LeetCode could not provide profile statistics.'
        );
    }

    const data = payload.data;
    const user = data?.matchedUser;

    if (!user) {
        throw new Error('LeetCode profile was not found.');
    }

    const submissions = user.submitStats?.acSubmissionNum;

    if (!Array.isArray(submissions)) {
        throw new Error(
            'LeetCode returned an unexpected statistics format.'
        );
    }

    const questionCounts = data.allQuestionsCount;

    if (!Array.isArray(questionCounts)) {
        throw new Error(
            'LeetCode did not provide available question counts.'
        );
    }

    function getCount(items, difficulty) {
        const entry = items.find(
            (item) => item.difficulty === difficulty
        );

        return typeof entry?.count === 'number' &&
            Number.isFinite(entry.count) &&
            entry.count >= 0
            ? entry.count
            : null;
    }

    const easySolved = getCount(submissions, 'Easy');
    const mediumSolved = getCount(submissions, 'Medium');
    const hardSolved = getCount(submissions, 'Hard');
    const totalSolved = getCount(submissions, 'All');

    const easyAvailable = getCount(questionCounts, 'Easy');
    const mediumAvailable = getCount(questionCounts, 'Medium');
    const hardAvailable = getCount(questionCounts, 'Hard');
    const totalAvailable = getCount(questionCounts, 'All');

    const rating = data.userContestRanking?.rating;

    // LeetCode returns submissionCalendar as a JSON string.
    // Parse it before returning the stats to the backend service.
    const rawCalendar =
        user.userCalendar?.submissionCalendar;

    let submissionCalendar = {};

    if (typeof rawCalendar === 'string') {
        try {
            const parsedCalendar = JSON.parse(rawCalendar);

            if (
                parsedCalendar &&
                typeof parsedCalendar === 'object' &&
                !Array.isArray(parsedCalendar)
            ) {
                submissionCalendar = parsedCalendar;
            }
        } catch {
            // Keep an empty calendar if the provider's calendar
            // response cannot be parsed.
            submissionCalendar = {};
        }
    } else if (
        rawCalendar &&
        typeof rawCalendar === 'object' &&
        !Array.isArray(rawCalendar)
    ) {
        submissionCalendar = rawCalendar;
    }

    return {
        username: user.username,
        totalSolved,
        easySolved,
        mediumSolved,
        hardSolved,
        totalAvailable,
        easyAvailable,
        mediumAvailable,
        hardAvailable,
        contestRating:
            typeof rating === 'number' && Number.isFinite(rating)
                ? rating
                : null,
        submissionCalendar,
        fetchedAt: new Date(),
    };
}
