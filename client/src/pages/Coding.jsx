

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getCodingProfiles, syncLeetCode, getSolvedProblems, getProblemDays } from "../services/codingService";
import ProblemLog from "../components/coding/ProblemLog";
import SkillsPanel from "../components/coding/SkillsPanel";
import LaddersPanel from "../components/coding/LaddersPanel";
import PageHeader from "../components/common/PageHeader";



const MONTHS = [

    "Jan", "Feb", "Mar", "Apr", "May", "Jun",

    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",

];



function formatDate(date) {

    return date.toLocaleDateString("en-IN", {

        day: "numeric",

        month: "short",

        year: "numeric",

    });

}





function getSubmissionCount(calendar, date) {

    const dayStart = new Date(

        date.getFullYear(),

        date.getMonth(),

        date.getDate()

    ).getTime() / 1000;



    const nextDayStart = new Date(

        date.getFullYear(),

        date.getMonth(),

        date.getDate() + 1

    ).getTime() / 1000;



    let count = 0;



    for (const [timestamp, value] of Object.entries(calendar || {})) {

        const time = Number(timestamp);

        const submissions = Number(value);



        if (

            Number.isFinite(time) &&

            Number.isFinite(submissions) &&

            submissions > 0 &&

            time >= dayStart &&

            time < nextDayStart

        ) {

            count += submissions;

        }

    }



    return count;

}





// LeetCode buckets by UTC day: the square for a local day shows the UTC midnight that falls
// inside it, so the popup looks up that UTC date (docs/LEETCODE_TRACKING_LOG.md, D12).
function utcKeyForLocalDay(date) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
    const utcMidnight = Math.ceil(start / 86_400_000) * 86_400_000;
    return utcMidnight < end ? new Date(utcMidnight).toISOString().slice(0, 10) : null;
}

function getHeatLevel(count, maxCount) {

    if (count === 0) return 0;



    const ratio = count / Math.max(maxCount, 1);



    if (ratio <= 0.25) return 1;

    if (ratio <= 0.5) return 2;

    if (ratio <= 0.75) return 3;



    return 4;

}



const heatColors = [

    "bg-[var(--dt-border)]/50",

    "bg-emerald-900/50",

    "bg-emerald-700/70",

    "bg-emerald-500",

    "bg-emerald-300",

];





