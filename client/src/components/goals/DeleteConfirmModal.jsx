function DeleteConfirmModal({ goal, loading, onConfirm, onCancel }) {
  if (!goal) {
    return null;
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="delete-goal-title">
      <div>
        <h2 id="delete-goal-title">Delete Goal?</h2>

        <p>
          Are you sure you want to delete <strong>{goal.title}</strong>?
        </p>

        <p>This action cannot be undone.</p>

        <div>
          <button type="button" onClick={onCancel} disabled={loading}>
            Cancel
          </button>

          <button type="button" onClick={onConfirm} disabled={loading}>
            {loading ? "Deleting..." : "Delete Goal"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteConfirmModal;
