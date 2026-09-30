import { useEffect } from "react";

function DeleteConfirmModal({
    goal,
    loading,
    onConfirm,
    onCancel,
}) {
    useEffect(() => {
        if (!goal) {
            return;
        }

        function handleKeyDown(event) {
            if (event.key === "Escape" && !loading) {
                onCancel();
            }
        }

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [goal, loading, onCancel]);

    if (!goal) {
        return null;
    }

    return (
        <div
            className="
                fixed
                inset-0
                z-50
                flex
                items-center
                justify-center
                bg-black/60
                px-6
                backdrop-blur-[2px]
            "
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-goal-title"
        >
            <div
                className="
                    w-full
                    max-w-md
                    border
                    border-[var(--dt-border-strong)]
                    bg-[var(--dt-surface)]
                    p-7
                    shadow-2xl
                    animate-[dt-modal-in_180ms_ease-out]
                    md:p-8
                "
            >
                {/* Eyebrow */}
                <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-red-400/80">
                    Destructive action
                </p>

                {/* Heading */}
                <h2
                    id="delete-goal-title"
                    className="
                        mt-4
                        font-[var(--dt-font-display)]
                        text-3xl
                        leading-tight
                        text-[var(--dt-text-primary)]
                    "
                >
                    Delete this goal?
                </h2>

                {/* Description */}
                <p className="mt-4 text-sm leading-6 text-[var(--dt-text-secondary)]">
                    You're about to permanently delete:
                </p>

                <div className="mt-4 border-l-2 border-[var(--dt-border-strong)] pl-4">
                    <p className="text-sm font-medium text-[var(--dt-text-primary)]">
                        {goal.title}
                    </p>
                </div>

                <p className="mt-5 text-xs leading-5 text-[var(--dt-text-muted)]">
                    This action cannot be undone.
                </p>

                {/* Actions */}
                <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={loading}
                        className="
                            px-5
                            py-3
                            text-xs
                            font-medium
                            uppercase
                            tracking-[0.18em]
                            text-[var(--dt-text-secondary)]
                            transition-colors
                            duration-200
                            hover:text-[var(--dt-text-primary)]
                            disabled:opacity-40
                        "
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={loading}
                        className="
                            border
                            border-red-500/60
                            bg-red-500/10
                            px-5
                            py-3
                            text-xs
                            font-medium
                            uppercase
                            tracking-[0.18em]
                            text-red-300
                            transition-all
                            duration-200
                            hover:border-red-400
                            hover:bg-red-500/20
                            hover:text-red-200
                            disabled:cursor-not-allowed
                            disabled:opacity-40
                        "
                    >
                        {loading ? "Deleting..." : "Delete Goal"}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DeleteConfirmModal;