function ActivityHeatmap({ calendar, problemDays }) {

    const [activeTooltip, setActiveTooltip] = useState(null);



    const { weeks, months, totalSubmissions, activeDays, maxCount } =

        useMemo(() => {

            const today = new Date();

            today.setHours(0, 0, 0, 0);



            const start = new Date(today);

            start.setDate(start.getDate() - 364);

            start.setDate(start.getDate() - start.getDay());



            const days = [];

            const monthLabels = [];



            let total = 0;

            let active = 0;

            let maximum = 0;



            // End the displayed period today.

            const end = new Date(today);



            for (

                const date = new Date(start);

                date <= end;

                date.setDate(date.getDate() + 1)

            ) {

                const current = new Date(date);

                const count = getSubmissionCount(calendar, current);

                const future = current > today;



                days.push({ date: current, count, future });



                if (current.getDate() === 1) {

                    monthLabels.push({

                        date: current,

                        weekIndex: Math.floor((days.length - 1) / 7),

                    });

                }



                if (!future) {

                    total += count;



                    if (count > 0) active += 1;



                    maximum = Math.max(maximum, count);

                }

            }



            const groupedWeeks = [];



            for (let i = 0; i < days.length; i += 7) {

                groupedWeeks.push(days.slice(i, i + 7));

            }



            return {

                weeks: groupedWeeks,

                months: monthLabels,

                totalSubmissions: total,

                activeDays: active,

                maxCount: maximum,

            };

        }, [calendar]);



    const hasCalendar =

        calendar &&

        typeof calendar === "object" &&

        Object.keys(calendar).length > 0;



    function showTooltip(event, day) {

        if (day.future) return;



        const rect = event.currentTarget.getBoundingClientRect();
        const utcKey = utcKeyForLocalDay(day.date);
        const problems = (utcKey && problemDays?.days?.[utcKey]) || [];
        const tooltipWidth = problems.length ? 280 : 220;



        const x = Math.min(

            Math.max(rect.left + rect.width / 2, tooltipWidth / 2 + 8),

            window.innerWidth - tooltipWidth / 2 - 8

        );



        const showBelow = rect.top < 90;



        setActiveTooltip({
            date: day.date,
            count: day.count,
            problems,
            width: tooltipWidth,
            beforeTracking: !problemDays?.trackingSince || (utcKey && utcKey < problemDays.trackingSince.slice(0, 10)),

            x,

            y: showBelow ? rect.bottom + 10 : rect.top - 10,

            placement: showBelow ? "below" : "above",

        });

    }



    function hideTooltip() {

        setActiveTooltip(null);

    }



    if (!hasCalendar) {

        return (

            <div className="border-b border-[var(--dt-border)] py-6">

                <p className="text-sm text-[var(--dt-text-secondary)]">

                    No activity calendar available yet. Try refreshing your

                    LeetCode statistics.

                </p>

            </div>

        );

    }



    return (

        <div>

            {/* Activity summary */}

            <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3">

                <div>

                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--dt-text-muted)]">

                        Submissions

                    </p>

                    <p className="mt-1 text-2xl font-medium text-[var(--dt-text-primary)]">

                        {totalSubmissions.toLocaleString()}

                    </p>

                </div>



                <div>

                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--dt-text-muted)]">

                        Active days

                    </p>

                    <p className="mt-1 text-2xl font-medium text-[var(--dt-text-primary)]">

                        {activeDays}

                    </p>

                </div>



                <div className="col-span-2 sm:col-span-1">

                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--dt-text-muted)]">

                        Period

                    </p>

                    <p className="mt-1 text-sm text-[var(--dt-text-secondary)]">

                        Last 12 months

                    </p>

                </div>

            </div>



            {/* Scrollable heatmap */}

            <div

                className="overflow-x-auto pb-3"

                onMouseLeave={hideTooltip}

                onScroll={hideTooltip}

            >

                <div className="min-w-[650px]">

                    {/* Month labels */}

                    <div className="mb-2 grid grid-cols-[30px_1fr] gap-2">

                        <div />



                        <div className="relative h-4">

                            {months.map((month, index) => (

                                <span

                                    key={`${month.date.toISOString()}-${index}`}

                                    className="absolute text-[11px] text-[var(--dt-text-muted)]"

                                    style={{

                                        left: `${

                                            (month.weekIndex / weeks.length) *

                                            100

                                        }%`,

                                    }}

                                >

                                    {MONTHS[month.date.getMonth()]}

                                </span>

                            ))}

                        </div>

                    </div>



                    <div className="grid grid-cols-[30px_1fr] gap-2">

                        {/* Weekday labels */}

                        <div className="grid grid-rows-7 gap-[3px] text-[11px] text-[var(--dt-text-muted)]">

                            <span>Sun</span>

                            <span />

                            <span>Tue</span>

                            <span />

                            <span>Thu</span>

                            <span />

                            <span>Sat</span>

                        </div>



                        {/* Daily activity cells */}

                        <div className="flex gap-[3px]">

                            {weeks.map((week, weekIndex) => (

                                <div

                                    key={weekIndex}

                                    className="grid flex-1 grid-rows-7 gap-[3px]"

                                >

                                    {week.map((day) => {

                                        const level = getHeatLevel(

                                            day.count,

                                            maxCount

                                        );



                                        const accessibleLabel =

                                            `${formatDate(day.date)}, ` +

                                            `${day.count} submission` +

                                            (day.count === 1 ? "" : "s");



                                        return (

                                            <div

                                                key={day.date.toISOString()}

                                                role="img"

                                                tabIndex={day.future ? -1 : 0}

                                                aria-label={

                                                    day.future

                                                        ? undefined

                                                        : accessibleLabel

                                                }

                                                onMouseEnter={(event) =>

                                                    showTooltip(event, day)

                                                }

                                                onFocus={(event) =>

                                                    showTooltip(event, day)

                                                }

                                                onBlur={hideTooltip}

                                                className={`aspect-square min-w-0 rounded-[2px] outline-none transition-[opacity,box-shadow] duration-150 focus-visible:ring-1 focus-visible:ring-[var(--dt-accent-soft)] ${

                                                    day.future

                                                        ? "pointer-events-none opacity-0"

                                                        : `${heatColors[level]} cursor-pointer hover:brightness-125`

                                                }`}

                                            />

                                        );

                                    })}

                                </div>

                            ))}

                        </div>

                    </div>

                </div>

            </div>



            {/* Activity intensity legend */}

            <div className="mt-3 flex items-center justify-end gap-2">

                <span className="text-[11px] text-[var(--dt-text-muted)]">

                    Less

                </span>



                {heatColors.map((color, index) => (

                    <span

                        key={index}

                        className={`h-3 w-3 rounded-[2px] ${color}`}

                    />

                ))}



                <span className="text-[11px] text-[var(--dt-text-muted)]">

                    More

                </span>

            </div>



            {/* Custom DevTrack tooltip */}

            {activeTooltip && (

                <div

                    role="status"

                    className={`pointer-events-none fixed z-[100] rounded-lg border border-[var(--dt-border)] px-3 py-2.5 shadow-2xl shadow-black/40 [[data-theme=light]_&]:shadow-black/15 ${

                        activeTooltip.placement === "above"

                            ? "-translate-x-1/2 -translate-y-full"

                            : "-translate-x-1/2"

                    }`}

                    style={{

                        left: activeTooltip.x,
                        top: activeTooltip.y,
                        width: activeTooltip.width,
                        backgroundColor: "var(--dt-popover)",

                    }}

                >

                    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--dt-text-muted)]">

                        Coding activity

                    </p>



                    <p className="mt-1 text-sm font-medium text-[var(--dt-text-primary)]">

                        {formatDate(activeTooltip.date)}

                    </p>



                    <div className="mt-2 flex items-center justify-between border-t border-[var(--dt-border)] pt-2">

                        <span className="text-xs text-[var(--dt-text-secondary)]">

                            Submissions

                        </span>



                        <span className="text-sm font-medium tabular-nums text-[var(--dt-text-primary)]">

                            {activeTooltip.count.toLocaleString()}

                        </span>

                    </div>



                    <p className="mt-1 text-[11px] text-[var(--dt-text-muted)]">
                        {activeTooltip.count === 0
                            ? "No submissions recorded"
                            : activeTooltip.count === 1
                              ? "1 submission recorded"
                              : `${activeTooltip.count} submissions recorded`}
                    </p>
                    {activeTooltip.problems.length > 0 ? (
                        <ul className="mt-2 space-y-1 border-t border-[var(--dt-border)] pt-2">
                            {activeTooltip.problems.slice(0, 6).map((problem) => (
                                <li key={problem.titleSlug} className="flex items-start justify-between gap-2 text-xs">
                                    <span className="min-w-0 truncate text-[var(--dt-text-primary)]">{problem.title}</span>
                                    <span className="shrink-0 text-[11px] uppercase tracking-[0.1em] text-emerald-300">
                                        Accepted{problem.count > 1 ? ` ×${problem.count}` : ""}
                                    </span>
                                </li>
                            ))}
                            {activeTooltip.problems.length > 6 ? (
                                <li className="text-[11px] text-[var(--dt-text-muted)]">+{activeTooltip.problems.length - 6} more</li>
                            ) : null}
                        </ul>
                    ) : activeTooltip.count > 0 ? (
                        <p className="mt-2 border-t border-[var(--dt-border)] pt-2 text-[11px] leading-4 text-[var(--dt-text-muted)]">
                            {activeTooltip.beforeTracking
                                ? "Problem titles are tracked from the day you started using problem tracking."
                                : "No accepted problems tracked this day."}
                        </p>
                    ) : null}

                </div>

            )}

        </div>

    );

}





function Coding() {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [problems, setProblems] = useState({ data: null, loading: true, error: "", loadingMore: false });
    const [problemDays, setProblemDays] = useState(null);
    // Bumped after every load so the skills panel re-reads the (possibly re-synced) problem log.
    const [skillsVersion, setSkillsVersion] = useState(0);
    // Profile, problem log and heatmap details. Each part fails on its own.
    const loadAll = useCallback(async () => {
        const result = await getCodingProfiles();
        const leetcode = result.data.profiles.find((item) => item.platform === "leetcode") || null;
        setProfile(leetcode);
        if (!leetcode) return null;

        const today = new Date();
        const from = new Date(today.getTime() - 370 * 86_400_000).toISOString().slice(0, 10);
        const to = new Date(today.getTime() + 86_400_000).toISOString().slice(0, 10);
        await Promise.all([
            getSolvedProblems(1)
                .then((data) => setProblems({ data, loading: false, error: "", loadingMore: false }))
                .catch((err) => setProblems((current) => ({ ...current, loading: false, error: err.message || "Could not load the problem log." }))),
            getProblemDays(from, to)
                .then(setProblemDays)
                .catch(() => setProblemDays(null)),
        ]);
        setSkillsVersion((value) => value + 1);
        return leetcode;
    }, []);

    useEffect(() => {
        let active = true;
        loadAll()
            .then(async (leetcode) => {
                // Show stored data as soon as it arrives; the LeetCode check below can take seconds.
                if (active) setLoading(false);
                if (!active || leetcode?.connectionStatus !== "verified") return;
                const outcome = await syncLeetCode().catch(() => null);
                if (active && outcome?.status === "synced") await loadAll();
            })
            .catch((err) => active && setError(err.message || "Failed to load coding statistics."))
            .finally(() => active && setLoading(false));
        return () => {
            active = false;
        };
    }, [loadAll]);

    // One page of the problem log at a time (numbered pages instead of an ever-growing list).
    async function showProblemPage(page) {
        if (!problems.data) return;
        setProblems((current) => ({ ...current, loadingMore: true }));
        try {
            const next = await getSolvedProblems(page);
            setProblems((current) => ({ ...current, loadingMore: false, error: "", data: next }));
        } catch (err) {
            setProblems((current) => ({ ...current, loadingMore: false, error: err.message || "Could not load that page." }));
        }
    }

    async function handleRefresh() {
        setError("");
        setMessage("");
        setRefreshing(true);
        try {
            const outcome = await syncLeetCode(true);
            await loadAll();
            if (outcome.status === "fresh") {
                setMessage("Already up to date.");
            } else if (outcome.stats === "failed" || outcome.submissions === "failed") {
                setMessage(outcome.stats === "failed"
                    ? "Problems synced, but LeetCode statistics could not be refreshed. Saved statistics were kept."
                    : "Statistics refreshed, but recent problems could not be loaded from LeetCode. Try again shortly.");
            } else {
                setMessage(outcome.newSolves
                    ? `Synced. ${outcome.newSolves} new ${outcome.newSolves === 1 ? "problem" : "problems"} on your timeline.`
                    : "Synced. No new accepted problems since the last check.");
            }
        } catch (err) {
            setError(err.message || "Failed to refresh statistics.");
        } finally {
            setRefreshing(false);
        }
    }

    const stats = profile?.stats;
    const totalSolved = stats?.totalSolved;
    const totalAvailable = stats?.totalAvailable;
    const hasValidProgress = typeof totalSolved === "number" && Number.isFinite(totalSolved) && totalSolved >= 0 && typeof totalAvailable === "number" && Number.isFinite(totalAvailable) && totalAvailable > 0;
    const progress = hasValidProgress ? Math.min(100, (totalSolved / totalAvailable) * 100) : null;
    const difficultyStats = [
        { label: "Easy", solved: stats?.easySolved, available: stats?.easyAvailable },
        { label: "Medium", solved: stats?.mediumSolved, available: stats?.mediumAvailable },
        { label: "Hard", solved: stats?.hardSolved, available: stats?.hardAvailable },
    ];
    const contestRating = typeof stats?.contestRating === "number" ? Math.round(stats.contestRating) : null;

    if (loading) {
        return <p className="text-sm text-[var(--dt-text-secondary)]">Loading coding statistics...</p>;
    }

    return (
        <section>
            <PageHeader
                eyebrow="04 — Coding"
                title="Small steps. Stronger skills."
                description="Your coding practice at a glance. Connect and manage coding platforms in Settings."
            >
                {profile && <button type="button" onClick={handleRefresh} disabled={refreshing} className="self-start border border-[var(--dt-border)] px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--dt-text-secondary)] transition-colors hover:text-[var(--dt-accent-soft)] disabled:opacity-40 sm:self-auto">{refreshing ? "Refreshing..." : "↻ Refresh stats"}</button>}
            </PageHeader>

            {error && <div role="alert" className="mb-6 border-l-2 border-red-400 py-2 pl-3 text-sm text-red-400">{error}</div>}
            {message && <div role="status" className="mb-6 border-l-2 border-[var(--dt-accent-soft)] py-2 pl-3 text-sm text-[var(--dt-text-secondary)]">{message}</div>}

            {!profile && (
                <div className="mb-6 border border-[var(--dt-border)] p-5">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">No coding profile connected</p>
                    <h2 className="mt-3 text-xl font-medium text-[var(--dt-text-primary)]">Your coding stats will appear here.</h2>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--dt-text-secondary)]">Connect and verify a coding account in Settings. DevTrack only displays statistics after ownership is verified.</p>
                    <Link to="/app/settings" className="mt-5 inline-flex border border-[var(--dt-border)] px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--dt-text-secondary)] hover:text-[var(--dt-accent-soft)]">Manage connected accounts →</Link>
                </div>
            )}

            <div className={profile ? "grid grid-cols-[minmax(0,1fr)] gap-8 min-[1340px]:grid-cols-[minmax(0,1fr)_18.5rem] min-[1340px]:gap-8" : ""}>
            <div className="min-w-0">
            {profile && <div className="mb-8 flex flex-wrap items-center gap-3 border-b border-[var(--dt-border)] pb-4">
                <div><p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">Connected platform</p><p className="mt-1 text-sm text-[var(--dt-text-primary)]">LeetCode · <a href={`https://leetcode.com/${encodeURIComponent(profile.username)}/`} target="_blank" rel="noreferrer" className="text-[var(--dt-accent-soft)] hover:underline">@{profile.username}</a></p></div>
                <span className="ml-auto text-[11px] uppercase tracking-[0.15em] text-[var(--dt-text-muted)]">Verified</span>
            </div>}

            {profile ? (

                <>

                    <section className="mb-6">

                        <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--dt-border)] pb-3">

                            <div>

                                <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">

                                    Problem-solving progress

                                </p>

                                <p className="mt-1 text-sm text-[var(--dt-text-secondary)]">

                                    Latest LeetCode snapshot

                                </p>

                            </div>



                            <span className="text-[11px] text-[var(--dt-text-muted)]">

                                {stats?.lastFetchedAt

                                    ? `Updated ${formatDate(new Date(stats.lastFetchedAt))}`

                                    : "Not yet refreshed"}

                            </span>

                        </div>



                        <div className="py-5">

                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">

                                <div>

                                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--dt-text-muted)]">

                                        Total problems solved

                                    </p>

                                    <p className="mt-1 text-4xl font-medium tracking-tight text-[var(--dt-text-primary)]">

                                        {totalSolved ?? "—"}

                                    </p>

                                </div>



                                {progress !== null && (

                                    <p className="text-xs text-[var(--dt-text-secondary)]">

                                        {progress.toFixed(2)}% of available problems

                                    </p>

                                )}

                            </div>



                            {progress !== null ? (

                                <>

                                    <div

                                        className="mt-6 h-1 overflow-hidden bg-[var(--dt-border)]"

                                        role="progressbar"

                                        aria-label="LeetCode problems solved"

                                        aria-valuemin={0}

                                        aria-valuemax={100}

                                        aria-valuenow={Number(progress.toFixed(2))}

                                    >

                                        <div

                                            className="h-full bg-[var(--dt-accent-soft)] transition-all duration-500"

                                            style={{ width: `${progress}%` }}

                                        />

                                    </div>



                                    <div className="mt-2 flex justify-between text-[11px] text-[var(--dt-text-muted)]">

                                        <span>{totalSolved.toLocaleString()} solved</span>

                                        <span>{totalAvailable.toLocaleString()} available</span>

                                    </div>

                                </>

                            ) : (

                                <p className="mt-4 text-sm text-[var(--dt-text-secondary)]">

                                    Progress unavailable. Refresh your statistics to try again.

                                </p>

                            )}

                        </div>

                    </section>



                    <section className="mb-6">

                        <div className="mb-4 border-b border-[var(--dt-border)] pb-3">

                            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">

                                Difficulty breakdown

                            </p>

                        </div>



                        <div className="grid border-b border-[var(--dt-border)] sm:grid-cols-3">

                            {difficultyStats.map((item, index) => {

                                const valid =

                                    typeof item.solved === "number" &&

                                    typeof item.available === "number" &&

                                    item.available > 0;



                                const percentage = valid

                                    ? Math.min(100, (item.solved / item.available) * 100)

                                    : null;



                                return (

                                    <div

                                        key={item.label}

                                        className={`border-b border-[var(--dt-border)] py-5 sm:border-b-0 ${

                                            index > 0

                                                ? "sm:ml-5 sm:pl-5"

                                                : ""

                                        } ${

                                            index < 2

                                                ? "sm:border-r sm:border-[var(--dt-border)] sm:pr-5"

                                                : ""

                                        }`}

                                    >

                                        <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--dt-text-muted)]">

                                            {item.label}

                                        </p>



                                        <p className="mt-3 text-3xl font-medium tracking-tight text-[var(--dt-text-primary)]">

                                            {item.solved ?? "—"}

                                        </p>



                                        <p className="mt-1 text-[11px] text-[var(--dt-text-secondary)]">

                                            {item.available != null

                                                ? `of ${item.available.toLocaleString()} available`

                                                : "Available count unknown"}

                                        </p>



                                        {percentage !== null ? (

                                            <>

                                                <div

                                                    className="mt-4 h-1 overflow-hidden bg-[var(--dt-border)]"

                                                    role="progressbar"

                                                    aria-label={`${item.label} problems solved`}

                                                    aria-valuemin={0}

                                                    aria-valuemax={100}

                                                    aria-valuenow={Number(percentage.toFixed(2))}

                                                >

                                                    <div

                                                        className="h-full bg-[var(--dt-accent-soft)]"

                                                        style={{ width: `${percentage}%` }}

                                                    />

                                                </div>



                                                <p className="mt-2 text-[11px] text-[var(--dt-text-muted)]">

                                                    {percentage.toFixed(1)}% solved

                                                </p>

                                            </>

                                        ) : (

                                            <p className="mt-4 text-[11px] text-[var(--dt-text-muted)]">

                                                Progress unavailable

                                            </p>

                                        )}

                                    </div>

                                );

                            })}

                        </div>

                    </section>



                    <section className="mb-6">

                        <div className="mb-4 border-b border-[var(--dt-border)] pb-3">

                            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">

                                Activity

                            </p>

                            <p className="mt-1 text-sm text-[var(--dt-text-secondary)]">

                                Your LeetCode submission history

                            </p>

                        </div>



                        <div className="py-3">

                            <ActivityHeatmap calendar={stats?.submissionCalendar} problemDays={problemDays} />

                        </div>

                    </section>



                    <SkillsPanel version={skillsVersion} />
                    <LaddersPanel version={skillsVersion} />

                    <section>

                        <div className="mb-4 border-b border-[var(--dt-border)] pb-3">

                            <p className="text-[11px] uppercase tracking-[0.2em] text-[var(--dt-text-muted)]">

                                Contest performance

                            </p>

                        </div>



                        <div className="flex flex-col gap-2 py-4 sm:flex-row sm:items-end sm:justify-between">

                            <div>

                                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--dt-text-muted)]">

                                    LeetCode contest rating

                                </p>

                                <p className="mt-2 text-4xl font-medium tracking-tight text-[var(--dt-text-primary)]">

                                    {contestRating ?? "—"}

                                </p>

                            </div>



                            <p className="max-w-sm text-xs leading-5 text-[var(--dt-text-secondary)]">

                                Keep practising and participating in contests to build your competitive programming skills.

                            </p>

                        </div>

                    </section>

                </>
            ) : null}
            </div>
            {profile ? (
                <ProblemLog
                    data={problems.data}
                    loading={problems.loading}
                    error={problems.error}
                    loadingMore={problems.loadingMore}
                    onPageChange={showProblemPage}
                />
            ) : null}
            </div>
        </section>
    );
}

export default Coding;
